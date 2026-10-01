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
import type {
  EmployeeInput,
  EmployerApprovalFields,
  GuaranteeInput,
  NewAmendmentInput,
  NewClientContractInput,
  NewMaterialInput,
  NewPettyFundInput,
  NewSubcontractInput,
  NewSupplierInput,
  RfqQuoteInput,
  StocktakeCountInput,
  TimesheetInput,
  TreasuryAccountInput,
  TreasuryTransferInput,
  VendorInvoiceInput,
  WarehouseInput,
} from '../../store/recordWorkflows';
import type { RequisitionFormInput } from '../../store/views/procurement';
import type { StoreIssueFormInput, TransferFormInput } from '../../store/views/inventory';
import type { ClientStatementFormInput, SubcontractorStatementFormInput } from '../../store/views/contracts';
import type { PaymentInput, ReceiptInput } from '../../store/workflows';
import { apiClient, ApiError } from '../client';
import { createAkphAccountApi } from './account';
import { createAkphAssistantApi } from './assistant';
import { createAkphDocumentApi, loadDocuments } from './documents';
import { createAkphPrintApi } from './print';
import { contractSlices, qtyString, statementSlices } from './contracts';
import {
  CONTRACT_KEYS,
  inventorySlices,
  parseEmployee,
  parseGoodsReceipt,
  parseMaterial,
  parsePayrollPeriod,
  parsePayslip,
  parsePurchaseOrder,
  parseRequisition,
  parseRfq,
  parseStocktake,
  parseStockReturn,
  parseStoreIssue,
  parseTimesheet,
  parseTransfer,
  parseVendorInvoice,
  parseWarehouse,
  payrollSlices,
  PRIORITY_KEYS,
  procurementSlices,
  reservationsOf,
  suppliersOf,
  WAREHOUSE_KIND_KEYS,
} from './operations';
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
  // 0.7.0: client contracts, subcontracts and their progress statements.
  '/contracts',
  '/statements',
  // 0.8.0: procurement, inventory, payroll, the counterparty pages and the reports (read and print).
  '/procurement',
  '/inventory',
  '/payroll',
  '/partners',
  '/reports',
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
  if (Array.isArray(records.contracts)) {
    const c = contractSlices(records.contracts);
    push('contracts', c.contracts.map(as));
    push('subcontractorContracts', c.subcontractorContracts.map(as));
    push('contractBoq', c.contractBoq.map(as));
    push('contractAmendments', c.contractAmendments.map(as));
  }
  if (Array.isArray(records.statements)) {
    const st = statementSlices(records.statements);
    push('clientStatements', st.clientStatements.map(as));
    push('subcontractorStatements', st.subcontractorStatements.map(as));
  }
  // 0.8.0: procurement, inventory and payroll.
  const partyName = (id: string) => state.counterparties.find((c) => c.id === id)?.name || '';
  const projectName = (id: string) => state.projects.find((p) => p.id === id)?.name || '';
  if (Array.isArray(records.materials)) push('materials', records.materials.map((m) => as(parseMaterial(m))));
  if (Array.isArray(records.warehouses)) push('warehouses', records.warehouses.map((w) => as(parseWarehouse(w))));
  if (Array.isArray(records.stock_balances)) {
    const touched = records.stock_balances.map((b) => obj('فرمان', b));
    const rows = touched.map((b) => ({ warehouseId: String(b.warehouse_id), materialId: String(b.material_id), qty: Number(b.qty) || 0, reservedQty: Number(b.reserved) || 0 }));
    const keys = new Set(rows.map((r) => `${r.warehouseId}:${r.materialId}`));
    out.push({ slice: 'stockBalances', replace: [...state.stockBalances.filter((b) => !keys.has(`${b.warehouseId}:${b.materialId}`)), ...rows] });
  }
  if (Array.isArray(records.store_issues)) {
    const issues = records.store_issues.map((v) => parseStoreIssue(v, partyName));
    const cancelled = new Set(issues.filter((v) => v.server?.status === 'cancelled').map((v) => v.id));
    const merged = [...issues.filter((v) => !cancelled.has(v.id)), ...state.storeIssues.filter((v) => !issues.some((x) => x.id === v.id))];
    out.push({ slice: 'storeIssues', replace: merged });
    out.push({ slice: 'stockReservations', replace: reservationsOf(merged) });
  }
  if (Array.isArray(records.stock_returns)) push('stockReturns', records.stock_returns.map((r) => as(parseStockReturn(r))));
  if (Array.isArray(records.stock_transfers)) {
    const transfers = records.stock_transfers.map(parseTransfer);
    out.push({ slice: 'interTransfers', replace: [...transfers.filter((t) => t.server?.status !== 'cancelled'), ...state.interTransfers.filter((t) => !transfers.some((x) => x.id === t.id))] });
  }
  if (Array.isArray(records.stocktakes)) push('stocktakes', records.stocktakes.map((x) => as(parseStocktake(x))));
  if (Array.isArray(records.requisitions)) push('purchaseRequisitions', records.requisitions.map((r) => as(parseRequisition(r))));
  if (Array.isArray(records.rfqs)) {
    const reqs = Array.isArray(records.requisitions) ? records.requisitions.map(parseRequisition) : [];
    push('rfqs', records.rfqs.map((r) => as(parseRfq(r, [...reqs, ...state.purchaseRequisitions]))));
  }
  if (Array.isArray(records.purchase_orders)) push('purchaseOrders', records.purchase_orders.map((o) => as(parsePurchaseOrder(o))));
  if (Array.isArray(records.goods_receipts)) push('goodsReceipts', records.goods_receipts.map((g) => as(parseGoodsReceipt(g))));
  if (Array.isArray(records.vendor_invoices)) push('vendorInvoices', records.vendor_invoices.map((i) => as(parseVendorInvoice(i))));
  if (Array.isArray(records.employees)) push('employees', records.employees.map((e) => as(parseEmployee(e, projectName))));
  if (Array.isArray(records.payroll_periods)) {
    const periods = records.payroll_periods.map(parsePayrollPeriod);
    const allPeriods = [...periods, ...state.payrollPeriods.filter((p) => !periods.some((x) => x.id === p.id))];
    out.push({ slice: 'payrollPeriods', replace: allPeriods });
    const ids = new Set(periods.map((p) => p.id));
    if (Array.isArray(records.timesheets)) {
      const sheets = records.timesheets.map((t) => parseTimesheet(t, allPeriods, state.employees));
      out.push({ slice: 'timesheets', replace: [...state.timesheets.filter((t) => !ids.has(String(t.server?.extra?.periodId))), ...sheets] });
    }
    if (Array.isArray(records.payslips)) {
      const slips = records.payslips.map((x) => parsePayslip(x, allPeriods, state.employees));
      out.push({ slice: 'payrollSlips', replace: [...state.payrollSlips.filter((x) => !ids.has(String(x.server?.extra?.periodId))), ...slips] });
    }
  }
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


/** Common fields of a new contract (client or subcontract); the amount is the server's total of the lines. */
function contractBody(contractNo: string, title: string, projectId: string, dates: { contractDate?: string; startDate?: string; endDate?: string }, description: string, lines: readonly { code: string; description: string; unit: string; quantity: number; rate: number }[]) {
  return {
    contract_no: contractNo.trim(),
    title: title.trim(),
    project_id: projectId,
    contract_date: isoOrUndefined(dates.contractDate),
    start_date: isoOrUndefined(dates.startDate),
    end_date: isoOrUndefined(dates.endDate),
    description: description || '',
    lines: lines
      .filter((l) => l.description.trim() || l.quantity || l.rate)
      .map((l) => ({ code: l.code.trim(), description: l.description.trim(), unit: l.unit.trim(), quantity: qtyString(l.quantity), rate: l.rate })),
  };
}

/** Version of a client contract or subcontract (409 when it changed meanwhile). */
function contractVersion(state: AppState, id: string): number {
  const c = [...state.contracts, ...state.subcontractorContracts].find((x) => x.id === id);
  if (!c?.server) throw new ApiError(409, 'Unknown contract', 'قرارداد در نسخه محلی پیدا نشد؛ صفحه را تازه کنید.');
  return c.server.version;
}

/** Version of a 0.8.0 record (its server info). */
function serverVersion(rows: readonly { id: string; server?: { version: number } }[], id: string, what: string): number {
  const row = rows.find((r) => r.id === id);
  if (!row?.server?.version) throw new ApiError(409, `Unknown ${what}`, `${what} در نسخه محلی پیدا نشد؛ صفحه را تازه کنید.`);
  return row.server.version;
}

function periodVersion(state: AppState, id: string): number {
  const p = state.payrollPeriods.find((x) => x.id === id);
  if (!p) throw new ApiError(409, 'Unknown period', 'دوره حقوق در نسخه محلی پیدا نشد؛ صفحه را تازه کنید.');
  return p.version;
}

/** A requisition line typed by name: the material of the list with that name. */
function materialIdByName(state: AppState, name: string): string {
  const m = state.materials.find((x) => x.name.trim() === name.trim() || x.code === name.trim());
  if (!m) throw new ApiError(400, 'Unknown material', `کالای «${name}» در فهرست کالاها نیست؛ ابتدا آن را تعریف کنید یا از فهرست انتخاب کنید.`);
  return m.id;
}

function employeeBody(f: Partial<EmployeeInput>) {
  const map: [keyof EmployeeInput, string, (v: never) => unknown][] = [
    ['fullName', 'full_name', (v: string) => v.trim()],
    ['nationalId', 'national_id', (v: string) => v.trim()],
    ['insuranceNo', 'insurance_no', (v: string) => v.trim()],
    ['bankName', 'bank_name', (v: string) => v.trim()],
    ['sheba', 'sheba', (v: string) => v.trim()],
    ['accountNumber', 'account_number', (v: string) => v.trim()],
    ['jobTitle', 'job_title', (v: string) => v.trim()],
    ['contractType', 'contract_type', (v: string) => CONTRACT_KEYS[v as keyof typeof CONTRACT_KEYS] || 'full_time'],
    ['costCenterId', 'cost_center_id', (v: string) => v],
    ['baseSalary', 'base_salary', (v: number) => v],
    ['housingAllowance', 'housing_allowance', (v: number) => v],
    ['foodAllowance', 'food_allowance', (v: number) => v],
    ['childAllowance', 'child_allowance', (v: number) => v],
    ['otherBenefits', 'other_benefits', (v: number) => v],
    ['loanInstallment', 'loan_installment', (v: number) => v],
    ['otherDeduction', 'other_deduction', (v: number) => v],
    ['insured', 'insured', (v: boolean) => v],
  ];
  const body: Record<string, unknown> = {};
  for (const [k, field, convert] of map) if (f[k] !== undefined) body[field] = convert(f[k] as never);
  return body;
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
      statement_id: r.sourceType === 'صورت‌وضعیت کارفرما' ? r.statementId || undefined : undefined,
      contract_id: r.sourceType === 'پیش‌پرداخت' ? r.contractId || undefined : undefined,
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


  // ------------------------------------------------------------------ contracts and statements (0.7.0)
  async createClientContract([input], state, key) {
    const f = input as NewClientContractInput;
    const project = state.projects.find((p) => p.id === f.projectId);
    const party = state.counterparties.find((c) => c.kind === 'client' && c.name.trim() === f.employer.trim());
    const body = {
      kind: 'client',
      ...contractBody(f.number, f.projectTitle, f.projectId, { contractDate: f.contractDate, startDate: f.startDate, endDate: f.endDate }, f.description, f.lines || []),
      cost_center_id: project?.costCenterIds?.[0] || undefined,
      counterparty_id: party?.id || project?.clientId || '',
      duration_days: Math.max(0, Math.round(f.durationMonths * 30)),
      advance_pct: f.advancePaymentPercentage,
      retention_pct: f.retentionPercentage,
      insurance_pct: f.insurancePercentage || 0,
      tax_pct: f.taxPercentage || 0,
      other_pct: f.otherPercentage || 0,
      adjustment_base_index: f.adjustmentBaseIndex ? f.adjustmentBaseIndex : undefined,
      adjustment_factor_pct: f.adjustmentBaseIndex ? f.adjustmentFactorPercentage || undefined : undefined,
    };
    return result(await post(key, 'contracts', body), state);
  },
  async createSubcontractorContract([input], state, key) {
    const f = input as NewSubcontractInput;
    const project = state.projects.find((p) => p.id === f.projectId);
    const party = f.counterpartyId
      ? state.counterparties.find((c) => c.id === f.counterpartyId)
      : state.counterparties.find((c) => c.kind === 'subcontractor' && c.name.trim() === f.subcontractorName.trim());
    if (!party) throw new ApiError(400, 'Unknown subcontractor', 'پیمانکار را از طرف حساب‌های «پیمانکار جزء» انتخاب کنید (ابتدا در اطلاعات پایه تعریف شود).');
    const body = {
      kind: 'subcontract',
      ...contractBody(f.contractNumber, f.title, f.projectId, { startDate: f.startDate, endDate: f.endDate }, f.notes, f.lines || []),
      cost_center_id: project?.costCenterIds?.[0] || '',
      counterparty_id: party.id,
      trade_type: f.tradeType,
      advance_pct: f.advancePercentage || 0,
      retention_pct: f.retentionDepositRate,
      insurance_pct: f.insurancePercentage || 0,
      tax_pct: f.taxPercentage || 0,
    };
    return result(await post(key, 'contracts', body), state);
  },
  async decideContract([id, decision, text], state, key) {
    const version = contractVersion(state, id as string);
    const approve = decision === 'approve';
    return result(await post(key, `contracts/${id}/${approve ? 'approve' : 'reject'}`, approve ? { comment: (text as string) || '' } : { reason: text }, version), state);
  },
  async createContractAmendment([contractId, input], state, key) {
    const f = input as NewAmendmentInput;
    const body = {
      amendment_no: f.number.trim(),
      date: isoOrUndefined(f.date),
      extend_days: f.extendedDays || 0,
      description: f.description || '',
      lines: (f.lines || [])
        .filter((l) => l.quantityDelta !== 0)
        .map((l) =>
          l.contractLineId
            ? { contract_line_id: l.contractLineId, quantity_delta: qtyString(l.quantityDelta) }
            : { description: l.description.trim(), unit: l.unit.trim(), rate: l.rate, quantity_delta: qtyString(l.quantityDelta) }
        ),
    };
    return result(await post(key, `contracts/${contractId}/amendments`, body), state);
  },
  async decideContractAmendment([id, decision, text], state, key) {
    const version = versionOf(state.contractAmendments as { id: string; version?: number }[], id as string, 'الحاقیه');
    const approve = decision === 'approve';
    return result(await post(key, `contract-amendments/${id}/${approve ? 'approve' : 'reject'}`, approve ? { comment: (text as string) || '' } : { reason: text }, version), state);
  },
  async addContractGuarantee([contractId, input], state, key) {
    const g = input as GuaranteeInput;
    const body = { kind: g.kind, guarantee_no: g.guaranteeNo.trim(), bank: g.bank.trim(), amount: g.amount, issue_date: isoOrUndefined(g.issueDate), due_date: isoOrUndefined(g.dueDate), notes: g.notes || '' };
    return result(await post(key, `contracts/${contractId}/guarantees`, body), state);
  },
  async updateContractGuarantee([id, patch], state, key) {
    const p = patch as { status?: string; dueDate?: string; notes?: string };
    const guarantee = [...state.contracts, ...state.subcontractorContracts].flatMap((c) => c.server?.guarantees || []).find((g) => g.id === id);
    if (!guarantee) throw new ApiError(409, 'Unknown guarantee', 'ضمانت‌نامه در نسخه محلی پیدا نشد؛ صفحه را تازه کنید.');
    const body: Record<string, unknown> = {};
    if (p.status) body.status = p.status;
    if (p.dueDate) body.due_date = isoOrUndefined(p.dueDate);
    if (p.notes !== undefined) body.notes = p.notes;
    return result(await post(key, `contract-guarantees/${id}`, body, guarantee.version), state);
  },
  async requestSubcontractAdvance([contractId, amount], state, key) {
    return result(await post(key, `contracts/${contractId}/advance`, { amount }), state);
  },
  async submitClientStatementForm([form, target], state, key) {
    const f = form as ClientStatementFormInput;
    const body = {
      contract_id: f.contractId,
      title: f.statementNumber.trim() || f.description.trim(),
      period_start: isoOrUndefined(f.periodStartDate),
      period_end: isoOrUndefined(f.periodEndDate),
      lines: Object.entries(f.quantities)
        .filter(([, q]) => q > 0)
        .map(([lineId, q]) => ({ contract_line_id: lineId, quantity: qtyString(q) })),
      include_vat: f.includeVAT,
      adjustment_index: f.adjustmentIndex ? String(f.adjustmentIndex) : undefined,
      fixed_deduction: f.materialDeduction || 0,
      description: f.description || '',
      submit: target === 'submitted_to_consultant',
    };
    return result(await post(key, 'client-statements', body), state);
  },
  async decideClientStatement([id, decision, reason, employer], state, key) {
    const version = versionOf(state.clientStatements.map((s) => ({ id: s.id, version: s.server?.version })), id as string, 'صورت‌وضعیت');
    if (decision === 'return') return result(await post(key, `statements/${id}/return`, { reason }, version), state);
    const e = employer as EmployerApprovalFields | undefined;
    const body = e ? { comment: (reason as string) || '', employer_ref: e.employerRef.trim(), employer_date: isoOrUndefined(e.employerDate) } : { comment: (reason as string) || '' };
    return result(await post(key, `statements/${id}/approve`, body, version), state);
  },
  async submitSubcontractorStatementForm([form], state, key) {
    const f = form as SubcontractorStatementFormInput;
    const unknown = f.lines.find((l) => l.currentQuantity > 0 && !l.contractLineId);
    if (unknown) throw new ApiError(400, 'Line outside the contract', `ردیف «${unknown.description}» در قرارداد نیست؛ کار جدید با الحاقیه به قرارداد اضافه می‌شود.`);
    const body = {
      contract_id: f.contractId,
      title: f.statementNumber.trim(),
      period_start: isoOrUndefined(f.periodStartDate),
      period_end: isoOrUndefined(f.periodEndDate),
      lines: f.lines.filter((l) => l.currentQuantity > 0).map((l) => ({ contract_line_id: l.contractLineId, quantity: qtyString(l.currentQuantity) })),
      fixed_deduction: (f.penaltyAmount || 0) + (f.otherDeduction || 0),
    };
    return result(await post(key, 'subcontractor-statements', body), state);
  },
  async decideSubcontractorStatement([id, decision, comment], state, key) {
    const version = versionOf(state.subcontractorStatements.map((s) => ({ id: s.id, version: s.server?.version })), id as string, 'صورت‌وضعیت');
    if (decision === 'approve') return result(await post(key, `statements/${id}/approve`, { comment: (comment as string) || '' }, version), state);
    const reason = (comment as string)?.trim() || 'نیاز به اصلاح متره';
    return result(await post(key, `statements/${id}/${decision === 'reject' ? 'reject' : 'return'}`, { reason }, version), state);
  },
  async voidStatement([id, reason], state, key) {
    const all = [...state.clientStatements, ...state.subcontractorStatements].map((s) => ({ id: s.id, version: s.server?.version }));
    return result(await post(key, `statements/${id}/void`, { reason }, versionOf(all, id as string, 'صورت‌وضعیت')), state);
  },


  // ------------------------------------------------------------------ procurement (0.8.0)
  async createRequisition([form], state, key) {
    const f = form as RequisitionFormInput;
    const project = state.projects.find((p) => p.id === f.projectId);
    const center = state.costCenters.find((c) => c.projectId === f.projectId && (c.name === f.costCenter || c.id === f.costCenter));
    const body = {
      project_id: f.projectId,
      cost_center_id: center?.id || project?.costCenterIds?.[0] || undefined,
      priority: PRIORITY_KEYS[f.priority] || 'normal',
      justification: f.justification.trim(),
      needed_date: isoOrUndefined(f.items[0]?.requiredDeliveryDate),
      lines: f.items.map((i) =>
        i.kind === 'service'
          ? { kind: 'service', description: i.materialName.trim(), unit: i.unit.trim(), quantity: qtyString(i.requestedQty), estimated_rate: i.estimatedUnitPrice, account_code: (i.accountCode || '').trim() }
          : { kind: 'goods', material_id: i.materialId || materialIdByName(state, i.materialName), quantity: qtyString(i.requestedQty), estimated_rate: i.estimatedUnitPrice, description: i.materialName.trim() || undefined }
      ),
    };
    return result(await post(key, 'requisitions', body), state);
  },
  async approveRequisition([id], state, key) {
    return result(await post(key, `requisitions/${id}/approve`, { comment: '' }, serverVersion(state.purchaseRequisitions, id as string, 'درخواست خرید')), state);
  },
  async cancelRequisition([id], state, key) {
    return result(await post(key, `requisitions/${id}/cancel`, { reason: '' }, serverVersion(state.purchaseRequisitions, id as string, 'درخواست خرید')), state);
  },
  async createRfqFromRequisition([id], state, key) {
    return result(await post(key, `requisitions/${id}/rfqs`, {}), state);
  },
  async addRfqQuote([rfqId, input], state, key) {
    const q = input as RfqQuoteInput;
    const body = {
      counterparty_id: q.supplierId,
      reference: q.reference.trim(),
      prices: Object.entries(q.rates).map(([lineId, rate]) => ({ line_id: lineId, rate })),
      vat_included: q.vatIncluded,
      freight: q.freight,
      delivery_days: q.deliveryDays,
      payment_terms: q.paymentTerms,
    };
    return result(await post(key, `rfqs/${rfqId}/quotes`, body), state);
  },
  async selectWinningBid([rfqId, quoteId], state, key) {
    return result(await post(key, `rfqs/${rfqId}/award`, { quote_id: quoteId }, serverVersion(state.rfqs, rfqId as string, 'استعلام')), state);
  },
  async createPurchaseOrderFromRfq([rfqId], state, key) {
    const rfq = state.rfqs.find((r) => r.id === rfqId);
    const warehouse = state.warehouses.find((w) => w.projectId === rfq?.projectId && w.server?.status !== 'temporary') || state.warehouses.find((w) => !w.projectId);
    return result(await post(key, 'purchase-orders', { rfq_id: rfqId, warehouse_id: warehouse?.id }), state);
  },
  async createPurchaseOrder() {
    throw new ApiError(400, 'Direct order', 'با دفاتر رسمی، سفارش خرید از برنده استعلام بهای درخواست تأییدشده صادر می‌شود.');
  },
  async decidePurchaseOrder([id, decision, text], state, key) {
    const version = serverVersion(state.purchaseOrders, id as string, 'سفارش خرید');
    const approve = decision === 'approve';
    return result(await post(key, `purchase-orders/${id}/${approve ? 'approve' : 'reject'}`, approve ? { comment: (text as string) || '' } : { reason: text }, version), state);
  },
  async updatePurchaseOrderStatus([id, status], state, key) {
    if (status !== 'فسخ شده') throw new ApiError(400, 'Status', 'وضعیت سفارش را رسید انبار تعیین می‌کند؛ فقط لغو سفارش (فسخ) ثبت می‌شود.');
    return result(await post(key, `purchase-orders/${id}/reject`, { reason: 'فسخ سفارش' }, serverVersion(state.purchaseOrders, id as string, 'سفارش خرید')), state);
  },
  async receiveGoodsFromPO([input], state, key) {
    const f = input as { poId: string; warehouseId: string; date?: string; waybillNumber: string; qcApprovalStatus: string; lines: { poItemId: string; deliveredQty: number; rejectedQty: number }[] };
    const body = {
      warehouse_id: f.warehouseId || undefined,
      date: isoOrUndefined(f.date),
      waybill: f.waybillNumber || '',
      qc_status: f.qcApprovalStatus === 'مردود' ? 'rejected' : f.qcApprovalStatus === 'تأیید مشروط' ? 'conditional' : 'accepted',
      lines: f.lines.filter((l) => l.deliveredQty > 0).map((l) => ({ po_line_id: l.poItemId, delivered_qty: qtyString(l.deliveredQty), rejected_qty: qtyString(l.rejectedQty || 0) })),
    };
    return result(await post(key, `purchase-orders/${f.poId}/receipts`, body), state);
  },
  async registerVendorInvoice([grnId, input], state, key) {
    const v = input as VendorInvoiceInput;
    const body = { invoice_no: v.invoiceNo.trim(), invoice_date: isoOrUndefined(v.invoiceDate), due_date: isoOrUndefined(v.dueDate), subtotal: v.subtotal, freight: v.freight, vat_amount: v.vatAmount };
    return result(await post(key, `goods-receipts/${grnId}/invoices`, body), state);
  },
  async updateVendorInvoice([id, input], state, key) {
    const v = input as Partial<VendorInvoiceInput>;
    const body: Record<string, unknown> = {};
    if (v.subtotal !== undefined) body.subtotal = v.subtotal;
    if (v.freight !== undefined) body.freight = v.freight;
    if (v.vatAmount !== undefined) body.vat_amount = v.vatAmount;
    if (v.invoiceDate) body.invoice_date = isoOrUndefined(v.invoiceDate);
    if (v.dueDate) body.due_date = isoOrUndefined(v.dueDate);
    return result(await post(key, `vendor-invoices/${id}`, body, serverVersion(state.vendorInvoices, id as string, 'فاکتور')), state);
  },
  async approveVendorInvoice([id], state, key) {
    return result(await post(key, `vendor-invoices/${id}/approve`, { comment: '' }, serverVersion(state.vendorInvoices, id as string, 'فاکتور')), state);
  },
  async rejectVendorInvoice([id, reason], state, key) {
    return result(await post(key, `vendor-invoices/${id}/reject`, { reason }, serverVersion(state.vendorInvoices, id as string, 'فاکتور')), state);
  },
  async createSupplier([input], state, key) {
    const f = input as NewSupplierInput;
    const body = { kind: 'supplier', name: f.name.trim(), national_id: f.nationalId, economic_code: f.economicCode, phone: f.phone || f.mobile, email: f.email, address: [f.city, f.address].filter(Boolean).join('، '), sheba: f.shebaNumber, bank_name: f.bankName };
    const res = result(await post(key, 'counterparties', body), state);
    const party = res.records.find((r) => r.slice === 'counterparties')?.upserted || [];
    res.records.push({ slice: 'suppliers', upserted: suppliersOf(party as never) as unknown as Record<string, unknown>[] });
    return res;
  },

  // ------------------------------------------------------------------ inventory (0.8.0)
  async createMaterial([input], state, key) {
    const f = input as NewMaterialInput;
    const body = { name: f.name.trim(), category: f.category, unit: f.unit.trim(), specification: [f.specifications, f.standardGrade].filter(Boolean).join(' — '), reorder_level: qtyString(f.reorderLevel), min_stock: qtyString(f.minSafetyStock), max_stock: qtyString(f.maxCapacity) };
    return result(await post(key, 'materials', body), state);
  },
  async createWarehouse([input], state, key) {
    const f = input as WarehouseInput;
    return result(await post(key, 'warehouses', { name: f.name.trim(), kind: f.kind, project_id: f.kind === 'central' ? undefined : f.projectId || undefined, location: f.location, keeper_name: f.keeperName }), state);
  },
  async submitStoreIssueForm([form], state, key) {
    const f = form as StoreIssueFormInput;
    const warehouse = state.warehouses.find((w) => w.id === f.warehouseId);
    const party = f.subcontractorName.trim() ? state.counterparties.find((c) => c.kind === 'subcontractor' && c.name === f.subcontractorName.trim()) : undefined;
    const body = {
      warehouse_id: f.warehouseId,
      project_id: warehouse?.projectId || f.projectId || undefined,
      counterparty_id: party?.id,
      notes: [f.wbsSection, f.costCenter].filter(Boolean).join(' — '),
      lines: f.lines.filter((l) => l.qty > 0).map((l) => ({ material_id: l.materialId, quantity: qtyString(l.qty) })),
    };
    return result(await post(key, 'store-issues', body), state);
  },
  async confirmStoreIssue([id], state, key) {
    return result(await post(key, `store-issues/${id}/confirm`, { comment: '' }, serverVersion(state.storeIssues, id as string, 'حواله')), state);
  },
  async releaseStoreIssue([id], state, key) {
    return result(await post(key, `store-issues/${id}/cancel`, { reason: 'لغو درخواست' }, serverVersion(state.storeIssues, id as string, 'حواله')), state);
  },
  async returnFromProject([issueId, materialId, quantity, reason], state, key) {
    const issue = state.storeIssues.find((v) => v.id === issueId);
    const index = (issue?.server?.extra?.lineMaterials as string[] | undefined)?.indexOf(materialId as string) ?? -1;
    const lineId = index >= 0 ? issue?.server?.lineIds?.[index] : undefined;
    if (!lineId) throw new ApiError(409, 'Unknown issue line', 'ردیف حواله در نسخه محلی پیدا نشد؛ صفحه را تازه کنید.');
    return result(await post(key, `store-issues/${issueId}/returns`, { line_id: lineId, quantity: qtyString(quantity as number), reason }), state);
  },
  async returnToSupplier([grnId, materialId, quantity, reason], state, key) {
    const grn = state.goodsReceipts.find((g) => g.id === grnId);
    const index = grn ? grn.items.findIndex((i) => i.materialId === materialId) : -1;
    const lineId = index >= 0 ? grn?.server?.lineIds?.[index] : undefined;
    if (!lineId) throw new ApiError(409, 'Unknown receipt line', 'ردیف رسید در نسخه محلی پیدا نشد؛ صفحه را تازه کنید.');
    return result(await post(key, `goods-receipts/${grnId}/returns`, { line_id: lineId, quantity: qtyString(quantity as number), reason }), state);
  },
  async submitTransferForm([form], state, key) {
    const f = form as TransferFormInput;
    const body = { source_warehouse_id: f.sourceWarehouseId, target_warehouse_id: f.targetWarehouseId, waybill: f.waybillNumber, driver_name: f.driverName, lines: f.lines.filter((l) => l.quantity > 0).map((l) => ({ material_id: l.materialId, quantity: qtyString(l.quantity) })) };
    return result(await post(key, 'stock-transfers', body), state);
  },
  async advanceTransfer([id, status], state, key) {
    if (status !== 'تخلیه و تحویل قطعی مقصد') throw new ApiError(400, 'Status', 'با دفاتر رسمی فقط تحویل قطعی در مقصد ثبت می‌شود.');
    return result(await post(key, `stock-transfers/${id}/deliver`, { comment: '' }, serverVersion(state.interTransfers, id as string, 'انتقال')), state);
  },
  async createStocktake([input], state, key) {
    const f = input as StocktakeCountInput;
    return result(await post(key, 'stocktakes', { warehouse_id: f.warehouseId, date: isoOrUndefined(f.date), notes: f.notes, lines: f.lines.map((l) => ({ material_id: l.materialId, quantity: qtyString(l.physicalCount) })) }), state);
  },
  async applyStocktakeById([id], state, key) {
    return result(await post(key, `stocktakes/${id}/approve`, { comment: '' }, serverVersion(state.stocktakes, id as string, 'انبارگردانی')), state);
  },
  async rejectStocktake([id, reason], state, key) {
    return result(await post(key, `stocktakes/${id}/reject`, { reason }, serverVersion(state.stocktakes, id as string, 'انبارگردانی')), state);
  },

  // ------------------------------------------------------------------ payroll (0.8.0)
  async createEmployee([input], state, key) {
    return result(await post(key, 'employees', employeeBody(input as EmployeeInput)), state);
  },
  async updateEmployee([id, patch], state, key) {
    const p = patch as Partial<EmployeeInput> & { active?: boolean };
    const body: Record<string, unknown> = employeeBody(p);
    if (p.active !== undefined) body.active = p.active;
    return result(await post(key, `employees/${id}`, body, serverVersion(state.employees, id as string, 'پرسنل')), state);
  },
  async createPayrollPeriod([year, month], state, key) {
    return result(await post(key, 'payroll/periods', { fiscal_year: year, month }), state);
  },
  async saveTimesheets([periodId, rows], state, key) {
    const body = { timesheets: (rows as TimesheetInput[]).map((r) => ({ employee_id: r.employeeId, work_days: String(r.workDays), absent_days: String(r.absentDays), overtime_hours: String(r.overtimeHours), mission_days: String(r.missionDays) })) };
    return result(await post(key, `payroll/periods/${periodId}/timesheets`, body, periodVersion(state, periodId as string)), state);
  },
  async calculatePayroll([periodId], state, key) {
    return result(await post(key, `payroll/periods/${periodId}/calculate`, {}, periodVersion(state, periodId as string)), state);
  },
  async decidePayrollPeriod([periodId, decision, text], state, key) {
    const approve = decision === 'approve';
    return result(await post(key, `payroll/periods/${periodId}/${approve ? 'approve' : 'reject'}`, approve ? { comment: (text as string) || '' } : { reason: text }, periodVersion(state, periodId as string)), state);
  },
  async approvePayrollPeriod([monthYear], state, key) {
    const period = state.payrollPeriods.find((p) => p.monthYear === monthYear);
    if (!period) throw new ApiError(409, 'Unknown period', 'دوره حقوق در نسخه محلی پیدا نشد؛ صفحه را تازه کنید.');
    return result(await post(key, `payroll/periods/${period.id}/approve`, { comment: '' }, period.version), state);
  },

  // ------------------------------------------------------------------ approval center (0.6.0)
  async decideServerApproval([item, decision, text, fields], state, key) {
    const a = item as ApprovalItem;
    if (!a.server) throw new ApiError(400, 'Not a server approval', 'این مورد از کارتابل سرور نیست؛ صفحه را تازه کنید.');
    const approve = decision === 'approve';
    const f = fields as EmployerApprovalFields | undefined;
    const extra = approve && a.server.requires?.length ? { employer_ref: f?.employerRef.trim() || '', employer_date: isoOrUndefined(f?.employerDate) } : {};
    return result(await post(key, approve ? a.server.approvePath : a.server.rejectPath, approve ? { comment: (text as string) || '', ...extra } : { reason: text }, a.server.version), state);
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
  // 0.7.0: amounts, caps, previous quantities, deductions and approval steps are the server's.
  'createClientContract',
  'createSubcontractorContract',
  'decideContract',
  'createContractAmendment',
  'decideContractAmendment',
  'addContractGuarantee',
  'updateContractGuarantee',
  'requestSubcontractAdvance',
  'submitClientStatementForm',
  'decideClientStatement',
  'submitSubcontractorStatementForm',
  'decideSubcontractorStatement',
  'voidStatement',
  // 0.8.0: steps, free stock, averages, matching and payslips are the server's.
  'createRequisition',
  'approveRequisition',
  'cancelRequisition',
  'createRfqFromRequisition',
  'addRfqQuote',
  'selectWinningBid',
  'createPurchaseOrderFromRfq',
  'createPurchaseOrder',
  'decidePurchaseOrder',
  'updatePurchaseOrderStatus',
  'receiveGoodsFromPO',
  'registerVendorInvoice',
  'updateVendorInvoice',
  'approveVendorInvoice',
  'rejectVendorInvoice',
  'createSupplier',
  'createMaterial',
  'createWarehouse',
  'submitStoreIssueForm',
  'confirmStoreIssue',
  'releaseStoreIssue',
  'returnFromProject',
  'returnToSupplier',
  'submitTransferForm',
  'advanceTransfer',
  'createStocktake',
  'applyStocktakeById',
  'rejectStocktake',
  'createEmployee',
  'updateEmployee',
  'createPayrollPeriod',
  'saveTimesheets',
  'calculatePayroll',
  'decidePayrollPeriod',
  'approvePayrollPeriod',
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
      const [treasurySettings, contractsRaw, statementsRaw, inventoryRaw, procurementRaw, payrollRaw] = await Promise.all([
        optional(apiClient.get<unknown>('treasury/settings'), null),
        optional(apiClient.get<unknown>('contracts'), { contracts: [] }),
        optional(apiClient.get<unknown>('statements'), { statements: [] }),
        optional(apiClient.get<unknown>('inventory'), null),
        optional(apiClient.get<unknown>('procurement'), null),
        // Personal data: accountant, senior manager and system administrator only (403 for the others).
        optional(apiClient.get<unknown>('payroll'), null),
      ]);
      const costCenters = arr('/cost-centers', obj('/cost-centers', centersRaw), 'cost_centers').map(parseCostCenter);
      const projects = arr('/projects', obj('/projects', projectsRaw), 'projects').map((p) => parseProject(p, costCenters));
      const counterparties = arr('/counterparties', obj('/counterparties', partiesRaw), 'counterparties').map(parseCounterparty);
      const base = emptyState();
      const partial = { ...base, projects, costCenters, counterparties, chartOfAccounts: chart };
      const journalEntries = arr('/journal-entries', obj('/journal-entries', entriesRaw), 'entries').map((e) => parseEntry(e, lookups(partial)));
      const finance = loadFinance(partial, pettyRaw, treasuryRaw);
      const contractState = contractSlices(arr('/contracts', obj('/contracts', contractsRaw), 'contracts'));
      const statementState = statementSlices(arr('/statements', obj('/statements', statementsRaw), 'statements'));
      const partyName = (id: string) => counterparties.find((c) => c.id === id)?.name || '';
      const projectName = (id: string) => projects.find((p) => p.id === id)?.name || '';
      const inventoryState = inventoryRaw ? inventorySlices(inventoryRaw, partyName) : {};
      const procurement = procurementRaw ? procurementSlices(procurementRaw) : null;
      const payroll = payrollRaw ? payrollSlices(payrollRaw, projectName) : {};
      return {
        ...partial,
        ...finance,
        ...contractState,
        ...statementState,
        ...inventoryState,
        ...(procurement
          ? {
              purchaseRequisitions: procurement.purchaseRequisitions,
              rfqs: procurement.rfqs,
              purchaseOrders: procurement.purchaseOrders,
              goodsReceipts: procurement.goodsReceipts,
              vendorInvoices: procurement.vendorInvoices,
            }
          : {}),
        ...payroll,
        suppliers: suppliersOf(counterparties),
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
