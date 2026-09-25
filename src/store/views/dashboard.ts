/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** View models of the management dashboard widgets. */

import type { DetailedProgressStatement, Project } from '../../types';
import type { ExpenseCategoryTotal, MonthlyTrendPoint } from '../selectors';
import { clientStatementPhase, clientStatementReceivable } from '../statementPhase';
import { maxOf, percentOf, sumBy } from './common';

/** Expense categories (all, direct or overhead) with each one's share of the shown total. */
export function expenseBreakdown(totals: readonly ExpenseCategoryTotal[], filter: 'all' | 'direct' | 'indirect') {
  const rows = totals.filter((t) => (filter === 'direct' ? t.isDirect : filter === 'indirect' ? !t.isDirect : true));
  const total = sumBy(rows, (r) => r.amount);
  return { rows: rows.map((r) => ({ ...r, percent: percentOf(r.amount, total) })), total };
}

/** Monthly revenue, cost and profit with bar heights relative to the largest month. */
export function financialChart(data: readonly MonthlyTrendPoint[]) {
  const max = maxOf(data.map((d) => Math.max(d.revenue, d.cost)));
  const totalRevenue = sumBy(data, (d) => d.revenue);
  const totalProfit = sumBy(data, (d) => d.profit);
  let best: MonthlyTrendPoint | null = null;
  for (const d of data) if (!best || d.profit > best.profit) best = d;
  return {
    points: data.map((d) => ({
      ...d,
      revenuePercent: percentOf(d.revenue, max),
      costPercent: percentOf(d.cost, max),
      profitPercent: percentOf(Math.max(0, d.profit), max),
    })),
    /** The month with the highest profit, if any month made one. */
    best: best && best.profit > 0 ? best : null,
    totalRevenue,
    totalProfit,
    margin: percentOf(totalProfit, totalRevenue),
  };
}

/** Client statements on the dashboard: in review, receivable, overdue; each row with its phase. */
export function statementsSummary(statements: readonly DetailedProgressStatement[]) {
  const inReview = statements.filter((s) => clientStatementPhase(s) === 'in_review');
  return {
    pendingCount: inReview.length,
    unapprovedAmount: sumBy(inReview, (s) => s.netPayable),
    totalReceivables: sumBy(statements, clientStatementReceivable),
    totalReceived: sumBy(statements, (s) => s.receivedAmount),
    totalOverdue: sumBy(statements.filter((s) => clientStatementPhase(s) === 'overdue'), clientStatementReceivable),
    rows: statements.map((statement) => {
      const phase = clientStatementPhase(statement);
      return {
        statement,
        phase,
        /** Approved amount (nothing while still in review). */
        approvedAmount: phase === 'in_review' ? 0 : statement.approvedNetPayable ?? statement.netPayable,
        receivable: clientStatementReceivable(statement),
      };
    }),
  };
}

export function sumProjects(projects: readonly Project[]) {
  return {
    recordedRevenue: sumBy(projects, (p) => p.recordedRevenue),
    receivables: sumBy(projects, (p) => p.receivables),
  };
}
