/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** View models of HR and payroll. */

import type { PayrollPeriod, PayrollSlip } from '../../types';
import type { AppState } from '../types';
import { sumFields } from './common';

/** Totals of the month's payroll slips. */
export function payrollTotals(slips: readonly PayrollSlip[]) {
  const t = sumFields(slips, ['grossTotalSalary', 'netPayableSalary', 'workerInsuranceDeduction', 'employerInsuranceContribution', 'incomeTaxDeduction', 'totalCostForCompany']);
  return {
    gross: t.grossTotalSalary,
    net: t.netPayableSalary,
    workerInsurance: t.workerInsuranceDeduction,
    employerInsurance: t.employerInsuranceContribution,
    incomeTax: t.incomeTaxDeduction,
    companyLaborCost: t.totalCostForCompany,
  };
}

/** Payroll periods to choose from: the server's periods, else the months of the slips (demo); oldest first. */
export function payrollPeriodOptions(state: Pick<AppState, 'payrollPeriods' | 'payrollSlips'>): string[] {
  if (state.payrollPeriods.length) return state.payrollPeriods.map((p) => p.monthYear).sort();
  return [...new Set(state.payrollSlips.map((s) => s.monthYear))].sort();
}

/** The month has slips waiting for an approval step (calculated, or finance-approved with the server). */
export const payrollAwaitingApproval = (slips: readonly PayrollSlip[]) =>
  slips.some((s) => s.status === 'محاسبه شده' || (Boolean(s.server) && s.status === 'تأیید مالی'));

const PERIOD_STATUS: Record<string, string> = {
  draft: 'پیش‌نویس کارکرد',
  calculated: 'محاسبه شده؛ منتظر تأیید حسابدار',
  finance_approved: 'تأیید حسابدار؛ منتظر تأیید مدیر ارشد',
  approved: 'تأیید نهایی و سند صادر شد',
};
export const payrollPeriodStatusLabel = (p: PayrollPeriod) => PERIOD_STATUS[p.status] || p.status;
/** Timesheets can be edited (and the month calculated) until an approval step is taken. */
export const payrollPeriodEditable = (p: PayrollPeriod) => p.status === 'draft' || p.status === 'calculated';
export const payrollPeriodDecidable = (p: PayrollPeriod) => p.status === 'calculated' || p.status === 'finance_approved';

/** Timesheet rows of a period: every active employee, prefilled from the saved timesheet (else a full month). */
export function payrollTimesheetRows(state: Pick<AppState, 'employees' | 'timesheets'>, period: PayrollPeriod) {
  return state.employees
    .filter((e) => e.status === 'فعال')
    .map((e) => {
      const t = state.timesheets.find((x) => x.employeeId === e.id && x.server?.extra?.periodId === period.id);
      return {
        employeeId: e.id,
        employeeName: e.fullName,
        workDays: t ? t.actualWorkDays : 30,
        absentDays: t ? t.absentDays : 0,
        overtimeHours: t ? t.overtimeHours : 0,
        missionDays: t ? t.missionDays : 0,
      };
    });
}
