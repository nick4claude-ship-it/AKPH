/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState } from './types';
import {
  ApprovalItem,
  AppDocument,
  DocumentEntityType,
  ManagementAlert,
  MaterialItem,
  Warehouse,
  PettyCashAccount,
  StatementPayment,
  PaymentRequest,
  Counterparty,
  AccountsReceivableItem,
  AccountsPayableItem,
} from '../types';
import { postedEntries } from './selectors';
import {
  CLIENT_STATEMENT_FLOW,
  CLIENT_STATEMENT_APPROVAL_STATUSES,
  SUBCONTRACTOR_STATEMENT_FLOW,
  nextRequisitionStep,
} from './workflows';
import {
  journalContext,
  paymentApprovalContext,
  payrollContext,
  pettyContext,
  requisitionContext,
  statementContext,
  vendorInvoiceContext,
} from './approvalContext';
import { PETTY_STEP_ACTION } from '../utils/permissions';
import { CLIENT_APPROVED_STATUSES, VENDOR_INVOICE_APPROVED_STATUSES } from './state';
import { dayIndex, toPersianDate } from '../utils/date';
import { formatInt, formatMoney } from '../utils/money';

const fa = (n: number) => formatInt(n);
export { dayIndex };
export const todayIndex = () => dayIndex(toPersianDate(new Date()));

// =============================================================================
// Documents
// =============================================================================

export function selectDocumentsFor(state: AppState, entityType: DocumentEntityType, entityId: string): AppDocument[] {
  return state.documents.filter((d) => d.links.some((l) => l.entityType === entityType && l.entityId === entityId));
}

export function documentCount(state: AppState, entityType: DocumentEntityType, entityId: string): number {
  return selectDocumentsFor(state, entityType, entityId).length;
}

// =============================================================================
// Inventory (stock per warehouse is the only stock record)
// =============================================================================

export function selectMaterials(state: AppState): MaterialItem[] {
  const totals = new Map<string, number>();
  for (const b of state.stockBalances) totals.set(b.materialId, (totals.get(b.materialId) || 0) + b.qty);
  return state.materials.map((m) => {
    const currentStock = totals.get(m.id) || 0;
    return { ...m, currentStock, totalStockValue: Math.round(currentStock * m.averageUnitPrice) };
  });
}

export function selectWarehouses(state: AppState): Warehouse[] {
  const price = new Map(state.materials.map((m) => [m.id, m.averageUnitPrice]));
  return state.warehouses.map((w) => {
    const rows = state.stockBalances.filter((b) => b.warehouseId === w.id && b.qty > 0);
    return {
      ...w,
      itemsCount: rows.length,
      totalValuation: Math.round(rows.reduce((a, b) => a + b.qty * (price.get(b.materialId) || 0), 0)),
    };
  });
}

/** Stock of one warehouse: quantity, reserved, free, and value at the weighted average price. */
export function selectStockByWarehouse(state: AppState, warehouseId: string) {
  return state.stockBalances
    .filter((b) => b.warehouseId === warehouseId)
    .map((b) => ({ ...b, material: state.materials.find((m) => m.id === b.materialId) }))
    .filter((b): b is typeof b & { material: MaterialItem } => !!b.material)
    .map((b) => ({ ...b, freeQty: b.qty - b.reservedQty, value: Math.round(b.qty * b.material.averageUnitPrice) }));
}

/** Stock reservations of store issue requests not yet confirmed or released. */
export function selectActiveReservationCount(state: AppState): number {
  return state.stockReservations.filter((r) => r.status === 'active').length;
}

// =============================================================================
// Petty cash (limits come from stored settings)
// =============================================================================

export function selectPettyFunds(state: AppState): PettyCashAccount[] {
  return state.pettyCashAccounts.map((a) => {
    const limits = state.pettyCashSettings.fundLimits[a.fundType];
    return limits ? { ...a, ceilingLimit: limits.ceiling, minBalanceWarning: limits.minBalanceWarning } : a;
  });
}

// =============================================================================
// Receipts viewed from the contract side
// =============================================================================

export function selectStatementPayments(state: AppState): StatementPayment[] {
  return state.receipts
    .filter((r) => r.statementId)
    .map((r) => {
      const st = state.clientStatements.find((s) => s.id === r.statementId);
      return {
        id: r.id,
        statementId: r.statementId!,
        statementNumber: st?.statementNumber || '-',
        contractId: r.contractId || st?.contractId || '',
        date: r.date,
        amount: r.amount,
        method: r.method === 'چک صیادی' ? 'چک صیادی' : r.method === 'تهاتر' ? 'تهاتر ملک/زمین' : 'حواله ساتنا/پایا',
        referenceNumber: r.trackingNumber,
        payerAccount: r.payer,
        destinationBank: r.destinationAccount,
        notes: r.description,
        journalEntryId: r.journalEntryId,
      };
    });
}

// =============================================================================
// Approval center: everything waiting, gathered from the owning modules
// =============================================================================

export function selectApprovals(state: AppState): ApprovalItem[] {
  const items: ApprovalItem[] = [];
  const projectName = (id?: string) => state.projects.find((p) => p.id === id)?.name || '-';
  const ccName = (id?: string) => state.costCenters.find((c) => c.id === id)?.name;
  const partyName = (id?: string) => state.counterparties.find((c) => c.id === id)?.name;

  for (const s of state.clientStatements) {
    if (!CLIENT_STATEMENT_APPROVAL_STATUSES.includes(s.status)) continue;
    const step = CLIENT_STATEMENT_FLOW[s.status]!;
    items.push({
      id: `client_statement:${s.id}`, module: 'client_statement', moduleLabel: 'صورت‌وضعیت کارفرما', recordId: s.id,
      docNumber: s.statementNumber, title: s.description || s.statementNumber, amount: s.netPayable,
      requester: s.preparerName, projectId: s.projectId, projectName: s.projectName, costCenterName: ccName(s.costCenterId),
      counterpartyName: s.client, date: s.preparationDate, stage: step.label, approverRole: step.role,
      action: step.action, context: statementContext(s),
      classification: 'مالی', documentCount: documentCount(state, 'client_statement', s.id),
    });
  }

  for (const s of state.subcontractorStatements) {
    const step = SUBCONTRACTOR_STATEMENT_FLOW[s.status];
    if (!step || s.status === 'returned_for_revision') continue;
    items.push({
      id: `subcontractor_statement:${s.id}`, module: 'subcontractor_statement', moduleLabel: 'صورت‌وضعیت پیمانکار جزء', recordId: s.id,
      docNumber: s.statementNumber, title: `${s.tradeType} - ${s.subcontractorName}`, amount: s.netPayable,
      requester: s.subcontractorName, projectId: s.projectId, projectName: s.projectName, costCenterName: ccName(s.costCenterId),
      counterpartyName: s.subcontractorName, date: s.submissionDate, stage: step.label, approverRole: step.role,
      action: step.action, context: statementContext(s),
      classification: 'مستقیم پروژه', documentCount: documentCount(state, 'subcontractor_statement', s.id),
    });
  }

  for (const e of state.pettyCashExpenses) {
    if (e.status !== 'pending_approval' && e.status !== 'submitted') continue;
    items.push({
      id: `petty_cash_expense:${e.id}`, module: 'petty_cash_expense', moduleLabel: 'هزینه تنخواه', recordId: e.id,
      docNumber: e.expenseNumber, title: e.description, amount: e.amount, requester: e.submitterName,
      projectId: e.projectId, projectName: e.projectName, costCenterName: ccName(e.costCenterId) || e.costCenter,
      counterpartyName: e.vendor, date: e.date, stage: `تأیید ${e.currentApprovalStep}`, approverRole: e.currentApprovalStep,
      action: PETTY_STEP_ACTION[e.currentApprovalStep as keyof typeof PETTY_STEP_ACTION] ?? 'petty.approve_ceo', context: pettyContext(e),
      classification: e.projectId ? 'مستقیم پروژه' : 'سربار و ستادی', documentCount: documentCount(state, 'petty_cash_expense', e.id),
    });
  }

  for (const inv of state.vendorInvoices) {
    if (inv.status !== 'در حال تطبیق') continue;
    items.push({
      id: `vendor_invoice:${inv.id}`, module: 'vendor_invoice', moduleLabel: 'فاکتور خرید', recordId: inv.id,
      docNumber: inv.invoiceNumber, title: `فاکتور ${inv.supplierName} - سفارش ${inv.poNumber}`, amount: inv.totalAmount,
      requester: 'واحد تدارکات', projectId: inv.projectId, projectName: inv.projectName, costCenterName: ccName(inv.costCenterId),
      counterpartyName: inv.supplierName, date: inv.invoiceDate, stage: 'تطبیق سه‌جانبه و تأیید مالی', approverRole: 'حسابدار',
      action: 'vendor_invoice.approve', context: vendorInvoiceContext(inv),
      classification: 'مالی', documentCount: documentCount(state, 'vendor_invoice', inv.id),
    });
  }

  for (const r of state.purchaseRequisitions) {
    const step = nextRequisitionStep(r);
    if (!step) continue;
    items.push({
      id: `purchase_requisition:${r.id}`, module: 'purchase_requisition', moduleLabel: 'درخواست خرید', recordId: r.id,
      docNumber: r.requisitionNumber, title: r.justification || r.items.map((i) => i.materialName).join('، '), amount: r.totalEstimatedAmount,
      requester: r.requesterName, projectId: r.projectId, projectName: r.projectName, costCenterName: ccName(r.costCenterId) || r.costCenter,
      date: r.date, stage: step.label, approverRole: step.role, action: step.action, context: requisitionContext(r),
      classification: 'مستقیم پروژه', documentCount: 0,
    });
  }

  for (const p of state.paymentRequests) {
    if (p.status !== 'در انتظار تأیید مالی') continue;
    items.push({
      id: `payment_request:${p.id}`, module: 'payment_request', moduleLabel: 'درخواست پرداخت', recordId: p.id,
      docNumber: p.requestNumber, title: `${p.sourceType} - ${p.beneficiaryName}`, amount: p.remainingAmount,
      requester: p.requestedBy || 'خزانه‌داری', projectId: p.projectId, projectName: p.projectName || projectName(p.projectId),
      counterpartyName: p.beneficiaryName || partyName(p.counterpartyId), date: p.date, stage: 'تأیید پرداخت', approverRole: 'مدیر ارشد',
      action: 'payment_request.approve', context: paymentApprovalContext(p),
      classification: 'مالی', documentCount: documentCount(state, 'payment_request', p.id),
    });
  }

  const calculated = state.payrollSlips.filter((s) => s.status === 'محاسبه شده');
  for (const period of [...new Set(calculated.map((s) => s.monthYear))]) {
    const slips = calculated.filter((s) => s.monthYear === period);
    items.push({
      id: `payroll:${period}`, module: 'payroll', moduleLabel: 'حقوق و دستمزد', recordId: period,
      docNumber: `لیست حقوق ${period}`, title: `${fa(slips.length)} فیش حقوق محاسبه‌شده`, amount: slips.reduce((a, s) => a + s.totalCostForCompany, 0),
      requester: 'منابع انسانی', projectId: '', projectName: 'ستاد و کارگاه‌ها', date: slips[0].issueDate,
      stage: 'تأیید مالی حقوق', approverRole: 'حسابدار', action: 'payroll.approve', context: payrollContext(slips), classification: 'سربار و ستادی', documentCount: 0,
    });
  }

  for (const j of state.journalEntries) {
    if (j.status !== 'در انتظار تأیید') continue;
    items.push({
      id: `journal_entry:${j.id}`, module: 'journal_entry', moduleLabel: 'سند حسابداری', recordId: j.id,
      docNumber: j.docNumber, title: j.title, amount: j.totalDebit, requester: j.submitter,
      projectId: j.projectId || '', projectName: j.projectName || '-', costCenterName: j.costCenterName, date: j.date,
      stage: 'تأیید سند', approverRole: 'حسابدار', action: 'journal.approve', context: journalContext(j), classification: 'مالی', documentCount: documentCount(state, 'journal_entry', j.id),
    });
  }

  return items.sort((a, b) => (dayIndex(b.date) || 0) - (dayIndex(a.date) || 0));
}

// =============================================================================
// Payment schedule (treasury)
// =============================================================================

export interface ScheduledPayment {
  request: PaymentRequest;
  dueIndex: number;
  overdue: boolean;
  cumulative: number;
  coveredByCash: boolean;
}

export function selectPaymentSchedule(state: AppState): { rows: ScheduledPayment[]; availableCash: number } {
  const availableCash = state.bankAccounts.filter((b) => b.status === 'فعال').reduce((a, b) => a + b.balance, 0) + state.cashDesks.reduce((a, c) => a + c.balance, 0);
  const t = todayIndex();
  let cumulative = 0;
  const rows = state.paymentRequests
    .filter((r) => r.status !== 'پرداخت شده' && r.status !== 'رد شده' && r.remainingAmount > 0)
    .map((r) => ({ request: r, dueIndex: dayIndex(r.dueDate) }))
    .sort((a, b) => (a.dueIndex || 0) - (b.dueIndex || 0))
    .map(({ request, dueIndex }) => {
      cumulative += request.remainingAmount;
      return { request, dueIndex, overdue: dueIndex < t, cumulative, coveredByCash: cumulative <= availableCash };
    });
  return { rows, availableCash };
}

// =============================================================================
// Notification center (computed; only dismissals are stored)
// =============================================================================

/** Alerts computed from data; `userId` hides what that user dismissed. */
export function selectNotifications(state: AppState, includeDismissed = false, userId?: string): ManagementAlert[] {
  const out: ManagementAlert[] = [];
  const t = todayIndex();
  const todayStr = toPersianDate(new Date());
  const project = (id?: string) => state.projects.find((p) => p.id === id);

  // Low stock
  for (const m of selectMaterials(state)) {
    if (m.currentStock > m.reorderLevel) continue;
    const critical = m.currentStock <= m.minSafetyStock;
    out.push({
      id: `low_stock:${m.id}`, kind: 'low_stock', priority: critical ? 'critical' : 'warning', date: todayStr,
      title: `موجودی پایین: ${m.name}`,
      description: `موجودی کل ${fa(m.currentStock)} ${m.unit} و نقطه سفارش ${fa(m.reorderLevel)} ${m.unit} است${critical ? '؛ کمتر از حداقل اطمینان.' : '.'}`,
      actionLabel: 'مشاهده انبار', actionPath: '/inventory',
    });
  }

  // Low petty cash
  const pct = state.pettyCashSettings.lowBalancePercent / 100;
  for (const f of selectPettyFunds(state)) {
    if (f.status !== 'active' || f.usableBalance > f.ceilingLimit * pct) continue;
    out.push({
      id: `low_petty_cash:${f.id}`, kind: 'low_petty_cash', priority: f.usableBalance <= 0 ? 'critical' : 'warning', date: todayStr,
      title: `کمبود موجودی ${f.title}`,
      description: `موجودی قابل مصرف ${formatMoney(f.usableBalance)}؛ کمتر از ${fa(state.pettyCashSettings.lowBalancePercent)}٪ سقف ${formatMoney(f.ceilingLimit)}.`,
      relatedProjectId: f.projectId, relatedProjectName: f.projectName, amount: f.usableBalance,
      actionLabel: 'درخواست شارژ', actionPath: '/petty-cash',
    });
  }

  // Contracts ending (within 60 days) or past their end date while still active
  for (const c of state.contracts) {
    const end = dayIndex(c.endDate);
    if (Number.isNaN(end) || c.status !== 'فعال' || end - t > 60) continue;
    out.push({
      id: `contract_ending:${c.id}`, kind: 'contract_ending', priority: end < t ? 'critical' : 'warning', date: todayStr,
      title: end < t ? `پایان مدت قرارداد ${c.code}` : `قرارداد ${c.code} رو به اتمام`,
      description: `${c.projectTitle} — تاریخ پایان ${c.endDate}${end < t ? '؛ نیاز به الحاقیه تمدید.' : ` (${fa(end - t)} روز مانده).`}`,
      relatedProjectId: c.projectId, relatedProjectName: c.projectName, actionLabel: 'مشاهده قرارداد', actionPath: '/contracts/client',
    });
  }
  for (const c of state.subcontractorContracts) {
    const end = dayIndex(c.endDate);
    if (Number.isNaN(end) || c.status !== 'فعال' || end - t > 60) continue;
    out.push({
      id: `contract_ending:${c.id}`, kind: 'contract_ending', priority: end < t ? 'critical' : 'warning', date: todayStr,
      title: end < t ? `پایان مدت قرارداد جزء ${c.contractNumber}` : `قرارداد جزء ${c.contractNumber} رو به اتمام`,
      description: `${c.subcontractorName} — ${c.title} — تاریخ پایان ${c.endDate}.`,
      relatedProjectId: c.projectId, relatedProjectName: c.projectName, actionLabel: 'مشاهده قرارداد', actionPath: '/contracts/subcontract',
    });
  }

  // Overdue receivables
  for (const s of state.clientStatements) {
    if (!CLIENT_APPROVED_STATUSES.includes(s.status) || s.remainingPayable <= 0) continue;
    const due = dayIndex(s.dueDate);
    if (Number.isNaN(due) || due >= t) continue;
    out.push({
      id: `overdue_receivable:${s.id}`, kind: 'overdue_receivable', priority: 'critical', date: todayStr,
      title: `مطالبات معوق ${s.statementNumber}`,
      description: `${formatMoney(s.remainingPayable)} از ${s.client} از سررسید ${s.dueDate} وصول نشده است.`,
      relatedProjectId: s.projectId, relatedProjectName: s.projectName, amount: s.remainingPayable,
      actionLabel: 'ثبت دریافت', actionPath: '/finance/receipts',
    });
  }

  // Payables due
  for (const r of state.paymentRequests) {
    if (r.status === 'پرداخت شده' || r.status === 'رد شده' || r.remainingAmount <= 0) continue;
    const due = dayIndex(r.dueDate);
    if (Number.isNaN(due) || due > t) continue;
    out.push({
      id: `payable_due:${r.id}`, kind: 'payable_due', priority: due < t ? 'critical' : 'warning', date: todayStr,
      title: `بدهی سررسیدشده: ${r.beneficiaryName}`,
      description: `${r.sourceType} ${r.sourceRefNumber} — ${formatMoney(r.remainingAmount)}، سررسید ${r.dueDate}.`,
      relatedProjectId: r.projectId, relatedProjectName: r.projectName || project(r.projectId)?.name, amount: r.remainingAmount,
      actionLabel: 'برنامه پرداخت', actionPath: '/finance/payments',
    });
  }

  // Approvals required
  const approvals = selectApprovals(state);
  const byModule = new Map<string, number>();
  for (const a of approvals) byModule.set(a.moduleLabel, (byModule.get(a.moduleLabel) || 0) + 1);
  for (const [label, count] of byModule) {
    out.push({
      id: `approval_required:${label}`, kind: 'approval_required', priority: 'info', date: todayStr,
      title: `${fa(count)} ${label} در انتظار تأیید`,
      description: 'موارد در کارتابل تأییدات مرکزی قابل بررسی است.', actionLabel: 'کارتابل تأییدات', actionPath: '/approvals',
    });
  }

  // Missing documents
  const missing: Array<[string, number, string]> = [
    ['صورت‌وضعیت تأییدشده بدون سند پیوست', state.clientStatements.filter((s) => CLIENT_APPROVED_STATUSES.includes(s.status) && !documentCount(state, 'client_statement', s.id)).length, '/statements/client'],
    ['فاکتور خرید تأییدشده بدون تصویر فاکتور', state.vendorInvoices.filter((i) => VENDOR_INVOICE_APPROVED_STATUSES.includes(i.status) && !documentCount(state, 'vendor_invoice', i.id)).length, '/procurement'],
    ['هزینه تنخواه بدون فاکتور پیوست', state.pettyCashExpenses.filter((e) => e.status !== 'draft' && e.status !== 'rejected' && !documentCount(state, 'petty_cash_expense', e.id)).length, '/petty-cash'],
    ['قرارداد کارفرما بدون متن قرارداد', state.contracts.filter((c) => !documentCount(state, 'contract', c.id)).length, '/contracts/client'],
  ];
  for (const [label, count, path] of missing) {
    if (!count) continue;
    out.push({
      id: `missing_document:${label}`, kind: 'missing_document', priority: 'warning', date: todayStr,
      title: `سند ناقص: ${fa(count)} ${label}`, description: 'پیوست را در مرکز اسناد بارگذاری و به رکورد متصل کنید.',
      actionLabel: 'مرکز اسناد', actionPath: path,
    });
  }

  const rank = { critical: 0, warning: 1, info: 2 } as const;
  const dismissed = new Set(userId ? state.dismissedNotificationIds[userId] || [] : []);
  return out.filter((n) => includeDismissed || !dismissed.has(n.id)).sort((a, b) => rank[a.priority] - rank[b.priority]);
}

// =============================================================================
// Projects: budget vs actual per cost center, suppliers, warehouses
// =============================================================================

export interface CostCenterBudgetRow {
  costCenterId: string;
  name: string;
  budget: number;
  actual: number;
  variance: number;
  usedPercent: number;
}

export function selectBudgetVsActual(state: AppState, projectId: string): CostCenterBudgetRow[] {
  const centers = state.costCenters.filter((c) => c.projectId === projectId && c.type !== 'دفتر مرکزی');
  const actual = new Map<string, number>();
  let unassigned = 0;
  for (const e of postedEntries(state)) {
    for (const r of e.rows) {
      if (r.projectId !== projectId || !r.accountCode.startsWith('5')) continue;
      const amount = r.debit - r.credit;
      if (r.costCenterId && centers.some((c) => c.id === r.costCenterId)) actual.set(r.costCenterId, (actual.get(r.costCenterId) || 0) + amount);
      else unassigned += amount;
    }
  }
  const rows = centers.map((c) => {
    const a = actual.get(c.id) || 0;
    const budget = c.budget || 0;
    return { costCenterId: c.id, name: c.name, budget, actual: a, variance: budget - a, usedPercent: budget > 0 ? Math.round((a / budget) * 1000) / 10 : 0 };
  });
  if (unassigned !== 0) {
    rows.push({ costCenterId: '', name: 'بدون مرکز هزینه مشخص', budget: 0, actual: unassigned, variance: -unassigned, usedPercent: 0 });
  }
  return rows;
}

export function selectProjectSuppliers(state: AppState, projectId: string) {
  const ids = new Set<string>();
  for (const po of state.purchaseOrders) if (po.projectId === projectId) ids.add(po.counterpartyId || po.supplierId);
  for (const inv of state.vendorInvoices) if (inv.projectId === projectId) ids.add(inv.counterpartyId || inv.supplierId);
  return [...ids].map((id) => {
    const party = state.counterparties.find((c) => c.id === id);
    const orders = state.purchaseOrders.filter((p) => p.projectId === projectId && (p.counterpartyId || p.supplierId) === id);
    const invoices = state.vendorInvoices.filter((i) => i.projectId === projectId && (i.counterpartyId || i.supplierId) === id);
    return {
      id,
      name: party?.name || orders[0]?.supplierName || invoices[0]?.supplierName || id,
      orders: orders.length,
      ordered: orders.reduce((a, p) => a + p.totalOrderAmount, 0),
      invoiced: invoices.reduce((a, i) => a + i.totalAmount, 0),
      paid: invoices.reduce((a, i) => a + i.paidAmount, 0),
      balance: invoices.reduce((a, i) => a + i.remainingBalance, 0),
    };
  });
}

// =============================================================================
// Counterparty profile (everything computed from the store)
// =============================================================================

export interface CounterpartyProfile {
  counterparty: Counterparty;
  contracts: Array<{ id: string; number: string; title: string; projectId: string; projectName: string; value: number; status: string; kind: 'client' | 'subcontract' | 'purchase_order' }>;
  projects: Array<{ id: string; name: string }>;
  executed: number;
  approvedStatements: number;
  paidOrReceived: number;
  balance: number;
  deductionsHeld: number;
  statements: Array<{ id: string; number: string; projectName: string; amount: number; net: number; status: string; date: string }>;
  payments: Array<{ id: string; docNumber: string; date: string; amount: number; description: string }>;
  guarantees: AppDocument[];
  documents: AppDocument[];
  performance: { total: number; returned: number; approvedOnFirstPass: number; score: number };
  priceHistory: Array<{ id: string; material: string; unit: string; date: string; unitPrice: number; poNumber: string }>;
}

export function selectCounterpartyProfile(state: AppState, counterpartyId: string): CounterpartyProfile | undefined {
  const counterparty = state.counterparties.find((c) => c.id === counterpartyId);
  if (!counterparty) return undefined;
  const contracts: CounterpartyProfile['contracts'] = [];
  const statements: CounterpartyProfile['statements'] = [];
  let executed = 0;
  let approved = 0;
  let returned = 0;

  if (counterparty.kind === 'client') {
    for (const c of state.contracts.filter((x) => x.counterpartyId === counterpartyId)) {
      contracts.push({ id: c.id, number: c.code, title: c.projectTitle, projectId: c.projectId, projectName: c.projectName, value: c.currentValue, status: c.status, kind: 'client' });
      executed += c.executedValue;
    }
    for (const s of state.clientStatements.filter((x) => contracts.some((c) => c.id === x.contractId))) {
      statements.push({ id: s.id, number: s.statementNumber, projectName: s.projectName, amount: s.grossAmount, net: s.netPayable, status: s.status, date: s.preparationDate });
      if (CLIENT_APPROVED_STATUSES.includes(s.status)) approved += s.approvedNetPayable ?? s.netPayable;
      if (s.workflowHistory.some((h) => h.toStatus === 'returned_for_correction') || s.status === 'returned_for_correction') returned++;
    }
  } else if (counterparty.kind === 'subcontractor') {
    for (const c of state.subcontractorContracts.filter((x) => x.counterpartyId === counterpartyId)) {
      contracts.push({ id: c.id, number: c.contractNumber, title: c.title, projectId: c.projectId, projectName: c.projectName, value: c.contractValue, status: c.status, kind: 'subcontract' });
    }
    for (const s of state.subcontractorStatements.filter((x) => x.counterpartyId === counterpartyId)) {
      statements.push({ id: s.id, number: s.statementNumber, projectName: s.projectName, amount: s.grossAmount, net: s.netPayable, status: s.status, date: s.submissionDate });
      if (s.status !== 'rejected') executed += s.siteVerifiedAmount || s.grossAmount;
      if (s.status === 'management_approved' || s.status === 'paid') approved += s.netPayable;
      if (s.status === 'returned_for_revision' || s.status === 'rejected' || s.workflowHistory.some((h) => h.toStatus === 'returned_for_revision')) returned++;
    }
  } else if (counterparty.kind === 'supplier') {
    for (const p of state.purchaseOrders.filter((x) => (x.counterpartyId || x.supplierId) === counterpartyId)) {
      contracts.push({ id: p.id, number: p.poNumber, title: p.items.map((i) => i.materialName).join('، '), projectId: p.projectId, projectName: p.projectName, value: p.totalOrderAmount, status: p.status, kind: 'purchase_order' });
      executed += p.items.reduce((a, i) => a + i.receivedQty * i.unitPrice, 0);
    }
    for (const inv of state.vendorInvoices.filter((x) => (x.counterpartyId || x.supplierId) === counterpartyId)) {
      statements.push({ id: inv.id, number: inv.invoiceNumber, projectName: inv.projectName, amount: inv.totalAmount, net: inv.remainingBalance, status: inv.status, date: inv.invoiceDate });
      if (VENDOR_INVOICE_APPROVED_STATUSES.includes(inv.status)) approved += inv.totalAmount;
      if (inv.status === 'دارای مغایرت و متوقف') returned++;
    }
  }

  // Ledger balances on this counterparty's subledger.
  let receivable = 0;
  let payable = 0;
  let deductionsHeld = 0;
  let paidOrReceived = 0;
  const payments: CounterpartyProfile['payments'] = [];
  for (const e of postedEntries(state)) {
    for (const r of e.rows) {
      if (r.subledgerCode !== counterpartyId) continue;
      const code = r.accountCode;
      if (code.startsWith('112')) receivable += r.debit - r.credit;
      if (code.startsWith('211')) payable += r.credit - r.debit;
      if (code.startsWith('216') || code.startsWith('1130')) deductionsHeld += code.startsWith('216') ? r.credit - r.debit : r.debit - r.credit;
    }
  }
  for (const ev of state.financialEvents) {
    if (ev.counterpartyId !== counterpartyId || (ev.type !== 'TREASURY_PAYMENT' && ev.type !== 'TREASURY_RECEIPT')) continue;
    paidOrReceived += ev.amount;
    payments.push({ id: ev.id, docNumber: ev.docNumber || '-', date: ev.date, amount: ev.amount, description: `${ev.type === 'TREASURY_PAYMENT' ? 'پرداخت' : 'دریافت'} ${ev.details?.docNumber || ''}` });
  }

  const projectIds = [...new Set(contracts.map((c) => c.projectId))];
  const documents = selectDocumentsFor(state, 'counterparty', counterpartyId);
  const contractDocs = contracts.flatMap((c) => selectDocumentsFor(state, c.kind === 'client' ? 'contract' : c.kind === 'subcontract' ? 'subcontract' : 'purchase_order', c.id));
  const allDocs = [...new Map([...documents, ...contractDocs].map((d) => [d.id, d])).values()];

  const priceHistory =
    counterparty.kind === 'supplier'
      ? state.purchaseOrders
          .filter((p) => (p.counterpartyId || p.supplierId) === counterpartyId)
          .flatMap((p) => p.items.map((i) => ({ id: `${p.id}:${i.id}`, material: i.materialName, unit: i.unit, date: p.issueDate, unitPrice: i.unitPrice, poNumber: p.poNumber })))
      : [];

  const total = statements.length;
  return {
    counterparty,
    contracts,
    projects: projectIds.map((id) => ({ id, name: state.projects.find((p) => p.id === id)?.name || id })),
    executed,
    approvedStatements: approved,
    paidOrReceived,
    balance: counterparty.kind === 'client' ? receivable : payable,
    deductionsHeld,
    statements,
    payments,
    guarantees: allDocs.filter((d) => d.type === 'ضمانت‌نامه بانکی'),
    documents: allDocs,
    performance: { total, returned, approvedOnFirstPass: total - returned, score: total ? Math.round(((total - returned) / total) * 100) : 100 },
    priceHistory,
  };
}

// =============================================================================
// Sidebar counters
// =============================================================================

export function selectSidebarCounts(state: AppState): Record<string, string> {
  const pendingPayments = state.paymentRequests.filter((r) => r.status === 'تأیید مدیر ارشد' || r.status === 'در صف پرداخت خزانه').length;
  return {
    projects: fa(state.projects.length),
    contracts: fa(state.contracts.length + state.subcontractorContracts.length),
    statements: fa(state.clientStatements.length + state.subcontractorStatements.length),
    inventory: fa(state.materials.length),
    petty_cash: fa(state.pettyCashAccounts.filter((a) => a.status === 'active').length),
    payments: pendingPayments ? fa(pendingPayments) : '',
    approvals: fa(selectApprovals(state).length),
    notifications: fa(selectNotifications(state).length),
  };
}

// =============================================================================
// Receivables / payables aging (from approved statements and open payment requests)
// =============================================================================

const agingStatus = <T extends string>(overdueDays: number, due: T, near: T, late: T): T => (overdueDays > 0 ? late : overdueDays > -15 ? near : due);

export function selectReceivablesAging(state: AppState): AccountsReceivableItem[] {
  const t = todayIndex();
  return state.clientStatements
    .filter((s) => CLIENT_APPROVED_STATUSES.includes(s.status) && s.remainingPayable > 0)
    .map((s) => {
      const overdueDays = Number.isNaN(dayIndex(s.dueDate)) ? 0 : t - dayIndex(s.dueDate);
      const billed = s.approvedNetPayable ?? s.netPayable;
      return {
        id: s.id,
        debtorName: s.client,
        type: 'کارفرما' as const,
        projectId: s.projectId,
        projectName: s.projectName,
        billedAmount: billed,
        receivedAmount: s.receivedAmount,
        remainingClaim: s.remainingPayable,
        dueDate: s.dueDate || '-',
        overdueDays: Math.max(0, overdueDays),
        status: agingStatus(overdueDays, 'جاری', 'نزدیک سررسید', 'معوق سررسید گذشته'),
      };
    });
}

export function selectPayablesAging(state: AppState): AccountsPayableItem[] {
  const t = todayIndex();
  const typeOf = (r: PaymentRequest): AccountsPayableItem['type'] =>
    r.beneficiaryType === 'پیمانکار جزء' ? 'پیمانکار جزء' : r.beneficiaryType === 'تأمین‌کننده' ? 'تأمین‌کننده مصالح' : r.beneficiaryType === 'پرسنل' ? 'پرسنل' : 'سایر';
  return state.paymentRequests
    .filter((r) => r.status !== 'رد شده' && r.remainingAmount > 0)
    .map((r) => {
      const overdueDays = Number.isNaN(dayIndex(r.dueDate)) ? 0 : t - dayIndex(r.dueDate);
      return {
        id: r.id,
        creditorName: r.beneficiaryName,
        type: typeOf(r),
        projectId: r.projectId,
        projectName: r.projectName,
        incurredDebt: r.totalAmount,
        paidAmount: r.paidAmount,
        remainingDebt: r.remainingAmount,
        dueDate: r.dueDate,
        status: overdueDays > 30 ? 'معوق' : overdueDays > 0 ? 'سررسید شده' : 'در مهلت پرداخت',
      };
    });
}
