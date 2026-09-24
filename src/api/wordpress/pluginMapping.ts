/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parsing of the responses of the routes that the installed paydar-portal plugin already has
 * (/me, /projects, /accounting/*).
 *
 * IMPORTANT: the plugin source was not available when this file was written, so the field names below
 * are the expected shape, not a verified one. Parsing is strict on purpose: an unexpected shape stops
 * with a message naming the route and the field, instead of silently showing empty or wrong figures.
 * When the plugin code is available, align the names here (and only here) with it.
 */

import type { AccountNature, AccountNode, AuditLog, JournalEntry, JournalEntryRow, JournalEntryStatus, Project, UserProfile } from '../../types';
import { roleFromWordPress } from '../../utils/permissions';
import { ApiError } from '../client';

export class PluginShapeError extends ApiError {
  constructor(route: string, field: string, detail: string) {
    super(422, `paydar-portal ${route}: ${field} ${detail}`, `پاسخ مسیر ${route} افزونه پایدار با قالب مورد انتظار پرتال نمی‌خواند (فیلد ${field}: ${detail}).`);
    this.name = 'PluginShapeError';
  }
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function obj(route: string, value: unknown, field = 'پاسخ'): Obj {
  if (!isObj(value)) throw new PluginShapeError(route, field, 'شیء نیست');
  return value;
}

/** Lists may come bare or wrapped as { items: [...] }. */
function list(route: string, value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isObj(value) && Array.isArray(value.items)) return value.items;
  throw new PluginShapeError(route, 'پاسخ', 'فهرست نیست');
}

function str(route: string, o: Obj, field: string, optional = false): string {
  const v = o[field];
  if (v === undefined || v === null || v === '') {
    if (optional) return '';
    throw new PluginShapeError(route, field, 'وجود ندارد');
  }
  if (typeof v !== 'string' && typeof v !== 'number') throw new PluginShapeError(route, field, 'متن نیست');
  return String(v);
}

/** Amounts on the wire are integer Rials; anything else is refused. */
function rial(route: string, o: Obj, field: string, optional = false): number {
  const v = o[field];
  if ((v === undefined || v === null) && optional) return 0;
  const n = typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isSafeInteger(n)) throw new PluginShapeError(route, field, 'مبلغ صحیح به ریال نیست');
  return n;
}

// ---------------------------------------------------------------------------- /me

export interface PluginMe {
  user: UserProfile;
  currency?: 'rial' | 'toman';
  fiscalYear?: number;
}

export function parseMe(raw: unknown): PluginMe {
  const route = '/me';
  const o = obj(route, raw);
  const roleSlug = str(route, o, 'role');
  const role = roleFromWordPress(roleSlug);
  if (!role) throw new ApiError(403, `Unknown role ${roleSlug}`, 'نقش کاربری شما در پرتال تعریف نشده است. با مدیر سیستم تماس بگیرید.');
  const projectIds = o.project_ids;
  if (role === 'مدیر پروژه' && !Array.isArray(projectIds)) throw new PluginShapeError(route, 'project_ids', 'برای مدیر پروژه فهرست نیست');
  const currency = o.currency === 'rial' || o.currency === 'toman' ? o.currency : undefined;
  const fy = typeof o.fiscal_year === 'number' ? o.fiscal_year : undefined;
  return {
    user: {
      id: str(route, o, 'id'),
      name: str(route, o, 'display_name'),
      email: str(route, o, 'email', true),
      avatar: str(route, o, 'avatar', true),
      role,
      // Only a project manager is scoped; an empty list means no project, never "all projects".
      projectIds: role === 'مدیر پروژه' ? (projectIds as unknown[]).map(String) : undefined,
    },
    currency,
    fiscalYear: fy,
  };
}

// ---------------------------------------------------------------------------- /accounting/settings

export interface PluginAccountingSettings {
  currency: 'rial' | 'toman';
  fiscalYear: number;
  closedFiscalYears: number[];
}

export function parseAccountingSettings(raw: unknown): PluginAccountingSettings {
  const route = '/accounting/settings';
  const o = obj(route, raw);
  if (o.currency !== 'rial' && o.currency !== 'toman') throw new PluginShapeError(route, 'currency', 'باید rial یا toman باشد');
  const fy = Number(str(route, o, 'fiscal_year'));
  if (!Number.isInteger(fy) || fy < 1300) throw new PluginShapeError(route, 'fiscal_year', 'سال شمسی معتبر نیست');
  const closed = Array.isArray(o.closed_fiscal_years) ? o.closed_fiscal_years.map(Number).filter(Number.isInteger) : [];
  return { currency: o.currency, fiscalYear: fy, closedFiscalYears: closed };
}

// ---------------------------------------------------------------------------- /projects

const PROJECT_STATUSES: Project['status'][] = ['در حال اجرا', 'تجهیز کارگاه', 'تحویل موقت', 'تعلیق', 'اختتام'];

/** Only identity and plan fields come from /projects; every financial figure is derived from the ledger. */
export function parseProjects(raw: unknown): Project[] {
  const route = '/projects';
  return list(route, raw).map((item, i) => {
    const o = obj(route, item, `[${i}]`);
    const status = str(route, o, 'status', true) as Project['status'];
    return {
      id: str(route, o, 'id'),
      code: str(route, o, 'code', true) || str(route, o, 'id'),
      name: str(route, o, 'name'),
      clientId: str(route, o, 'client_id', true),
      consultantId: '',
      managerUserId: str(route, o, 'manager_id', true),
      siteSupervisor: '',
      costCenterIds: [],
      contractIds: [],
      client: str(route, o, 'client', true),
      contractAmount: rial(route, o, 'contract_amount', true),
      recordedRevenue: 0,
      cost: 0,
      profit: 0,
      profitMargin: 0,
      physicalProgress: Number(o.physical_progress ?? 0) || 0,
      financialProgress: 0,
      receivables: 0,
      liabilities: 0,
      budget: rial(route, o, 'budget', true),
      actualCost: 0,
      forecastFinalCost: 0,
      status: PROJECT_STATUSES.includes(status) ? status : 'در حال اجرا',
      manager: str(route, o, 'manager_name', true),
      startDate: str(route, o, 'start_date', true),
      expectedEndDate: str(route, o, 'end_date', true),
      directCost: 0,
      indirectCost: 0,
      cashInflow: 0,
      cashOutflow: 0,
      expenseBreakdown: { materials: 0, labor: 0, machinery: 0, transport: 0, subcontractors: 0, procurement: 0, office: 0, insurance: 0, tax: 0, other: 0 },
    };
  });
}

// ---------------------------------------------------------------------------- /accounting/accounts

const LEVELS: AccountNode['level'][] = ['گروه', 'کل', 'معین', 'تفصیلی'];

/** Flat account list (code, title, parent_code) → chart tree. Balances are derived from final entries. */
export function parseAccounts(raw: unknown): AccountNode[] {
  const route = '/accounting/accounts';
  const nodes = list(route, raw).map((item, i) => {
    const o = obj(route, item, `[${i}]`);
    const code = str(route, o, 'code');
    const nature = o.nature === 'بستانکار' || o.nature === 'credit' ? 'بستانکار' : o.nature === 'دوگانه' || o.nature === 'both' ? 'دوگانه' : 'بدهکار';
    const level = LEVELS[Math.min(3, Math.max(0, code.length <= 1 ? 0 : code.length <= 2 ? 1 : code.length <= 3 ? 2 : 3))];
    const node: AccountNode = {
      code,
      title: str(route, o, 'title'),
      level,
      nature: nature as AccountNature,
      parentCode: str(route, o, 'parent_code', true) || undefined,
      balance: 0,
      turnoverDebit: 0,
      turnoverCredit: 0,
      children: [],
    };
    return node;
  });
  const byCode = new Map(nodes.map((n) => [n.code, n]));
  const roots: AccountNode[] = [];
  for (const n of nodes) {
    const parent = n.parentCode ? byCode.get(n.parentCode) : undefined;
    if (parent) parent.children!.push(n);
    else roots.push(n);
  }
  for (const n of nodes) if (!n.children!.length) delete n.children;
  return roots;
}

// ---------------------------------------------------------------------------- /accounting/entries

const ENTRY_STATUS: Record<string, JournalEntryStatus> = {
  draft: 'در انتظار تأیید',
  pending: 'در انتظار تأیید',
  posted: 'ثبت قطعی',
  reversed: 'برگشت خورده',
  rejected: 'رد شده',
};

export function parseEntry(raw: unknown, route = '/accounting/entries'): JournalEntry {
  const o = obj(route, raw);
  const statusKey = str(route, o, 'status');
  const status = ENTRY_STATUS[statusKey];
  if (!status) throw new PluginShapeError(route, 'status', `مقدار ناشناخته «${statusKey}»`);
  if (!Array.isArray(o.lines)) throw new PluginShapeError(route, 'lines', 'فهرست ردیف‌ها نیست');
  const rows: JournalEntryRow[] = o.lines.map((line, i) => {
    const l = obj(route, line, `lines[${i}]`);
    return {
      id: str(route, l, 'id', true) || `${str(route, o, 'id')}-${i + 1}`,
      accountCode: str(route, l, 'account_code'),
      accountName: str(route, l, 'account_title', true),
      subledgerCode: str(route, l, 'subledger_code', true) || undefined,
      subledgerName: str(route, l, 'subledger_title', true) || undefined,
      description: str(route, l, 'description', true),
      debit: rial(route, l, 'debit'),
      credit: rial(route, l, 'credit'),
      projectId: str(route, l, 'project_id', true) || undefined,
      costCenterId: str(route, l, 'cost_center_id', true) || undefined,
    };
  });
  const totalDebit = rows.reduce((a, r) => a + r.debit, 0);
  const totalCredit = rows.reduce((a, r) => a + r.credit, 0);
  const version = o.version === undefined ? undefined : Number(o.version);
  return {
    id: str(route, o, 'id'),
    docNumber: str(route, o, 'number', true),
    date: str(route, o, 'date'),
    title: str(route, o, 'description', true),
    type: 'عمومی',
    projectId: str(route, o, 'project_id', true) || undefined,
    submitter: str(route, o, 'created_by', true),
    status,
    rows,
    totalDebit,
    totalCredit,
    isBalanced: totalDebit === totalCredit,
    reversedFromDocId: str(route, o, 'reversal_of', true) || undefined,
    version: Number.isFinite(version) ? version : undefined,
    history: [],
  };
}

export function parseEntries(raw: unknown): JournalEntry[] {
  const route = '/accounting/entries';
  return list(route, raw).map((e) => parseEntry(e, route));
}

// ---------------------------------------------------------------------------- /accounting/audit

export function parseAudit(raw: unknown): AuditLog[] {
  const route = '/accounting/audit';
  return list(route, raw).map((item, i) => {
    const o = obj(route, item, `[${i}]`);
    const [date, time = ''] = str(route, o, 'created_at').split(' ');
    return {
      id: str(route, o, 'id'),
      date,
      time,
      user: str(route, o, 'user', true),
      role: str(route, o, 'role', true),
      action: 'ایجاد سند',
      targetDoc: str(route, o, 'target', true),
      description: str(route, o, 'message', true),
    };
  });
}

/** Body of POST /accounting/entries (draft only; the server numbers and totals it). */
export function toEntryDraftBody(entry: JournalEntry) {
  return {
    date: entry.date,
    description: entry.title,
    project_id: entry.projectId || null,
    lines: entry.rows
      .filter((r) => r.debit > 0 || r.credit > 0)
      .map((r) => ({
        account_code: r.accountCode,
        subledger_code: r.subledgerCode || null,
        description: r.description,
        debit: r.debit,
        credit: r.credit,
        project_id: r.projectId || null,
        cost_center_id: r.costCenterId || null,
      })),
  };
}
