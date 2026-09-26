/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CompanyProfile, JournalEntry, Subledger } from '../../types';
import type { AppState, SliceKey } from '../../store/types';
import { emptyState } from '../../store/state';
import { buildManualEntry, type ManualEntryFormInput } from '../../store/views/accounting';
import type { AccountFormInput, CostCenterFormInput, CounterpartyFormInput, ProjectFormInput } from '../../store/views/masterData';
import { apiClient, ApiError } from '../client';
import { createAkphAccountApi } from './account';
import { createAkphAssistantApi } from './assistant';
import type { CommandGateway, CommandResult, DataSource, PortalSession } from '../types';
import {
  arr,
  COST_CENTER_TYPE_KEYS,
  LEVEL_KEYS,
  NATURE_KEYS,
  obj,
  parseAccounts,
  parseAudit,
  parseCostCenter,
  parseCounterparty,
  parseEntry,
  parseMe,
  parseProject,
  PROJECT_STATUS_KEYS,
  toEntryBody,
  toIsoDate,
  type EntryLookups,
} from './mapping';

/**
 * Data source of the akph/v1 server (wordpress-plugin/akph-portal, docs/API-CONTRACT.md).
 *
 * It reads everything the signed-in user may see and sends only commands: what the user typed and which
 * action to take. Numbers, statuses, totals, approvals and the ledger are decided by the server; the
 * records each command changed come back and replace the local copies. Actions without a server command
 * are read-only in this mode («فقط خواندنی — به‌زودی»).
 */

/** Sections whose writes the server executes; the others show the read-only notice. */
const WRITABLE_PATHS = ['/', '/projects', '/finance/accounting', '/ai', '/notifications', '/account'];

const optional = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch (err) {
    // A list the role may not read (403) stays empty; anything else is a real failure.
    if (err instanceof ApiError && err.status === 403) return fallback;
    throw err;
  }
};

function siteCompany(): CompanyProfile {
  const name = window.AkphPortal?.siteName?.trim() || 'پرتال مدیریت پیمانکاری';
  return { name, legalName: name };
}

/** Counterparties offered as subledgers (تفصیلی) on voucher lines. */
function subledgersOf(state: Pick<AppState, 'counterparties'>): Subledger[] {
  const type: Record<string, Subledger['type']> = { client: 'کارفرما', supplier: 'تأمین‌کننده', subcontractor: 'پیمانکار جزء', employee: 'پرسنل' };
  return state.counterparties.map((c) => ({
    id: c.id,
    code: c.id,
    name: c.name,
    type: type[c.kind] || 'تأمین‌کننده',
    balance: 0,
    nature: c.kind === 'client' ? 'بدهکار' : 'بستانکار',
  }));
}

const lookups = (state: AppState): EntryLookups => ({ chart: state.chartOfAccounts, projects: state.projects, costCenters: state.costCenters, counterparties: state.counterparties });

type Records = CommandResult['records'];

/** Server `records` → app slices. */
function toRecords(raw: unknown, state: AppState): Records {
  const route = 'فرمان';
  const records = obj(route, obj(route, raw).records ?? {}, 'records');
  const out: Records = [];
  const push = (slice: SliceKey, rows: Record<string, unknown>[]) => rows.length && out.push({ slice, upserted: rows });
  const as = (v: unknown) => v as unknown as Record<string, unknown>;
  const centers = Array.isArray(records.cost_centers) ? records.cost_centers.map(parseCostCenter) : [];
  if (Array.isArray(records.projects)) push('projects', records.projects.map((p) => as(parseProject(p, [...state.costCenters, ...centers]))));
  push('costCenters', centers.map(as));
  if (Array.isArray(records.counterparties)) push('counterparties', records.counterparties.map((c) => as(parseCounterparty(c))));
  if (Array.isArray(records.journal_entries)) push('journalEntries', records.journal_entries.map((e) => as(parseEntry(e, lookups(state)))));
  return out;
}

function result(raw: unknown, state: AppState, extra: Records = []): CommandResult {
  const o = obj('فرمان', raw);
  return {
    message: typeof o.message === 'string' ? o.message : 'انجام شد.',
    records: [...toRecords(raw, state), ...extra],
    id: typeof o.id === 'string' ? o.id : undefined,
    docNumber: typeof o.doc_number === 'string' ? o.doc_number : undefined,
  };
}

/** Sends one command with the Idempotency-Key of the form submission it belongs to. */
const post = (key: string, path: string, body: unknown, version?: number) =>
  apiClient.command<unknown>('POST', path, version === undefined ? body : { ...(body as object), version }, { idempotencyKey: key, version });

const findEntry = (state: AppState, id: string): JournalEntry => {
  const entry = state.journalEntries.find((j) => j.id === id);
  if (!entry?.version) throw new ApiError(409, 'Unknown entry', 'سند در نسخه محلی پیدا نشد؛ صفحه را تازه کنید.');
  return entry;
};

const counterpartyIds = (state: AppState) => new Set(state.counterparties.map((c) => c.id));

/** Project form fields → server fields (only the ones given). */
function projectBody(f: Partial<ProjectFormInput>) {
  const map: [keyof ProjectFormInput, string, (v: never) => unknown][] = [
    ['name', 'name', (v: string) => v.trim()],
    ['clientName', 'client_name', (v: string) => v.trim()],
    ['location', 'location', (v: string) => v],
    ['contractRef', 'contract_ref', (v: string) => v],
    ['description', 'description', (v: string) => v],
    ['budget', 'budget', (v: number) => v],
    ['contractAmount', 'contract_amount', (v: number) => v],
    ['managerUserId', 'manager_user_id', (v: string) => v || null],
    ['status', 'status', (v: string) => PROJECT_STATUS_KEYS[v as keyof typeof PROJECT_STATUS_KEYS]],
    ['physicalProgress', 'physical_progress', (v: number) => v],
    ['siteSupervisor', 'site_supervisor', (v: string) => v],
    ['consultantName', 'consultant_name', (v: string) => v],
    ['startDate', 'start_date', (v: string) => (v ? toIsoDate(v) : null)],
    ['endDate', 'end_date', (v: string) => (v ? toIsoDate(v) : null)],
    ['manualRevenue', 'manual_revenue', (v: number) => v],
    ['manualCost', 'manual_cost', (v: number) => v],
    ['manualCash', 'manual_cash', (v: number) => v],
    ['manualReceivable', 'manual_receivable', (v: number) => v],
    ['manualPayable', 'manual_payable', (v: number) => v],
  ];
  const body: Record<string, unknown> = {};
  for (const [key, field, convert] of map) if (f[key] !== undefined) body[field] = convert(f[key] as never);
  return body;
}

const createEntry = async (key: string, entry: JournalEntry, state: AppState) => result(await post(key, 'journal-entries', toEntryBody(entry, counterpartyIds(state))), state);
const approve = async (key: string, id: string, state: AppState) => result(await post(key, `journal-entries/${id}/post`, {}, findEntry(state, id).version), state);
const reject = async (key: string, id: string, reason: string, state: AppState) => result(await post(key, `journal-entries/${id}/reject`, { reason }, findEntry(state, id).version), state);
const reverse = async (key: string, id: string, reason: string, state: AppState) => result(await post(key, `journal-entries/${id}/reverse`, { reason }, findEntry(state, id).version), state);

type Command = (args: unknown[], state: AppState, key: string) => Promise<CommandResult>;

/** Commands; each key is the reference workflow (src/store) whose effect the server now performs. */
const COMMANDS: Record<string, Command> = {
  createManualJournalEntry: ([entry], state, key) => createEntry(key, entry as JournalEntry, state),
  submitManualJournalEntryForm: ([form], state, key) => createEntry(key, buildManualEntry(state, form as ManualEntryFormInput), state),
  approveJournalEntry: ([id], state, key) => approve(key, id as string, state),
  approveJournalEntryLogged: ([id], state, key) => approve(key, id as string, state),
  rejectJournalEntry: ([id, reason], state, key) => reject(key, id as string, reason as string, state),
  rejectJournalEntryLogged: ([id, reason], state, key) => reject(key, id as string, reason as string, state),
  reverseJournalEntry: ([id, reason], state, key) => reverse(key, id as string, reason as string, state),
  reverseJournalEntryLogged: ([id, reason], state, key) => reverse(key, id as string, reason as string, state),

  async createProject([form], state, key) {
    return result(await post(key, 'projects', projectBody(form as ProjectFormInput)), state);
  },
  async updateProject([id, changes], state, key) {
    const project = state.projects.find((p) => p.id === id);
    return result(await post(key, `projects/${id}`, projectBody(changes as Partial<ProjectFormInput>), project?.version), state);
  },
  async createCostCenter([form], state, key) {
    const f = form as CostCenterFormInput;
    const body = { code: f.code.trim() || undefined, name: f.name.trim(), project_id: f.projectId || null, type: COST_CENTER_TYPE_KEYS[f.type] || 'other', manager_name: f.manager, budget: f.budget };
    const raw = await post(key, 'cost-centers', body);
    // The project lists its cost centers: refresh it from the stored copy with the new id added.
    const res = result(raw, state);
    const created = res.records.find((r) => r.slice === 'costCenters')?.upserted?.[0] as { id?: string } | undefined;
    const project = f.projectId ? state.projects.find((p) => p.id === f.projectId) : undefined;
    if (project && created?.id) res.records.push({ slice: 'projects', upserted: [{ ...project, costCenterIds: [...project.costCenterIds, created.id] } as unknown as Record<string, unknown>] });
    return res;
  },
  async createCounterparty([form], state, key) {
    const f = form as CounterpartyFormInput;
    const body = {
      kind: f.kind,
      name: f.name.trim(),
      national_id: f.nationalId,
      economic_code: f.economicCode,
      phone: f.phone,
      email: f.email,
      address: f.address,
      sheba: f.shebaNumber,
      bank_name: f.bankName,
      trade_type: f.tradeType,
    };
    const res = result(await post(key, 'counterparties', body), state);
    const party = res.records.find((r) => r.slice === 'counterparties')?.upserted || [];
    res.records.push({ slice: 'subledgers', upserted: subledgersOf({ counterparties: party as never }) as unknown as Record<string, unknown>[] });
    return res;
  },
  async createAccount([form], state, key) {
    const f = form as AccountFormInput;
    const raw = await post(key, 'accounts', { code: f.code, title: f.title.trim(), level: LEVEL_KEYS[f.level], nature: NATURE_KEYS[f.nature], parent_code: f.parentCode || '' });
    // The chart is a tree: reload it whole instead of merging one node.
    const chart = parseAccounts(await apiClient.get<unknown>('accounts'));
    return { ...result(raw, state), records: [{ slice: 'chartOfAccounts', replace: chart }] };
  },
};

export function createAkphDataSource(): DataSource {
  const commands: CommandGateway = {
    supports: (action) => action in COMMANDS,
    run: (action, args, state, idempotencyKey) => {
      const cmd = COMMANDS[action];
      if (!cmd) return Promise.reject(new ApiError(501, `Unsupported command ${action}`, 'فقط خواندنی — این عملیات به‌زودی در سرور فعال می‌شود.'));
      return cmd(args, state, idempotencyKey);
    },
  };

  return {
    kind: 'akph',
    label: 'دفاتر رسمی',
    commands,
    writablePaths: WRITABLE_PATHS,
    account: createAkphAccountApi(),
    assistant: createAkphAssistantApi(),

    async loadSession(): Promise<PortalSession> {
      const me = parseMe(await apiClient.get<unknown>('me'));
      return { user: me.user, currency: me.currency, fiscalYear: me.fiscalYear, company: siteCompany(), closedFiscalYears: me.closedFiscalYears, preferences: me.preferences };
    },

    async loadState(session: PortalSession): Promise<AppState> {
      const [projectsRaw, centersRaw, partiesRaw, chart, entriesRaw, audit] = await Promise.all([
        apiClient.get<unknown>('projects'),
        apiClient.get<unknown>('cost-centers'),
        apiClient.get<unknown>('counterparties'),
        optional(apiClient.get<unknown>('accounts').then(parseAccounts), []),
        optional(apiClient.get<unknown>('journal-entries', { per_page: 500 }), { entries: [] }),
        optional(apiClient.get<unknown>('audit', { per_page: 200, object_type: 'entry' }).then(parseAudit), []),
      ]);
      const costCenters = arr('/cost-centers', obj('/cost-centers', centersRaw), 'cost_centers').map(parseCostCenter);
      const projects = arr('/projects', obj('/projects', projectsRaw), 'projects').map((p) => parseProject(p, costCenters));
      const counterparties = arr('/counterparties', obj('/counterparties', partiesRaw), 'counterparties').map(parseCounterparty);
      const base = emptyState();
      const partial = { ...base, projects, costCenters, counterparties, chartOfAccounts: chart };
      const journalEntries = arr('/journal-entries', obj('/journal-entries', entriesRaw), 'entries').map((e) => parseEntry(e, lookups(partial)));
      return {
        ...partial,
        journalEntries,
        auditLogs: audit,
        subledgers: subledgersOf(partial),
        financeSettings: { ...base.financeSettings, closedFiscalYears: session.closedFiscalYears || [] },
      };
    },

    async listManagers() {
      const raw = obj('/projects/managers', await apiClient.get<unknown>('projects/managers'));
      return arr('/projects/managers', raw, 'managers').map((m) => {
        const o = obj('/projects/managers', m);
        return { id: String(o.id), name: String(o.name) };
      });
    },
  };
}
