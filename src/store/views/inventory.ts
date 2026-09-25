/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** View models of inventory: issue and transfer form calculators, list totals and dashboard figures. */

import type { GoodsReceiptNote, InterWarehouseTransfer, KardexEntry, MaterialItem, StoreIssueVoucher, Warehouse } from '../../types';
import type { AppState } from '../types';
import { availableQty } from '../workflows';
import { ACCOUNTS } from '../postingRules';
import { generateUUID } from '../../utils/ids';
import { formatInt } from '../../utils/money';
import { percentOf, sumBy } from './common';

/** Ledger account that a store issue charges (shown on the voucher). */
export const MATERIALS_COST_ACCOUNT: string = ACCOUNTS.materialsCost;

// ---------------- Store issue form ----------------

export interface IssueLineInput {
  rowKey: string;
  materialId: string;
  qty: number;
  remarks?: string;
}

export interface StoreIssueFormInput {
  warehouseId: string;
  costCenter: string;
  wbsSection: string;
  subcontractorName: string;
  tradeType: string;
  isSubcontractorContra: boolean;
  subcontractorDeductionRef: string;
  receivedByCrewLeaderName: string;
  /** Request mode reserves the stock; the issue is confirmed later from the voucher. */
  reserveOnly: boolean;
  lines: IssueLineInput[];
}

export function newIssueLine(materials: readonly MaterialItem[]): IssueLineInput {
  return { rowKey: generateUUID(), materialId: materials[0]?.id || '', qty: 0, remarks: '' };
}

/** Issue lines priced at the weighted average cost, the free stock of each material, and the first problem. */
export function computeStoreIssueDraft(state: AppState, form: StoreIssueFormInput) {
  const materials = state.materials;
  const lines = form.lines.map((l) => {
    const m = materials.find((x) => x.id === l.materialId);
    const unitCost = m?.averageUnitPrice || 0;
    return {
      rowKey: l.rowKey,
      materialId: l.materialId,
      materialCode: m?.code || '',
      materialName: m?.name || '',
      unit: m?.unit || 'کیلوگرم',
      qty: l.qty,
      remarks: l.remarks,
      unitCost,
      totalCost: unitCost * l.qty,
      /** Free stock in the chosen warehouse (reservations already deducted). */
      freeQty: availableQty(state, form.warehouseId, l.materialId),
    };
  });
  const totalCost = sumBy(lines, (l) => l.totalCost);
  const warehouse = state.warehouses.find((w) => w.id === form.warehouseId);
  const project = warehouse ? state.projects.find((p) => p.id === warehouse.projectId) : undefined;

  let error: string | null = null;
  if (!warehouse) error = 'انبار مبدأ را انتخاب کنید.';
  else if (!project) error = 'این انبار به پروژه‌ای متصل نیست؛ حواله مصرف فقط از انبار پروژه صادر می‌شود.';
  else if (!form.wbsSection.trim()) error = 'لطفاً محل مصرف و فاز WBS را مشخص فرمایید.';
  else if (lines.some((l) => l.qty <= 0)) error = 'مقدار هر ردیف باید بیش از صفر باشد.';
  else {
    // Rows of the same material are summed before comparing with the free stock.
    const perMaterial = new Map<string, number>();
    for (const l of lines) perMaterial.set(l.materialId, (perMaterial.get(l.materialId) || 0) + l.qty);
    for (const [materialId, qty] of perMaterial) {
      const free = availableQty(state, form.warehouseId, materialId);
      if (qty > free) {
        const name = lines.find((l) => l.materialId === materialId)?.materialName;
        error = `موجودی آزاد ${name} در این انبار ${formatInt(free)} است؛ جمع درخواست ${formatInt(qty)}.`;
        break;
      }
    }
  }
  return { lines, totalCost, warehouse, project, error };
}

// ---------------- Inter-warehouse transfer form ----------------

export interface TransferLineInput {
  rowKey: string;
  materialId: string;
  quantity: number;
}

export interface TransferFormInput {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  waybillNumber: string;
  driverName: string;
  truckPlate: string;
  lines: TransferLineInput[];
}

export function newTransferLine(materials: readonly MaterialItem[]): TransferLineInput {
  return { rowKey: generateUUID(), materialId: materials[0]?.id || '', quantity: 0 };
}

export function computeTransferDraft(state: AppState, form: TransferFormInput) {
  const lines = form.lines.map((l) => {
    const m = state.materials.find((x) => x.id === l.materialId);
    const unitCost = m?.averageUnitPrice || 0;
    return {
      rowKey: l.rowKey,
      materialId: l.materialId,
      materialCode: m?.code || '',
      materialName: m?.name || '',
      unit: m?.unit || 'کیلوگرم',
      quantity: l.quantity,
      unitCost,
      totalCost: unitCost * l.quantity,
    };
  });
  const source = state.warehouses.find((w) => w.id === form.sourceWarehouseId);
  const target = state.warehouses.find((w) => w.id === form.targetWarehouseId);
  let error: string | null = null;
  if (!source || !target) error = 'انبار مبدأ و مقصد را انتخاب کنید.';
  else if (source.id === target.id) error = 'انبار مبدأ و مقصد نمی‌توانند یکسان باشند.';
  else if (lines.some((l) => l.quantity <= 0)) error = 'مقدار هر ردیف باید بیش از صفر باشد.';
  else if (!form.waybillNumber.trim()) error = 'شماره بارنامه را وارد کنید.';
  return { lines, totalCost: sumBy(lines, (l) => l.totalCost), source, target, error };
}

// ---------------- Lists and dashboard ----------------

export function selectInventoryDashboard(
  warehouses: readonly Warehouse[],
  materials: readonly MaterialItem[],
  receipts: readonly GoodsReceiptNote[],
  issues: readonly StoreIssueVoucher[],
  transfers: readonly InterWarehouseTransfer[]
) {
  const issueTotals = sumStoreIssues(issues);
  return {
    totalInventoryValuation: sumBy(warehouses, (w) => w.totalValuation),
    /** Stock at or below the reorder level. */
    criticalItems: materials.filter((m) => m.currentStock <= m.reorderLevel),
    /** Stock at or below the safety stock. */
    severelyLowItems: materials.filter((m) => m.currentStock <= m.minSafetyStock),
    totalReceiptsValue: sumBy(receipts, (r) => r.totalAmount),
    totalIssuesValue: issueTotals.totalCost,
    /** Materials charged back to subcontractors in their statements. */
    subcontractorContraValue: issueTotals.contraCost,
    inTransitTransfers: transfers.filter((t) => t.status === 'در مسیر حمل'),
  };
}

export function sumGoodsReceipts(receipts: readonly GoodsReceiptNote[]) {
  return { totalValue: sumBy(receipts, (r) => r.totalAmount) };
}

export function sumStoreIssues(issues: readonly StoreIssueVoucher[]) {
  return {
    totalCost: sumBy(issues, (i) => i.totalCost),
    contraCost: sumBy(issues.filter((i) => i.isSubcontractorContra), (i) => i.totalCost),
  };
}

/** In and out quantities of a material's kardex rows. */
export function kardexTotals(rows: readonly KardexEntry[]) {
  return { totalIn: sumBy(rows, (r) => r.inQty), totalOut: sumBy(rows, (r) => r.outQty) };
}

/** Stock value of the catalog and each item's fill level against its capacity. */
export function catalogFigures(materials: readonly MaterialItem[]) {
  return {
    totalValue: sumBy(materials, (m) => m.totalStockValue),
    fillPercent: (m: MaterialItem) => Math.min(100, Math.round(percentOf(m.currentStock, m.maxCapacity))),
  };
}

/** Value of a stock balance row at the weighted average price. */
export const stockValue = (qty: number, averageUnitPrice: number) => Math.round(qty * averageUnitPrice);
