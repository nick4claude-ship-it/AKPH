/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Responses of the akph/v1 server (wordpress-plugin/akph-portal, docs/API-CONTRACT.md) → app records, and
 * app input → command bodies. Parsing is strict: an unexpected shape stops with a message naming the route
 * and the field instead of showing wrong figures. Amounts are integer Rials both ways; dates on the wire are
 * Gregorian ISO and Jalali in the app.
 */

import type {
  AccountLevel,
  AccountNature,
  AccountNode,
  AuditLog,
  CostCenter,
  Counterparty,
  CounterpartyKind,
  JournalEntry,
  JournalEntryRow,
  JournalEntryStatus,
  JournalEntryType,
  Project,
  ProjectStatus,
  UserProfile,
} from '../../types';
import { PORTAL_ROLES } from '../../utils/permissions';
import { isoToJalali, jalaliToIso } from '../../utils/jalali';
import { ApiError } from '../client';

export class ShapeError extends ApiError {
  constructor(route: string, field: string, detail: string) {
    super(422, `akph/v1 ${route}: ${field} ${detail}`, `پاسخ سرور (${route}) قالب مورد انتظار را ندارد (فیلد ${field}: ${detail}).`);
    this.name = 'ShapeError';
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

export function obj(route: string, value: unknown, field = 'پاسخ'): Obj {
  if (!isObj(value)) throw new ShapeError(route, field, 'شیء نیست');
  return value;
}

export function arr(route: string, o: Obj, field: string): unknown[] {
  const v = o[field];
  if (!Array.isArray(v)) throw new ShapeError(route, field, 'فهرست نیست');
  return v;
}

function str(route: string, o: Obj, field: string, optional = false): string {
  const v = o[field];
  if (v === undefined || v === null || v === '') {
    if (optional) return '';
    throw new ShapeError(route, field, 'وجود ندارد');
  }
  if (typeof v !== 'string' && typeof v !== 'number') throw new ShapeError(route, field, 'متن نیست');
  return String(v);
}

function rial(route: string, o: Obj, field: string): number {
  const v = o[field];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw new ShapeError(route, field, 'مبلغ صحیح به ریال نیست');
  return v;
}

function int(route: string, o: Obj, field: string): number {
  const v = o[field];
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new ShapeError(route, field, 'عدد صحیح نیست');
  return v;
}

/** ISO date of the wire → Jalali of the app ('' when absent). */
function jdate(route: string, o: Obj, field: string, optional = false): string {
  const v = o[field];
  if ((v === null || v === undefined || v === '') && optional) return '';
  const j = isoToJalali(typeof v === 'string' ? v : '');
  if (!j) throw new ShapeError(route, field, 'تاریخ YYYY-MM-DD نیست');
  return j;
}

/** Jalali date typed in the app → ISO for the server; a clear error for a day that does not exist. */
export function toIsoDate(jalali: string): string {
  const iso = jalaliToIso(jalali);
  if (!iso) throw new ApiError(400, `Invalid Jalali date ${jalali}`, `تاریخ «${jalali}» تاریخ شمسی معتبر نیست.`);
  return iso;
}

// ---------------------------------------------------------------------------- /me

export interface Me {
  user: UserProfile;
  currency: 'rial' | 'toman';
  fiscalYear: number;
  closedFiscalYears: number[];
}

export function parseMe(raw: unknown): Me {
  const route = '/me';
  const o = obj(route, raw);
  const role = str(route, o, 'role', true);
  if (!(PORTAL_ROLES as readonly string[]).includes(role)) {
    throw new ApiError(403, `No portal role`, 'حساب شما نقش پرتال ندارد. با مدیر سیستم تماس بگیرید.');
  }
  const viewAll = o.view_all === true;
  const projectIds = arr(route, o, 'project_ids').map(String);
  const currency = o.currency === 'rial' ? 'rial' : o.currency === 'toman' ? 'toman' : null;
  if (!currency) throw new ShapeError(route, 'currency', 'ریال یا تومان نیست');
  return {
    user: {
      id: str(route, o, 'id'),
      name: str(route, o, 'display_name', true) || 'کاربر',
      role: role as UserProfile['role'],
      email: '',
      avatar: '',
      projectIds: viewAll ? undefined : projectIds,
    },
    currency,
    fiscalYear: int(route, o, 'fiscal_year'),
    closedFiscalYears: arr(route, o, 'closed_fiscal_years').map((y) => Number(y)).filter((y) => Number.isInteger(y)),
  };
}

// ---------------------------------------------------------------------------- projects

const PROJECT_STATUS: Record<string, ProjectStatus> = {
  active: 'در حال اجرا',
  mobilizing: 'تجهیز کارگاه',
  provisional_handover: 'تحویل موقت',
  suspended: 'تعلیق',
  closed: 'اختتام',
};
export const PROJECT_STATUS_KEYS: Record<ProjectStatus, string> = Object.fromEntries(Object.entries(PROJECT_STATUS).map(([k, v]) => [v, k])) as Record<ProjectStatus, string>;

export function parseProject(raw: unknown, costCenters: readonly CostCenter[] = []): Project {
  const route = '/projects';
  const o = obj(route, raw, 'project');
  const id = str(route, o, 'id');
  const status = PROJECT_STATUS[str(route, o, 'status')];
  if (!status) throw new ShapeError(route, 'status', 'وضعیت ناشناخته');
  const ms = obj(route, o.manual_summary, 'manual_summary');
  const budget = rial(route, o, 'budget');
  return {
    id,
    code: str(route, o, 'code'),
    name: str(route, o, 'name'),
    clientId: str(route, o, 'client_id', true),
    consultantId: '',
    managerUserId: str(route, o, 'manager_user_id', true),
    siteSupervisor: str(route, o, 'site_supervisor', true),
    costCenterIds: costCenters.filter((c) => c.projectId === id).map((c) => c.id),
    contractIds: [],
    client: str(route, o, 'client_name', true),
    contractAmount: rial(route, o, 'contract_amount'),
    // Ledger figures are computed by the selectors from posted entries, never taken from this record.
    recordedRevenue: 0,
    cost: 0,
    profit: 0,
    profitMargin: 0,
    physicalProgress: int(route, o, 'physical_progress'),
    financialProgress: 0,
    receivables: 0,
    liabilities: 0,
    budget,
    actualCost: 0,
    forecastFinalCost: budget,
    status,
    manager: str(route, o, 'manager_name', true),
    startDate: jdate(route, o, 'start_date', true),
    expectedEndDate: jdate(route, o, 'end_date', true),
    directCost: 0,
    indirectCost: 0,
    cashInflow: 0,
    cashOutflow: 0,
    expenseBreakdown: { materials: 0, labor: 0, machinery: 0, transport: 0, subcontractors: 0, procurement: 0, office: 0, insurance: 0, tax: 0, other: 0 },
    location: str(route, o, 'location', true),
    contractRef: str(route, o, 'contract_ref', true),
    description: str(route, o, 'description', true),
    consultantName: str(route, o, 'consultant_name', true),
    manualSummary: {
      revenue: rial(route, ms, 'revenue'),
      cost: rial(route, ms, 'cost'),
      cash: rial(route, ms, 'cash'),
      receivable: rial(route, ms, 'receivable'),
      payable: rial(route, ms, 'payable'),
      note: str(route, ms, 'note', true),
    },
    version: int(route, o, 'version'),
    editableGroups: arr(route, o, 'editable').map(String),
  };
}

// ---------------------------------------------------------------------------- master data

const COST_CENTER_TYPE: Record<string, string> = {
  project_site: 'کارگاه پروژه',
  headquarters: 'دفتر مرکزی',
  central_warehouse: 'انبار مرکزی',
  machinery: 'کارگاه ماشین‌آلات',
  technical_office: 'دفتر فنی',
  other: 'سایر',
};
export const COST_CENTER_TYPE_KEYS: Record<string, string> = Object.fromEntries(Object.entries(COST_CENTER_TYPE).map(([k, v]) => [v, k]));

export function parseCostCenter(raw: unknown): CostCenter {
  const route = '/cost-centers';
  const o = obj(route, raw, 'cost_center');
  return {
    id: str(route, o, 'id'),
    projectId: str(route, o, 'project_id', true) || undefined,
    code: str(route, o, 'code'),
    name: str(route, o, 'name'),
    type: COST_CENTER_TYPE[str(route, o, 'type', true)] || 'سایر',
    manager: str(route, o, 'manager_name', true),
    budget: rial(route, o, 'budget'),
    version: int(route, o, 'version'),
  };
}

const COUNTERPARTY_KINDS: readonly CounterpartyKind[] = ['client', 'supplier', 'subcontractor', 'consultant', 'employee', 'bank', 'other'];

export function parseCounterparty(raw: unknown): Counterparty {
  const route = '/counterparties';
  const o = obj(route, raw, 'counterparty');
  const kind = str(route, o, 'kind') as CounterpartyKind;
  if (!COUNTERPARTY_KINDS.includes(kind)) throw new ShapeError(route, 'kind', 'نوع ناشناخته');
  return {
    id: str(route, o, 'id'),
    kind,
    name: str(route, o, 'name'),
    nationalId: str(route, o, 'national_id', true),
    economicCode: str(route, o, 'economic_code', true),
    phone: str(route, o, 'phone', true),
    email: str(route, o, 'email', true),
    address: str(route, o, 'address', true),
    shebaNumber: str(route, o, 'sheba', true),
    bankName: str(route, o, 'bank_name', true),
    tradeType: str(route, o, 'trade_type', true),
    status: o.active === false ? 'inactive' : 'active',
    version: int(route, o, 'version'),
  };
}

// ---------------------------------------------------------------------------- chart of accounts

const LEVEL: Record<string, AccountLevel> = { group: 'گروه', general: 'کل', subsidiary: 'معین', detail: 'تفصیلی' };
const NATURE: Record<string, AccountNature> = { debit: 'بدهکار', credit: 'بستانکار', both: 'دوگانه' };
export const LEVEL_KEYS: Record<AccountLevel, string> = { 'گروه': 'group', 'کل': 'general', 'معین': 'subsidiary', 'تفصیلی': 'detail' };
export const NATURE_KEYS: Record<AccountNature, string> = { 'بدهکار': 'debit', 'بستانکار': 'credit', 'دوگانه': 'both' };

/** Flat accounts → the tree the app shows (balances are computed from posted entries by the view). */
export function parseAccounts(raw: unknown): AccountNode[] {
  const route = '/accounts';
  const rows = arr(route, obj(route, raw), 'accounts').map((r) => obj(route, r, 'account'));
  const nodes = new Map<string, AccountNode & { parent?: string }>();
  for (const o of rows) {
    const level = LEVEL[str(route, o, 'level')];
    const nature = NATURE[str(route, o, 'nature')];
    if (!level || !nature) throw new ShapeError(route, 'level/nature', 'مقدار ناشناخته');
    if (o.active === false) continue;
    const code = str(route, o, 'code');
    nodes.set(code, { code, title: str(route, o, 'title'), level, nature, parentCode: str(route, o, 'parent_code', true) || undefined, balance: 0, turnoverDebit: 0, turnoverCredit: 0 });
  }
  const roots: AccountNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentCode ? nodes.get(node.parentCode) : undefined;
    if (parent) (parent.children ||= []).push(node);
    else roots.push(node);
  }
  const sort = (list: AccountNode[]) => {
    list.sort((a, b) => a.code.localeCompare(b.code));
    list.forEach((n) => n.children && sort(n.children));
  };
  sort(roots);
  return roots;
}

function accountTitles(chart: readonly AccountNode[]): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (list: readonly AccountNode[]) =>
    list.forEach((n) => {
      out.set(n.code, n.title);
      if (n.children) walk(n.children);
    });
  walk(chart);
  return out;
}

// ---------------------------------------------------------------------------- journal entries

const ENTRY_TYPE: Record<string, JournalEntryType> = {
  general: 'عمومی',
  opening: 'سند افتتاحیه',
  adjustment: 'سند اصلاحی و معکوس',
  reversal: 'سند اصلاحی و معکوس',
  receipt: 'دریافت',
  payment: 'پرداخت',
  purchase: 'خرید و مصالح',
  petty_cash: 'تنخواه گردان',
  statement: 'صورت وضعیت',
  payroll: 'حقوق و دستمزد',
  inventory: 'انبارداری',
  sales: 'فروش',
};

/** App voucher type → server entry_type (closing entries are not manual). */
export function entryTypeKey(type: JournalEntryType): string {
  if (type === 'خرید') return 'purchase';
  if (type === 'تنخواه') return 'petty_cash';
  const hit = Object.entries(ENTRY_TYPE).find(([k, v]) => v === type && k !== 'reversal');
  return hit ? hit[0] : 'general';
}

export interface EntryLookups {
  chart: readonly AccountNode[];
  projects: readonly Pick<Project, 'id' | 'name'>[];
  costCenters: readonly Pick<CostCenter, 'id' | 'name'>[];
  counterparties: readonly Pick<Counterparty, 'id' | 'name'>[];
}

export function parseEntry(raw: unknown, lookups: EntryLookups): JournalEntry {
  const route = '/journal-entries';
  const o = obj(route, raw, 'entry');
  const titles = accountTitles(lookups.chart);
  const nameOf = (list: readonly { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name;
  const id = str(route, o, 'id');
  const rawStatus = str(route, o, 'status');
  const sourceType = str(route, o, 'source_type', true);
  const status: JournalEntryStatus | undefined =
    rawStatus === 'pending' ? 'در انتظار تأیید' : rawStatus === 'rejected' ? 'رد شده' : rawStatus === 'posted' ? (sourceType === 'manual' ? 'تأیید شده' : 'ثبت قطعی') : undefined;
  if (!status) throw new ShapeError(route, 'status', 'وضعیت ناشناخته');
  const type = ENTRY_TYPE[str(route, o, 'entry_type', true) || 'general'];
  if (!type) throw new ShapeError(route, 'entry_type', 'نوع ناشناخته');
  const rows: JournalEntryRow[] = arr(route, o, 'lines').map((raw_line, i) => {
    const l = obj(route, raw_line, `lines[${i}]`);
    const code = str(route, l, 'account_code');
    const projectId = str(route, l, 'project_id', true) || undefined;
    const costCenterId = str(route, l, 'cost_center_id', true) || undefined;
    const counterpartyId = str(route, l, 'counterparty_id', true) || undefined;
    return {
      id: `${id}-${int(route, l, 'line_no')}`,
      accountCode: code,
      accountName: titles.get(code) || code,
      subledgerCode: counterpartyId,
      subledgerName: counterpartyId ? nameOf(lookups.counterparties, counterpartyId) : undefined,
      description: str(route, l, 'description', true),
      debit: rial(route, l, 'debit'),
      credit: rial(route, l, 'credit'),
      projectId,
      projectName: projectId ? nameOf(lookups.projects, projectId) : undefined,
      costCenterId,
      costCenterName: costCenterId ? nameOf(lookups.costCenters, costCenterId) : undefined,
    };
  });
  const total = rial(route, o, 'total');
  const projectId = str(route, o, 'project_id', true) || undefined;
  const reversalOf = isObj(o.reversal_of) ? o.reversal_of : null;
  const createdAt = str(route, o, 'created_at', true);
  const history: JournalEntry['history'] = [];
  const stamp = (iso: string, user: string, action: string, note?: string) => {
    if (!iso) return;
    const day = isoToJalali(iso.slice(0, 10));
    history.push({ date: day, time: iso.slice(11, 16), user, action, ...(note ? { note } : {}) });
  };
  stamp(createdAt, str(route, o, 'created_by_name', true), sourceType === 'reversal' ? 'صدور سند معکوس' : 'ثبت سند و ارسال برای تأیید');
  if (rawStatus === 'posted' && sourceType === 'manual') stamp(str(route, o, 'approved_at', true), str(route, o, 'approved_by_name', true), 'تأیید نهایی و درج در دفاتر');
  if (rawStatus === 'rejected') stamp(str(route, o, 'rejected_at', true), '', 'رد سند', str(route, o, 'status_note', true));
  return {
    id,
    docNumber: str(route, o, 'doc_number', true) || str(route, o, 'draft_number', true),
    date: jdate(route, o, 'date'),
    title: str(route, o, 'description'),
    type,
    projectId,
    projectName: projectId ? nameOf(lookups.projects, projectId) : undefined,
    submitter: str(route, o, 'created_by_name', true),
    submitterId: str(route, o, 'created_by'),
    approvedById: str(route, o, 'approved_by', true) || undefined,
    status,
    rows,
    totalDebit: total,
    totalCredit: total,
    isBalanced: true,
    reversedFromDocId: reversalOf ? str(route, reversalOf, 'id') : undefined,
    reversedFromDocNumber: reversalOf ? str(route, reversalOf, 'doc_number', true) : undefined,
    version: int(route, o, 'version'),
    history,
  };
}

/** Body of POST /journal-entries: only what the user typed (no number, status, totals or ids). */
export function toEntryBody(entry: Pick<JournalEntry, 'date' | 'title' | 'type' | 'projectId' | 'rows'>, counterpartyIds: ReadonlySet<string>) {
  return {
    date: toIsoDate(entry.date),
    description: entry.title.trim(),
    entry_type: entryTypeKey(entry.type),
    project_id: entry.projectId || null,
    lines: entry.rows
      .filter((r) => r.debit > 0 || r.credit > 0)
      .map((r) => ({
        account_code: r.accountCode,
        debit: r.debit,
        credit: r.credit,
        description: r.description || '',
        project_id: r.projectId || null,
        cost_center_id: r.costCenterId || null,
        counterparty_id: r.subledgerCode && counterpartyIds.has(r.subledgerCode) ? r.subledgerCode : null,
      })),
  };
}

// ---------------------------------------------------------------------------- audit

const AUDIT_ACTION: Record<string, AuditLog['action']> = {
  entry_created: 'ایجاد سند',
  entry_updated: 'ویرایش پیش‌نویس',
  entry_posted: 'تأیید سند',
  entry_rejected: 'رد سند',
  entry_reversed: 'سند معکوس',
};

export function parseAudit(raw: unknown): AuditLog[] {
  const route = '/audit';
  return arr(route, obj(route, raw), 'events')
    .map((r) => obj(route, r, 'event'))
    .filter((o) => str(route, o, 'action') in AUDIT_ACTION)
    .map((o) => {
      const at = str(route, o, 'created_at');
      return {
        id: str(route, o, 'id'),
        date: isoToJalali(at.slice(0, 10)),
        time: at.slice(11, 16),
        user: str(route, o, 'user_name', true),
        role: str(route, o, 'user_role', true),
        action: AUDIT_ACTION[str(route, o, 'action')],
        targetDoc: str(route, o, 'object_ref', true),
        description: str(route, o, 'action'),
      };
    });
}
