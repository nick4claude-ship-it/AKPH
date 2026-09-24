/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ProjectDashboardModal } from './components/project/ProjectDashboardModal';
import { PdfReportModal } from './components/reports/PdfReportModal';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { DocumentViewerModal } from './components/common/DocumentViewerModal';
import { LoginModal } from './components/auth/LoginModal';
import { AiAgentWidget } from './components/dashboard/AiAgentWidget';
import { useAppState } from './store/AppStore';
import { useCurrentUser, usePermission, useSession } from './store/session';
import { useToastListener } from './store/toast';
import { useApprovalActions } from './store/useApprovalActions';
import { selectProjects, selectKpiItems } from './store/selectors';
import { selectApprovals, selectNotifications, selectPettyFunds, selectSidebarCounts } from './store/domainSelectors';
import { matchNav, navTrail, NavNode } from './navigation/navConfig';
import { ApprovalItem, Project, TimeRange } from './types';
import { CheckCircle2, RefreshCw, Filter, X, Lock } from 'lucide-react';

/** Lazily loaded module screens (one chunk per module). */
function named<M, K extends keyof M>(loader: () => Promise<M>, key: K) {
  type C = M[K] extends React.ComponentType<infer P> ? React.ComponentType<P> : never;
  return lazy(() => loader().then((m) => ({ default: m[key] as unknown as C })));
}

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectsModule = named(() => import('./components/project/ProjectsModule'), 'ProjectsModule');
const ContractsModule = named(() => import('./components/contracts/ContractsModule'), 'ContractsModule');
const ProgressStatementsModule = named(() => import('./components/statements/ProgressStatementsModule'), 'ProgressStatementsModule');
const ProcurementModule = named(() => import('./components/procurement/ProcurementModule'), 'ProcurementModule');
const InventoryModule = named(() => import('./components/inventory/InventoryModule'), 'InventoryModule');
const PettyCashModule = named(() => import('./components/petty_cash/PettyCashModule'), 'PettyCashModule');
const AccountingModule = named(() => import('./components/accounting/AccountingModule'), 'AccountingModule');
const PaymentsTreasuryModule = named(() => import('./components/finance/PaymentsTreasuryModule'), 'PaymentsTreasuryModule');
const PartnersModule = named(() => import('./components/partners/PartnersModule'), 'PartnersModule');
const PayrollModule = named(() => import('./components/hr_payroll/PayrollModule'), 'PayrollModule');
const DocumentCenterModule = named(() => import('./components/documents/DocumentCenterModule'), 'DocumentCenterModule');
const ApprovalCenterModule = named(() => import('./components/approvals/ApprovalCenterModule'), 'ApprovalCenterModule');
const NotificationCenterPage = named(() => import('./pages/NotificationCenterPage'), 'NotificationCenterPage');
const ReportsBIModule = named(() => import('./components/reports/ReportsBIModule'), 'ReportsBIModule');
const SettingsPage = named(() => import('./pages/SettingsPage'), 'SettingsPage');

const LoadingView = () => (
  <div className="py-24 text-center space-y-3">
    <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
    <p className="text-sm font-bold text-slate-700">در حال دریافت داده‌های برخط پروژه‌ها و مراکز هزینه...</p>
    <p className="text-xs text-slate-400">همگام‌سازی دفاتر حسابداری، تنخواه‌ها و صورت‌وضعیت‌ها</p>
  </div>
);

/** Route wrappers that pass URL parameters to the module screens. */
const ProjectsRoute: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  return (
    <ProjectsModule
      projects={projects}
      projectId={projectId}
      onOpenProject={(id: string | null) => navigate(id ? `/projects/${id}` : '/projects')}
      onNavigate={(path: string) => navigate(path)}
    />
  );
}

const PartnersRoute: React.FC<{ projects: Project[]; kind: 'clients' | 'subcontractors' | 'suppliers' }> = ({ projects, kind }) => {
  const { counterpartyId } = useParams();
  const navigate = useNavigate();
  return (
    <PartnersModule
      projects={projects}
      kind={kind}
      counterpartyId={counterpartyId}
      onOpenProfile={(id: string | null) => navigate(id ? `/partners/${kind}/${id}` : `/partners/${kind}`)}
      onNavigate={(path: string) => navigate(path)}
    />
  );
}

/** Pages that need a permission render this instead when the signed-in role lacks it. */
const NoAccess: React.FC = () => (
  <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center max-w-lg mx-auto my-12 space-y-3 shadow-sm" role="alert">
    <Lock className="w-10 h-10 text-slate-300 mx-auto" />
    <h3 className="text-sm font-bold text-slate-900">دسترسی به این بخش برای نقش شما تعریف نشده است</h3>
    <p className="text-xs text-slate-500">در صورت نیاز، مدیر سیستم نقش شما را در افزونه پرتال تغییر دهد.</p>
  </div>
);

/** Sections whose writes the installed paydar-portal server already executes (the rest are read-only there). */
const SERVER_BACKED_PATHS = ['/', '/projects', '/finance/accounting', '/ai', '/notifications'];

/** App shell: the session (user, currency, data source) is provided by main.tsx. */
export default function App() {
  const user = useCurrentUser();
  const { session, switchUser, devUsers, sourceLabel, isDemoData } = useSession();
  const { can } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('current_year');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const appState = useAppState();
  const { approve } = useApprovalActions();
  const projects = useMemo(() => selectProjects(appState), [appState]);
  const sidebarCounts = useMemo(() => selectSidebarCounts(appState), [appState]);
  const notifications = useMemo(() => selectNotifications(appState, false, session.user.id), [appState, session.user.id]);
  const approvals = useMemo(() => selectApprovals(appState), [appState]);
  const kpis = useMemo(() => selectKpiItems(appState), [appState]);
  const funds = useMemo(() => selectPettyFunds(appState), [appState]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [pdfTargetProject, setPdfTargetProject] = useState<Project | null>(null);
  const [isAiAgentFloatingOpen, setIsAiAgentFloatingOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [selectedProjectForDashboard, setSelectedProjectForDashboard] = useState<Project | null>(null);
  const [activeApproval, setActiveApproval] = useState<ApprovalItem | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  }, []);
  useToastListener(showToast);

  /** Route element guarded by the nav node's permission. */
  const guarded = (node: NavNode['requires'], element: React.ReactElement) => (!node || can(node) ? element : <NoAccess />);
  const onPosted = (docNumber: string) => showToast(`سند حسابداری ${docNumber} صادر شد.`);

  // Page title comes from navConfig (group › page).
  const trail = navTrail(matchNav(location.pathname));
  const pageTitle =
    trail.length === 0 || trail[0].id === 'dashboard' ? 'مرکز فرماندهی و پایش مالی پروژه‌ها' : trail.map((n) => n.label).join(' › ');

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex text-right font-sans antialiased selection:bg-amber-100 selection:text-amber-900">
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 text-slate-400 hover:text-white mr-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        user={user}
        onOpenLogout={switchUser ? () => setIsLoginOpen(true) : undefined}
        onOpenAiAgent={() => setIsAiAgentFloatingOpen(true)}
        counts={sidebarCounts}
      />

      <div className={`flex-1 transition-all duration-300 flex flex-col min-h-screen ${sidebarCollapsed ? 'mr-20' : 'mr-68'}`}>
        {isDemoData && (
          <div className="bg-amber-400 text-slate-950 text-xs font-bold text-center py-1.5 px-4" role="status">
            نسخه نمایشی — اطلاعات با تازه‌کردن صفحه پاک می‌شود
          </div>
        )}
        <Header
          title={pageTitle}
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
          alerts={notifications}
          onOpenAlertsModal={() => navigate('/notifications')}
          onSwitchUser={switchUser ? () => setIsLoginOpen(true) : undefined}
        />

        {selectedProjectId !== 'all' && (
          <div className="no-print bg-white/80 border-b border-slate-200/80 px-6 py-2 flex items-center justify-end text-[11px] text-slate-500">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded">
              <Filter className="w-3 h-3 text-amber-600" />
              <span>فیلتر فعال روی یک پروژه</span>
              <button onClick={() => setSelectedProjectId('all')} className="font-bold underline text-amber-800 cursor-pointer">
                نمایش تمام پروژه‌ها
              </button>
            </div>
          </div>
        )}

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 max-w-[1600px] w-full mx-auto">
          {!isDemoData && !SERVER_BACKED_PATHS.some((p) => (p === '/' ? location.pathname === '/' : location.pathname.startsWith(p))) && (
            <div className="px-4 py-2.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-900 text-xs font-bold" role="status">
              این بخش در نسخه وردپرس فعلاً فقط‌خواندنی است — ثبت و تأیید به‌زودی (نیازمند پیاده‌سازی در سرور).
            </div>
          )}
          <Suspense fallback={<LoadingView />}>
              <Routes>
                <Route
                  path="/"
                  element={
                    <DashboardPage
                      projects={projects}
                      selectedProjectId={selectedProjectId}
                      timeRange={timeRange}
                      onChangeTimeRange={setTimeRange}
                      onOpenProject={(p) => setSelectedProjectForDashboard(p)}
                      onOpenReport={() => setIsPdfOpen(true)}
                      onViewApproval={(a) => setActiveApproval(a)}
                      onToast={showToast}
                    />
                  }
                />
                <Route path="/projects" element={<ProjectsRoute projects={projects} />} />
                <Route path="/projects/:projectId" element={<ProjectsRoute projects={projects} />} />
                <Route path="/contracts" element={<Navigate to="/contracts/client" replace />} />
                <Route path="/contracts/client" element={<ContractsModule key="client" mode="client" projects={projects} currentUser={user} onPosted={onPosted} onToast={showToast} />} />
                <Route path="/contracts/subcontract" element={<ContractsModule key="sub" mode="subcontractor" projects={projects} currentUser={user} onPosted={onPosted} onToast={showToast} />} />
                <Route path="/statements" element={<Navigate to="/statements/client" replace />} />
                <Route path="/statements/client" element={<ProgressStatementsModule key="client" tab="client_statements" projects={projects} onToast={showToast} />} />
                <Route path="/statements/subcontractor" element={<ProgressStatementsModule key="sub" tab="subcontractor_statements" projects={projects} onToast={showToast} />} />
                <Route path="/procurement" element={<ProcurementModule projects={projects} currentUser={user} onToast={showToast} />} />
                <Route path="/inventory" element={<InventoryModule projects={projects} currentUser={user} />} />
                <Route path="/petty-cash" element={<PettyCashModule projects={projects} currentUser={user} onToast={showToast} />} />
                <Route path="/finance" element={<Navigate to="/finance/accounting" replace />} />
                <Route path="/finance/accounting" element={guarded('journal.create', <AccountingModule currentUser={user} />)} />
                <Route path="/finance/payments" element={guarded('payment_request.create', <PaymentsTreasuryModule key="pay" tab="payment_requests" projects={projects} currentUser={user} onToast={showToast} />)} />
                <Route path="/finance/receipts" element={guarded('receipt.record', <PaymentsTreasuryModule key="rec" tab="receipts" projects={projects} currentUser={user} onToast={showToast} />)} />
                <Route path="/finance/banks" element={guarded('payment.execute', <PaymentsTreasuryModule key="bank" tab="bank_accounts" projects={projects} currentUser={user} onToast={showToast} />)} />
                <Route path="/finance/cash" element={guarded('payment.execute', <PaymentsTreasuryModule key="cash" tab="cash_desks" projects={projects} currentUser={user} onToast={showToast} />)} />
                <Route path="/partners" element={<Navigate to="/partners/clients" replace />} />
                <Route path="/partners/clients" element={<PartnersRoute key="c" projects={projects} kind="clients" />} />
                <Route path="/partners/clients/:counterpartyId" element={<PartnersRoute key="cp" projects={projects} kind="clients" />} />
                <Route path="/partners/subcontractors" element={<PartnersRoute key="s" projects={projects} kind="subcontractors" />} />
                <Route path="/partners/subcontractors/:counterpartyId" element={<PartnersRoute key="sp" projects={projects} kind="subcontractors" />} />
                <Route path="/partners/suppliers" element={<PartnersRoute key="u" projects={projects} kind="suppliers" />} />
                <Route path="/partners/suppliers/:counterpartyId" element={<PartnersRoute key="up" projects={projects} kind="suppliers" />} />
                <Route path="/payroll" element={guarded('payroll.approve', <PayrollModule projects={projects} currentUser={user} onToast={showToast} />)} />
                <Route path="/documents" element={<DocumentCenterModule projects={projects} />} />
                <Route path="/approvals" element={<ApprovalCenterModule onToast={showToast} />} />
                <Route path="/notifications" element={<NotificationCenterPage />} />
                <Route path="/reports" element={<ReportsBIModule projects={projects} />} />
                <Route path="/ai" element={<AiAgentWidget isOpen={true} isFloating={false} />} />
                <Route path="/settings" element={guarded('settings.manage', <SettingsPage onToast={showToast} />)} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
          </Suspense>
        </main>

        <footer className="no-print mt-auto py-4 px-6 border-t border-slate-200 bg-white/60 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            سامانه جامع مدیریت پروژه‌ها و حسابداری پیمانکاری · <strong className="text-slate-700">شرکت سازه گستران پارس</strong>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span>عملیات ← تأیید ← رویداد مالی ← حسابداری</span>
            <span>·</span>
            <span className={isDemoData ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
              {sourceLabel} · واحد پول: {session.currency === 'rial' ? 'ریال' : 'تومان'}
            </span>
          </div>
        </footer>
      </div>

      <ProjectDashboardModal
        project={selectedProjectForDashboard}
        onClose={() => setSelectedProjectForDashboard(null)}
        onPrintProjectPdf={(proj) => {
          setPdfTargetProject(proj);
          setIsPdfOpen(true);
        }}
      />

      <PdfReportModal
        isOpen={isPdfOpen}
        onClose={() => {
          setIsPdfOpen(false);
          setPdfTargetProject(null);
        }}
        projects={projects}
        kpis={kpis}
        pettyFunds={funds}
        statements={appState.clientStatements}
        targetProject={pdfTargetProject}
      />

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        projects={projects}
        approvals={approvals}
        statements={appState.clientStatements}
        pettyFunds={funds}
        onSelectProject={(p) => navigate(`/projects/${p.id}`)}
        onSelectApproval={(a) => setActiveApproval(a)}
        onSelectStatement={() => navigate('/statements/client')}
      />

      <DocumentViewerModal
        item={activeApproval}
        onClose={() => setActiveApproval(null)}
        onApprove={() => {
          if (activeApproval) showToast(approve(activeApproval).message);
          setActiveApproval(null);
        }}
      />

      {isLoginOpen && switchUser && devUsers && (
        <LoginModal
          onClose={() => setIsLoginOpen(false)}
          currentUser={user}
          users={devUsers}
          onSelectUser={(u) => {
            switchUser(u.id);
          }}
        />
      )}

      {isAiAgentFloatingOpen && (
        <AiAgentWidget isOpen={isAiAgentFloatingOpen} onClose={() => setIsAiAgentFloatingOpen(false)} isFloating={true} />
      )}
    </div>
  );
}
