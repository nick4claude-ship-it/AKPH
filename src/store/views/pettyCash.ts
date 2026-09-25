/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** View models of petty cash: counters, dashboard, fund cards, expense form checks, approvals, reports. */

import type {
  PettyCashAccount,
  PettyCashAttachment,
  PettyCashCategoryItem,
  PettyCashExpense,
  PettyCashFundType,
  PettyCashReplenishment,
  PettyCashReplenishmentRequest,
  PettyCashSettings,
  PortalRole,
  UserProfile,
} from '../../types';
import type { AppState } from '../types';
import { monthlyTotals } from '../selectors';
import { documentCount } from '../domainSelectors';
import { pettyContext } from '../approvalContext';
import { checkPermission, PETTY_STEP_ACTION } from '../../utils/permissions';
import { generateUUID } from '../../utils/ids';
import { dayIndex } from '../../utils/date';
import { formatCurrency } from '../../utils/formatters';
import { maxOf, percentOf, sumBy } from './common';

const PENDING = ['pending_approval', 'submitted'];
const APPROVED = ['approved', 'accounting_posted'];
const REJECTED = ['rejected', 'returned_for_correction'];

export const isPettyApproved = (e: Pick<PettyCashExpense, 'status'>) => APPROVED.includes(e.status);
export const isPettyPending = (e: Pick<PettyCashExpense, 'status'>) => PENDING.includes(e.status);

/** Fund below its warning level (usable balance at or under the minimum). */
export const isLowBalance = (a: PettyCashAccount) => a.usableBalance <= a.minBalanceWarning;

/** Badges of the petty cash navigation. */
export function pettyCashCounts(accounts: readonly PettyCashAccount[], expenses: readonly PettyCashExpense[], requests: readonly PettyCashReplenishmentRequest[]) {
  return {
    pendingApprovals: expenses.filter(isPettyPending).length,
    lowBalance: accounts.filter((a) => isLowBalance(a) && a.status === 'active').length,
    pendingRequests: requests.filter((r) => r.status === 'در انتظار تأیید مالی').length,
  };
}

export function selectPettyCashDashboard(accounts: readonly PettyCashAccount[], expenses: readonly PettyCashExpense[]) {
  const approved = expenses.filter(isPettyApproved);
  const byCategory = new Map<string, number>();
  for (const e of approved) byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
  const categoryEntries = Array.from(byCategory).sort((a, b) => b[1] - a[1]);
  const monthlyTrends = monthlyTotals(approved, 5).map((m) => ({ month: m.label, key: m.period, amount: m.amount }));
  const totalActualBalance = sumBy(accounts, (a) => a.actualBalance);
  const totalUsableBalance = sumBy(accounts, (a) => a.usableBalance);
  return {
    totalActualBalance,
    totalPendingExpenses: sumBy(accounts, (a) => a.pendingExpenses),
    totalUsableBalance,
    totalMonthlySpent: sumBy(accounts, (a) => a.monthlySpent),
    /** Usable balance as a share of the book balance. */
    usablePercent: percentOf(totalUsableBalance, totalActualBalance || 1),
    lowBalanceAccounts: accounts.filter((a) => isLowBalance(a) && a.status === 'active'),
    pendingApprovalsCount: expenses.filter(isPettyPending).length,
    /** Approved spend per category, largest first; `barPercent` is relative to the largest. */
    categoryBars: categoryEntries.map(([category, amount]) => ({ category, amount, barPercent: percentOf(amount, categoryEntries[0]?.[1] || 1) })),
    /** Approved spend of the last months with data; `barPercent` is relative to the largest month. */
    monthlyTrends: monthlyTrends.map((m) => ({ ...m, barPercent: percentOf(m.amount, maxOf(monthlyTrends.map((x) => x.amount))) })),
  };
}

/** Book balance as a share of the fund's ceiling (fund cards). */
export function fundCeilingPercent(a: PettyCashAccount): number {
  return Math.min(100, percentOf(a.actualBalance, a.ceilingLimit || 1));
}

/** How much a fund can be topped up to reach its ceiling. */
export function fundRoom(a: PettyCashAccount): number {
  return Math.max(0, a.ceilingLimit - a.actualBalance);
}

/** A replenishment request of the fund that still waits for finance. */
export function openReplenishRequest(requests: readonly PettyCashReplenishmentRequest[], fundId: string) {
  return requests.find((r) => r.pettyCashId === fundId && r.status === 'در انتظار تأیید مالی');
}

/** The holder's role decides the fund type, and with it the stored ceiling and warning level. */
export function fundTypeForHolderRole(role: string): PettyCashFundType {
  if (role === 'مدیر پروژه') return 'project_manager';
  if (role === 'مسئول خرید و کارپرداز') return 'procurement';
  if (role === 'واحد اداری و ستادی') return 'headquarters';
  return 'site_supervisor';
}

export function fundLimitsForHolderRole(settings: PettyCashSettings, role: string) {
  return settings.fundLimits[fundTypeForHolderRole(role)];
}

// ---------------- Expense form ----------------

export interface PettyExpenseFormInput {
  accountId: string;
  date: string;
  category: string;
  subCategory: string;
  /** Integer Rials. */
  amount: number;
  vendor: string;
  vendorNationalId: string;
  invoiceNumber: string;
  invoiceDate: string;
  description: string;
  paymentMethod: PettyCashExpense['paymentMethod'];
  inventoryTarget: 'direct_consumption' | 'send_to_warehouse';
  inventoryItemCode: string;
  inventoryItemName: string;
  inventoryQuantity: number;
  inventoryUnit: string;
  attachments: PettyCashAttachment[];
}

/** Same vendor, invoice number and amount as an expense already recorded. */
export function findDuplicateExpense(expenses: readonly PettyCashExpense[], form: Pick<PettyExpenseFormInput, 'vendor' | 'invoiceNumber' | 'amount'>) {
  const vendor = form.vendor.toLowerCase().trim();
  const invoice = form.invoiceNumber.toLowerCase().trim();
  if (!vendor || !invoice) return undefined;
  return expenses.find((e) => (e.vendor || '').toLowerCase().trim() === vendor && e.invoiceNumber.toLowerCase().trim() === invoice && e.amount === form.amount);
}

export function checkPettyExpenseForm(state: AppState, accounts: readonly PettyCashAccount[], form: PettyExpenseFormInput) {
  const account = accounts.find((a) => a.id === form.accountId);
  const isOverUsable = account ? form.amount > account.usableBalance : false;
  let error: string | null = null;
  if (!form.amount || form.amount <= 0) error = 'مبلغ هزینه باید بیشتر از صفر باشد.';
  else if (isOverUsable) error = 'خطا: مبلغ هزینه از مانده قابل مصرف این تنخواه بیشتر است.';
  else if (!account) error = 'صندوق تنخواه انتخاب نشده است.';
  return { account, isOverUsable, duplicate: findDuplicateExpense(state.pettyCashExpenses, form), error };
}

/** An invoice file picked in the browser, kept as an object URL until the expense is saved. */
export function attachmentFromFile(file: File): PettyCashAttachment {
  return {
    id: generateUUID(),
    name: file.name,
    type: file.type.includes('pdf') ? 'pdf' : 'image',
    size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    url: URL.createObjectURL(file),
  };
}

// ---------------- Approvals ----------------

export function pettyExpenseLists(expenses: readonly PettyCashExpense[]) {
  return {
    pending: expenses.filter(isPettyPending),
    approved: expenses.filter(isPettyApproved),
    rejected: expenses.filter((e) => REJECTED.includes(e.status)),
  };
}

/** What the signed-in user may do with an expense, and where it stands on its stored approval chain. */
export function pettyExpenseApproval(user: UserProfile, expense: PettyCashExpense, policy: PettyCashSettings) {
  const action = PETTY_STEP_ACTION[expense.currentApprovalStep as PortalRole] ?? 'petty.approve_ceo';
  const approve = checkPermission(user, action, pettyContext(expense));
  const level = expense.approvalLevelRequired;
  const chain = policy.approvalChains[level];
  const done = isPettyApproved(expense);
  const range =
    level === 'site_manager_and_finance'
      ? `تا ${formatCurrency(policy.siteLevelMax)}`
      : level === 'project_and_finance'
        ? `${formatCurrency(policy.siteLevelMax)} تا ${formatCurrency(policy.projectLevelMax)}`
        : `بیش از ${formatCurrency(policy.projectLevelMax)}`;
  // Position on the chain: 0 = first approver; the chain length once approved.
  const current = done ? chain.length : Math.max(0, chain.indexOf(expense.currentApprovalStep as PortalRole));
  return {
    canApprove: approve.ok,
    approveReason: approve.reason,
    canReject: checkPermission(user, 'petty.reject', { projectId: expense.projectId }).ok,
    /** «مدیر پروژه + حسابدار (تا …)» */
    chainText: `${chain.join(' + ')} (${range})`,
    /** The holder's entry, then each approver: done, current or waiting. */
    steps: ['ثبت تنخواه‌دار', ...chain].map((label, i) => ({
      label,
      done: i === 0 || i - 1 < current,
      current: !done && i - 1 === current,
    })),
  };
}

// ---------------- Reconciliation and reports ----------------

/** Book figures of a fund for a count: expected cash in hand and the period's movements. */
export function pettyReconciliationFigures(
  account: PettyCashAccount | null | undefined,
  replenishments: readonly PettyCashReplenishment[],
  expenses: readonly PettyCashExpense[],
  periodStartDate: string
) {
  const start = dayIndex(periodStartDate) || 0;
  const inPeriod = (d: string) => (dayIndex(d) || 0) >= start;
  // Cash that should be in hand: book balance minus expenses paid out but still awaiting approval.
  const expectedBalance = (account?.actualBalance ?? 0) - (account?.pendingExpenses ?? 0);
  const replenishmentsSum = sumBy(replenishments.filter((r) => r.pettyCashId === account?.id && inPeriod(r.date)), (r) => r.amount);
  const approvedExpensesSum = sumBy(expenses.filter((e) => e.pettyCashId === account?.id && isPettyApproved(e) && inPeriod(e.date)), (e) => e.amount);
  return {
    expectedBalance,
    replenishmentsSum,
    approvedExpensesSum,
    openingBalance: (account?.actualBalance ?? 0) - replenishmentsSum + approvedExpensesSum,
  };
}

/** Counted cash minus expected cash (positive: surplus, negative: shortage). */
export const countDifference = (counted: number, expected: number) => counted - expected;

export function pettyReportFigures(state: AppState, expenses: readonly PettyCashExpense[]) {
  const approved = expenses.filter(isPettyApproved);
  const approvedTotal = sumBy(approved, (e) => e.amount);
  const categories = Array.from(new Set(approved.map((e) => e.category)));
  return {
    missingDocsExpenses: expenses.filter((e) => !e.invoiceNumber || !documentCount(state, 'petty_cash_expense', e.id)),
    rejectedExpenses: expenses.filter((e) => e.status === 'rejected'),
    approvedExpenses: approved,
    approvedTotal,
    categoryRows: categories.map((cat) => {
      const rows = approved.filter((e) => e.category === cat);
      const total = sumBy(rows, (e) => e.amount);
      return {
        cat,
        count: rows.length,
        total,
        projects: Array.from(new Set(rows.map((e) => e.projectName))).join('، '),
        share: percentOf(total, approvedTotal),
      };
    }).sort((a, b) => b.total - a.total),
  };
}

/** A new expense category (edited in the settings screen, saved by updatePettyCashCategories). */
export function newPettyCategory(name: string): PettyCashCategoryItem {
  return { id: generateUUID(), name: name.trim(), subcategories: [] };
}
