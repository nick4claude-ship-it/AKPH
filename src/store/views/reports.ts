/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** View models of management reports (BI screen and the printable PDF report). */

import type { Project } from '../../types';
import type { AppState } from '../types';
import { selectBudgetVsActual, selectReceivablesAging } from '../domainSelectors';
import { percentOf, sumBy } from './common';

/** Gross profit and margin of a project (approved revenue − actual cost). */
export function projectProfitability(p: Project) {
  const profit = p.recordedRevenue - p.actualCost;
  return { profit, margin: percentOf(profit, p.recordedRevenue || 1) };
}

/** Budget and progress variances of a project. */
export function projectVariance(p: Project) {
  return {
    /** Budget − actual cost (positive: under budget). */
    costVariance: p.budget - p.actualCost,
    /** Physical − financial progress, in percentage points. */
    progressVariance: p.physicalProgress - p.financialProgress,
  };
}

export function selectBiSummary(state: AppState, projects: readonly Project[]) {
  const totalContractRevenue = sumBy(projects, (p) => p.contractAmount);
  const totalApprovedRevenue = sumBy(projects, (p) => p.recordedRevenue);
  const totalActualCost = sumBy(projects, (p) => p.actualCost);
  const totalGrossProfit = totalApprovedRevenue - totalActualCost;
  const totalReceivables = sumBy(projects, (p) => p.receivables);
  const totalLiabilities = sumBy(projects, (p) => p.liabilities);

  // Receivables aging from approved, unpaid employer statements and their due dates.
  const aging = selectReceivablesAging(state);
  const agingTotal = sumBy(aging, (r) => r.remainingClaim);
  const bucket = (label: string, color: string, test: (days: number) => boolean) => {
    const amount = sumBy(aging.filter((r) => test(r.overdueDays)), (r) => r.remainingClaim);
    return { label, color, amount, percentage: agingTotal ? Math.round((amount * 1000) / agingTotal) / 10 : 0 };
  };
  return {
    totalContractRevenue,
    totalApprovedRevenue,
    totalActualCost,
    totalGrossProfit,
    averageMargin: percentOf(totalGrossProfit, totalApprovedRevenue || 1),
    totalReceivables,
    totalLiabilities,
    /** Receivables minus liabilities of the projects. */
    netWorkingPosition: totalReceivables - totalLiabilities,
    agingBuckets: [
      bucket('کمتر از ۳۰ روز (جاری)', 'bg-emerald-500', (d) => d < 30),
      bucket('۳۰ تا ۶۰ روز', 'bg-blue-500', (d) => d >= 30 && d < 60),
      bucket('۶۰ تا ۹۰ روز (نیازمند پیگیری)', 'bg-amber-500', (d) => d >= 60 && d < 90),
      bucket('بیش از ۹۰ روز (مطالبات معوق/ریسک)', 'bg-rose-500', (d) => d >= 90),
    ],
  };
}

/** Totals of the projects in the printable report. */
export function reportProjectTotals(projects: readonly Project[]) {
  const revenue = sumBy(projects, (p) => p.recordedRevenue);
  const profit = sumBy(projects, (p) => p.profit);
  return {
    contractAmount: sumBy(projects, (p) => p.contractAmount),
    revenue,
    cost: sumBy(projects, (p) => p.cost),
    profit,
    receivables: sumBy(projects, (p) => p.receivables),
    margin: percentOf(profit, revenue),
  };
}

/** Budget against actual cost per cost center of a project, with the totals. */
export function projectBudgetFigures(state: AppState, projectId: string) {
  const rows = selectBudgetVsActual(state, projectId);
  return { rows, budgetTotal: sumBy(rows, (r) => r.budget), actualTotal: sumBy(rows, (r) => r.actual) };
}
