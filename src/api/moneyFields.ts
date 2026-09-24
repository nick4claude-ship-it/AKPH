/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Money schema. Every numeric field of the domain types is classified exactly once: as money
 * (MONEY_FIELDS, integer Rials) or as a non-money number (NON_MONEY_NUMERIC_FIELDS: quantities, percentages,
 * days, scores). scripts/money-schema.ts fails when a numeric field is added without a classification.
 *
 * Amounts are integer Rials everywhere: in the store and on the wire (WordPress). Tomans exist only on screen.
 * The only conversion left is the demo seed, which is written in Tomans and turned into Rials once, at load.
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
  'workerInsuranceDeduction', 'returnedAmount',
]);

/** Numeric fields that are not money. */
export const NON_MONEY_NUMERIC_FIELDS: ReadonlySet<string> = new Set([
  // quantities and measures
  'acceptedQty', 'approvedQty', 'areaM2', 'balanceQty', 'contractQuantity', 'cumulativeExecutedQuantity', 'cumulativeQuantity',
  'currentPeriodQuantity', 'currentQuantity', 'currentStock', 'deliveredQty', 'exceededQuantity', 'grossWeightKg', 'inQty',
  'initialQuantity', 'inventoryConsumedQty', 'inventoryQuantity', 'issuedQty', 'maxCapacity', 'minSafetyStock', 'netWeightKg',
  'orderedQty', 'outQty', 'physicalCount', 'previousQuantity', 'qty', 'quantity', 'receivedQty', 'rejectedQty', 'reorderLevel',
  'requestedQty', 'requiredQty', 'reservedQty', 'siteEngineerApprovedQty', 'surplusQuantity', 'systemStock', 'tareWeightKg',
  'varianceQty',
  // percentages, rates, indices, scores
  'advancePaymentPercentage', 'basePeriodIndex', 'changePercent', 'changePercentage', 'coefficient', 'compositeScore',
  'currentPeriodIndex', 'deliveryProgressPercentage', 'deliveryScore', 'financialProgress', 'lowBalancePercent',
  'onTimeDeliveryRate', 'overallRating', 'paymentFlexibility', 'percentage', 'physicalProgress', 'priceCompetitiveness',
  'profitMargin', 'progressPercentage', 'qualityScore', 'rate', 'rejectionRate', 'retentionPercentage', 'scoreCommercial',
  'scoreTechnical', 'vatRate', 'vatRatePercent',
  // time and counts
  'absentDays', 'actualWorkDays', 'childrenCount', 'deliveryLeadTimeDays', 'documentCount', 'durationExtensionMonths',
  'durationMonths', 'extendedDays', 'holidayWorkHours', 'itemsCount', 'missionDays', 'nightWorkHours', 'overdueDays',
  'overtimeHours', 'paidLeaveDays', 'standardWorkDays', 'totalOrdersCount', 'warrantyMonths',
  // technical / derived display values (KpiItem.value is formatted by its own unit; version is a server token)
  'value', 'version',
]);

/** Objects whose every numeric value is money (e.g. a project's expense breakdown). */
export const MONEY_MAPS: ReadonlySet<string> = new Set(['expenseBreakdown']);

/** Keys of the money maps above (all money). */
export const MONEY_MAP_MEMBERS: ReadonlySet<string> = new Set([
  'materials', 'labor', 'machinery', 'transport', 'subcontractors', 'procurement', 'office', 'insurance', 'tax', 'other',
]);

/**
 * Demo seed only: deep copy with every money field converted from Tomans to Rials (×10). A Toman seed
 * value that is not an integer is a data error and stops the demo instead of being rounded silently.
 */
export function seedTomansToRials<T>(value: T): T {
  const walk = (v: unknown, moneyMap: boolean, path: string): unknown => {
    if (Array.isArray(v)) return v.map((x, i) => walk(x, false, `${path}[${i}]`));
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (typeof x === 'number' && (moneyMap || MONEY_FIELDS.has(k))) {
          if (!Number.isSafeInteger(x * 10)) throw new Error(`[Seed] مبلغ ${path}.${k}=${x} عدد صحیح تومان نیست.`);
          out[k] = x * 10;
        } else out[k] = walk(x, MONEY_MAPS.has(k), `${path}.${k}`);
      }
      return out;
    }
    return v;
  };
  return walk(value, false, 'seed') as T;
}
