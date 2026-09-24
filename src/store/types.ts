/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Project,
  CostCenter,
  Counterparty,
  Contract,
  DetailedProgressStatement,
  SubcontractorContract,
  SubcontractorProgressStatement,
  FinancialEvent,
  JournalEntry,
  BankAccount,
  CashDesk,
  PaymentRequest,
  ReceiptRecord,
  PaymentRecord,
  SystemDocument,
  PettyCashAccount,
  PettyCashExpense,
  PurchaseRequisition,
  PurchaseOrder,
  VendorInvoice,
  GoodsReceiptNote,
  StoreIssueVoucher,
  MaterialItem,
  Warehouse,
  BankReconciliationItem,
  PayrollSlip,
  PendingApproval,
  ManagementAlert,
} from '../types';

export interface AppState {
  projects: Project[];
  costCenters: CostCenter[];
  counterparties: Counterparty[];
  contracts: Contract[];
  clientStatements: DetailedProgressStatement[];
  subcontractorContracts: SubcontractorContract[];
  subcontractorStatements: SubcontractorProgressStatement[];
  financialEvents: FinancialEvent[];
  journalEntries: JournalEntry[];
  bankAccounts: BankAccount[];
  cashDesks: CashDesk[];
  paymentRequests: PaymentRequest[];
  receipts: ReceiptRecord[];
  payments: PaymentRecord[];
  documents: SystemDocument[];
  pettyCashAccounts: PettyCashAccount[];
  pettyCashExpenses: PettyCashExpense[];
  purchaseRequisitions: PurchaseRequisition[];
  purchaseOrders: PurchaseOrder[];
  vendorInvoices: VendorInvoice[];
  goodsReceipts: GoodsReceiptNote[];
  storeIssues: StoreIssueVoucher[];
  materials: MaterialItem[];
  warehouses: Warehouse[];
  bankReconciliations: BankReconciliationItem[];
  payrollSlips: PayrollSlip[];
  pendingApprovals: PendingApproval[];
  alerts: ManagementAlert[];
}

export type AppAction =
  | { type: 'POST_FINANCIAL_EVENT'; payload: { event: FinancialEvent; journalEntry?: JournalEntry } }
  | { type: 'ADD_JOURNAL_ENTRY'; payload: JournalEntry }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'ADD_CONTRACT'; payload: Contract }
  | { type: 'UPDATE_CONTRACT'; payload: Contract }
  | { type: 'ADD_CLIENT_STATEMENT'; payload: DetailedProgressStatement }
  | { type: 'UPDATE_CLIENT_STATEMENT'; payload: DetailedProgressStatement }
  | { type: 'APPROVE_CLIENT_STATEMENT'; payload: { id: string; approvedAmount?: number } }
  | { type: 'ADD_SUBCONTRACTOR_CONTRACT'; payload: SubcontractorContract }
  | { type: 'UPDATE_SUBCONTRACTOR_CONTRACT'; payload: SubcontractorContract }
  | { type: 'ADD_SUBCONTRACTOR_STATEMENT'; payload: SubcontractorProgressStatement }
  | { type: 'UPDATE_SUBCONTRACTOR_STATEMENT'; payload: SubcontractorProgressStatement }
  | { type: 'APPROVE_SUBCONTRACTOR_STATEMENT'; payload: { id: string } }
  | { type: 'ADD_PURCHASE_REQUISITION'; payload: PurchaseRequisition }
  | { type: 'UPDATE_PURCHASE_REQUISITION'; payload: PurchaseRequisition }
  | { type: 'ADD_PURCHASE_ORDER'; payload: PurchaseOrder }
  | { type: 'UPDATE_PURCHASE_ORDER'; payload: PurchaseOrder }
  | { type: 'ADD_GOODS_RECEIPT'; payload: GoodsReceiptNote }
  | { type: 'ADD_VENDOR_INVOICE'; payload: VendorInvoice }
  | { type: 'APPROVE_VENDOR_INVOICE'; payload: { id: string } }
  | { type: 'ADD_STORE_ISSUE'; payload: StoreIssueVoucher }
  | { type: 'ADD_PETTY_CASH_EXPENSE'; payload: PettyCashExpense }
  | { type: 'APPROVE_PETTY_CASH_EXPENSE'; payload: { id: string } }
  | { type: 'REPLENISH_PETTY_CASH'; payload: { accountId: string; amount: number; sourceBankId: string } }
  | { type: 'EXECUTE_PAYMENT'; payload: { payment: PaymentRecord; bankAccountId: string } }
  | { type: 'EXECUTE_RECEIPT'; payload: { receipt: ReceiptRecord; bankAccountId: string } }
  | { type: 'MATCH_BANK_RECONCILIATION'; payload: { id: string; matchedDocNumber: string } }
  | { type: 'APPROVE_PAYROLL'; payload: { id: string } }
  | { type: 'ADD_DOCUMENT'; payload: SystemDocument }
  | { type: 'APPROVE_PENDING_APPROVAL'; payload: { id: string; approverName: string } }
  | { type: 'REJECT_PENDING_APPROVAL'; payload: { id: string; reason: string } }
  | { type: 'DISMISS_ALERT'; payload: { id: string } };
