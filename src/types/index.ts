export type ProjectStatus = 'در حال اجرا' | 'تجهیز کارگاه' | 'تحویل موقت' | 'تعلیق' | 'اختتام';

export type CounterpartyKind = 'client' | 'supplier' | 'subcontractor' | 'employee' | 'bank' | 'other';

export interface Counterparty {
  id: string;
  kind: CounterpartyKind;
  name: string;
  nationalId?: string;
  economicCode?: string;
  phone?: string;
  email?: string;
  address?: string;
  accountNumber?: string;
  shebaNumber?: string;
  bankName?: string;
  tradeType?: string;
  status?: 'active' | 'inactive';
}

export interface Project {
  id: string;
  code: string;
  name: string;
  clientId: string; // ارجاع به Counterparty با نوع client
  consultantId: string; // ارجاع به Counterparty با نوع other/مشاور
  managerUserId: string; // ارجاع به UserProfile
  siteSupervisor: string; // سرپرست کارگاه
  costCenterIds: string[]; // شناسه‌های مراکز هزینه پروژه
  contractIds: string[]; // شناسه‌های قراردادهای پروژه
  client: string; // نام کارفرما برای نمایش
  contractAmount: number; // مبلغ قرارداد
  recordedRevenue: number; // کارکرد / درآمد ثبت‌شده
  cost: number; // هزینه کل
  profit: number; // سود
  profitMargin: number; // حاشیه سود (%)
  physicalProgress: number; // درصد پیشرفت فیزیکی
  financialProgress: number; // درصد پیشرفت مالی
  receivables: number; // مطالبات از کارفرما
  liabilities: number; // بدهی‌ها به تأمین‌کنندگان
  budget: number; // بودجه مصوب
  actualCost: number; // هزینه واقعی
  forecastFinalCost: number; // پیش‌بینی هزینه نهایی (EAC)
  status: ProjectStatus;
  manager: string;
  startDate: string;
  expectedEndDate: string;
  image?: string;
  directCost: number;
  indirectCost: number;
  cashInflow: number; // دریافتی واقعی
  cashOutflow: number; // پرداختی واقعی
  expenseBreakdown: {
    materials: number;
    labor: number;
    machinery: number;
    transport: number;
    subcontractors: number;
    procurement: number;
    office: number;
    insurance: number;
    tax: number;
    other: number;
  };
}

export interface KpiItem {
  id: string;
  title: string;
  value: number;
  previousValue: number;
  changePercent: number;
  isPositiveGood: boolean;
  unit: string;
  icon: string;
  description: string;
  changePeriod?: string;
  color?: string;
}

export type PettyCashStatus = 'normal' | 'warning' | 'critical';

export interface PettyCash {
  id: string;
  code: string;
  holderName: string; // مسئول تنخواه
  projectName: string;
  projectId: string;
  actualBalance: number; // موجودی واقعی در حساب
  pendingExpenses: number; // هزینه‌های در انتظار تأیید
  usableBalance: number; // موجودی قابل مصرف
  ceilingLimit: number; // سقف تنخواه
  lastTransactionDate: string;
  lastTransactionDesc: string;
  status: PettyCashStatus;
  bankAccount: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ExpenseCategory = 
  | 'مصالح'
  | 'نیروی انسانی'
  | 'ماشین‌آلات'
  | 'حمل‌ونقل'
  | 'پیمانکاران جزء'
  | 'خرید'
  | 'اداری'
  | 'بیمه'
  | 'مالیات'
  | 'سایر';

export interface PendingApproval {
  id: string;
  docNumber: string; // شماره سند
  projectId: string;
  projectName: string;
  costCenterId: string; // شناسه مرکز هزینه
  costCenter?: string; // مرکز هزینه برای سازگاری
  submitter?: string; // ثبت‌کننده
  counterpartyId?: string; // طرف‌حساب مرتبط
  expenseType: string; // نوع هزینه (فاکتور تنخواه، خرید مستقیم، صورت‌وضعیت پیمانکار جزء...)
  category: ExpenseCategory;
  costClassification: 'مستقیم پروژه' | 'سربار و ستادی';
  amount: number; // کل مبلغ هزینه
  paymentAmount: number; // پرداخت شده
  pendingLiability: number; // مانده بدهی
  date: string;
  status: ApprovalStatus;
  attachmentName: string;
  counterparty?: string; // طرف حساب / فروشنده
  notes?: string;
}

export type StatementStatus = 
  | 'در انتظار بررسی کارفرما'
  | 'تأیید اولیه نظارت'
  | 'تأیید نهایی کارفرما'
  | 'تسویه شده'
  | 'معوق';

export interface ProgressStatement {
  id: string;
  number: string; // شماره صورت‌وضعیت
  projectId: string;
  projectName: string;
  costCenterId: string; // شناسه مرکز هزینه
  counterpartyId: string; // شناسه طرف‌حساب (کارفرما)
  client?: string; // اختیاری برای سازگاری نمایش
  submittedAmount: number; // مبلغ ارسالی پیمانکار
  approvedAmount: number; // مبلغ تأییدشده کارفرما
  receivedAmount: number; // مبلغ دریافتی (Receipt)
  receivables: number; // مانده مطالبات (Approved - Received)
  overdueAmount: number; // مبلغ معوق (سررسید گذشته)
  submissionDate: string;
  dueDate: string;
  status: StatementStatus;
}

export type AlertPriority = 'critical' | 'warning' | 'info';

export interface ManagementAlert {
  id: string;
  title: string;
  description: string;
  priority: AlertPriority;
  date: string;
  relatedProjectId?: string;
  relatedProjectName?: string;
  actionLabel?: string;
  actionType?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: 'مدیرعامل' | 'مدیر مالی' | 'حسابدار ارشد' | 'مدیر پروژه' | 'سرپرست کارگاه' | 'حسابرس و ناظر';
  email: string;
  avatar: string;
}

export type User = UserProfile;

export type TimeRange = 'this_month' | 'last_3_months' | 'last_6_months' | 'current_year' | 'custom';

// ==================== PHASE 2: ACCOUNTING MODULE TYPES ====================

export type AccountingSubTab =
  | 'dashboard'
  | 'journal_entries'
  | 'revenues'
  | 'expenses'
  | 'receipts'
  | 'payments'
  | 'bank_accounts'
  | 'cash_desks'
  | 'counterparties'
  | 'accounts_receivable'
  | 'accounts_payable'
  | 'chart_of_accounts'
  | 'subledgers'
  | 'projects_cost_centers'
  | 'financial_reports'
  | 'period_closing'
  | 'reconciliation_settings';

export type JournalEntryStatus =
  | 'پیش‌نویس'
  | 'در انتظار تأیید'
  | 'تأیید شده'
  | 'رد شده'
  | 'ثبت قطعی'
  | 'برگشت خورده';

export type JournalEntryType =
  | 'عمومی'
  | 'دریافت'
  | 'پرداخت'
  | 'خرید و مصالح'
  | 'تنخواه گردان'
  | 'صورت وضعیت'
  | 'حقوق و دستمزد'
  | 'بستن حساب‌ها'
  | 'سند افتتاحیه'
  | 'سند اختتامیه'
  | 'سند اصلاحی و معکوس'
  | 'انبارداری'
  | 'خرید'
  | 'فروش'
  | 'تنخواه';

export interface JournalEntryRow {
  id: string;
  accountCode: string; // کد معین
  accountName: string; // نام معین
  subledgerCode?: string; // کد تفصیلی
  subledgerName?: string; // نام تفصیلی
  description: string; // شرح ردیف
  debit: number; // بدهکار
  credit: number; // بستانکار
  projectId?: string; // کد پروژه
  projectName?: string;
  costCenterId?: string; // کد مرکز هزینه
  costCenterName?: string;
}

export interface JournalEntry {
  id: string;
  docNumber: string; // شماره سند
  date: string; // تاریخ سند
  title: string; // عنوان و شرح کلی سند
  type: JournalEntryType; // نوع سند
  projectId?: string;
  projectName?: string;
  costCenterId?: string;
  costCenterName?: string;
  submitter: string; // ثبت‌کننده
  status: JournalEntryStatus;
  rows: JournalEntryRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  attachments?: string[];
  reversedFromDocId?: string; // در صورت برگشت/معکوس
  reversalDocId?: string;
  history: {
    date: string;
    time: string;
    user: string;
    action: string;
    note?: string;
  }[];
}

export type AccountLevel = 'گروه' | 'کل' | 'معین' | 'تفصیلی';
export type AccountNature = 'بدهکار' | 'بستانکار' | 'دوگانه';

export interface AccountNode {
  code: string;
  title: string;
  level: AccountLevel;
  nature: AccountNature;
  parentCode?: string;
  balance: number;
  turnoverDebit: number;
  turnoverCredit: number;
  children?: AccountNode[];
}

export type SubledgerType =
  | 'تأمین‌کننده'
  | 'پیمانکار جزء'
  | 'کارفرما'
  | 'پرسنل'
  | 'سهامدار'
  | 'پروژه'
  | 'مرکز هزینه';

export interface Subledger {
  id: string;
  code: string;
  name: string;
  type: SubledgerType;
  phone?: string;
  nationalId?: string;
  balance: number;
  nature: AccountNature;
  projectId?: string;
  projectName?: string;
}

export interface CostCenter {
  id: string;
  projectId?: string;
  code: string;
  name: string;
  type?: 'کارگاه پروژه' | 'دفتر مرکزی' | 'انبار مرکزی' | 'کارگاه ماشین‌آلات' | 'دفتر فنی' | string;
  manager?: string;
  allocatedCost?: number;
  budget?: number;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  shebaNumber: string;
  branch: string;
  holderName: string;
  balance: number;
  openingBalance: number;
  totalReceipts: number;
  totalPayments: number;
  closingBalance: number;
  status: 'فعال' | 'مسدود';
}

export interface CashDesk {
  id: string;
  title: string;
  code: string;
  keeperName: string;
  balance: number;
  location: string;
  lastCountDate: string;
  projectId?: string;
  projectName?: string;
  ceilingLimit?: number;
  lastAuditDate?: string;
}

export interface ReceiptRecord {
  id: string;
  docNumber: string;
  date: string;
  amount: number;
  counterpartyId?: string; // شناسه طرف‌حساب واریزکننده
  costCenterId?: string; // شناسه مرکز هزینه
  payer: string;
  receiver: string;
  projectId?: string;
  projectName?: string;
  destinationAccount: string;
  method: 'حواله بانکی' | 'چک صیادی' | 'نقد' | 'پوز بانکی' | 'تهاتر';
  trackingNumber: string;
  description: string;
  journalEntryId?: string;
  status: 'وصول شده' | 'در جریان وصول' | 'برگشت خورده';
}

export interface PaymentRecord {
  id: string;
  docNumber: string;
  date: string;
  amount: number;
  counterpartyId?: string; // شناسه طرف‌حساب دریافت‌کننده
  costCenterId?: string; // شناسه مرکز هزینه
  payee: string;
  payerAccount: string;
  projectId?: string;
  projectName?: string;
  costCenter: string;
  method: 'حواله ساتنا/پایا' | 'چک بانکی صیادی' | 'نقد' | 'کارت تنخواه';
  referenceNumber: string;
  description: string;
  journalEntryId?: string;
  expenseIncurred: number; // کل هزینه ایجاد شده
  payableRemaining: number; // مانده تعهد پرداختنی
  status: 'پرداخت قطعی' | 'چک در گردش' | 'معلق';
}

export interface AccountsReceivableItem {
  id: string;
  debtorName: string;
  type: 'کارفرما' | 'بدهکار تجاری' | 'مساعده پرسنل' | 'سایر';
  projectId: string;
  projectName: string;
  billedAmount: number; // کارکرد یا صورت‌وضعیت تاییدشده
  receivedAmount: number; // مبلغ دریافت شده نقد
  remainingClaim: number; // مانده مطالبات (Billed - Received)
  dueDate: string;
  overdueDays: number;
  status: 'جاری' | 'نزدیک سررسید' | 'معوق سررسید گذشته';
}

export interface AccountsPayableItem {
  id: string;
  creditorName: string;
  type:
    | 'تأمین‌کننده مصالح'
    | 'پیمانکار جزء'
    | 'پرسنل'
    | 'سازمان تأمین اجتماعی'
    | 'سازمان امور مالیاتی'
    | 'سایر';
  projectId: string;
  projectName: string;
  incurredDebt: number; // بهای کالا/خدمت تحویلی
  paidAmount: number; // پرداختی نقد تاکنون
  remainingDebt: number; // مانده تعهد به بستانکار
  dueDate: string;
  status: 'در مهلت پرداخت' | 'سررسید شده' | 'معوق';
}

export interface BankReconciliationItem {
  id: string;
  bankAccountId: string;
  date: string;
  description: string;
  amount: number;
  type: 'واریز' | 'برداشت';
  matched: boolean;
  matchedDocNumber?: string;
  discrepancyType?: 'تطبیق شده' | 'تراکنش بانکی فاقد سند دفتری' | 'سند حسابداری بدون گردش بانکی' | 'مغایرت مبلغ';
}

export interface AuditLog {
  id: string;
  date: string;
  time: string;
  user: string;
  role: string;
  action: 'ایجاد سند' | 'تأیید سند' | 'رد سند' | 'سند معکوس' | 'ویرایش پیش‌نویس' | 'بستن دوره' | 'تطبیق بانکی';
  targetDoc: string;
  oldValue?: string;
  newValue?: string;
  description: string;
}

// ==================== PETTY CASH MODULE TYPES (PHASE 3) ====================

export type PettyCashAccountStatus = 'active' | 'suspended' | 'closed';

export interface PettyCashAccount {
  id: string;
  code: string;
  title: string;
  holderName: string; // مسئول تنخواه
  holderRole: string; // سرپرست کارگاه، مدیر پروژه، کارپرداز و ...
  holderPhone?: string;
  projectId: string;
  projectName: string;
  costCenterId: string;
  costCenterName: string;
  ceilingLimit: number; // سقف مجاز تنخواه
  minBalanceWarning: number; // حداقل موجودی هشدار
  actualBalance: number; // موجودی واقعی فیزیکی/بانکی
  pendingExpenses: number; // هزینه‌های ثبت‌شده ولی در انتظار تأیید
  usableBalance: number; // قابل مصرف = actualBalance - pendingExpenses
  sourceBankAccountId: string;
  sourceBankAccountTitle: string;
  startDate: string;
  status: PettyCashAccountStatus;
  monthlySpent: number;
  lastReplenishmentDate: string;
  lastReplenishmentAmount: number;
  notes?: string;
}

export type PettyCashExpenseStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'accounting_posted'
  | 'reconciled'
  | 'rejected'
  | 'returned_for_correction';

export interface PettyCashAttachment {
  id: string;
  name: string;
  size?: string;
  type: 'image' | 'pdf';
  url?: string;
}

export interface PettyCashExpense {
  id: string;
  expenseNumber: string;
  pettyCashId: string;
  pettyCashTitle: string;
  projectId: string;
  projectName: string;
  costCenterId?: string; // شناسه مرکز هزینه
  costCenter?: string; // سازگاری با نمایش
  date: string;
  category: string;
  subCategory: string;
  amount: number;
  counterpartyId?: string; // ارجاع به طرف‌حساب (فروشنده)
  vendor?: string; // فروشنده / طرف‌حساب
  vendorNationalId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  description: string;
  paymentMethod: 'کارت تنخواه' | 'نقد' | 'حواله/انتقال' | 'سایر';
  attachments: PettyCashAttachment[];
  status: PettyCashExpenseStatus;
  approvalLevelRequired: 'site_manager_and_finance' | 'project_and_finance' | 'ceo_full';
  currentApprovalStep:
    | 'سرپرست کارگاه'
    | 'مدیر پروژه'
    | 'مدیر مالی'
    | 'مدیرعامل'
    | 'تکمیل شده'
    | 'رد شده'
    | 'بازگشت به کاربر'
    | 'تأیید نهایی و ثبت سند';
  approvalHistory: {
    level: string;
    approverName: string;
    approverRole: string;
    date: string;
    time: string;
    action: 'approved' | 'rejected' | 'returned' | 'returned_for_correction';
    comment?: string;
  }[];
  rejectionReason?: string;
  submitterName: string;
  submitterRole: string;
  inventoryTarget: 'direct_consumption' | 'send_to_warehouse';
  inventoryItemCode?: string;
  inventoryItemName?: string;
  inventoryQuantity?: number;
  inventoryUnit?: string;
  journalEntryId?: string;
  accountingAccountCode?: string;
  accountingAccountName?: string;
  isReversed?: boolean;
  reverseReason?: string;
}

export interface PettyCashReplenishment {
  id: string;
  docNumber: string;
  pettyCashId: string;
  pettyCashTitle: string;
  amount: number;
  sourceBankAccountId: string;
  sourceBankAccountName: string;
  date: string;
  transferMethod: 'حواله ساتنا/پایا' | 'کارت به کارت' | 'چک بانکی' | 'نقدی';
  trackingNumber: string;
  description: string;
  approvedBy: string;
  attachmentName?: string;
  journalEntryId?: string;
  status: 'تأیید و واریز شد' | 'در جریان پرداخت';
}

export interface PettyCashReplenishmentRequest {
  id: string;
  requestNumber: string;
  pettyCashId: string;
  pettyCashTitle: string;
  currentActualBalance: number;
  currentUsableBalance: number;
  suggestedAmount: number;
  recentExpensesSummary: string;
  reason: string;
  requesterName: string;
  requesterRole: string;
  date: string;
  status: 'در انتظار تأیید مالی' | 'تأیید شده' | 'رد شده';
  rejectionReason?: string;
}

export interface PettyCashReconciliation {
  id: string;
  reconNumber: string;
  pettyCashId: string;
  pettyCashTitle: string;
  periodStartDate: string;
  periodEndDate: string;
  openingBalance: number;
  totalReplenishments: number;
  totalApprovedExpenses: number;
  expectedBalance: number; // opening + replenishments - approvedExpenses
  actualCountedCash: number; // شمارش فیزیکی اعلام‌شده توسط کارپرداز
  discrepancy: number; // actualCountedCash - expectedBalance (negative = deficit, positive = surplus)
  status: 'متعادل (بدون مغایرت)' | 'دارای کسری' | 'دارای مازاد' | 'تسویه و سند تعدیل صادر شد';
  discrepancyReason?: string;
  adjustmentDocNumber?: string;
  officerName: string;
  financeApproverName: string;
  date: string;
  notes?: string;
}

export interface PettyCashCategoryItem {
  id: string;
  name: string;
  subcategories: string[];
}

export type PettyCashSubTab =
  | 'dashboard'
  | 'accounts'
  | 'new_expense'
  | 'approvals'
  | 'replenishments'
  | 'requests'
  | 'reconciliation'
  | 'closing'
  | 'reports'
  | 'settings';

// ==================== PHASE 4: CONTRACTS & PROGRESS STATEMENTS ====================

export type ContractStatus =
  | 'پیش‌نویس'
  | 'فعال'
  | 'تعلیق'
  | 'تکمیل‌شده'
  | 'تحویل موقت'
  | 'تحویل قطعی'
  | 'خاتمه‌یافته';

export type ContractType =
  | 'فهرست‌بهایی'
  | 'سرجمع (مقطوع)'
  | 'طراحی و ساخت (EPC)'
  | 'مدیریت پیمان (MC)'
  | 'قیمت جدید / پیمان خاص';

export interface Contract {
  id: string;
  code: string; // کد سیستمی پیمان
  number: string; // شماره رسمی قرارداد کارفرما
  projectTitle: string; // عنوان قرارداد و شرح موضوع
  projectId: string;
  projectName: string;
  counterpartyId: string; // ارجاع به شناسه Counterparty کارفرما
  costCenterId: string; // ارجاع به شناسه CostCenter
  employer: string; // کارفرما (برای سازگاری نمایش)
  executiveBody?: string; // دستگاه اجرایی
  consultant?: string; // مهندس مشاور
  consultantId?: string; // ارجاع به مشاور
  contractor: string; // پیمانکار (سازه گستران پارس)
  initialValue: number; // مبلغ اولیه قرارداد
  approvedChangesValue: number; // مبلغ الحاقیه‌ها و دستورکارهای مصوب
  currentValue: number; // مبلغ فعلی قرارداد (اولیه + تغییرات)
  executedValue: number; // ارزش کارکرد اجرا شده واقعی (متره)
  remainingValue: number; // ارزش باقیمانده قرارداد (فعلی - کارکرد)
  billedValue: number; // کل مبلغ صورت‌وضعیت‌های ارسال شده
  approvedBilledValue: number; // مبلغ صورت‌وضعیت‌های تاییدشده کارفرما
  receivedValue: number; // مبالغ دریافتی و وصولی
  receivableValue: number; // مانده مطالبات معوق و جاری
  contractDate: string; // تاریخ انعقاد قرارداد
  startDate: string; // تاریخ ابلاغ و شروع
  endDate: string; // تاریخ خاتمه اولیه
  durationMonths: number; // مدت قرارداد اولیه (ماه)
  durationExtensionMonths: number; // تمدید مجاز (ماه)
  contractType: ContractType;
  status: ContractStatus;
  advancePaymentPercentage: number; // درصد پیش‌پرداخت مجاز
  retentionPercentage: number; // درصد سپرده حسن انجام کار (معمولاً ۱۰٪)
  description?: string;
}

export type AmendmentType =
  | 'افزایش مبلغ'
  | 'کاهش مبلغ'
  | 'تمدید مدت'
  | 'تغییر مقادیر'
  | 'تغییر شرح کار'
  | 'تغییر نرخ'
  | 'سایر';

export interface ContractAmendment {
  id: string;
  contractId: string;
  number: string; // شماره ابلاغیه تغییرات / الحاقیه
  type: AmendmentType;
  date: string;
  amount: number; // مبلغ تغییر (می‌تواند منفی باشد در صورت کاهش)
  changePercentage: number; // درصد اثر روی مبلغ اولیه پیمان
  extendedDays?: number; // تمدید مدت به روز
  description: string;
  documentRef?: string;
  status: 'پیش‌نویس' | 'در حال بررسی مشاور' | 'تأیید شده' | 'رد شده';
  approvedBy?: string;
  approvalDate?: string;
}

export interface ContractBOQItem {
  id: string;
  contractId: string;
  rowNumber: string; // ردیف مثلاً 001
  code: string; // کد آیتم فهرست بها مثلاً 010101
  chapter: string; // نام فصل فهرست‌بها
  description: string; // شرح عملیات
  unit: string; // m3, m2, m, kg, ton, دستگاه...
  initialQuantity: number; // مقدار اولیه قرارداد
  unitRate: number; // بهای واحد (تومان)
  initialAmount: number; // مقدار اولیه × بهای واحد
  previousQuantity: number; // کارکرد تجمعی دوره‌های قبل
  currentPeriodQuantity: number; // کارکرد این دوره جاری
  cumulativeExecutedQuantity: number; // کارکرد تجمعی کل (قبلی + این دوره)
  executedAmount: number; // مبلغ کل کارکرد اجرا شده
  progressPercentage: number; // درصد پیشرفت مقداری نسبت به اولیه
  isSurplusQuantity?: boolean; // آیا از مقدار اولیه عبور کرده؟
  surplusQuantity?: number;
  inventoryMaterialCode?: string; // Integration Point با انبار: کد متناظر کالا
  inventoryMaterialName?: string;
  inventoryConsumedQty?: number; // حواله خروج انبار ثبت شده
}

export type StatementType =
  | 'موقت'
  | 'قطعی'
  | 'علی‌الحساب'
  | 'تعدیل'
  | 'مابه‌التفاوت مصالح';

export type StatementWorkflowStatus =
  | 'draft' // پیش‌نویس
  | 'prepared' // تهیه شده در کارگاه
  | 'internal_review' // بررسی دفتر فنی پیمانکار
  | 'submitted_to_consultant' // ارسال به مهندس مشاور
  | 'under_consultant_review' // در حال بررسی مشاور
  | 'approved_by_consultant' // تأیید شده توسط مشاور
  | 'submitted_to_employer' // ارسال به دستگاه اجرایی/کارفرما
  | 'approved_by_employer' // تأیید نهایی کارفرما
  | 'claimed' // اعلام بدهی و صدور صورت‌حساب
  | 'partially_paid' // وصول بخشی از مبلغ
  | 'paid' // تسویه کامل
  | 'rejected' // رد شده
  | 'returned_for_correction'; // برگشت جهت اصلاح

export interface StatementBOQItem {
  id: string;
  boqItemId: string;
  rowNumber: string;
  code: string;
  description: string;
  unit: string;
  contractQuantity: number; // مقدار در قرارداد
  previousQuantity: number; // کارکرد قبلی
  currentQuantity: number; // کارکرد این دوره
  cumulativeQuantity: number; // تجمعی = قبلی + دوره
  unitRate: number; // نرخ واحد
  currentAmount: number; // کارکرد این دوره ریالی
  cumulativeAmount: number; // کارکرد تجمعی ریالی
  isExceeded: boolean; // هشدار عبور از سقف پیمان
  exceededQuantity: number;
  exceededClassification?: 'مقدار مازاد' | 'آیتم جدید (ستاره‌دار)' | 'تغییر مقادیر' | 'الحاقیه';
  inventoryMaterialCode?: string;
  notes?: string;
}

export type DeductionType =
  | 'advance_payment' // پیش‌پرداخت
  | 'retention' // سپرده حسن انجام کار (۱۰٪)
  | 'insurance' // بیمه تأمین اجتماعی (۵٪ ماده ۳۸)
  | 'tax' // مالیات تکلیفی
  | 'vat' // مالیات بر ارزش افزوده
  | 'materials' // کسورات مصالح کارفرما
  | 'penalties' // جرائم تأخیرات
  | 'on_account' // مبالغ علی‌الحساب قبلی
  | 'other'; // سایر کسورات

export interface DeductionItem {
  id: string;
  title: string;
  type: DeductionType;
  mode: 'percentage' | 'fixed';
  rate: number; // درصد (مثلاً 10 برای ۱۰٪)
  baseAmount: number; // مبلغ پایه محاسباتی
  calculatedAmount: number; // مبلغ کسورات
  description?: string;
}

export interface AdvancePaymentRecord {
  id: string;
  contractId: string;
  totalAdvanceAmount: number;
  paymentDate: string;
  percentage: number;
  totalAmortized: number; // استهلاک شده تاکنون
  remainingAdvance: number; // مانده مستهلک نشده
  installments: {
    statementId: string;
    statementNumber: string;
    date: string;
    amortizedAmount: number;
  }[];
}

export interface PriceAdjustment {
  id: string;
  contractId: string;
  adjustmentNumber: string;
  period: string; // مثلاً سه ماهه دوم ۱۴۰۳
  basePeriodIndex: number; // شاخص مبنا
  currentPeriodIndex: number; // شاخص دوره کارکرد
  formulaType: 'بخشنامه ۱۷۳۰۷۳ سازمان برنامه' | 'ضریب تعدیل خطی' | 'فرمول توافقی خاص';
  coefficient: number; // ضریب تعدیل محاسبه شده (P)
  baseAmount: number; // مبلغ کارکرد مشمول تعدیل
  calculatedAdjustmentAmount: number; // مبلغ کل تعدیل
  status: 'پیش‌نویس' | 'تأیید مشاور' | 'تأیید کارفرما' | 'اعمال شده در صورت‌وضعیت';
  attachedCalcSheetName?: string;
  linkedStatementNumber?: string;
  notes?: string;
}

export interface StatementPayment {
  id: string;
  statementId: string;
  statementNumber: string;
  contractId: string;
  date: string;
  amount: number;
  method: 'حواله ساتنا/پایا' | 'اوراق خزانه اسلامی (اخزا)' | 'تهاتر ملک/زمین' | 'چک صیادی';
  referenceNumber: string;
  payerAccount: string;
  destinationBank: string;
  notes?: string;
  journalEntryId?: string;
}

export interface ContractDocument {
  id: string;
  contractId?: string;
  statementId?: string;
  fileName: string;
  fileType: 'قرارداد اولیه' | 'الحاقیه' | 'صورت‌جلسه کارگاهی' | 'فایل اکسل متره' | 'نقشه فنی' | 'سند تأییدیه' | 'مکاتبات';
  version: string;
  uploadDate: string;
  uploaderName: string;
  fileSize: string;
  downloadUrl?: string;
}

export interface StatementWorkflowHistory {
  date: string;
  time: string;
  user: string;
  role: string;
  fromStatus: StatementWorkflowStatus;
  toStatus: StatementWorkflowStatus;
  action: string;
  comment?: string;
  reasonIfRejected?: string;
}

export interface ContractAuditLog {
  id: string;
  contractId: string;
  user: string;
  role: string;
  date: string;
  time: string;
  action: 'تغییر مبلغ قرارداد' | 'تغییر BOQ' | 'تغییر مقدار' | 'تغییر نرخ' | 'تغییر کسورات' | 'تأیید' | 'رد' | 'ابطال' | 'اصلاح';
  targetField: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

// ==================== PHASE 4: SUBCONTRACTOR CONTRACTS & PROGRESS STATEMENTS ====================

export type SubcontractorTradeType =
  | 'جوشکاری و اسکلت فلزی'
  | 'آرماتوربندی و قالب‌بندی'
  | 'بتن‌ریزی و پمپاژ'
  | 'بنّایی و تیغه‌چینی'
  | 'تأسیسات مکانیکی'
  | 'تأسیسات الکتریکی'
  | 'گچ‌کاری و کناف'
  | 'کاشی‌کاری و سرامیک'
  | 'رنگ‌آمیزی و نقاشی'
  | 'عایق‌کاری و ایزوگام'
  | 'خاک‌برداری و نیلینگ'
  | 'محوطه‌سازی و جدول‌کاری'
  | 'سایر پیمانکاری جزء';

export type SubcontractorStatementWorkflowStatus =
  | 'submitted' // ثبت توسط پیمانکار جزء / دفتر فنی کارگاه
  | 'site_review' // بررسی کارگاه (بررسی احجام توسط سرپرست کارگاه)
  | 'pm_approved' // تأیید مدیر پروژه
  | 'management_approved' // تأیید مدیریت و امور مالی
  | 'paid' // پرداخت‌شده و ثبت هزینه پروژه
  | 'rejected' // رد شده
  | 'returned_for_revision'; // برگشت جهت اصلاح متره

export interface SubcontractorContract {
  id: string;
  contractNumber: string; // شماره قرارداد پیمانکار جزء مثلاً SUB-RON-WELD-01
  title: string; // شرح عملیات (مثلاً جوشکاری اتصالات اسکلت فلزی طبقات ۱ تا ۱۰)
  projectId: string;
  projectName: string;
  costCenterId: string; // شناسه مرکز هزینه
  counterpartyId: string; // ارجاع به Counterparty پیمانکار جزء
  subcontractorName: string; // نام پیمانکار برای نمایش
  subcontractorPhone?: string;
  tradeType: SubcontractorTradeType;
  contractValue: number; // مبلغ کل قرارداد پیمانکار جزء (مثلاً ۲ میلیارد تومان)
  executedValue: number; // کارکرد تجمعی متره شده واقعی (مثلاً ۸۰۰ میلیون تومان)
  approvedStatementsValue: number; // مجموع صورت‌وضعیت‌های تأییدشده (مثلاً ۵۰۰ میلیون تومان)
  paidValue: number; // کل مبالغ پرداخت‌شده تاکنون (مثلاً ۳۰۰ میلیون تومان)
  remainingPayableValue: number; // مانده صورت‌وضعیت‌های تاییدشده پرداخت‌نشده (تأییدشده - پرداختی = ۲۰۰ میلیون)
  remainingContractValue: number; // ظرفیت باقیمانده قرارداد (مبلغ قرارداد - کارکرد)
  startDate: string;
  endDate: string;
  status: 'فعال' | 'معلق' | 'خاتمه‌یافته' | 'تسویه‌شده';
  unitRateDescription: string; // بهای واحد توافقی (مثلاً: کیلویی ۱۸,۵۰۰ تومان یا متری ۳۵۰,۰۰۰ تومان)
  advancePaid: number; // پیش‌پرداخت پرداختی به پیمانکار
  retentionDeposit: number; // سپرده حسن انجام کار مکسوره (معمولاً ۱۰٪ یا ۵٪)
  penaltyOrDeductions: number; // سایر کسورات کارگاهی
  notes?: string;
}

export interface SubcontractorStatementItem {
  id: string;
  description: string; // شرح کار انجام‌شده
  unit: string; // کیلوگرم، مترمربع، مترمکعب، مترطول، عدد، تن
  contractQuantity: number; // مقدار پیش‌بینی‌شده در قرارداد
  previousQuantity: number; // مقدار دوره‌های قبلی
  currentQuantity: number; // مقدار اعلامی پیمانکار در این دوره
  cumulativeQuantity: number; // تجمعی = قبلی + دوره
  unitRate: number; // نرخ واحد توافقی
  currentAmount: number; // مبلغ این دوره = نرخ × مقدار دوره
  cumulativeAmount: number; // مبلغ کل تجمعی
  siteEngineerApprovedQty?: number; // مقدار مصوب سرپرست کارگاه پس از متره میدانی
  notes?: string;
}

export interface SubcontractorStatementDeductions {
  retention: number; // سپرده حسن انجام کار
  advancePaymentDeduction: number; // استهلاک پیش‌پرداخت
  safetyOrWastePenalty: number; // جریمه ایمنی یا پرت مصالح
  insuranceDeduction?: number; // بیمه قرارداد
  taxDeduction?: number; // مالیات
  otherDeductions: number; // سایر کسورات
  description?: string;
}

export interface SubcontractorProgressStatement {
  id: string;
  statementNumber: string; // شماره صورت‌وضعیت (مثلاً صورت‌وضعیت شماره ۲ جوشکاری)
  subcontractorContractId: string;
  subcontractorContractNumber: string;
  costCenterId: string; // شناسه مرکز هزینه
  counterpartyId: string; // ارجاع به Counterparty پیمانکار جزء
  subcontractorName: string; // نام پیمانکار برای نمایش
  tradeType: SubcontractorTradeType;
  projectId: string;
  projectName: string;
  periodStartDate: string;
  periodEndDate: string;
  submissionDate: string;
  items: SubcontractorStatementItem[];
  grossAmount: number; // مبلغ ناخالص کارکرد اعلامی
  siteVerifiedAmount: number; // مبلغ تأییدشده پس از بررسی کارگاه
  deductions: SubcontractorStatementDeductions;
  totalDeductions: number;
  netPayable: number; // خالص قابل پرداخت = ناخالص/تأییدشده منهای کسورات
  paidAmount: number; // مبلغ پرداخت‌شده
  remainingPayable: number; // مانده پرداختنی
  status: SubcontractorStatementWorkflowStatus;
  rejectionReason?: string;
  revisionNote?: string;
  siteReviewNote?: string;
  siteReviewerName?: string;
  siteReviewDate?: string;
  pmApprovalNote?: string;
  pmApproverName?: string;
  pmApprovalDate?: string;
  managementApprovalNote?: string;
  managementApproverName?: string;
  managementApprovalDate?: string;
  paymentDate?: string;
  paymentMethod?: 'حواله بانکی پایا/ساتنا' | 'چک صیادی' | 'صندوق تنخواه کارگاه' | 'تهاتر مصالح';
  paymentRefNumber?: string;
  payingBankId?: string;
  payingBankTitle?: string;
  projectExpenseRecordId?: string; // شناسه سند ثبت هزینه پروژه در حسابداری
  workflowHistory: {
    date: string;
    time: string;
    user: string;
    role: string;
    fromStatus: SubcontractorStatementWorkflowStatus;
    toStatus: SubcontractorStatementWorkflowStatus;
    action: string;
    comment?: string;
  }[];
  attachments?: string[];
}

export type ContractsMainViewMode = 'client' | 'subcontractor';

export type SubcontractorSubTab =
  | 'dashboard'
  | 'statements'
  | 'contracts'
  | 'matrix'
  | 'approvals'
  | 'reports';

export interface DetailedProgressStatement {
  id: string;
  statementNumber: string; // شماره صورت‌وضعیت (مثلاً موقت ۰۴)
  contractId: string;
  contractCode: string;
  contractNumber: string;
  projectId: string;
  projectName: string;
  counterpartyId?: string;
  costCenterId?: string;
  client: string; // کارفرما
  consultant: string; // مشاور
  type: StatementType;
  periodStartDate: string;
  periodEndDate: string;
  preparationDate: string;
  preparerName: string;
  description: string;
  status: StatementWorkflowStatus;
  rejectionReason?: string;
  returnCorrectionNote?: string;
  items: StatementBOQItem[];
  workAmountCurrent: number; // کارکرد این دوره
  otherAllowableItemsAmount: number; // سایر اقلام مجاز / تجهیز کارگاه
  adjustmentAmount: number; // تعدیل این دوره
  vatAmount: number; // مالیات بر ارزش افزوده در صورت اعمال
  grossAmount: number; // مبلغ ناخالص کارکرد
  deductions: DeductionItem[];
  totalDeductions: number; // مجموع کسورات
  netPayable: number; // مبلغ خالص قابل پرداخت (ناخالص - کسورات)
  approvedNetPayable?: number; // مبلغ خالص تأیید شده توسط کارفرما
  receivedAmount: number; // دریافتی واقعی تا کنون
  remainingPayable: number; // مانده مطالبات (خالص - دریافتی)
  dueDate: string;
  paymentStatus: 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue';
  overdueDays: number;
  workflowHistory: StatementWorkflowHistory[];
  attachments: ContractDocument[];
  accountingJournalEntryId?: string;
}

export type ContractSubTab =
  | 'dashboard'
  | 'contracts'
  | 'contract_detail'
  | 'boq'
  | 'statements'
  | 'statement_detail'
  | 'deductions'
  | 'adjustments'
  | 'payments'
  | 'receivables'
  | 'reports'
  | 'documents'
  | 'settings';

// ==========================================
// PHASE 5: WAREHOUSE & INVENTORY MANAGEMENT
// ==========================================

export type MaterialCategory =
  | 'آهن‌آلات و میلگرد'
  | 'سیمان، بتن و فرآورده‌های بتنی'
  | 'مصالح سفت‌کاری و بنایی'
  | 'تأسیسات مکانیکی و لوله‌کشی'
  | 'تأسیسات الکتریکی و کابل'
  | 'عایق، رنگ و شیمیایی ساختمان'
  | 'ابزارآلات و تجهیزات قالب‌بندی'
  | 'تجهیز کارگاه و HSE';

export type WarehouseType = 'کارگاهی' | 'مرکزی' | 'ضایعات' | 'امانی';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  projectId?: string;
  projectName: string;
  location: string;
  type: WarehouseType;
  keeperName: string;
  phone: string;
  areaM2: number;
  status: 'فعال' | 'موقت' | 'تکمیل';
  itemsCount: number;
  totalValuation: number;
}

export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  specifications: string;
  standardGrade?: string;
  reorderLevel: number;
  minSafetyStock: number;
  maxCapacity: number;
  currentStock: number;
  averageUnitPrice: number;
  totalStockValue: number;
  requiresInspection: boolean;
  storageLocationBin?: string;
}

export interface GoodsReceiptItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  orderedQty: number;
  deliveredQty: number;
  rejectedQty: number;
  acceptedQty: number;
  unitPrice: number;
  totalPrice: number;
  storageBin?: string;
  heatOrBatchNumber?: string;
  notes?: string;
}

export interface GoodsReceiptNote {
  id: string;
  receiptNumber: string;
  date: string;
  poId?: string; // شناسه سفارش خرید ارجاعی
  warehouseId: string;
  warehouseName: string;
  projectId: string;
  projectName: string;
  costCenterId?: string; // شناسه مرکز هزینه
  counterpartyId?: string; // شناسه تأمین‌کننده در Counterparty
  supplierId?: string;
  supplierName: string;
  invoiceNumber: string;
  waybillNumber: string;
  truckPlateNumber: string;
  driverName: string;
  driverPhone: string;
  weighbridgeSlipNumber?: string;
  grossWeightKg?: number;
  tareWeightKg?: number;
  netWeightKg?: number;
  qualityCertificateNumber?: string;
  qcApprovalStatus: 'تأیید کامل' | 'تأیید مشروط' | 'مردود';
  qcInspectorName?: string;
  qcNotes?: string;
  items: GoodsReceiptItem[];
  totalAmount: number;
  status: 'پیش‌نویس' | 'کنترل کیفیت' | 'تأیید نهایی انبارداری';
  receiverName: string;
  accountingJournalEntryId?: string;
}

export interface StoreIssueItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  requestedQty: number;
  issuedQty: number;
  unitCost: number;
  totalCost: number;
  remarks?: string;
}

export interface StoreIssueVoucher {
  id: string;
  issueNumber: string;
  date: string;
  warehouseId: string;
  warehouseName: string;
  projectId: string;
  projectName: string;
  costCenterId?: string; // شناسه مرکز هزینه
  costCenter: string; // سازگاری
  counterpartyId?: string; // ارجاع به پیمانکار جزء / تحویل‌گیرنده
  wbsSection: string;
  subcontractorId?: string;
  subcontractorName?: string;
  tradeType?: string;
  isSubcontractorContra: boolean;
  subcontractorStatementDeductionRef?: string;
  applicantName: string;
  approvedByManagerName: string;
  dispatchedByKeeperName: string;
  receivedByCrewLeaderName: string;
  items: StoreIssueItem[];
  totalCost: number;
  status: 'درخواست اولیه' | 'تأیید مدیر کارگاه' | 'خروج قطعی از انبار';
  accountingJournalEntryId?: string;
}

export interface InterWarehouseTransfer {
  id: string;
  transferNumber: string;
  date: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  sourceProjectId: string;
  targetWarehouseId: string;
  targetWarehouseName: string;
  targetProjectId: string;
  waybillNumber: string;
  driverName: string;
  truckPlate: string;
  items: {
    materialId: string;
    materialCode: string;
    materialName: string;
    unit: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }[];
  totalCost: number;
  status: 'صدور مجوز' | 'بارگیری و خروج از مبدأ' | 'در مسیر حمل' | 'تخلیه و تحویل قطعی مقصد';
  authorizedBy: string;
}

export interface StocktakeItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  systemStock: number;
  physicalCount: number;
  varianceQty: number;
  unitPrice: number;
  varianceAmount: number;
  notes?: string;
}

export interface StocktakeAudit {
  id: string;
  auditNumber: string;
  date: string;
  warehouseId: string;
  warehouseName: string;
  leadAuditor: string;
  teamMembers: string[];
  items: StocktakeItem[];
  netVarianceAmount: number;
  status: 'شمارش در جریان' | 'مغایرت‌گیری و بازشماری' | 'تأیید نهایی و صدور سند تعدیل';
  accountingAdjustmentEntryId?: string;
}

export interface KardexEntry {
  id: string;
  materialId: string;
  date: string;
  docType: 'رسید ورود انبار' | 'حواله مصرف کارگاه' | 'انتقال ورودی' | 'انتقال خروجی' | 'تعدیل انبارگردانی';
  docNumber: string;
  warehouseName: string;
  counterparty: string;
  inQty: number;
  outQty: number;
  balanceQty: number;
  unitCost: number;
  balanceValuation: number;
}

export type InventorySubTab =
  | 'dashboard'
  | 'items'
  | 'receipts'
  | 'issues'
  | 'transfers'
  | 'kardex'
  | 'stocktake'
  | 'warehouses';

// ==================== PHASE 6: PROCUREMENT & VENDOR MANAGEMENT TYPES ====================

export type ProcurementCategory =
  | 'آهن‌آلات و مقاطع فولادی'
  | 'سیمان، بتن و فرآورده‌های بتنی'
  | 'تأسیسات مکانیکی و پایپینگ'
  | 'تأسیسات الکتریکی و تابلو برق'
  | 'تجهیزات قالب‌بندی و ماشین‌آلات'
  | 'عایق، رنگ و شیمی ساختمان'
  | 'نازک‌کاری و متریال دکوراتیو'
  | 'ایمنی کارگاه و HSE'
  | 'خدمات مهندسی و پیمانکاران دست‌دوم';

export type VendorGrade = 'A+' | 'A' | 'B' | 'C';

export interface VendorPerformanceRating {
  qualityScore: number; // 0 - 100
  deliveryScore: number; // 0 - 100
  priceCompetitiveness: number; // 0 - 100
  paymentFlexibility: number; // 0 - 100
  overallRating: number; // 0 - 5 stars
  totalOrdersCount: number;
  onTimeDeliveryRate: number; // percentage
  rejectionRate: number; // percentage
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  category: ProcurementCategory;
  grade: VendorGrade;
  nationalId: string;
  economicCode: string;
  contactPerson: string;
  phone: string;
  mobile: string;
  email: string;
  city: string;
  address: string;
  bankAccount: {
    bankName: string;
    shebaNumber: string;
    accountNumber: string;
    cardHolder: string;
  };
  hasVatCertificate: boolean;
  paymentTerms: 'نقدی پیش از تحویل' | 'نقدی پای کار' | 'چک صیادی ۴۵ روزه' | 'چک صیادی ۶۰ روزه' | 'اعتباری ماهانه' | 'تهاتر ملکی';
  performance: VendorPerformanceRating;
  financials: {
    totalPurchasesAmount: number;
    currentPayableBalance: number;
    unclearedChecksAmount: number;
    lastTransactionDate: string;
  };
  status: 'فعال در وندورلیست' | 'مشروط' | 'معلق' | 'مسدود';
  notes?: string;
}

export type RequisitionPriority = 'فوری کارگاهی (حیاتی)' | 'بالا' | 'عادی' | 'دوره‌ای برنامه‌ریزی‌شده';

export type RequisitionStatus =
  | 'پیش‌نویس کارگاه'
  | 'تأیید سرپرست کارگاه'
  | 'تأیید فنی پروژه'
  | 'مصوبه مدیر تدارکات'
  | 'تأیید نهایی مالی/مدیرعامل'
  | 'در حال استعلام بها (RFQ)'
  | 'سفارش صادر شده (PO)'
  | 'لغو شده';

export interface RequisitionItem {
  id: string;
  materialCode: string;
  materialName: string;
  specification: string;
  category: ProcurementCategory;
  requestedQty: number;
  approvedQty: number;
  unit: string;
  estimatedUnitPrice: number;
  estimatedTotalPrice: number;
  requiredDeliveryDate: string;
  suggestedVendors?: string[];
  notes?: string;
}

export interface PurchaseRequisition {
  id: string;
  requisitionNumber: string;
  date: string;
  projectId: string;
  projectName: string;
  wbsCode: string;
  costCenterId?: string; // شناسه مرکز هزینه
  costCenter?: string; // اختیاری برای سازگاری
  priority: RequisitionPriority;
  status: RequisitionStatus;
  requesterName: string;
  requesterRole: string;
  approvals: {
    siteSupervisor?: { approved: boolean; date?: string; signedBy?: string };
    projectManager?: { approved: boolean; date?: string; signedBy?: string };
    procurementManager?: { approved: boolean; date?: string; signedBy?: string };
    financialDirector?: { approved: boolean; date?: string; signedBy?: string };
  };
  items: RequisitionItem[];
  totalEstimatedAmount: number;
  justification: string;
  linkedPoId?: string;
  linkedPoNumber?: string;
}

export interface BidSupplierQuote {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierGrade: VendorGrade;
  quoteReferenceNumber: string;
  unitPrice: number;
  freightCostPerUnit: number;
  vatIncluded: boolean;
  vatAmount: number;
  totalQuoteAmount: number;
  deliveryLeadTimeDays: number;
  paymentTerms: string;
  technicalCompliance: 'منطبق کامل' | 'منطبق با انحراف جزیی' | 'غیرمنطبق';
  warrantyMonths: number;
  scoreTechnical: number;
  scoreCommercial: number;
  compositeScore: number;
  notes?: string;
  isWinningBid?: boolean;
}

export interface RequestForQuotation {
  id: string;
  rfqNumber: string;
  title: string;
  dateCreated: string;
  submissionDeadline: string;
  requisitionId: string;
  requisitionNumber: string;
  projectId: string;
  projectName: string;
  category: ProcurementCategory;
  materialName: string;
  specification: string;
  requiredQty: number;
  unit: string;
  quotes: BidSupplierQuote[];
  status: 'در حال استعلام' | 'کمیسیون معاملات و ارزیابی' | 'برنده مشخص شد' | 'تبدیل به سفارش (PO)' | 'لغو شده';
  selectedSupplierId?: string;
  selectedSupplierName?: string;
  commissionCommitteeNotes?: string;
  savingsVsBudgetAmount?: number;
}

export type POStatus =
  | 'پیش‌نویس'
  | 'صادر شده و ابلاغ به فروشنده'
  | 'در حال ساخت/بارگیری'
  | 'در مسیر حمل به کارگاه'
  | 'تحویل جزئی در انبار'
  | 'تحویل کامل'
  | 'تسویه حساب نهایی و مختومه'
  | 'فسخ شده';

export interface PurchaseOrderItem {
  id: string;
  materialCode: string;
  materialName: string;
  specifications: string;
  orderedQty: number;
  receivedQty: number;
  unit: string;
  unitPrice: number;
  totalNetPrice: number;
  vatRate: number;
  vatAmount: number;
  freightAndUnloadingCost: number;
  totalGrossAmount: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  issueDate: string;
  deliveryDueDate: string;
  requisitionId?: string;
  rfqId?: string;
  projectId: string;
  projectName: string;
  costCenterId?: string; // شناسه مرکز هزینه
  counterpartyId?: string; // ارجاع به Counterparty تأمین‌کننده
  destinationWarehouse: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierAddress: string;
  items: PurchaseOrderItem[];
  subtotalAmount: number;
  totalVatAmount: number;
  totalFreightCost: number;
  totalOrderAmount: number;
  paymentTerms: string;
  advancePaymentAmount: number;
  advancePaymentPaid: boolean;
  status: POStatus;
  deliveryProgressPercentage: number;
  termsAndConditions: string[];
  issuedBy: string;
  approvedBy: string;
  linkedGrnNumbers?: string[];
  linkedInvoiceNumber?: string;
}

export type MatchingStatus = 'تطبیق کامل و بدون مغایرت' | 'مغایرت قیمتی' | 'مغایرت مقداری' | 'در انتظار رسید انبار' | 'تأیید نهایی مالی';

export interface VendorInvoice {
  id: string;
  invoiceNumber: string;
  systemRefNumber: string;
  invoiceDate: string;
  dueDate: string;
  projectId: string;
  projectName: string;
  costCenterId?: string; // شناسه مرکز هزینه
  counterpartyId?: string; // ارجاع به Counterparty تأمین‌کننده
  supplierId: string;
  supplierName: string;
  poId: string; // ارجاع اجباری به سفارش خرید
  poNumber: string;
  grnId: string; // ارجاع اجباری به رسید انبار واقعی
  grnNumber?: string;
  taxRegistrationNumber: string;
  subtotal: number;
  vatAmount: number;
  shippingCost: number;
  discounts: number;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: 'در حال تطبیق' | 'تأیید تطبیق سه‌جانبه' | 'پرداخت شده' | 'پرداخت ناقص' | 'دارای مغایرت و متوقف';
  threeWayMatching: {
    poMatched: boolean;
    grnMatched: boolean;
    priceVarianceAmount: number;
    qtyVarianceAmount: number;
    status: MatchingStatus;
    notes?: string;
  };
  accountingEntryNumber?: string;
}

export type ProcurementSubTab =
  | 'dashboard'
  | 'requisitions'
  | 'rfq'
  | 'purchase_orders'
  | 'invoices'
  | 'suppliers';

export type FinancialEventType =
  | 'GOODS_RECEIPT'
  | 'VENDOR_INVOICE'
  | 'STORE_ISSUE'
  | 'CLIENT_STATEMENT_APPROVED'
  | 'SUBCONTRACTOR_STATEMENT_APPROVED'
  | 'PAYROLL_APPROVED'
  | 'PETTY_CASH_EXPENSE_APPROVED'
  | 'TREASURY_PAYMENT'
  | 'TREASURY_RECEIPT'
  | 'PETTY_CASH_REPLENISHMENT'
  | 'STOCKTAKE_ADJUSTMENT'
  | 'BANK_RECONCILIATION_MATCH';

export type FinancialEventModule =
  | 'procurement'
  | 'inventory'
  | 'contracts'
  | 'subcontractors'
  | 'petty_cash'
  | 'payroll'
  | 'treasury'
  | 'accounting';

export interface FinancialEvent {
  id: string;
  type: FinancialEventType;
  sourceModule: FinancialEventModule;
  sourceId: string;
  projectId: string;
  costCenterId: string;
  counterpartyId: string;
  amount: number;
  date: string;
  status: 'draft' | 'posted' | 'rejected';
  details?: Record<string, any>;
  journalEntryId?: string;
  docNumber?: string;
}

export type { PaymentRequest, PaymentSourceType, PaymentMethodType } from '../data/paymentsTreasuryMockData';
export type { SystemDocument, DocumentCategory } from '../data/documentsMockData';
export type { PayrollSlip, Employee, MonthlyTimesheet } from '../data/hrPayrollMockData';




