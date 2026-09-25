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
  AccountNode,
  BankAccount,
  ReceiptRecord,
  PaymentRecord,
  AppDocument,
  PettyCashSettings,
  PettyCashReplenishment,
  PettyCashReplenishmentRequest,
  PurchaseRequisition,
  StockBalance,
  StockReservation,
  StockReturn,
  PettyCashAccount,
  PettyCashExpense,
  PurchaseOrder,
  VendorInvoice,
  GoodsReceiptNote,
  StoreIssueVoucher,
  MaterialItem,
  Warehouse,
  BankReconciliationItem,
  PayrollSlip,
  PaymentRequest,
  ProjectCashDesk,
  Subledger,
  AuditLog,
  TreasuryCheck,
  Supplier,
  RequestForQuotation,
  InterWarehouseTransfer,
  StocktakeAudit,
  KardexEntry,
  Employee,
  MonthlyTimesheet,
  ContractBOQItem,
  ContractAmendment,
  AdvancePaymentRecord,
  PriceAdjustment,
  ContractAuditLog,
  PettyCashReconciliation,
  PettyCashCategoryItem,
  FinanceSettings,
} from '../types';

/**
 * تنها منبع داده برنامه. هر موجودیت فقط یک نسخه دارد و همه ماژول‌ها از همین‌جا می‌خوانند و می‌نویسند.
 */
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
  chartOfAccounts: AccountNode[];
  bankAccounts: BankAccount[];
  cashDesks: ProjectCashDesk[];
  pettyCashAccounts: PettyCashAccount[];
  pettyCashExpenses: PettyCashExpense[];
  pettyCashReplenishments: PettyCashReplenishment[];
  pettyCashRequests: PettyCashReplenishmentRequest[];
  pettyCashSettings: PettyCashSettings;
  paymentRequests: PaymentRequest[];
  receipts: ReceiptRecord[];
  payments: PaymentRecord[];
  documents: AppDocument[];
  bankReconciliations: BankReconciliationItem[];
  purchaseRequisitions: PurchaseRequisition[];
  purchaseOrders: PurchaseOrder[];
  vendorInvoices: VendorInvoice[];
  goodsReceipts: GoodsReceiptNote[];
  storeIssues: StoreIssueVoucher[];
  materials: MaterialItem[];
  warehouses: Warehouse[];
  stockBalances: StockBalance[];
  stockReservations: StockReservation[];
  stockReturns: StockReturn[];
  payrollSlips: PayrollSlip[];
  employees: Employee[];
  timesheets: MonthlyTimesheet[];
  subledgers: Subledger[];
  auditLogs: AuditLog[];
  treasuryChecks: TreasuryCheck[];
  suppliers: Supplier[];
  rfqs: RequestForQuotation[];
  interTransfers: InterWarehouseTransfer[];
  stocktakes: StocktakeAudit[];
  kardex: KardexEntry[];
  contractBoq: ContractBOQItem[];
  contractAmendments: ContractAmendment[];
  advancePayments: AdvancePaymentRecord[];
  priceAdjustments: PriceAdjustment[];
  contractAuditLogs: ContractAuditLog[];
  pettyCashReconciliations: PettyCashReconciliation[];
  pettyCashCategories: PettyCashCategoryItem[];
  financeSettings: FinanceSettings;
  /** Only dismissals are stored; notifications themselves are computed from data. */
  /** Notifications each user has dismissed (per user id). */
  dismissedNotificationIds: Record<string, string[]>;
}

export type SliceKey = keyof AppState;

export type SliceUpdater<K extends SliceKey> = AppState[K] | ((prev: AppState[K]) => AppState[K]);

export type AppAction =
  | { type: 'SET_SLICE'; key: SliceKey; updater: unknown }
  | { type: 'APPLY_POSTING'; event: FinancialEvent; entry: JournalEntry }
  | { type: 'REPLACE_STATE'; state: AppState }
  /** Records returned by the server after a command; replaced (or added) by id. */
  | { type: 'MERGE_SERVER_RECORDS'; records: { slice: SliceKey; upserted?: Record<string, unknown>[]; replace?: unknown }[] };

/** ورودی postFinancialEvent: شناسه و وضعیت توسط موتور ثبت تعیین می‌شود. */
export type FinancialEventInput = Omit<FinancialEvent, 'id' | 'status' | 'journalEntryId' | 'docNumber'>;

export interface PostingResult {
  ok: boolean;
  /** true when the same sourceModule+sourceId+type was already posted; no new entry was created. */
  duplicate: boolean;
  event?: FinancialEvent;
  entry?: JournalEntry;
  error?: string;
}
