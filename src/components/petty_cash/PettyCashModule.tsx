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
import {
  initialPettyCashReplenishments,
  initialPettyCashRequests,
  initialPettyCashReconciliations,
  initialPettyCashCategories,
} from '../../data/pettyCashMockData';
import { PettyCashNav } from './PettyCashNav';
import { PettyCashDashboardView } from './PettyCashDashboardView';
import { PettyCashAccountsView } from './PettyCashAccountsView';
import { PettyCashApprovalsView } from './PettyCashApprovalsView';
import { ReplenishmentView } from './ReplenishmentView';
import { PettyCashReconciliationView } from './PettyCashReconciliationView';
import { PettyCashPeriodClosingView } from './PettyCashPeriodClosingView';
import { PettyCashReportsView } from './PettyCashReportsView';
import { PettyCashSettingsView } from './PettyCashSettingsView';
import { NewExpenseModal } from './NewExpenseModal';
import { useAppState, useStoreSlice, usePostFinancialEvent } from '../../store/AppStore';
import { pettyCashExpenseApprovedEvent } from '../../store/events';

interface PettyCashModuleProps {
  currentUser: User;
  projects: Project[];
  onPosted?: (docNumber: string) => void;
}

export const PettyCashModule: React.FC<PettyCashModuleProps> = ({
  currentUser,
  projects,
  onPosted,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<PettyCashSubTab>('dashboard');

  // Core Data State
  const { bankAccounts } = useAppState();
  const postFinancialEvent = usePostFinancialEvent();
  const [accounts, setAccounts] = useStoreSlice('pettyCashAccounts');
  const [expenses, setExpenses] = useStoreSlice('pettyCashExpenses');
  const [replenishments, setReplenishments] = useState<PettyCashReplenishment[]>(
    initialPettyCashReplenishments
  );
  const [requests, setRequests] = useState<PettyCashReplenishmentRequest[]>(
    initialPettyCashRequests
  );
  const [reconciliations, setReconciliations] = useState<PettyCashReconciliation[]>(
    initialPettyCashReconciliations
  );
  const [categories, setCategories] = useState<PettyCashCategoryItem[]>(
    initialPettyCashCategories
  );

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

  const pendingRequestsCount = requests.length;

  // ==================== ACTIONS & WORKFLOW HANDLERS ====================

  // 1. Submit New Expense
  const handleSaveExpense = (newExp: PettyCashExpense) => {
    // Add to expenses
    setExpenses((prev) => [newExp, ...prev]);

    // Update Account: increase pendingExpenses, decrease usableBalance
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === newExp.pettyCashId) {
          const newPending = acc.pendingExpenses + newExp.amount;
          const newUsable = acc.actualBalance - newPending;
          return {
            ...acc,
            pendingExpenses: newPending,
            usableBalance: newUsable,
          };
        }
        return acc;
      })
    );
  };

  // 2. Approve Expense (Strict Financial Trigger: Decreases Actual Balance, Clears Pending, Posts Accounting)
  const handleApproveExpense = (expenseId: string, comment?: string) => {
    const targetExp = expenses.find((e) => e.id === expenseId);
    if (!targetExp || ['approved', 'accounting_posted', 'reconciled', 'rejected'].includes(targetExp.status)) return;

    // Update expense record
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id === expenseId) {
          return {
            ...e,
            status: 'approved',
            currentApprovalStep: 'تأیید نهایی و ثبت سند',
            approvalHistory: [
              ...e.approvalHistory,
              {
                level: currentUser.role,
                approverName: currentUser.name,
                approverRole: currentUser.role,
                date: '۱۴۰۳/۰۷/۰۲',
                time: '۱۲:۴۵',
                action: 'approved',
                comment: comment || 'تأیید نهایی و انتقال به هزینه‌های قطعی پروژه',
              },
            ],
          };
        }
        return e;
      })
    );

    // Pending ↓ and monthly spend ↑ here; the fund's actual/usable balance and the project cost
    // change only through the posted accounting entry (Dr project expense / Cr this petty cash fund).
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === targetExp.pettyCashId) {
          const newPending = Math.max(0, acc.pendingExpenses - targetExp.amount);
          return {
            ...acc,
            pendingExpenses: newPending,
            usableBalance: acc.actualBalance - newPending,
            monthlySpent: acc.monthlySpent + targetExp.amount,
          };
        }
        return acc;
      })
    );

    const account = accounts.find((a) => a.id === targetExp.pettyCashId);
    const result = postFinancialEvent(pettyCashExpenseApprovedEvent(targetExp, account), {
      submitter: currentUser.name,
    });
    if (result.ok && result.event) {
      setExpenses((prev) =>
        prev.map((e) => (e.id === expenseId ? { ...e, journalEntryId: result.event!.docNumber } : e))
      );
      if (!result.duplicate) onPosted?.(result.event.docNumber!);
    }
  };

  // 3. Reject Expense (Relieves Pending, Does NOT touch Project Cost or Actual Balance)
  const handleRejectExpense = (expenseId: string, reason: string) => {
    const targetExp = expenses.find((e) => e.id === expenseId);
    if (!targetExp) return;

    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id === expenseId) {
          return {
            ...e,
            status: 'rejected',
            rejectionReason: reason,
            currentApprovalStep: 'رد شده',
            approvalHistory: [
              ...e.approvalHistory,
              {
                level: currentUser.role,
                approverName: currentUser.name,
                approverRole: currentUser.role,
                date: '۱۴۰۳/۰۷/۰۲',
                time: '۱۳:۱۰',
                action: 'rejected',
                comment: reason,
              },
            ],
          };
        }
        return e;
      })
    );

    // Relieve Pending Expenses from account (releases usable balance back)
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === targetExp.pettyCashId) {
          const newPending = Math.max(0, acc.pendingExpenses - targetExp.amount);
          const newUsable = acc.actualBalance - newPending;
          return {
            ...acc,
            pendingExpenses: newPending,
            usableBalance: newUsable,
          };
        }
        return acc;
      })
    );
  };

  // 4. Return Expense for correction
  const handleReturnExpense = (expenseId: string, comment: string) => {
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id === expenseId) {
          return {
            ...e,
            status: 'returned_for_correction',
            rejectionReason: comment,
            currentApprovalStep: 'بازگشت به کاربر',
            approvalHistory: [
              ...e.approvalHistory,
              {
                level: currentUser.role,
                approverName: currentUser.name,
                approverRole: currentUser.role,
                date: '۱۴۰۳/۰۷/۰۲',
                time: '۱۳:۱۵',
                action: 'returned_for_correction',
                comment,
              },
            ],
          };
        }
        return e;
      })
    );
  };

  // 5. Execute Replenishment (Bank Account ↓, Petty Cash Balance ↑)
  const handleExecuteReplenish = (replenish: PettyCashReplenishment) => {
    setReplenishments((prev) => [replenish, ...prev]);

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === replenish.pettyCashId
          ? { ...acc, lastReplenishmentDate: replenish.date, lastReplenishmentAmount: replenish.amount }
          : acc
      )
    );

    // Bank ↓ and petty cash fund ↑ happen only through the posted entry (Dr petty cash / Cr bank).
    const account = accounts.find((a) => a.id === replenish.pettyCashId);
    const sourceBank = bankAccounts.find((b) => b.id === replenish.sourceBankAccountId);
    const result = postFinancialEvent(
      {
        type: 'PETTY_CASH_REPLENISHMENT',
        sourceModule: 'petty_cash',
        sourceId: replenish.id,
        projectId: account?.projectId || '',
        costCenterId: account?.costCenterId || '',
        counterpartyId: '',
        amount: replenish.amount,
        date: replenish.date,
        details: {
          pettyCashId: replenish.pettyCashId,
          pettyCashTitle: replenish.pettyCashTitle,
          bankAccountId: replenish.sourceBankAccountId,
          bankName: sourceBank?.bankName || replenish.sourceBankAccountName,
          trackingNumber: replenish.trackingNumber,
        },
      },
      { submitter: currentUser.name }
    );
    if (result.ok && result.event) {
      setReplenishments((prev) =>
        prev.map((r) => (r.id === replenish.id ? { ...r, journalEntryId: result.event!.docNumber } : r))
      );
      if (!result.duplicate) onPosted?.(result.event.docNumber!);
    }
  };

  // 6. Save New Petty Cash Account
  const handleSaveNewAccount = (newAcc: PettyCashAccount) => {
    setAccounts((prev) => [...prev, newAcc]);
  };

  // 7. Save Reconciliation
  const handleSaveReconciliation = (recon: PettyCashReconciliation) => {
    setReconciliations((prev) => [recon, ...prev]);
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
            bankAccounts={bankAccounts}
            replenishments={replenishments}
            requests={requests}
            currentUser={currentUser}
            onExecuteReplenish={handleExecuteReplenish}
            onApproveRequest={(requestId) => {
              setRequests((prev) => prev.filter((r) => r.id !== requestId));
            }}
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
            onUpdateCategories={setCategories}
          />
        )}
      </main>

      {/* Floating / Interactive New Expense Modal */}
      <NewExpenseModal
        isOpen={isNewExpenseModalOpen}
        onClose={() => setIsNewExpenseModalOpen(false)}
        accounts={accounts}
        categories={categories}
        projects={projects}
        existingExpenses={expenses}
        currentUser={currentUser}
        preselectedAccountId={modalAccountId}
        onSaveExpense={handleSaveExpense}
      />
    </div>
  );
};
