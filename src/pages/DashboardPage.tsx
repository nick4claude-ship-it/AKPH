/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { KpiCards } from '../components/dashboard/KpiCards';
import { ProjectTable } from '../components/dashboard/ProjectTable';
import { FinancialCharts } from '../components/dashboard/FinancialCharts';
import { ExpenseBreakdown } from '../components/dashboard/ExpenseBreakdown';
import { PettyCashWidget } from '../components/dashboard/PettyCashWidget';
import { PendingApprovalsWidget } from '../components/dashboard/PendingApprovalsWidget';
import { ProgressStatementsSummary } from '../components/dashboard/ProgressStatementsSummary';
import { ManagementAlerts } from '../components/dashboard/ManagementAlerts';
import { QuickActions } from '../components/dashboard/QuickActions';
import { AiAgentWidget } from '../components/dashboard/AiAgentWidget';
import { useAppState, useStoreSlice } from '../store/AppStore';
import { selectKpiItems, selectMonthlyFinancialTrend, selectExpenseCategoryTotals } from '../store/selectors';
import { selectApprovals, selectNotifications, selectPettyFunds } from '../store/domainSelectors';
import { useApprovalActions } from '../store/useApprovalActions';
import { ApprovalItem, Project, TimeRange } from '../types';
import { useDismissedNotifications } from '../store/notifications';
import { useCurrentUser } from '../store/session';

/** Where each dashboard quick action is performed; the dashboard itself records nothing. */
const QUICK_ACTION_PATHS: Record<string, string> = {
  record_expense: '/petty-cash',
  record_invoice: '/procurement',
  charge_petty: '/petty-cash',
  record_receipt: '/finance/receipts',
  record_payment: '/finance/payments',
  submit_statement: '/statements/client',
  new_project: '/projects',
  new_supplier: '/partners/suppliers',
};

interface DashboardPageProps {
  projects: Project[];
  selectedProjectId: string;
  timeRange: TimeRange;
  onChangeTimeRange: (r: TimeRange) => void;
  onOpenProject: (p: Project) => void;
  onOpenReport: () => void;
  onViewApproval: (item: ApprovalItem) => void;
  onToast: (msg: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  projects,
  selectedProjectId,
  timeRange,
  onChangeTimeRange,
  onOpenProject,
  onOpenReport,
  onViewApproval,
  onToast,
}) => {
  const state = useAppState();
  const navigate = useNavigate();
  const [, setDismissed] = useDismissedNotifications();
  const user = useCurrentUser();
  const { approve, reject } = useApprovalActions();
  const inScope = <T extends { projectId?: string }>(rows: T[]) =>
    selectedProjectId === 'all' ? rows : rows.filter((r) => r.projectId === selectedProjectId);

  const kpis = useMemo(() => selectKpiItems(state, selectedProjectId), [state, selectedProjectId]);
  const trend = useMemo(() => selectMonthlyFinancialTrend(state, 7, selectedProjectId), [state, selectedProjectId]);
  const expenses = useMemo(() => selectExpenseCategoryTotals(state, selectedProjectId), [state, selectedProjectId]);
  const approvals = useMemo(() => inScope(selectApprovals(state)), [state, selectedProjectId]);
  const notifications = useMemo(() => inScope(selectNotifications(state, false, user.id).map((n) => ({ ...n, projectId: n.relatedProjectId }))), [state, selectedProjectId, user.id]);
  const funds = useMemo(() => inScope(selectPettyFunds(state).filter((f) => f.status === 'active')), [state, selectedProjectId]);
  const statements = inScope(state.clientStatements);
  const visibleProjects = selectedProjectId === 'all' ? projects : projects.filter((p) => p.id === selectedProjectId);

  const run = (result: { ok: boolean; message: string }) => onToast(result.message);

  return (
    <>
      <QuickActions
        onTriggerAction={(key) => {
          if (key === 'view_financial_report') onOpenReport();
          else navigate(QUICK_ACTION_PATHS[key] || '/');
        }}
      />

      <KpiCards kpis={kpis} onCardClick={(kpi) => onToast(`مشاهده ریز گزارش شاخص: ${kpi.title}`)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinancialCharts data={trend} timeRange={timeRange} onChangeTimeRange={onChangeTimeRange} />
        <ExpenseBreakdown totals={expenses} />
      </div>

      <ProjectTable projects={visibleProjects} onSelectProject={onOpenProject} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PettyCashWidget
          items={funds}
          lowBalancePercent={state.pettyCashSettings.lowBalancePercent}
          onChargeClick={() => navigate('/petty-cash')}
          onViewAllClick={() => navigate('/petty-cash')}
        />
        <div id="pending-approvals-section">
          <PendingApprovalsWidget
            approvals={approvals}
            onApprove={(id) => {
              const item = approvals.find((a) => a.id === id);
              if (item) run(approve(item));
            }}
            onReject={(id, reason) => {
              const item = approvals.find((a) => a.id === id);
              if (item) run(reject(item, reason || 'عدم تطابق با مستندات'));
            }}
            onViewDoc={onViewApproval}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProgressStatementsSummary
          statements={statements}
          onOpenStatementsModule={() => navigate('/statements/client')}
          onSelectStatement={() => navigate('/statements/client')}
        />
        <div id="management-alerts-section">
          <ManagementAlerts
            alerts={notifications}
            onActionClick={(alert) => navigate(alert.actionPath || '/notifications')}
            onDismiss={(id) => {
              setDismissed((prev) => [...prev, id]);
              onToast('هشدار از صف اعلان‌های فعال خارج شد.');
            }}
          />
        </div>
      </div>

      <div className="pt-2">
        <AiAgentWidget isOpen={true} isFloating={false} />
      </div>
    </>
  );
};

export default DashboardPage;
