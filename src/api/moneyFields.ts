/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Field names that hold money. Used at the data-source boundary to convert between the store
 * (integer Rials) and a source that keeps amounts in another unit: the mock seed (written in Tomans)
 * and a paydar-portal installation whose ledger currency is Toman.
 */
export const MONEY_FIELDS: ReadonlySet<string> = new Set([
  'actualBalance', 'actualCost', 'actualCountedCash', 'adjustmentAmount', 'advancePaid', 'advancePaymentAmount',
  'advancePaymentDeduction', 'allocatedCost', 'amortizedAmount', 'amount', 'approvedAmount', 'approvedBilledValue',
  'approvedChangesValue', 'approvedNetPayable', 'approvedRevenue', 'approvedStatementsValue', 'averageUnitPrice',
  'balance', 'balanceValuation', 'baseAmount', 'baseSalary', 'baseSalaryGross', 'billedAmount', 'billedValue', 'budget',
  'calculatedAdjustmentAmount', 'calculatedAmount', 'cashInflow', 'cashOutflow', 'ceiling', 'ceilingLimit',
  'childAllowance', 'closingBalance', 'contractAmount', 'contractValue', 'cost', 'credit', 'cumulativeAmount',
  'currentActualBalance', 'currentAmount', 'currentPayableBalance', 'currentReceivables', 'currentUsableBalance',
  'currentValue', 'debit', 'directCost', 'disciplinaryDeduction', 'discounts', 'discrepancy',
  'employerInsuranceContribution', 'estimatedTotalPrice', 'estimatedUnitPrice', 'executedAmount', 'executedValue',
  'expectedBalance', 'expenseIncurred', 'foodAllowance', 'forecastFinalCost', 'freightAndUnloadingCost',
  'freightCostPerUnit', 'grossAmount', 'grossTotalSalary', 'housingAllowance', 'incomeTaxDeduction', 'incurredDebt',
  'indirectCost', 'initialAmount', 'initialValue', 'insuranceDeduction', 'lastReplenishmentAmount', 'liabilities',
  'loanDeduction', 'maxSingleExpense', 'minBalanceWarning', 'missionPay', 'monthlySpent', 'netPayable',
  'netPayableSalary', 'netVarianceAmount', 'openingBalance', 'otherAllowableItemsAmount', 'otherDeductions',
  'overdueReceivables', 'overtimePay', 'paidAmount', 'paidValue', 'payableRemaining', 'penaltyOrDeductions',
  'pendingExpenses', 'previousValue', 'priceVarianceAmount', 'profit', 'projectLevelMax', 'qtyVarianceAmount',
  'receivableValue', 'receivables', 'receivedAmount', 'receivedValue', 'recordedRevenue', 'remainingAdvance',
  'remainingAmount', 'remainingBalance', 'remainingClaim', 'remainingContractValue', 'remainingDebt',
  'remainingPayable', 'remainingPayableValue', 'remainingValue', 'retention', 'retentionDeposit',
  'safetyOrWastePenalty', 'savingsVsBudgetAmount', 'shippingCost', 'siteLevelMax', 'siteVerifiedAmount',
  'specialSkillAllowance', 'subtotal', 'subtotalAmount', 'suggestedAmount', 'taxDeduction', 'totalAdvanceAmount',
  'totalAmortized', 'totalAmount', 'totalApprovedExpenses', 'totalApprovedRevenue', 'totalCollected',
  'totalContractValue', 'totalCost', 'totalCostForCompany', 'totalCredit', 'totalDebit', 'totalDeductions',
  'totalEstimatedAmount', 'totalFreightCost', 'totalGrossAmount', 'totalNetPrice', 'totalOrderAmount',
  'totalPayments', 'totalPrice', 'totalPurchasesAmount', 'totalQuoteAmount', 'totalReceipts', 'totalReplenishments',
  'totalStockValue', 'totalValuation', 'totalVatAmount', 'turnoverCredit', 'turnoverDebit', 'unclearedChecksAmount',
  'unitCost', 'unitPrice', 'unitRate', 'usableBalance', 'varianceAmount', 'vatAmount', 'workAmountCurrent',
]);

/** Objects whose every numeric value is money (e.g. a project's expense breakdown). */
const MONEY_MAPS: ReadonlySet<string> = new Set(['expenseBreakdown']);

/**
 * Deep copy of `value` with every money field multiplied by `factor` and rounded to an integer.
 * factor 10 converts Tomans to Rials, factor 0.1 converts Rials to Tomans.
 */
export function scaleMoney<T>(value: T, factor: number): T {
  const walk = (v: unknown, moneyMap: boolean): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x, false));
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (typeof x === 'number' && (moneyMap || MONEY_FIELDS.has(k))) out[k] = Math.round(x * factor);
        else out[k] = walk(x, MONEY_MAPS.has(k));
      }
      return out;
    }
    return v;
  };
  return walk(value, false) as T;
}
