/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Sidebar, PRODUCT_TITLE } from './Sidebar';
import { Header } from './Header';
import { ProjectDashboardModal } from '../project/ProjectDashboardModal';
import { PdfReportModal } from '../reports/PdfReportModal';
import { GlobalSearchModal } from '../search/GlobalSearchModal';
import { DocumentViewerModal } from '../common/DocumentViewerModal';
import { LoginModal } from '../auth/LoginModal';
import { AiAgentWidget } from '../dashboard/AiAgentWidget';
import { useAppState } from '../../store/AppStore';
import { useCompany, useCurrentUser, useDemoBanner, usePermission, useReadOnlyNotice, useSession } from '../../store/session';
import { useToastListener } from '../../store/toast';
import { useApprovalActions } from '../../store/useApprovalActions';
import { selectProjects, selectKpiItems } from '../../store/selectors';
import { selectApprovals, selectNotifications, selectPettyFunds, selectSidebarCounts } from '../../store/domainSelectors';
import { matchNav, navTrail, NavNode } from '../../navigation/navConfig';
import { ApprovalItem, Project, TimeRange } from '../../types';
import { CheckCircle2, Filter, X, Lock } from 'lucide-react';
import { PageSkeleton } from '../common/Skeleton';
import { ErrorBoundary } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import { formatText } from '../../utils/formatters';

/** Lazily loaded module screens (one chunk per module). */
function named<M, K extends keyof M>(loader: () => Promise<M>, key: K) {
  type C = M[K] extends React.ComponentType<infer P> ? React.ComponentType<P> : never;
  return lazy(() => loader().then((m) => ({ default: m[key] as unknown as C })));
}

const DashboardPage = lazy(() => import('../../pages/DashboardPage'));
const ProjectsModule = named(() => import('../project/ProjectsModule'), 'ProjectsModule');
const ContractsModule = named(() => import('../contracts/ContractsModule'), 'ContractsModule');
const ProgressStatementsModule = named(() => import('../statements/ProgressStatementsModule'), 'ProgressStatementsModule');
const ProcurementModule = named(() => import('../procurement/ProcurementModule'), 'ProcurementModule');
const InventoryModule = named(() => import('../inventory/InventoryModule'), 'InventoryModule');
const PettyCashModule = named(() => import('../petty_cash/PettyCashModule'), 'PettyCashModule');
const AccountingModule = named(() => import('../accounting/AccountingModule'), 'AccountingModule');
const PaymentsTreasuryModule = named(() => import('../finance/PaymentsTreasuryModule'), 'PaymentsTreasuryModule');
const PartnersModule = named(() => import('../partners/PartnersModule'), 'PartnersModule');
const PayrollModule = named(() => import('../hr_payroll/PayrollModule'), 'PayrollModule');
const DocumentCenterModule = named(() => import('../documents/DocumentCenterModule'), 'DocumentCenterModule');
const ApprovalCenterModule = named(() => import('../approvals/ApprovalCenterModule'), 'ApprovalCenterModule');
const NotificationCenterPage = named(() => import('../../pages/NotificationCenterPage'), 'NotificationCenterPage');
const ReportsBIModule = named(() => import('../reports/ReportsBIModule'), 'ReportsBIModule');
const SettingsPage = named(() => import('../../pages/SettingsPage'), 'SettingsPage');

const LoadingView = () => <PageSkeleton label="در حال بارگذاری صفحه…" />;

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
  <div className="card max-w-lg mx-auto my-12" role="alert">
    <EmptyState icon={Lock} title="دسترسی به این بخش برای نقش شما تعریف نشده است" description="در صورت نیاز، مدیر سیستم نقش شما را در افزونه پرتال تغییر دهد." />
  </div>
);

/** App shell: layout, routes and app-wide dialogs. The session (user, currency, data source) is provided by main.tsx. */
export default function AppShell() {
  const user = useCurrentUser();
  const company = useCompany();
  const demoBanner = useDemoBanner();
  const { session, switchUser, devUsers, isDemoData } = useSession();
  const { can } = usePermission();
  const location = useLocation();
  const readOnlyNotice = useReadOnlyNotice(location.pathname);
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
  const pageTitle = trail.length === 0 ? 'داشبورد مدیریتی' : trail.map((n) => n.label).join(' › ');
  useEffect(() => {
    document.title = `${pageTitle} | ${PRODUCT_TITLE}`;
  }, [pageTitle]);
  // The navigation drawer closes when the page changes.
  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-canvas text-ink text-right">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-50 btn btn-primary">
        پرش به محتوای اصلی
      </a>
      {toastMessage && (
        <div role="status" aria-live="polite" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] bg-ink text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} aria-label="بستن پیام" className="btn btn-icon text-slate-300 hover:text-white hover:bg-white/10 -my-2 -ml-2">
            <X className="w-4 h-4" />
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
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className={`min-w-0 flex flex-col min-h-screen transition-[margin] duration-200 ${sidebarCollapsed ? 'lg:mr-20' : 'lg:mr-68'}`}>
        {demoBanner && (
          <div className="no-print bg-amber-300 text-slate-950 text-xs font-medium text-center py-1 px-4" role="status">
            {demoBanner}
          </div>
        )}
        <Header
          title={pageTitle}
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
          onOpenMenu={() => setMobileNavOpen(true)}
            user={user}
          alerts={notifications}
          onOpenAlertsModal={() => navigate('/notifications')}
          onSwitchUser={switchUser ? () => setIsLoginOpen(true) : undefined}
          demo={isDemoData}
        />

        {selectedProjectId !== 'all' && (
          <div className="no-print px-4 sm:px-6 lg:px-8 pt-4">
            <div className="flex flex-wrap items-center gap-2 bg-brand-soft border border-amber-200 text-warning px-3 py-2 rounded-lg text-sm">
              <Filter className="w-4 h-4" />
              <span>فیلتر فعال: فقط یک پروژه نمایش داده می‌شود.</span>
              <button type="button" onClick={() => setSelectedProjectId('all')} className="font-bold underline cursor-pointer">
                نمایش همه پروژه‌ها
              </button>
            </div>
          </div>
        )}

        <main id="main-content" tabIndex={-1} className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 w-full max-w-screen-2xl mx-auto min-w-0 outline-none">
          {readOnlyNotice && (
            <div className="px-4 py-3 rounded-lg border border-sky-200 bg-info-soft text-info text-sm font-medium" role="status">
              {readOnlyNotice}
            </div>
          )}
          <ErrorBoundary resetKey={location.pathname}>
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
          </ErrorBoundary>
        </main>

        <footer className="no-print mt-auto py-4 px-4 sm:px-6 lg:px-8 border-t border-line bg-surface text-xs text-ink-subtle flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {PRODUCT_TITLE} · <strong className="font-medium text-ink-muted">{formatText(company.name)}</strong>
          </span>
          <span>واحد نمایش مبالغ: {session.currency === 'rial' ? 'ریال' : 'تومان'}</span>
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
