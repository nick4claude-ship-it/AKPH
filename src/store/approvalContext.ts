/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DetailedProgressStatement,
  JournalEntry,
  PaymentRequest,
  PayrollSlip,
  PettyCashExpense,
  PurchaseRequisition,
  StoreIssueVoucher,
  SubcontractorProgressStatement,
  VendorInvoice,
} from '../types';
import { ActionContext, isApprovalAction } from '../utils/permissions';

/**
 * The separation-of-duties facts of each document, shared by the workflows (which enforce them) and the
 * UI (which disables the same buttons). Every value is a user id.
 */

type History = { userId?: string; stepAction?: string; toStatus?: string }[];

const RETURN_STATUSES = new Set(['returned_for_correction', 'returned_for_revision', 'rejected']);

/** Creator of a record with a workflow history: the user of its first entry. */
export const creatorOf = (history?: History) => history?.[0]?.userId;

/** Who approved the latest approval step since the document was last returned. */
export function lastApproverOf(history?: History): string | undefined {
  for (let i = (history?.length || 0) - 1; i >= 0; i--) {
    const h = history![i];
    if (h.toStatus && RETURN_STATUSES.has(h.toStatus)) return undefined;
    if (h.stepAction && isApprovalAction(h.stepAction)) return h.userId;
  }
  return undefined;
}

export const statementContext = (s: Pick<DetailedProgressStatement | SubcontractorProgressStatement, 'projectId' | 'workflowHistory'>): ActionContext => ({
  projectId: s.projectId,
  createdBy: creatorOf(s.workflowHistory),
  lastApprovedBy: lastApproverOf(s.workflowHistory),
});

export function pettyContext(e: PettyCashExpense): ActionContext {
  let last: string | undefined;
  for (const h of e.approvalHistory) {
    if (h.action !== 'approved') last = undefined;
    else if (h.level !== 'ثبت اولیه') last = h.approverId;
  }
  return { projectId: e.projectId, createdBy: e.submitterId, lastApprovedBy: last };
}

const REQUISITION_ORDER = ['siteSupervisor', 'projectManager', 'procurementManager', 'financialDirector'] as const;

export function requisitionContext(r: PurchaseRequisition): ActionContext {
  let last: string | undefined;
  for (const key of REQUISITION_ORDER) if (r.approvals[key]?.approved) last = r.approvals[key]!.signedById;
  return { projectId: r.projectId, createdBy: r.requesterId, lastApprovedBy: last };
}

export const paymentApprovalContext = (p: PaymentRequest): ActionContext => ({ projectId: p.projectId || null, createdBy: p.requestedById });
export const paymentExecutionContext = (p: PaymentRequest): ActionContext => ({ projectId: p.projectId || null, approvedBy: p.approvedById });
export const journalContext = (j: JournalEntry): ActionContext => ({ projectId: j.projectId || null, createdBy: j.submitterId });
export const storeIssueContext = (v: StoreIssueVoucher): ActionContext => ({ projectId: v.projectId || null, createdBy: v.requestedById });
export const vendorInvoiceContext = (i: VendorInvoice): ActionContext => ({ projectId: i.projectId || null, createdBy: i.registeredById });
export const payrollContext = (slips: PayrollSlip[]): ActionContext => ({ createdBy: slips.find((s) => s.calculatedById)?.calculatedById });
