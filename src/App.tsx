/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { KpiCards } from './components/dashboard/KpiCards';
import { ProjectTable } from './components/dashboard/ProjectTable';
import { FinancialCharts } from './components/dashboard/FinancialCharts';
import { ExpenseBreakdown } from './components/dashboard/ExpenseBreakdown';
import { PettyCashWidget } from './components/dashboard/PettyCashWidget';
import { PendingApprovalsWidget } from './components/dashboard/PendingApprovalsWidget';
import { ProgressStatementsSummary } from './components/dashboard/ProgressStatementsSummary';
import { ManagementAlerts } from './components/dashboard/ManagementAlerts';
import { QuickActions } from './components/dashboard/QuickActions';
import { AiAgentWidget } from './components/dashboard/AiAgentWidget';
import { ProjectDashboardModal } from './components/project/ProjectDashboardModal';
import { PdfReportModal } from './components/reports/PdfReportModal';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { QuickActionModal } from './components/common/QuickActionModal';
import { DocumentViewerModal } from './components/common/DocumentViewerModal';
import { LoginModal } from './components/auth/LoginModal';
import { ModulePlaceholderView } from './components/modules/ModulePlaceholderView';
import { AccountingModule } from './components/accounting/AccountingModule';
import { PettyCashModule } from './components/petty_cash/PettyCashModule';
import { ContractsModule } from './components/contracts/ContractsModule';
import { InventoryModule } from './components/inventory/InventoryModule';
import { ProcurementModule } from './components/procurement/ProcurementModule';
import { PaymentsTreasuryModule } from './components/finance/PaymentsTreasuryModule';
import { PartnersModule } from './components/partners/PartnersModule';
import { PayrollModule } from './components/hr_payroll/PayrollModule';
import { DocumentCenterModule } from './components/documents/DocumentCenterModule';
import { ApprovalCenterModule } from './components/approvals/ApprovalCenterModule';
import { ReportsBIModule } from './components/reports/ReportsBIModule';
import { ProjectsModule } from './components/project/ProjectsModule';
import { ProgressStatementsModule } from './components/statements/ProgressStatementsModule';
import { currentUser as defaultUser } from './data/mockData';
import { useAppState, useStoreSlice } from './store/AppStore';
import {
  selectProjects,
  selectKpiItems,
  selectPettyCashSummaries,
  selectStatementSummaries,
  selectMonthlyFinancialTrend,
  selectExpenseCategoryTotals,
  selectSidebarCounts,
} from './store/selectors';
import {
  Project,
  PettyCash,
  PendingApproval,
  ManagementAlert,
  TimeRange,
  UserProfile,
} from './types';
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Building2,
  Filter,
  Layers,
  X,
} from 'lucide-react';

export default function App() {
  // Navigation & Layout State
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('current_year');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [user, setUser] = useState<UserProfile>(defaultUser);

  // Core data comes from the central store; every financial figure is a selector over the ledger.
  const appState = useAppState();
  const [pendingApprovals, setPendingApprovals] = useStoreSlice('pendingApprovals');
  const [alerts, setAlerts] = useStoreSlice('alerts');
  const projects = useMemo(() => selectProjects(appState), [appState]);
  const kpis = useMemo(() => selectKpiItems(appState, selectedProjectId), [appState, selectedProjectId]);
  const pettyCashList = useMemo(() => selectPettyCashSummaries(appState), [appState]);
  const statements = useMemo(() => selectStatementSummaries(appState), [appState]);
  const monthlyTrend = useMemo(() => selectMonthlyFinancialTrend(appState, 7, selectedProjectId), [appState, selectedProjectId]);
  const expenseTotals = useMemo(() => selectExpenseCategoryTotals(appState, selectedProjectId), [appState, selectedProjectId]);
  const sidebarCounts = useMemo(() => selectSidebarCounts(appState), [appState]);

  // Modals & Drawers State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [pdfTargetProject, setPdfTargetProject] = useState<Project | null>(null);
  const [isAiAgentFloatingOpen, setIsAiAgentFloatingOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [selectedProjectForDashboard, setSelectedProjectForDashboard] = useState<Project | null>(null);
  const [activeDocItem, setActiveDocItem] = useState<PendingApproval | null>(null);
  const [quickActionState, setQuickActionState] = useState<{
    key: string;
    title: string;
  } | null>(null);

  // System States (Simulation of Empty, Loading, and Error states per requirement)
  const [systemState, setSystemState] = useState<'normal' | 'loading' | 'empty' | 'error'>('normal');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Filtered views if a specific project is selected in header dropdown
  const filteredProjects = useMemo(() => {
    if (selectedProjectId === 'all') return projects;
    return projects.filter((p) => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  const filteredPettyCash = useMemo(() => {
    if (selectedProjectId === 'all') return pettyCashList;
    return pettyCashList.filter((p) => p.projectId === selectedProjectId);
  }, [pettyCashList, selectedProjectId]);

  const filteredApprovals = useMemo(() => {
    if (selectedProjectId === 'all') return pendingApprovals;
    return pendingApprovals.filter((a) => a.projectId === selectedProjectId);
  }, [pendingApprovals, selectedProjectId]);

  const filteredStatements = useMemo(() => {
    if (selectedProjectId === 'all') return statements;
    return statements.filter((s) => s.projectId === selectedProjectId);
  }, [statements, selectedProjectId]);

  // Approval Handlers
  const handleApprove = (approvalId: string) => {
    const item = pendingApprovals.find((a) => a.id === approvalId);
    if (!item) return;

    // Approval status only: balances change exclusively through postFinancialEvent in the source modules.
    setPendingApprovals((prev) =>
      prev.map((a) => (a.id === approvalId ? { ...a, status: 'approved' } : a))
    );

    showToast(`سند شماره ${item.docNumber} به مبلغ ${item.amount.toLocaleString('fa-IR')} تومان توسط ${user.name} تأیید گردید.`);
  };

  const handleReject = (approvalId: string, reason: string = 'عدم تطابق با مستندات') => {
    const item = pendingApprovals.find((a) => a.id === approvalId);
    if (!item) return;

    setPendingApprovals((prev) =>
      prev.map((a) => (a.id === approvalId ? { ...a, status: 'rejected' } : a))
    );

    showToast(`سند شماره ${item.docNumber} رد شد. دلیل: ${reason}`);
  };

  const handlePettyCashCharge = (petty: PettyCash) => {
    setQuickActionState({
      key: 'charge_petty',
      title: `شارژ تنخواه ${petty.projectName} (${petty.holderName})`,
    });
  };

  const handleAlertAction = (alert: ManagementAlert) => {
    if (alert.actionType === 'petty_cash_charge' && alert.relatedProjectId) {
      const pc = pettyCashList.find((p) => p.projectId === alert.relatedProjectId);
      if (pc) handlePettyCashCharge(pc);
      else setQuickActionState({ key: 'charge_petty', title: 'شارژ فوری تنخواه کارگاه' });
    } else if (alert.actionType === 'open_approvals') {
      const pendingEl = document.getElementById('pending-approvals-section');
      if (pendingEl) pendingEl.scrollIntoView({ behavior: 'smooth' });
    } else {
      showToast(`دستور اقدام برای هشدار «${alert.title}» اجرا شد.`);
    }
  };

  const handleDismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    showToast('هشدار با موفقیت از صف اعلان‌های فعال خارج شد.');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex text-right font-sans antialiased selection:bg-amber-100 selection:text-amber-900">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 text-slate-400 hover:text-white mr-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Vertical Right Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        user={user}
        onOpenLogout={() => setIsLoginOpen(true)}
        onOpenAiAgent={() => setIsAiAgentFloatingOpen(true)}
        counts={sidebarCounts}
      />

      {/* Main Content Viewport */}
      <div
        className={`flex-1 transition-all duration-300 flex flex-col min-h-screen ${
          sidebarCollapsed ? 'mr-20' : 'mr-68'
        }`}
      >
        {/* Sticky Executive Top Header */}
        <Header
          title={
            currentTab === 'dashboard'
              ? 'مرکز فرماندهی و پایش مالی پروژه‌ها'
              : `ماژول: ${currentTab}`
          }
          subtitle="سامانه مدیریت جامع پیمانکاری و ساخت‌وساز · شرکت سازه گستران پارس"
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={(id) => setSelectedProjectId(id)}
          timeRange={timeRange}
          onChangeTimeRange={(r) => setTimeRange(r)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenPdfReport={() => {
            setPdfTargetProject(null);
            setIsPdfOpen(true);
          }}
          onOpenAiAgent={() => setIsAiAgentFloatingOpen(true)}
          user={user}
          alerts={alerts}
          onOpenAlertsModal={() => {
            const alertsEl = document.getElementById('management-alerts-section');
            if (alertsEl) alertsEl.scrollIntoView({ behavior: 'smooth' });
          }}
          onSwitchUser={() => setIsLoginOpen(true)}
        />

        {/* System State Selector Bar (For demonstrating Empty, Loading, Error states per requirement) */}
        <div className="no-print bg-white/80 border-b border-slate-200/80 px-6 py-2 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">شبیه‌سازی وضعیت‌های سیستمی:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
              <button
                onClick={() => setSystemState('normal')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  systemState === 'normal' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                داده‌های فعال (Normal)
              </button>
              <button
                onClick={() => setSystemState('loading')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  systemState === 'loading' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                بارگذاری (Loading)
              </button>
              <button
                onClick={() => setSystemState('empty')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  systemState === 'empty' ? 'bg-white text-amber-700 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                داده خالی (Empty)
              </button>
              <button
                onClick={() => setSystemState('error')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  systemState === 'error' ? 'bg-white text-rose-700 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                خطا (Error)
              </button>
            </div>
          </div>

          {selectedProjectId !== 'all' && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded">
              <Filter className="w-3 h-3 text-amber-600" />
              <span>فیلتر فعال روی یک پروژه</span>
              <button
                onClick={() => setSelectedProjectId('all')}
                className="font-bold underline text-amber-800 cursor-pointer"
              >
                نمایش تمام پروژه‌ها
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Main Body Content */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 max-w-[1600px] w-full mx-auto">
          {/* SYSTEM STATE: LOADING */}
          {systemState === 'loading' && (
            <div className="py-24 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700">در حال دریافت داده‌های برخط پروژه‌ها و مراکز هزینه...</p>
              <p className="text-xs text-slate-400">همگام‌سازی دفاتر حسابداری، تنخواه‌ها و صورت‌وضعیت‌ها</p>
            </div>
          )}

          {/* SYSTEM STATE: ERROR */}
          {systemState === 'error' && (
            <div className="p-8 rounded-2xl bg-white border border-rose-200 text-center max-w-lg mx-auto my-12 space-y-3 shadow-sm">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">خطا در برقراری ارتباط با سرور حسابداری</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                امکان دریافت آخرین تراز آزمایشی و گردش نقدینگی وجود ندارد. لطفاً ارتباط شبکه یا سرویس پایگاه داده را بررسی نمایید.
              </p>
              <button
                onClick={() => setSystemState('normal')}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                تلاش مجدد و بارگذاری مجدد
              </button>
            </div>
          )}

          {/* SYSTEM STATE: EMPTY */}
          {systemState === 'empty' && (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center max-w-lg mx-auto my-12 space-y-3 shadow-sm">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">هیچ پروژه‌ای در این دوره ثبت نشده است</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                هنوز پروژه یا سند مالی در بازه زمانی انتخاب‌شده وجود ندارد. می‌توانید اولین قرارداد یا هزینه را اضافه نمایید.
              </p>
              <button
                onClick={() => setQuickActionState({ key: 'new_project', title: 'تعریف پروژه جدید' })}
                className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-amber-600 cursor-pointer"
              >
                تعریف اولین پروژه عمرانی
              </button>
            </div>
          )}

          {/* SYSTEM STATE: NORMAL OPERATING DASHBOARD */}
          {systemState === 'normal' && (
            <>
              {currentTab === 'dashboard' ? (
                <>
                  {/* 1. Quick Actions Shortcuts */}
                  <QuickActions
                    onTriggerAction={(key, title) => {
                      if (key === 'view_financial_report') {
                        setIsPdfOpen(true);
                      } else {
                        setQuickActionState({ key, title });
                      }
                    }}
                  />

                  {/* 2. Key Performance Indicators (8 Cards) */}
                  <KpiCards
                    kpis={kpis}
                    onCardClick={(kpi) => {
                      showToast(`مشاهده ریز گزارش شاخص: ${kpi.title}`);
                    }}
                  />

                  {/* 3. Financial Charts & Expense Breakdown (2 Columns) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FinancialCharts
                      data={monthlyTrend}
                      timeRange={timeRange}
                      onChangeTimeRange={(r) => setTimeRange(r)}
                    />
                    <ExpenseBreakdown totals={expenseTotals} />
                  </div>

                  {/* 4. Projects Financial Overview Modern Table */}
                  <ProjectTable
                    projects={filteredProjects}
                    onSelectProject={(project) => setSelectedProjectForDashboard(project)}
                  />

                  {/* 5. Petty Cash & Pending Approvals (CEO priority sections) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <PettyCashWidget
                      items={filteredPettyCash}
                      onChargeClick={handlePettyCashCharge}
                      onViewAllClick={() => setCurrentTab('petty_cash')}
                    />

                    <div id="pending-approvals-section">
                      <PendingApprovalsWidget
                        approvals={filteredApprovals}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onViewDoc={(doc) => setActiveDocItem(doc)}
                      />
                    </div>
                  </div>

                  {/* 6. Progress Statements Summary & Management Alerts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ProgressStatementsSummary
                      statements={filteredStatements}
                      onOpenStatementsModule={() => setCurrentTab('statements')}
                      onSelectStatement={(st) => {
                        showToast(`انتخاب صورت‌وضعیت: ${st.number}`);
                      }}
                    />

                    <div id="management-alerts-section">
                      <ManagementAlerts
                        alerts={alerts}
                        onActionClick={handleAlertAction}
                        onDismiss={handleDismissAlert}
                      />
                    </div>
                  </div>

                  {/* 7. Inline AI Assistant Panel at Dashboard bottom */}
                  <div className="pt-2">
                    <AiAgentWidget
                      isOpen={true}
                      isFloating={false}
                      projects={projects}
                      pettyCashList={pettyCashList}
                      pendingApprovals={pendingApprovals}
                    />
                  </div>
                </>
              ) : currentTab === 'projects' ? (
                /* Phase 1 & Architecture Point 2: Dedicated Projects Module */
                <ProjectsModule
                  projects={projects}
                  onSelectProject={(id) => {
                    setSelectedProjectId(id);
                  }}
                  onNavigateToTab={(tab) => setCurrentTab(tab)}
                />
              ) : currentTab === 'contracts' ? (
                /* Phase 3 & Architecture Point 3: Dedicated Contracts Module */
                <ContractsModule
                  projects={projects}
                  currentUser={user}
                  onPosted={(docNumber) => showToast(`سند حسابداری ${docNumber} با موفقیت صادر شد.`)}
                />
              ) : currentTab === 'statements' ? (
                /* Phase 4 & Architecture Point 4: Progress Statements Module (Client & Subcontractor) */
                <ProgressStatementsModule
                  projects={projects}
                  onOpenNewClientStatement={() => showToast('فرم ثبت صورت‌وضعیت جدید کارفرما')}
                  onOpenNewSubcontractorStatement={() => showToast('فرم ثبت صورت‌وضعیت جدید پیمانکار جزء')}
                />
              ) : currentTab === 'procurement' ? (
                /* Phase 5 & Architecture Point 5: Procurement Module (PR -> RFQ -> PO -> GRN -> Invoice) */
                <ProcurementModule
                  projects={projects}
                  currentUser={user}
                  onPosted={(docNumber) => showToast(`سند حسابداری فاکتور خرید ${docNumber} صادر گردید.`)}
                />
              ) : currentTab === 'inventory' ? (
                /* Phase 6 & Architecture Point 6: Warehouse, Materials & Inventory Module */
                <InventoryModule
                  currentUser={user}
                  projects={projects}
                />
              ) : currentTab === 'petty_cash' ? (
                /* Phase 7 & Architecture Point 7: Petty Cash Module */
                <PettyCashModule
                  currentUser={user}
                  projects={projects}
                  onPosted={(docNumber) => showToast(`سند حسابداری ${docNumber} صادر شد.`)}
                />
              ) : currentTab === 'finance' ? (
                /* Phase 8 & Architecture Point 9: Treasury & Payments Module */
                <PaymentsTreasuryModule
                  projects={projects}
                  currentUser={user}
                  onPosted={(docNumber) => showToast(`پرداخت انجام و سند ${docNumber} صادر شد.`)}
                />
              ) : currentTab === 'accounting' ? (
                /* Phase 2 & Architecture Point 8: Full Enterprise Accounting Engine */
                <AccountingModule currentUser={user} />
              ) : currentTab === 'partners' ? (
                /* Phase 9 & Architecture Points 11 & 12: Stakeholders & Partners Directory */
                <PartnersModule
                  projects={projects}
                  onOpenClientContract={(id) => setCurrentTab('contracts')}
                  onOpenSubcontractorContract={(id) => setCurrentTab('contracts')}
                />
              ) : currentTab === 'payroll' ? (
                /* Phase 10 & Architecture Point 13: HR & Payroll Engine */
                <PayrollModule
                  projects={projects}
                  currentUser={user}
                />
              ) : currentTab === 'documents' ? (
                /* Phase 11 & Architecture Point 14: Unified Document Management DMS */
                <DocumentCenterModule projects={projects} />
              ) : currentTab === 'approvals' ? (
                /* Phase 11 & Architecture Point 15: Executive Approvals Center */
                <ApprovalCenterModule
                  projects={projects}
                  currentUser={user}
                  onItemApproved={(item) => {
                    showToast(`درخواست ${item.docNumber} با موفقیت توسط مدیریت تایید و ابلاغ شد.`);
                  }}
                  onItemRejected={(item, reason) => {
                    showToast(`درخواست ${item.docNumber} جهت اصلاح عودت داده شد.`);
                  }}
                />
              ) : currentTab === 'reports' ? (
                /* Phase 12 & Architecture Point 17: BI & Executive Analytics */
                <ReportsBIModule projects={projects} />
              ) : (
                /* Fallback View */
                <ModulePlaceholderView
                  moduleId={currentTab}
                  onBackToDashboard={() => setCurrentTab('dashboard')}
                  projects={projects}
                  pettyCashList={pettyCashList}
                  statements={statements}
                />
              )}
            </>
          )}
        </main>

        {/* Corporate Clean Footer */}
        <footer className="no-print mt-auto py-4 px-6 border-t border-slate-200 bg-white/60 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            سامانه جامع مدیریت پروژه‌ها و حسابداری پیمانکاری ·{' '}
            <strong className="text-slate-700">شرکت سازه گستران پارس</strong>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span>فاز اول: داشبورد مدیریتی</span>
            <span>·</span>
            <span className="text-amber-700 font-bold">فاز دوم: ماژول حسابداری دوبل پیمانکاری</span>
            <span>·</span>
            <span className="text-emerald-700 font-bold">هسته متصل و پایدار</span>
          </div>
        </footer>
      </div>

      {/* Dedicated Project Dashboard Modal */}
      <ProjectDashboardModal
        project={selectedProjectForDashboard}
        onClose={() => setSelectedProjectForDashboard(null)}
        onPrintProjectPdf={(proj) => {
          setPdfTargetProject(proj);
          setIsPdfOpen(true);
        }}
      />

      {/* PDF Export Printable Dossier Modal */}
      <PdfReportModal
        isOpen={isPdfOpen}
        onClose={() => {
          setIsPdfOpen(false);
          setPdfTargetProject(null);
        }}
        projects={projects}
        kpis={kpis}
        pettyCashList={pettyCashList}
        statements={statements}
        targetProject={pdfTargetProject}
      />

      {/* Global Multi-Entity Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        projects={projects}
        approvals={pendingApprovals}
        statements={statements}
        pettyCashList={pettyCashList}
        onSelectProject={(p) => setSelectedProjectForDashboard(p)}
        onSelectApproval={(a) => setActiveDocItem(a)}
        onSelectStatement={(s) => showToast(`مشاهده جزئیات ${s.number}`)}
      />

      {/* Quick Action Modal */}
      <QuickActionModal
        actionKey={quickActionState?.key || null}
        actionTitle={quickActionState?.title || null}
        onClose={() => setQuickActionState(null)}
        projects={projects}
        pettyCashList={pettyCashList}
        onSuccess={(msg) => showToast(msg)}
      />

      {/* Document Viewer Modal for Approvals */}
      <DocumentViewerModal
        item={activeDocItem}
        onClose={() => setActiveDocItem(null)}
        onApprove={(id) => handleApprove(id)}
      />

      {/* Login & User Role Switcher Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        currentUser={user}
        onSelectUser={(u) => {
          setUser(u);
          showToast(`کاربر جاری به «${u.name}» (${u.role}) تغییر یافت.`);
        }}
      />

      {/* Floating AI Agent Widget (When opened from Header or Sidebar pill) */}
      {isAiAgentFloatingOpen && (
        <AiAgentWidget
          isOpen={isAiAgentFloatingOpen}
          onClose={() => setIsAiAgentFloatingOpen(false)}
          isFloating={true}
          projects={projects}
          pettyCashList={pettyCashList}
          pendingApprovals={pendingApprovals}
        />
      )}
    </div>
  );
}
