/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** View models of procurement: dashboard figures and the purchase order / requisition form calculators. */

import type {
  ProcurementCategory,
  PurchaseOrder,
  PurchaseRequisition,
  RequestForQuotation,
  Supplier,
  VendorInvoice,
} from '../../types';
import type { AppState } from '../types';
import { roundRial } from '../../utils/money';
import { generateUUID } from '../../utils/ids';
import { getRelativePersianDate } from '../../utils/date';
import { percentOf, sumBy } from './common';

const CLOSED_ORDER_STATUSES = ['تسویه حساب نهایی و مختومه', 'فسخ شده'];

export function selectProcurementDashboard(
  orders: readonly PurchaseOrder[],
  requisitions: readonly PurchaseRequisition[],
  rfqs: readonly RequestForQuotation[],
  invoices: readonly VendorInvoice[],
  suppliers: readonly Supplier[]
) {
  // Spend per category, from issued orders grouped by the supplier's category.
  const spend = new Map<string, number>();
  for (const o of orders) {
    if (o.status === 'فسخ شده') continue;
    const category = suppliers.find((sup) => sup.id === o.supplierId)?.category ?? 'سایر';
    spend.set(category, (spend.get(category) ?? 0) + o.totalOrderAmount);
  }
  const categoryTotal = sumBy(Array.from(spend.values()), (v) => v);
  const urgent = requisitions.filter((r) => r.priority === 'فوری کارگاهی (حیاتی)' && r.status !== 'سفارش صادر شده (PO)' && r.status !== 'لغو شده');
  return {
    totalOrdersAmount: sumBy(orders, (o) => o.totalOrderAmount),
    activeOrdersCount: orders.filter((o) => !CLOSED_ORDER_STATUSES.includes(o.status)).length,
    urgentRequisitions: urgent,
    /** Projects the urgent requisitions belong to («—» when none). */
    urgentProjects: Array.from(new Set(urgent.map((r) => r.projectName).filter(Boolean))).join('، ') || '—',
    pendingApprovalsCount: requisitions.filter((r) => r.status.includes('تأیید') || r.status.includes('پیش‌نویس')).length,
    activeRfqsCount: rfqs.filter((r) => r.status === 'در حال استعلام' || r.status === 'کمیسیون معاملات و ارزیابی').length,
    totalSavings: sumBy(rfqs, (r) => r.savingsVsBudgetAmount || 0),
    pendingInvoices: invoices.filter((i) => i.status === 'در حال تطبیق' || i.status === 'دارای مغایرت و متوقف'),
    totalAccountsPayable: sumBy(invoices, (i) => i.remainingBalance),
    categorySpend: Array.from(spend, ([category, amount]) => ({ category, amount, percent: Math.round(percentOf(amount, categoryTotal)) })),
  };
}

/** A requisition can still be turned into an RFQ or an order. */
export const requisitionConvertible = (r: PurchaseRequisition) => (r.server ? r.server.status === 'approved' : r.status !== 'سفارش صادر شده (PO)');
/** Direct order from a requisition (demo only; with the server the order comes from the RFQ winner). */
export const requisitionDirectOrder = (r: PurchaseRequisition) => !r.server && requisitionConvertible(r);
/** A supplier invoice that can be approved: with the server only a matched invoice pending the accountant (a stopped one is not). */
export const invoiceApprovable = (i: VendorInvoice) => (i.server ? i.server.status === 'pending' : i.remainingBalance > 0);
/** A supplier invoice the accountant can still reject (server only). */
export const invoiceRejectable = (i: VendorInvoice) => i.server?.status === 'pending' || i.server?.status === 'stopped';
/** An RFQ with a winner that is not an order yet. */
export const rfqCanIssueOrder = (r: RequestForQuotation) => r.status !== 'تبدیل به سفارش (PO)';

// ---------------- Purchase order form ----------------

export interface PurchaseOrderLineInput {
  id: string;
  materialCode: string;
  materialName: string;
  specifications: string;
  orderedQty: number;
  unit: string;
  /** Integer Rials. */
  unitPrice: number;
  freightAndUnloadingCost: number;
}

export interface PurchaseOrderFormInput {
  projectId: string;
  supplierId: string;
  destinationWarehouse: string;
  deliveryDueDate: string;
  paymentTerms: string;
  advancePaymentAmount: number;
  items: PurchaseOrderLineInput[];
}

export function blankPurchaseOrderLine(): PurchaseOrderLineInput {
  return { id: generateUUID(), materialCode: '', materialName: '', specifications: '', orderedQty: 0, unit: '', unitPrice: 0, freightAndUnloadingCost: 0 };
}

/** Every amount is a whole number of Rials; VAT uses the rate stored in the finance settings. */
export function computePurchaseOrderDraft(state: AppState, form: PurchaseOrderFormInput) {
  const vatRate = state.financeSettings.vatRatePercent / 100;
  const lines = form.items.map((it) => {
    const net = it.orderedQty * it.unitPrice;
    const vat = roundRial(net * vatRate);
    return { ...it, net, vat, gross: net + vat + it.freightAndUnloadingCost };
  });
  const subtotal = sumBy(lines, (l) => l.net);
  const totalVat = sumBy(lines, (l) => l.vat);
  const totalFreight = sumBy(lines, (l) => l.freightAndUnloadingCost);
  const grandTotal = subtotal + totalVat + totalFreight;
  let error: string | null = null;
  if (!state.projects.some((p) => p.id === form.projectId)) error = 'پروژه را انتخاب کنید.';
  else if (!state.suppliers.some((s) => s.id === form.supplierId)) error = 'تأمین‌کننده را انتخاب کنید.';
  else if (lines.some((l) => !l.materialName.trim() || !l.unit.trim() || l.orderedQty <= 0 || l.unitPrice <= 0)) error = 'برای هر ردیف نام کالا، واحد، مقدار و فی را وارد کنید.';
  else if (form.advancePaymentAmount > grandTotal) error = 'پیش‌پرداخت از جمع سفارش بیشتر است.';
  return { vatRate, vatRatePercent: state.financeSettings.vatRatePercent, lines, subtotal, totalVat, totalFreight, grandTotal, error };
}

// ---------------- Requisition form ----------------

export interface RequisitionLineInput {
  id: string;
  materialCode: string;
  materialName: string;
  specification: string;
  category: ProcurementCategory;
  requestedQty: number;
  unit: string;
  /** Integer Rials. */
  estimatedUnitPrice: number;
  requiredDeliveryDate: string;
  suggestedVendors?: string;
  /** akph/v1: a line is a material of the list (goods) or a service with a cost account of group 5/6. */
  kind?: 'goods' | 'service';
  materialId?: string;
  accountCode?: string;
}

export interface RequisitionFormInput {
  projectId: string;
  priority: PurchaseRequisition['priority'];
  costCenter: string;
  justification: string;
  items: RequisitionLineInput[];
}

export function blankRequisitionLine(): RequisitionLineInput {
  return {
    id: generateUUID(),
    materialCode: '',
    materialName: '',
    specification: '',
    category: 'آهن‌آلات و مقاطع فولادی',
    requestedQty: 0,
    unit: 'کیلوگرم',
    estimatedUnitPrice: 0,
    requiredDeliveryDate: getRelativePersianDate(14),
    suggestedVendors: '',
  };
}

/** Estimated total of a requisition (quantity × estimated price of every line). */
export function requisitionEstimate(items: readonly RequisitionLineInput[]): number {
  return sumBy(items, (it) => it.requestedQty * it.estimatedUnitPrice);
}

/** Postable cost accounts (group 5 and 6, no children) for service lines of a requisition. */
export function expenseAccountOptions(state: Pick<AppState, 'chartOfAccounts'>): { code: string; title: string }[] {
  const out: { code: string; title: string }[] = [];
  const walk = (nodes: AppState['chartOfAccounts']) => {
    for (const n of nodes) {
      if (n.children?.length) walk(n.children);
      else if (n.code.startsWith('5') || n.code.startsWith('6')) out.push({ code: n.code, title: n.title });
    }
  };
  walk(state.chartOfAccounts);
  return out;
}
