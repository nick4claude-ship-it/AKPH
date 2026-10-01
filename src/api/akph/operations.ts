/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Procurement, inventory and payroll of akph/v1 (0.8.0) → app records (docs/API-CONTRACT.md §procurement,
 * §inventory, §payroll). Amounts, averages, statuses, numbers and payslips are the server's; the app shows them.
 * Quantities travel as decimal strings (DECIMAL(18,3)); amounts as integer Rials.
 */

import type {
  BidSupplierQuote,
  Employee,
  GoodsReceiptNote,
  InterWarehouseTransfer,
  KardexEntry,
  MaterialCategory,
  MaterialItem,
  MonthlyTimesheet,
  PayrollPeriod,
  PayrollSlip,
  POStatus,
  ProcurementCategory,
  PurchaseOrder,
  PurchaseRequisition,
  RequestForQuotation,
  RequisitionPriority,
  RequisitionStatus,
  ServerRecordInfo,
  StockBalance,
  StockReservation,
  StockReturn,
  StocktakeAudit,
  StoreIssueVoucher,
  Supplier,
  VendorInvoice,
  Warehouse,
} from '../../types';
import { toPersianDigits } from '../../utils/formatters';
import { isoToJalali } from '../../utils/jalali';
import { qty } from './contracts';
import { arr, int, jdate, obj, rial, str } from './mapping';

type Obj = Record<string, unknown>;
const R = '/inventory';

const idOr = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const text = (o: Obj, k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
const jd = (v: unknown) => (typeof v === 'string' && v ? isoToJalali(v.slice(0, 10)) || '' : '');
const entryNo = (v: unknown) => (v && typeof v === 'object' && typeof (v as Obj).number === 'string' ? ((v as Obj).number as string) : undefined);
const historyOf = (o: Obj) => (Array.isArray(o.history) ? (o.history as Obj[]) : []);

function serverInfo(o: Obj, extra: Partial<ServerRecordInfo> = {}): ServerRecordInfo {
  return {
    version: typeof o.version === 'number' ? o.version : 0,
    status: String(o.status ?? ''),
    currentStep: typeof o.current_step === 'string' ? o.current_step : null,
    createdById: idOr(o.created_by ?? o.requested_by) || undefined,
    lastApprovedById: idOr(o.last_approved_by) || null,
    entryNumber: entryNo(o.entry),
    ...extra,
  };
}

// ---------------------------------------------------------------------------- inventory

export const WAREHOUSE_KIND: Record<string, Warehouse['type']> = { central: 'مرکزی', project: 'کارگاهی', temporary: 'موقت کارگاهی' };
export const WAREHOUSE_KIND_KEYS: Record<string, string> = { مرکزی: 'central', کارگاهی: 'project', 'موقت کارگاهی': 'temporary' };

export function parseMaterial(raw: unknown): MaterialItem {
  const o = obj(R, raw);
  return {
    id: str(R, o, 'id'),
    code: str(R, o, 'code'),
    name: str(R, o, 'name'),
    category: (text(o, 'category') || 'تجهیز کارگاه و HSE') as MaterialCategory,
    unit: str(R, o, 'unit'),
    specifications: text(o, 'specification'),
    reorderLevel: qty(o.reorder_level),
    minSafetyStock: qty(o.min_stock),
    maxCapacity: qty(o.max_stock),
    currentStock: qty(o.stock_qty),
    averageUnitPrice: num(o.average_cost),
    totalStockValue: num(o.stock_value),
    requiresInspection: false,
    server: serverInfo(o, { status: o.active === false ? 'inactive' : 'active' }),
  };
}

export function parseWarehouse(raw: unknown): Warehouse {
  const o = obj(R, raw);
  return {
    id: str(R, o, 'id'),
    code: str(R, o, 'code'),
    name: str(R, o, 'name'),
    projectId: idOr(o.project_id) || undefined,
    projectName: text(o, 'project_name') || 'ستاد مرکزی',
    location: text(o, 'location'),
    type: WAREHOUSE_KIND[String(o.kind)] || 'مرکزی',
    keeperName: text(o, 'keeper_name'),
    phone: '',
    areaM2: 0,
    status: o.active === false ? 'تکمیل' : o.kind === 'temporary' ? 'موقت' : 'فعال',
    itemsCount: num(o.items_count),
    totalValuation: num(o.valuation),
    server: serverInfo(o, { status: String(o.kind) }),
  };
}

export function parseBalance(raw: unknown): StockBalance {
  const o = obj(R, raw);
  return { warehouseId: str(R, o, 'warehouse_id'), materialId: str(R, o, 'material_id'), qty: qty(o.qty), reservedQty: qty(o.reserved) };
}

const KARDEX_TYPE: Record<string, KardexEntry['docType']> = {
  goods_receipt: 'رسید ورود انبار',
  store_issue: 'حواله مصرف کارگاه',
  transfer_in: 'انتقال ورودی',
  transfer_out: 'انتقال خروجی',
  stocktake: 'تعدیل انبارگردانی',
  project_return: 'برگشت از پروژه',
  supplier_return: 'برگشت به تأمین‌کننده',
};

export function parseKardex(raw: unknown, averages: ReadonlyMap<string, number>): KardexEntry {
  const o = obj(R, raw);
  const inQty = qty(o.in_qty);
  const outQty = qty(o.out_qty);
  const moved = inQty || outQty;
  const value = Math.abs(num(o.value));
  const balanceQty = qty(o.balance_qty);
  const materialId = str(R, o, 'material_id');
  return {
    id: str(R, o, 'id'),
    materialId,
    warehouseId: str(R, o, 'warehouse_id'),
    date: jdate(R, o, 'date'),
    docType: KARDEX_TYPE[String(o.doc_type)] || 'رسید ورود انبار',
    docNumber: text(o, 'doc_number'),
    warehouseName: text(o, 'warehouse_name'),
    counterparty: text(o, 'counterparty'),
    inQty,
    outQty,
    balanceQty,
    unitCost: moved ? Math.round(value / moved) : 0,
    balanceValuation: Math.round(balanceQty * (averages.get(materialId) || 0)),
  };
}

const issueStatus = (s: string): StoreIssueVoucher['status'] => (s === 'issued' ? 'خروج قطعی از انبار' : 'درخواست اولیه');

export function parseStoreIssue(raw: unknown, subcontractorName: (id: string) => string = () => ''): StoreIssueVoucher {
  const o = obj(R, raw);
  const lines = arr(R, o, 'lines').map((l) => obj(R, l));
  const party = idOr(o.counterparty_id);
  return {
    id: str(R, o, 'id'),
    issueNumber: str(R, o, 'number', true),
    date: jdate(R, o, 'date'),
    warehouseId: str(R, o, 'warehouse_id'),
    warehouseName: text(o, 'warehouse_name'),
    projectId: str(R, o, 'project_id'),
    projectName: text(o, 'project_name'),
    costCenterId: idOr(o.cost_center_id) || undefined,
    costCenter: '',
    counterpartyId: party || undefined,
    wbsSection: '',
    subcontractorId: party || undefined,
    subcontractorName: party ? subcontractorName(party) : undefined,
    isSubcontractorContra: false,
    applicantName: text(o, 'requested_by_name'),
    approvedByManagerName: text(o, 'confirmed_by_name'),
    dispatchedByKeeperName: '',
    receivedByCrewLeaderName: '',
    items: lines.map((l) => {
      const q = qty(l.quantity);
      const amount = num(l.amount);
      return {
        materialId: str(R, l, 'material_id'),
        materialCode: text(l, 'material_code'),
        materialName: text(l, 'material_name'),
        unit: text(l, 'unit'),
        requestedQty: q,
        issuedQty: q,
        unitCost: q ? Math.round(amount / q) : 0,
        totalCost: amount,
      };
    }),
    totalCost: num(o.total_cost),
    requestedById: idOr(o.requested_by) || undefined,
    confirmedById: idOr(o.confirmed_by) || undefined,
    status: issueStatus(String(o.status)),
    accountingJournalEntryId: entryNo(o.entry),
    server: serverInfo(o, { lineIds: lines.map((l) => String(l.id)), extra: { lineMaterials: lines.map((l) => String(l.material_id)) } }),
  };
}

/** Reservations of the requested issues (the server keeps them in the balances). */
export function reservationsOf(issues: readonly StoreIssueVoucher[]): StockReservation[] {
  return issues
    .filter((v) => v.server?.status === 'requested')
    .flatMap((v) => v.items.map((i, n) => ({ id: `${v.id}:${n}`, warehouseId: v.warehouseId, materialId: i.materialId, qty: i.issuedQty, projectId: v.projectId, issueId: v.id, status: 'active' as const, date: v.date })));
}

export function parseStockReturn(raw: unknown): StockReturn {
  const o = obj(R, raw);
  return {
    id: str(R, o, 'id'),
    returnNumber: str(R, o, 'number', true),
    date: jdate(R, o, 'date'),
    kind: o.kind === 'warehouse_to_supplier' ? 'warehouse_to_supplier' : 'project_to_warehouse',
    sourceId: str(R, o, 'source_id'),
    sourceNumber: '',
    warehouseId: str(R, o, 'warehouse_id'),
    projectId: idOr(o.project_id),
    materialId: str(R, o, 'material_id'),
    qty: qty(o.quantity),
    unitCost: qty(o.quantity) ? Math.round(num(o.amount) / qty(o.quantity)) : 0,
    totalCost: num(o.amount),
    reason: text(o, 'reason'),
    journalEntryId: entryNo(o.entry),
  };
}

export function parseTransfer(raw: unknown): InterWarehouseTransfer {
  const o = obj(R, raw);
  const lines = arr(R, o, 'lines').map((l) => obj(R, l));
  return {
    id: str(R, o, 'id'),
    transferNumber: str(R, o, 'number', true),
    date: jdate(R, o, 'date'),
    sourceWarehouseId: str(R, o, 'source_warehouse_id'),
    sourceWarehouseName: text(o, 'source_warehouse_name'),
    sourceProjectId: idOr(o.source_project_id),
    targetWarehouseId: str(R, o, 'target_warehouse_id'),
    targetWarehouseName: text(o, 'target_warehouse_name'),
    targetProjectId: idOr(o.target_project_id),
    waybillNumber: text(o, 'waybill'),
    driverName: text(o, 'driver_name'),
    truckPlate: '',
    items: lines.map((l) => {
      const q = qty(l.quantity);
      return { materialId: str(R, l, 'material_id'), materialCode: text(l, 'material_code'), materialName: text(l, 'material_name'), unit: text(l, 'unit'), quantity: q, unitCost: q ? Math.round(num(l.amount) / q) : 0, totalCost: num(l.amount) };
    }),
    totalCost: num(o.total_cost),
    status: o.status === 'delivered' ? 'تخلیه و تحویل قطعی مقصد' : 'صدور مجوز',
    authorizedBy: text(o, 'created_by_name'),
    server: serverInfo(o),
  };
}

export function parseStocktake(raw: unknown): StocktakeAudit {
  const o = obj(R, raw);
  const lines = arr(R, o, 'lines').map((l) => obj(R, l));
  const status = String(o.status);
  return {
    id: str(R, o, 'id'),
    auditNumber: str(R, o, 'number', true),
    date: jdate(R, o, 'date'),
    warehouseId: str(R, o, 'warehouse_id'),
    warehouseName: text(o, 'warehouse_name'),
    leadAuditor: text(o, 'created_by_name'),
    teamMembers: [],
    items: lines.map((l) => {
      const system = qty(l.system_qty);
      const physical = qty(l.physical_qty);
      const variance = num(l.gain_amount) - num(l.loss_amount);
      const vq = physical - system;
      return {
        materialId: str(R, l, 'material_id'),
        materialCode: text(l, 'material_code'),
        materialName: text(l, 'material_name'),
        unit: text(l, 'unit'),
        systemStock: system,
        physicalCount: physical,
        varianceQty: vq,
        unitPrice: vq ? Math.round(Math.abs(variance / vq)) : 0,
        varianceAmount: variance,
      };
    }),
    netVarianceAmount: num(o.gain_amount) - num(o.loss_amount),
    status: status === 'approved' ? 'تأیید نهایی و صدور سند تعدیل' : status === 'pending' ? 'مغایرت‌گیری و بازشماری' : 'شمارش در جریان',
    accountingAdjustmentEntryId: entryNo(o.entry),
    server: serverInfo(o, { extra: { rejectReason: text(o, 'reject_reason') } }),
  };
}

export function inventorySlices(raw: unknown, partyName: (id: string) => string = () => '') {
  const o = obj(R, raw);
  const materials = arr(R, o, 'materials').map(parseMaterial);
  const averages = new Map(materials.map((m) => [m.id, m.averageUnitPrice]));
  const storeIssues = arr(R, o, 'issues').map((v) => parseStoreIssue(v, partyName)).filter((v) => v.server?.status !== 'cancelled');
  return {
    materials,
    warehouses: arr(R, o, 'warehouses').map(parseWarehouse),
    stockBalances: arr(R, o, 'balances').map(parseBalance),
    storeIssues,
    stockReservations: reservationsOf(storeIssues),
    stockReturns: arr(R, o, 'returns').map(parseStockReturn),
    interTransfers: arr(R, o, 'transfers').map(parseTransfer).filter((t) => t.server?.status !== 'cancelled'),
    stocktakes: arr(R, o, 'stocktakes').map(parseStocktake),
    kardex: Array.isArray(o.kardex) ? o.kardex.map((k) => parseKardex(k, averages)) : [],
  };
}

// ---------------------------------------------------------------------------- procurement

const P = '/procurement';
const PRIORITY: Record<string, RequisitionPriority> = { normal: 'عادی', urgent: 'بالا', critical: 'فوری کارگاهی (حیاتی)' };
export const PRIORITY_KEYS: Record<RequisitionPriority, string> = { 'عادی': 'normal', 'بالا': 'urgent', 'فوری کارگاهی (حیاتی)': 'critical', 'دوره‌ای برنامه‌ریزی‌شده': 'normal' };

function requisitionStatus(status: string, step: number): RequisitionStatus {
  switch (status) {
    case 'pending':
      return step === 0 ? 'پیش‌نویس کارگاه' : 'تأیید فنی پروژه';
    case 'approved':
      return 'مصوبه مدیر تدارکات';
    case 'rfq':
      return 'در حال استعلام بها (RFQ)';
    case 'ordered':
      return 'سفارش صادر شده (PO)';
    default:
      return 'لغو شده';
  }
}

export function parseRequisition(raw: unknown): PurchaseRequisition {
  const o = obj(P, raw);
  const approvals: PurchaseRequisition['approvals'] = {};
  for (const h of historyOf(o)) {
    if (h.action !== 'approved') continue;
    const sign = { approved: true, date: jd(h.at), signedBy: String(h.user_name || ''), signedById: idOr(h.user_id) };
    if (h.step === 'مدیر پروژه') approvals.projectManager = sign;
    else if (h.step === 'حسابدار') approvals.procurementManager = sign;
  }
  const lines = arr(P, o, 'lines').map((l) => obj(P, l));
  const status = String(o.status);
  return {
    id: str(P, o, 'id'),
    requisitionNumber: str(P, o, 'number', true),
    date: jd(o.created_at),
    projectId: str(P, o, 'project_id'),
    projectName: text(o, 'project_name'),
    wbsCode: '',
    costCenterId: idOr(o.cost_center_id) || undefined,
    costCenter: '',
    priority: PRIORITY[String(o.priority)] || 'عادی',
    status: requisitionStatus(status, int(P, o, 'step_index')),
    requesterName: text(o, 'created_by_name'),
    requesterId: idOr(o.created_by) || undefined,
    requesterRole: '',
    approvals,
    items: lines.map((l) => {
      const q = qty(l.quantity);
      return {
        id: str(P, l, 'id'),
        materialCode: l.kind === 'service' ? text(l, 'account_code') : '',
        materialName: text(l, 'description'),
        specification: l.kind === 'service' ? 'خدمت' : '',
        category: (l.kind === 'service' ? 'خدمات مهندسی و پیمانکاران دست‌دوم' : 'آهن‌آلات و مقاطع فولادی') as ProcurementCategory,
        requestedQty: q,
        approvedQty: q,
        unit: text(l, 'unit'),
        estimatedUnitPrice: num(l.estimated_rate),
        estimatedTotalPrice: num(l.estimated_amount),
        requiredDeliveryDate: jd(o.needed_date),
      };
    }),
    totalEstimatedAmount: num(o.estimated_total),
    justification: text(o, 'justification'),
    server: serverInfo(o, { lineIds: lines.map((l) => String(l.id)), extra: { rejectReason: text(o, 'reject_reason') } }),
  };
}

export function parseRfq(raw: unknown, requisitions: readonly PurchaseRequisition[]): RequestForQuotation {
  const o = obj(P, raw);
  const req = requisitions.find((r) => r.id === String(o.requisition_id));
  const lineQty = new Map((req?.items || []).map((i) => [i.id, i.requestedQty]));
  const quotes: BidSupplierQuote[] = arr(P, o, 'quotes').map((q) => {
    const x = obj(P, q);
    const prices = Array.isArray(x.prices) ? (x.prices as Obj[]) : [];
    const subtotal = num(x.subtotal);
    return {
      id: str(P, x, 'id'),
      supplierId: str(P, x, 'counterparty_id'),
      supplierName: text(x, 'counterparty_name'),
      supplierGrade: 'A',
      quoteReferenceNumber: text(x, 'reference'),
      unitPrice: prices.length === 1 ? num(prices[0].rate) : Math.round(subtotal / Math.max(1, (req?.items || []).reduce((a, i) => a + i.requestedQty, 0))),
      freightCostPerUnit: 0,
      vatIncluded: x.vat_included === true,
      vatAmount: 0,
      totalQuoteAmount: subtotal + num(x.freight),
      deliveryLeadTimeDays: num(x.delivery_days),
      paymentTerms: text(x, 'payment_terms'),
      technicalCompliance: 'منطبق کامل',
      warrantyMonths: 0,
      scoreTechnical: 0,
      scoreCommercial: 0,
      compositeScore: 0,
      notes: text(x, 'notes') || undefined,
      isWinningBid: x.winner === true,
    };
  });
  const status = String(o.status);
  const winner = quotes.find((q) => q.isWinningBid);
  return {
    id: str(P, o, 'id'),
    rfqNumber: str(P, o, 'number', true),
    title: text(o, 'title'),
    dateCreated: '',
    submissionDeadline: jd(o.deadline),
    requisitionId: str(P, o, 'requisition_id'),
    requisitionNumber: text(o, 'requisition_number'),
    projectId: str(P, o, 'project_id'),
    projectName: text(o, 'project_name'),
    category: 'آهن‌آلات و مقاطع فولادی',
    materialName: (req?.items || []).map((i) => i.materialName).join('، '),
    specification: '',
    requiredQty: [...lineQty.values()].reduce((a, b) => a + b, 0),
    unit: req?.items[0]?.unit || '',
    quotes,
    status: status === 'awarded' ? 'برنده مشخص شد' : status === 'ordered' ? 'تبدیل به سفارش (PO)' : status === 'cancelled' ? 'لغو شده' : 'در حال استعلام',
    selectedSupplierId: winner?.supplierId,
    selectedSupplierName: winner?.supplierName,
    server: serverInfo(o, { lineIds: (req?.items || []).map((i) => i.id) }),
  };
}

const PO_STATUS: Record<string, POStatus> = {
  pending: 'پیش‌نویس',
  approved: 'صادر شده و ابلاغ به فروشنده',
  partial: 'تحویل جزئی در انبار',
  received: 'تحویل کامل',
  closed: 'تسویه حساب نهایی و مختومه',
  rejected: 'فسخ شده',
  cancelled: 'فسخ شده',
};

export function parsePurchaseOrder(raw: unknown): PurchaseOrder {
  const o = obj(P, raw);
  const lines = arr(P, o, 'lines').map((l) => obj(P, l));
  const history = historyOf(o);
  const ordered = lines.reduce((a, l) => a + qty(l.quantity), 0);
  const received = lines.reduce((a, l) => a + qty(l.received_qty), 0);
  return {
    id: str(P, o, 'id'),
    poNumber: str(P, o, 'number', true),
    issueDate: jdate(P, o, 'issue_date'),
    deliveryDueDate: jd(o.due_date),
    requisitionId: idOr(o.requisition_id) || undefined,
    rfqId: idOr(o.rfq_id) || undefined,
    projectId: str(P, o, 'project_id'),
    projectName: text(o, 'project_name'),
    costCenterId: idOr(o.cost_center_id) || undefined,
    counterpartyId: str(P, o, 'counterparty_id'),
    destinationWarehouse: text(o, 'warehouse_name'),
    supplierId: str(P, o, 'counterparty_id'),
    supplierName: text(o, 'counterparty_name'),
    supplierPhone: '',
    supplierAddress: '',
    items: lines.map((l) => ({
      id: str(P, l, 'id'),
      materialCode: text(l, 'account_code'),
      materialName: text(l, 'description'),
      specifications: l.kind === 'service' ? 'خدمت' : '',
      orderedQty: qty(l.quantity),
      receivedQty: qty(l.received_qty),
      unit: text(l, 'unit'),
      unitPrice: num(l.rate),
      totalNetPrice: num(l.amount),
      vatRate: num(o.vat_rate) / 100,
      vatAmount: num(l.vat_amount),
      freightAndUnloadingCost: 0,
      totalGrossAmount: num(l.amount) + num(l.vat_amount),
    })),
    subtotalAmount: num(o.subtotal),
    totalVatAmount: num(o.vat_amount),
    totalFreightCost: num(o.freight),
    totalOrderAmount: num(o.total),
    paymentTerms: text(o, 'payment_terms'),
    advancePaymentAmount: 0,
    advancePaymentPaid: false,
    status: PO_STATUS[String(o.status)] || 'پیش‌نویس',
    deliveryProgressPercentage: ordered ? Math.round((received / ordered) * 100) : 0,
    termsAndConditions: [],
    issuedBy: text(o, 'created_by_name'),
    approvedBy: text(o, 'approved_by_name'),
    server: serverInfo(o, {
      currentStep: o.status === 'pending' ? 'مدیر ارشد' : null,
      lineIds: lines.map((l) => String(l.id)),
      lastApprovedById: idOr(o.approved_by) || null,
      extra: { warehouseId: idOr(o.warehouse_id), kinds: lines.map((l) => String(l.kind)), materials: lines.map((l) => idOr(l.material_id)), history: history.length },
    }),
  };
}

export function parseGoodsReceipt(raw: unknown): GoodsReceiptNote {
  const o = obj(P, raw);
  const lines = arr(P, o, 'lines').map((l) => obj(P, l));
  return {
    id: str(P, o, 'id'),
    receiptNumber: str(P, o, 'number', true),
    date: jdate(P, o, 'date'),
    poId: str(P, o, 'po_id'),
    warehouseId: idOr(o.warehouse_id),
    warehouseName: text(o, 'warehouse_name'),
    projectId: str(P, o, 'project_id'),
    projectName: text(o, 'project_name'),
    costCenterId: idOr(o.cost_center_id) || undefined,
    counterpartyId: str(P, o, 'counterparty_id'),
    supplierId: str(P, o, 'counterparty_id'),
    supplierName: text(o, 'counterparty_name'),
    invoiceNumber: '-',
    waybillNumber: text(o, 'waybill'),
    truckPlateNumber: '',
    driverName: '',
    driverPhone: '',
    qcApprovalStatus: o.qc_status === 'rejected' ? 'مردود' : o.qc_status === 'conditional' ? 'تأیید مشروط' : 'تأیید کامل',
    items: lines.map((l) => ({
      materialId: idOr(l.material_id),
      materialCode: '',
      materialName: text(l, 'description'),
      unit: text(l, 'unit'),
      orderedQty: 0,
      deliveredQty: qty(l.delivered_qty),
      rejectedQty: qty(l.rejected_qty),
      acceptedQty: qty(l.accepted_qty),
      unitPrice: num(l.rate),
      totalPrice: num(l.amount),
    })),
    totalAmount: num(o.total),
    status: 'تأیید نهایی انبارداری',
    receiverName: text(o, 'created_by_name'),
    accountingJournalEntryId: entryNo(o.entry),
    server: serverInfo(o, { status: o.invoice_id ? 'invoiced' : 'open', lineIds: lines.map((l) => String(l.id)), extra: { invoiceId: idOr(o.invoice_id), kinds: lines.map((l) => String(l.kind)) } }),
  };
}

export function parseVendorInvoice(raw: unknown): VendorInvoice {
  const o = obj(P, raw);
  const status = String(o.status);
  const paid = num(o.paid_amount);
  const owed = num(o.total) - num(o.returned_amount);
  const mapped: VendorInvoice['status'] =
    status === 'pending' ? 'در حال تطبیق' : status === 'approved' ? (paid >= owed && owed > 0 ? 'پرداخت شده' : paid > 0 ? 'پرداخت ناقص' : 'تأیید تطبیق سه‌جانبه') : 'دارای مغایرت و متوقف';
  const variance = num(o.price_variance);
  return {
    id: str(P, o, 'id'),
    invoiceNumber: str(P, o, 'invoice_no'),
    systemRefNumber: str(P, o, 'number', true),
    invoiceDate: jdate(P, o, 'invoice_date'),
    dueDate: jd(o.due_date),
    projectId: str(P, o, 'project_id'),
    projectName: text(o, 'project_name'),
    costCenterId: idOr(o.cost_center_id) || undefined,
    counterpartyId: str(P, o, 'counterparty_id'),
    supplierId: str(P, o, 'counterparty_id'),
    supplierName: text(o, 'counterparty_name'),
    poId: str(P, o, 'po_id'),
    poNumber: text(o, 'po_number'),
    grnId: str(P, o, 'grn_id'),
    grnNumber: text(o, 'grn_number'),
    taxRegistrationNumber: '',
    subtotal: num(o.subtotal),
    vatAmount: num(o.vat_amount),
    shippingCost: num(o.freight),
    discounts: 0,
    totalAmount: num(o.total),
    paidAmount: paid,
    remainingBalance: rial(P, o, 'remaining_amount'),
    returnedAmount: num(o.returned_amount),
    registeredById: idOr(o.created_by) || undefined,
    approvedById: idOr(o.approved_by) || undefined,
    status: mapped,
    threeWayMatching: {
      poMatched: true,
      grnMatched: true,
      priceVarianceAmount: variance,
      qtyVarianceAmount: 0,
      status: status === 'approved' ? 'تأیید نهایی مالی' : o.match_status === 'mismatch' ? 'مغایرت قیمتی' : 'تطبیق کامل و بدون مغایرت',
      notes: text(o, 'match_notes') || text(o, 'reject_reason') || undefined,
    },
    accountingEntryNumber: entryNo(o.entry),
    server: serverInfo(o, { currentStep: status === 'pending' ? 'حسابدار' : null }),
  };
}

/** Suppliers of the app from the counterparties of kind «supplier» (the server's one party list). */
export function suppliersOf(parties: readonly { id: string; kind: string; name: string; nationalId?: string; economicCode?: string; phone?: string; email?: string; address?: string; shebaNumber?: string; bankName?: string }[]): Supplier[] {
  return parties
    .filter((c) => c.kind === 'supplier')
    .map((c) => ({
      id: c.id,
      code: c.id,
      name: c.name,
      category: 'آهن‌آلات و مقاطع فولادی',
      grade: 'A',
      nationalId: c.nationalId || '',
      economicCode: c.economicCode || '',
      contactPerson: '',
      phone: c.phone || '',
      mobile: '',
      email: c.email || '',
      city: '',
      address: c.address || '',
      bankAccount: { bankName: c.bankName || '', shebaNumber: c.shebaNumber || '', accountNumber: '', cardHolder: '' },
      hasVatCertificate: Boolean(c.economicCode),
      paymentTerms: 'اعتباری ماهانه',
      performance: { qualityScore: 0, deliveryScore: 0, priceCompetitiveness: 0, paymentFlexibility: 0, overallRating: 0, totalOrdersCount: 0, onTimeDeliveryRate: 0, rejectionRate: 0 },
      financials: { totalPurchasesAmount: 0, currentPayableBalance: 0, unclearedChecksAmount: 0, lastTransactionDate: '' },
      status: 'فعال در وندورلیست',
    }));
}

export function procurementSlices(raw: unknown) {
  const o = obj(P, raw);
  const purchaseRequisitions = arr(P, o, 'requisitions').map(parseRequisition);
  return {
    purchaseRequisitions,
    rfqs: arr(P, o, 'rfqs').map((r) => parseRfq(r, purchaseRequisitions)),
    purchaseOrders: arr(P, o, 'purchase_orders').map(parsePurchaseOrder),
    goodsReceipts: arr(P, o, 'goods_receipts').map(parseGoodsReceipt),
    vendorInvoices: arr(P, o, 'vendor_invoices').map(parseVendorInvoice),
    supplierReturns: arr(P, o, 'supplier_returns').map(parseStockReturn),
  };
}

// ---------------------------------------------------------------------------- payroll

const Y = '/payroll';
const CONTRACT: Record<string, Employee['contractType']> = { full_time: 'پیمانی تمام‌وقت', temporary: 'قراردادی موقت', hourly: 'ساعتی/مشاوره‌ای', daily: 'کارگری روزمزد' };
export const CONTRACT_KEYS: Record<Employee['contractType'], string> = { 'پیمانی تمام‌وقت': 'full_time', 'قراردادی موقت': 'temporary', 'ساعتی/مشاوره‌ای': 'hourly', 'کارگری روزمزد': 'daily' };

export const monthYearOf = (year: number, month: number) => toPersianDigits(`${year}/${String(month).padStart(2, '0')}`);

export function parseEmployee(raw: unknown, projectName: (id: string) => string): Employee {
  const o = obj(Y, raw);
  const full = str(Y, o, 'full_name');
  const [first, ...rest] = full.split(' ');
  const project = idOr(o.project_id);
  return {
    id: str(Y, o, 'id'),
    personnelCode: str(Y, o, 'code'),
    firstName: first,
    lastName: rest.join(' '),
    fullName: full,
    nationalCode: text(o, 'national_id'),
    birthDate: '',
    phone: '',
    email: '',
    role: text(o, 'job_title'),
    department: project ? 'اجرایی کارگاه' : 'مالی و اداری',
    assignedProjectId: project,
    assignedProjectName: project ? projectName(project) : 'ستاد مرکزی',
    costCenterId: str(Y, o, 'cost_center_id'),
    hireDate: jd(o.hire_date),
    contractType: CONTRACT[String(o.contract_type)] || 'پیمانی تمام‌وقت',
    baseSalary: num(o.base_salary),
    housingAllowance: num(o.housing_allowance),
    foodAllowance: num(o.food_allowance),
    childAllowance: num(o.child_allowance),
    specialSkillAllowance: num(o.other_benefits),
    childrenCount: 0,
    maritalStatus: 'مجرد',
    bankAccount: { bankName: text(o, 'bank_name'), shebaNumber: text(o, 'sheba'), accountNumber: text(o, 'account_number') },
    insuranceNumber: text(o, 'insurance_no'),
    status: o.active === false ? 'تسویه شده' : 'فعال',
    server: serverInfo(o, { status: o.active === false ? 'inactive' : 'active', extra: { userId: idOr(o.user_id), loanInstallment: num(o.loan_installment), otherDeduction: num(o.other_deduction), insured: o.insured !== false } }),
  };
}

export type PayrollPeriodView = PayrollPeriod;

export function parsePayrollPeriod(raw: unknown): PayrollPeriodView {
  const o = obj(Y, raw);
  const year = int(Y, o, 'fiscal_year');
  const month = int(Y, o, 'month');
  return {
    id: str(Y, o, 'id'),
    number: str(Y, o, 'number', true),
    fiscalYear: year,
    month,
    monthYear: monthYearOf(year, month),
    status: String(o.status),
    currentStep: typeof o.current_step === 'string' ? o.current_step : null,
    grossTotal: num(o.gross_total),
    netTotal: num(o.net_total),
    costTotal: num(o.cost_total),
    calculatedById: idOr(o.calculated_by) || null,
    lastApprovedById: idOr(o.last_approved_by) || null,
    rejectReason: text(o, 'reject_reason'),
    entryNumber: entryNo(o.entry),
    paymentRequests: (Array.isArray(o.payment_requests) ? (o.payment_requests as Obj[]) : []).map((p) => ({ id: String(p.id), number: String(p.number || ''), payableType: String(p.payable_type || ''), status: String(p.status || ''), amount: num(p.amount), paidAmount: num(p.paid_amount) })),
    version: int(Y, o, 'version'),
  };
}

export function parseTimesheet(raw: unknown, periods: readonly PayrollPeriodView[], employees: readonly Employee[]): MonthlyTimesheet {
  const o = obj(Y, raw);
  const period = periods.find((p) => p.id === String(o.period_id));
  const e = employees.find((x) => x.id === String(o.employee_id));
  return {
    id: str(Y, o, 'id'),
    employeeId: str(Y, o, 'employee_id'),
    employeeName: e?.fullName || '',
    monthYear: period?.monthYear || '',
    projectId: e?.assignedProjectId || '',
    standardWorkDays: 30,
    actualWorkDays: qty(o.work_days),
    absentDays: qty(o.absent_days),
    paidLeaveDays: 0,
    overtimeHours: qty(o.overtime_hours),
    nightWorkHours: 0,
    holidayWorkHours: 0,
    missionDays: qty(o.mission_days),
    status: 'تأیید منابع انسانی',
    server: { version: period?.version || 0, status: period?.status || '', extra: { periodId: String(o.period_id) } },
  };
}

const SLIP_STATUS: Record<string, PayrollSlip['status']> = { calculated: 'محاسبه شده', finance_approved: 'تأیید مالی', approved: 'صادر شده جهت پرداخت' };

export function parsePayslip(raw: unknown, periods: readonly PayrollPeriodView[], employees: readonly Employee[]): PayrollSlip {
  const o = obj(Y, raw);
  const period = periods.find((p) => p.id === String(o.period_id));
  const e = employees.find((x) => x.id === String(o.employee_id));
  const salaryRequest = period?.paymentRequests.find((r) => r.payableType === 'payroll');
  const paid = period?.status === 'approved' && salaryRequest && salaryRequest.paidAmount >= salaryRequest.amount;
  return {
    id: str(Y, o, 'id'),
    slipNumber: str(Y, o, 'number', true),
    monthYear: period?.monthYear || '',
    employeeId: str(Y, o, 'employee_id'),
    employeeName: text(o, 'employee_name'),
    personnelCode: text(o, 'employee_code'),
    role: text(o, 'job_title'),
    department: e?.department || '',
    projectId: idOr(o.project_id),
    projectName: e?.assignedProjectName || '',
    costCenterId: str(Y, o, 'cost_center_id'),
    issueDate: '',
    actualWorkDays: qty(o.work_days),
    overtimeHours: qty(o.overtime_hours),
    baseSalaryGross: num(o.base_pay),
    housingAllowance: num(o.housing),
    foodAllowance: num(o.food),
    childAllowance: num(o.child),
    specialSkillAllowance: num(o.other_benefits),
    overtimePay: num(o.overtime_pay),
    missionPay: num(o.mission_pay),
    grossTotalSalary: num(o.gross),
    workerInsuranceDeduction: num(o.worker_insurance),
    incomeTaxDeduction: num(o.income_tax),
    loanDeduction: num(o.loan_deduction),
    disciplinaryDeduction: num(o.other_deduction),
    totalDeductions: num(o.total_deductions),
    netPayableSalary: num(o.net),
    employerInsuranceContribution: num(o.employer_insurance),
    totalCostForCompany: num(o.cost),
    calculatedById: period?.calculatedById || undefined,
    approvedById: period?.status === 'approved' ? period.lastApprovedById || undefined : undefined,
    status: paid ? 'پرداخت شده' : SLIP_STATUS[period?.status || ''] || 'محاسبه شده',
    journalEntryId: period?.entryNumber,
    paymentRequestId: salaryRequest?.id,
    server: { version: period?.version || 0, status: period?.status || '', currentStep: period?.currentStep, createdById: period?.calculatedById || undefined, lastApprovedById: period?.lastApprovedById, extra: { periodId: String(o.period_id) } },
  };
}

export function payrollSlices(raw: unknown, projectName: (id: string) => string) {
  const o = obj(Y, raw);
  const employees = arr(Y, o, 'employees').map((e) => parseEmployee(e, projectName));
  const payrollPeriods = arr(Y, o, 'periods').map(parsePayrollPeriod);
  return {
    employees,
    payrollPeriods,
    timesheets: arr(Y, o, 'timesheets').map((t) => parseTimesheet(t, payrollPeriods, employees)),
    payrollSlips: arr(Y, o, 'payslips').map((s) => parsePayslip(s, payrollPeriods, employees)),
  };
}
