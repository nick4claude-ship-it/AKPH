/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SubcontractorProgressStatement } from '../types';
import { AppState } from './types';
import { SUBCONTRACTOR_APPROVED_STATUSES } from './state';

/** A work line of a subcontract, identified by its description and unit. */
export interface SubcontractLine {
  key: string;
  description: string;
  unit: string;
  contractQuantity: number;
  unitRate: number;
  /** Quantity in approved statements (read-only "previous" of the next statement). */
  approvedQuantity: number;
  /** Quantity in statements still in the approval flow (counted against the contract quantity). */
  pendingQuantity: number;
}

export const lineKey = (description: string, unit: string) => `${description.trim()}|${unit.trim()}`;

const CLOSED = new Set(['rejected', 'returned_for_revision']);

/** Lines of a subcontract built from its statements; approved quantities come only from approved statements. */
export function selectSubcontractLines(state: Pick<AppState, 'subcontractorStatements'>, contractId: string, excludeStatementId?: string): SubcontractLine[] {
  const lines = new Map<string, SubcontractLine>();
  const statements = state.subcontractorStatements.filter((s) => s.subcontractorContractId === contractId && s.id !== excludeStatementId);
  for (const s of statements) {
    if (CLOSED.has(s.status)) continue;
    const approved = SUBCONTRACTOR_APPROVED_STATUSES.includes(s.status);
    for (const i of s.items) {
      const key = lineKey(i.description, i.unit);
      const cur = lines.get(key) || {
        key,
        description: i.description,
        unit: i.unit,
        contractQuantity: i.contractQuantity,
        unitRate: i.unitRate,
        approvedQuantity: 0,
        pendingQuantity: 0,
      };
      const qty = i.siteEngineerApprovedQty ?? i.currentQuantity;
      if (approved) cur.approvedQuantity += qty;
      else cur.pendingQuantity += qty;
      cur.contractQuantity = Math.max(cur.contractQuantity, i.contractQuantity);
      lines.set(key, cur);
    }
  }
  return [...lines.values()];
}

/** Advance paid to the subcontractor that has not yet been deducted in live statements. */
export function subcontractRemainingAdvance(state: Pick<AppState, 'subcontractorStatements' | 'subcontractorContracts'>, contractId: string, excludeStatementId?: string): number {
  const contract = state.subcontractorContracts.find((c) => c.id === contractId);
  if (!contract) return 0;
  const deducted = state.subcontractorStatements
    .filter((s) => s.subcontractorContractId === contractId && s.id !== excludeStatementId && !CLOSED.has(s.status))
    .reduce((a, s) => a + (s.deductions.advancePaymentDeduction || 0), 0);
  return Math.max(0, contract.advancePaid - deducted);
}

/** Validation shared by the form and the workflow. Returns an error message or null. */
export function validateSubcontractorStatement(
  state: Pick<AppState, 'subcontractorStatements' | 'subcontractorContracts'>,
  statement: SubcontractorProgressStatement
): string | null {
  const contract = state.subcontractorContracts.find((c) => c.id === statement.subcontractorContractId);
  if (!contract) return 'قرارداد پیمانکار جزء را انتخاب کنید.';
  if (!statement.items.length) return 'صورت‌وضعیت بدون ردیف است.';
  const lines = new Map(selectSubcontractLines(state, contract.id, statement.id).map((l) => [l.key, l]));
  const seen = new Set<string>();
  for (const i of statement.items) {
    const key = lineKey(i.description, i.unit);
    if (seen.has(key)) return `ردیف «${i.description}» تکراری است.`;
    seen.add(key);
    if (![i.currentQuantity, i.contractQuantity, i.unitRate].every((n) => Number.isSafeInteger(n) && n >= 0)) {
      return `مقادیر ردیف «${i.description}» باید عدد صحیح مثبت باشند.`;
    }
    const line = lines.get(key);
    const approvedPrevious = line?.approvedQuantity || 0;
    if (i.previousQuantity !== approvedPrevious) return `مقدار قبلی «${i.description}» باید برابر کارکرد تأییدشده (${approvedPrevious}) باشد.`;
    const committed = approvedPrevious + (line?.pendingQuantity || 0) + i.currentQuantity;
    const cap = line ? line.contractQuantity : i.contractQuantity;
    if (committed > cap) return `جمع مقدار «${i.description}» (${committed}) از مقدار قرارداد (${cap}) بیشتر است.`;
  }
  // Gross is the sum of quantity × rate of the period (each row and the total).
  for (const i of statement.items) {
    if (i.currentAmount !== i.currentQuantity * i.unitRate) return `مبلغ ردیف «${i.description}» باید برابر مقدار × نرخ (${i.currentQuantity * i.unitRate}) باشد.`;
  }
  const computedGross = statement.items.reduce((a, i) => a + i.currentQuantity * i.unitRate, 0);
  if (statement.grossAmount !== computedGross) return `مبلغ ناخالص صورت‌وضعیت (${statement.grossAmount}) با جمع مقدار × نرخ ردیف‌ها (${computedGross}) برابر نیست.`;
  const remainingAdvance = subcontractRemainingAdvance(state, contract.id, statement.id);
  if (statement.deductions.advancePaymentDeduction > remainingAdvance) return 'کسر پیش‌پرداخت از مانده پیش‌پرداخت قرارداد بیشتر است.';
  if (statement.totalDeductions > statement.grossAmount) return 'جمع کسورات از مبلغ ناخالص بیشتر است.';
  return null;
}
