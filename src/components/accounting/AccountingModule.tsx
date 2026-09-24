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
    setJournalEntries((prev) =>
      prev.map((doc) => {
        if (doc.id === id) {
          logAudit(
            'تأیید سند',
            doc.docNumber,
            `تأیید نهایی سند حسابداری توسط ${currentUser.name}`
          );
          return {
            ...doc,
            status: 'تأیید شده',
            history: [
              ...doc.history,
              {
                date: '۱۴۰۳/۰۷/۰۱',
                time: '۱۴:۱۵',
                user: currentUser.name,
                action: 'تأیید نهایی و درج در دفاتر قانونی',
              },
            ],
          };
        }
        return doc;
      })
    );
  };

  const handleRejectEntry = (id: string, reason: string) => {
    setJournalEntries((prev) =>
      prev.map((doc) => {
        if (doc.id === id) {
          logAudit(
            'رد سند',
            doc.docNumber,
            `رد سند حسابداری با علت: ${reason}`
          );
          return {
            ...doc,
            status: 'رد شده',
            history: [
              ...doc.history,
              {
                date: '۱۴۰۳/۰۷/۰۱',
                time: '۱۴:۲۰',
                user: currentUser.name,
                action: `رد سند توسط مدیر مالی - علت: ${reason}`,
              },
            ],
          };
        }
        return doc;
      })
    );
  };

  // Principle: No direct deletion of approved documents; support reverse entry (سند معکوس)
  const handleReverseEntry = (id: string, reason: string) => {
    const original = journalEntries.find((d) => d.id === id);
    if (!original) return;

    // Create reversed rows
    const reversedRows = original.rows.map((row) => ({
      ...row,
      id: `rev-${row.id}`,
      description: `اصلاح و برگشت: ${row.description}`,
      debit: row.credit,
      credit: row.debit,
    }));

    const reversalDoc: JournalEntry = {
      id: `rev-doc-${Date.now()}`,
      docNumber: `ACC-1403-REV-${Math.floor(1000 + Math.random() * 9000)}`,
      date: '۱۴۰۳/۰۷/۰۱',
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
          date: '۱۴۰۳/۰۷/۰۱',
          time: '۱۵:۰۰',
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
                date: '۱۴۰۳/۰۷/۰۱',
                time: '۱۵:۰۰',
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

    // Update matching receivable if applicable
    setReceivables((prev) =>
      prev.map((item) => {
        if (rec.payer.includes(item.debtorName) || item.debtorName.includes(rec.payer)) {
          const newReceived = item.receivedAmount + rec.amount;
          const newRemaining = Math.max(0, item.billedAmount - newReceived);
          return {
            ...item,
            receivedAmount: newReceived,
            remainingClaim: newRemaining,
            status: item.status,
          };
        }
        return item;
      })
    );

    logAudit(
      'ایجاد سند',
      rec.docNumber,
      `وصول مبلغ ${rec.amount.toLocaleString('fa-IR')} تومان از ${rec.payer}`
    );
  };

  const handleAddPayment = (pay: PaymentRecord) => {
    setPayments((prev) => [pay, ...prev]);

    // Update matching payable if applicable
    setPayables((prev) =>
      prev.map((item) => {
        if (pay.payee.includes(item.creditorName) || item.creditorName.includes(pay.payee)) {
          const newPaid = item.paidAmount + pay.amount;
          const newRemaining = Math.max(0, item.incurredDebt - newPaid);
          return {
            ...item,
            paidAmount: newPaid,
            remainingDebt: newRemaining,
            status: item.status,
          };
        }
        return item;
      })
    );

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
            alert('سند دفتری برای تراکنش بانکی صادر و ثبت شد.');
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
