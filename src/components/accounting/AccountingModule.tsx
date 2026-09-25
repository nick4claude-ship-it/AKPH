import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountingSubTab, UserProfile } from '../../types';
import { useAppState, useSelector } from '../../store/AppStore';
import { selectProjects, selectLedgerTotals, selectCashFlowByMonth } from '../../store/selectors';
import { selectReceivablesAging, selectPayablesAging } from '../../store/domainSelectors';
import { selectAccountingOverview, type ManualEntryFormInput } from '../../store/views/accounting';
import { useWorkflows } from '../../store/useWorkflows';
import { usePermission } from '../../store/session';
import type { WorkflowResult } from '../../store/workflowKit';
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
import { emitToast } from '../../store/toast';

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
  const { bankAccounts, cashDesks, costCenters, chartOfAccounts, counterparties, journalEntries, receipts, payments, subledgers, financialEvents } = appState;
  const projects = useMemo(() => selectProjects(appState), [appState]);
  const receivables = useMemo(() => selectReceivablesAging(appState), [appState]);
  const payables = useMemo(() => selectPayablesAging(appState), [appState]);
  const ledger = useMemo(() => selectLedgerTotals(appState), [appState]);
  const cashFlow = useMemo(() => selectCashFlowByMonth(appState), [appState]);
  const overview = useSelector(selectAccountingOverview);
  const reversedIds = overview.reversedIds;
  const { bankReconciliations: reconciliationItems, auditLogs } = appState;
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);

  const projectName = useCallback((id?: string) => projects.find((p) => p.id === id)?.name, [projects]);

  // Bank reconciliation: a statement line without a ledger document becomes a pending voucher (second approval).
  const handleReconcile = (itemId: string) => emitToast(wf.reconcileBankItemLogged(itemId).message);

  const pendingApprovalsCount = overview.pendingApprovalsCount;
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
          pettyCashTotal={overview.pettyCashTotal}
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
          onCreateEntry={(form: ManualEntryFormInput) => wf.submitManualJournalEntryForm(form)}
          onApproveEntry={(id) => wf.approveJournalEntryLogged(id)}
          onRejectEntry={(id, reason) => wf.rejectJournalEntryLogged(id, reason)}
          onReverseEntry={(id, reason) => wf.reverseJournalEntryLogged(id, reason)}
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
          onCloseFiscalYear={(year) => wf.closeFiscalYearLogged(year)}
        />
      )}
    </div>
  );
};
