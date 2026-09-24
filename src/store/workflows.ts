/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserProfile,
  DetailedProgressStatement,
  SubcontractorProgressStatement,
  SubcontractorStatementWorkflowStatus,
  StatementWorkflowStatus,
  PettyCashExpense,
  PettyCashApprovalLevel,
  PaymentRequest,
  ReceiptRecord,
  GoodsReceiptNote,
  StoreIssueVoucher,
  StockBalance,
  StockReturn,
  AppDocument,
  DocumentLink,
  InterWarehouseTransfer,
  StocktakeAudit,
} from '../types';
import { AppState, SliceKey, SliceUpdater, PostingResult } from './types';
import type { PostFinancialEvent } from './AppStore';
import {
  clientStatementApprovedEvent,
  subcontractorStatementApprovedEvent,
  pettyCashExpenseApprovedEvent,
  vendorInvoiceEvent,
  goodsReceiptEvent,
  storeIssueEvent,
  payrollApprovedEvent,
} from './events';
import { buildPaymentRequest, payableTypeForRequest, NewPaymentRequestInput } from './paymentRequests';
import { receiveIntoStock } from './inventoryCosting';
import { payrollPeriodId } from './initialState';
import { canAct } from './session';
import { generateUUID, getNextSequentialDocNumber } from '../utils/ids';
import { toPersianDate, toPersianTime, getCurrentFiscalYear } from '../utils/date';

/**
 * سرویس‌های گردش‌کار: هر اقدام تجاری (تأیید، پرداخت، دریافت، رسید، حواله...) فقط این‌جا پیاده شده است.
 * ماژول مالک و مرکز تأییدات هر دو همین توابع را صدا می‌زنند تا رکورد در ماژول خودش باقی بماند.
 */

export interface WorkflowEnv {
  getState: () => AppState;
  set: <K extends SliceKey>(key: K, updater: SliceUpdater<K>) => void;
  post: PostFinancialEvent;
  user: UserProfile;
}

export interface WorkflowResult {
  ok: boolean;
  message: string;
  docNumber?: string;
  id?: string;
}

const ok = (message: string, extra: Partial<WorkflowResult> = {}): WorkflowResult => ({ ok: true, message, ...extra });
const fail = (message: string): WorkflowResult => ({ ok: false, message });
const fa = (n: number) => n.toLocaleString('fa-IR');
const today = () => toPersianDate(new Date());
const now = () => toPersianTime(new Date());
const denied = (role: string) => fail(`این مرحله باید توسط «${role}» انجام شود.`);

function postingFailure(r: PostingResult): WorkflowResult {
  return fail(r.error?.replace('[PostingEngine] ', '') || 'ثبت سند حسابداری انجام نشد.');
}

function queuePayment(env: WorkflowEnv, input: NewPaymentRequestInput): PaymentRequest | undefined {
  const exists = env
    .getState()
    .paymentRequests.find((r) => r.sourceType === input.sourceType && r.sourceRefId === input.sourceRefId && r.status !== 'رد شده');
  if (exists) return exists;
  let created: PaymentRequest | undefined;
  env.set('paymentRequests', (prev) => {
    created = buildPaymentRequest(prev, input, today());
    return [created, ...prev];
  });
  return created;
}

// =============================================================================
// Client progress statements
// Measurement → Statement → Consultant approval → Employer approval → Receivable → Receipt
// =============================================================================

export interface WorkflowStep<S extends string> {
  next: S;
  label: string;
  role: string;
}

export const CLIENT_STATEMENT_FLOW: Partial<Record<StatementWorkflowStatus, WorkflowStep<StatementWorkflowStatus>>> = {
  draft: { next: 'prepared', label: 'اندازه‌گیری و متره کارکرد', role: 'مدیر پروژه' },
  returned_for_correction: { next: 'prepared', label: 'اصلاح و اندازه‌گیری مجدد', role: 'مدیر پروژه' },
  prepared: { next: 'submitted_to_consultant', label: 'تنظیم و ارسال صورت‌وضعیت به مشاور', role: 'مدیر پروژه' },
  internal_review: { next: 'submitted_to_consultant', label: 'تنظیم و ارسال صورت‌وضعیت به مشاور', role: 'مدیر پروژه' },
  submitted_to_consultant: { next: 'approved_by_consultant', label: 'تأیید مشاور', role: 'مدیر پروژه' },
  under_consultant_review: { next: 'approved_by_consultant', label: 'تأیید مشاور', role: 'مدیر پروژه' },
  approved_by_consultant: { next: 'approved_by_employer', label: 'تأیید کارفرما', role: 'مدیر مالی' },
  submitted_to_employer: { next: 'approved_by_employer', label: 'تأیید کارفرما', role: 'مدیر مالی' },
};

/** Statuses that wait for an approval (as opposed to preparation work). */
export const CLIENT_STATEMENT_APPROVAL_STATUSES: StatementWorkflowStatus[] = [
  'submitted_to_consultant',
  'under_consultant_review',
  'approved_by_consultant',
  'submitted_to_employer',
];

function historyEntry(env: WorkflowEnv, from: any, to: any, action: string, comment?: string) {
  return { date: today(), time: now(), user: env.user.name, role: env.user.role, fromStatus: from, toStatus: to, action, comment };
}

export function advanceClientStatement(env: WorkflowEnv, id: string, comment?: string): WorkflowResult {
  const s = env.getState().clientStatements.find((x) => x.id === id);
  if (!s) return fail('صورت‌وضعیت یافت نشد.');
  const step = CLIENT_STATEMENT_FLOW[s.status];
  if (!step) return fail('این صورت‌وضعیت مرحله تأیید بعدی ندارد.');
  if (!canAct(env.user, step.role)) return denied(step.role);

  let updated: DetailedProgressStatement = {
    ...s,
    status: step.next,
    workflowHistory: [...s.workflowHistory, historyEntry(env, s.status, step.next, step.label, comment)],
  };
  let docNumber: string | undefined;

  if (step.next === 'approved_by_employer') {
    const contract = env.getState().contracts.find((c) => c.id === s.contractId);
    const posting = env.post(
      clientStatementApprovedEvent(s, s.costCenterId || contract?.costCenterId || '', s.counterpartyId || contract?.counterpartyId || ''),
      { submitter: env.user.name }
    );
    if (!posting.ok) return postingFailure(posting);
    docNumber = posting.event?.docNumber;
    const approvedNet = s.netPayable;
    updated = {
      ...updated,
      approvedNetPayable: approvedNet,
      remainingPayable: Math.max(0, approvedNet - s.receivedAmount),
      accountingJournalEntryId: docNumber,
    };
    if (!posting.duplicate && contract) {
      env.set('contracts', (prev) =>
        prev.map((c) =>
          c.id === contract.id
            ? { ...c, approvedBilledValue: c.approvedBilledValue + approvedNet, receivableValue: c.receivableValue + approvedNet }
            : c
        )
      );
    }
  }

  env.set('clientStatements', (prev) => prev.map((x) => (x.id === id ? updated : x)));
  return ok(
    docNumber ? `تأیید کارفرما ثبت شد؛ مطالبات با سند ${docNumber} شناسایی شد.` : `${step.label} انجام شد.`,
    { docNumber }
  );
}

export function returnClientStatement(env: WorkflowEnv, id: string, reason: string): WorkflowResult {
  const s = env.getState().clientStatements.find((x) => x.id === id);
  if (!s) return fail('صورت‌وضعیت یافت نشد.');
  if (!CLIENT_STATEMENT_FLOW[s.status]) return fail('صورت‌وضعیت تأییدشده قابل برگشت نیست.');
  env.set('clientStatements', (prev) =>
    prev.map((x) =>
      x.id === id
        ? {
            ...x,
            status: 'returned_for_correction',
            returnCorrectionNote: reason,
            workflowHistory: [...x.workflowHistory, historyEntry(env, x.status, 'returned_for_correction', 'برگشت جهت اصلاح', reason)],
          }
        : x
    )
  );
  return ok('صورت‌وضعیت جهت اصلاح برگشت داده شد.');
}

export interface ReceiptInput {
  sourceType: NonNullable<ReceiptRecord['sourceType']>;
  statementId?: string;
  counterpartyId?: string;
  projectId?: string;
  amount: number;
  bankAccountId: string;
  date?: string;
  method: ReceiptRecord['method'];
  trackingNumber: string;
  description?: string;
}

/** Receipts layer: every receipt goes to a chosen bank and, for statements, references the statement. */
export function recordReceipt(env: WorkflowEnv, input: ReceiptInput): WorkflowResult {
  const state = env.getState();
  const bank = state.bankAccounts.find((b) => b.id === input.bankAccountId);
  if (!bank) return fail('حساب بانکی مقصد را انتخاب کنید.');
  if (!(input.amount > 0)) return fail('مبلغ دریافت نامعتبر است.');

  const statement = input.statementId ? state.clientStatements.find((s) => s.id === input.statementId) : undefined;
  if (input.sourceType === 'صورت‌وضعیت کارفرما') {
    if (!statement) return fail('صورت‌وضعیت مرتبط را انتخاب کنید.');
    if (!['approved_by_employer', 'claimed', 'partially_paid'].includes(statement.status)) {
      return fail('فقط صورت‌وضعیت تأییدشده کارفرما قابل وصول است.');
    }
    if (input.amount > statement.remainingPayable) {
      return fail(`مبلغ از مانده مطالبات این صورت‌وضعیت (${fa(statement.remainingPayable)}) بیشتر است.`);
    }
  }
  const contract = statement ? state.contracts.find((c) => c.id === statement.contractId) : undefined;
  const counterpartyId = input.counterpartyId || statement?.counterpartyId || contract?.counterpartyId || '';
  const projectId = input.projectId || statement?.projectId || '';
  const project = state.projects.find((p) => p.id === projectId);
  const payer = state.counterparties.find((c) => c.id === counterpartyId);
  const id = generateUUID();
  const docNumber = getNextSequentialDocNumber(state.receipts.map((r) => r.docNumber), 'REC', 4, getCurrentFiscalYear());
  const receiptType = input.sourceType === 'پیش‌پرداخت' ? 'advance' : input.sourceType === 'سایر درآمدها' ? 'other_income' : 'statement';

  const posting = env.post(
    {
      type: 'TREASURY_RECEIPT',
      sourceModule: 'treasury',
      sourceId: id,
      projectId,
      costCenterId: statement?.costCenterId || contract?.costCenterId || '',
      counterpartyId,
      amount: input.amount,
      date: input.date || today(),
      details: {
        docNumber,
        receiptType,
        statementId: statement?.id,
        bankAccountId: bank.id,
        bankName: bank.bankName,
        trackingNumber: input.trackingNumber,
      },
    },
    { submitter: env.user.name }
  );
  if (!posting.ok) return postingFailure(posting);

  env.set('receipts', (prev) => [
    {
      id,
      docNumber,
      date: input.date || today(),
      amount: input.amount,
      counterpartyId,
      costCenterId: statement?.costCenterId || contract?.costCenterId,
      payer: payer?.name || statement?.client || '-',
      receiver: bank.bankName,
      projectId,
      projectName: project?.name || statement?.projectName,
      destinationAccount: `${bank.bankName} - ${bank.accountNumber}`,
      method: input.method,
      trackingNumber: input.trackingNumber,
      description: input.description || (statement ? `وصول ${statement.statementNumber}` : input.sourceType),
      journalEntryId: posting.event?.docNumber,
      status: 'وصول شده',
      sourceType: input.sourceType,
      statementId: statement?.id,
      contractId: statement?.contractId,
      bankAccountId: bank.id,
    },
    ...prev,
  ]);

  if (statement) {
    env.set('clientStatements', (prev) =>
      prev.map((s) => {
        if (s.id !== statement.id) return s;
        const receivedAmount = s.receivedAmount + input.amount;
        const remainingPayable = Math.max(0, (s.approvedNetPayable ?? s.netPayable) - receivedAmount);
        return {
          ...s,
          receivedAmount,
          remainingPayable,
          paymentStatus: remainingPayable === 0 ? 'Paid' : 'Partially Paid',
          status: remainingPayable === 0 ? 'paid' : 'partially_paid',
        };
      })
    );
    if (contract) {
      env.set('contracts', (prev) =>
        prev.map((c) =>
          c.id === contract.id
            ? { ...c, receivedValue: c.receivedValue + input.amount, receivableValue: Math.max(0, c.receivableValue - input.amount) }
            : c
        )
      );
    }
  }
  return ok(`دریافت ${docNumber} ثبت و سند ${posting.event?.docNumber} صادر شد.`, { docNumber: posting.event?.docNumber, id });
}

// =============================================================================
// Subcontractor progress statements
// Work → Measurement → Site approval → PM approval → Financial approval → CEO approval → Payable → Payment
// =============================================================================

export const SUBCONTRACTOR_STATEMENT_FLOW: Partial<Record<SubcontractorStatementWorkflowStatus, WorkflowStep<SubcontractorStatementWorkflowStatus>>> = {
  submitted: { next: 'measured', label: 'اندازه‌گیری کارکرد', role: 'سرپرست کارگاه' },
  returned_for_revision: { next: 'measured', label: 'اندازه‌گیری مجدد', role: 'سرپرست کارگاه' },
  measured: { next: 'site_review', label: 'تأیید کارگاه', role: 'سرپرست کارگاه' },
  site_review: { next: 'pm_approved', label: 'تأیید مدیر پروژه', role: 'مدیر پروژه' },
  pm_approved: { next: 'finance_approved', label: 'تأیید مالی', role: 'مدیر مالی' },
  finance_approved: { next: 'management_approved', label: 'تأیید مدیرعامل', role: 'مدیرعامل' },
};

export function advanceSubcontractorStatement(env: WorkflowEnv, id: string, comment?: string): WorkflowResult {
  const state = env.getState();
  const s = state.subcontractorStatements.find((x) => x.id === id);
  if (!s) return fail('صورت‌وضعیت یافت نشد.');
  const step = SUBCONTRACTOR_STATEMENT_FLOW[s.status];
  if (!step) return fail('این صورت‌وضعیت مرحله تأیید بعدی ندارد.');
  // CEO approval is reserved for the CEO; other steps also accept the CEO.
  if (step.next === 'management_approved' ? env.user.role !== 'مدیرعامل' : !canAct(env.user, step.role)) return denied(step.role);

  const d = today();
  const updated: SubcontractorProgressStatement = {
    ...s,
    status: step.next,
    workflowHistory: [...s.workflowHistory, historyEntry(env, s.status, step.next, step.label, comment || step.label)],
  };
  if (step.next === 'measured') Object.assign(updated, { measuredByName: env.user.name, measurementDate: d });
  if (step.next === 'site_review') Object.assign(updated, { siteReviewerName: env.user.name, siteReviewDate: d, siteReviewNote: comment });
  if (step.next === 'pm_approved') Object.assign(updated, { pmApproverName: env.user.name, pmApprovalDate: d, pmApprovalNote: comment });
  if (step.next === 'finance_approved') Object.assign(updated, { financeApproverName: env.user.name, financeApprovalDate: d, financeApprovalNote: comment });

  let docNumber: string | undefined;
  if (step.next === 'management_approved') {
    Object.assign(updated, { managementApproverName: env.user.name, managementApprovalDate: d, managementApprovalNote: comment });
    // Financial trigger: Dr project cost / Cr subcontractor payable and deductions, then a treasury request.
    const posting = env.post(subcontractorStatementApprovedEvent(updated), { submitter: env.user.name });
    if (!posting.ok) return postingFailure(posting);
    docNumber = posting.event?.docNumber;
    updated.projectExpenseRecordId = docNumber;
    if (!posting.duplicate) {
      env.set('subcontractorContracts', (prev) =>
        prev.map((c) =>
          c.id === s.subcontractorContractId
            ? { ...c, approvedStatementsValue: c.approvedStatementsValue + s.netPayable, remainingPayableValue: c.remainingPayableValue + s.netPayable }
            : c
        )
      );
    }
    const remaining = s.netPayable - s.paidAmount;
    if (remaining > 0) {
      queuePayment(env, {
        sourceType: 'صورت‌وضعیت پیمانکار جزء',
        sourceRefId: s.id,
        sourceRefNumber: s.statementNumber,
        projectId: s.projectId,
        projectName: s.projectName,
        costCenterId: s.costCenterId,
        counterpartyId: s.counterpartyId,
        beneficiaryName: s.subcontractorName,
        beneficiaryType: 'پیمانکار جزء',
        totalAmount: remaining,
      });
      // Approved by the CEO in the same act, so the request is ready for treasury.
      env.set('paymentRequests', (prev) =>
        prev.map((r) =>
          r.sourceType === 'صورت‌وضعیت پیمانکار جزء' && r.sourceRefId === s.id && r.status === 'در انتظار تأیید مالی'
            ? { ...r, status: 'تأیید مدیرعامل', approvedBy: `${env.user.name} (${env.user.role})`, approvedDate: d }
            : r
        )
      );
    }
  }

  env.set('subcontractorStatements', (prev) => prev.map((x) => (x.id === id ? updated : x)));
  return ok(
    docNumber ? `تأیید مدیرعامل ثبت شد؛ بدهی با سند ${docNumber} شناسایی و درخواست پرداخت به خزانه ارسال شد.` : `${step.label} انجام شد.`,
    { docNumber }
  );
}

export function returnSubcontractorStatement(env: WorkflowEnv, id: string, reason: string, reject = false): WorkflowResult {
  const s = env.getState().subcontractorStatements.find((x) => x.id === id);
  if (!s) return fail('صورت‌وضعیت یافت نشد.');
  if (!SUBCONTRACTOR_STATEMENT_FLOW[s.status]) return fail('صورت‌وضعیت تأییدشده قابل برگشت نیست.');
  const to: SubcontractorStatementWorkflowStatus = reject ? 'rejected' : 'returned_for_revision';
  env.set('subcontractorStatements', (prev) =>
    prev.map((x) =>
      x.id === id
        ? {
            ...x,
            status: to,
            rejectionReason: reject ? reason : x.rejectionReason,
            revisionNote: reject ? x.revisionNote : reason,
            workflowHistory: [...x.workflowHistory, historyEntry(env, x.status, to, reject ? 'رد صورت‌وضعیت' : 'برگشت جهت اصلاح متره', reason)],
          }
        : x
    )
  );
  return ok(reject ? 'صورت‌وضعیت رد شد.' : 'صورت‌وضعیت جهت اصلاح برگشت داده شد.');
}

// =============================================================================
// Petty cash: staged approval by approvalLevelRequired, limits from stored settings
// =============================================================================

export function pettyApprovalLevel(state: AppState, amount: number): PettyCashApprovalLevel {
  const s = state.pettyCashSettings;
  return amount <= s.siteLevelMax ? 'site_manager_and_finance' : amount <= s.projectLevelMax ? 'project_and_finance' : 'ceo_full';
}

export function pettyApprovalChain(state: AppState, level: PettyCashApprovalLevel): string[] {
  return state.pettyCashSettings.approvalChains[level];
}

export function submitPettyCashExpense(env: WorkflowEnv, expense: PettyCashExpense, attachments: Omit<AppDocument, 'links'>[] = []): WorkflowResult {
  const state = env.getState();
  const fund = state.pettyCashAccounts.find((a) => a.id === expense.pettyCashId);
  if (!fund) return fail('صندوق تنخواه انتخاب نشده است.');
  if (fund.status !== 'active') return fail('این صندوق تنخواه فعال نیست.');
  const limits = state.pettyCashSettings.fundLimits[fund.fundType];
  if (expense.amount > limits.maxSingleExpense) {
    return fail(`سقف هر هزینه برای این نوع تنخواه ${fa(limits.maxSingleExpense)} تومان است.`);
  }
  if (expense.amount > fund.usableBalance) {
    return fail(`موجودی قابل مصرف تنخواه (${fa(fund.usableBalance)}) کمتر از مبلغ هزینه است.`);
  }
  const level = pettyApprovalLevel(state, expense.amount);
  const chain = pettyApprovalChain(state, level);
  const saved: PettyCashExpense = {
    ...expense,
    status: 'pending_approval',
    approvalLevelRequired: level,
    currentApprovalStep: chain[0] as PettyCashExpense['currentApprovalStep'],
  };
  env.set('pettyCashExpenses', (prev) => [saved, ...prev]);
  env.set('pettyCashAccounts', (prev) =>
    prev.map((a) => (a.id === fund.id ? { ...a, pendingExpenses: a.pendingExpenses + expense.amount, usableBalance: a.usableBalance - expense.amount } : a))
  );
  for (const doc of attachments) {
    addDocument(env, {
      ...doc,
      links: [
        { entityType: 'petty_cash_expense', entityId: saved.id },
        { entityType: 'project', entityId: saved.projectId },
        ...(saved.counterpartyId ? [{ entityType: 'counterparty' as const, entityId: saved.counterpartyId }] : []),
      ],
    });
  }
  return ok(`هزینه ${saved.expenseNumber} ثبت و به مرحله «${chain[0]}» ارسال شد.`, { id: saved.id });
}

export function approvePettyCashExpense(env: WorkflowEnv, id: string, comment?: string): WorkflowResult {
  const state = env.getState();
  const exp = state.pettyCashExpenses.find((e) => e.id === id);
  if (!exp) return fail('هزینه یافت نشد.');
  if (exp.status !== 'pending_approval' && exp.status !== 'submitted') return fail('این هزینه در انتظار تأیید نیست.');
  const chain = pettyApprovalChain(state, exp.approvalLevelRequired);
  const idx = Math.max(0, chain.indexOf(exp.currentApprovalStep));
  const role = chain[idx];
  if (!canAct(env.user, role)) return denied(role);

  const history = [
    ...exp.approvalHistory,
    { level: role, approverName: env.user.name, approverRole: env.user.role, date: today(), time: now(), action: 'approved' as const, comment },
  ];
  const nextRole = chain[idx + 1];
  if (nextRole) {
    env.set('pettyCashExpenses', (prev) =>
      prev.map((e) => (e.id === id ? { ...e, approvalHistory: history, currentApprovalStep: nextRole as PettyCashExpense['currentApprovalStep'] } : e))
    );
    return ok(`تأیید «${role}» ثبت شد؛ مرحله بعد: «${nextRole}».`);
  }

  // Final approval: Dr project expense / Cr this petty cash fund.
  const fund = state.pettyCashAccounts.find((a) => a.id === exp.pettyCashId);
  env.set('pettyCashAccounts', (prev) =>
    prev.map((a) => (a.id === exp.pettyCashId ? { ...a, pendingExpenses: Math.max(0, a.pendingExpenses - exp.amount), usableBalance: a.usableBalance + exp.amount } : a))
  );
  const posting = env.post(pettyCashExpenseApprovedEvent(exp, fund), { submitter: env.user.name });
  if (!posting.ok) {
    // Restore the pending reservation if the posting was refused (e.g. insufficient fund balance).
    env.set('pettyCashAccounts', (prev) =>
      prev.map((a) => (a.id === exp.pettyCashId ? { ...a, pendingExpenses: a.pendingExpenses + exp.amount, usableBalance: a.usableBalance - exp.amount } : a))
    );
    return postingFailure(posting);
  }
  env.set('pettyCashAccounts', (prev) =>
    prev.map((a) => (a.id === exp.pettyCashId ? { ...a, monthlySpent: a.monthlySpent + exp.amount } : a))
  );
  env.set('pettyCashExpenses', (prev) =>
    prev.map((e) =>
      e.id === id
        ? { ...e, status: 'approved', currentApprovalStep: 'تأیید نهایی و ثبت سند', approvalHistory: history, journalEntryId: posting.event?.docNumber }
        : e
    )
  );
  return ok(`هزینه تأیید نهایی شد و سند ${posting.event?.docNumber} صادر شد.`, { docNumber: posting.event?.docNumber });
}

export function rejectPettyCashExpense(env: WorkflowEnv, id: string, reason: string, returnToUser = false): WorkflowResult {
  const exp = env.getState().pettyCashExpenses.find((e) => e.id === id);
  if (!exp || (exp.status !== 'pending_approval' && exp.status !== 'submitted')) return fail('این هزینه در انتظار تأیید نیست.');
  env.set('pettyCashExpenses', (prev) =>
    prev.map((e) =>
      e.id === id
        ? {
            ...e,
            status: returnToUser ? 'returned_for_correction' : 'rejected',
            rejectionReason: reason,
            currentApprovalStep: returnToUser ? 'بازگشت به کاربر' : 'رد شده',
            approvalHistory: [
              ...e.approvalHistory,
              { level: e.currentApprovalStep, approverName: env.user.name, approverRole: env.user.role, date: today(), time: now(), action: returnToUser ? 'returned_for_correction' : 'rejected', comment: reason },
            ],
          }
        : e
    )
  );
  env.set('pettyCashAccounts', (prev) =>
    prev.map((a) => (a.id === exp.pettyCashId ? { ...a, pendingExpenses: Math.max(0, a.pendingExpenses - exp.amount), usableBalance: a.usableBalance + exp.amount } : a))
  );
  return ok(returnToUser ? 'هزینه برای اصلاح به کاربر برگشت داده شد.' : 'هزینه رد شد.');
}

/** Replenishment is requested here; treasury pays it (Dr petty cash / Cr bank). */
export function requestPettyCashReplenishment(env: WorkflowEnv, fundId: string, amount: number, reason: string): WorkflowResult {
  const state = env.getState();
  const fund = state.pettyCashAccounts.find((a) => a.id === fundId);
  if (!fund) return fail('صندوق تنخواه یافت نشد.');
  const ceiling = state.pettyCashSettings.fundLimits[fund.fundType].ceiling;
  if (fund.actualBalance + amount > ceiling) {
    return fail(`با این شارژ، موجودی از سقف تنخواه (${fa(ceiling)} تومان) بیشتر می‌شود.`);
  }
  const open = state.pettyCashRequests.find((r) => r.pettyCashId === fundId && r.status === 'در انتظار تأیید مالی');
  if (open) return fail(`درخواست شارژ ${open.requestNumber} برای این صندوق هنوز باز است.`);
  const request = {
    id: generateUUID(),
    requestNumber: getNextSequentialDocNumber(state.pettyCashRequests.map((r) => r.requestNumber), 'REQ', 4, getCurrentFiscalYear()),
    pettyCashId: fund.id,
    pettyCashTitle: fund.title,
    currentActualBalance: fund.actualBalance,
    currentUsableBalance: fund.usableBalance,
    suggestedAmount: amount,
    recentExpensesSummary: '',
    reason,
    requesterName: env.user.name,
    requesterRole: env.user.role,
    date: today(),
    status: 'در انتظار تأیید مالی' as const,
  };
  env.set('pettyCashRequests', (prev) => [request, ...prev]);
  queuePayment(env, {
    sourceType: 'شارژ و تسویه تنخواه',
    sourceRefId: request.id,
    sourceRefNumber: request.requestNumber,
    projectId: fund.projectId,
    projectName: fund.projectName,
    costCenterId: fund.costCenterId,
    beneficiaryName: fund.title,
    beneficiaryType: 'مسئول تنخواه',
    totalAmount: amount,
  });
  return ok(`درخواست شارژ ${request.requestNumber} ثبت و به خزانه‌داری ارسال شد.`, { id: request.id });
}

// =============================================================================
// Procurement
// =============================================================================

export function approveVendorInvoice(env: WorkflowEnv, id: string): WorkflowResult {
  const inv = env.getState().vendorInvoices.find((i) => i.id === id);
  if (!inv) return fail('فاکتور یافت نشد.');
  if (!canAct(env.user, 'مدیر مالی')) return denied('مدیر مالی');
  if (!inv.grnId) return fail('فاکتور بدون رسید انبار قابل تأیید نیست.');
  const posting = env.post(vendorInvoiceEvent(inv), { submitter: env.user.name });
  if (!posting.ok) return postingFailure(posting);
  env.set('vendorInvoices', (prev) =>
    prev.map((i) =>
      i.id === id
        ? {
            ...i,
            status: i.paidAmount > 0 ? i.status : 'تأیید تطبیق سه‌جانبه',
            accountingEntryNumber: posting.event?.docNumber,
            threeWayMatching: { ...i.threeWayMatching, status: 'تأیید نهایی مالی' },
          }
        : i
    )
  );
  if (inv.remainingBalance > 0) {
    queuePayment(env, {
      sourceType: 'فاکتور خرید تأمین‌کننده',
      sourceRefId: inv.id,
      sourceRefNumber: inv.invoiceNumber,
      projectId: inv.projectId,
      projectName: inv.projectName,
      costCenterId: inv.costCenterId || '',
      counterpartyId: inv.counterpartyId || inv.supplierId,
      beneficiaryName: inv.supplierName,
      beneficiaryType: 'تأمین‌کننده',
      totalAmount: inv.remainingBalance,
      dueDate: inv.dueDate,
    });
  }
  return ok(`فاکتور تأیید و سند ${posting.event?.docNumber} صادر شد؛ درخواست پرداخت در خزانه ایجاد شد.`, { docNumber: posting.event?.docNumber });
}

export function rejectVendorInvoice(env: WorkflowEnv, id: string, reason: string): WorkflowResult {
  env.set('vendorInvoices', (prev) =>
    prev.map((i) => (i.id === id ? { ...i, status: 'دارای مغایرت و متوقف', threeWayMatching: { ...i.threeWayMatching, notes: reason } } : i))
  );
  return ok('فاکتور به دلیل مغایرت متوقف شد.');
}

export const REQUISITION_STEPS = [
  { key: 'siteSupervisor', label: 'تأیید سرپرست کارگاه', role: 'سرپرست کارگاه', status: 'تأیید سرپرست کارگاه' },
  { key: 'projectManager', label: 'تأیید مدیر پروژه', role: 'مدیر پروژه', status: 'تأیید فنی پروژه' },
  { key: 'procurementManager', label: 'تأیید تدارکات', role: 'مدیر مالی', status: 'مصوبه مدیر تدارکات' },
  { key: 'financialDirector', label: 'تأیید نهایی مالی/مدیرعامل', role: 'مدیرعامل', status: 'تأیید نهایی مالی/مدیرعامل' },
] as const;

export function nextRequisitionStep(r: { approvals: Record<string, { approved: boolean } | undefined>; status: string }) {
  if (['تأیید نهایی مالی/مدیرعامل', 'در حال استعلام بها (RFQ)', 'سفارش صادر شده (PO)', 'لغو شده'].includes(r.status)) return undefined;
  return REQUISITION_STEPS.find((s) => !r.approvals[s.key]?.approved);
}

export function approveRequisition(env: WorkflowEnv, id: string): WorkflowResult {
  const r = env.getState().purchaseRequisitions.find((x) => x.id === id);
  if (!r) return fail('درخواست خرید یافت نشد.');
  const step = nextRequisitionStep(r as any);
  if (!step) return fail('این درخواست مرحله تأیید باز ندارد.');
  if (!canAct(env.user, step.role)) return denied(step.role);
  env.set('purchaseRequisitions', (prev) =>
    prev.map((x) =>
      x.id === id
        ? { ...x, status: step.status as any, approvals: { ...x.approvals, [step.key]: { approved: true, date: today(), signedBy: env.user.name } } }
        : x
    )
  );
  return ok(`${step.label} ثبت شد.`);
}

export function cancelRequisition(env: WorkflowEnv, id: string): WorkflowResult {
  env.set('purchaseRequisitions', (prev) => prev.map((x) => (x.id === id ? { ...x, status: 'لغو شده' } : x)));
  return ok('درخواست خرید لغو شد.');
}

// =============================================================================
// Treasury: payment requests are approved, then paid from a chosen bank or cash desk.
// =============================================================================

export function approvePaymentRequest(env: WorkflowEnv, id: string): WorkflowResult {
  const r = env.getState().paymentRequests.find((x) => x.id === id);
  if (!r || r.status !== 'در انتظار تأیید مالی') return fail('این درخواست در انتظار تأیید نیست.');
  if (!canAct(env.user, 'مدیرعامل')) return denied('مدیرعامل');
  env.set('paymentRequests', (prev) =>
    prev.map((x) => (x.id === id ? { ...x, status: 'تأیید مدیرعامل', approvedBy: `${env.user.name} (${env.user.role})`, approvedDate: today() } : x))
  );
  return ok(`درخواست پرداخت ${r.requestNumber} تأیید شد و در صف پرداخت خزانه قرار گرفت.`);
}

export function rejectPaymentRequest(env: WorkflowEnv, id: string, reason: string): WorkflowResult {
  const r = env.getState().paymentRequests.find((x) => x.id === id);
  if (!r || r.status === 'پرداخت شده') return fail('درخواست قابل رد نیست.');
  env.set('paymentRequests', (prev) => prev.map((x) => (x.id === id ? { ...x, status: 'رد شده', notes: reason } : x)));
  if (r.sourceType === 'شارژ و تسویه تنخواه') {
    env.set('pettyCashRequests', (prev) => prev.map((q) => (q.id === r.sourceRefId ? { ...q, status: 'رد شده', rejectionReason: reason } : q)));
  }
  return ok(`درخواست ${r.requestNumber} رد شد.`);
}

export interface PaymentInput {
  bankAccountId?: string;
  cashDeskId?: string;
  amount: number;
  date?: string;
  trackingNumber?: string;
  method?: PaymentRequest['paymentMethod'];
}

export function executePayment(env: WorkflowEnv, requestId: string, input: PaymentInput): WorkflowResult {
  const state = env.getState();
  const req = state.paymentRequests.find((r) => r.id === requestId);
  if (!req) return fail('درخواست پرداخت یافت نشد.');
  if (req.status !== 'تأیید مدیرعامل' && req.status !== 'در صف پرداخت خزانه') return fail('فقط درخواست تأییدشده قابل پرداخت است.');
  if (!(input.amount > 0) || input.amount > req.remainingAmount) return fail(`مبلغ پرداخت باید بین ۱ و ${fa(req.remainingAmount)} تومان باشد.`);
  const bank = input.bankAccountId ? state.bankAccounts.find((b) => b.id === input.bankAccountId) : undefined;
  const desk = input.cashDeskId ? state.cashDesks.find((c) => c.id === input.cashDeskId) : undefined;
  if (!bank && !desk) return fail('حساب بانکی یا صندوق پرداخت‌کننده را انتخاب کنید.');

  const date = input.date || today();
  const trackingNumber = input.trackingNumber || '-';
  const pettyRequest = req.sourceType === 'شارژ و تسویه تنخواه' ? state.pettyCashRequests.find((q) => q.id === req.sourceRefId) : undefined;
  const pettyFund = pettyRequest ? state.pettyCashAccounts.find((a) => a.id === pettyRequest.pettyCashId) : undefined;

  const posting = env.post(
    {
      type: 'TREASURY_PAYMENT',
      sourceModule: 'treasury',
      sourceId: `${req.id}:${req.paidAmount}`,
      projectId: req.projectId,
      costCenterId: req.costCenterId,
      counterpartyId: req.counterpartyId || '',
      amount: input.amount,
      date,
      details: {
        docNumber: req.requestNumber,
        payableType: payableTypeForRequest(req),
        bankAccountId: bank?.id,
        cashDeskId: desk?.id,
        bankName: bank?.bankName || desk?.title,
        pettyCashId: pettyFund?.id,
        pettyCashTitle: pettyFund?.title,
        trackingNumber,
      },
    },
    { submitter: env.user.name }
  );
  if (!posting.ok) return postingFailure(posting);
  if (posting.duplicate) return fail('این پرداخت قبلاً ثبت شده است.');

  const remainingAmount = req.remainingAmount - input.amount;
  env.set('paymentRequests', (prev) =>
    prev.map((r) =>
      r.id === req.id
        ? {
            ...r,
            status: remainingAmount === 0 ? 'پرداخت شده' : 'در صف پرداخت خزانه',
            paidAmount: r.paidAmount + input.amount,
            remainingAmount,
            paymentMethod: input.method || r.paymentMethod,
            payerBankAccountId: bank?.id || desk?.id,
            payerBankAccountName: bank ? `${bank.bankName} - ${bank.accountNumber}` : desk?.title,
            paymentDate: date,
            trackingNumber,
            journalEntryId: posting.event?.docNumber,
          }
        : r
    )
  );

  // The payment reduces the remaining balance of its source document.
  if (req.sourceType === 'فاکتور خرید تأمین‌کننده') {
    env.set('vendorInvoices', (prev) =>
      prev.map((inv) => {
        if (inv.id !== req.sourceRefId) return inv;
        const paidAmount = inv.paidAmount + input.amount;
        const remainingBalance = Math.max(0, inv.totalAmount - paidAmount);
        return { ...inv, paidAmount, remainingBalance, status: remainingBalance === 0 ? 'پرداخت شده' : 'پرداخت ناقص' };
      })
    );
  } else if (req.sourceType === 'صورت‌وضعیت پیمانکار جزء') {
    const st = state.subcontractorStatements.find((s) => s.id === req.sourceRefId);
    env.set('subcontractorStatements', (prev) =>
      prev.map((s) => {
        if (s.id !== req.sourceRefId) return s;
        const remainingPayable = Math.max(0, s.remainingPayable - input.amount);
        return {
          ...s,
          paidAmount: s.paidAmount + input.amount,
          remainingPayable,
          status: remainingPayable === 0 ? 'paid' : s.status,
          paymentDate: date,
          paymentRefNumber: trackingNumber,
          payingBankId: bank?.id || desk?.id,
          payingBankTitle: bank?.bankName || desk?.title,
        };
      })
    );
    if (st) {
      env.set('subcontractorContracts', (prev) =>
        prev.map((c) =>
          c.id === st.subcontractorContractId
            ? { ...c, paidValue: c.paidValue + input.amount, remainingPayableValue: Math.max(0, c.remainingPayableValue - input.amount) }
            : c
        )
      );
    }
  } else if (req.sourceType === 'حقوق و دستمزد ماهانه' && remainingAmount === 0) {
    const ids = new Set(req.sourceRefId.split(':')[1]?.split(',') || []);
    env.set('payrollSlips', (prev) => prev.map((s) => (ids.has(s.id) ? { ...s, status: 'پرداخت شده', paymentRequestId: req.id } : s)));
  } else if (pettyRequest && pettyFund) {
    env.set('pettyCashRequests', (prev) => prev.map((q) => (q.id === pettyRequest.id ? { ...q, status: 'تأیید شده' } : q)));
    env.set('pettyCashAccounts', (prev) =>
      prev.map((a) => (a.id === pettyFund.id ? { ...a, lastReplenishmentDate: date, lastReplenishmentAmount: input.amount } : a))
    );
    env.set('pettyCashReplenishments', (prev) => [
      {
        id: generateUUID(),
        docNumber: req.requestNumber,
        pettyCashId: pettyFund.id,
        pettyCashTitle: pettyFund.title,
        amount: input.amount,
        sourceBankAccountId: bank?.id || desk?.id || '',
        sourceBankAccountName: bank?.bankName || desk?.title || '',
        date,
        transferMethod: 'حواله ساتنا/پایا',
        trackingNumber,
        description: pettyRequest.reason,
        approvedBy: env.user.name,
        journalEntryId: posting.event?.docNumber,
        status: 'تأیید و واریز شد',
      },
      ...prev,
    ]);
  }

  return ok(`پرداخت ${fa(input.amount)} تومان انجام و سند ${posting.event?.docNumber} صادر شد.`, { docNumber: posting.event?.docNumber });
}

// =============================================================================
// Payroll
// =============================================================================

export function approvePayrollPeriod(env: WorkflowEnv, period: string): WorkflowResult {
  if (!canAct(env.user, 'مدیر مالی')) return denied('مدیر مالی');
  const pending = env.getState().payrollSlips.filter((s) => s.monthYear === period && s.status === 'محاسبه شده');
  if (!pending.length) return fail('فیش محاسبه‌شده‌ای برای تأیید در این دوره وجود ندارد.');
  const batchId = `${payrollPeriodId(period)}:${pending.map((s) => s.id).sort().join(',')}`;
  const posting = env.post(payrollApprovedEvent(batchId, period, pending), { submitter: env.user.name });
  if (!posting.ok) return postingFailure(posting);
  const ids = new Set(pending.map((s) => s.id));
  const request = queuePayment(env, {
    sourceType: 'حقوق و دستمزد ماهانه',
    sourceRefId: batchId,
    sourceRefNumber: `لیست حقوق ${period}`,
    projectId: '',
    projectName: 'ستاد مرکزی و کارگاه‌ها',
    costCenterId: '',
    beneficiaryName: 'پرسنل - فایل پایا واریز گروهی',
    beneficiaryType: 'پرسنل',
    totalAmount: pending.reduce((a, s) => a + s.netPayableSalary, 0),
  });
  env.set('payrollSlips', (prev) =>
    prev.map((s) =>
      ids.has(s.id) ? { ...s, status: 'صادر شده جهت پرداخت', journalEntryId: posting.event?.docNumber, paymentRequestId: request?.id } : s
    )
  );
  return ok(`حقوق ${period} تأیید شد؛ سند ${posting.event?.docNumber} صادر و درخواست پرداخت به خزانه ارسال شد.`, { docNumber: posting.event?.docNumber });
}

// =============================================================================
// Accounting vouchers (manual entries awaiting approval)
// =============================================================================

export function approveJournalEntry(env: WorkflowEnv, id: string): WorkflowResult {
  const j = env.getState().journalEntries.find((x) => x.id === id);
  if (!j || j.status !== 'در انتظار تأیید') return fail('سند در انتظار تأیید نیست.');
  if (!canAct(env.user, 'مدیر مالی')) return denied('مدیر مالی');
  if (j.submitter.trim() === env.user.name.trim()) return fail('ثبت‌کننده سند نمی‌تواند آن را تأیید کند.');
  env.set('journalEntries', (prev) =>
    prev.map((x) =>
      x.id === id
        ? { ...x, status: 'تأیید شده', history: [...x.history, { date: today(), time: now(), user: env.user.name, action: 'تأیید نهایی و درج در دفاتر قانونی' }] }
        : x
    )
  );
  return ok(`سند ${j.docNumber} تأیید شد.`);
}

export function rejectJournalEntry(env: WorkflowEnv, id: string, reason: string): WorkflowResult {
  env.set('journalEntries', (prev) =>
    prev.map((x) =>
      x.id === id
        ? { ...x, status: 'رد شده', history: [...x.history, { date: today(), time: now(), user: env.user.name, action: `رد سند - علت: ${reason}` }] }
        : x
    )
  );
  return ok('سند رد شد.');
}

// =============================================================================
// Documents
// =============================================================================

export function addDocument(env: WorkflowEnv, doc: Omit<AppDocument, 'id'> & { id?: string }): WorkflowResult {
  const id = doc.id || generateUUID();
  env.set('documents', (prev) => [{ ...doc, id }, ...prev]);
  return ok(`سند «${doc.title}» بایگانی شد.`, { id });
}

export function linkDocument(env: WorkflowEnv, documentId: string, link: DocumentLink): WorkflowResult {
  env.set('documents', (prev) =>
    prev.map((d) =>
      d.id === documentId && !d.links.some((l) => l.entityType === link.entityType && l.entityId === link.entityId)
        ? { ...d, links: [...d.links, link] }
        : d
    )
  );
  return ok('پیوند سند ثبت شد.');
}

// =============================================================================
// Inventory: stock per warehouse, reservations, returns, receipt from purchase order
// =============================================================================

export function availableQty(state: AppState, warehouseId: string, materialId: string): number {
  const b = state.stockBalances.find((x) => x.warehouseId === warehouseId && x.materialId === materialId);
  return b ? b.qty - b.reservedQty : 0;
}

function adjustStock(env: WorkflowEnv, warehouseId: string, materialId: string, qtyChange: number, reservedChange = 0) {
  env.set('stockBalances', (prev) => {
    const found = prev.some((b) => b.warehouseId === warehouseId && b.materialId === materialId);
    const next: StockBalance[] = found
      ? prev.map((b) =>
          b.warehouseId === warehouseId && b.materialId === materialId
            ? { ...b, qty: b.qty + qtyChange, reservedQty: Math.max(0, b.reservedQty + reservedChange) }
            : b
        )
      : [...prev, { warehouseId, materialId, qty: qtyChange, reservedQty: Math.max(0, reservedChange) }];
    return next;
  });
}

export interface ReceiveFromPOLine {
  poItemId: string;
  materialId: string;
  deliveredQty: number;
  rejectedQty: number;
}

/** Goods receipt built from a purchase order: stock ↑ (weighted average), PO progress, Dr inventory / Cr GRNI. */
export function receiveGoodsFromPO(
  env: WorkflowEnv,
  input: { poId: string; warehouseId: string; date?: string; waybillNumber: string; truckPlateNumber: string; driverName: string; driverPhone: string; qcApprovalStatus: GoodsReceiptNote['qcApprovalStatus']; lines: ReceiveFromPOLine[] }
): WorkflowResult {
  const state = env.getState();
  const po = state.purchaseOrders.find((p) => p.id === input.poId);
  if (!po) return fail('سفارش خرید را انتخاب کنید.');
  if (['پیش‌نویس', 'فسخ شده', 'تحویل کامل', 'تسویه حساب نهایی و مختومه'].includes(po.status)) return fail('این سفارش قابل دریافت کالا نیست.');
  const warehouse = state.warehouses.find((w) => w.id === input.warehouseId);
  if (!warehouse) return fail('انبار مقصد را انتخاب کنید.');

  const items: Array<GoodsReceiptNote['items'][number] & { poItemId: string }> = [];
  for (const line of input.lines) {
    const poItem = po.items.find((i) => i.id === line.poItemId);
    const material = state.materials.find((m) => m.id === line.materialId);
    if (!poItem || !material || line.deliveredQty <= 0) continue;
    const accepted = line.deliveredQty - line.rejectedQty;
    if (accepted < 0) return fail(`مقدار مردودی ${poItem.materialName} از مقدار تحویلی بیشتر است.`);
    if (poItem.receivedQty + accepted > poItem.orderedQty) {
      return fail(`دریافت ${poItem.materialName} از مانده سفارش (${fa(poItem.orderedQty - poItem.receivedQty)}) بیشتر است.`);
    }
    items.push({
      materialId: material.id,
      materialCode: material.code,
      materialName: material.name,
      unit: material.unit,
      orderedQty: poItem.orderedQty,
      deliveredQty: line.deliveredQty,
      rejectedQty: line.rejectedQty,
      acceptedQty: accepted,
      unitPrice: poItem.unitPrice,
      totalPrice: accepted * poItem.unitPrice,
      poItemId: poItem.id,
    });
  }
  if (!items.length) return fail('هیچ قلمی برای دریافت وارد نشده است.');

  const grn: GoodsReceiptNote = {
    id: generateUUID(),
    receiptNumber: getNextSequentialDocNumber(state.goodsReceipts.map((g) => g.receiptNumber), 'GRN', 4, getCurrentFiscalYear()),
    date: input.date || today(),
    poId: po.id,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    projectId: po.projectId,
    projectName: po.projectName,
    costCenterId: po.costCenterId,
    counterpartyId: po.counterpartyId || po.supplierId,
    supplierId: po.supplierId,
    supplierName: po.supplierName,
    invoiceNumber: '-',
    waybillNumber: input.waybillNumber,
    truckPlateNumber: input.truckPlateNumber,
    driverName: input.driverName,
    driverPhone: input.driverPhone,
    qcApprovalStatus: input.qcApprovalStatus,
    items: items.map(({ poItemId: _p, ...i }) => i),
    totalAmount: items.reduce((a, i) => a + i.totalPrice, 0),
    status: 'تأیید نهایی انبارداری',
    receiverName: env.user.name,
  };

  const posting = env.post(goodsReceiptEvent(grn), { submitter: env.user.name });
  if (!posting.ok) return postingFailure(posting);
  grn.accountingJournalEntryId = posting.event?.docNumber;

  env.set('goodsReceipts', (prev) => [grn, ...prev]);
  for (const i of items) {
    adjustStock(env, warehouse.id, i.materialId, i.acceptedQty);
    env.set('materials', (prev) => prev.map((m) => (m.id === i.materialId ? receiveIntoStock(m, i.acceptedQty, i.unitPrice) : m)));
  }
  env.set('purchaseOrders', (prev) =>
    prev.map((p) => {
      if (p.id !== po.id) return p;
      const poItems = p.items.map((pi) => {
        const got = items.find((i) => i.poItemId === pi.id);
        return got ? { ...pi, receivedQty: pi.receivedQty + got.acceptedQty } : pi;
      });
      const ordered = poItems.reduce((a, pi) => a + pi.orderedQty, 0);
      const received = poItems.reduce((a, pi) => a + pi.receivedQty, 0);
      const complete = poItems.every((pi) => pi.receivedQty >= pi.orderedQty);
      return {
        ...p,
        items: poItems,
        status: complete ? 'تحویل کامل' : 'تحویل جزئی در انبار',
        deliveryProgressPercentage: ordered ? Math.round((received / ordered) * 100) : 0,
        linkedGrnNumbers: [...(p.linkedGrnNumbers || []), grn.receiptNumber],
      };
    })
  );
  return ok(`رسید ${grn.receiptNumber} از سفارش ${po.poNumber} ثبت و سند ${posting.event?.docNumber} صادر شد.`, { id: grn.id, docNumber: posting.event?.docNumber });
}

/** Issue request: reserves stock in the warehouse until the issue is confirmed or released. */
export function requestStoreIssue(env: WorkflowEnv, issue: StoreIssueVoucher): WorkflowResult {
  const state = env.getState();
  for (const i of issue.items) {
    const free = availableQty(state, issue.warehouseId, i.materialId);
    if (i.issuedQty > free) return fail(`موجودی آزاد ${i.materialName} در این انبار ${fa(free)} است.`);
  }
  const saved: StoreIssueVoucher = { ...issue, status: issue.status === 'خروج قطعی از انبار' ? 'تأیید مدیر کارگاه' : issue.status };
  env.set('storeIssues', (prev) => [saved, ...prev]);
  env.set('stockReservations', (prev) => [
    ...issue.items.map((i) => ({
      id: generateUUID(),
      warehouseId: issue.warehouseId,
      materialId: i.materialId,
      qty: i.issuedQty,
      projectId: issue.projectId,
      issueId: issue.id,
      status: 'active' as const,
      date: issue.date,
    })),
    ...prev,
  ]);
  for (const i of issue.items) adjustStock(env, issue.warehouseId, i.materialId, 0, i.issuedQty);
  if (issue.status === 'خروج قطعی از انبار') return confirmStoreIssue(env, issue.id);
  return ok(`درخواست حواله ${issue.issueNumber} ثبت و کالا رزرو شد.`, { id: issue.id });
}

/** Confirms an issue at weighted-average cost: reservation consumed, stock ↓, Dr project cost / Cr inventory. */
export function confirmStoreIssue(env: WorkflowEnv, issueId: string): WorkflowResult {
  const state = env.getState();
  const issue = state.storeIssues.find((v) => v.id === issueId);
  if (!issue) return fail('حواله یافت نشد.');
  if (issue.status === 'خروج قطعی از انبار') return fail('این حواله قبلاً خارج شده است.');
  const items = issue.items.map((i) => {
    const m = state.materials.find((x) => x.id === i.materialId);
    const unitCost = m?.averageUnitPrice ?? i.unitCost;
    return { ...i, unitCost, totalCost: Math.round(i.issuedQty * unitCost) };
  });
  const totalCost = items.reduce((a, i) => a + i.totalCost, 0);
  const costed: StoreIssueVoucher = { ...issue, items, totalCost, status: 'خروج قطعی از انبار' };
  const posting = env.post(storeIssueEvent(costed, totalCost), { submitter: env.user.name });
  if (!posting.ok) return postingFailure(posting);
  costed.accountingJournalEntryId = posting.event?.docNumber;

  env.set('storeIssues', (prev) => prev.map((v) => (v.id === issueId ? costed : v)));
  const reserved = state.stockReservations.filter((r) => r.issueId === issueId && r.status === 'active');
  env.set('stockReservations', (prev) => prev.map((r) => (r.issueId === issueId && r.status === 'active' ? { ...r, status: 'consumed' } : r)));
  for (const i of items) {
    const heldQty = reserved.filter((r) => r.materialId === i.materialId).reduce((a, r) => a + r.qty, 0);
    adjustStock(env, issue.warehouseId, i.materialId, -i.issuedQty, -heldQty);
  }
  return ok(`حواله ${issue.issueNumber} به بهای میانگین موزون خارج و سند ${posting.event?.docNumber} صادر شد.`, { docNumber: posting.event?.docNumber });
}

export function releaseStoreIssue(env: WorkflowEnv, issueId: string): WorkflowResult {
  const state = env.getState();
  const issue = state.storeIssues.find((v) => v.id === issueId);
  if (!issue || issue.status === 'خروج قطعی از انبار') return fail('حواله قابل لغو نیست.');
  const reserved = state.stockReservations.filter((r) => r.issueId === issueId && r.status === 'active');
  env.set('stockReservations', (prev) => prev.map((r) => (r.issueId === issueId && r.status === 'active' ? { ...r, status: 'released' } : r)));
  for (const r of reserved) adjustStock(env, r.warehouseId, r.materialId, 0, -r.qty);
  env.set('storeIssues', (prev) => prev.filter((v) => v.id !== issueId));
  return ok(`رزرو حواله ${issue.issueNumber} آزاد شد.`);
}

export function returnFromProject(env: WorkflowEnv, issueId: string, materialId: string, qty: number, reason: string): WorkflowResult {
  const state = env.getState();
  const issue = state.storeIssues.find((v) => v.id === issueId);
  if (!issue || issue.status !== 'خروج قطعی از انبار') return fail('فقط کالای حواله‌شده قابل برگشت است.');
  const line = issue.items.find((i) => i.materialId === materialId);
  if (!line) return fail('این کالا در حواله نیست.');
  const alreadyReturned = state.stockReturns
    .filter((r) => r.kind === 'project_to_warehouse' && r.sourceId === issueId && r.materialId === materialId)
    .reduce((a, r) => a + r.qty, 0);
  if (qty <= 0 || qty > line.issuedQty - alreadyReturned) return fail(`حداکثر مقدار قابل برگشت ${fa(line.issuedQty - alreadyReturned)} است.`);

  const ret: StockReturn = {
    id: generateUUID(),
    returnNumber: getNextSequentialDocNumber(state.stockReturns.map((r) => r.returnNumber), 'RET', 4, getCurrentFiscalYear()),
    date: today(),
    kind: 'project_to_warehouse',
    sourceId: issue.id,
    sourceNumber: issue.issueNumber,
    warehouseId: issue.warehouseId,
    projectId: issue.projectId,
    materialId,
    qty,
    unitCost: line.unitCost,
    totalCost: Math.round(qty * line.unitCost),
    reason,
  };
  const posting = env.post(
    {
      type: 'STORE_RETURN',
      sourceModule: 'inventory',
      sourceId: ret.id,
      projectId: issue.projectId,
      costCenterId: issue.costCenterId || '',
      counterpartyId: '',
      amount: ret.totalCost,
      date: ret.date,
      details: { docNumber: ret.returnNumber, warehouseId: issue.warehouseId, warehouseName: issue.warehouseName },
    },
    { submitter: env.user.name }
  );
  if (!posting.ok) return postingFailure(posting);
  ret.journalEntryId = posting.event?.docNumber;
  env.set('stockReturns', (prev) => [ret, ...prev]);
  adjustStock(env, issue.warehouseId, materialId, qty);
  env.set('materials', (prev) => prev.map((m) => (m.id === materialId ? receiveIntoStock(m, qty, line.unitCost) : m)));
  return ok(`برگشت ${ret.returnNumber} ثبت و بهای پروژه ${fa(ret.totalCost)} تومان کاهش یافت.`, { docNumber: posting.event?.docNumber });
}

export function returnToSupplier(env: WorkflowEnv, grnId: string, materialId: string, qty: number, reason: string): WorkflowResult {
  const state = env.getState();
  const grn = state.goodsReceipts.find((g) => g.id === grnId);
  if (!grn) return fail('رسید انبار یافت نشد.');
  const line = grn.items.find((i) => i.materialId === materialId);
  if (!line) return fail('این کالا در رسید نیست.');
  const alreadyReturned = state.stockReturns
    .filter((r) => r.kind === 'warehouse_to_supplier' && r.sourceId === grnId && r.materialId === materialId)
    .reduce((a, r) => a + r.qty, 0);
  if (qty <= 0 || qty > line.acceptedQty - alreadyReturned) return fail(`حداکثر مقدار قابل برگشت ${fa(line.acceptedQty - alreadyReturned)} است.`);
  if (qty > availableQty(state, grn.warehouseId, materialId)) return fail('موجودی آزاد انبار برای برگشت کافی نیست.');

  const invoiced = state.vendorInvoices.some((i) => i.grnId === grnId && ['تأیید تطبیق سه‌جانبه', 'پرداخت شده', 'پرداخت ناقص'].includes(i.status));
  const ret: StockReturn = {
    id: generateUUID(),
    returnNumber: getNextSequentialDocNumber(state.stockReturns.map((r) => r.returnNumber), 'RET', 4, getCurrentFiscalYear()),
    date: today(),
    kind: 'warehouse_to_supplier',
    sourceId: grn.id,
    sourceNumber: grn.receiptNumber,
    warehouseId: grn.warehouseId,
    projectId: grn.projectId,
    materialId,
    qty,
    unitCost: line.unitPrice,
    totalCost: Math.round(qty * line.unitPrice),
    reason,
  };
  const posting = env.post(
    {
      type: 'PURCHASE_RETURN',
      sourceModule: 'inventory',
      sourceId: ret.id,
      projectId: grn.projectId,
      costCenterId: grn.costCenterId || '',
      counterpartyId: grn.counterpartyId || grn.supplierId || '',
      amount: ret.totalCost,
      date: ret.date,
      details: { docNumber: ret.returnNumber, invoiced, warehouseId: grn.warehouseId, warehouseName: grn.warehouseName },
    },
    { submitter: env.user.name }
  );
  if (!posting.ok) return postingFailure(posting);
  ret.journalEntryId = posting.event?.docNumber;
  env.set('stockReturns', (prev) => [ret, ...prev]);
  adjustStock(env, grn.warehouseId, materialId, -qty);
  return ok(`برگشت از خرید ${ret.returnNumber} ثبت و سند ${posting.event?.docNumber} صادر شد.`, { docNumber: posting.event?.docNumber });
}

/** Delivered transfers move stock between warehouses (same company inventory, no accounting entry). */
export function completeTransfer(env: WorkflowEnv, t: InterWarehouseTransfer): WorkflowResult {
  const state = env.getState();
  for (const i of t.items) {
    if (i.quantity > availableQty(state, t.sourceWarehouseId, i.materialId)) {
      return fail(`موجودی آزاد ${i.materialName} در انبار مبدأ کافی نیست.`);
    }
  }
  for (const i of t.items) {
    adjustStock(env, t.sourceWarehouseId, i.materialId, -i.quantity);
    adjustStock(env, t.targetWarehouseId, i.materialId, i.quantity);
  }
  return ok(`انتقال ${t.transferNumber} در موجودی انبارها اعمال شد.`);
}

/** Stocktake sets each counted material in the warehouse to its physical count and posts the variance. */
export function applyStocktake(env: WorkflowEnv, audit: StocktakeAudit): WorkflowResult {
  const state = env.getState();
  let docNumber: string | undefined;
  if (audit.netVarianceAmount !== 0) {
    const warehouse = state.warehouses.find((w) => w.id === audit.warehouseId);
    const posting = env.post(
      {
        type: 'STOCKTAKE_ADJUSTMENT',
        sourceModule: 'inventory',
        sourceId: audit.id,
        projectId: warehouse?.projectId || '',
        costCenterId: '',
        counterpartyId: '',
        amount: Math.abs(audit.netVarianceAmount),
        date: audit.date,
        details: { docNumber: audit.auditNumber, direction: audit.netVarianceAmount < 0 ? 'loss' : 'gain', warehouseId: audit.warehouseId, warehouseName: audit.warehouseName },
      },
      { submitter: env.user.name }
    );
    if (!posting.ok) return postingFailure(posting);
    docNumber = posting.event?.docNumber;
  }
  for (const i of audit.items) {
    const b = state.stockBalances.find((x) => x.warehouseId === audit.warehouseId && x.materialId === i.materialId);
    adjustStock(env, audit.warehouseId, i.materialId, i.physicalCount - (b?.qty || 0));
  }
  return ok(docNumber ? `سند تعدیل انبارگردانی ${docNumber} صادر شد.` : 'انبارگردانی بدون مغایرت ریالی تأیید شد.', { docNumber });
}
