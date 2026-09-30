/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Petty cash, treasury and approval-center responses of akph/v1 → app records, and form input → command
 * bodies (docs/API-CONTRACT.md §petty cash, §treasury, §approvals). Balances, statuses, numbers, approval
 * steps and entries come from the server only; amounts are integer Rials both ways.
 */

import type {
  ApprovalItem,
  BankAccount,
  BankReconciliationItem,
  PaymentRecord,
  PaymentRequest,
  PettyCashAccount,
  PettyCashCategoryItem,
  PettyCashExpense,
  PettyCashFundType,
  PettyCashReconciliation,
  PettyCashReplenishment,
  PettyCashReplenishmentRequest,
  PettyCashSettings,
  PortalRole,
  Project,
  CostCenter,
  ProjectCashDesk,
  ReceiptRecord,
  TreasuryCheck,
} from '../../types';
import { isoToJalali } from '../../utils/jalali';
import { PETTY_STEP_ACTION, type UserAction } from '../../utils/permissions';
import { ApiError } from '../client';
import { arr, int, jdate, obj, rial, str } from './mapping';

type Obj = Record<string, unknown>;

export interface FinanceLookups {
  projects: readonly Pick<Project, 'id' | 'name'>[];
  costCenters: readonly Pick<CostCenter, 'id' | 'name'>[];
}

const idOrEmpty = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const projectName = (l: FinanceLookups, id: string, headOffice = 'ستاد مرکزی') => (id ? l.projects.find((p) => p.id === id)?.name || '-' : headOffice);
const version = (route: string, o: Obj) => int(route, o, 'version');
const entryNumber = (v: unknown) => (v && typeof v === 'object' && typeof (v as Obj).number === 'string' ? ((v as Obj).number as string) : undefined);
const entryStatus = (v: unknown) => (v && typeof v === 'object' ? String((v as Obj).status || '') : '');

/** ISO datetime of the wire → [Jalali date, HH:MM]. */
function stamp(at: unknown): [string, string] {
  const s = typeof at === 'string' ? at : '';
  return [isoToJalali(s.slice(0, 10)) || '', s.slice(11, 16)];
}

// ---------------------------------------------------------------------------- petty cash

const FUND_TYPES: readonly PettyCashFundType[] = ['project_manager', 'site_supervisor', 'procurement', 'headquarters'];
const HOLDER_ROLE: Record<PettyCashFundType, string> = {
  project_manager: 'مدیر پروژه',
  site_supervisor: 'سرپرست کارگاه',
  procurement: 'مسئول خرید و کارپرداز',
  headquarters: 'واحد اداری و ستادی',
};

export function parsePettyFund(raw: unknown, l: FinanceLookups, banks: readonly { id: string; title: string }[] = []): PettyCashAccount {
  const route = '/petty-cash';
  const o = obj(route, raw);
  const fundType = FUND_TYPES.includes(o.fund_type as PettyCashFundType) ? (o.fund_type as PettyCashFundType) : 'site_supervisor';
  const projectId = idOrEmpty(o.project_id);
  const costCenterId = idOrEmpty(o.cost_center_id);
  const sourceId = idOrEmpty(o.source_account_id);
  return {
    id: str(route, o, 'id'),
    code: str(route, o, 'code'),
    title: str(route, o, 'title'),
    holderName: str(route, o, 'holder_name', true),
    holderRole: HOLDER_ROLE[fundType],
    holderPhone: str(route, o, 'holder_phone', true),
    projectId,
    projectName: projectName(l, projectId),
    costCenterId,
    costCenterName: l.costCenters.find((c) => c.id === costCenterId)?.name || (projectId ? '-' : 'ستاد مرکزی'),
    fundType,
    ceilingLimit: rial(route, o, 'ceiling'),
    minBalanceWarning: rial(route, o, 'min_balance_warning'),
    actualBalance: rial(route, o, 'balance'),
    pendingExpenses: rial(route, o, 'pending_expenses'),
    usableBalance: rial(route, o, 'usable_balance'),
    sourceBankAccountId: sourceId,
    sourceBankAccountTitle: banks.find((b) => b.id === sourceId)?.title || '',
    startDate: jdate(route, o, 'period_start', true),
    status: o.active === true ? 'active' : 'suspended',
    monthlySpent: rial(route, o, 'period_spent'),
    lastReplenishmentDate: jdate(route, o, 'last_replenishment_date', true),
    lastReplenishmentAmount: rial(route, o, 'last_replenishment_amount'),
    notes: str(route, o, 'notes', true),
    version: version(route, o),
  };
}

const PETTY_METHODS: Record<string, PettyCashExpense['paymentMethod']> = { card: 'کارت تنخواه', cash: 'نقد', transfer: 'حواله/انتقال', other: 'سایر' };
export const PETTY_METHOD_KEYS: Record<PettyCashExpense['paymentMethod'], string> = { 'کارت تنخواه': 'card', 'نقد': 'cash', 'حواله/انتقال': 'transfer', 'سایر': 'other' };

type HistoryRow = PettyCashExpense['approvalHistory'][number];

function parseHistory(route: string, o: Obj): HistoryRow[] {
  return arr(route, o, 'history').map((h) => {
    const r = obj(route, h, 'history');
    const [date, time] = stamp(r.at);
    const action = r.action === 'rejected' ? 'rejected' : r.action === 'returned' ? 'returned_for_correction' : 'approved';
    return {
      level: r.action === 'submitted' ? 'ثبت اولیه' : String(r.step || ''),
      approverName: String(r.user_name || ''),
      approverId: idOrEmpty(r.user_id),
      approverRole: String(r.role || ''),
      date,
      time,
      action,
      comment: typeof r.comment === 'string' && r.comment ? r.comment : undefined,
    };
  });
}

export function parsePettyExpense(raw: unknown, l: FinanceLookups): PettyCashExpense {
  const route = '/petty-cash (expenses)';
  const o = obj(route, raw);
  const status = String(o.status);
  const projectId = idOrEmpty(o.project_id);
  const costCenterId = idOrEmpty(o.cost_center_id);
  const step = typeof o.current_step === 'string' ? (o.current_step as PortalRole) : null;
  const history = parseHistory(route, o);
  return {
    id: str(route, o, 'id'),
    expenseNumber: str(route, o, 'number', true),
    pettyCashId: str(route, o, 'fund_id'),
    pettyCashTitle: str(route, o, 'fund_title', true),
    projectId,
    projectName: projectName(l, projectId),
    costCenterId: costCenterId || undefined,
    costCenter: l.costCenters.find((c) => c.id === costCenterId)?.name || (projectId ? '' : 'ستاد مرکزی'),
    date: jdate(route, o, 'date'),
    category: str(route, o, 'category_name', true),
    subCategory: str(route, o, 'sub_category', true),
    amount: rial(route, o, 'amount'),
    counterpartyId: idOrEmpty(o.counterparty_id) || undefined,
    vendor: str(route, o, 'vendor', true),
    vendorNationalId: str(route, o, 'vendor_national_id', true),
    invoiceNumber: str(route, o, 'invoice_number', true),
    invoiceDate: jdate(route, o, 'invoice_date', true),
    description: str(route, o, 'description', true),
    paymentMethod: PETTY_METHODS[String(o.payment_method)] || 'نقد',
    status: status === 'pending' ? 'pending_approval' : status === 'approved' ? 'approved' : status === 'returned' ? 'returned_for_correction' : 'rejected',
    approvalLevelRequired: (['site_manager_and_finance', 'project_and_finance', 'ceo_full'].includes(String(o.approval_level)) ? o.approval_level : 'site_manager_and_finance') as PettyCashExpense['approvalLevelRequired'],
    currentApprovalStep: step || (status === 'approved' ? 'تأیید نهایی و ثبت سند' : status === 'returned' ? 'بازگشت به کاربر' : 'رد شده'),
    approvalHistory: history,
    rejectionReason: str(route, o, 'reject_reason', true) || undefined,
    submitterName: str(route, o, 'submitted_by_name', true),
    submitterId: str(route, o, 'submitted_by'),
    submitterRole: history[0]?.approverRole || '',
    inventoryTarget: 'direct_consumption',
    journalEntryId: entryNumber(o.entry),
    accountingAccountCode: str(route, o, 'account_code', true),
    version: version(route, o),
  };
}

export function parsePettyRequest(raw: unknown): PettyCashReplenishmentRequest {
  const route = '/petty-cash (requests)';
  const o = obj(route, raw);
  const status = String(o.status);
  const history = arr(route, o, 'history');
  const first = history.length ? obj(route, history[0], 'history') : {};
  const balance = rial(route, o, 'balance_at_request');
  return {
    id: str(route, o, 'id'),
    requestNumber: str(route, o, 'number', true),
    pettyCashId: str(route, o, 'fund_id'),
    pettyCashTitle: str(route, o, 'fund_title', true),
    currentActualBalance: balance,
    currentUsableBalance: balance,
    suggestedAmount: rial(route, o, 'amount'),
    recentExpensesSummary: typeof o.current_step === 'string' ? `در انتظار تأیید ${o.current_step}` : '',
    reason: str(route, o, 'reason', true),
    requesterName: str(route, o, 'requested_by_name', true),
    requesterRole: String((first as Obj).role || ''),
    date: jdate(route, o, 'date'),
    status: status === 'pending' ? 'در انتظار تأیید مالی' : status === 'rejected' ? 'رد شده' : 'تأیید شده',
    rejectionReason: str(route, o, 'reject_reason', true) || undefined,
  };
}

export function parsePettyCount(raw: unknown): PettyCashReconciliation {
  const route = '/petty-cash (counts)';
  const o = obj(route, raw);
  const diff = int(route, o, 'discrepancy');
  const adjustment = entryNumber(o.entry);
  const [date] = stamp(o.created_at);
  return {
    id: str(route, o, 'id'),
    reconNumber: str(route, o, 'number', true),
    pettyCashId: str(route, o, 'fund_id'),
    pettyCashTitle: str(route, o, 'fund_title', true),
    periodStartDate: jdate(route, o, 'period_start', true),
    periodEndDate: jdate(route, o, 'period_end', true),
    openingBalance: rial(route, o, 'book_balance'),
    totalReplenishments: 0,
    totalApprovedExpenses: rial(route, o, 'pending_expenses'),
    expectedBalance: int(route, o, 'expected_balance'),
    actualCountedCash: rial(route, o, 'counted_cash'),
    discrepancy: diff,
    status: diff === 0 ? 'متعادل (بدون مغایرت)' : entryStatus(o.entry) === 'posted' ? 'تسویه و سند تعدیل صادر شد' : diff < 0 ? 'دارای کسری' : 'دارای مازاد',
    discrepancyReason: str(route, o, 'reason', true) || undefined,
    adjustmentDocNumber: adjustment,
    officerName: str(route, o, 'counted_by_name', true),
    financeApproverName: '',
    date,
    notes: str(route, o, 'notes', true) || undefined,
  };
}

const TRANSFER_METHODS: Record<string, PettyCashReplenishment['transferMethod']> = { satna: 'حواله ساتنا/پایا', paya: 'حواله ساتنا/پایا', transfer: 'حواله ساتنا/پایا', card: 'کارت به کارت', cheque: 'چک بانکی', cash: 'نقدی' };

export function parseReplenishment(raw: unknown, funds: readonly Pick<PettyCashAccount, 'id' | 'title'>[]): PettyCashReplenishment {
  const route = '/petty-cash (replenishments)';
  const o = obj(route, raw);
  const fundId = str(route, o, 'fund_id');
  return {
    id: str(route, o, 'id'),
    docNumber: str(route, o, 'payment_request_number', true),
    pettyCashId: fundId,
    pettyCashTitle: funds.find((f) => f.id === fundId)?.title || '',
    amount: rial(route, o, 'amount'),
    sourceBankAccountId: str(route, o, 'account_id', true),
    sourceBankAccountName: str(route, o, 'account_title', true),
    date: jdate(route, o, 'date'),
    transferMethod: TRANSFER_METHODS[String(o.method)] || 'حواله ساتنا/پایا',
    trackingNumber: str(route, o, 'tracking', true),
    description: str(route, o, 'description', true),
    approvedBy: str(route, o, 'paid_by_name', true),
    journalEntryId: str(route, o, 'entry_number', true) || undefined,
    status: 'تأیید و واریز شد',
  };
}

export function parsePettyCategory(raw: unknown): PettyCashCategoryItem {
  const route = '/petty-cash (categories)';
  const o = obj(route, raw);
  return { id: str(route, o, 'id'), name: str(route, o, 'name'), subcategories: arr(route, o, 'subcategories').map(String) };
}

export function parsePettySettings(raw: unknown): PettyCashSettings {
  const route = '/petty-cash/settings';
  const o = obj(route, raw);
  const limits = obj(route, o.fund_limits, 'fund_limits');
  const chains = obj(route, o.approval_chains, 'approval_chains');
  const fundLimits = {} as PettyCashSettings['fundLimits'];
  for (const t of FUND_TYPES) {
    const f = obj(route, limits[t], `fund_limits.${t}`);
    fundLimits[t] = { ceiling: rial(route, f, 'ceiling'), minBalanceWarning: rial(route, f, 'min_balance_warning'), maxSingleExpense: rial(route, f, 'max_single_expense') };
  }
  const chain = (k: string) => (Array.isArray(chains[k]) ? (chains[k] as unknown[]).map(String) : []) as PortalRole[];
  return {
    fundLimits,
    siteLevelMax: rial(route, o, 'site_level_max'),
    projectLevelMax: rial(route, o, 'project_level_max'),
    approvalChains: { site_manager_and_finance: chain('site_manager_and_finance'), project_and_finance: chain('project_and_finance'), ceo_full: chain('ceo_full') },
    lowBalancePercent: int(route, o, 'low_balance_percent'),
  };
}

export function pettySettingsBody(s: PettyCashSettings) {
  const fund_limits: Record<string, unknown> = {};
  for (const t of FUND_TYPES) {
    const f = s.fundLimits[t];
    fund_limits[t] = { ceiling: f.ceiling, min_balance_warning: f.minBalanceWarning, max_single_expense: f.maxSingleExpense };
  }
  return {
    fund_limits,
    site_level_max: s.siteLevelMax,
    project_level_max: s.projectLevelMax,
    approval_chains: s.approvalChains,
    low_balance_percent: s.lowBalancePercent,
  };
}

// ---------------------------------------------------------------------------- treasury

export function parseTreasuryAccount(raw: unknown, l: FinanceLookups): { kind: 'bank'; bank: BankAccount } | { kind: 'cash'; desk: ProjectCashDesk } {
  const route = '/treasury (accounts)';
  const o = obj(route, raw);
  const id = str(route, o, 'id');
  const balance = int(route, o, 'balance');
  if (o.kind === 'cash') {
    const projectId = idOrEmpty(o.project_id);
    return {
      kind: 'cash',
      desk: {
        id,
        title: str(route, o, 'title'),
        code: str(route, o, 'code'),
        keeperName: str(route, o, 'holder_name', true),
        balance,
        location: str(route, o, 'location', true),
        lastCountDate: '',
        projectId,
        projectName: projectName(l, projectId),
        ceilingLimit: 0,
        lastAuditDate: '',
        accountCode: str(route, o, 'account_code'),
        version: version(route, o),
      },
    };
  }
  return {
    kind: 'bank',
    bank: {
      id,
      bankName: str(route, o, 'bank_name', true) || str(route, o, 'title'),
      accountNumber: str(route, o, 'account_number', true) || str(route, o, 'title'),
      shebaNumber: str(route, o, 'sheba', true),
      branch: str(route, o, 'branch', true),
      holderName: str(route, o, 'holder_name', true),
      balance,
      openingBalance: 0,
      totalReceipts: rial(route, o, 'total_in'),
      totalPayments: rial(route, o, 'total_out'),
      closingBalance: balance,
      status: o.active === true ? 'فعال' : 'مسدود',
      accountCode: str(route, o, 'account_code'),
      version: version(route, o),
    },
  };
}

const SOURCE_TYPES: Record<string, PaymentRequest['sourceType']> = {
  petty_cash: 'شارژ و تسویه تنخواه',
  supplier: 'فاکتور خرید تأمین‌کننده',
  subcontractor: 'صورت‌وضعیت پیمانکار جزء',
  payroll: 'حقوق و دستمزد ماهانه',
  insurance: 'حق بیمه و مالیات',
  tax_vat: 'حق بیمه و مالیات',
  tax_payroll: 'حق بیمه و مالیات',
  tax_withholding: 'حق بیمه و مالیات',
  advance: 'پیش‌پرداخت خرید',
  subcontractor_advance: 'پیش‌پرداخت پیمانکار جزء',
  general_expense: 'سایر هزینه‌های عمومی',
  manual_account: 'سایر هزینه‌های عمومی',
};
const TAX_KIND: Record<string, PaymentRequest['taxKind']> = { tax_vat: 'vat', tax_payroll: 'payroll', tax_withholding: 'withholding' };
const BENEFICIARY: Record<string, PaymentRequest['beneficiaryType']> = {
  petty_cash: 'مسئول تنخواه',
  subcontractor: 'پیمانکار جزء',
  subcontractor_advance: 'پیمانکار جزء',
  payroll: 'پرسنل',
  insurance: 'سازمان تامین اجتماعی',
  tax_vat: 'سازمان امور مالیاتی',
  tax_payroll: 'سازمان امور مالیاتی',
  tax_withholding: 'سازمان امور مالیاتی',
};
const PRIORITY: Record<string, PaymentRequest['priority']> = { urgent: 'فوری / بحرانی', normal: 'عادی', low: 'پایین' };
const PAY_METHOD: Record<string, PaymentRequest['paymentMethod']> = { satna: 'حواله ساتنا', paya: 'حواله پایا', transfer: 'حواله پایا', card: 'کارت به کارت', cash: 'صندوق نقد', cheque: 'چک صیادی بانکی' };
const RECORD_METHOD: Record<string, PaymentRecord['method']> = { satna: 'حواله ساتنا/پایا', paya: 'حواله ساتنا/پایا', transfer: 'حواله ساتنا/پایا', card: 'کارت تنخواه', cash: 'نقد', cheque: 'چک بانکی صیادی' };

/** Manual payment request form → payable type of the server (PAYABLE_ACCOUNTS of src/store/postingRules.ts). */
export function payableTypeOf(sourceType: PaymentRequest['sourceType'], liability: 'insurance' | 'vat' | 'payroll' | 'withholding'): string {
  switch (sourceType) {
    case 'حق بیمه و مالیات':
      return liability === 'insurance' ? 'insurance' : `tax_${liability}`;
    case 'پیش‌پرداخت خرید':
      return 'advance';
    case 'پیش‌پرداخت پیمانکار جزء':
      return 'subcontractor_advance';
    case 'صورت‌وضعیت پیمانکار جزء':
      return 'subcontractor';
    case 'فاکتور خرید تأمین‌کننده':
      return 'supplier';
    case 'حقوق و دستمزد ماهانه':
      return 'payroll';
    default:
      return 'general_expense';
  }
}

/** Payment request and its payments (the `payments` slice). */
export function parsePaymentRequest(raw: unknown, l: FinanceLookups): { request: PaymentRequest; payments: PaymentRecord[] } {
  const route = '/payment-requests';
  const o = obj(route, raw);
  const status = String(o.status);
  const payable = String(o.payable_type);
  const projectId = idOrEmpty(o.project_id);
  const amount = rial(route, o, 'amount');
  const paid = rial(route, o, 'paid_amount');
  const remaining = rial(route, o, 'remaining_amount');
  const payments = arr(route, o, 'payments').map((p) => obj(route, p, 'payments'));
  const last = payments[payments.length - 1];
  const approvedAt = typeof o.approved_at === 'string' ? stamp(o.approved_at)[0] : undefined;
  const request: PaymentRequest = {
    id: str(route, o, 'id'),
    requestNumber: str(route, o, 'number', true),
    sourceType: o.source_type === 'petty_replenishment' ? 'شارژ و تسویه تنخواه' : SOURCE_TYPES[payable] || 'سایر هزینه‌های عمومی',
    sourceRefId: idOrEmpty(o.source_type === 'petty_replenishment' ? o.fund_id : o.source_id),
    sourceRefNumber: o.source_type === 'manual' ? 'بدون سند مبدأ' : '',
    date: jdate(route, o, 'date'),
    dueDate: jdate(route, o, 'due_date', true),
    projectId,
    projectName: projectName(l, projectId),
    costCenterId: idOrEmpty(o.cost_center_id),
    beneficiaryName: str(route, o, 'beneficiary_name', true),
    counterpartyId: idOrEmpty(o.counterparty_id) || undefined,
    beneficiaryType: BENEFICIARY[payable] || 'تأمین‌کننده',
    beneficiaryAccount: { bankName: '', shebaNumber: str(route, o, 'beneficiary_sheba', true), accountNumber: '' },
    totalAmount: amount,
    approvedAmount: status === 'approved' || status === 'paid' ? amount : 0,
    paidAmount: paid,
    remainingAmount: status === 'rejected' ? 0 : remaining,
    priority: PRIORITY[String(o.priority)] || 'عادی',
    status: status === 'pending' ? 'در انتظار تأیید مالی' : status === 'approved' ? 'در صف پرداخت خزانه' : status === 'paid' ? 'پرداخت شده' : 'رد شده',
    taxKind: TAX_KIND[payable],
    approvedBy: str(route, o, 'approved_by_name', true) || undefined,
    approvedById: idOrEmpty(o.approved_by) || undefined,
    approvedDate: approvedAt,
    paymentMethod: last ? PAY_METHOD[String(last.method)] : undefined,
    payerBankAccountId: last ? idOrEmpty(last.account_id) : undefined,
    payerBankAccountName: last ? String(last.account_title || '') : undefined,
    paymentDate: last ? jdate(route, last, 'date', true) : undefined,
    trackingNumber: last ? String(last.tracking || '') : undefined,
    journalEntryId: last ? entryNumber(last.entry) : undefined,
    notes: str(route, o, 'reject_reason', true) || str(route, o, 'description', true) || undefined,
    requestedBy: str(route, o, 'requested_by_name', true) || undefined,
    requestedById: str(route, o, 'requested_by'),
    version: version(route, o),
  };
  const records: PaymentRecord[] = payments.map((p) => ({
    id: `pay-${str(route, p, 'id')}`,
    docNumber: entryNumber(p.entry) || '',
    date: jdate(route, p, 'date'),
    amount: rial(route, p, 'amount'),
    counterpartyId: request.counterpartyId,
    costCenterId: request.costCenterId || undefined,
    payee: request.beneficiaryName,
    payerAccount: String(p.account_title || ''),
    projectId: projectId || undefined,
    projectName: request.projectName,
    costCenter: '',
    method: RECORD_METHOD[String(p.method)] || 'حواله ساتنا/پایا',
    referenceNumber: String(p.tracking || ''),
    description: `${request.requestNumber} - ${request.beneficiaryName}`,
    journalEntryId: entryNumber(p.entry),
    expenseIncurred: rial(route, p, 'amount'),
    payableRemaining: request.remainingAmount,
    status: p.method === 'cheque' ? 'چک در گردش' : 'پرداخت قطعی',
  }));
  return { request, payments: records };
}

const RECEIPT_SOURCE: Record<string, NonNullable<ReceiptRecord['sourceType']>> = { statement: 'صورت‌وضعیت کارفرما', advance: 'پیش‌پرداخت', other_income: 'سایر درآمدها', custom: 'سایر درآمدها' };
export const RECEIPT_TYPE_KEYS: Record<NonNullable<ReceiptRecord['sourceType']>, string> = { 'صورت‌وضعیت کارفرما': 'statement', 'پیش‌پرداخت': 'advance', 'سایر درآمدها': 'other_income' };
const RECEIPT_METHOD: Record<string, ReceiptRecord['method']> = { satna: 'حواله بانکی', paya: 'حواله بانکی', transfer: 'حواله بانکی', card: 'پوز بانکی', cash: 'نقد', cheque: 'چک صیادی' };

/** Receipt method of the app → server method; «تهاتر» is not a cash receipt. */
export function receiptMethodKey(method: ReceiptRecord['method']): string {
  switch (method) {
    case 'چک صیادی':
      return 'cheque';
    case 'نقد':
      return 'cash';
    case 'پوز بانکی':
      return 'card';
    case 'تهاتر':
      throw new ApiError(400, 'Barter receipt', 'تهاتر دریافت وجه نیست و از خزانه ثبت نمی‌شود؛ آن را با سند حسابداری دستی ثبت کنید.');
    default:
      return 'transfer';
  }
}

export function parseReceipt(raw: unknown, l: FinanceLookups): ReceiptRecord {
  const route = '/receipts';
  const o = obj(route, raw);
  const status = String(o.status);
  const projectId = idOrEmpty(o.project_id);
  const cheque = o.method === 'cheque';
  return {
    id: str(route, o, 'id'),
    docNumber: str(route, o, 'number', true),
    date: jdate(route, o, 'date'),
    amount: rial(route, o, 'amount'),
    counterpartyId: idOrEmpty(o.counterparty_id) || undefined,
    payer: str(route, o, 'payer_name', true),
    receiver: str(route, o, 'account_title', true),
    projectId: projectId || undefined,
    projectName: projectId ? projectName(l, projectId) : undefined,
    destinationAccount: str(route, o, 'account_title', true),
    method: RECEIPT_METHOD[String(o.method)] || 'حواله بانکی',
    trackingNumber: str(route, o, cheque ? 'cheque_number' : 'tracking', true),
    description: str(route, o, 'reject_reason', true) || str(route, o, 'description', true),
    journalEntryId: entryNumber(o.entry),
    status: status === 'rejected' ? 'برگشت خورده' : status === 'approved' && !cheque ? 'وصول شده' : 'در جریان وصول',
    sourceType: RECEIPT_SOURCE[String(o.receipt_type)] || 'سایر درآمدها',
    bankAccountId: str(route, o, 'account_id'),
    // 0.7.0: the statement (receivable) or client contract (advance) the receipt settles.
    statementId: idOrEmpty(o.statement_id) || undefined,
    contractId: idOrEmpty(o.contract_id) || undefined,
    pendingApproval: status === 'pending',
    version: version(route, o),
  };
}

export function parseCheque(raw: unknown, l: FinanceLookups): TreasuryCheck {
  const route = '/cheques';
  const o = obj(route, raw);
  const payable = o.direction === 'payable';
  const projectId = idOrEmpty(o.project_id);
  const status = String(o.status);
  const account = str(route, o, 'account_title', true);
  const party = str(route, o, 'party_name', true);
  return {
    id: str(route, o, 'id'),
    checkType: payable ? 'صادره (پرداختی)' : 'وارده (دریافتی)',
    sayadNumber: str(route, o, 'serial'),
    checkNumber: str(route, o, 'serial'),
    bankName: str(route, o, 'bank_name', true),
    branch: '',
    amount: rial(route, o, 'amount'),
    issueDate: jdate(route, o, 'issue_date'),
    dueDate: jdate(route, o, 'due_date'),
    drawer: payable ? account : party,
    payee: payable ? party : account,
    projectId: projectId || undefined,
    projectName: projectId ? projectName(l, projectId) : undefined,
    status: status === 'cleared' ? 'پاس شده و تسویه' : status === 'bounced' ? 'برگشت خورده' : 'در جریان وصول/سررسید',
    clearedDate: jdate(route, o, 'status_date', true) || undefined,
    version: version(route, o),
  };
}

export function parseStatementLine(raw: unknown): BankReconciliationItem {
  const route = '/treasury (statement lines)';
  const o = obj(route, raw);
  const status = String(o.status);
  return {
    id: str(route, o, 'id'),
    bankAccountId: str(route, o, 'account_id'),
    date: jdate(route, o, 'date'),
    description: str(route, o, 'description', true),
    amount: rial(route, o, 'amount'),
    type: o.direction === 'deposit' ? 'واریز' : 'برداشت',
    matched: status !== 'unmatched',
    matchedDocNumber: entryNumber(o.matched_entry) || entryNumber(o.voucher),
    discrepancyType: status === 'unmatched' ? 'تراکنش بانکی فاقد سند دفتری' : 'تطبیق شده',
    version: version(route, o),
  };
}

// ---------------------------------------------------------------------------- approvals

const APPROVAL_MODULES: ReadonlySet<string> = new Set([
  'journal_entry',
  'journal_reversal',
  'petty_adjustment',
  'bank_voucher',
  'petty_cash_expense',
  'petty_replenishment',
  'payment_request',
  'receipt',
  // 0.7.0
  'contract',
  'contract_amendment',
  'client_statement',
  'subcontractor_statement',
]);

function approvalAction(module: string, role: string, approval: boolean): UserAction {
  if (module === 'petty_cash_expense' || module === 'petty_replenishment') return PETTY_STEP_ACTION[role as PortalRole] ?? 'petty.approve_ceo';
  if (module === 'payment_request') return 'payment_request.approve';
  if (module === 'receipt') return 'receipt.record';
  if (module === 'contract' || module === 'contract_amendment') return 'contract.approve';
  if (module === 'client_statement') {
    if (!approval) return 'client_statement.prepare';
    return role === 'مدیر پروژه' ? 'client_statement.consultant_approval' : 'client_statement.employer_approval';
  }
  if (module === 'subcontractor_statement') {
    if (!approval) return 'sub_statement.measure';
    if (role === 'مدیر پروژه') return 'sub_statement.pm_approval';
    return role === 'حسابدار' ? 'sub_statement.finance_approval' : 'sub_statement.ceo_approval';
  }
  return 'journal.approve';
}

export function parseApproval(raw: unknown): ApprovalItem {
  const route = '/approvals';
  const o = obj(route, raw);
  const module = str(route, o, 'module');
  if (!APPROVAL_MODULES.has(module)) throw new ApiError(422, `Unknown approval module ${module}`, `نوع مورد کارتابل ناشناخته است: ${module}`);
  const projectId = idOrEmpty(o.project_id);
  const role = str(route, o, 'approver_role', true);
  return {
    id: str(route, o, 'id'),
    module: module as ApprovalItem['module'],
    moduleLabel: str(route, o, 'module_label'),
    recordId: str(route, o, 'record_id'),
    docNumber: str(route, o, 'doc_number', true),
    title: str(route, o, 'title', true),
    amount: rial(route, o, 'amount'),
    requester: str(route, o, 'requester', true),
    projectId,
    projectName: str(route, o, 'project_name', true) || (projectId ? '-' : 'ستاد مرکزی'),
    date: jdate(route, o, 'date'),
    stage: str(route, o, 'stage', true),
    approverRole: role,
    action: approvalAction(module, role, o.approval !== false),
    context: {
      projectId: projectId || null,
      createdBy: str(route, o, 'requester_id', true) || null,
      lastApprovedBy: idOrEmpty(o.previous_approver_id) || null,
      amount: rial(route, o, 'amount'),
    },
    classification: module === 'petty_cash_expense' || module === 'petty_replenishment' ? (projectId ? 'مستقیم پروژه' : 'سربار و ستادی') : 'مالی',
    documentCount: 0,
    server: {
      approvePath: str(route, o, 'approve_path').replace(/^\//, ''),
      rejectPath: str(route, o, 'reject_path').replace(/^\//, ''),
      version: version(route, o),
      requires: Array.isArray(o.requires) ? o.requires.filter((r): r is string => typeof r === 'string') : [],
    },
  };
}

export function parseApprovals(raw: unknown): ApprovalItem[] {
  return arr('/approvals', obj('/approvals', raw), 'items').map(parseApproval);
}
