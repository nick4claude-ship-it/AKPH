/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ApprovalItem, BankReconciliationItem, CompanyProfile, JournalEntry, PettyCashCategoryItem, PettyCashExpense, PettyCashReconciliation, PettyCashSettings, Subledger, TreasuryCheck } from '../../types';
import type { AppState, SliceKey } from '../../store/types';
import { emptyState } from '../../store/state';
import { buildManualEntry, type ManualEntryFormInput } from '../../store/views/accounting';
import type { AccountFormInput, CostCenterFormInput, CounterpartyFormInput, ProjectFormInput } from '../../store/views/masterData';
import type { PettyExpenseFormInput } from '../../store/views/pettyCash';
import { fundTypeForHolderRole } from '../../store/views/pettyCash';
import type { ManualPaymentRequestInput, PaymentFormInput } from '../../store/views/treasury';
import type { NewPettyFundInput, TreasuryAccountInput, TreasuryTransferInput } from '../../store/recordWorkflows';
import type { PaymentInput, ReceiptInput } from '../../store/workflows';
import { apiClient, ApiError } from '../client';
import { createAkphAccountApi } from './account';
import { createAkphAssistantApi } from './assistant';
import { createAkphDocumentApi, loadDocuments } from './documents';
import { createAkphPrintApi } from './print';
import type { CommandGateway, CommandResult, DataSource, PortalSession } from '../types';
import {
  parseApprovals,
  parseCheque,
  parsePaymentRequest,
  parsePettyCategory,
  parsePettyCount,
  parsePettyExpense,
  parsePettyFund,
  parsePettyRequest,
  parsePettySettings,
  parseReceipt,
  parseReplenishment,
  parseStatementLine,
  parseTreasuryAccount,
  payableTypeOf,
  pettySettingsBody,
  PETTY_METHOD_KEYS,
  receiptMethodKey,
  RECEIPT_TYPE_KEYS,
  type FinanceLookups,
} from './finance';
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
const WRITABLE_PATHS = [
  '/',
  '/projects',
  '/finance/accounting',
  '/ai',
  '/notifications',
  '/account',
  '/documents',
  // 0.6.0: petty cash, treasury and the approval center run on the server.
  '/petty-cash',
  '/finance/payments',
  '/finance/receipts',
  '/finance/banks',
  '/finance/cash',
  '/approvals',
  // 0.6.1: settings (VAT, petty cash policy, «تنظیمات گزارش و چاپ»).
  '/settings',
];

const optional = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch (err) {
    // A list the role may not read (403) stays empty; anything else is a real failure.
    if (err instanceof ApiError && err.status === 403) return fallback;
    throw err;
  }
};

/** Letterhead before the report settings are read (or when they cannot be): the site name, nothing else. */
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
  const fl = financeLookups(state);
  const banks = bankTitles(state);
  if (Array.isArray(records.treasury_accounts)) {
    const parsed = records.treasury_accounts.map((a) => parseTreasuryAccount(a, fl));
    push('bankAccounts', parsed.flatMap((a) => (a.kind === 'bank' ? [as(a.bank)] : [])));
    push('cashDesks', parsed.flatMap((a) => (a.kind === 'cash' ? [as(a.desk)] : [])));
  }
  if (Array.isArray(records.petty_funds)) push('pettyCashAccounts', records.petty_funds.map((f) => as(parsePettyFund(f, fl, banks))));
  if (Array.isArray(records.petty_expenses)) push('pettyCashExpenses', records.petty_expenses.map((e) => as(parsePettyExpense(e, fl))));
  if (Array.isArray(records.petty_requests)) push('pettyCashRequests', records.petty_requests.map((r) => as(parsePettyRequest(r))));
  if (Array.isArray(records.petty_counts)) push('pettyCashReconciliations', records.petty_counts.map((c) => as(parsePettyCount(c))));
  if (Array.isArray(records.petty_categories)) out.push({ slice: 'pettyCashCategories', replace: records.petty_categories.map(parsePettyCategory) });
  if (Array.isArray(records.petty_settings) && records.petty_settings[0]) out.push({ slice: 'pettyCashSettings', replace: parsePettySettings(records.petty_settings[0]) });
  if (Array.isArray(records.payment_requests)) {
    const parsed = records.payment_requests.map((r) => parsePaymentRequest(r, fl));
    push('paymentRequests', parsed.map((p) => as(p.request)));
    push('payments', parsed.flatMap((p) => p.payments.map(as)));
  }
  if (Array.isArray(records.receipts)) push('receipts', records.receipts.map((r) => as(parseReceipt(r, fl))));
  if (Array.isArray(records.cheques)) push('treasuryChecks', records.cheques.map((c) => as(parseCheque(c, fl))));
  if (Array.isArray(records.bank_statement_lines)) push('bankReconciliations', records.bank_statement_lines.map((l) => as(parseStatementLine(l))));
  if (Array.isArray(records.treasury_settings) && records.treasury_settings[0]) out.push({ slice: 'financeSettings', replace: { ...state.financeSettings, ...parseFinanceSettings(records.treasury_settings[0]) } });
  return out;
}

/** Treasury settings of the server → the app's finance settings (VAT rate). */
function parseFinanceSettings(raw: unknown): Partial<AppState['financeSettings']> {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Number.isInteger(o.vat_rate_percent) ? { vatRatePercent: o.vat_rate_percent as number } : {};
}

const financeLookups = (state: Pick<AppState, 'projects' | 'costCenters'>): FinanceLookups => ({ projects: state.projects, costCenters: state.costCenters });
const bankTitles = (state: Pick<AppState, 'bankAccounts' | 'cashDesks'>) => [
  ...state.bankAccounts.map((b) => ({ id: b.id, title: `${b.bankName} - ${b.accountNumber}` })),
  ...state.cashDesks.map((c) => ({ id: c.id, title: c.title })),
];

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

/** Version of a record the command acts on (409 on the server when it changed meanwhile). */
function versionOf(rows: readonly { id: string; version?: number }[], id: string, what: string): number {
  const row = rows.find((r) => r.id === id);
  if (!row?.version) throw new ApiError(409, `Unknown ${what}`, `${what} در نسخه محلی پیدا نشد؛ صفحه را تازه کنید.`);
  return row.version;
}

/** Jalali date typed in the app → ISO, or undefined when left empty. */
const isoOrUndefined = (jalali?: string) => (jalali && jalali.trim() ? toIsoDate(jalali.trim()) : undefined);

/** 'bank:ID' / 'cash:ID' of the payment and transfer forms → treasury account id. */
const accountIdOf = (ref: string) => ref.split(':')[1] || ref;

const expenseBody = (e: Pick<PettyCashExpense, 'pettyCashId' | 'amount' | 'date' | 'category' | 'subCategory' | 'vendor' | 'vendorNationalId' | 'invoiceNumber' | 'invoiceDate' | 'description' | 'paymentMethod' | 'counterpartyId'>) => ({
  fund_id: e.pettyCashId,
  amount: e.amount,
  date: toIsoDate(e.date),
  category_name: e.category || undefined,
  sub_category: e.subCategory || '',
  vendor: e.vendor || '',
  vendor_national_id: e.vendorNationalId || '',
  counterparty_id: e.counterpartyId || undefined,
  invoice_number: e.invoiceNumber || '',
  invoice_date: isoOrUndefined(e.invoiceDate),
  description: e.description,
  payment_method: PETTY_METHOD_KEYS[e.paymentMethod] || 'cash',
});

async function pay(key: string, state: AppState, requestId: string, input: { ref: string; amount: number; tracking?: string }) {
  const version = versionOf(state.paymentRequests, requestId, 'درخواست پرداخت');
  const method = input.ref.startsWith('cash:') ? 'cash' : 'transfer';
  return result(await post(key, `payment-requests/${requestId}/pay`, { amount: input.amount, account_id: accountIdOf(input.ref), method, tracking: input.tracking || '' }, version), state);
}

/** A statement line: matched with the ledger line of the same account, direction and amount, else a pending voucher. */
async function reconcileLine(key: string, state: AppState, itemId: string) {
  const item = state.bankReconciliations.find((r) => r.id === itemId) as BankReconciliationItem | undefined;
  if (!item?.version) throw new ApiError(409, 'Unknown statement line', 'ردیف صورت‌حساب در نسخه محلی پیدا نشد؛ صفحه را تازه کنید.');
  const rec = obj('/treasury/accounts/reconciliation', await apiClient.get<unknown>(`treasury/accounts/${item.bankAccountId}/reconciliation`));
  const direction = item.type === 'واریز' ? 'deposit' : 'withdrawal';
  const candidate = arr('/treasury/accounts/reconciliation', rec, 'unmatched_ledger_lines')
    .map((l) => obj('/treasury/accounts/reconciliation', l))
    .find((l) => l.direction === direction && l.amount === item.amount);
  if (candidate) return result(await post(key, `bank-statement-lines/${itemId}/match`, { ledger_line_id: String(candidate.line_id) }, item.version), state);
  return result(await post(key, `bank-statement-lines/${itemId}/voucher`, {}, item.version), state);
}

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
  // ------------------------------------------------------------------ petty cash (0.6.0)
  async createPettyCashFund([input], state, key) {
    const f = input as NewPettyFundInput;
    const body = {
      title: f.title.trim(),
      fund_type: fundTypeForHolderRole(f.holderRole),
      project_id: f.projectId || '',
      holder_name: f.holderName.trim(),
      holder_phone: f.holderPhone || '',
      source_account_id: f.sourceBankAccountId || '',
      notes: f.notes || '',
    };
    return result(await post(key, 'petty-cash/funds', body), state);
  },
  async submitPettyExpenseForm([form], state, key) {
    const f = form as PettyExpenseFormInput;
    return result(await post(key, 'petty-cash/expenses', expenseBody({ ...f, pettyCashId: f.accountId })), state);
  },
  async submitPettyCashExpense([expense], state, key) {
    return result(await post(key, 'petty-cash/expenses', expenseBody(expense as PettyCashExpense)), state);
  },
  async approvePettyCashExpense([id, comment], state, key) {
    return result(await post(key, `petty-cash/expenses/${id}/approve`, { comment: (comment as string) || '' }, versionOf(state.pettyCashExpenses, id as string, 'هزینه تنخواه')), state);
  },
  async rejectPettyCashExpense([id, reason, returnToUser], state, key) {
    const body = { reason: reason as string, return_to_user: returnToUser === true };
    return result(await post(key, `petty-cash/expenses/${id}/reject`, body, versionOf(state.pettyCashExpenses, id as string, 'هزینه تنخواه')), state);
  },
  async requestPettyCashReplenishment([fundId, amount, reason], state, key) {
    return result(await post(key, 'petty-cash/requests', { fund_id: fundId, amount, reason }), state);
  },
  async reconcilePettyCash([input], state, key) {
    const r = input as Pick<PettyCashReconciliation, 'pettyCashId' | 'periodStartDate' | 'periodEndDate' | 'actualCountedCash' | 'discrepancyReason' | 'notes'>;
    const body = { counted_cash: r.actualCountedCash, reason: r.discrepancyReason || '', notes: r.notes || '', period_start: isoOrUndefined(r.periodStartDate), period_end: isoOrUndefined(r.periodEndDate) };
    return result(await post(key, `petty-cash/funds/${r.pettyCashId}/count`, body), state);
  },
  async closePettyCashPeriod([fundId], state, key) {
    return result(await post(key, `petty-cash/funds/${fundId}/close-period`, {}, versionOf(state.pettyCashAccounts, fundId as string, 'تنخواه')), state);
  },
  async updatePettyCashSettings([settings], state, key) {
    return result(await post(key, 'petty-cash/settings', pettySettingsBody(settings as PettyCashSettings)), state);
  },
  async updatePettyCashCategories([categories], state, key) {
    const body = { categories: (categories as PettyCashCategoryItem[]).map((c) => ({ id: c.id, name: c.name.trim(), subcategories: c.subcategories })) };
    return result(await post(key, 'petty-cash/categories', body), state);
  },

  // ------------------------------------------------------------------ treasury (0.6.0)
  async createManualPaymentRequest([input], state, key) {
    const f = input as ManualPaymentRequestInput;
    const body = { amount: f.amount, beneficiary_name: f.beneficiaryName.trim(), project_id: f.projectId || '', payable_type: payableTypeOf(f.sourceType, f.liability), due_date: isoOrUndefined(f.dueDate) };
    return result(await post(key, 'payment-requests', body), state);
  },
  async approvePaymentRequest([id], state, key) {
    return result(await post(key, `payment-requests/${id}/approve`, {}, versionOf(state.paymentRequests, id as string, 'درخواست پرداخت')), state);
  },
  async rejectPaymentRequest([id, reason], state, key) {
    return result(await post(key, `payment-requests/${id}/reject`, { reason }, versionOf(state.paymentRequests, id as string, 'درخواست پرداخت')), state);
  },
  payRequestForm: ([form], state, key) => {
    const f = form as PaymentFormInput;
    return pay(key, state, f.requestId, { ref: f.sourceId, amount: f.amount, tracking: f.trackingNumber });
  },
  executePayment: ([requestId, input], state, key) => {
    const p = input as PaymentInput;
    return pay(key, state, requestId as string, { ref: p.cashDeskId ? `cash:${p.cashDeskId}` : `bank:${p.bankAccountId}`, amount: p.amount, tracking: p.trackingNumber });
  },
  async recordReceipt([input], state, key) {
    const r = input as ReceiptInput;
    const method = receiptMethodKey(r.method);
    const party = r.counterpartyId ? state.counterparties.find((c) => c.id === r.counterpartyId) : undefined;
    const body = {
      amount: r.amount,
      receipt_type: RECEIPT_TYPE_KEYS[r.sourceType] || 'other_income',
      counterparty_id: party ? party.id : undefined,
      payer_name: party ? undefined : r.description?.trim() || 'واریزکننده',
      project_id: r.projectId || undefined,
      account_id: r.bankAccountId,
      method,
      tracking: method === 'cheque' ? '' : r.trackingNumber,
      cheque_number: method === 'cheque' ? r.trackingNumber : undefined,
      date: isoOrUndefined(r.date),
      description: r.description || '',
    };
    return result(await post(key, 'receipts', body), state);
  },
  reconcileBankItem: ([itemId], state, key) => reconcileLine(key, state, itemId as string),
  reconcileBankItemLogged: ([itemId], state, key) => reconcileLine(key, state, itemId as string),
  async createTreasuryAccount([input], state, key) {
    const f = input as TreasuryAccountInput;
    const body = { kind: f.kind, title: f.title.trim(), bank_name: f.bankName, branch: f.branch, account_number: f.accountNumber, sheba: f.sheba, holder_name: f.holderName, location: f.location, project_id: f.projectId || '' };
    return result(await post(key, 'treasury/accounts', body), state);
  },
  async transferBetweenAccounts([input], state, key) {
    const f = input as TreasuryTransferInput;
    const body = { from_account_id: accountIdOf(f.fromId), to_account_id: accountIdOf(f.toId), amount: f.amount, tracking: f.trackingNumber, description: f.description };
    return result(await post(key, 'treasury/transfers', body), state);
  },
  async changeChequeStatus([id, status, note], state, key) {
    return result(await post(key, `cheques/${id}/status`, { status, note: note || '' }, versionOf(state.treasuryChecks as TreasuryCheck[], id as string, 'چک')), state);
  },
  async importBankStatement([bankId, csv], state, key) {
    return result(await post(key, `treasury/accounts/${bankId}/statement`, { csv }), state);
  },

  // ------------------------------------------------------------------ approval center (0.6.0)
  async decideServerApproval([item, decision, text], state, key) {
    const a = item as ApprovalItem;
    if (!a.server) throw new ApiError(400, 'Not a server approval', 'این مورد از کارتابل سرور نیست؛ صفحه را تازه کنید.');
    const approve = decision === 'approve';
    return result(await post(key, approve ? a.server.approvePath : a.server.rejectPath, approve ? { comment: (text as string) || '' } : { reason: text }, a.server.version), state);
  },

  // ------------------------------------------------------------------ settings (0.6.1)
  async updateFinanceSettings([patch], state, key) {
    const p = patch as Partial<AppState['financeSettings']>;
    return result(await post(key, 'treasury/settings', { vat_rate_percent: p.vatRatePercent }), state);
  },

  async createAccount([form], state, key) {
    const f = form as AccountFormInput;
    const raw = await post(key, 'accounts', { code: f.code, title: f.title.trim(), level: LEVEL_KEYS[f.level], nature: NATURE_KEYS[f.nature], parent_code: f.parentCode || '' });
    // The chart is a tree: reload it whole instead of merging one node.
    const chart = parseAccounts(await apiClient.get<unknown>('accounts'));
    return { ...result(raw, state), records: [{ slice: 'chartOfAccounts', replace: chart }] };
  },
};

/** Petty cash, treasury and approval commands: their rules (steps, thresholds, balances) are checked by the server. */
const SERVER_VALIDATED = new Set([
  'createPettyCashFund',
  'submitPettyExpenseForm',
  'submitPettyCashExpense',
  'approvePettyCashExpense',
  'rejectPettyCashExpense',
  'requestPettyCashReplenishment',
  'reconcilePettyCash',
  'closePettyCashPeriod',
  'updatePettyCashSettings',
  'updatePettyCashCategories',
  'createManualPaymentRequest',
  'approvePaymentRequest',
  'rejectPaymentRequest',
  'payRequestForm',
  'executePayment',
  'recordReceipt',
  'reconcileBankItem',
  'reconcileBankItemLogged',
  'createTreasuryAccount',
  'transferBetweenAccounts',
  'changeChequeStatus',
  'importBankStatement',
  'decideServerApproval',
]);

/** GET /petty-cash and GET /treasury (office roles only) → the petty cash and treasury slices. */
function loadFinance(partial: Pick<AppState, 'projects' | 'costCenters'>, pettyRaw: unknown, treasuryRaw: unknown) {
  const fl = financeLookups(partial);
  const t = treasuryRaw === null ? null : obj('/treasury', treasuryRaw);
  const accounts = t ? arr('/treasury', t, 'accounts').map((a) => parseTreasuryAccount(a, fl)) : [];
  const bankAccounts = accounts.flatMap((a) => (a.kind === 'bank' ? [a.bank] : []));
  const cashDesks = accounts.flatMap((a) => (a.kind === 'cash' ? [a.desk] : []));
  const p = obj('/petty-cash', pettyRaw);
  const banks = bankTitles({ bankAccounts, cashDesks });
  const pettyCashAccounts = arr('/petty-cash', p, 'funds').map((f) => parsePettyFund(f, fl, banks));
  const requests = t ? arr('/treasury', t, 'payment_requests').map((r) => parsePaymentRequest(r, fl)) : [];
  return {
    bankAccounts,
    cashDesks,
    pettyCashAccounts,
    pettyCashExpenses: arr('/petty-cash', p, 'expenses').map((e) => parsePettyExpense(e, fl)),
    pettyCashRequests: arr('/petty-cash', p, 'requests').map(parsePettyRequest),
    pettyCashReconciliations: arr('/petty-cash', p, 'counts').map(parsePettyCount),
    pettyCashReplenishments: arr('/petty-cash', p, 'replenishments').map((r) => parseReplenishment(r, pettyCashAccounts)),
    pettyCashCategories: arr('/petty-cash', p, 'categories').map(parsePettyCategory),
    pettyCashSettings: parsePettySettings(p.settings),
    paymentRequests: requests.map((r) => r.request),
    payments: requests.flatMap((r) => r.payments),
    receipts: t ? arr('/treasury', t, 'receipts').map((r) => parseReceipt(r, fl)) : [],
    treasuryChecks: t ? arr('/treasury', t, 'cheques').map((c) => parseCheque(c, fl)) : [],
    bankReconciliations: t ? arr('/treasury', t, 'statement_lines').map(parseStatementLine) : [],
  };
}

export function createAkphDataSource(): DataSource {
  const printApi = createAkphPrintApi();
  const commands: CommandGateway = {
    supports: (action) => action in COMMANDS,
    serverValidated: (action) => SERVER_VALIDATED.has(action),
    run: async (action, args, state, idempotencyKey) => {
      const cmd = COMMANDS[action];
      if (!cmd) throw new ApiError(501, `Unsupported command ${action}`, 'فقط خواندنی — این عملیات به‌زودی در سرور فعال می‌شود.');
      const res = await cmd(args, state, idempotencyKey);
      // The approval center and the sidebar counter follow every command (a step moved, an entry posted).
      try {
        res.records.push({ slice: 'serverApprovals', replace: parseApprovals(await apiClient.get<unknown>('approvals')) });
      } catch {
        // The command succeeded; the list is refreshed on the next command or page load.
      }
      return res;
    },
  };

  return {
    kind: 'akph',
    label: 'دفاتر رسمی',
    commands,
    writablePaths: WRITABLE_PATHS,
    account: createAkphAccountApi(),
    assistant: createAkphAssistantApi(),
    documents: createAkphDocumentApi(),
    print: printApi,

    async loadSession(): Promise<PortalSession> {
      const [me, reportSettings] = await Promise.all([apiClient.get<unknown>('me').then(parseMe), printApi.settings().catch(() => undefined)]);
      const company = reportSettings?.company.legalName ? reportSettings.company : siteCompany();
      return { user: me.user, currency: me.currency, fiscalYear: me.fiscalYear, company, reportSettings, closedFiscalYears: me.closedFiscalYears, preferences: me.preferences, documentMaxBytes: me.documentMaxBytes };
    },

    async loadState(session: PortalSession): Promise<AppState> {
      const [projectsRaw, centersRaw, partiesRaw, chart, entriesRaw, audit, documents, pettyRaw, treasuryRaw, approvalsRaw] = await Promise.all([
        apiClient.get<unknown>('projects'),
        apiClient.get<unknown>('cost-centers'),
        apiClient.get<unknown>('counterparties'),
        optional(apiClient.get<unknown>('accounts').then(parseAccounts), []),
        optional(apiClient.get<unknown>('journal-entries', { per_page: 500 }), { entries: [] }),
        optional(apiClient.get<unknown>('audit', { per_page: 200, object_type: 'entry' }).then(parseAudit), []),
        optional(loadDocuments(), []),
        apiClient.get<unknown>('petty-cash'),
        optional(apiClient.get<unknown>('treasury'), null),
        apiClient.get<unknown>('approvals'),
      ]);
      const treasurySettings = await optional(apiClient.get<unknown>('treasury/settings'), null);
      const costCenters = arr('/cost-centers', obj('/cost-centers', centersRaw), 'cost_centers').map(parseCostCenter);
      const projects = arr('/projects', obj('/projects', projectsRaw), 'projects').map((p) => parseProject(p, costCenters));
      const counterparties = arr('/counterparties', obj('/counterparties', partiesRaw), 'counterparties').map(parseCounterparty);
      const base = emptyState();
      const partial = { ...base, projects, costCenters, counterparties, chartOfAccounts: chart };
      const journalEntries = arr('/journal-entries', obj('/journal-entries', entriesRaw), 'entries').map((e) => parseEntry(e, lookups(partial)));
      const finance = loadFinance(partial, pettyRaw, treasuryRaw);
      return {
        ...partial,
        ...finance,
        serverApprovals: parseApprovals(approvalsRaw),
        journalEntries,
        documents,
        auditLogs: audit,
        subledgers: subledgersOf(partial),
        financeSettings: {
          ...base.financeSettings,
          ...parseFinanceSettings(treasurySettings && typeof treasurySettings === 'object' ? (treasurySettings as { settings?: unknown }).settings : null),
          closedFiscalYears: session.closedFiscalYears || [],
        },
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
