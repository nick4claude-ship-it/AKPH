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
  KardexEntry,
  PurchaseRequisition,
  PettyCashSettings,
  PettyCashReconciliation,
  JournalEntry,
} from '../types';
import { AppState, FinancialEventInput, SliceKey, SliceUpdater, PostingResult } from './types';
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
import { payrollPeriodId } from './state';
import { validateSubcontractorStatement } from './subcontractLines';
import { checkPermission, PETTY_STEP_ACTION, UserAction, ActionContext } from '../utils/permissions';
import { formatMoney, formatInt } from '../utils/money';
import { toPersianDigits } from '../utils/formatters';
import { generateUUID, nextDocNumber, tryFiscalYearOf } from '../utils/ids';
import { finalizeManualEntry, reversedEntryIds } from './postingEngine';
import {
  journalContext,
  paymentApprovalContext,
  paymentExecutionContext,
  payrollContext,
  pettyContext,
  requisitionContext,
  statementContext,
  storeIssueContext,
  vendorInvoiceContext,
} from './approvalContext';
import { ACCOUNTS } from './postingRules';
import { dayIndex, toPersianDate, toPersianTime } from '../utils/date';

/**
 * سرویس‌های گردش‌کار: هر اقدام تجاری (تأیید، پرداخت، دریافت، رسید، حواله...) فقط این‌جا پیاده شده است.
 * ماژول مالک و مرکز تأییدات هر دو همین توابع را صدا می‌زنند تا رکورد در ماژول خودش باقی بماند.
 */

export interface WorkflowEnv {
  getState: () => AppState;
  set: <K extends SliceKey>(key: K, updater: SliceUpdater<K>) => void;
  /** Posts a financial event as env.user (the engine checks that user's permission). */
  post: (input: FinancialEventInput, options?: { submitter?: string }) => PostingResult;
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
const fa = (n: number) => formatInt(n);
const money = (rial: number) => formatMoney(rial);
const today = () => toPersianDate(new Date());
const now = () => toPersianTime(new Date());

/** Every state-changing workflow starts here: can(user, action) with separation of duties. */
function guard(env: WorkflowEnv, action: UserAction, context?: ActionContext): WorkflowResult | null {
  const check = checkPermission(env.user, action, context);
  return check.ok ? null : fail(check.reason || 'اجازه این عملیات را ندارید.');
}

type PettyCashSettingsChain = PettyCashSettings['approvalChains'][PettyCashApprovalLevel];

export { creatorOf } from './approvalContext';

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
    created = { ...buildPaymentRequest(prev, input, today()), requestedBy: env.user.name, requestedById: env.user.id };
    return [created, ...prev];
  });
  return created;
}

/** Manual payment request (general expenses, advances, taxes); approval and payment follow in treasury. */
export function createPaymentRequest(env: WorkflowEnv, input: NewPaymentRequestInput): WorkflowResult {
  const deny = guard(env, 'payment_request.create', { projectId: input.projectId || undefined });
  if (deny) return deny;
  if (!Number.isSafeInteger(input.totalAmount) || input.totalAmount <= 0) return fail('مبلغ درخواست باید عدد صحیح مثبت باشد.');
  if (!input.beneficiaryName.trim()) return fail('ذی‌نفع را وارد کنید.');
  const created = queuePayment(env, input);
  return created ? ok(`درخواست پرداخت ${created.requestNumber} ثبت شد.`, { id: created.id }) : fail('درخواست پرداخت ثبت نشد.');
}

// =============================================================================
// Client progress statements
// Measurement → Statement → Consultant approval → Employer approval → Receivable → Receipt
// =============================================================================

export interface WorkflowStep<S extends string> {
  next: S;
  label: string;
  /** Portal role that normally performs the step (shown in the UI). */
  role: string;
  /** Permission checked with can(user, action). */
  action: UserAction;
}

export const CLIENT_STATEMENT_FLOW: Partial<Record<StatementWorkflowStatus, WorkflowStep<StatementWorkflowStatus>>> = {
  draft: { next: 'prepared', label: 'اندازه‌گیری و متره کارکرد', role: 'مدیر پروژه', action: 'client_statement.prepare' },
  returned_for_correction: { next: 'prepared', label: 'اصلاح و اندازه‌گیری مجدد', role: 'مدیر پروژه', action: 'client_statement.prepare' },
  prepared: { next: 'submitted_to_consultant', label: 'تنظیم و ارسال صورت‌وضعیت به مشاور', role: 'مدیر پروژه', action: 'client_statement.prepare' },
  internal_review: { next: 'submitted_to_consultant', label: 'تنظیم و ارسال صورت‌وضعیت به مشاور', role: 'مدیر پروژه', action: 'client_statement.prepare' },
  submitted_to_consultant: { next: 'approved_by_consultant', label: 'تأیید مشاور', role: 'مدیر پروژه', action: 'client_statement.consultant_approval' },
  under_consultant_review: { next: 'approved_by_consultant', label: 'تأیید مشاور', role: 'مدیر پروژه', action: 'client_statement.consultant_approval' },
  approved_by_consultant: { next: 'approved_by_employer', label: 'تأیید کارفرما', role: 'حسابدار', action: 'client_statement.employer_approval' },
  submitted_to_employer: { next: 'approved_by_employer', label: 'تأیید کارفرما', role: 'حسابدار', action: 'client_statement.employer_approval' },
};

/** Statuses that wait for an approval (as opposed to preparation work). */
export const CLIENT_STATEMENT_APPROVAL_STATUSES: StatementWorkflowStatus[] = [
  'submitted_to_consultant',
  'under_consultant_review',
  'approved_by_consultant',
  'submitted_to_employer',
];

function historyEntry<S extends string>(env: WorkflowEnv, from: S, to: S, action: string, comment?: string, stepAction?: UserAction) {
  return { date: today(), time: now(), user: env.user.name, userId: env.user.id, stepAction, role: env.user.role, fromStatus: from, toStatus: to, action, comment };
}

/** The creator of a statement is the signed-in user, whatever the form put in the first history row. */
function stampCreator<T extends { workflowHistory: { user: string; userId?: string; role: string }[] }>(env: WorkflowEnv, record: T): T {
  const [first, ...rest] = record.workflowHistory;
  if (!first) return record;
  return { ...record, workflowHistory: [{ ...first, user: env.user.name, userId: env.user.id, role: env.user.role }, ...rest] };
}

export function advanceClientStatement(env: WorkflowEnv, id: string, comment?: string): WorkflowResult {
  const s = env.getState().clientStatements.find((x) => x.id === id);
  if (!s) return fail('صورت‌وضعیت یافت نشد.');
  const step = CLIENT_STATEMENT_FLOW[s.status];
  if (!step) return fail('این صورت‌وضعیت مرحله تأیید بعدی ندارد.');
  const deny = guard(env, step.action, statementContext(s));
  if (deny) return deny;

  let updated: DetailedProgressStatement = {
    ...s,
    status: step.next,
    workflowHistory: [...s.workflowHistory, historyEntry(env, s.status, step.next, step.label, comment, step.action)],
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
  const deny = guard(env, 'client_statement.return', { projectId: s.projectId });
  if (deny) return deny;
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
  const denyReceipt = guard(env, 'receipt.record', { projectId: input.projectId });
  if (denyReceipt) return denyReceipt;
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
      return fail(`مبلغ از مانده مطالبات این صورت‌وضعیت (${money(statement.remainingPayable)}) بیشتر است.`);
    }
  }
  const contract = statement ? state.contracts.find((c) => c.id === statement.contractId) : undefined;
  const counterpartyId = input.counterpartyId || statement?.counterpartyId || contract?.counterpartyId || '';
  const projectId = input.projectId || statement?.projectId || '';
  const project = state.projects.find((p) => p.id === projectId);
  const payer = state.counterparties.find((c) => c.id === counterpartyId);
  const id = generateUUID();
  const docNumber = nextDocNumber(state.receipts.map((r) => r.docNumber), 'REC', input.date || today());
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

/** A new client statement (draft or sent to the consultant); billed value of the contract follows it. */
export function createClientStatement(env: WorkflowEnv, statement: DetailedProgressStatement): WorkflowResult {
  const deny = guard(env, 'client_statement.prepare', { projectId: statement.projectId });
  if (deny) return deny;
  const contract = env.getState().contracts.find((c) => c.id === statement.contractId);
  if (!contract) return fail('قرارداد صورت‌وضعیت یافت نشد.');
  if (!(statement.grossAmount > 0) || statement.totalDeductions > statement.grossAmount) return fail('مبالغ صورت‌وضعیت نامعتبر است.');
  if (!statement.workflowHistory.length) {
    statement = { ...statement, workflowHistory: [historyEntry(env, statement.status, statement.status, 'ایجاد صورت‌وضعیت')] };
  }
  statement = stampCreator(env, statement);
  env.set('clientStatements', (prev) => [statement, ...prev]);
  env.set('contracts', (prev) =>
    prev.map((c) => (c.id === contract.id ? { ...c, billedValue: c.billedValue + statement.grossAmount, executedValue: Math.max(c.executedValue, c.billedValue + statement.grossAmount) } : c))
  );
  return ok(`صورت‌وضعیت «${statement.statementNumber}» ثبت شد.`, { id: statement.id });
}

// =============================================================================
// Subcontractor progress statements
// Work → Measurement → Site approval → PM approval → Financial approval → CEO approval → Payable → Payment
// =============================================================================

export const SUBCONTRACTOR_STATEMENT_FLOW: Partial<Record<SubcontractorStatementWorkflowStatus, WorkflowStep<SubcontractorStatementWorkflowStatus>>> = {
  submitted: { next: 'measured', label: 'اندازه‌گیری کارکرد', role: 'مدیر پروژه', action: 'sub_statement.measure' },
  returned_for_revision: { next: 'measured', label: 'اندازه‌گیری مجدد', role: 'مدیر پروژه', action: 'sub_statement.measure' },
  measured: { next: 'site_review', label: 'تأیید کارگاه', role: 'مدیر پروژه', action: 'sub_statement.site_approval' },
  site_review: { next: 'pm_approved', label: 'تأیید مدیر پروژه', role: 'مدیر پروژه', action: 'sub_statement.pm_approval' },
  pm_approved: { next: 'finance_approved', label: 'تأیید مالی', role: 'حسابدار', action: 'sub_statement.finance_approval' },
  finance_approved: { next: 'management_approved', label: 'تأیید مدیر ارشد', role: 'مدیر ارشد', action: 'sub_statement.ceo_approval' },
};

/** A new subcontractor statement: previous quantities from approved history, caps on quantity and advance. */
export function createSubcontractorStatement(env: WorkflowEnv, statement: SubcontractorProgressStatement): WorkflowResult {
  const deny = guard(env, 'sub_statement.create', { projectId: statement.projectId });
  if (deny) return deny;
  const error = validateSubcontractorStatement(env.getState(), statement);
  if (error) return fail(error);
  if (!statement.workflowHistory.length) {
    statement = { ...statement, workflowHistory: [historyEntry(env, statement.status, statement.status, 'ثبت کارکرد')] };
  }
  statement = stampCreator(env, statement);
  env.set('subcontractorStatements', (prev) => [statement, ...prev]);
  env.set('subcontractorContracts', (prev) =>
    prev.map((c) => {
      if (c.id !== statement.subcontractorContractId) return c;
      const executedValue = c.executedValue + statement.grossAmount;
      return { ...c, executedValue, remainingContractValue: Math.max(0, c.contractValue - executedValue) };
    })
  );
  return ok(`صورت‌وضعیت «${statement.statementNumber}» ثبت و برای اندازه‌گیری ارسال شد.`, { id: statement.id });
}

export function advanceSubcontractorStatement(env: WorkflowEnv, id: string, comment?: string): WorkflowResult {
  const state = env.getState();
  const s = state.subcontractorStatements.find((x) => x.id === id);
  if (!s) return fail('صورت‌وضعیت یافت نشد.');
  const step = SUBCONTRACTOR_STATEMENT_FLOW[s.status];
  if (!step) return fail('این صورت‌وضعیت مرحله تأیید بعدی ندارد.');
  const deny = guard(env, step.action, statementContext(s));
  if (deny) return deny;

  const d = today();
  const updated: SubcontractorProgressStatement = {
    ...s,
    status: step.next,
    workflowHistory: [...s.workflowHistory, historyEntry(env, s.status, step.next, step.label, comment || step.label, step.action)],
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
            ? { ...r, status: 'تأیید مدیر ارشد' as const, approvedBy: `${env.user.name} (${env.user.role})`, approvedDate: d }
            : r
        )
      );
    }
  }

  env.set('subcontractorStatements', (prev) => prev.map((x) => (x.id === id ? updated : x)));
  return ok(
    docNumber ? `تأیید مدیر ارشد ثبت شد؛ بدهی با سند ${docNumber} شناسایی و درخواست پرداخت به خزانه ارسال شد.` : `${step.label} انجام شد.`,
    { docNumber }
  );
}

export function returnSubcontractorStatement(env: WorkflowEnv, id: string, reason: string, reject = false): WorkflowResult {
  const s = env.getState().subcontractorStatements.find((x) => x.id === id);
  if (!s) return fail('صورت‌وضعیت یافت نشد.');
  if (!SUBCONTRACTOR_STATEMENT_FLOW[s.status]) return fail('صورت‌وضعیت تأییدشده قابل برگشت نیست.');
  const deny = guard(env, 'sub_statement.return', { projectId: s.projectId });
  if (deny) return deny;
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

export function pettyApprovalChain(state: AppState, level: PettyCashApprovalLevel): PettyCashSettingsChain {
  return state.pettyCashSettings.approvalChains[level];
}

export function submitPettyCashExpense(env: WorkflowEnv, expense: PettyCashExpense, attachments: Omit<AppDocument, 'links'>[] = []): WorkflowResult {
  const state = env.getState();
  const deny = guard(env, 'petty.submit_expense', { projectId: expense.projectId });
  if (deny) return deny;
  if (!Number.isSafeInteger(expense.amount) || expense.amount <= 0) return fail('مبلغ هزینه باید عدد صحیح مثبت باشد.');
  const fund = state.pettyCashAccounts.find((a) => a.id === expense.pettyCashId);
  if (!fund) return fail('صندوق تنخواه انتخاب نشده است.');
  if (fund.status !== 'active') return fail('این صندوق تنخواه فعال نیست.');
  const limits = state.pettyCashSettings.fundLimits[fund.fundType];
  if (expense.amount > limits.maxSingleExpense) {
    return fail(`سقف هر هزینه برای این نوع تنخواه ${money(limits.maxSingleExpense)} است.`);
  }
  if (expense.amount > fund.usableBalance) {
    return fail(`موجودی قابل مصرف تنخواه (${money(fund.usableBalance)}) کمتر از مبلغ هزینه است.`);
  }
  const level = pettyApprovalLevel(state, expense.amount);
  const chain = pettyApprovalChain(state, level);
  const taken = state.pettyCashExpenses.map((e) => e.expenseNumber);
  const saved: PettyCashExpense = {
    ...expense,
    submitterName: env.user.name,
    submitterId: env.user.id,
    expenseNumber: expense.expenseNumber && !taken.includes(expense.expenseNumber) ? expense.expenseNumber : nextDocNumber(taken, 'EXP', expense.date),
    status: 'pending_approval',
    approvalLevelRequired: level,
    currentApprovalStep: chain[0],
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
  const idx = Math.max(0, chain.indexOf(exp.currentApprovalStep as PettyCashSettingsChain[number]));
  const role = chain[idx];
  const deny = guard(env, PETTY_STEP_ACTION[role], pettyContext(exp));
  if (deny) return deny;

  const history = [
    ...exp.approvalHistory,
    { level: role, approverName: env.user.name, approverId: env.user.id, approverRole: env.user.role, date: today(), time: now(), action: 'approved' as const, comment },
  ];
  const nextRole = chain[idx + 1];
  if (nextRole) {
    env.set('pettyCashExpenses', (prev) =>
      prev.map((e) => (e.id === id ? { ...e, approvalHistory: history, currentApprovalStep: nextRole } : e))
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
  const deny = guard(env, 'petty.reject', { projectId: exp.projectId });
  if (deny) return deny;
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
              { level: e.currentApprovalStep, approverName: env.user.name, approverId: env.user.id, approverRole: env.user.role, date: today(), time: now(), action: returnToUser ? 'returned_for_correction' : 'rejected', comment: reason },
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
  const deny = guard(env, 'petty.request_replenishment', { projectId: fund.projectId });
  if (deny) return deny;
  if (!Number.isSafeInteger(amount) || amount <= 0) return fail('مبلغ شارژ باید عدد صحیح مثبت باشد.');
  const ceiling = state.pettyCashSettings.fundLimits[fund.fundType].ceiling;
  if (fund.actualBalance + amount > ceiling) {
    return fail(`با این شارژ، موجودی از سقف تنخواه (${money(ceiling)}) بیشتر می‌شود.`);
  }
  const open = state.pettyCashRequests.find((r) => r.pettyCashId === fundId && r.status === 'در انتظار تأیید مالی');
  if (open) return fail(`درخواست شارژ ${open.requestNumber} برای این صندوق هنوز باز است.`);
  const request = {
    id: generateUUID(),
    requestNumber: nextDocNumber(state.pettyCashRequests.map((r) => r.requestNumber), 'REQ', today()),
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
  const deny = guard(env, 'vendor_invoice.approve', vendorInvoiceContext(inv));
  if (deny) return deny;
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
            approvedById: env.user.id,
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
  const inv = env.getState().vendorInvoices.find((i) => i.id === id);
  if (!inv) return fail('فاکتور یافت نشد.');
  const deny = guard(env, 'vendor_invoice.approve', { projectId: inv.projectId });
  if (deny) return deny;
  env.set('vendorInvoices', (prev) =>
    prev.map((i) => (i.id === id ? { ...i, status: 'دارای مغایرت و متوقف', threeWayMatching: { ...i.threeWayMatching, notes: reason } } : i))
  );
  return ok('فاکتور به دلیل مغایرت متوقف شد.');
}

export const REQUISITION_STEPS = [
  { key: 'siteSupervisor', label: 'تأیید کارگاه', role: 'مدیر پروژه', action: 'requisition.approve_site', status: 'تأیید سرپرست کارگاه' },
  { key: 'projectManager', label: 'تأیید مدیر پروژه', role: 'مدیر پروژه', action: 'requisition.approve_pm', status: 'تأیید فنی پروژه' },
  { key: 'procurementManager', label: 'تأیید تدارکات', role: 'حسابدار', action: 'requisition.approve_procurement', status: 'مصوبه مدیر تدارکات' },
  { key: 'financialDirector', label: 'تأیید نهایی مدیر ارشد', role: 'مدیر ارشد', action: 'requisition.approve_final', status: 'تأیید نهایی مدیر ارشد' },
] as const satisfies readonly { key: keyof PurchaseRequisition['approvals']; label: string; role: string; action: UserAction; status: PurchaseRequisition['status'] }[];

export function nextRequisitionStep(r: Pick<PurchaseRequisition, 'approvals' | 'status'>) {
  if (['تأیید نهایی مدیر ارشد', 'در حال استعلام بها (RFQ)', 'سفارش صادر شده (PO)', 'لغو شده'].includes(r.status)) return undefined;
  return REQUISITION_STEPS.find((s) => !r.approvals[s.key]?.approved);
}

export function approveRequisition(env: WorkflowEnv, id: string): WorkflowResult {
  const r = env.getState().purchaseRequisitions.find((x) => x.id === id);
  if (!r) return fail('درخواست خرید یافت نشد.');
  const step = nextRequisitionStep(r);
  if (!step) return fail('این درخواست مرحله تأیید باز ندارد.');
  const deny = guard(env, step.action, requisitionContext(r));
  if (deny) return deny;
  env.set('purchaseRequisitions', (prev) =>
    prev.map((x) =>
      x.id === id
        ? { ...x, status: step.status, approvals: { ...x.approvals, [step.key]: { approved: true, date: today(), signedBy: env.user.name, signedById: env.user.id } } }
        : x
    )
  );
  return ok(`${step.label} ثبت شد.`);
}

export function cancelRequisition(env: WorkflowEnv, id: string): WorkflowResult {
  const r = env.getState().purchaseRequisitions.find((x) => x.id === id);
  if (!r) return fail('درخواست خرید یافت نشد.');
  const deny = guard(env, 'requisition.cancel', { projectId: r.projectId });
  if (deny) return deny;
  env.set('purchaseRequisitions', (prev) => prev.map((x) => (x.id === id ? { ...x, status: 'لغو شده' } : x)));
  return ok('درخواست خرید لغو شد.');
}

// =============================================================================
// Treasury: payment requests are approved, then paid from a chosen bank or cash desk.
// =============================================================================

export function approvePaymentRequest(env: WorkflowEnv, id: string): WorkflowResult {
  const r = env.getState().paymentRequests.find((x) => x.id === id);
  if (!r || r.status !== 'در انتظار تأیید مالی') return fail('این درخواست در انتظار تأیید نیست.');
  const deny = guard(env, 'payment_request.approve', paymentApprovalContext(r));
  if (deny) return deny;
  env.set('paymentRequests', (prev) =>
    prev.map((x) => (x.id === id ? { ...x, status: 'تأیید مدیر ارشد', approvedBy: `${env.user.name} (${env.user.role})`, approvedById: env.user.id, approvedDate: today() } : x))
  );
  return ok(`درخواست پرداخت ${r.requestNumber} تأیید شد و در صف پرداخت خزانه قرار گرفت.`);
}

export function rejectPaymentRequest(env: WorkflowEnv, id: string, reason: string): WorkflowResult {
  const r = env.getState().paymentRequests.find((x) => x.id === id);
  if (!r || r.status === 'پرداخت شده' || r.paidAmount > 0) return fail('درخواست قابل رد نیست.');
  const deny = guard(env, 'payment_request.approve', { projectId: r.projectId || null });
  if (deny) return deny;
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
  const deny = guard(env, 'payment.execute', paymentExecutionContext(req));
  if (deny) return deny;
  if (req.status !== 'تأیید مدیر ارشد' && req.status !== 'در صف پرداخت خزانه') return fail('فقط درخواست تأییدشده قابل پرداخت است.');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > req.remainingAmount) {
    return fail(`مبلغ پرداخت باید عدد صحیح مثبت و حداکثر ${money(req.remainingAmount)} باشد.`);
  }
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

  return ok(`پرداخت ${money(input.amount)} انجام و سند ${posting.event?.docNumber} صادر شد.`, { docNumber: posting.event?.docNumber });
}

// =============================================================================
// Payroll
// =============================================================================

export function approvePayrollPeriod(env: WorkflowEnv, period: string): WorkflowResult {
  const pending = env.getState().payrollSlips.filter((s) => s.monthYear === period && s.status === 'محاسبه شده');
  const deny = guard(env, 'payroll.approve', payrollContext(pending));
  if (deny) return deny;
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
      ids.has(s.id) ? { ...s, status: 'صادر شده جهت پرداخت', approvedById: env.user.id, journalEntryId: posting.event?.docNumber, paymentRequestId: request?.id } : s
    )
  );
  return ok(`حقوق ${period} تأیید شد؛ سند ${posting.event?.docNumber} صادر و درخواست پرداخت به خزانه ارسال شد.`, { docNumber: posting.event?.docNumber });
}

// =============================================================================
// Accounting vouchers (manual entries awaiting approval)
// =============================================================================

/** Manual voucher: saved as pending with a sequential number; it becomes final only when approved. */
export function createManualJournalEntry(env: WorkflowEnv, entry: JournalEntry): WorkflowResult {
  const state = env.getState();
  const deny = guard(env, 'journal.create', { projectId: entry.projectId });
  if (deny) return deny;
  const year = tryFiscalYearOf(entry.date);
  if (year === null) return fail(`تاریخ سند «${entry.date}» تاریخ شمسی معتبر نیست.`);
  if (state.financeSettings.closedFiscalYears.includes(year)) return fail(`سال مالی ${toPersianDigits(year)} بسته شده است.`);
  const rows = entry.rows.filter((r) => r.debit > 0 || r.credit > 0);
  if (rows.some((r) => !Number.isSafeInteger(r.debit) || !Number.isSafeInteger(r.credit) || r.debit < 0 || r.credit < 0 || (r.debit > 0 && r.credit > 0))) {
    return fail('هر ردیف فقط یک مبلغ صحیح مثبت (بدهکار یا بستانکار) دارد.');
  }
  const debit = rows.reduce((a, r) => a + r.debit, 0);
  const credit = rows.reduce((a, r) => a + r.credit, 0);
  if (rows.length < 2 || debit !== credit || debit === 0) return fail('سند نامتوازن است: جمع بدهکار و بستانکار باید برابر و بیش از صفر باشد.');
  const saved: JournalEntry = {
    ...entry,
    id: entry.id || generateUUID(),
    // Temporary number; the permanent ACC number is issued on approval, in date order.
    docNumber: nextDocNumber(state.journalEntries.map((j) => j.docNumber), 'DRF', entry.date),
    rows,
    totalDebit: debit,
    totalCredit: credit,
    isBalanced: true,
    submitter: env.user.name,
    submitterId: env.user.id,
    status: 'در انتظار تأیید',
    history: [{ date: today(), time: now(), user: env.user.name, action: 'ثبت سند دستی و ارسال برای تأیید' }],
  };
  env.set('journalEntries', (prev) => [saved, ...prev]);
  return ok(`سند ${saved.docNumber} ثبت و برای تأیید ارسال شد.`, { id: saved.id, docNumber: saved.docNumber });
}

export function approveJournalEntry(env: WorkflowEnv, id: string): WorkflowResult {
  const j = env.getState().journalEntries.find((x) => x.id === id);
  if (!j || j.status !== 'در انتظار تأیید') return fail('سند در انتظار تأیید نیست.');
  const deny = guard(env, 'journal.approve', journalContext(j));
  if (deny) return deny;
  const result = finalizeManualEntry(env.getState(), id, env.user.name, env.user.id);
  if (!result.ok) return fail(result.error);
  env.set('journalEntries', result.state.journalEntries);
  env.set('bankAccounts', result.state.bankAccounts);
  env.set('cashDesks', result.state.cashDesks);
  env.set('pettyCashAccounts', result.state.pettyCashAccounts);
  return ok(`سند ${result.entry.docNumber} تأیید و قطعی شد.`, { docNumber: result.entry.docNumber });
}

/**
 * Correction of a final entry: a new reversal entry with debit and credit swapped. The original entry
 * is not edited. A reversal cannot itself be reversed, an entry is reversed at most once, and pending
 * or rejected entries have nothing to reverse.
 */
export function reverseJournalEntry(env: WorkflowEnv, id: string, reason: string): WorkflowResult {
  const state = env.getState();
  const original = state.journalEntries.find((x) => x.id === id);
  if (!original) return fail('سند یافت نشد.');
  const deny = guard(env, 'journal.reverse', { projectId: original.projectId });
  if (deny) return deny;
  if (original.status !== 'ثبت قطعی' && original.status !== 'تأیید شده') return fail('فقط سند قطعی قابل معکوس‌کردن است.');
  if (original.reversedFromDocId) return fail('سند معکوس را نمی‌توان دوباره معکوس کرد.');
  if (reversedEntryIds(state).has(original.id)) return fail('این سند قبلاً معکوس شده است.');
  if (!reason.trim()) return fail('علت صدور سند معکوس را وارد کنید.');

  const posting = env.post(
    {
      type: 'JOURNAL_REVERSAL',
      sourceModule: 'accounting',
      sourceId: original.id,
      projectId: original.projectId || '',
      costCenterId: original.costCenterId || '',
      counterpartyId: '',
      amount: original.totalDebit,
      date: today(),
      details: {
        originalId: original.id,
        originalDocNumber: original.docNumber,
        entryType: original.type,
        reason,
        rows: original.rows.map((r) => ({
          accountCode: r.accountCode,
          accountName: r.accountName,
          description: `معکوس: ${r.description}`,
          debit: r.credit,
          credit: r.debit,
          subledgerCode: r.subledgerCode,
          subledgerName: r.subledgerName,
          projectId: r.projectId,
          projectName: r.projectName,
          costCenterId: r.costCenterId,
          costCenterName: r.costCenterName,
        })),
      },
    },
    { submitter: env.user.name }
  );
  if (!posting.ok) return postingFailure(posting);
  if (posting.duplicate) return fail('این سند قبلاً معکوس شده است.');
  return ok(`سند معکوس ${posting.event?.docNumber} برای سند ${original.docNumber} صادر شد.`, { docNumber: posting.event?.docNumber });
}

/**
 * Year-end close: revenue and expense accounts (groups 4, 5, 6) of the fiscal year are closed to
 * retained earnings with one final entry, then the year is locked against new postings.
 */
export function closeFiscalYear(env: WorkflowEnv, year: number): WorkflowResult {
  const state = env.getState();
  const deny = guard(env, 'fiscal.close');
  if (deny) return deny;
  if (state.financeSettings.closedFiscalYears.includes(year)) return fail(`سال مالی ${toPersianDigits(year)} قبلاً بسته شده است.`);
  const inYear = state.journalEntries.filter((j) => tryFiscalYearOf(j.date) === year);
  const pending = inYear.filter((j) => j.status === 'در انتظار تأیید' || j.status === 'پیش‌نویس');
  if (pending.length) return fail(`${fa(pending.length)} سند در انتظار تأیید در این سال وجود دارد؛ ابتدا تعیین تکلیف کنید.`);

  const net = new Map<string, { name: string; amount: number }>();
  for (const j of inYear) {
    if (j.status !== 'ثبت قطعی' && j.status !== 'تأیید شده' && j.status !== 'برگشت خورده') continue;
    for (const r of j.rows) {
      if (!/^[456]/.test(r.accountCode)) continue;
      const cur = net.get(r.accountCode) || { name: r.accountName, amount: 0 };
      net.set(r.accountCode, { name: cur.name, amount: cur.amount + r.debit - r.credit });
    }
  }
  const rows = [...net]
    .filter(([, v]) => v.amount !== 0)
    .map(([accountCode, v]) => ({
      accountCode,
      accountName: v.name,
      description: `بستن حساب ${v.name}`,
      debit: v.amount < 0 ? -v.amount : 0,
      credit: v.amount > 0 ? v.amount : 0,
    }));
  const profit = rows.reduce((a, r) => a + r.debit - r.credit, 0);
  let docNumber: string | undefined;
  if (rows.length) {
    rows.push({
      accountCode: ACCOUNTS.retainedEarnings,
      accountName: 'سود (زیان) انباشته',
      description: profit >= 0 ? `انتقال سود سال ${year}` : `انتقال زیان سال ${year}`,
      debit: profit < 0 ? -profit : 0,
      credit: profit > 0 ? profit : 0,
    });
    const posting = env.post(
      {
        type: 'FISCAL_YEAR_CLOSE',
        sourceModule: 'accounting',
        sourceId: `FY-${year}`,
        projectId: '',
        costCenterId: '',
        counterpartyId: '',
        amount: rows.reduce((a, r) => a + r.debit, 0),
        date: `${year}/12/29`,
        details: { fiscalYear: year, rows },
      },
      { submitter: env.user.name }
    );
    if (!posting.ok) return postingFailure(posting);
    docNumber = posting.event?.docNumber;
  }
  env.set('financeSettings', (prev) => ({ ...prev, closedFiscalYears: [...prev.closedFiscalYears, year].sort() }));
  return ok(
    docNumber ? `سال مالی ${toPersianDigits(year)} بسته شد؛ سند اختتامیه ${docNumber} صادر شد (${profit >= 0 ? 'سود' : 'زیان'} ${money(Math.abs(profit))}).` : `سال مالی ${toPersianDigits(year)} بدون گردش درآمد/هزینه بسته شد.`,
    { docNumber }
  );
}

/** Company settings (VAT rate, petty cash policy) can be changed only by roles with settings.manage. */
export function updateFinanceSettings(env: WorkflowEnv, patch: Partial<Pick<AppState['financeSettings'], 'vatRatePercent'>>): WorkflowResult {
  const deny = guard(env, 'settings.manage');
  if (deny) return deny;
  if (patch.vatRatePercent !== undefined && (!Number.isSafeInteger(patch.vatRatePercent) || patch.vatRatePercent < 0 || patch.vatRatePercent > 100)) {
    return fail('نرخ ارزش افزوده باید عدد صحیح بین ۰ و ۱۰۰ باشد.');
  }
  env.set('financeSettings', (prev) => ({ ...prev, ...patch }));
  return ok('تنظیمات مالی ذخیره شد.');
}

/**
 * Bank reconciliation: a bank-statement line without a ledger document becomes a pending voucher
 * (deposit: Dr bank / Cr unidentified deposits; withdrawal: Dr bank fees / Cr bank) that another user
 * approves. Nothing is booked final here.
 */
export function reconcileBankItem(env: WorkflowEnv, itemId: string): WorkflowResult {
  const state = env.getState();
  const item = state.bankReconciliations.find((r) => r.id === itemId);
  if (!item || item.matched) return fail('قلم مغایرت یافت نشد یا قبلاً تطبیق شده است.');
  const deny = guard(env, 'journal.create', { projectId: null });
  if (deny) return deny;
  let docNumber = item.matchedDocNumber;
  if (item.discrepancyType !== 'سند حسابداری بدون گردش بانکی') {
    const bank = state.bankAccounts.find((b) => b.id === item.bankAccountId);
    const bankRow = { accountCode: ACCOUNTS.bank, accountName: 'بانک', subledgerCode: item.bankAccountId, subledgerName: bank?.bankName };
    const rows =
      item.type === 'واریز'
        ? [
            { id: generateUUID(), ...bankRow, description: `شناسایی واریز طبق صورت‌حساب بانک: ${item.description}`, debit: item.amount, credit: 0 },
            { id: generateUUID(), accountCode: ACCOUNTS.bankSuspense, accountName: 'واریزهای نامشخص', description: `واریز نامشخص در انتظار تعیین تکلیف: ${item.description}`, debit: 0, credit: item.amount },
          ]
        : [
            { id: generateUUID(), accountCode: ACCOUNTS.bankFees, accountName: 'کارمزد بانکی', description: `کارمزد/برداشت بانکی: ${item.description}`, debit: item.amount, credit: 0 },
            { id: generateUUID(), ...bankRow, description: `برداشت طبق صورت‌حساب بانک: ${item.description}`, debit: 0, credit: item.amount },
          ];
    const voucher = createManualJournalEntry(env, {
      id: generateUUID(),
      docNumber: '',
      date: today(),
      title: `سند رفع مغایرت بانکی: ${item.type === 'واریز' ? 'واریز' : 'برداشت'} فاقد سند دفتری`,
      type: item.type === 'واریز' ? 'دریافت' : 'پرداخت',
      rows,
      totalDebit: item.amount,
      totalCredit: item.amount,
      isBalanced: true,
      submitter: env.user.name,
      status: 'در انتظار تأیید',
      history: [],
    });
    if (!voucher.ok) return voucher;
    docNumber = voucher.docNumber;
  }
  env.set('bankReconciliations', (prev) => prev.map((r) => (r.id === itemId ? { ...r, matched: true, matchedDocNumber: docNumber, discrepancyType: 'تطبیق شده' } : r)));
  return ok(
    docNumber && docNumber !== item.matchedDocNumber
      ? `قلم تطبیق شد؛ سند ${docNumber} در انتظار تأیید کاربر دیگر است.`
      : 'قلم تطبیق شد.',
    { docNumber }
  );
}

/**
 * Petty cash count: the expected balance is the fund's book balance. A difference is not booked directly:
 * it becomes a pending adjustment voucher (deficit Dr cash shortage / Cr fund, surplus Dr fund / Cr other
 * income) that an accountant other than the preparer approves.
 */
export function reconcilePettyCash(
  env: WorkflowEnv,
  input: Pick<PettyCashReconciliation, 'pettyCashId' | 'periodStartDate' | 'periodEndDate' | 'actualCountedCash' | 'discrepancyReason' | 'notes'>
): WorkflowResult {
  const state = env.getState();
  const fund = state.pettyCashAccounts.find((a) => a.id === input.pettyCashId);
  if (!fund) return fail('تنخواه یافت نشد.');
  const deny = guard(env, 'petty.reconcile', { projectId: fund.projectId || undefined });
  if (deny) return deny;
  if (!Number.isSafeInteger(input.actualCountedCash) || input.actualCountedCash < 0) return fail('مبلغ شمارش‌شده باید عدد صحیح نامنفی باشد.');

  const date = today();
  const start = dayIndex(input.periodStartDate) || 0;
  const inPeriod = (d: string) => (dayIndex(d) || 0) >= start;
  const totalReplenishments = state.pettyCashReplenishments
    .filter((r) => r.pettyCashId === fund.id && inPeriod(r.date))
    .reduce((a, r) => a + r.amount, 0);
  const totalApprovedExpenses = state.pettyCashExpenses
    .filter((e) => e.pettyCashId === fund.id && (e.status === 'approved' || e.status === 'accounting_posted') && inPeriod(e.date))
    .reduce((a, e) => a + e.amount, 0);
  const expectedBalance = fund.actualBalance;
  const discrepancy = input.actualCountedCash - expectedBalance;
  if (discrepancy !== 0 && !input.discrepancyReason?.trim()) return fail('علت مغایرت را وارد کنید.');

  let adjustmentDocNumber: string | undefined;
  if (discrepancy !== 0) {
    const amount = Math.abs(discrepancy);
    const fundRow = { accountCode: ACCOUNTS.pettyCash, accountName: 'تنخواه گردان', subledgerCode: fund.id, subledgerName: fund.title };
    const otherRow =
      discrepancy < 0
        ? { accountCode: ACCOUNTS.cashShortage, accountName: 'کسری صندوق و تنخواه' }
        : { accountCode: ACCOUNTS.otherIncome, accountName: 'سایر درآمدهای متفرقه' };
    const description = `مغایرت شمارش تنخواه ${fund.title}: ${input.discrepancyReason?.trim()}`;
    const common = { description, projectId: fund.projectId, projectName: fund.projectName, costCenterId: fund.costCenterId, costCenterName: fund.costCenterName };
    const voucher = createManualJournalEntry(env, {
      id: generateUUID(),
      docNumber: '',
      date,
      title: description,
      type: 'تنخواه',
      projectId: fund.projectId,
      projectName: fund.projectName,
      rows:
        discrepancy < 0
          ? [
              { id: generateUUID(), ...otherRow, ...common, debit: amount, credit: 0 },
              { id: generateUUID(), ...fundRow, ...common, debit: 0, credit: amount },
            ]
          : [
              { id: generateUUID(), ...fundRow, ...common, debit: amount, credit: 0 },
              { id: generateUUID(), ...otherRow, ...common, debit: 0, credit: amount },
            ],
      totalDebit: amount,
      totalCredit: amount,
      isBalanced: true,
      submitter: env.user.name,
      status: 'در انتظار تأیید',
      history: [],
    });
    if (!voucher.ok) return voucher;
    adjustmentDocNumber = voucher.docNumber;
  }

  const recon: PettyCashReconciliation = {
    id: generateUUID(),
    reconNumber: nextDocNumber(state.pettyCashReconciliations.map((r) => r.reconNumber), 'RCN', date),
    pettyCashId: fund.id,
    pettyCashTitle: fund.title,
    periodStartDate: input.periodStartDate,
    periodEndDate: input.periodEndDate,
    openingBalance: expectedBalance - totalReplenishments + totalApprovedExpenses,
    totalReplenishments,
    totalApprovedExpenses,
    expectedBalance,
    actualCountedCash: input.actualCountedCash,
    discrepancy,
    status: discrepancy === 0 ? 'متعادل (بدون مغایرت)' : discrepancy < 0 ? 'دارای کسری' : 'دارای مازاد',
    discrepancyReason: discrepancy !== 0 ? input.discrepancyReason?.trim() : undefined,
    adjustmentDocNumber,
    officerName: fund.holderName,
    financeApproverName: `${env.user.name} (${env.user.role})`,
    date,
    notes: input.notes,
  };
  env.set('pettyCashReconciliations', (prev) => [recon, ...prev]);
  return ok(
    adjustmentDocNumber
      ? `صورتجلسه ${recon.reconNumber} ثبت شد؛ سند تعدیل ${adjustmentDocNumber} در انتظار تأیید است.`
      : `صورتجلسه ${recon.reconNumber} بدون مغایرت ثبت شد.`,
    { id: recon.id, docNumber: recon.reconNumber }
  );
}

export function updatePettyCashSettings(env: WorkflowEnv, settings: PettyCashSettings): WorkflowResult {
  const deny = guard(env, 'settings.manage');
  if (deny) return deny;
  if (settings.siteLevelMax >= settings.projectLevelMax) return fail('سقف سطح اول باید کمتر از سقف سطح دوم باشد.');
  env.set('pettyCashSettings', settings);
  return ok('سیاست تنخواه ذخیره شد.');
}

export function rejectJournalEntry(env: WorkflowEnv, id: string, reason: string): WorkflowResult {
  const j = env.getState().journalEntries.find((x) => x.id === id);
  if (!j || j.status !== 'در انتظار تأیید') return fail('فقط سند در انتظار تأیید قابل رد است.');
  const deny = guard(env, 'journal.approve', journalContext(j));
  if (deny) return deny;
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
  const deny = guard(env, 'document.manage');
  if (deny) return deny;
  const id = doc.id || generateUUID();
  env.set('documents', (prev) => [{ ...doc, id }, ...prev]);
  return ok(`سند «${doc.title}» بایگانی شد.`, { id });
}

export function linkDocument(env: WorkflowEnv, documentId: string, link: DocumentLink): WorkflowResult {
  const deny = guard(env, 'document.manage');
  if (deny) return deny;
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
// Inventory: stock per warehouse, reservations, returns, receipt from purchase order.
// Valuation: one moving weighted-average cost per material, company-wide. Every movement
// updates the warehouse balance and writes a kardex row.
// =============================================================================

export function availableQty(state: AppState, warehouseId: string, materialId: string): number {
  const b = state.stockBalances.find((x) => x.warehouseId === warehouseId && x.materialId === materialId);
  return b ? b.qty - b.reservedQty : 0;
}

const onHandQty = (state: AppState, warehouseId: string, materialId: string) =>
  state.stockBalances.find((x) => x.warehouseId === warehouseId && x.materialId === materialId)?.qty || 0;

/** Company-wide quantity of a material (the base of its weighted-average cost). */
const totalQty = (state: AppState, materialId: string) =>
  state.stockBalances.filter((b) => b.materialId === materialId).reduce((a, b) => a + b.qty, 0);

/** Rows of one document summed per material with a local map, so repeated rows are checked together. */
function sumByMaterial<T>(rows: T[], materialOf: (r: T) => string, qtyOf: (r: T) => number, valueOf: (r: T) => number = () => 0) {
  const map = new Map<string, { qty: number; value: number }>();
  for (const r of rows) {
    const cur = map.get(materialOf(r)) || { qty: 0, value: 0 };
    map.set(materialOf(r), { qty: cur.qty + qtyOf(r), value: cur.value + valueOf(r) });
  }
  return map;
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

/** Stock entering at `value` (Rials) moves the weighted average; stock leaving at average cost does not. */
function revalue(env: WorkflowEnv, materialId: string, qtyIn: number, value: number) {
  const state = env.getState();
  const before = totalQty(state, materialId);
  env.set('materials', (prev) =>
    prev.map((m) => {
      if (m.id !== materialId) return m;
      const qty = before + qtyIn;
      const average = qty > 0 ? Math.round((before * m.averageUnitPrice + value) / qty) : m.averageUnitPrice;
      return { ...m, averageUnitPrice: Math.max(0, average) };
    })
  );
}

interface KardexMove {
  materialId: string;
  warehouseId: string;
  docType: KardexEntry['docType'];
  docNumber: string;
  date: string;
  counterparty: string;
  inQty: number;
  outQty: number;
  unitCost: number;
}

/** Call after the stock change: the row carries the resulting warehouse balance and its valuation. */
function writeKardex(env: WorkflowEnv, moves: KardexMove[]) {
  const state = env.getState();
  const rows: KardexEntry[] = moves.map((m) => {
    const balanceQty = onHandQty(state, m.warehouseId, m.materialId);
    const average = state.materials.find((x) => x.id === m.materialId)?.averageUnitPrice || m.unitCost;
    return {
      id: generateUUID(),
      materialId: m.materialId,
      warehouseId: m.warehouseId,
      warehouseName: state.warehouses.find((w) => w.id === m.warehouseId)?.name || '-',
      date: m.date,
      docType: m.docType,
      docNumber: m.docNumber,
      counterparty: m.counterparty,
      inQty: m.inQty,
      outQty: m.outQty,
      balanceQty,
      unitCost: m.unitCost,
      balanceValuation: Math.round(balanceQty * average),
    };
  });
  env.set('kardex', (prev) => [...rows, ...prev]);
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
  const deny = guard(env, 'inventory.receive', { projectId: po.projectId });
  if (deny) return deny;
  if (['پیش‌نویس', 'فسخ شده', 'تحویل کامل', 'تسویه حساب نهایی و مختومه'].includes(po.status)) return fail('این سفارش قابل دریافت کالا نیست.');
  const warehouse = state.warehouses.find((w) => w.id === input.warehouseId);
  if (!warehouse) return fail('انبار مقصد را انتخاب کنید.');

  // Several lines may point at the same PO item: check the sum against what is still open.
  const perPoItem = sumByMaterial(input.lines, (l) => l.poItemId, (l) => l.deliveredQty - l.rejectedQty);
  for (const [poItemId, { qty }] of perPoItem) {
    const poItem = po.items.find((i) => i.id === poItemId);
    if (!poItem) return fail('قلم سفارش نامعتبر است.');
    if (qty > poItem.orderedQty - poItem.receivedQty) {
      return fail(`دریافت ${poItem.materialName} از مانده سفارش (${fa(poItem.orderedQty - poItem.receivedQty)}) بیشتر است.`);
    }
  }

  const items: Array<GoodsReceiptNote['items'][number] & { poItemId: string }> = [];
  for (const line of input.lines) {
    const poItem = po.items.find((i) => i.id === line.poItemId);
    const material = state.materials.find((m) => m.id === line.materialId);
    if (!poItem || !material || line.deliveredQty <= 0) continue;
    if (!Number.isSafeInteger(line.deliveredQty) || !Number.isSafeInteger(line.rejectedQty) || line.rejectedQty < 0) {
      return fail('مقادیر باید عدد صحیح مثبت باشند.');
    }
    const accepted = line.deliveredQty - line.rejectedQty;
    if (accepted < 0) return fail(`مقدار مردودی ${poItem.materialName} از مقدار تحویلی بیشتر است.`);
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
  if (!items.some((i) => i.acceptedQty > 0)) return fail('هیچ قلمی برای دریافت وارد نشده است.');

  const date = input.date || today();
  const grn: GoodsReceiptNote = {
    id: generateUUID(),
    receiptNumber: nextDocNumber(state.goodsReceipts.map((g) => g.receiptNumber), 'GRN', date),
    date,
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
  // One weighted-average step per material with the summed quantity and value of this receipt.
  const perMaterial = sumByMaterial(items, (i) => i.materialId, (i) => i.acceptedQty, (i) => i.totalPrice);
  for (const [materialId, { qty, value }] of perMaterial) {
    if (qty <= 0) continue;
    revalue(env, materialId, qty, value);
    adjustStock(env, warehouse.id, materialId, qty);
  }
  writeKardex(
    env,
    [...perMaterial].filter(([, v]) => v.qty > 0).map(([materialId, { qty, value }]) => ({
      materialId,
      warehouseId: warehouse.id,
      docType: 'رسید ورود انبار' as const,
      docNumber: grn.receiptNumber,
      date,
      counterparty: po.supplierName,
      inQty: qty,
      outQty: 0,
      unitCost: Math.round(value / qty),
    }))
  );
  env.set('purchaseOrders', (prev) =>
    prev.map((p) => {
      if (p.id !== po.id) return p;
      const poItems = p.items.map((pi) => {
        const got = perPoItem.get(pi.id);
        return got ? { ...pi, receivedQty: pi.receivedQty + got.qty } : pi;
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
  const deny = guard(env, 'inventory.issue_request', { projectId: issue.projectId });
  if (deny) return deny;
  if (!issue.items.length) return fail('حواله بدون قلم است.');
  if (issue.items.some((i) => !Number.isSafeInteger(i.issuedQty) || i.issuedQty <= 0)) return fail('مقدار هر ردیف باید عدد صحیح مثبت باشد.');
  // Rows of the same material are summed before checking the free stock.
  for (const [materialId, { qty }] of sumByMaterial(issue.items, (i) => i.materialId, (i) => i.issuedQty)) {
    const free = availableQty(state, issue.warehouseId, materialId);
    if (qty > free) {
      const name = issue.items.find((i) => i.materialId === materialId)?.materialName;
      return fail(`موجودی آزاد ${name} در این انبار ${fa(free)} است؛ جمع درخواست ${fa(qty)}.`);
    }
  }
  const number = issue.issueNumber || nextDocNumber(state.storeIssues.map((v) => v.issueNumber), 'SIV', issue.date);
  // The requester never confirms their own issue: a voucher marked "final" still waits for another user.
  const saved: StoreIssueVoucher = {
    ...issue,
    issueNumber: number,
    requestedById: env.user.id,
    status: issue.status === 'خروج قطعی از انبار' ? 'تأیید مدیر کارگاه' : issue.status,
  };
  env.set('storeIssues', (prev) => [saved, ...prev]);
  env.set('stockReservations', (prev) => [
    ...saved.items.map((i) => ({
      id: generateUUID(),
      warehouseId: saved.warehouseId,
      materialId: i.materialId,
      qty: i.issuedQty,
      projectId: saved.projectId,
      issueId: saved.id,
      status: 'active' as const,
      date: saved.date,
    })),
    ...prev,
  ]);
  for (const i of saved.items) adjustStock(env, saved.warehouseId, i.materialId, 0, i.issuedQty);
  return ok(`درخواست حواله ${saved.issueNumber} ثبت و کالا رزرو شد؛ خروج قطعی با تأیید کاربر دیگر انجام می‌شود.`, { id: saved.id });
}

/** Confirms an issue at weighted-average cost: reservation consumed, stock ↓, Dr project cost / Cr inventory. */
export function confirmStoreIssue(env: WorkflowEnv, issueId: string): WorkflowResult {
  const state = env.getState();
  const issue = state.storeIssues.find((v) => v.id === issueId);
  if (!issue) return fail('حواله یافت نشد.');
  if (issue.status === 'خروج قطعی از انبار') return fail('این حواله قبلاً خارج شده است.');
  const deny = guard(env, 'inventory.issue_confirm', storeIssueContext(issue));
  if (deny) return deny;
  // Never issue more than is physically in the warehouse (its own reservation included).
  for (const [materialId, { qty }] of sumByMaterial(issue.items, (i) => i.materialId, (i) => i.issuedQty)) {
    const onHand = onHandQty(state, issue.warehouseId, materialId);
    if (qty > onHand) {
      const name = issue.items.find((i) => i.materialId === materialId)?.materialName;
      return fail(`موجودی ${name} در انبار ${fa(onHand)} است و خروج ${fa(qty)} ممکن نیست.`);
    }
  }
  const items = issue.items.map((i) => {
    const unitCost = state.materials.find((x) => x.id === i.materialId)?.averageUnitPrice ?? i.unitCost;
    return { ...i, unitCost, totalCost: Math.round(i.issuedQty * unitCost) };
  });
  const totalCost = items.reduce((a, i) => a + i.totalCost, 0);
  const costed: StoreIssueVoucher = { ...issue, items, totalCost, status: 'خروج قطعی از انبار', confirmedById: env.user.id };
  const posting = env.post(storeIssueEvent(costed, totalCost), { submitter: env.user.name });
  if (!posting.ok) return postingFailure(posting);
  costed.accountingJournalEntryId = posting.event?.docNumber;

  env.set('storeIssues', (prev) => prev.map((v) => (v.id === issueId ? costed : v)));
  const reserved = state.stockReservations.filter((r) => r.issueId === issueId && r.status === 'active');
  env.set('stockReservations', (prev) => prev.map((r) => (r.issueId === issueId && r.status === 'active' ? { ...r, status: 'consumed' } : r)));
  const perMaterial = sumByMaterial(items, (i) => i.materialId, (i) => i.issuedQty);
  for (const [materialId, { qty }] of perMaterial) {
    const heldQty = reserved.filter((r) => r.materialId === materialId).reduce((a, r) => a + r.qty, 0);
    adjustStock(env, issue.warehouseId, materialId, -qty, -heldQty);
  }
  writeKardex(
    env,
    [...perMaterial].map(([materialId, { qty }]) => ({
      materialId,
      warehouseId: issue.warehouseId,
      docType: 'حواله مصرف کارگاه' as const,
      docNumber: issue.issueNumber,
      date: issue.date,
      counterparty: issue.subcontractorName || issue.projectName,
      inQty: 0,
      outQty: qty,
      unitCost: items.find((i) => i.materialId === materialId)?.unitCost || 0,
    }))
  );
  return ok(`حواله ${issue.issueNumber} به بهای میانگین موزون خارج و سند ${posting.event?.docNumber} صادر شد.`, { docNumber: posting.event?.docNumber });
}

export function releaseStoreIssue(env: WorkflowEnv, issueId: string): WorkflowResult {
  const state = env.getState();
  const issue = state.storeIssues.find((v) => v.id === issueId);
  if (!issue || issue.status === 'خروج قطعی از انبار') return fail('حواله قابل لغو نیست.');
  const deny = guard(env, 'inventory.issue_request', { projectId: issue.projectId });
  if (deny) return deny;
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
  const deny = guard(env, 'inventory.return', { projectId: issue.projectId });
  if (deny) return deny;
  const lines = issue.items.filter((i) => i.materialId === materialId);
  if (!lines.length) return fail('این کالا در حواله نیست.');
  const issuedQty = lines.reduce((a, l) => a + l.issuedQty, 0);
  const issuedCost = lines.reduce((a, l) => a + l.totalCost, 0);
  const unitCost = issuedQty ? Math.round(issuedCost / issuedQty) : 0;
  const alreadyReturned = state.stockReturns
    .filter((r) => r.kind === 'project_to_warehouse' && r.sourceId === issueId && r.materialId === materialId)
    .reduce((a, r) => a + r.qty, 0);
  if (!Number.isSafeInteger(qty) || qty <= 0 || qty > issuedQty - alreadyReturned) return fail(`حداکثر مقدار قابل برگشت ${fa(issuedQty - alreadyReturned)} است.`);

  const ret: StockReturn = {
    id: generateUUID(),
    returnNumber: nextDocNumber(state.stockReturns.map((r) => r.returnNumber), 'RET', today()),
    date: today(),
    kind: 'project_to_warehouse',
    sourceId: issue.id,
    sourceNumber: issue.issueNumber,
    warehouseId: issue.warehouseId,
    projectId: issue.projectId,
    materialId,
    qty,
    unitCost,
    totalCost: qty * unitCost,
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
  revalue(env, materialId, qty, ret.totalCost);
  adjustStock(env, issue.warehouseId, materialId, qty);
  writeKardex(env, [
    { materialId, warehouseId: issue.warehouseId, docType: 'برگشت از پروژه', docNumber: ret.returnNumber, date: ret.date, counterparty: issue.projectName, inQty: qty, outQty: 0, unitCost },
  ]);
  return ok(`برگشت ${ret.returnNumber} ثبت و بهای پروژه ${money(ret.totalCost)} کاهش یافت.`, { docNumber: posting.event?.docNumber });
}

export function returnToSupplier(env: WorkflowEnv, grnId: string, materialId: string, qty: number, reason: string): WorkflowResult {
  const state = env.getState();
  const grn = state.goodsReceipts.find((g) => g.id === grnId);
  if (!grn) return fail('رسید انبار یافت نشد.');
  const deny = guard(env, 'inventory.return', { projectId: grn.projectId });
  if (deny) return deny;
  const lines = grn.items.filter((i) => i.materialId === materialId);
  if (!lines.length) return fail('این کالا در رسید نیست.');
  const acceptedQty = lines.reduce((a, l) => a + l.acceptedQty, 0);
  const acceptedValue = lines.reduce((a, l) => a + l.totalPrice, 0);
  const unitCost = acceptedQty ? Math.round(acceptedValue / acceptedQty) : 0;
  const alreadyReturned = state.stockReturns
    .filter((r) => r.kind === 'warehouse_to_supplier' && r.sourceId === grnId && r.materialId === materialId)
    .reduce((a, r) => a + r.qty, 0);
  if (!Number.isSafeInteger(qty) || qty <= 0 || qty > acceptedQty - alreadyReturned) return fail(`حداکثر مقدار قابل برگشت ${fa(acceptedQty - alreadyReturned)} است.`);
  if (qty > availableQty(state, grn.warehouseId, materialId)) return fail('موجودی آزاد انبار برای برگشت کافی نیست.');

  const invoiced = state.vendorInvoices.some((i) => i.grnId === grnId && ['تأیید تطبیق سه‌جانبه', 'پرداخت شده', 'پرداخت ناقص'].includes(i.status));
  const ret: StockReturn = {
    id: generateUUID(),
    returnNumber: nextDocNumber(state.stockReturns.map((r) => r.returnNumber), 'RET', today()),
    date: today(),
    kind: 'warehouse_to_supplier',
    sourceId: grn.id,
    sourceNumber: grn.receiptNumber,
    warehouseId: grn.warehouseId,
    projectId: grn.projectId,
    materialId,
    qty,
    unitCost,
    totalCost: qty * unitCost,
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
  // Goods leave at their purchase price, so the average of what stays is recomputed.
  revalue(env, materialId, -qty, -ret.totalCost);
  adjustStock(env, grn.warehouseId, materialId, -qty);
  writeKardex(env, [
    { materialId, warehouseId: grn.warehouseId, docType: 'برگشت به تأمین‌کننده', docNumber: ret.returnNumber, date: ret.date, counterparty: grn.supplierName, inQty: 0, outQty: qty, unitCost },
  ]);
  return ok(`برگشت از خرید ${ret.returnNumber} ثبت و سند ${posting.event?.docNumber} صادر شد.`, { docNumber: posting.event?.docNumber });
}

/** A transfer order: stock is checked now and moved when the transfer is delivered. */
export function createTransfer(env: WorkflowEnv, t: InterWarehouseTransfer): WorkflowResult {
  const state = env.getState();
  const deny = guard(env, 'inventory.transfer', { projectId: t.sourceProjectId || undefined });
  if (deny) return deny;
  if (t.sourceWarehouseId === t.targetWarehouseId) return fail('انبار مبدأ و مقصد یکسان است.');
  if (!t.items.length || t.items.some((i) => !Number.isSafeInteger(i.quantity) || i.quantity <= 0)) return fail('مقدار هر ردیف باید عدد صحیح مثبت باشد.');
  for (const [materialId, { qty }] of sumByMaterial(t.items, (i) => i.materialId, (i) => i.quantity)) {
    const free = availableQty(state, t.sourceWarehouseId, materialId);
    if (qty > free) {
      const name = t.items.find((i) => i.materialId === materialId)?.materialName;
      return fail(`موجودی آزاد ${name} در انبار مبدأ ${fa(free)} است؛ جمع انتقال ${fa(qty)}.`);
    }
  }
  const saved: InterWarehouseTransfer = {
    ...t,
    transferNumber: t.transferNumber || nextDocNumber(state.interTransfers.map((x) => x.transferNumber), 'TRF', t.date),
    items: t.items.map((i) => {
      const unitCost = state.materials.find((m) => m.id === i.materialId)?.averageUnitPrice ?? i.unitCost;
      return { ...i, unitCost, totalCost: i.quantity * unitCost };
    }),
  };
  saved.totalCost = saved.items.reduce((a, i) => a + i.totalCost, 0);
  env.set('interTransfers', (prev) => [saved, ...prev]);
  if (saved.status === 'تخلیه و تحویل قطعی مقصد') {
    env.set('interTransfers', (prev) => prev.map((x) => (x.id === saved.id ? { ...x, status: 'در مسیر حمل' } : x)));
    return advanceTransfer(env, saved.id, 'تخلیه و تحویل قطعی مقصد');
  }
  return ok(`حواله انتقال ${saved.transferNumber} ثبت شد.`, { id: saved.id });
}

/** On delivery both warehouse balances change and each side gets a kardex row (no accounting entry). */
export function advanceTransfer(env: WorkflowEnv, transferId: string, status: InterWarehouseTransfer['status']): WorkflowResult {
  const state = env.getState();
  const t = state.interTransfers.find((x) => x.id === transferId);
  if (!t) return fail('حواله انتقال یافت نشد.');
  if (t.status === 'تخلیه و تحویل قطعی مقصد') return fail('این انتقال قبلاً تحویل شده است.');
  const deny = guard(env, 'inventory.transfer', { projectId: t.sourceProjectId || undefined });
  if (deny) return deny;
  if (status !== 'تخلیه و تحویل قطعی مقصد') {
    env.set('interTransfers', (prev) => prev.map((x) => (x.id === transferId ? { ...x, status } : x)));
    return ok(`وضعیت انتقال ${t.transferNumber} به «${status}» تغییر کرد.`);
  }
  const perMaterial = sumByMaterial(t.items, (i) => i.materialId, (i) => i.quantity);
  for (const [materialId, { qty }] of perMaterial) {
    const free = availableQty(state, t.sourceWarehouseId, materialId);
    if (qty > free) {
      const name = t.items.find((i) => i.materialId === materialId)?.materialName;
      return fail(`موجودی آزاد ${name} در انبار مبدأ ${fa(free)} است و انتقال ${fa(qty)} ممکن نیست.`);
    }
  }
  for (const [materialId, { qty }] of perMaterial) {
    adjustStock(env, t.sourceWarehouseId, materialId, -qty);
    adjustStock(env, t.targetWarehouseId, materialId, qty);
  }
  const date = today();
  const unitCostOf = (materialId: string) => state.materials.find((m) => m.id === materialId)?.averageUnitPrice || 0;
  writeKardex(env, [
    ...[...perMaterial].map(([materialId, { qty }]) => ({
      materialId, warehouseId: t.sourceWarehouseId, docType: 'انتقال خروجی' as const, docNumber: t.transferNumber, date,
      counterparty: t.targetWarehouseName, inQty: 0, outQty: qty, unitCost: unitCostOf(materialId),
    })),
    ...[...perMaterial].map(([materialId, { qty }]) => ({
      materialId, warehouseId: t.targetWarehouseId, docType: 'انتقال ورودی' as const, docNumber: t.transferNumber, date,
      counterparty: t.sourceWarehouseName, inQty: qty, outQty: 0, unitCost: unitCostOf(materialId),
    })),
  ]);
  env.set('interTransfers', (prev) => prev.map((x) => (x.id === transferId ? { ...x, status } : x)));
  return ok(`انتقال ${t.transferNumber} تحویل شد؛ موجودی هر دو انبار و کاردکس به‌روز شد.`);
}

/**
 * Stocktake: each counted material is set to its physical count in that warehouse. The variance is
 * recomputed here from the stored balance and average cost, posted, and written to the kardex.
 */
export function applyStocktake(env: WorkflowEnv, audit: StocktakeAudit): WorkflowResult {
  const state = env.getState();
  const warehouse = state.warehouses.find((w) => w.id === audit.warehouseId);
  if (!warehouse) return fail('انبار انبارگردانی یافت نشد.');
  const deny = guard(env, 'inventory.stocktake', { projectId: warehouse.projectId || undefined });
  if (deny) return deny;
  if (audit.items.some((i) => !Number.isSafeInteger(i.physicalCount) || i.physicalCount < 0)) return fail('شمارش فیزیکی باید عدد صحیح نامنفی باشد.');

  const counted = sumByMaterial(audit.items, (i) => i.materialId, (i) => i.physicalCount);
  const lines = [...counted].map(([materialId, { qty: physical }]) => {
    const system = onHandQty(state, audit.warehouseId, materialId);
    const reserved = state.stockBalances.find((b) => b.warehouseId === audit.warehouseId && b.materialId === materialId)?.reservedQty || 0;
    const unitCost = state.materials.find((m) => m.id === materialId)?.averageUnitPrice || 0;
    return { materialId, system, physical, reserved, variance: physical - system, unitCost };
  });
  const short = lines.find((l) => l.physical < l.reserved);
  if (short) return fail('شمارش فیزیکی از مقدار رزروشده کمتر است؛ ابتدا حواله‌های رزروشده را تعیین تکلیف کنید.');
  const netVarianceAmount = lines.reduce((a, l) => a + l.variance * l.unitCost, 0);

  let docNumber: string | undefined;
  if (netVarianceAmount !== 0) {
    const posting = env.post(
      {
        type: 'STOCKTAKE_ADJUSTMENT',
        sourceModule: 'inventory',
        sourceId: audit.id,
        projectId: warehouse.projectId || '',
        costCenterId: '',
        counterpartyId: '',
        amount: Math.abs(netVarianceAmount),
        date: audit.date,
        details: { docNumber: audit.auditNumber, direction: netVarianceAmount < 0 ? 'loss' : 'gain', warehouseId: audit.warehouseId, warehouseName: audit.warehouseName },
      },
      { submitter: env.user.name }
    );
    if (!posting.ok) return postingFailure(posting);
    docNumber = posting.event?.docNumber;
  }
  for (const l of lines) {
    if (l.variance !== 0) adjustStock(env, audit.warehouseId, l.materialId, l.variance);
  }
  writeKardex(
    env,
    lines
      .filter((l) => l.variance !== 0)
      .map((l) => ({
        materialId: l.materialId,
        warehouseId: audit.warehouseId,
        docType: 'تعدیل انبارگردانی' as const,
        docNumber: audit.auditNumber,
        date: audit.date,
        counterparty: 'انبارگردانی',
        inQty: Math.max(0, l.variance),
        outQty: Math.max(0, -l.variance),
        unitCost: l.unitCost,
      }))
  );
  const finalAudit: StocktakeAudit = {
    ...audit,
    items: audit.items.map((i) => {
      const l = lines.find((x) => x.materialId === i.materialId)!;
      return { ...i, systemStock: l.system, varianceQty: l.variance, unitPrice: l.unitCost, varianceAmount: l.variance * l.unitCost };
    }),
    netVarianceAmount,
    status: 'تأیید نهایی و صدور سند تعدیل',
    accountingAdjustmentEntryId: docNumber,
  };
  env.set('stocktakes', (prev) => (prev.some((x) => x.id === audit.id) ? prev.map((x) => (x.id === audit.id ? finalAudit : x)) : [finalAudit, ...prev]));
  return ok(docNumber ? `سند تعدیل انبارگردانی ${docNumber} صادر و کاردکس به‌روز شد.` : 'انبارگردانی بدون مغایرت ریالی تأیید شد.', { docNumber });
}
