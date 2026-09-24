import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountingSubTab, AuditLog, UserProfile } from '../../types';
import { useAppState, useStoreSlice, usePostFinancialEvent } from '../../store/AppStore';
import { selectProjects, selectLedgerTotals, selectCashFlowByMonth } from '../../store/selectors';
import { selectReceivablesAging, selectPayablesAging } from '../../store/domainSelectors';
import { reversedEntryIds } from '../../store/postingEngine';
import { useWorkflows } from '../../store/useWorkflows';
import { usePermission } from '../../store/session';
import type { WorkflowResult } from '../../store/workflows';
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
import { generateUUID } from '../../utils/ids';
import { toPersianDate, toPersianTime } from '../../utils/date';

interface AccountingModuleProps {
  currentUser: UserProfile;
}

/**
 * Accounting is the financial engine: it shows the ledger built from operational events and lets the
 * accountant post manual vouchers, approve them, reverse final entries and close the fiscal year.
 * Receipts and payments are entered in treasury, not here.
 */
export const AccountingModule: React.FC<AccountingModuleProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<AccountingSubTab>('dashboard');
  const navigate = useNavigate();
  const wf = useWorkflows();
  const { can } = usePermission();

  const appState = useAppState();
  const postFinancialEvent = usePostFinancialEvent();
  const { bankAccounts, cashDesks, costCenters, chartOfAccounts, counterparties, journalEntries, receipts, payments, subledgers, financialEvents } = appState;
  const projects = useMemo(() => selectProjects(appState), [appState]);
  const receivables = useMemo(() => selectReceivablesAging(appState), [appState]);
  const payables = useMemo(() => selectPayablesAging(appState), [appState]);
  const ledger = useMemo(() => selectLedgerTotals(appState), [appState]);
  const cashFlow = useMemo(() => selectCashFlowByMonth(appState), [appState]);
  const reversedIds = useMemo(() => reversedEntryIds(appState), [appState]);
  const [reconciliationItems, setReconciliationItems] = useStoreSlice('bankReconciliations');
  const [auditLogs, setAuditLogs] = useStoreSlice('auditLogs');
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);

  const logAudit = useCallback(
    (action: AuditLog['action'], targetDoc: string, description: string) => {
      const now = new Date();
      setAuditLogs((prev) => [
        { id: generateUUID(), date: toPersianDate(now), time: toPersianTime(now), user: currentUser.name, role: currentUser.role, action, targetDoc, description },
        ...prev,
      ]);
    },
    [currentUser, setAuditLogs]
  );

  /** Runs a workflow and records it in the audit trail when it succeeds. */
  const audited = (result: WorkflowResult, action: AuditLog['action'], target: string, description: string) => {
    if (result.ok) logAudit(action, result.docNumber || target, description);
    return result;
  };

  const projectName = useCallback((id?: string) => projects.find((p) => p.id === id)?.name, [projects]);

  // Bank reconciliation: a statement line without a ledger document is posted through the engine.
  const handleReconcile = (itemId: string) => {
    const item = reconciliationItems.find((r) => r.id === itemId);
    if (!item || item.matched || !can('journal.create')) return;
    let matchedDocNumber = item.matchedDocNumber;
    if (item.discrepancyType !== 'سند حسابداری بدون گردش بانکی') {
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
    setReconciliationItems((prev) => prev.map((r) => (r.id === itemId ? { ...r, matched: true, matchedDocNumber, discrepancyType: 'تطبیق شده' } : r)));
    logAudit('تطبیق بانکی', matchedDocNumber || item.id, `تطبیق قلم صورت‌حساب بانکی: ${item.description}`);
  };

  const pendingApprovalsCount = journalEntries.filter((e) => e.status === 'در انتظار تأیید').length;
  const openNewDoc = can('journal.create')
    ? () => {
        setActiveSubTab('journal_entries');
        setIsNewDocModalOpen(true);
      }
    : undefined;
  const receivablesView = (viewMode: 'counterparties' | 'receivables' | 'payables') => (
    <CounterpartiesReceivablePayableView
      viewMode={viewMode}
      receivables={receivables}
      payables={payables}
      subledgers={subledgers}
      onOpenReceiptForDebtor={() => navigate('/finance/receipts')}
      onOpenPaymentForCreditor={() => navigate('/finance/payments')}
    />
  );

  return (
    <div className="space-y-4">
      <AccountingNav activeSubTab={activeSubTab} onSelectSubTab={setActiveSubTab} pendingApprovalsCount={pendingApprovalsCount} />

      {activeSubTab === 'dashboard' && (
        <AccountingDashboardView
          bankAccounts={bankAccounts}
          cashDesks={cashDesks}
          pettyCashTotal={appState.pettyCashAccounts.reduce((a, p) => a + p.actualBalance, 0)}
          journalEntries={journalEntries}
          receipts={receipts}
          payments={payments}
          receivables={receivables}
          payables={payables}
          ledger={ledger}
          cashFlow={cashFlow}
          onOpenNewDoc={openNewDoc}
          onOpenTreasury={(path) => navigate(path)}
          onNavigateToTab={setActiveSubTab}
        />
      )}

      {activeSubTab === 'journal_entries' && (
        <JournalEntriesView
          entries={journalEntries}
          reversedIds={reversedIds}
          chartOfAccounts={chartOfAccounts}
          projects={projects}
          costCenters={costCenters}
          subledgers={subledgers}
          onCreateEntry={(entry) => audited(wf.createManualJournalEntry(entry), 'ایجاد سند', entry.title, `ثبت سند دستی «${entry.title}»`)}
          onApproveEntry={(id) => audited(wf.approveJournalEntry(id), 'تأیید سند', id, 'تأیید و ثبت قطعی سند دستی')}
          onRejectEntry={(id, reason) => audited(wf.rejectJournalEntry(id, reason), 'رد سند', id, `رد سند: ${reason}`)}
          onReverseEntry={(id, reason) => audited(wf.reverseJournalEntry(id, reason), 'سند معکوس', id, `صدور سند معکوس: ${reason}`)}
          isNewDocModalOpen={isNewDocModalOpen}
          setIsNewDocModalOpen={setIsNewDocModalOpen}
        />
      )}

      {activeSubTab === 'revenues' && <RevenuesAndExpensesView type="revenues" projects={projects} />}
      {activeSubTab === 'expenses' && <RevenuesAndExpensesView type="expenses" projects={projects} onOpenNewDocForExpense={openNewDoc} />}

      {(activeSubTab === 'receipts' || activeSubTab === 'payments') && (
        <ReceiptsAndPaymentsView
          type={activeSubTab}
          receipts={receipts}
          events={financialEvents}
          counterparties={counterparties}
          projectName={projectName}
          onOpenTreasury={() => navigate(activeSubTab === 'receipts' ? '/finance/receipts' : '/finance/payments')}
        />
      )}

      {activeSubTab === 'bank_accounts' && (
        <BankAndCashView bankAccounts={bankAccounts} cashDesks={cashDesks} reconciliationItems={reconciliationItems} onTriggerReconciliation={handleReconcile} />
      )}
      {activeSubTab === 'cash_desks' && <BankAndCashView bankAccounts={bankAccounts} cashDesks={cashDesks} reconciliationItems={[]} onTriggerReconciliation={() => undefined} />}

      {activeSubTab === 'counterparties' && receivablesView('counterparties')}
      {activeSubTab === 'accounts_receivable' && receivablesView('receivables')}
      {activeSubTab === 'accounts_payable' && receivablesView('payables')}
      {activeSubTab === 'subledgers' && receivablesView('counterparties')}

      {activeSubTab === 'chart_of_accounts' && <ChartOfAccountsView chart={chartOfAccounts} entries={journalEntries.filter((j) => j.status === 'ثبت قطعی' || j.status === 'تأیید شده' || j.status === 'برگشت خورده')} />}

      {(activeSubTab === 'projects_cost_centers' || activeSubTab === 'financial_reports') && (
        <FinancialReportsView projects={projects} costCenters={costCenters} journalEntries={journalEntries} />
      )}

      {(activeSubTab === 'period_closing' || activeSubTab === 'reconciliation_settings') && (
        <PeriodClosingAndAuditView
          auditLogs={auditLogs}
          journalEntries={journalEntries}
          closedFiscalYears={appState.financeSettings.closedFiscalYears}
          onCloseFiscalYear={(year) => audited(wf.closeFiscalYear(year), 'بستن دوره', `FY-${year}`, `بستن سال مالی ${year}`)}
        />
      )}
    </div>
  );
};
