import React, { useState } from 'react';
import {
  AccountingSubTab,
  JournalEntry,
  ReceiptRecord,
  PaymentRecord,
  AccountsReceivableItem,
  AccountsPayableItem,
  AuditLog,
  UserProfile,
} from '../../types';
import {
  mockBankAccounts,
  mockCashDesks,
  mockJournalEntries,
  mockReceipts,
  mockPayments,
  mockAccountsReceivable,
  mockAccountsPayable,
  mockChartOfAccounts,
  mockSubledgers,
  mockCostCenters,
  mockAuditLogs,
} from '../../data/accountingMockData';
import { mockProjects } from '../../data/mockData';
import { AccountingNav } from './AccountingNav';
import { AccountingDashboardView } from './AccountingDashboardView';
import { JournalEntriesView } from './JournalEntriesView';
import { RevenuesAndExpensesView } from './RevenuesAndExpensesView';
import { ReceiptsAndPaymentsView } from './ReceiptsAndPaymentsView';
import { BankAndCashView } from './BankAndCashView';
import { CounterpartiesReceivablePayableView } from './CounterpartiesReceivablePayableView';
import { ChartOfAccountsView } from './ChartOfAccountsView';
import { FinancialReportsView } from './FinancialReportsView';
import { PeriodClosingAndAuditView } from './PeriodClosingAndAuditView';
import { generateUUID, getNextSequentialDocNumber } from '../../utils/ids';
import { toPersianDate, toPersianTime, getCurrentPersianYear } from '../../utils/date';

interface AccountingModuleProps {
  currentUser: UserProfile;
}

export const AccountingModule: React.FC<AccountingModuleProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<AccountingSubTab>('dashboard');

  // Accounting State
  const [bankAccounts, setBankAccounts] = useState(mockBankAccounts);
  const [cashDesks, setCashDesks] = useState(mockCashDesks);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(mockJournalEntries);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>(mockReceipts);
  const [payments, setPayments] = useState<PaymentRecord[]>(mockPayments);
  const [receivables, setReceivables] = useState<AccountsReceivableItem[]>(mockAccountsReceivable);
  const [payables, setPayables] = useState<AccountsPayableItem[]>(mockAccountsPayable);
  const [subledgers, setSubledgers] = useState(mockSubledgers);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(mockAuditLogs);

  // Modal Triggers
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [isNewReceiptModalOpen, setIsNewReceiptModalOpen] = useState(false);
  const [isNewPaymentModalOpen, setIsNewPaymentModalOpen] = useState(false);

  // Helper for adding Audit Log
  const logAudit = (
    action: AuditLog['action'],
    targetDoc: string,
    description: string,
    oldValue?: string,
    newValue?: string
  ) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      date: '۱۴۰۳/۰۷/۰۱',
      time: '۱۲:۳۰',
      user: currentUser.name,
      role: currentUser.role,
      action,
      targetDoc,
      description,
      oldValue,
      newValue,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Handlers
  const handleSaveNewEntry = (entry: JournalEntry) => {
    setJournalEntries((prev) => [entry, ...prev]);
    logAudit(
      'ایجاد سند',
      entry.docNumber,
      `ثبت سند حسابداری دوبل جدید به مبلغ کل ${entry.totalDebit.toLocaleString('fa-IR')} تومان`
    );
  };

  const handleApproveEntry = (id: string) => {
    const docToApprove = journalEntries.find((d) => d.id === id);
    if (!docToApprove) return;

    // Self-approval restriction
    if (docToApprove.submitter.trim() === currentUser.name.trim()) {
      return;
    }

    setJournalEntries((prev) =>
      prev.map((doc) => {
        if (doc.id === id) {
          return {
            ...doc,
            status: 'تأیید شده' as const,
            history: [
              ...doc.history,
              {
                date: toPersianDate(new Date()),
                time: toPersianTime(new Date()),
                user: currentUser.name,
                action: 'تأیید نهایی و درج در دفاتر قانونی',
              },
            ],
          };
        }
        return doc;
      })
    );

    // Call audit logging OUTSIDE of state updater to avoid duplicate execution in StrictMode
    logAudit(
      'تأیید سند',
      docToApprove.docNumber,
      `تأیید نهایی سند حسابداری توسط ${currentUser.name}`
    );
  };

  const handleRejectEntry = (id: string, reason: string) => {
    const docToReject = journalEntries.find((d) => d.id === id);
    if (!docToReject) return;

    setJournalEntries((prev) =>
      prev.map((doc) => {
        if (doc.id === id) {
          return {
            ...doc,
            status: 'رد شده' as const,
            history: [
              ...doc.history,
              {
                date: toPersianDate(new Date()),
                time: toPersianTime(new Date()),
                user: currentUser.name,
                action: `رد سند توسط مدیر مالی - علت: ${reason}`,
              },
            ],
          };
        }
        return doc;
      })
    );

    logAudit(
      'رد سند',
      docToReject.docNumber,
      `رد سند حسابداری با علت: ${reason}`
    );
  };

  // Principle: Reverse entry only permitted for finalized & non-reversed documents
  const handleReverseEntry = (id: string, reason: string) => {
    const original = journalEntries.find((d) => d.id === id);
    if (!original) return;
    if (original.status !== 'ثبت قطعی' && original.status !== 'تأیید شده') {
      return;
    }

    // Create reversed rows
    const reversedRows = original.rows.map((row) => ({
      ...row,
      id: generateUUID(),
      description: `اصلاح و برگشت: ${row.description}`,
      debit: row.credit,
      credit: row.debit,
    }));

    const revDocNum = getNextSequentialDocNumber(
      journalEntries.map((e) => e.docNumber),
      'ACC',
      4,
      getCurrentPersianYear()
    );

    const reversalDoc: JournalEntry = {
      id: generateUUID(),
      docNumber: revDocNum,
      date: toPersianDate(new Date()),
      title: `سند معکوس (برگشت) برای سند ${original.docNumber} - علت: ${reason}`,
      type: original.type,
      projectId: original.projectId,
      projectName: original.projectName,
      costCenterId: original.costCenterId,
      costCenterName: original.costCenterName,
      submitter: currentUser.name,
      status: 'ثبت قطعی',
      rows: reversedRows,
      totalDebit: original.totalCredit,
      totalCredit: original.totalDebit,
      isBalanced: true,
      history: [
        {
          date: toPersianDate(new Date()),
          time: toPersianTime(new Date()),
          user: currentUser.name,
          action: `صدور سند معکوس جهت ابطال اثر مالی سند ${original.docNumber}`,
        },
      ],
    };

    setJournalEntries((prev) => [
      reversalDoc,
      ...prev.map((doc) => {
        if (doc.id === id) {
          return {
            ...doc,
            status: 'برگشت خورده' as const,
            history: [
              ...doc.history,
              {
                date: toPersianDate(new Date()),
                time: toPersianTime(new Date()),
                user: currentUser.name,
                action: `برگشت و خنثی‌سازی با سند معکوس ${reversalDoc.docNumber}`,
              },
            ],
          };
        }
        return doc;
      }),
    ]);

    logAudit(
      'سند معکوس',
      reversalDoc.docNumber,
      `ابطال و صدور سند معکوس متناظر با سند ${original.docNumber} به دلیل ${reason}`,
      original.status,
      'برگشت خورده'
    );
  };

  const handleAddReceipt = (rec: ReceiptRecord) => {
    setReceipts((prev) => [rec, ...prev]);

    // Update matching receivable strictly by debtor identity
    setReceivables((prev) =>
      prev.map((item) => {
        if (rec.payer.trim() === item.debtorName.trim() || (rec.projectId && rec.projectId === item.projectId)) {
          const newReceived = item.receivedAmount + rec.amount;
          const diff = item.billedAmount - newReceived;
          const remainingClaim = diff > 0 ? diff : 0;
          return {
            ...item,
            receivedAmount: newReceived,
            remainingClaim,
            status: remainingClaim === 0 ? ('تسویه شده' as any) : item.status,
          };
        }
        return item;
      })
    );

    // Create balanced journal entry: Debit Bank / Credit Accounts Receivable
    const docNum = getNextSequentialDocNumber(
      journalEntries.map((e) => e.docNumber),
      'ACC',
      4,
      getCurrentPersianYear()
    );

    const receiptJournalDoc: JournalEntry = {
      id: generateUUID(),
      docNumber: docNum,
      date: rec.date || toPersianDate(new Date()),
      title: `وصول وجه از ${rec.payer} - رهگیری ${rec.trackingNumber}`,
      type: 'دریافت',
      projectId: rec.projectId,
      projectName: rec.projectName,
      submitter: currentUser.name,
      status: 'ثبت قطعی',
      rows: [
        {
          id: generateUUID(),
          accountCode: '11101',
          accountName: 'موجودی نزد بانک‌ها',
          subledgerCode: rec.destinationAccount,
          subledgerName: rec.destinationAccount,
          description: `واریز به حساب ${rec.destinationAccount} توسط ${rec.payer}`,
          debit: rec.amount,
          credit: 0,
        },
        {
          id: generateUUID(),
          accountCode: '11201',
          accountName: 'مطالبات از کارفرمایان و اشخاص',
          subledgerCode: '',
          subledgerName: rec.payer,
          description: `بستانکاری طرف حساب ${rec.payer} بابت وصول مطالبات`,
          debit: 0,
          credit: rec.amount,
        },
      ],
      totalDebit: rec.amount,
      totalCredit: rec.amount,
      isBalanced: true,
      history: [
        {
          date: toPersianDate(new Date()),
          time: toPersianTime(new Date()),
          user: currentUser.name,
          action: 'صدور خودکار سند حسابداری متوازن دریافت وجه',
        },
      ],
    };

    setJournalEntries((prev) => [receiptJournalDoc, ...prev]);

    logAudit(
      'ایجاد سند',
      rec.docNumber,
      `وصول مبلغ ${rec.amount.toLocaleString('fa-IR')} تومان از ${rec.payer}`
    );
  };

  const handleAddPayment = (pay: PaymentRecord) => {
    setPayments((prev) => [pay, ...prev]);

    // Update matching payable strictly by creditor identity
    setPayables((prev) =>
      prev.map((item) => {
        if (pay.payee.trim() === item.creditorName.trim() || (pay.projectId && pay.projectId === item.projectId)) {
          const newPaid = item.paidAmount + pay.amount;
          const diff = item.incurredDebt - newPaid;
          const remainingDebt = diff > 0 ? diff : 0;
          return {
            ...item,
            paidAmount: newPaid,
            remainingDebt,
            status: remainingDebt === 0 ? ('تسویه شده' as any) : item.status,
          };
        }
        return item;
      })
    );

    // Create balanced journal entry: Debit Accounts Payable / Credit Bank
    const docNum = getNextSequentialDocNumber(
      journalEntries.map((e) => e.docNumber),
      'ACC',
      4,
      getCurrentPersianYear()
    );

    const paymentJournalDoc: JournalEntry = {
      id: generateUUID(),
      docNumber: docNum,
      date: pay.date || toPersianDate(new Date()),
      title: `تادیه وجه به ${pay.payee} - رهگیری ${pay.referenceNumber}`,
      type: 'پرداخت',
      projectId: pay.projectId,
      projectName: pay.projectName,
      submitter: currentUser.name,
      status: 'ثبت قطعی',
      rows: [
        {
          id: generateUUID(),
          accountCode: '21101',
          accountName: 'بستانکاران تجاری و پیمانکاران',
          subledgerCode: '',
          subledgerName: pay.payee,
          description: `بدهکار کردن حساب بستانکار ${pay.payee} بابت پرداخت بدهی`,
          debit: pay.amount,
          credit: 0,
        },
        {
          id: generateUUID(),
          accountCode: '11101',
          accountName: 'موجودی نزد بانک‌ها',
          subledgerCode: pay.payerAccount,
          subledgerName: pay.payerAccount,
          description: `برداشت از حساب بانکی شرکت ${pay.payerAccount}`,
          debit: 0,
          credit: pay.amount,
        },
      ],
      totalDebit: pay.amount,
      totalCredit: pay.amount,
      isBalanced: true,
      history: [
        {
          date: toPersianDate(new Date()),
          time: toPersianTime(new Date()),
          user: currentUser.name,
          action: 'صدور خودکار سند حسابداری متوازن پرداخت وجه',
        },
      ],
    };

    setJournalEntries((prev) => [paymentJournalDoc, ...prev]);

    logAudit(
      'ایجاد سند',
      pay.docNumber,
      `تادیه وجه به مبلغ ${pay.amount.toLocaleString('fa-IR')} تومان به ${pay.payee}`
    );
  };

  const pendingApprovalsCount = journalEntries.filter(
    (e) => e.status === 'در انتظار تأیید'
  ).length;

  return (
    <div className="space-y-4">
      {/* Accounting Sub-Navigation */}
      <AccountingNav
        activeSubTab={activeSubTab}
        onSelectSubTab={setActiveSubTab}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {/* Main Content Area based on selected sub-tab */}
      {activeSubTab === 'dashboard' && (
        <AccountingDashboardView
          bankAccounts={bankAccounts}
          cashDesks={cashDesks}
          journalEntries={journalEntries}
          receipts={receipts}
          payments={payments}
          receivables={receivables}
          payables={payables}
          onOpenNewDoc={() => {
            setActiveSubTab('journal_entries');
            setIsNewDocModalOpen(true);
          }}
          onOpenNewReceipt={() => {
            setActiveSubTab('receipts');
            setIsNewReceiptModalOpen(true);
          }}
          onOpenNewPayment={() => {
            setActiveSubTab('payments');
            setIsNewPaymentModalOpen(true);
          }}
          onNavigateToTab={(tab) => setActiveSubTab(tab)}
        />
      )}

      {activeSubTab === 'journal_entries' && (
        <JournalEntriesView
          entries={journalEntries}
          projects={mockProjects}
          costCenters={mockCostCenters}
          subledgers={subledgers}
          currentUser={currentUser}
          onSaveNewEntry={handleSaveNewEntry}
          onApproveEntry={handleApproveEntry}
          onRejectEntry={handleRejectEntry}
          onReverseEntry={handleReverseEntry}
          isNewDocModalOpen={isNewDocModalOpen}
          setIsNewDocModalOpen={setIsNewDocModalOpen}
        />
      )}

      {activeSubTab === 'revenues' && (
        <RevenuesAndExpensesView
          type="revenues"
          projects={mockProjects}
          costCenters={mockCostCenters}
          onOpenNewDocForExpense={() => {
            setActiveSubTab('journal_entries');
            setIsNewDocModalOpen(true);
          }}
        />
      )}

      {activeSubTab === 'expenses' && (
        <RevenuesAndExpensesView
          type="expenses"
          projects={mockProjects}
          costCenters={mockCostCenters}
          onOpenNewDocForExpense={() => {
            setActiveSubTab('journal_entries');
            setIsNewDocModalOpen(true);
          }}
        />
      )}

      {activeSubTab === 'receipts' && (
        <ReceiptsAndPaymentsView
          type="receipts"
          receipts={receipts}
          payments={payments}
          bankAccounts={bankAccounts}
          projects={mockProjects}
          subledgers={subledgers}
          onAddReceipt={handleAddReceipt}
          onAddPayment={handleAddPayment}
          isNewModalOpen={isNewReceiptModalOpen}
          setIsNewModalOpen={setIsNewReceiptModalOpen}
        />
      )}

      {activeSubTab === 'payments' && (
        <ReceiptsAndPaymentsView
          type="payments"
          receipts={receipts}
          payments={payments}
          bankAccounts={bankAccounts}
          projects={mockProjects}
          subledgers={subledgers}
          onAddReceipt={handleAddReceipt}
          onAddPayment={handleAddPayment}
          isNewModalOpen={isNewPaymentModalOpen}
          setIsNewModalOpen={setIsNewPaymentModalOpen}
        />
      )}

      {activeSubTab === 'bank_accounts' && (
        <BankAndCashView
          bankAccounts={bankAccounts}
          cashDesks={cashDesks}
          reconciliationItems={[
            {
              id: 'rec-item-1',
              bankAccountId: 'bank-1',
              date: '۱۴۰۳/۰۶/۲۹',
              description: 'واریز ساتنا - سرمایه‌گذاری تابان مسکن',
              type: 'واریز',
              amount: 14_000_000_000,
              matched: true,
              matchedDocNumber: 'REC-1403-0182',
            },
            {
              id: 'rec-item-2',
              bankAccountId: 'bank-2',
              date: '۱۴۰۳/۰۶/۳۰',
              description: 'برداشت پایا - بیمه تامین اجتماعی شعبه ۱',
              type: 'برداشت',
              amount: 2_450_000_000,
              matched: true,
              matchedDocNumber: 'PAY-1403-0491',
            },
            {
              id: 'rec-item-3',
              bankAccountId: 'bank-1',
              date: '۱۴۰۳/۰۶/۳۱',
              description: 'واریز سپرده متفرقه بدون شناسه واریز',
              type: 'واریز',
              amount: 500_000_000,
              matched: false,
              discrepancyType: 'تراکنش بانکی فاقد سند دفتری',
            },
          ]}
          onTriggerReconciliation={(id) => {
            const docNum = getNextSequentialDocNumber(
              journalEntries.map((e) => e.docNumber),
              'ACC',
              4,
              getCurrentPersianYear()
            );
            const reconDoc: JournalEntry = {
              id: generateUUID(),
              docNumber: docNum,
              date: toPersianDate(new Date()),
              title: 'سند رفع مغایرت بانکی: واریز فاقد سند دفتری',
              type: 'دریافت',
              submitter: currentUser.name,
              status: 'ثبت قطعی',
              rows: [
                {
                  id: generateUUID(),
                  accountCode: '11101',
                  accountName: 'موجودی نزد بانک‌ها',
                  subledgerCode: 'بانک ملت - جاری مرکزی',
                  subledgerName: 'بانک ملت - جاری مرکزی',
                  description: 'شناسایی واریز وجه بانکی نامشخص طبق صورت‌حساب',
                  debit: 500_000_000,
                  credit: 0,
                },
                {
                  id: generateUUID(),
                  accountCode: '21199',
                  accountName: 'بستانکاران متفرقه و سپرده‌های تعیین تکلیف‌نشده',
                  subledgerCode: '',
                  subledgerName: 'سپرده متفرقه نامشخص',
                  description: 'طرف حساب بستانکار جهت پیگیری منشأ واریزی',
                  debit: 0,
                  credit: 500_000_000,
                },
              ],
              totalDebit: 500_000_000,
              totalCredit: 500_000_000,
              isBalanced: true,
              history: [
                {
                  date: toPersianDate(new Date()),
                  time: toPersianTime(new Date()),
                  user: currentUser.name,
                  action: 'صدور خودکار سند رفع مغایرت بانکی',
                },
              ],
            };
            setJournalEntries((prev) => [reconDoc, ...prev]);
            logAudit('تطبیق بانکی', docNum, 'صدور سند دفتری متوازن برای واریز بانکی فاقد سند');
          }}
        />
      )}

      {activeSubTab === 'cash_desks' && (
        <BankAndCashView
          bankAccounts={bankAccounts}
          cashDesks={cashDesks}
          reconciliationItems={[]}
          onTriggerReconciliation={() => {}}
        />
      )}

      {activeSubTab === 'counterparties' && (
        <CounterpartiesReceivablePayableView
          viewMode="counterparties"
          receivables={receivables}
          payables={payables}
          subledgers={subledgers}
          onOpenReceiptForDebtor={() => {
            setActiveSubTab('receipts');
            setIsNewReceiptModalOpen(true);
          }}
          onOpenPaymentForCreditor={() => {
            setActiveSubTab('payments');
            setIsNewPaymentModalOpen(true);
          }}
        />
      )}

      {activeSubTab === 'accounts_receivable' && (
        <CounterpartiesReceivablePayableView
          viewMode="receivables"
          receivables={receivables}
          payables={payables}
          subledgers={subledgers}
          onOpenReceiptForDebtor={() => {
            setActiveSubTab('receipts');
            setIsNewReceiptModalOpen(true);
          }}
          onOpenPaymentForCreditor={() => {
            setActiveSubTab('payments');
            setIsNewPaymentModalOpen(true);
          }}
        />
      )}

      {activeSubTab === 'accounts_payable' && (
        <CounterpartiesReceivablePayableView
          viewMode="payables"
          receivables={receivables}
          payables={payables}
          subledgers={subledgers}
          onOpenReceiptForDebtor={() => {
            setActiveSubTab('receipts');
            setIsNewReceiptModalOpen(true);
          }}
          onOpenPaymentForCreditor={() => {
            setActiveSubTab('payments');
            setIsNewPaymentModalOpen(true);
          }}
        />
      )}

      {activeSubTab === 'chart_of_accounts' && (
        <ChartOfAccountsView chart={mockChartOfAccounts} />
      )}

      {activeSubTab === 'subledgers' && (
        <CounterpartiesReceivablePayableView
          viewMode="counterparties"
          receivables={receivables}
          payables={payables}
          subledgers={subledgers}
          onOpenReceiptForDebtor={() => {}}
          onOpenPaymentForCreditor={() => {}}
        />
      )}

      {activeSubTab === 'projects_cost_centers' && (
        <FinancialReportsView
          projects={mockProjects}
          costCenters={mockCostCenters}
          journalEntries={journalEntries}
        />
      )}

      {activeSubTab === 'financial_reports' && (
        <FinancialReportsView
          projects={mockProjects}
          costCenters={mockCostCenters}
          journalEntries={journalEntries}
        />
      )}

      {activeSubTab === 'period_closing' && (
        <PeriodClosingAndAuditView
          auditLogs={auditLogs}
          currentUser={currentUser}
        />
      )}

      {activeSubTab === 'reconciliation_settings' && (
        <PeriodClosingAndAuditView
          auditLogs={auditLogs}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
