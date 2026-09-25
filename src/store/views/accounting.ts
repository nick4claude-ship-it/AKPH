/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * View models of accounting: dashboard figures, the manual voucher form, voucher actions, reports built
 * from final entries, revenue/expense analysis, receivable/payable totals and year-end closing figures.
 */

import type {
  AccountNode,
  AccountsPayableItem,
  AccountsReceivableItem,
  JournalEntry,
  JournalEntryRow,
  JournalEntryType,
  Project,
  UserProfile,
} from '../../types';
import type { AppState } from '../types';
import type { Balances, CashFlowPoint } from '../selectors';
import { postedEntries, selectProjectCostBreakdown, selectProjectFinancials } from '../selectors';
import { pendingReversalIds, reversedEntryIds } from '../postingEngine';
import { journalContext } from '../approvalContext';
import { isFinalJournalEntry } from '../../api/types';
import { checkPermission } from '../../utils/permissions';
import { generateUUID, tryFiscalYearOf } from '../../utils/ids';
import { getCurrentFiscalYear } from '../../utils/date';
import { normalizeDigits } from '../../utils/money';
import { maxOf, percentOf, sumBy } from './common';

// =============================================================================
// Module overview and dashboard
// =============================================================================

export function selectAccountingOverview(state: AppState) {
  return {
    pendingApprovalsCount: state.journalEntries.filter((e) => e.status === 'در انتظار تأیید').length,
    pettyCashTotal: sumBy(state.pettyCashAccounts, (p) => p.actualBalance),
    reversedIds: reversedEntryIds(state),
    /** Final entries with a reversal waiting for approval: not reversible again until it is decided. */
    pendingReversalIds: pendingReversalIds(state),
  };
}

export function selectAccountingDashboard(
  input: {
    bankAccounts: { balance: number }[];
    cashDesks: { balance: number }[];
    receipts: { amount: number }[];
    payments: { amount: number }[];
    receivables: AccountsReceivableItem[];
    payables: AccountsPayableItem[];
    journalEntries: JournalEntry[];
    pettyCashTotal: number;
    ledger: Balances;
    cashFlow: CashFlowPoint[];
  }
) {
  const totalBankBalance = sumBy(input.bankAccounts, (b) => b.balance);
  const totalCashBalance = sumBy(input.cashDesks, (c) => c.balance);
  const periodRevenue = input.ledger.revenue;
  const periodExpense = input.ledger.cost;
  const periodProfit = periodRevenue - periodExpense;
  const ofRevenue = (part: number) => (periodRevenue > 0 ? Math.max(0, Math.min(100, percentOf(part, periodRevenue))) : 0);
  const maxCashFlow = maxOf(input.cashFlow.flatMap((d) => [d.receipt, d.payment]));
  return {
    totalBankBalance,
    totalCashBalance,
    totalPettyCash: input.pettyCashTotal,
    totalLiquidity: totalBankBalance + totalCashBalance + input.pettyCashTotal,
    totalReceipts: sumBy(input.receipts, (r) => r.amount),
    totalPayments: sumBy(input.payments, (p) => p.amount),
    totalReceivables: sumBy(input.receivables, (r) => r.remainingClaim),
    totalPayables: sumBy(input.payables, (p) => p.remainingDebt),
    pendingDocsCount: input.journalEntries.filter((j) => j.status === 'در انتظار تأیید').length,
    periodRevenue,
    periodExpense,
    periodProfit,
    profitMargin: percentOf(periodProfit, periodRevenue),
    /** Bar widths of cost and profit as shares of revenue (0–100). */
    expenseOfRevenuePercent: ofRevenue(periodExpense),
    profitOfRevenuePercent: ofRevenue(periodProfit),
    /** Monthly receipts and payments with bar heights relative to the largest month. */
    cashFlowBars: input.cashFlow.map((d) => ({ ...d, receiptPercent: percentOf(d.receipt, maxCashFlow), paymentPercent: percentOf(d.payment, maxCashFlow) })),
    netCashFlow: sumBy(input.cashFlow, (d) => d.receipt - d.payment),
  };
}

// =============================================================================
// Receivables and payables
// =============================================================================

export function sumReceivables(receivables: readonly AccountsReceivableItem[]) {
  return {
    billed: sumBy(receivables, (r) => r.billedAmount),
    received: sumBy(receivables, (r) => r.receivedAmount),
    remaining: sumBy(receivables, (r) => r.remainingClaim),
    overdueCount: receivables.filter((r) => r.status.includes('معوق')).length,
  };
}

export function sumPayables(payables: readonly AccountsPayableItem[]) {
  return {
    incurred: sumBy(payables, (p) => p.incurredDebt),
    paid: sumBy(payables, (p) => p.paidAmount),
    remaining: sumBy(payables, (p) => p.remainingDebt),
  };
}

// =============================================================================
// Manual journal voucher
// =============================================================================

/** Posting accounts (leaves of the chart) for manual vouchers. */
export function leafAccounts(chart: AccountNode[]): { code: string; title: string }[] {
  const out: { code: string; title: string }[] = [];
  const walk = (nodes: AccountNode[]) => {
    for (const n of nodes) {
      if (n.children?.length) walk(n.children);
      else out.push({ code: n.code, title: n.title });
    }
  };
  walk(chart);
  return out;
}

export function blankJournalRow(account?: { code: string; title: string }): JournalEntryRow {
  return { id: generateUUID(), accountCode: account?.code || '', accountName: account?.title || '', subledgerCode: '', subledgerName: '', description: '', debit: 0, credit: 0 };
}

export interface ManualEntryFormInput {
  date: string;
  type: JournalEntryType;
  title: string;
  projectId: string;
  costCenterId: string;
  rows: JournalEntryRow[];
}

/** Totals and balance of the voucher being typed, and the first problem that blocks saving. */
export function computeManualEntryDraft(form: ManualEntryFormInput) {
  const totalDebit = sumBy(form.rows, (r) => r.debit);
  const totalCredit = sumBy(form.rows, (r) => r.credit);
  const rowsValid = form.rows.length >= 2 && form.rows.every((r) => Boolean(r.accountCode) && ((r.debit > 0 && r.credit === 0) || (r.credit > 0 && r.debit === 0)));
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit && rowsValid;

  let error: string | null = null;
  const date = normalizeDigits(form.date.trim());
  if (!/^1[34]\d{2}\/\d{1,2}\/\d{1,2}$/.test(date)) error = 'تاریخ سند را به صورت ۱۴۰۵/۰۷/۰۱ وارد کنید.';
  else {
    for (let i = 0; i < form.rows.length && !error; i++) {
      const r = form.rows[i];
      if (!r.accountCode) error = `ردیف ${i + 1} فاقد حساب است.`;
      else if ((r.debit === 0 && r.credit === 0) || (r.debit > 0 && r.credit > 0)) error = `در ردیف ${i + 1} دقیقاً یکی از مبالغ بدهکار یا بستانکار باید بیش از صفر باشد.`;
    }
  }
  if (!error && !isBalanced) error = 'سند تراز نیست: جمع بدهکار و بستانکار باید برابر و بیش از صفر باشد.';
  if (!error && !form.title.trim()) error = 'شرح کلی سند الزامی است.';
  return {
    totalDebit,
    totalCredit,
    /** Absolute gap between debit and credit. */
    difference: Math.abs(totalDebit - totalCredit),
    isBalanced,
    error,
  };
}

/** The voucher as the workflow receives it (number, submitter and status are set there). */
export function buildManualEntry(state: AppState, form: ManualEntryFormInput): JournalEntry {
  const draft = computeManualEntryDraft(form);
  const project = state.projects.find((p) => p.id === form.projectId);
  const costCenter = state.costCenters.find((c) => c.id === form.costCenterId);
  return {
    id: generateUUID(),
    docNumber: '',
    date: form.date.trim(),
    title: form.title.trim(),
    type: form.type,
    projectId: project?.id,
    projectName: project?.name,
    costCenterId: costCenter?.id,
    costCenterName: costCenter?.name,
    submitter: '',
    status: 'در انتظار تأیید',
    rows: form.rows.map((r) => ({ ...r, projectId: project?.id, projectName: project?.name, costCenterId: costCenter?.id, costCenterName: costCenter?.name })),
    totalDebit: draft.totalDebit,
    totalCredit: draft.totalCredit,
    isBalanced: true,
    history: [],
  };
}

/** Displayed status of a voucher: a final entry with a reversal shows as «برگشت خورده». */
export function journalDisplayStatus(entry: JournalEntry, reversedIds: ReadonlySet<string>): string {
  return reversedIds.has(entry.id) ? 'برگشت خورده' : entry.status;
}

/** What the signed-in user may do with a voucher. */
export function journalEntryActions(
  user: UserProfile,
  entry: JournalEntry,
  reversedIds: ReadonlySet<string>,
  pendingReversals: ReadonlySet<string> = new Set()
) {
  const approve = checkPermission(user, 'journal.approve', journalContext(entry));
  return {
    /** Final, not itself a reversal, not reversed or waiting for a reversal, and the user may reverse in its project. */
    canReverse:
      (entry.status === 'ثبت قطعی' || entry.status === 'تأیید شده') &&
      !entry.reversedFromDocId &&
      !reversedIds.has(entry.id) &&
      !pendingReversals.has(entry.id) &&
      checkPermission(user, 'journal.reverse', { projectId: entry.projectId }).ok,
    canApprove: approve.ok,
    approveReason: approve.reason,
  };
}

// =============================================================================
// Reports from final entries
// =============================================================================

export interface TrialBalanceRow {
  code: string;
  name: string;
  debit: number;
  credit: number;
  /** Debit − credit. */
  balance: number;
  /** Debit and credit balances as shown in the two balance columns. */
  debitBalance: number;
  creditBalance: number;
}

export function selectFinancialReports(state: AppState, journalEntries: readonly JournalEntry[], projectId?: string) {
  const finals = journalEntries.filter(isFinalJournalEntry);
  const map = new Map<string, { name: string; debit: number; credit: number }>();
  for (const j of finals) {
    for (const r of j.rows) {
      const cur = map.get(r.accountCode) || { name: r.accountName, debit: 0, credit: 0 };
      map.set(r.accountCode, { name: cur.name, debit: cur.debit + r.debit, credit: cur.credit + r.credit });
    }
  }
  const trial: TrialBalanceRow[] = [...map]
    .map(([code, v]) => {
      const balance = v.debit - v.credit;
      return { code, ...v, balance, debitBalance: Math.max(0, balance), creditBalance: Math.max(0, -balance) };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const sumOf = (prefix: RegExp, rows: { code: string; balance: number }[] = trial) => sumBy(rows.filter((t) => prefix.test(t.code)), (t) => t.balance);
  // Income statement: the year-end closing entry moves results to retained earnings and is not a result itself.
  const pnlMap = new Map<string, number>();
  for (const j of finals) {
    if (j.type === 'بستن حساب‌ها') continue;
    for (const r of j.rows) pnlMap.set(r.accountCode, (pnlMap.get(r.accountCode) || 0) + r.debit - r.credit);
  }
  const pnlTrial = [...pnlMap].map(([code, balance]) => ({ code, balance }));
  const revenue = -sumOf(/^4/, pnlTrial);
  const directCost = sumOf(/^5/, pnlTrial);
  const financialCost = sumOf(/^62/, pnlTrial);
  const overhead = sumOf(/^6/, pnlTrial) - financialCost;

  const breakdown = projectId ? selectProjectCostBreakdown(state, projectId) : [];
  const breakdownTotal = sumBy(breakdown, (b) => b.amount);
  return {
    finals,
    trial,
    trialTotals: {
      debit: sumBy(trial, (t) => t.debit),
      credit: sumBy(trial, (t) => t.credit),
      debitBalance: sumBy(trial, (t) => t.debitBalance),
      creditBalance: sumBy(trial, (t) => t.creditBalance),
    },
    incomeStatement: { revenue, directCost, grossProfit: revenue - directCost, overhead, financialCost, profit: revenue - directCost - overhead - financialCost },
    // Balance sheet: profit of years not yet closed (closed years are already in retained earnings).
    balanceSheet: {
      assets: sumOf(/^1/),
      liabilities: -sumOf(/^2/),
      equity: -sumOf(/^3/),
      netProfit: -sumOf(/^[456]/),
      /** Liabilities + equity + profit of open years (equals assets when the books balance). */
      totalClaims: -sumOf(/^2/) - sumOf(/^3/) - sumOf(/^[456]/),
      assetRows: trial.filter((t) => t.code.startsWith('1') && t.balance !== 0),
      /** Liabilities and equity (credit balances shown as positive amounts). */
      claimRows: trial.filter((t) => /^[23]/.test(t.code) && t.balance !== 0).map((t) => ({ ...t, amount: -t.balance })),
    },
    projectFinancials: projectId ? selectProjectFinancials(state, projectId) : null,
    breakdown: breakdown.map((b) => ({ ...b, share: percentOf(b.amount, breakdownTotal) })),
    breakdownTotal,
  };
}

/** Revenue per project (group 4 of final entries) next to cash received and open receivables. */
export function selectRevenueRows(state: AppState, projects: readonly Project[]) {
  const posted = postedEntries(state);
  const rows = projects.map((p) => {
    let contractRevenue = 0;
    let otherRevenue = 0;
    for (const e of posted) {
      for (const r of e.rows) {
        if (r.projectId !== p.id || !r.accountCode.startsWith('4')) continue;
        const amount = r.credit - r.debit;
        if (r.accountCode === '41101') contractRevenue += amount;
        else otherRevenue += amount;
      }
    }
    return {
      id: p.id,
      project: p.name,
      client: p.client,
      contractRevenue,
      otherRevenue,
      totalRevenue: contractRevenue + otherRevenue,
      receivedCash: sumBy(state.receipts.filter((x) => x.projectId === p.id), (x) => x.amount),
      receivables: selectProjectFinancials(state, p.id).receivables,
    };
  });
  return { rows, totalContract: sumBy(rows, (r) => r.contractRevenue), totalOther: sumBy(rows, (r) => r.otherRevenue) };
}

/** Expense accounts (groups 5 and 6 of final entries), largest first, with their share of the total. */
export function selectExpenseRows(state: AppState) {
  const map = new Map<string, { name: string; amount: number }>();
  for (const e of postedEntries(state)) {
    for (const r of e.rows) {
      if (!/^[56]/.test(r.accountCode)) continue;
      const cur = map.get(r.accountCode) || { name: r.accountName, amount: 0 };
      map.set(r.accountCode, { name: cur.name, amount: cur.amount + r.debit - r.credit });
    }
  }
  const rows = [...map]
    .filter(([, v]) => v.amount !== 0)
    .map(([code, v]) => ({ code, name: v.name, amount: v.amount, direct: code.startsWith('5') }))
    .sort((a, b) => b.amount - a.amount);
  const totalDirect = sumBy(rows.filter((r) => r.direct), (r) => r.amount);
  const totalOverhead = sumBy(rows.filter((r) => !r.direct), (r) => r.amount);
  const total = totalDirect + totalOverhead;
  return {
    rows: rows.map((r) => ({ ...r, share: percentOf(r.amount, total) })),
    totalDirect,
    totalOverhead,
    total,
    directShare: percentOf(totalDirect, total),
    overheadShare: percentOf(totalOverhead, total),
  };
}

// =============================================================================
// Year-end closing
// =============================================================================

/** Fiscal years that have vouchers (newest first). */
export function fiscalYearsOf(entries: readonly JournalEntry[]): number[] {
  const set = new Set(entries.map((j) => tryFiscalYearOf(j.date)).filter((y): y is number => y !== null));
  set.add(getCurrentFiscalYear());
  return [...set].sort((a, b) => b - a);
}

export function selectYearClosing(entries: readonly JournalEntry[], closedFiscalYears: readonly number[], year: number) {
  const yearEntries = entries.filter((j) => tryFiscalYearOf(j.date) === year);
  const pending = yearEntries.filter((j) => j.status === 'در انتظار تأیید' || j.status === 'پیش‌نویس');
  const final = yearEntries.filter(isFinalJournalEntry);
  let revenue = 0;
  let cost = 0;
  for (const j of final) {
    for (const r of j.rows) {
      if (r.accountCode.startsWith('4')) revenue += r.credit - r.debit;
      else if (/^[56]/.test(r.accountCode)) cost += r.debit - r.credit;
    }
  }
  return {
    yearEntries,
    pending,
    final,
    revenue,
    cost,
    isProfit: revenue - cost >= 0,
    /** Profit or loss moved to retained earnings (absolute amount). */
    result: Math.abs(revenue - cost),
    isClosed: closedFiscalYears.includes(year),
  };
}
