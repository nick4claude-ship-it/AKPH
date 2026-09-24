/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FinanceSettings, PettyCashSettings } from '../types';
import { AppState } from './types';

export const CLIENT_APPROVED_STATUSES = ['approved_by_employer', 'claimed', 'partially_paid', 'paid'];
export const SUBCONTRACTOR_APPROVED_STATUSES = ['management_approved', 'paid'];
export const PETTY_CASH_APPROVED_STATUSES = ['approved', 'accounting_posted', 'reconciled'];
export const VENDOR_INVOICE_APPROVED_STATUSES = ['تأیید تطبیق سه‌جانبه', 'پرداخت شده', 'پرداخت ناقص'];
export const PAYROLL_APPROVED_STATUSES = ['تأیید مالی', 'صادر شده جهت پرداخت', 'پرداخت شده'];

/** Subledger used for historical cash movements whose bank account is not recorded in the source data. */
export const OPENING_BALANCE_SUBLEDGER = 'opening-balance';

/** Defaults used until the data source provides its own settings. Amounts are Rials. */
export const DEFAULT_PETTY_CASH_SETTINGS: PettyCashSettings = {
  fundLimits: {
    project_manager: { ceiling: 3_000_000_000, minBalanceWarning: 600_000_000, maxSingleExpense: 1_000_000_000 },
    site_supervisor: { ceiling: 2_500_000_000, minBalanceWarning: 500_000_000, maxSingleExpense: 500_000_000 },
    procurement: { ceiling: 1_500_000_000, minBalanceWarning: 400_000_000, maxSingleExpense: 800_000_000 },
    headquarters: { ceiling: 1_200_000_000, minBalanceWarning: 300_000_000, maxSingleExpense: 400_000_000 },
  },
  siteLevelMax: 200_000_000,
  projectLevelMax: 1_000_000_000,
  approvalChains: {
    site_manager_and_finance: ['حسابدار'],
    project_and_finance: ['مدیر پروژه', 'حسابدار'],
    ceo_full: ['مدیر پروژه', 'حسابدار', 'مدیر ارشد'],
  },
  lowBalancePercent: 25,
};

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  vatRatePercent: 10,
  closedFiscalYears: [],
};

export function emptyState(): AppState {
  return {
    projects: [],
    costCenters: [],
    counterparties: [],
    contracts: [],
    clientStatements: [],
    subcontractorContracts: [],
    subcontractorStatements: [],
    financialEvents: [],
    journalEntries: [],
    chartOfAccounts: [],
    bankAccounts: [],
    cashDesks: [],
    pettyCashAccounts: [],
    pettyCashExpenses: [],
    pettyCashReplenishments: [],
    pettyCashRequests: [],
    pettyCashSettings: DEFAULT_PETTY_CASH_SETTINGS,
    paymentRequests: [],
    receipts: [],
    payments: [],
    documents: [],
    bankReconciliations: [],
    purchaseRequisitions: [],
    purchaseOrders: [],
    vendorInvoices: [],
    goodsReceipts: [],
    storeIssues: [],
    materials: [],
    warehouses: [],
    stockBalances: [],
    stockReservations: [],
    stockReturns: [],
    payrollSlips: [],
    employees: [],
    timesheets: [],
    subledgers: [],
    auditLogs: [],
    treasuryChecks: [],
    suppliers: [],
    rfqs: [],
    interTransfers: [],
    stocktakes: [],
    kardex: [],
    contractBoq: [],
    contractAmendments: [],
    advancePayments: [],
    priceAdjustments: [],
    contractAuditLogs: [],
    pettyCashReconciliations: [],
    pettyCashCategories: [],
    financeSettings: DEFAULT_FINANCE_SETTINGS,
    dismissedNotificationIds: [],
  };
}

export function payrollPeriodId(period: string): string {
  return `PAYROLL-${period.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace('/', '-')}`;
}

/** Slices whose records without a project belong to head office and are hidden from project managers. */
const LEDGER_SLICES = new Set([
  'journalEntries',
  'financialEvents',
  'receipts',
  'payments',
  'paymentRequests',
  'payrollSlips',
  'bankReconciliations',
  'auditLogs',
  'treasuryChecks',
]);

/**
 * Keeps only the records a user may see. Project managers see their own projects: records of other
 * projects are dropped, head-office ledger records too, and contract-level records follow their
 * contract. The WordPress source applies the same rule on the server; the mock source applies it here.
 */
export function scopeStateToProjects(state: AppState, projectIds: string[] | undefined): AppState {
  if (!projectIds) return state;
  const allowed = new Set(projectIds);
  const out = { ...state } as unknown as Record<string, unknown>;
  type Row = { id?: string; projectId?: string | null; contractId?: string; warehouseId?: string; links?: { entityType: string; entityId: string }[] };

  for (const [key, value] of Object.entries(state)) {
    if (!Array.isArray(value)) continue;
    const rows = value as Row[];
    if (key === 'projects') {
      out[key] = rows.filter((p) => p.id && allowed.has(p.id));
    } else if (LEDGER_SLICES.has(key)) {
      out[key] = rows.filter((r) => !!r.projectId && allowed.has(r.projectId));
    } else if (key === 'documents') {
      out[key] = rows.filter((d) => {
        const projects = (d.links || []).filter((l) => l.entityType === 'project');
        return projects.length === 0 || projects.some((l) => allowed.has(l.entityId));
      });
    } else {
      out[key] = rows.filter((r) => typeof r !== 'object' || r === null || !r.projectId || allowed.has(r.projectId));
    }
  }

  const contractIds = new Set((out.contracts as Row[]).map((c) => c.id));
  for (const key of ['contractBoq', 'contractAmendments', 'advancePayments', 'priceAdjustments', 'contractAuditLogs']) {
    out[key] = (out[key] as Row[]).filter((r) => !r.contractId || contractIds.has(r.contractId));
  }
  const warehouseIds = new Set((out.warehouses as Row[]).map((w) => w.id));
  for (const key of ['stockBalances', 'stockReservations', 'stocktakes', 'kardex']) {
    out[key] = (out[key] as Row[]).filter((r) => !r.warehouseId || warehouseIds.has(r.warehouseId));
  }
  return out as unknown as AppState;
}
