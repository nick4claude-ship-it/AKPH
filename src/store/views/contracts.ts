/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * View models of the contracts module (client contracts, client statements, subcontracts).
 * Every figure the contract screens show is computed here; the screens only render it.
 */

import type {
  AdvancePaymentRecord,
  AppDocument,
  Contract,
  ContractBOQItem,
  DeductionItem,
  DetailedProgressStatement,
  PriceAdjustment,
  StatementBOQItem,
  StatementPayment,
  StatementType,
  StatementWorkflowStatus,
  SubcontractorContract,
  SubcontractorProgressStatement,
  SubcontractorStatementItem,
  SubcontractorStatementWorkflowStatus,
  UserProfile,
} from '../../types';
import type { AppState } from '../types';
import { dayIndex, selectStatementPayments, todayIndex } from '../domainSelectors';
import { CLIENT_STATEMENT_FLOW, SUBCONTRACTOR_STATEMENT_FLOW } from '../workflows';
import { statementContext } from '../approvalContext';
import { CLIENT_APPROVED_STATUSES } from '../state';
import { lineKey, selectSubcontractLines, subcontractRemainingAdvance } from '../subcontractLines';
import { checkPermission } from '../../utils/permissions';
import { formatInt, formatMoney, roundRial } from '../../utils/money';
import { toPersianDigits } from '../../utils/formatters';
import { generateUUID, nextDocNumber } from '../../utils/ids';
import { getRelativePersianDate } from '../../utils/date';
import { distinct, groupBy, percentOf, sumBy, sumFields } from './common';

// =============================================================================
// Documents linked to contracts
// =============================================================================

/** Contract-side view of a document-center record (the document itself lives only in the center). */
export interface ContractFile {
  id: string;
  contractId?: string;
  statementId?: string;
  fileName: string;
  fileType: string;
  version: string;
  uploadDate: string;
  uploaderName: string;
  fileSize: string;
  downloadUrl?: string;
}

export function toContractFile(d: AppDocument): ContractFile {
  return {
    id: d.id,
    contractId: d.links.find((l) => l.entityType === 'contract' || l.entityType === 'subcontract')?.entityId,
    statementId: d.links.find((l) => l.entityType === 'client_statement' || l.entityType === 'subcontractor_statement')?.entityId,
    fileName: d.fileName,
    fileType: d.type,
    version: d.version,
    uploadDate: d.date,
    uploaderName: d.registeredBy,
    fileSize: d.fileSize,
    downloadUrl: d.url,
  };
}

/** All documents linked to any client contract or client statement. */
export function selectContractFiles(state: AppState): ContractFile[] {
  return state.documents
    .filter((d) => d.links.some((l) => l.entityType === 'contract' || l.entityType === 'client_statement'))
    .map(toContractFile);
}

// =============================================================================
// Client contracts
// =============================================================================

/** Contract value ≠ executed ≠ billed ≠ received, each as a share of the current contract value. */
export interface ContractProgress {
  executedPercent: number;
  billedPercent: number;
  receivedPercent: number;
  /** 100 − executed. */
  remainingPercent: number;
  /** Received as a share of billed. */
  collectedOfBilledPercent: number;
  /** Stacked bar segments (received | billed not received | executed not billed). */
  billedNotReceivedPercent: number;
  executedNotBilledPercent: number;
}

export function contractProgress(c: Pick<Contract, 'currentValue' | 'executedValue' | 'billedValue' | 'receivedValue'>): ContractProgress {
  const executedPercent = percentOf(c.executedValue, c.currentValue);
  const billedPercent = percentOf(c.billedValue, c.currentValue);
  const receivedPercent = percentOf(c.receivedValue, c.currentValue);
  return {
    executedPercent,
    billedPercent,
    receivedPercent,
    remainingPercent: 100 - executedPercent,
    collectedOfBilledPercent: percentOf(c.receivedValue, c.billedValue),
    billedNotReceivedPercent: Math.max(0, billedPercent - receivedPercent),
    executedNotBilledPercent: Math.max(0, executedPercent - billedPercent),
  };
}

/** Statuses of a client statement that wait on the consultant or the employer. */
export const CLIENT_STATEMENT_PENDING_STATUSES: readonly StatementWorkflowStatus[] = [
  'submitted_to_consultant',
  'under_consultant_review',
  'submitted_to_employer',
];

const CLIENT_APPROVED: readonly string[] = CLIENT_APPROVED_STATUSES;

/** Approved statements whose receivable is still open (candidates for "overdue"). */
const CLIENT_STATEMENT_RECEIVABLE_STATUSES: readonly StatementWorkflowStatus[] = ['approved_by_employer', 'claimed', 'partially_paid'];

/** Contracts ending within this many days raise an alert. */
export const CONTRACT_END_ALERT_DAYS = 60;

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'neutral';

export interface ContractAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  value: string;
  description: string;
  /** Sub-tab of the contracts module that resolves the alert. */
  tab?: 'payments' | 'boq' | 'statements';
  actionLabel?: string;
}

export interface ClientContractsDashboard {
  contractCount: number;
  activeCount: number;
  provisionalHandoverCount: number;
  totals: {
    contractValue: number;
    initialValue: number;
    approvedChanges: number;
    executedValue: number;
    billedValue: number;
    approvedBilledValue: number;
    receivedValue: number;
    receivableValue: number;
    remainingWork: number;
    pendingAmount: number;
    overdueAmount: number;
  };
  percents: {
    changes: number;
    execution: number;
    billing: number;
    /** Received ÷ billed. */
    collection: number;
    /** Received ÷ contract value. */
    received: number;
    remaining: number;
  };
  pendingStatements: DetailedProgressStatement[];
  overdueStatements: DetailedProgressStatement[];
  alerts: ContractAlert[];
  rows: { contract: Contract; progress: ContractProgress }[];
  recentStatements: DetailedProgressStatement[];
}

export function selectClientContractsDashboard(
  state: AppState,
  contracts: Contract[] = state.contracts,
  statements: DetailedProgressStatement[] = state.clientStatements
): ClientContractsDashboard {
  const t = sumFields(contracts, ['currentValue', 'initialValue', 'approvedChangesValue', 'executedValue', 'billedValue', 'approvedBilledValue', 'receivedValue', 'receivableValue']);
  const pendingStatements = statements.filter((s) => CLIENT_STATEMENT_PENDING_STATUSES.includes(s.status));
  const pendingAmount = sumBy(pendingStatements, (s) => s.grossAmount);
  const today = todayIndex();
  const overdueStatements = statements.filter((s) => s.remainingPayable > 0 && CLIENT_STATEMENT_RECEIVABLE_STATUSES.includes(s.status) && dayIndex(s.dueDate) < today);
  const overdueAmount = sumBy(overdueStatements, (s) => s.remainingPayable);
  const contractIds = new Set(contracts.map((c) => c.id));
  const exceeded = state.contractBoq.filter((b) => contractIds.has(b.contractId) && b.cumulativeExecutedQuantity > b.initialQuantity);
  const endingSoon = contracts.filter((c) => {
    const left = dayIndex(c.endDate) - today;
    return c.status === 'فعال' && left >= 0 && left <= CONTRACT_END_ALERT_DAYS;
  });

  const alerts: ContractAlert[] = [
    ...(overdueStatements.length
      ? [{
          id: 'overdue',
          severity: 'critical' as const,
          title: `مطالبات سررسیدگذشته (${formatInt(overdueStatements.length)} صورت‌وضعیت)`,
          value: formatMoney(overdueAmount),
          description: overdueStatements.slice(0, 3).map((s) => `${s.statementNumber} — ${s.projectName}`).join('، '),
          tab: 'payments' as const,
          actionLabel: 'پیگیری وصول',
        }]
      : []),
    ...exceeded.slice(0, 3).map((b) => ({
      id: `boq-${b.id}`,
      severity: 'warning' as const,
      title: 'عبور کارکرد از مقدار پیمان',
      value: `+${formatInt(b.cumulativeExecutedQuantity - b.initialQuantity)} ${b.unit}`,
      description: `ردیف ${b.code} (${b.description}) نیاز به الحاقیه یا دستورکار دارد.`,
      tab: 'boq' as const,
      actionLabel: 'بررسی فهرست‌بها',
    })),
    ...(pendingStatements.length
      ? [{
          id: 'pending',
          severity: 'info' as const,
          title: `صورت‌وضعیت در انتظار مشاور/کارفرما (${formatInt(pendingStatements.length)})`,
          value: formatMoney(pendingAmount),
          description: pendingStatements.slice(0, 3).map((s) => s.statementNumber).join('، '),
          tab: 'statements' as const,
          actionLabel: 'مشاهده صورت‌وضعیت‌ها',
        }]
      : []),
    ...endingSoon.map((c) => ({
      id: `end-${c.id}`,
      severity: 'neutral' as const,
      title: 'نزدیک شدن به تاریخ خاتمه قرارداد',
      value: c.endDate,
      description: `${c.code} — ${c.projectTitle}`,
    })),
  ];

  const execution = percentOf(t.executedValue, t.currentValue);
  return {
    contractCount: contracts.length,
    activeCount: contracts.filter((c) => c.status === 'فعال' || c.status === 'تحویل موقت').length,
    provisionalHandoverCount: contracts.filter((c) => c.status === 'تحویل موقت').length,
    totals: {
      contractValue: t.currentValue,
      initialValue: t.initialValue,
      approvedChanges: t.approvedChangesValue,
      executedValue: t.executedValue,
      billedValue: t.billedValue,
      approvedBilledValue: t.approvedBilledValue,
      receivedValue: t.receivedValue,
      receivableValue: t.receivableValue,
      remainingWork: t.currentValue - t.executedValue,
      pendingAmount,
      overdueAmount,
    },
    percents: {
      changes: percentOf(t.approvedChangesValue, t.initialValue),
      execution,
      billing: percentOf(t.billedValue, t.currentValue),
      collection: percentOf(t.receivedValue, t.billedValue),
      received: percentOf(t.receivedValue, t.currentValue),
      remaining: 100 - execution,
    },
    pendingStatements,
    overdueStatements,
    alerts,
    rows: contracts.map((contract) => ({ contract, progress: contractProgress(contract) })),
    recentStatements: statements.slice(0, 4),
  };
}

/** Everything a contract's detail page lists, filtered to that contract. */
export function selectContractDetail(state: AppState, contract: Contract) {
  const auditLogs = state.contractAuditLogs;
  return {
    progress: contractProgress(contract),
    boq: state.contractBoq.filter((b) => b.contractId === contract.id),
    statements: state.clientStatements.filter((s) => s.contractId === contract.id),
    amendments: state.contractAmendments.filter((a) => a.contractId === contract.id),
    payments: selectStatementPayments(state).filter((p) => p.contractId === contract.id),
    documents: selectContractFiles(state).filter((d) => d.contractId === contract.id),
    auditLogs: auditLogs.filter((l) => l.contractId === contract.id),
  };
}

/** Totals of a list of client statements (list footers and KPI cards). */
export function sumClientStatements(statements: readonly DetailedProgressStatement[]) {
  const t = sumFields(statements, ['grossAmount', 'totalDeductions', 'netPayable', 'receivedAmount', 'remainingPayable']);
  return { gross: t.grossAmount, deductions: t.totalDeductions, net: t.netPayable, received: t.receivedAmount, remaining: t.remainingPayable };
}

/** Receivables of client statements by age (current, 1–30 days overdue, more than 30 days). */
export function selectClientReceivables(statements: readonly DetailedProgressStatement[], payments: readonly StatementPayment[]) {
  const unpaid = statements.filter((s) => s.remainingPayable > 0);
  const bucket = (rows: DetailedProgressStatement[]) => ({ statements: rows, amount: sumBy(rows, (s) => s.remainingPayable) });
  return {
    unpaid,
    totalReceivable: sumBy(unpaid, (s) => s.remainingPayable),
    current: bucket(unpaid.filter((s) => (s.overdueDays || 0) <= 0)),
    overdue30: bucket(unpaid.filter((s) => (s.overdueDays || 0) > 0 && (s.overdueDays || 0) <= 30)),
    overdueCritical: bucket(unpaid.filter((s) => (s.overdueDays || 0) > 30)),
    totalReceived: sumBy(payments, (p) => p.amount),
  };
}

/** Share of an advance already recovered through statement deductions. */
export function advanceAmortizedPercent(adv: Pick<AdvancePaymentRecord, 'totalAmortized' | 'totalAdvanceAmount'>): number {
  return percentOf(adv.totalAmortized, adv.totalAdvanceAmount);
}

/** Price adjustments: how many are approved (or already applied) and their total. */
export function summarizePriceAdjustments(adjustments: readonly PriceAdjustment[]) {
  const approved = adjustments.filter((a) => a.status === 'تأیید کارفرما' || a.status === 'اعمال شده در صورت‌وضعیت');
  return {
    approvedCount: approved.length,
    approvedPercent: percentOf(approved.length, adjustments.length),
    totalAmount: sumBy(adjustments, (a) => a.calculatedAdjustmentAmount),
  };
}

/** VAT rate that a stored statement was issued with (VAT ÷ the amount it was charged on). */
export function statementVatPercent(s: Pick<DetailedProgressStatement, 'vatAmount' | 'workAmountCurrent' | 'adjustmentAmount' | 'otherAllowableItemsAmount'>): number {
  return percentOf(s.vatAmount, s.workAmountCurrent + s.adjustmentAmount + s.otherAllowableItemsAmount);
}

/** Effect of an amendment amount on the initial contract value, in percent (2 decimals). */
export function amendmentChangePercent(contract: Pick<Contract, 'initialValue'>, amount: number): number {
  return Number(percentOf(amount, contract.initialValue).toFixed(2));
}

/** Suggested system code for a new client contract. */
export function suggestContractCode(state: AppState): string {
  return nextDocNumber(state.contracts.map((c) => c.code), 'CNT');
}

// =============================================================================
// Client statement form (preview while typing; the workflow recomputes on save)
// =============================================================================

export interface ClientStatementFormInput {
  contractId: string;
  statementNumber: string;
  statementType: StatementType;
  periodStartDate: string;
  periodEndDate: string;
  preparationDate: string;
  description: string;
  /** Quantity executed this period, by contract BOQ item id. */
  quantities: Record<string, number>;
  overrunClassifications: Record<string, StatementBOQItem['exceededClassification']>;
  /** Integer Rials. */
  otherAllowables: number;
  adjustmentAmount: number;
  includeVAT: boolean;
  /** Whole percentages. */
  advanceRate: number;
  retentionRate: number;
  insuranceRate: number;
  withholdingTaxRate: number;
  /** Integer Rials. */
  materialDeduction: number;
}

export interface ClientStatementDraft {
  contract?: Contract;
  items: Omit<StatementBOQItem, 'id'>[];
  hasAnyExceeded: boolean;
  vatRate: number;
  remainingAdvance: number;
  /** The advance rate asked for more than is left to recover; the deduction was capped. */
  advanceCapped: boolean;
  workAmountCurrent: number;
  baseBeforeVat: number;
  vatAmount: number;
  grossAmount: number;
  deductions: DeductionItem[];
  totalDeductions: number;
  netPayable: number;
  /** First problem that blocks saving, or null. */
  error: string | null;
}

/** Advance still to be recovered on a contract: advances paid minus advance deductions of live statements. */
export function remainingClientAdvance(state: AppState, contractId: string): number {
  const paid = sumBy(state.advancePayments.filter((a) => a.contractId === contractId), (a) => a.totalAdvanceAmount);
  const recovered = sumBy(
    state.clientStatements
      .filter((st) => st.contractId === contractId && st.status !== 'rejected' && st.status !== 'returned_for_correction')
      .flatMap((st) => st.deductions)
      .filter((d) => d.type === 'advance_payment'),
    (d) => d.calculatedAmount
  );
  return Math.max(0, paid - recovered);
}

/** Initial values of the statement form for a contract (the number follows the statements already issued). */
export function clientStatementFormDefaults(state: AppState, contractId: string): ClientStatementFormInput {
  const contract = state.contracts.find((c) => c.id === contractId);
  const issued = state.clientStatements.filter((s) => s.contractId === contractId).length;
  return {
    contractId,
    statementNumber: `صورت‌وضعیت موقت شماره ${toPersianDigits(issued + 1)}`,
    statementType: 'موقت',
    periodStartDate: getRelativePersianDate(-30),
    periodEndDate: getRelativePersianDate(0),
    preparationDate: getRelativePersianDate(0),
    description: '',
    quantities: {},
    overrunClassifications: {},
    otherAllowables: 0,
    adjustmentAmount: 0,
    includeVAT: true,
    advanceRate: contract?.advancePaymentPercentage || 0,
    retentionRate: contract?.retentionPercentage || 0,
    insuranceRate: 5,
    withholdingTaxRate: 0,
    materialDeduction: 0,
  };
}

/** Statement amounts from the form: BOQ lines, VAT on the pre-tax base, deductions on the pre-tax base. */
export function computeClientStatementDraft(state: AppState, form: ClientStatementFormInput): ClientStatementDraft {
  const contract = state.contracts.find((c) => c.id === form.contractId);
  const boq = contract ? state.contractBoq.filter((b) => b.contractId === contract.id) : [];
  const vatRate = state.financeSettings.vatRatePercent;
  const remainingAdvance = contract ? remainingClientAdvance(state, contract.id) : 0;

  const items = boq.map((b: ContractBOQItem) => {
    const currentQty = form.quantities[b.id] || 0;
    const prevQty = b.cumulativeExecutedQuantity;
    const cumulativeQty = prevQty + currentQty;
    const isExceeded = cumulativeQty > b.initialQuantity;
    return {
      boqItemId: b.id,
      rowNumber: b.rowNumber,
      code: b.code,
      description: b.description,
      unit: b.unit,
      contractQuantity: b.initialQuantity,
      previousQuantity: prevQty,
      currentQuantity: currentQty,
      cumulativeQuantity: cumulativeQty,
      unitRate: b.unitRate,
      currentAmount: roundRial(currentQty * b.unitRate),
      cumulativeAmount: roundRial(cumulativeQty * b.unitRate),
      isExceeded,
      exceededQuantity: isExceeded ? cumulativeQty - b.initialQuantity : 0,
      exceededClassification: isExceeded ? form.overrunClassifications[b.id] || 'تغییر مقادیر' : undefined,
      inventoryMaterialCode: b.inventoryMaterialCode,
    };
  });

  const workAmountCurrent = sumBy(items, (i) => i.currentAmount);
  // Deductions are computed on the work amount before VAT (VAT is paid in full by the employer).
  const baseBeforeVat = workAmountCurrent + form.otherAllowables + form.adjustmentAmount;
  const vatAmount = form.includeVAT ? roundRial((baseBeforeVat * vatRate) / 100) : 0;
  const grossAmount = baseBeforeVat + vatAmount;
  const pct = (rate: number) => roundRial((baseBeforeVat * rate) / 100);
  const advanceByRate = pct(form.advanceRate);

  const deductions = (
    [
      // Advance recovery never exceeds what is still unrecovered on the contract.
      { id: 'ded-adv', title: `استرداد پیش‌پرداخت (${form.advanceRate}٪)`, type: 'advance_payment', mode: 'percentage', rate: form.advanceRate, baseAmount: baseBeforeVat, calculatedAmount: Math.min(advanceByRate, remainingAdvance) },
      { id: 'ded-ret', title: `سپرده حسن انجام کار (${form.retentionRate}٪)`, type: 'retention', mode: 'percentage', rate: form.retentionRate, baseAmount: baseBeforeVat, calculatedAmount: pct(form.retentionRate) },
      { id: 'ded-ins', title: `حق بیمه تأمین اجتماعی (${form.insuranceRate}٪)`, type: 'insurance', mode: 'percentage', rate: form.insuranceRate, baseAmount: baseBeforeVat, calculatedAmount: pct(form.insuranceRate) },
      // Withholding tax the employer deducts from the statement (booked as a prepaid tax asset, 11305).
      { id: 'ded-tax', title: `مالیات تکلیفی مکسوره کارفرما (${form.withholdingTaxRate}٪)`, type: 'tax', mode: 'percentage', rate: form.withholdingTaxRate, baseAmount: baseBeforeVat, calculatedAmount: pct(form.withholdingTaxRate) },
      { id: 'ded-mat', title: 'کسورات مصالح و آب و برق کارگاهی کارفرما', type: 'materials', mode: 'fixed', rate: 0, baseAmount: baseBeforeVat, calculatedAmount: form.materialDeduction },
    ] as DeductionItem[]
  ).filter((d) => d.calculatedAmount > 0);
  const totalDeductions = sumBy(deductions, (d) => d.calculatedAmount);

  let error: string | null = null;
  if (!contract) error = 'قرارداد را انتخاب کنید.';
  else if (!contract.costCenterId || !contract.counterpartyId) error = 'مرکز هزینه یا کارفرمای این قرارداد تعریف نشده است؛ ابتدا قرارداد را تکمیل کنید.';
  else if (baseBeforeVat <= 0) error = 'کارکرد این دوره صفر است؛ مقدار حداقل یک ردیف را وارد کنید.';
  else if ([form.advanceRate, form.retentionRate, form.insuranceRate, form.withholdingTaxRate].some((r) => r > 100)) error = 'درصد کسورات نمی‌تواند بیش از ۱۰۰ باشد.';
  else if (totalDeductions > grossAmount) error = 'جمع کسورات از مبلغ ناخالص بیشتر است.';

  return {
    contract,
    items,
    hasAnyExceeded: items.some((i) => i.isExceeded),
    vatRate,
    remainingAdvance,
    advanceCapped: advanceByRate > remainingAdvance,
    workAmountCurrent,
    baseBeforeVat,
    vatAmount,
    grossAmount,
    deductions,
    totalDeductions,
    netPayable: Math.max(0, grossAmount - totalDeductions),
    error,
  };
}

// =============================================================================
// Approval steps (what the signed-in user may do next)
// =============================================================================

export interface NextStep<S extends string> {
  /** Label of the step, e.g. «تأیید مشاور». */
  label: string;
  /** Portal role that normally performs it. */
  role: string;
  next: S;
  allowed: boolean;
  /** Why the signed-in user may not perform it (role, project, own document). */
  reason?: string;
}

export interface ClientStatementActions {
  advance?: NextStep<StatementWorkflowStatus>;
  /** The statement is still in its approval flow and the user may send it back with a reason. */
  canReturn: boolean;
  /** Approved and not fully received: the receipt is recorded in treasury. */
  canCollect: boolean;
  /** The receivable document issued on employer approval, if any. */
  accountingDocNumber?: string;
  /** Approved by the employer: the receivable is (or will be) in the books. */
  employerApproved: boolean;
}

export function clientStatementActions(user: UserProfile, s: DetailedProgressStatement): ClientStatementActions {
  const step = CLIENT_STATEMENT_FLOW[s.status];
  const permission = step ? checkPermission(user, step.action, statementContext(s)) : null;
  return {
    advance: step && permission ? { label: step.label, role: step.role, next: step.next, allowed: permission.ok, reason: permission.reason } : undefined,
    canReturn: !!step && checkPermission(user, 'client_statement.return', { projectId: s.projectId }).ok,
    canCollect: CLIENT_APPROVED.includes(s.status) && s.remainingPayable > 0,
    accountingDocNumber: s.accountingJournalEntryId,
    employerApproved: s.status === 'approved_by_employer',
  };
}

// =============================================================================
// Subcontracts
// =============================================================================

export interface SubcontractProgress {
  executedPercent: number;
  /** Approved statements ÷ contract value. */
  approvedPercent: number;
  /** Paid ÷ approved statements. */
  settledPercent: number;
  remainingPercent: number;
  /** Stacked bar (paid | approved not paid | executed not approved), as shares of the contract value. */
  paidOfContractPercent: number;
  unpaidApprovedPercent: number;
  unapprovedExecutedPercent: number;
}

export function subcontractProgress(c: SubcontractorContract): SubcontractProgress {
  const executedNotApproved = c.executedValue - c.approvedStatementsValue;
  return {
    executedPercent: percentOf(c.executedValue, c.contractValue),
    approvedPercent: percentOf(c.approvedStatementsValue, c.contractValue),
    settledPercent: percentOf(c.paidValue, c.approvedStatementsValue),
    remainingPercent: percentOf(c.remainingContractValue, c.contractValue),
    paidOfContractPercent: percentOf(c.paidValue, c.contractValue),
    unpaidApprovedPercent: percentOf(c.remainingPayableValue, c.contractValue),
    unapprovedExecutedPercent: executedNotApproved > 0 ? percentOf(executedNotApproved, c.contractValue) : 0,
  };
}

export function sumSubcontracts(contracts: readonly SubcontractorContract[]) {
  const t = sumFields(contracts, ['contractValue', 'executedValue', 'approvedStatementsValue', 'paidValue', 'remainingPayableValue']);
  return {
    contractValue: t.contractValue,
    executed: t.executedValue,
    approved: t.approvedStatementsValue,
    paid: t.paidValue,
    debt: t.remainingPayableValue,
    remainingCapacity: t.contractValue - t.executedValue,
    executedPercent: percentOf(t.executedValue, t.contractValue),
    settledPercent: percentOf(t.paidValue, t.approvedStatementsValue),
    debtOfApprovedPercent: percentOf(t.remainingPayableValue, t.approvedStatementsValue),
    remainingCapacityPercent: percentOf(t.contractValue - t.executedValue, t.contractValue),
  };
}

export function sumSubcontractorStatements(statements: readonly SubcontractorProgressStatement[]) {
  const t = sumFields(statements, ['grossAmount', 'siteVerifiedAmount', 'totalDeductions', 'netPayable', 'paidAmount', 'remainingPayable']);
  return {
    gross: t.grossAmount,
    siteVerified: t.siteVerifiedAmount,
    deductions: t.totalDeductions,
    net: t.netPayable,
    paid: t.paidAmount,
    remaining: t.remainingPayable,
    acceptedPercent: percentOf(t.siteVerifiedAmount, t.grossAmount),
    settledPercent: percentOf(t.paidAmount, t.netPayable),
  };
}

/** Subcontractor statement stages (queues of the approval board). */
export const SUB_STAGE_STATUSES = {
  site: ['submitted', 'measured'] as SubcontractorStatementWorkflowStatus[],
  pm: ['site_review'] as SubcontractorStatementWorkflowStatus[],
  management: ['pm_approved', 'finance_approved'] as SubcontractorStatementWorkflowStatus[],
};

export function subcontractorQueues(statements: readonly SubcontractorProgressStatement[]) {
  return {
    site: statements.filter((s) => SUB_STAGE_STATUSES.site.includes(s.status)),
    pm: statements.filter((s) => SUB_STAGE_STATUSES.pm.includes(s.status)),
    management: statements.filter((s) => SUB_STAGE_STATUSES.management.includes(s.status)),
    /** Approved by management and still owed: to be paid in treasury. */
    payment: statements.filter((s) => s.status === 'management_approved' && s.remainingPayable > 0),
    paid: statements.filter((s) => s.status === 'paid'),
  };
}

/** Badge counts of the subcontract tabs. */
export function subcontractorCounts(statements: readonly SubcontractorProgressStatement[]) {
  return {
    pendingApprovals: statements.filter((s) => s.status === 'submitted' || s.status === 'site_review' || s.status === 'pm_approved').length,
    urgentPayments: statements.filter((s) => s.status === 'management_approved' && s.remainingPayable > 0).length,
  };
}

export function selectSubcontractorDashboard(contracts: readonly SubcontractorContract[], statements: readonly SubcontractorProgressStatement[]) {
  const bucket = (rows: SubcontractorProgressStatement[], pick: (s: SubcontractorProgressStatement) => number) => ({ count: rows.length, amount: sumBy(rows, pick) });
  const pendingSite = statements.filter((s) => s.status === 'submitted' || s.status === 'measured' || s.status === 'site_review');
  const pendingManagement = statements.filter((s) => s.status === 'pm_approved' || s.status === 'finance_approved');
  const approvedUnpaid = statements.filter((s) => s.status === 'management_approved' && s.remainingPayable > 0);
  const paid = statements.filter((s) => s.status === 'paid' || s.paidAmount > 0);
  return {
    statementCount: statements.length,
    statementsGross: sumBy(statements, (s) => s.grossAmount),
    pendingSite: bucket(pendingSite, (s) => s.netPayable),
    pendingManagement: bucket(pendingManagement, (s) => s.netPayable),
    approvedUnpaid: bucket(approvedUnpaid, (s) => s.remainingPayable),
    paid: { count: paid.length, amount: sumBy(statements, (s) => s.paidAmount) },
    totals: sumSubcontracts(contracts),
    /** Open statements (not yet paid), for the "action required" list. */
    open: statements.filter((s) => s.status !== 'paid'),
    tradeTypes: distinct(contracts, (c) => c.tradeType),
  };
}

/** Subcontracts grouped by project with per-project totals (project × subcontractor matrix). */
export function subcontractMatrix(contracts: readonly SubcontractorContract[]) {
  return groupBy(contracts, (c) => c.projectId).map((g) => ({
    projectId: g.key,
    projectName: g.rows[0].projectName,
    contracts: g.rows.map((contract) => ({ contract, progress: subcontractProgress(contract) })),
    totals: sumSubcontracts(g.rows),
  }));
}

/** Stage index of a subcontractor statement on the 7-step bar (0-based; paid is past the last step). */
export function subcontractorStatementStep(status: SubcontractorStatementWorkflowStatus): number {
  const order: Partial<Record<SubcontractorStatementWorkflowStatus, number>> = {
    submitted: 0,
    measured: 1,
    site_review: 2,
    pm_approved: 3,
    finance_approved: 4,
    management_approved: 5,
    paid: 7,
  };
  return order[status] ?? 0;
}

export const SUBCONTRACTOR_STATEMENT_STEPS = [
  { title: '۱. کارکرد', desc: 'پیمانکار جزء' },
  { title: '۲. اندازه‌گیری', desc: 'مدیر پروژه' },
  { title: '۳. تأیید کارگاه', desc: 'مدیر پروژه' },
  { title: '۴. تأیید مدیر پروژه', desc: 'مدیر پروژه' },
  { title: '۵. تأیید مالی', desc: 'حسابدار' },
  { title: '۶. تأیید مدیر ارشد', desc: 'ثبت بدهی و درخواست پرداخت' },
  { title: '۷. پرداخت', desc: 'فقط در خزانه' },
] as const;

/** Title of the step a statement is at (the last step once paid). */
export function subcontractorActiveStepTitle(status: SubcontractorStatementWorkflowStatus): string {
  const i = subcontractorStatementStep(status);
  return SUBCONTRACTOR_STATEMENT_STEPS[Math.min(i, SUBCONTRACTOR_STATEMENT_STEPS.length - 1)].title;
}

export interface SubcontractorStatementActions {
  advance?: NextStep<SubcontractorStatementWorkflowStatus>;
  canReturn: boolean;
  /** Approved by management with money still owed: payment is made in treasury. */
  awaitingPayment: boolean;
}

export function subcontractorStatementActions(user: UserProfile, s: SubcontractorProgressStatement): SubcontractorStatementActions {
  const step = SUBCONTRACTOR_STATEMENT_FLOW[s.status];
  const permission = step ? checkPermission(user, step.action, statementContext(s)) : null;
  return {
    advance: step && permission ? { label: step.label, role: step.role, next: step.next, allowed: permission.ok, reason: permission.reason || (permission.ok ? undefined : 'مرحله تأیید باز نیست.') } : undefined,
    canReturn: !!step && checkPermission(user, 'sub_statement.return', { projectId: s.projectId }).ok,
    awaitingPayment: s.status === 'management_approved' && s.remainingPayable > 0,
  };
}

/** Suggested number of a new subcontract. */
export function suggestSubcontractNumber(state: AppState): string {
  return nextDocNumber(state.subcontractorContracts.map((c) => c.contractNumber), 'SUB');
}

// ---------------- Subcontractor statement form ----------------

export interface SubcontractorStatementLineInput {
  id: string;
  /** Lines of the contract (from approved history) cannot be renamed. */
  locked: boolean;
  description: string;
  unit: string;
  contractQuantity: number;
  unitRate: number;
  previousQuantity: number;
  pendingQuantity: number;
  currentQuantity: number;
}

export interface SubcontractorStatementFormInput {
  contractId: string;
  statementNumber: string;
  periodStartDate: string;
  periodEndDate: string;
  lines: SubcontractorStatementLineInput[];
  retentionRate: number;
  advanceDeduction: number;
  penaltyAmount: number;
  otherDeduction: number;
}

/** Contract lines with quantities already approved or pending, ready to be filled for this period. */
export function subcontractorStatementLines(state: AppState, contractId: string): SubcontractorStatementLineInput[] {
  return selectSubcontractLines(state, contractId).map((l) => ({
    id: generateUUID(),
    locked: true,
    description: l.description,
    unit: l.unit,
    contractQuantity: l.contractQuantity,
    unitRate: l.unitRate,
    previousQuantity: l.approvedQuantity,
    pendingQuantity: l.pendingQuantity,
    currentQuantity: 0,
  }));
}

/** An empty line for work that is not in the contract lines yet. */
export function blankSubcontractorLine(): SubcontractorStatementLineInput {
  return { id: generateUUID(), locked: false, description: '', unit: '', contractQuantity: 0, unitRate: 0, previousQuantity: 0, pendingQuantity: 0, currentQuantity: 0 };
}

export function suggestSubcontractorStatementNumber(state: AppState, contractId: string): string {
  const issued = state.subcontractorStatements.filter((s) => s.subcontractorContractId === contractId).length;
  return `صورت‌وضعیت شماره ${toPersianDigits(issued + 1)}`;
}

/** Quantity problem of one line (previous + pending + this period above the contract quantity). */
export function subcontractorLineError(l: SubcontractorStatementLineInput): string | null {
  const committed = l.previousQuantity + l.pendingQuantity + l.currentQuantity;
  return committed > l.contractQuantity ? `جمع مقدار (${formatInt(committed)}) از مقدار قرارداد بیشتر است` : null;
}

export function computeSubcontractorStatementDraft(state: AppState, form: SubcontractorStatementFormInput) {
  const items: SubcontractorStatementItem[] = form.lines
    .filter((l) => l.currentQuantity > 0)
    .map((l) => {
      const cumulativeQuantity = l.previousQuantity + l.currentQuantity;
      return {
        id: l.id,
        description: l.description.trim(),
        unit: l.unit.trim(),
        contractQuantity: l.contractQuantity,
        previousQuantity: l.previousQuantity,
        currentQuantity: l.currentQuantity,
        cumulativeQuantity,
        unitRate: l.unitRate,
        currentAmount: roundRial(l.currentQuantity * l.unitRate),
        cumulativeAmount: roundRial(cumulativeQuantity * l.unitRate),
      };
    });
  const grossAmount = sumBy(items, (i) => i.currentAmount);
  const retentionAmount = roundRial((grossAmount * form.retentionRate) / 100);
  const totalDeductions = retentionAmount + form.advanceDeduction + form.penaltyAmount + form.otherDeduction;

  let error: string | null = null;
  if (!items.length) error = 'مقدار این دوره حداقل یک ردیف را وارد کنید.';
  else if (form.lines.some((l) => l.currentQuantity > 0 && (!l.description.trim() || !l.unit.trim() || l.contractQuantity <= 0 || l.unitRate <= 0))) {
    error = 'برای ردیف‌های جدید شرح، واحد، مقدار قرارداد و نرخ الزامی است.';
  } else {
    const keys = items.map((i) => lineKey(i.description, i.unit));
    if (new Set(keys).size !== keys.length) error = 'ردیف تکراری وجود دارد.';
  }

  return {
    items,
    /** Amount of this period for every line of the form (zero-quantity lines included), by line id. */
    lineAmounts: Object.fromEntries(form.lines.map((l) => [l.id, roundRial(l.currentQuantity * l.unitRate)])) as Record<string, number>,
    grossAmount,
    retentionAmount,
    totalDeductions,
    netPayable: Math.max(0, grossAmount - totalDeductions),
    remainingAdvance: subcontractRemainingAdvance(state, form.contractId),
    error,
  };
}

/** Advance deduction typed in the form, limited to what is left to recover on the contract. */
export function capAdvanceDeduction(value: number, remainingAdvance: number): number {
  return Math.min(value, remainingAdvance);
}

/** Retention deposit of a new subcontract. */
export function subcontractRetentionDeposit(contractValue: number, ratePercent: number): number {
  return roundRial(contractValue * (ratePercent / 100));
}

// =============================================================================
// Statement flow bars (the steps of the architecture document)
// =============================================================================

export const CLIENT_FLOW_STEPS = ['اندازه‌گیری', 'صورت‌وضعیت', 'تأیید مشاور', 'تأیید کارفرما', 'مطالبات', 'دریافت'];
export const SUB_FLOW_STEPS = ['کارکرد', 'اندازه‌گیری', 'تأیید کارگاه', 'تأیید مدیر پروژه', 'تأیید مالی', 'تأیید مدیر ارشد', 'بدهی', 'پرداخت'];

/** Step of CLIENT_FLOW_STEPS a client statement is at. */
export function clientFlowIndex(status: StatementWorkflowStatus, remaining: number): number {
  switch (status) {
    case 'draft':
    case 'returned_for_correction':
      return 0;
    case 'prepared':
    case 'internal_review':
      return 1;
    case 'submitted_to_consultant':
    case 'under_consultant_review':
      return 2;
    case 'approved_by_consultant':
    case 'submitted_to_employer':
      return 3;
    case 'approved_by_employer':
    case 'claimed':
      return 4;
    case 'partially_paid':
      return 5;
    case 'paid':
      return remaining > 0 ? 5 : 6;
    default:
      return 0;
  }
}

/** Step of SUB_FLOW_STEPS a subcontractor statement is at. */
export function subFlowIndex(status: SubcontractorStatementWorkflowStatus, remaining: number): number {
  const order: SubcontractorStatementWorkflowStatus[] = ['submitted', 'measured', 'site_review', 'pm_approved', 'finance_approved', 'management_approved'];
  if (status === 'paid') return remaining > 0 ? 7 : 8;
  if (status === 'management_approved') return 7;
  const i = order.indexOf(status);
  return i < 0 ? 0 : i + 1;
}

/** Receivable of approved client statements and payable of approved subcontractor statements. */
export function statementBalances(state: AppState) {
  const approvedClient = state.clientStatements.filter((s) => CLIENT_APPROVED.includes(s.status));
  const approvedSub = state.subcontractorStatements.filter(isSubStatementApproved);
  return {
    receivable: sumBy(approvedClient, (s) => s.remainingPayable),
    payable: sumBy(approvedSub, (s) => s.remainingPayable),
    approvedClientCount: approvedClient.length,
    approvedSubCount: approvedSub.length,
  };
}

const isSubStatementApproved = (s: Pick<SubcontractorProgressStatement, 'status'>) => s.status === 'management_approved' || s.status === 'paid';

/** Where a client statement stands in the list: approved (its balance counts) and the next step, if any. */
export function clientStatementStage(s: Pick<DetailedProgressStatement, 'status'>) {
  return { approved: CLIENT_APPROVED.includes(s.status), nextLabel: CLIENT_STATEMENT_FLOW[s.status]?.label };
}

/** Where a subcontractor statement stands in the list: approved (its balance counts) and the next step, if any. */
export function subcontractorStatementStage(s: Pick<SubcontractorProgressStatement, 'status'>) {
  const step = SUBCONTRACTOR_STATEMENT_FLOW[s.status];
  return { approved: isSubStatementApproved(s), nextLabel: step?.label, nextRole: step?.role };
}
