/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signature boxes of a printed record from the record's own approval fields. With the server (akph/v1) the
 * boxes come from GET /print/signatures (the approval history on the server); these helpers serve the demo
 * data source and the modules whose history lives only in the record. A step without an approval stays empty.
 */

import type { DetailedProgressStatement, JournalEntry, PettyCashExpense, PrintSignature, SubcontractorProgressStatement } from '../../types';

const signed = (title: string, name: string | undefined, at: string | undefined): PrintSignature => ({ title, name: name || '', at: name && at ? at : null, signed: !!name });
const empty = (title: string): PrintSignature => ({ title, name: '', at: null, signed: false });

/** Last history row that moved the record into `status` (null when it never got there, or was sent back since). */
function reached<T extends { toStatus: string; user: string; date: string }>(history: readonly T[], status: string, resetTo: readonly string[]): T | null {
  let hit: T | null = null;
  for (const h of history) {
    if (resetTo.includes(h.toStatus)) hit = null;
    if (h.toStatus === status) hit = h;
  }
  return hit;
}

export function journalEntrySignatures(entry: JournalEntry): PrintSignature[] {
  const final = entry.status === 'ثبت قطعی' || entry.status === 'تأیید شده' || entry.status === 'برگشت خورده';
  const approval = final ? [...entry.history].reverse().find((h) => /تأیید|قطعی/.test(h.action)) : undefined;
  return [signed('تهیه‌کننده', entry.submitter, entry.date), approval ? signed('تأییدکننده', approval.user, approval.date) : empty('تأییدکننده')];
}

export function pettyExpenseSignatures(expense: PettyCashExpense): PrintSignature[] {
  const out: PrintSignature[] = [signed('تنخواه‌دار (ثبت‌کننده)', expense.submitterName, expense.date)];
  for (const h of expense.approvalHistory) if (h.action === 'approved') out.push(signed(`تأیید ${h.approverRole || h.level}`, h.approverName, h.date));
  if (expense.status !== 'approved' && expense.status !== 'accounting_posted' && expense.status !== 'rejected') out.push(empty(typeof expense.currentApprovalStep === 'string' ? `تأیید ${expense.currentApprovalStep}` : 'تأیید'));
  return out;
}

const CLIENT_RESET = ['returned_for_correction', 'draft'];

export function clientStatementSignatures(s: DetailedProgressStatement): PrintSignature[] {
  const consultant = reached(s.workflowHistory, 'approved_by_consultant', CLIENT_RESET);
  const employer = reached(s.workflowHistory, 'approved_by_employer', CLIENT_RESET);
  return [
    signed('تهیه‌کننده (پیمانکار)', s.preparerName, s.preparationDate),
    consultant ? signed('تأیید مشاور', consultant.user, consultant.date) : empty('تأیید مشاور'),
    employer ? signed('تأیید کارفرما', employer.user, employer.date) : empty('تأیید کارفرما'),
  ];
}

const SUB_RESET = ['returned_for_revision', 'submitted'];
const SUB_STEPS: [string, string][] = [
  ['measured', 'اندازه‌گیری'],
  ['site_review', 'تأیید کارگاه'],
  ['pm_approved', 'تأیید مدیر پروژه'],
  ['finance_approved', 'تأیید مالی'],
  ['management_approved', 'تأیید مدیر ارشد'],
];

export function subcontractorStatementSignatures(s: SubcontractorProgressStatement): PrintSignature[] {
  const first = s.workflowHistory[0];
  return [
    signed('ثبت کارکرد', first?.user, first?.date),
    ...SUB_STEPS.map(([status, title]) => {
      const h = reached(s.workflowHistory, status, SUB_RESET);
      return h ? signed(title, h.user, h.date) : empty(title);
    }),
  ];
}
