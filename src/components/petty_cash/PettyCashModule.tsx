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
  BankAccount,
  User,
  JournalEntry,
} from '../../types';
import {
  initialPettyCashAccounts,
  initialPettyCashExpenses,
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

interface PettyCashModuleProps {
  currentUser: User;
  projects: Project[];
  bankAccounts: BankAccount[];
  onAddJournalEntry?: (entry: JournalEntry) => void;
  onUpdateProjectCost?: (projectId: string, amount: number) => void;
  onUpdateBankBalance?: (bankAccountId: string, newBalance: number) => void;
}

export const PettyCashModule: React.FC<PettyCashModuleProps> = ({
  currentUser,
  projects,
  bankAccounts,
  onAddJournalEntry,
  onUpdateProjectCost,
  onUpdateBankBalance,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<PettyCashSubTab>('dashboard');

  // Core Data State
  const [accounts, setAccounts] = useState<PettyCashAccount[]>(initialPettyCashAccounts);
  const [expenses, setExpenses] = useState<PettyCashExpense[]>(initialPettyCashExpenses);
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
    if (!targetExp) return;

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

    // Update Account Balances:
    // Actual Balance ↓
    // Pending Expenses ↓
    // Usable Balance remains Actual - Pending (which stays the same after reduction, or updates accordingly)
    // Monthly Spent ↑
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === targetExp.pettyCashId) {
          const newActual = Math.max(0, acc.actualBalance - targetExp.amount);
          const newPending = Math.max(0, acc.pendingExpenses - targetExp.amount);
          const newUsable = newActual - newPending;
          return {
            ...acc,
            actualBalance: newActual,
            pendingExpenses: newPending,
            usableBalance: newUsable,
            monthlySpent: acc.monthlySpent + targetExp.amount,
          };
        }
        return acc;
      })
    );

    // Update Project Cost
    if (onUpdateProjectCost && targetExp.projectId && targetExp.projectId !== 'all') {
      onUpdateProjectCost(targetExp.projectId, targetExp.amount);
    }

    // Auto-generate Journal Entry in Accounting module
    if (onAddJournalEntry) {
      const journalEntry: JournalEntry = {
        id: `acc-entry-${Date.now()}`,
        docNumber: `ACC-1403-0${Math.floor(840 + Math.random() * 50)}`,
        date: targetExp.date,
        title: `ثبت هزینه تنخواه: ${targetExp.description} (${targetExp.projectName})`,
        type: 'عمومی',
        projectId: targetExp.projectId,
        projectName: targetExp.projectName,
        costCenterId: targetExp.costCenter,
        costCenterName: targetExp.costCenter,
        submitter: currentUser.name,
        status: 'تأیید شده',
        totalDebit: targetExp.amount,
        totalCredit: targetExp.amount,
        isBalanced: true,
        history: [
          {
            date: '۱۴۰۳/۰۷/۰۲',
            time: '۱۲:۴۵',
            user: currentUser.name,
            action: 'ثبت سند مکانیزه از ماژول تنخواه',
          },
        ],
        rows: [
          {
            id: `row-1`,
            accountCode: targetExp.accountingAccountCode || '511',
            accountName: targetExp.accountingAccountName || 'هزینه کارگاهی پروژه',
            debit: targetExp.amount,
            credit: 0,
            subledgerName: targetExp.projectName,
            costCenterName: targetExp.costCenter,
            description: targetExp.description,
          },
          {
            id: `row-2`,
            accountCode: '103',
            accountName: 'موجودی تنخواه‌گردان‌ها',
            debit: 0,
            credit: targetExp.amount,
            subledgerName: targetExp.pettyCashTitle,
            costCenterName: targetExp.costCenter,
            description: `کسر از تنخواه بابت فاکتور ${targetExp.invoiceNumber}`,
          },
        ],
      };
      onAddJournalEntry(journalEntry);
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

    // Update target account: Actual Balance ↑, Usable Balance ↑
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === replenish.pettyCashId) {
          const newActual = acc.actualBalance + replenish.amount;
          const newUsable = newActual - acc.pendingExpenses;
          return {
            ...acc,
            actualBalance: newActual,
            usableBalance: newUsable,
            lastReplenishmentDate: replenish.date,
            lastReplenishmentAmount: replenish.amount,
          };
        }
        return acc;
      })
    );

    // Update Source Bank Account balance in global app
    const sourceBank = bankAccounts.find((b) => b.id === replenish.sourceBankAccountId);
    if (sourceBank && onUpdateBankBalance) {
      onUpdateBankBalance(sourceBank.id, Math.max(0, sourceBank.balance - replenish.amount));
    }

    // Auto-generate Journal Entry
    if (onAddJournalEntry) {
      const journalEntry: JournalEntry = {
        id: `acc-entry-${Date.now()}`,
        docNumber: replenish.journalEntryId || `ACC-1403-0${Math.floor(860 + Math.random() * 30)}`,
        date: replenish.date,
        title: `شارژ تنخواه‌گردان: ${replenish.pettyCashTitle} از حساب ${replenish.sourceBankAccountName}`,
        type: 'پرداخت',
        submitter: currentUser.name,
        status: 'تأیید شده',
        totalDebit: replenish.amount,
        totalCredit: replenish.amount,
        isBalanced: true,
        history: [
          {
            date: replenish.date,
            time: '۱۰:۰۰',
            user: currentUser.name,
            action: 'ثبت سند واریز حواله شارژ تنخواه',
          },
        ],
        rows: [
          {
            id: `row-1`,
            accountCode: '103',
            accountName: 'موجودی تنخواه‌گردان‌ها',
            debit: replenish.amount,
            credit: 0,
            subledgerName: replenish.pettyCashTitle,
            description: `واریز شارژ دوره تنخواه طبق حواله ${replenish.trackingNumber}`,
          },
          {
            id: `row-2`,
            accountCode: '102',
            accountName: 'موجودی بانک‌های ریالی شرکت',
            debit: 0,
            credit: replenish.amount,
            subledgerName: replenish.sourceBankAccountName,
            description: `برداشت بابت شارژ تنخواه ${replenish.pettyCashTitle}`,
          },
        ],
      };
      onAddJournalEntry(journalEntry);
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
