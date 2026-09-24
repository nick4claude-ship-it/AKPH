import React, { useState } from 'react';
import {
  PettyCashAccount,
  PettyCashExpense,
  PettyCashReplenishment,
  PettyCashReplenishmentRequest,
  PettyCashReconciliation,
  PettyCashCategoryItem,
  PettyCashSubTab,
  Project,
  User,
} from '../../types';
import { PettyCashNav } from './PettyCashNav';
import { PettyCashDashboardView } from './PettyCashDashboardView';
import { PettyCashAccountsView } from './PettyCashAccountsView';
import { PettyCashApprovalsView } from './PettyCashApprovalsView';
import { ReplenishmentView } from './ReplenishmentView';
import { PettyCashReconciliationView, ReconciliationInput } from './PettyCashReconciliationView';
import { PettyCashPeriodClosingView } from './PettyCashPeriodClosingView';
import { PettyCashReportsView } from './PettyCashReportsView';
import { PettyCashSettingsView } from './PettyCashSettingsView';
import { NewExpenseModal } from './NewExpenseModal';
import { useNavigate } from 'react-router-dom';
import { useAppState, useStoreSlice } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { selectPettyFunds } from '../../store/domainSelectors';
import { AppDocument } from '../../types';
import { usePermission } from '../../store/session';

interface PettyCashModuleProps {
  currentUser: User;
  projects: Project[];
  onToast: (msg: string) => void;
}

export const PettyCashModule: React.FC<PettyCashModuleProps> = ({
  currentUser,
  projects,
  onToast,
}) => {
  const navigate = useNavigate();
  const wf = useWorkflows();
  const { can } = usePermission();
  const appState = useAppState();
  const [activeSubTab, setActiveSubTab] = useState<PettyCashSubTab>('dashboard');

  // Core Data State
  const { bankAccounts } = appState;
  // Funds show ceilings from the stored settings; several funds per project (PM, site, procurement).
  const accounts = selectPettyFunds(appState);
  const [, setAccounts] = useStoreSlice('pettyCashAccounts');
  const expenses = appState.pettyCashExpenses;
  const replenishments = appState.pettyCashReplenishments;
  const requests = appState.pettyCashRequests;
  const reconciliations = appState.pettyCashReconciliations;
  const [categories, setCategories] = useStoreSlice('pettyCashCategories');

  // UI state
  const [selectedAccount, setSelectedAccount] = useState<PettyCashAccount | null>(null);
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);
  const [modalAccountId, setModalAccountId] = useState<string | undefined>(undefined);

  // Badge Counters
  const pendingApprovalsCount = expenses.filter(
    (e) => e.status === 'pending_approval' || e.status === 'submitted'
  ).length;

  const lowBalanceCount = accounts.filter(
    (a) => a.usableBalance <= a.minBalanceWarning && a.status === 'active'
  ).length;

  const pendingRequestsCount = requests.filter((r) => r.status === 'در انتظار تأیید مالی').length;

  // ==================== ACTIONS (all run in the store's workflow service) ====================

  const handleSaveExpense = (newExp: PettyCashExpense, attachments: Omit<AppDocument, 'links'>[] = []) => {
    const result = wf.submitPettyCashExpense(newExp, attachments);
    onToast(result.message);
    return result;
  };

  // Staged approval per approvalLevelRequired; the last step posts Dr project expense / Cr this fund.
  const handleApproveExpense = (expenseId: string, comment?: string) => onToast(wf.approvePettyCashExpense(expenseId, comment).message);
  const handleRejectExpense = (expenseId: string, reason: string) => onToast(wf.rejectPettyCashExpense(expenseId, reason).message);
  const handleReturnExpense = (expenseId: string, comment: string) => onToast(wf.rejectPettyCashExpense(expenseId, comment, true).message);

  const handleRequestReplenishment = (fundId: string, amount: number, reason: string) => {
    const result = wf.requestPettyCashReplenishment(fundId, amount, reason);
    onToast(result.message);
    return result;
  };

  // 6. Save New Petty Cash Account
  // A new fund starts empty; money reaches it only through a replenishment paid by treasury.
  const handleSaveNewAccount = (newAcc: PettyCashAccount) => {
    if (!can('petty.manage_funds', { projectId: newAcc.projectId || undefined })) {
      onToast('اجازه تعریف تنخواه را ندارید.');
      return false;
    }
    setAccounts((prev) => [...prev, newAcc]);
    onToast(`تنخواه ${newAcc.code} تعریف شد.`);
    return true;
  };

  // Physical count; a difference becomes a pending adjustment voucher.
  const handleSaveReconciliation = (input: ReconciliationInput) => {
    const result = wf.reconcilePettyCash(input);
    onToast(result.message);
    return result;
  };

  const handleUpdateCategories = (next: PettyCashCategoryItem[]) => {
    if (!can('settings.manage')) return onToast('ویرایش سرفصل‌های هزینه فقط با مجوز تنظیمات ممکن است.');
    setCategories(next);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Sub-Navigation Bar */}
      <PettyCashNav
        activeSubTab={activeSubTab}
        setActiveSubTab={(tab) => {
          if (tab === 'new_expense') {
            setModalAccountId(undefined);
            setIsNewExpenseModalOpen(true);
          } else {
            setActiveSubTab(tab);
          }
        }}
        pendingApprovalsCount={pendingApprovalsCount}
        lowBalanceCount={lowBalanceCount}
        pendingRequestsCount={pendingRequestsCount}
      />

      {/* Main Tab Content View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        {activeSubTab === 'dashboard' && (
          <PettyCashDashboardView
            accounts={accounts}
            expenses={expenses}
            replenishments={replenishments}
            requests={requests}
            onNavigateTab={setActiveSubTab}
            onSelectAccount={(acc) => {
              setSelectedAccount(acc);
              setActiveSubTab('accounts');
            }}
            onOpenNewExpense={(accountId) => {
              setModalAccountId(accountId);
              setIsNewExpenseModalOpen(true);
            }}
            onOpenReplenishment={(accountId) => {
              setActiveSubTab('replenishments');
            }}
            onOpenReplenishRequest={(accountId) => {
              setActiveSubTab('requests');
            }}
          />
        )}

        {activeSubTab === 'accounts' && (
          <PettyCashAccountsView
            accounts={accounts}
            expenses={expenses}
            replenishments={replenishments}
            projects={projects}
            bankAccounts={bankAccounts}
            selectedAccount={selectedAccount}
            onSelectAccount={setSelectedAccount}
            onSaveNewAccount={handleSaveNewAccount}
            onOpenNewExpense={(accountId) => {
              setModalAccountId(accountId);
              setIsNewExpenseModalOpen(true);
            }}
            onOpenReplenish={(accountId) => {
              setActiveSubTab('replenishments');
            }}
            onOpenReplenishRequest={(accountId) => {
              setActiveSubTab('requests');
            }}
          />
        )}

        {activeSubTab === 'approvals' && (
          <PettyCashApprovalsView
            expenses={expenses}
            currentUser={currentUser}
            onApproveExpense={handleApproveExpense}
            onRejectExpense={handleRejectExpense}
            onReturnExpense={handleReturnExpense}
          />
        )}

        {(activeSubTab === 'replenishments' || activeSubTab === 'requests') && (
          <ReplenishmentView
            accounts={accounts}
            replenishments={replenishments}
            requests={requests}
            paymentRequests={appState.paymentRequests}
            onRequestReplenishment={handleRequestReplenishment}
            onOpenTreasury={() => navigate('/finance/payments')}
          />
        )}

        {activeSubTab === 'reconciliation' && (
          <PettyCashReconciliationView
            accounts={accounts}
            reconciliations={reconciliations}
            expenses={expenses}
            replenishments={replenishments}
            currentUser={currentUser}
            onSaveReconciliation={handleSaveReconciliation}
          />
        )}

        {activeSubTab === 'closing' && (
          <PettyCashPeriodClosingView
            accounts={accounts}
            expenses={expenses}
            currentUser={currentUser}
          />
        )}

        {activeSubTab === 'reports' && (
          <PettyCashReportsView
            accounts={accounts}
            expenses={expenses}
            replenishments={replenishments}
            reconciliations={reconciliations}
            projects={projects}
          />
        )}

        {activeSubTab === 'settings' && (
          <PettyCashSettingsView
            categories={categories}
            onUpdateCategories={handleUpdateCategories}
            onOpenPolicySettings={() => navigate('/settings')}
          />
        )}
      </main>

      {/* Floating / Interactive New Expense Modal */}
      {isNewExpenseModalOpen && (
      <NewExpenseModal
        isOpen={isNewExpenseModalOpen}
        onClose={() => setIsNewExpenseModalOpen(false)}
        accounts={accounts.filter((a) => a.status === 'active')}
        categories={categories}
        projects={projects}
        existingExpenses={expenses}
        currentUser={currentUser}
        preselectedAccountId={modalAccountId}
        onSaveExpense={handleSaveExpense}
      />
      )}
    </div>
  );
};
