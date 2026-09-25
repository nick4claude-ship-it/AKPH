/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** View models of HR and payroll. */

import type { PayrollSlip } from '../../types';
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
