/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DetailedProgressStatement,
  SubcontractorProgressStatement,
  GoodsReceiptNote,
  VendorInvoice,
  StoreIssueVoucher,
  PettyCashExpense,
  PettyCashAccount,
  PayrollSlip,
} from '../types';
import { FinancialEventInput } from './types';
import { DeductionLine } from './postingRules';

/**
 * سازنده‌های رویداد مالی از اسناد عملیاتی. ماژول‌ها فقط این رویدادها را به postFinancialEvent می‌دهند.
 */

/** صورت‌وضعیت کارفرما پس از تأیید کارفرما. مبلغ = ناخالص (شامل ارزش افزوده). */
export function clientStatementApprovedEvent(s: DetailedProgressStatement, costCenterId: string, counterpartyId: string): FinancialEventInput {
  const deductions: DeductionLine[] = (s.deductions || [])
    .filter((d) => d.calculatedAmount > 0)
    .map((d) => ({ type: d.type, amount: d.calculatedAmount, title: d.title }));
  const itemized = deductions.reduce((a, d) => a + d.amount, 0);
  const unitemized = s.grossAmount - s.netPayable - itemized;
  if (unitemized > 0) {
    deductions.push({ type: 'other', amount: unitemized, title: 'سایر کسورات' });
  }
  return {
    type: 'CLIENT_STATEMENT_APPROVED',
    sourceModule: 'contracts',
    sourceId: s.id,
    projectId: s.projectId,
    costCenterId,
    counterpartyId,
    amount: s.grossAmount,
    date: s.preparationDate,
    details: { docNumber: s.statementNumber, vatAmount: s.vatAmount || 0, deductions },
  };
}

export function subcontractorDeductionLines(s: SubcontractorProgressStatement): DeductionLine[] {
  const d = s.deductions;
  return [
    { type: 'retention', amount: d.retention || 0, title: 'سپرده حسن انجام کار' },
    { type: 'insurance', amount: d.insuranceDeduction || 0, title: 'بیمه مکسوره' },
    { type: 'tax', amount: d.taxDeduction || 0, title: 'مالیات مکسوره' },
    { type: 'advance_payment', amount: d.advancePaymentDeduction || 0, title: 'استهلاک پیش‌پرداخت' },
    { type: 'penalty', amount: d.safetyOrWastePenalty || 0, title: 'جریمه ایمنی/پرت مصالح' },
    { type: 'other', amount: d.otherDeductions || 0, title: 'سایر کسورات' },
  ].filter((x) => x.amount > 0);
}

/** صورت‌وضعیت پیمانکار جزء پس از تأیید مدیر ارشد. مبلغ = خالص + کسورات (کارکرد تأییدشده). */
export function subcontractorStatementApprovedEvent(s: SubcontractorProgressStatement): FinancialEventInput {
  const deductions = subcontractorDeductionLines(s);
  const amount = s.netPayable + deductions.reduce((a, d) => a + d.amount, 0);
  return {
    type: 'SUBCONTRACTOR_STATEMENT_APPROVED',
    sourceModule: 'subcontractors',
    sourceId: s.id,
    projectId: s.projectId,
    costCenterId: s.costCenterId,
    counterpartyId: s.counterpartyId,
    amount,
    date: s.managementApprovalDate || s.submissionDate,
    details: { docNumber: s.statementNumber, deductions },
  };
}

export function goodsReceiptEvent(g: GoodsReceiptNote): FinancialEventInput {
  return {
    type: 'GOODS_RECEIPT',
    sourceModule: 'inventory',
    sourceId: g.id,
    projectId: g.projectId,
    costCenterId: g.costCenterId || '',
    counterpartyId: g.counterpartyId || g.supplierId || '',
    amount: g.totalAmount,
    date: g.date,
    details: { docNumber: g.receiptNumber, warehouseId: g.warehouseId, warehouseName: g.warehouseName, poId: g.poId },
  };
}

/** فاکتور خرید: مبلغ کالا (بدون ارزش افزوده) حساب موقت رسید انبار را می‌بندد. */
export function vendorInvoiceEvent(inv: VendorInvoice): FinancialEventInput {
  const subtotal = inv.totalAmount - inv.vatAmount;
  return {
    type: 'VENDOR_INVOICE',
    sourceModule: 'procurement',
    sourceId: inv.id,
    projectId: inv.projectId,
    costCenterId: inv.costCenterId || '',
    counterpartyId: inv.counterpartyId || inv.supplierId,
    amount: inv.totalAmount,
    date: inv.invoiceDate,
    details: { docNumber: inv.invoiceNumber, subtotal, vatAmount: inv.vatAmount, grnId: inv.grnId },
  };
}

/** حواله مصرف: مبلغ باید به بهای میانگین موزون محاسبه شده باشد. */
export function storeIssueEvent(v: StoreIssueVoucher, weightedAverageCost: number): FinancialEventInput {
  return {
    type: 'STORE_ISSUE',
    sourceModule: 'inventory',
    sourceId: v.id,
    projectId: v.projectId,
    costCenterId: v.costCenterId || '',
    counterpartyId: v.counterpartyId || v.subcontractorId || '',
    amount: weightedAverageCost,
    date: v.date,
    details: { docNumber: v.issueNumber, warehouseId: v.warehouseId, warehouseName: v.warehouseName },
  };
}

export function pettyCashExpenseApprovedEvent(exp: PettyCashExpense, account?: PettyCashAccount): FinancialEventInput {
  return {
    type: 'PETTY_CASH_EXPENSE_APPROVED',
    sourceModule: 'petty_cash',
    sourceId: exp.id,
    projectId: exp.projectId,
    costCenterId: exp.costCenterId || account?.costCenterId || '',
    counterpartyId: exp.counterpartyId || '',
    amount: exp.amount,
    date: exp.date,
    details: {
      docNumber: exp.expenseNumber,
      pettyCashId: exp.pettyCashId,
      pettyCashTitle: account?.title || exp.pettyCashTitle,
      expenseAccountCode: exp.accountingAccountCode,
      description: exp.description,
    },
  };
}

/** یک سند حقوق برای هر دوره: هزینه به تفکیک مرکز هزینه، بستانکار حقوق، بیمه، مالیات و مساعده. */
export function payrollApprovedEvent(periodId: string, period: string, slips: PayrollSlip[]): FinancialEventInput {
  const byCostCenter = new Map<string, { projectId?: string; costCenterId: string; amount: number }>();
  for (const s of slips) {
    const cost = s.totalCostForCompany - (s.disciplinaryDeduction || 0);
    const cur = byCostCenter.get(s.costCenterId) || { projectId: s.projectId, costCenterId: s.costCenterId, amount: 0 };
    cur.amount += cost;
    byCostCenter.set(s.costCenterId, cur);
  }
  const lines = [...byCostCenter.values()];
  const credits = {
    netSalary: slips.reduce((a, s) => a + s.netPayableSalary, 0),
    insurance: slips.reduce((a, s) => a + s.workerInsuranceDeduction + s.employerInsuranceContribution, 0),
    tax: slips.reduce((a, s) => a + s.incomeTaxDeduction, 0),
    loans: slips.reduce((a, s) => a + (s.loanDeduction || 0), 0),
  };
  return {
    type: 'PAYROLL_APPROVED',
    sourceModule: 'payroll',
    sourceId: periodId,
    projectId: '',
    costCenterId: '',
    counterpartyId: '',
    amount: lines.reduce((a, l) => a + l.amount, 0),
    date: slips[0]?.issueDate || '',
    details: { period, lines, credits, slipIds: slips.map((s) => s.id) },
  };
}
