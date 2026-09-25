/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CompanyProfile } from '../../types';
import { seedTomansToRials } from '../moneyFields';
import { demoDataEnabled } from './demoFlag';
import { mockProjects, mockUsers } from './data/mockData';
import {
  mockChartOfAccounts,
  mockBankAccounts,
  mockCostCenters,
  mockJournalEntries,
  mockReceipts,
  mockPayments,
  mockBankReconciliationItems,
  mockSubledgers,
  mockAuditLogs,
} from './data/accountingMockData';
import { mockCounterparties } from './data/counterpartiesMockData';
import {
  mockContracts,
  mockDetailedStatements,
  mockStatementPayments,
  mockContractDocuments,
  mockContractBOQ,
  mockAmendments,
  mockAdvancePayments,
  mockPriceAdjustments,
  mockContractAuditLogs,
} from './data/contractsMockData';
import { mockSubcontractorContracts, mockSubcontractorStatements } from './data/subcontractorsMockData';
import { mockCashDesks, mockTreasuryChecks } from './data/paymentsTreasuryMockData';
import { mockSystemDocuments } from './data/documentsMockData';
import {
  initialPettyCashAccounts,
  initialPettyCashExpenses,
  initialPettyCashReplenishments,
  initialPettyCashRequests,
  initialPettyCashSettings,
  initialPettyCashReconciliations,
  initialPettyCashCategories,
} from './data/pettyCashMockData';
import { mockPurchaseOrders, mockVendorInvoices, mockRequisitions, mockSuppliers, mockRfqs } from './data/procurementMockData';
import {
  mockGoodsReceipts,
  mockStoreIssues,
  mockMaterialItems,
  mockWarehouses,
  mockInterTransfers,
  mockStocktakeAudits,
  mockKardexRecords,
} from './data/inventoryMockData';
import { mockPayrollSlips, mockEmployees, mockTimesheets } from './data/hrPayrollMockData';

const isDev = demoDataEnabled();

/**
 * The demo dataset. The seed files are written in Tomans; they are converted to integer Rials
 * here, once, so the store only ever holds Rials. Operational demo records exist only in DEV and demo builds (see demoFlag.ts).
 */
export function loadMockSeeds() {
  const operational = isDev
    ? {
        projects: mockProjects,
        counterparties: mockCounterparties,
        contracts: mockContracts,
        detailedStatements: mockDetailedStatements,
        statementPayments: mockStatementPayments,
        contractDocuments: mockContractDocuments,
        contractBoq: mockContractBOQ,
        contractAmendments: mockAmendments,
        advancePayments: mockAdvancePayments,
        priceAdjustments: mockPriceAdjustments,
        contractAuditLogs: mockContractAuditLogs,
        subcontractorContracts: mockSubcontractorContracts,
        subcontractorStatements: mockSubcontractorStatements,
        journalEntries: mockJournalEntries,
        receipts: mockReceipts,
        payments: mockPayments,
        bankReconciliations: mockBankReconciliationItems,
        auditLogs: mockAuditLogs,
        cashDesks: mockCashDesks,
        treasuryChecks: mockTreasuryChecks,
        systemDocuments: mockSystemDocuments,
        pettyCashAccounts: initialPettyCashAccounts,
        pettyCashExpenses: initialPettyCashExpenses,
        pettyCashReplenishments: initialPettyCashReplenishments,
        pettyCashRequests: initialPettyCashRequests,
        pettyCashReconciliations: initialPettyCashReconciliations,
        purchaseOrders: mockPurchaseOrders,
        vendorInvoices: mockVendorInvoices,
        requisitions: mockRequisitions,
        suppliers: mockSuppliers,
        rfqs: mockRfqs,
        goodsReceipts: mockGoodsReceipts,
        storeIssues: mockStoreIssues,
        materials: mockMaterialItems,
        warehouses: mockWarehouses,
        interTransfers: mockInterTransfers,
        stocktakes: mockStocktakeAudits,
        kardex: mockKardexRecords,
        payrollSlips: mockPayrollSlips,
        employees: mockEmployees,
        timesheets: mockTimesheets,
      }
    : null;

  const reference = {
    chartOfAccounts: mockChartOfAccounts,
    costCenters: mockCostCenters,
    bankAccounts: isDev ? mockBankAccounts : [],
    subledgers: isDev ? mockSubledgers : [],
    pettyCashSettings: initialPettyCashSettings,
    pettyCashCategories: initialPettyCashCategories,
  };

  return seedTomansToRials({ ...reference, operational });
}

export type MockSeeds = ReturnType<typeof loadMockSeeds>;
export type OperationalSeeds = NonNullable<MockSeeds['operational']>;

export { mockUsers };

/** The fictional company of the demo dataset. Identifiers fail their check digits, so they match no real company. */
export const demoCompany: CompanyProfile = {
  name: 'شرکت پیمانکاری نمونه',
  legalName: 'شرکت پیمانکاری نمونه (سهامی خاص) — داده ساختگی',
  nationalId: '۱۰۱۰۰۰۰۰۰۰۱',
  registrationNumber: '۰۰۰۰۰۱',
};
