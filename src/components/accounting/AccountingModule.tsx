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
  mockAccountsReceivable,
  mockAccountsPayable,
  mockSubledgers,
  mockAuditLogs,
} from '../../data/accountingMockData';
import { useAppState, useStoreSlice, usePostFinancialEvent } from '../../store/AppStore';
import { selectProjects } from '../../store/selectors';
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

  // Accounting State (single copy in the central store)
  const appState = useAppState();
  const postFinancialEvent = usePostFinancialEvent();
  const { bankAccounts, cashDesks, costCenters, chartOfAccounts, counterparties } = appState;
  const projects = selectProjects(appState);
  const [journalEntries, setJournalEntries] = useStoreSlice('journalEntries');
  const [receipts, setReceipts] = useStoreSlice('receipts');
  const [payments, setPayments] = useStoreSlice('payments');
  const [reconciliationItems, setReconciliationItems] = useStoreSlice('bankReconciliations');
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

    // Posted through the financial layer: Dr bank / Cr receivables.
    const bank = bankAccounts.find((b) => b.bankName === rec.destinationAccount || b.id === rec.destinationAccount) || bankAccounts[0];
    const payer = counterparties.find((c) => c.id === rec.counterpartyId || c.name === rec.payer.trim());
    const posting = postFinancialEvent(
      {
        type: 'TREASURY_RECEIPT',
        sourceModule: 'treasury',
        sourceId: rec.id,
        projectId: rec.projectId || '',
        costCenterId: rec.costCenterId || '',
        counterpartyId: payer?.id || '',
        amount: rec.amount,
        date: rec.date,
        details: { docNumber: rec.docNumber, bankAccountId: bank?.id, bankName: bank?.bankName, trackingNumber: rec.trackingNumber },
      },
      { submitter: currentUser.name }
    );
    if (posting.ok && posting.event) {
      setReceipts((prev) => prev.map((r) => (r.id === rec.id ? { ...r, journalEntryId: posting.event!.journalEntryId } : r)));
    }

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

    // Posted through the financial layer: Dr payable / Cr bank.
    const bank = bankAccounts.find((b) => b.bankName === pay.payerAccount || b.id === pay.payerAccount) || bankAccounts[0];
    const payee = counterparties.find((c) => c.id === pay.counterpartyId || c.name === pay.payee.trim());
    const payableType =
      payee?.kind === 'subcontractor' ? 'subcontractor' : payee?.kind === 'employee' ? 'payroll' : 'supplier';
    const posting = postFinancialEvent(
      {
        type: 'TREASURY_PAYMENT',
        sourceModule: 'treasury',
        sourceId: pay.id,
        projectId: pay.projectId || '',
        costCenterId: pay.costCenterId || '',
        counterpartyId: payee?.id || '',
        amount: pay.amount,
        date: pay.date,
        details: { docNumber: pay.docNumber, payableType, bankAccountId: bank?.id, bankName: bank?.bankName, trackingNumber: pay.referenceNumber },
      },
      { submitter: currentUser.name }
    );
    if (posting.ok && posting.event) {
      setPayments((prev) => prev.map((p) => (p.id === pay.id ? { ...p, journalEntryId: posting.event!.journalEntryId } : p)));
    }

    logAudit(
      'ایجاد سند',
      pay.docNumber,
      `تادیه وجه به مبلغ ${pay.amount.toLocaleString('fa-IR')} تومان به ${pay.payee}`
    );
  };

  // Bank reconciliation: each statement line is matched once and its status is stored.
  const handleReconcile = (itemId: string) => {
    const item = reconciliationItems.find((r) => r.id === itemId);
    if (!item || item.matched) return;

    let matchedDocNumber = item.matchedDocNumber;
    if (item.discrepancyType !== 'سند حسابداری بدون گردش بانکی') {
      // Bank line without a ledger document: the missing entry is posted through the engine.
      const bank = bankAccounts.find((b) => b.id === item.bankAccountId);
      const posting = postFinancialEvent(
        {
          type: 'BANK_RECONCILIATION_MATCH',
          sourceModule: 'accounting',
          sourceId: item.id,
          projectId: '',
          costCenterId: '',
          counterpartyId: '',
          amount: item.amount,
          date: item.date,
          details: { bankAccountId: item.bankAccountId, bankName: bank?.bankName, direction: item.type, description: item.description },
        },
        { submitter: currentUser.name }
      );
      if (!posting.ok) return;
      matchedDocNumber = posting.event?.docNumber;
    }

    setReconciliationItems((prev) =>
      prev.map((r) => (r.id === itemId ? { ...r, matched: true, matchedDocNumber, discrepancyType: 'تطبیق شده' } : r))
    );
    logAudit('تطبیق بانکی', matchedDocNumber || item.id, `تطبیق قلم صورت‌حساب بانکی: ${item.description}`);
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
          projects={projects}
          costCenters={costCenters}
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
          projects={projects}
          costCenters={costCenters}
          onOpenNewDocForExpense={() => {
            setActiveSubTab('journal_entries');
            setIsNewDocModalOpen(true);
          }}
        />
      )}

      {activeSubTab === 'expenses' && (
        <RevenuesAndExpensesView
          type="expenses"
          projects={projects}
          costCenters={costCenters}
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
          projects={projects}
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
          projects={projects}
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
          reconciliationItems={reconciliationItems}
          onTriggerReconciliation={handleReconcile}
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
        <ChartOfAccountsView chart={chartOfAccounts} />
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
          projects={projects}
          costCenters={costCenters}
          journalEntries={journalEntries}
        />
      )}

      {activeSubTab === 'financial_reports' && (
        <FinancialReportsView
          projects={projects}
          costCenters={costCenters}
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
