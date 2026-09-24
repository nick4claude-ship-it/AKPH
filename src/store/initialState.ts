/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, FinancialEventInput } from './types';
import { postFinancialEventToState } from './postingEngine';
import {
  clientStatementApprovedEvent,
  subcontractorStatementApprovedEvent,
  goodsReceiptEvent,
  vendorInvoiceEvent,
  storeIssueEvent,
  pettyCashExpenseApprovedEvent,
  payrollApprovedEvent,
} from './events';
import { mockProjects, mockPendingApprovals, mockManagementAlerts } from '../data/mockData';
import {
  mockChartOfAccounts,
  mockBankAccounts,
  mockCostCenters,
  mockJournalEntries,
  mockReceipts,
  mockPayments,
  mockBankReconciliationItems,
} from '../data/accountingMockData';
import { mockCounterparties } from '../data/counterpartiesMockData';
import { mockContracts, mockDetailedStatements, mockStatementPayments } from '../data/contractsMockData';
import { mockSubcontractorContracts, mockSubcontractorStatements } from '../data/subcontractorsMockData';
import { mockCashDesks, mockPaymentRequests } from '../data/paymentsTreasuryMockData';
import { mockSystemDocuments } from '../data/documentsMockData';
import { initialPettyCashAccounts, initialPettyCashExpenses } from '../data/pettyCashMockData';
import { mockPurchaseOrders, mockVendorInvoices } from '../data/procurementMockData';
import {
  mockGoodsReceipts,
  mockStoreIssues,
  mockMaterialItems,
  mockWarehouses,
} from '../data/inventoryMockData';
import { mockPayrollSlips } from '../data/hrPayrollMockData';

export const CLIENT_APPROVED_STATUSES = ['approved_by_employer', 'claimed', 'partially_paid', 'paid'];
export const SUBCONTRACTOR_APPROVED_STATUSES = ['management_approved', 'paid'];
export const PETTY_CASH_APPROVED_STATUSES = ['approved', 'accounting_posted', 'reconciled'];
export const VENDOR_INVOICE_APPROVED_STATUSES = ['تأیید تطبیق سه‌جانبه', 'پرداخت شده', 'پرداخت ناقص'];
export const PAYROLL_APPROVED_STATUSES = ['تأیید مالی', 'صادر شده جهت پرداخت', 'پرداخت شده'];

export function emptyState(): AppState {
  return {
    projects: [],
    costCenters: [],
    counterparties: [],
    contracts: [],
    clientStatements: [],
    statementPayments: [],
    subcontractorContracts: [],
    subcontractorStatements: [],
    financialEvents: [],
    journalEntries: [],
    chartOfAccounts: [],
    bankAccounts: [],
    cashDesks: [],
    pettyCashAccounts: [],
    pettyCashExpenses: [],
    paymentRequests: [],
    receipts: [],
    payments: [],
    documents: [],
    bankReconciliations: [],
    purchaseOrders: [],
    vendorInvoices: [],
    goodsReceipts: [],
    storeIssues: [],
    materials: [],
    warehouses: [],
    payrollSlips: [],
    pendingApprovals: [],
    alerts: [],
  };
}

/**
 * Historical operational records that were already approved before this session are posted through
 * the same engine, so the ledger (and every figure derived from it) reflects them exactly once.
 * Their cash effects are already contained in the opening bank/petty-cash balances, so balances are
 * not re-synced during seeding.
 */
function seedEvents(state: AppState): FinancialEventInput[] {
  const events: FinancialEventInput[] = [];

  for (const s of state.clientStatements) {
    if (!CLIENT_APPROVED_STATUSES.includes(s.status)) continue;
    const contract = state.contracts.find((c) => c.id === s.contractId);
    const costCenterId = s.costCenterId || contract?.costCenterId || '';
    const counterpartyId = s.counterpartyId || contract?.counterpartyId || '';
    events.push(clientStatementApprovedEvent(s, costCenterId, counterpartyId));
    if (s.receivedAmount > 0) {
      events.push({
        type: 'TREASURY_RECEIPT',
        sourceModule: 'contracts',
        sourceId: `${s.id}:opening-receipts`,
        projectId: s.projectId,
        costCenterId,
        counterpartyId,
        amount: s.receivedAmount,
        date: s.preparationDate,
        details: { docNumber: `وصولی‌های ${s.statementNumber}`, bankAccountId: state.bankAccounts[0]?.id },
      });
    }
  }

  for (const s of state.subcontractorStatements) {
    if (!SUBCONTRACTOR_APPROVED_STATUSES.includes(s.status)) continue;
    events.push(subcontractorStatementApprovedEvent(s));
    if (s.paidAmount > 0) {
      events.push({
        type: 'TREASURY_PAYMENT',
        sourceModule: 'subcontractors',
        sourceId: `${s.id}:opening-payments`,
        projectId: s.projectId,
        costCenterId: s.costCenterId,
        counterpartyId: s.counterpartyId,
        amount: s.paidAmount,
        date: s.paymentDate || s.submissionDate,
        details: { docNumber: s.statementNumber, payableType: 'subcontractor', bankAccountId: s.payingBankId || state.bankAccounts[0]?.id },
      });
    }
  }

  for (const g of state.goodsReceipts) {
    if (g.status === 'تأیید نهایی انبارداری') events.push(goodsReceiptEvent(g));
  }

  for (const inv of state.vendorInvoices) {
    if (!VENDOR_INVOICE_APPROVED_STATUSES.includes(inv.status)) continue;
    events.push(vendorInvoiceEvent(inv));
    if (inv.paidAmount > 0) {
      events.push({
        type: 'TREASURY_PAYMENT',
        sourceModule: 'procurement',
        sourceId: `${inv.id}:opening-payments`,
        projectId: inv.projectId,
        costCenterId: inv.costCenterId || '',
        counterpartyId: inv.counterpartyId || inv.supplierId,
        amount: inv.paidAmount,
        date: inv.invoiceDate,
        details: { docNumber: inv.invoiceNumber, payableType: 'supplier', bankAccountId: state.bankAccounts[0]?.id },
      });
    }
  }

  for (const v of state.storeIssues) {
    if (v.status === 'خروج قطعی از انبار') events.push(storeIssueEvent(v, v.totalCost));
  }

  for (const exp of state.pettyCashExpenses) {
    if (!PETTY_CASH_APPROVED_STATUSES.includes(exp.status)) continue;
    const account = state.pettyCashAccounts.find((a) => a.id === exp.pettyCashId);
    events.push(pettyCashExpenseApprovedEvent(exp, account));
  }

  const approvedSlips = state.payrollSlips.filter((s) => PAYROLL_APPROVED_STATUSES.includes(s.status));
  const periods = [...new Set(approvedSlips.map((s) => s.monthYear))];
  for (const period of periods) {
    const slips = approvedSlips.filter((s) => s.monthYear === period);
    events.push(payrollApprovedEvent(payrollPeriodId(period), period, slips));
    const paid = slips.filter((s) => s.status === 'پرداخت شده');
    const paidNet = paid.reduce((a, s) => a + s.netPayableSalary, 0);
    if (paidNet > 0) {
      events.push({
        type: 'TREASURY_PAYMENT',
        sourceModule: 'payroll',
        sourceId: `${payrollPeriodId(period)}:opening-payments`,
        projectId: '',
        costCenterId: '',
        counterpartyId: '',
        amount: paidNet,
        date: paid[0].issueDate,
        details: { docNumber: `پرداخت حقوق ${period}`, payableType: 'payroll', bankAccountId: state.bankAccounts[0]?.id },
      });
    }
  }

  return events;
}

export function payrollPeriodId(period: string): string {
  return `PAYROLL-${period.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace('/', '-')}`;
}

export function buildInitialState(): AppState {
  let state: AppState = {
    ...emptyState(),
    projects: mockProjects,
    costCenters: mockCostCenters,
    counterparties: mockCounterparties,
    contracts: mockContracts,
    clientStatements: mockDetailedStatements,
    statementPayments: mockStatementPayments,
    subcontractorContracts: mockSubcontractorContracts,
    subcontractorStatements: mockSubcontractorStatements,
    journalEntries: mockJournalEntries,
    chartOfAccounts: mockChartOfAccounts,
    bankAccounts: mockBankAccounts,
    cashDesks: mockCashDesks,
    pettyCashAccounts: initialPettyCashAccounts,
    pettyCashExpenses: initialPettyCashExpenses,
    paymentRequests: mockPaymentRequests,
    receipts: mockReceipts,
    payments: mockPayments,
    documents: mockSystemDocuments,
    bankReconciliations: mockBankReconciliationItems,
    purchaseOrders: mockPurchaseOrders,
    vendorInvoices: mockVendorInvoices,
    goodsReceipts: mockGoodsReceipts,
    storeIssues: mockStoreIssues,
    materials: mockMaterialItems,
    warehouses: mockWarehouses,
    payrollSlips: mockPayrollSlips,
    pendingApprovals: mockPendingApprovals,
    alerts: mockManagementAlerts,
  };

  for (const input of seedEvents(state)) {
    const { state: next, result } = postFinancialEventToState(state, input, {
      submitter: 'انتقال مانده‌های افتتاحیه',
      syncBalances: false,
    });
    if (!result.ok) console.warn('[Seed]', result.error);
    state = next;
  }
  return linkSourceDocuments(state);
}

/** Stamps each operational record with the accounting document created for it. */
function linkSourceDocuments(state: AppState): AppState {
  const doc = (type: string, sourceId: string) =>
    state.financialEvents.find((e) => e.type === type && e.sourceId === sourceId)?.docNumber;
  const payrollDocBySlip = new Map<string, string>();
  for (const e of state.financialEvents) {
    if (e.type !== 'PAYROLL_APPROVED') continue;
    for (const id of (e.details?.slipIds as string[]) || []) payrollDocBySlip.set(id, e.docNumber!);
  }
  return {
    ...state,
    clientStatements: state.clientStatements.map((s) => ({
      ...s,
      accountingJournalEntryId: doc('CLIENT_STATEMENT_APPROVED', s.id) || s.accountingJournalEntryId,
    })),
    subcontractorStatements: state.subcontractorStatements.map((s) => ({
      ...s,
      projectExpenseRecordId: doc('SUBCONTRACTOR_STATEMENT_APPROVED', s.id) || s.projectExpenseRecordId,
    })),
    goodsReceipts: state.goodsReceipts.map((g) => ({
      ...g,
      accountingJournalEntryId: doc('GOODS_RECEIPT', g.id) || g.accountingJournalEntryId,
    })),
    vendorInvoices: state.vendorInvoices.map((i) => ({
      ...i,
      accountingEntryNumber: doc('VENDOR_INVOICE', i.id) || i.accountingEntryNumber,
    })),
    storeIssues: state.storeIssues.map((v) => ({
      ...v,
      accountingJournalEntryId: doc('STORE_ISSUE', v.id) || v.accountingJournalEntryId,
    })),
    pettyCashExpenses: state.pettyCashExpenses.map((x) => ({
      ...x,
      journalEntryId: doc('PETTY_CASH_EXPENSE_APPROVED', x.id) || x.journalEntryId,
    })),
    payrollSlips: state.payrollSlips.map((s) => ({ ...s, journalEntryId: payrollDocBySlip.get(s.id) || s.journalEntryId })),
  };
}
