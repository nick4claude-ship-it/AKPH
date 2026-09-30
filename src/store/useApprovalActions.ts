/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { ApprovalItem } from '../types';
import { useWorkflows } from './useWorkflows';
import { WorkflowResult } from './workflows';
import type { EmployerApprovalFields } from './recordWorkflows';

/**
 * Routes approve/reject from the approval center (or dashboard) back to the workflow of the
 * module that owns the record; the record itself never leaves its module.
 */
export function useApprovalActions() {
  const wf = useWorkflows();

  const approve = useCallback(
    (item: ApprovalItem, comment?: string, fields?: EmployerApprovalFields): WorkflowResult => {
      // akph/v1: the item names its own module's command (GET /approvals).
      if (item.server) return wf.decideServerApproval(item, 'approve', comment || '', fields);
      switch (item.module) {
        case 'client_statement':
          return wf.advanceClientStatement(item.recordId, comment);
        case 'subcontractor_statement':
          return wf.advanceSubcontractorStatement(item.recordId, comment);
        case 'petty_cash_expense':
          return wf.approvePettyCashExpense(item.recordId, comment);
        case 'vendor_invoice':
          return wf.approveVendorInvoice(item.recordId);
        case 'purchase_requisition':
          return wf.approveRequisition(item.recordId);
        case 'payment_request':
          return wf.approvePaymentRequest(item.recordId);
        case 'payroll':
          return wf.approvePayrollPeriod(item.recordId);
        case 'journal_entry':
          return wf.approveJournalEntry(item.recordId);
        default:
          return wf.decideServerApproval(item, 'approve', comment || '');
      }
    },
    [wf]
  );

  const reject = useCallback(
    (item: ApprovalItem, reason: string): WorkflowResult => {
      if (item.server) return wf.decideServerApproval(item, 'reject', reason);
      switch (item.module) {
        case 'client_statement':
          return wf.returnClientStatement(item.recordId, reason);
        case 'subcontractor_statement':
          return wf.returnSubcontractorStatement(item.recordId, reason);
        case 'petty_cash_expense':
          return wf.rejectPettyCashExpense(item.recordId, reason);
        case 'vendor_invoice':
          return wf.rejectVendorInvoice(item.recordId, reason);
        case 'purchase_requisition':
          return wf.cancelRequisition(item.recordId);
        case 'payment_request':
          return wf.rejectPaymentRequest(item.recordId, reason);
        case 'payroll':
          return { ok: false, message: 'فیش‌های حقوق باید در ماژول حقوق اصلاح و مجدد محاسبه شوند.' };
        case 'journal_entry':
          return wf.rejectJournalEntry(item.recordId, reason);
        default:
          return wf.decideServerApproval(item, 'reject', reason);
      }
    },
    [wf]
  );

  return { approve, reject };
}

/** Where the owning module shows the record. */
export const APPROVAL_MODULE_PATHS: Record<ApprovalItem['module'], string> = {
  client_statement: '/statements/client',
  subcontractor_statement: '/statements/subcontractor',
  petty_cash_expense: '/petty-cash',
  vendor_invoice: '/procurement',
  purchase_requisition: '/procurement',
  payment_request: '/finance/payments',
  payroll: '/payroll',
  journal_entry: '/finance/accounting',
  journal_reversal: '/finance/accounting',
  petty_adjustment: '/finance/accounting',
  bank_voucher: '/finance/accounting',
  petty_replenishment: '/petty-cash',
  receipt: '/finance/receipts',
  contract: '/contracts/client',
  contract_amendment: '/contracts/client',
};
