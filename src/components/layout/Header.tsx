import React, { useEffect, useRef, useState } from 'react';
import { Search, Bell, Calendar, CheckCircle2, AlertTriangle, ChevronDown, Printer, Sparkles, Menu, UserRound } from 'lucide-react';
import { Project, TimeRange, UserProfile, ManagementAlert } from '../../types';
import { getCurrentFiscalYear, getFormattedCurrentPersianDate, getCurrentPersianMonthName } from '../../utils/date';
import { formatInt } from '../../utils/money';
import { formatCode, toPersianDigits, formatText } from '../../utils/formatters';

interface HeaderProps {
  title: string;
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  timeRange: TimeRange;
  onChangeTimeRange: (range: TimeRange) => void;
  onOpenSearch: () => void;
  onOpenPdfReport: () => void;
  onOpenAiAgent: () => void;
  /** Opens the navigation drawer (below the large breakpoint, where the sidebar is hidden). */
  onOpenMenu: () => void;
  /** Opens the signed-in user's account page. */
  onOpenAccount?: () => void;
  user: UserProfile;
  alerts: ManagementAlert[];
  onOpenAlertsModal: () => void;
  /** DEV only: opens the role switcher. */
  onSwitchUser?: () => void;
  /** Shows «نمایشی» next to the assistant while sample data is loaded. */
  demo?: boolean;
}

/** Closes a popover on Escape and on a click outside it. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, close]);
  return ref;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  projects,
  selectedProjectId,
  onSelectProject,
  timeRange,
  onChangeTimeRange,
  onOpenSearch,
  onOpenPdfReport,
  onOpenAiAgent,
  onOpenMenu,
  onOpenAccount,
  user,
  alerts,
  onOpenAlertsModal,
  onSwitchUser,
  demo = false,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notificationsRef = useDismiss(showNotifications, () => setShowNotifications(false));
  const userMenuRef = useDismiss(showUserMenu, () => setShowUserMenu(false));

  const timeRangeLabels: Record<TimeRange, string> = {
    this_month: `این ماه (${getCurrentPersianMonthName()})`,
    last_3_months: '۳ ماه اخیر',
    last_6_months: '۶ ماه اخیر',
    current_year: `سال جاری (${toPersianDigits(getCurrentFiscalYear())})`,
    custom: 'بازه سفارشی',
  };
  const criticalCount = alerts.filter((a) => a.priority === 'critical').length;
  const selectClass = 'h-10 rounded-lg border border-slate-300 bg-surface px-3 text-sm text-ink cursor-pointer hover:border-slate-400 min-w-0';

  return (
    <header className="no-print sticky top-0 z-20 bg-surface/95 backdrop-blur border-b border-line">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
        <button type="button" onClick={onOpenMenu} aria-label="باز کردن منو" className="btn btn-ghost btn-icon lg:hidden -mr-2">
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 min-w-0 flex-1">
          <h1 className="text-lg font-bold text-ink truncate">{title}</h1>
          <span className="hidden md:inline-flex items-center gap-1 text-xs text-ink-subtle bg-canvas px-2 py-1 rounded-md whitespace-nowrap">
            <Calendar className="w-4 h-4" />
            {getFormattedCurrentPersianDate()}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button type="button" onClick={onOpenSearch} className="btn btn-ghost max-md:btn-icon" aria-label="جستجوی سراسری" title="جستجوی پروژه، فاکتور، سند، تأمین‌کننده و صورت‌وضعیت">
            <Search className="w-5 h-5" />
            <span className="hidden md:inline">جستجو</span>
          </button>

          <button type="button" onClick={onOpenAiAgent} className="btn btn-ghost max-sm:btn-icon text-brand-strong" aria-label="دستیار مدیریت">
            <Sparkles className="w-5 h-5" />
            <span className="hidden sm:inline">دستیار</span>
            {demo && <span className="hidden sm:inline px-2 rounded-full bg-brand-soft text-xs text-warning">نمایشی</span>}
          </button>

          <button type="button" onClick={onOpenPdfReport} className="btn btn-secondary max-sm:hidden">
            <Printer className="w-5 h-5" />
            <span>چاپ گزارش</span>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label={criticalCount ? `اعلان‌ها — ${formatInt(criticalCount)} مورد بحرانی` : 'اعلان‌ها'}
              aria-expanded={showNotifications}
              className="btn btn-ghost btn-icon relative"
            >
              <Bell className="w-5 h-5" />
              {criticalCount > 0 && <span className="absolute top-2 left-2 w-2 h-2 bg-danger rounded-full ring-2 ring-surface" aria-hidden="true" />}
            </button>
            {showNotifications && (
              <div className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] card shadow-lg p-3 z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
                  <span className="text-sm font-bold text-ink">هشدارهای مدیریتی</span>
                  <span className="text-xs text-ink-subtle">{formatInt(alerts.length)} مورد فعال</span>
                </div>
                {alerts.length === 0 ? (
                  <p className="text-sm text-ink-subtle py-4 text-center">هشدار فعالی وجود ندارد.</p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto">
                    {alerts.slice(0, 4).map((alert) => (
                      <li key={alert.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotifications(false);
                            onOpenAlertsModal();
                          }}
                          className="w-full p-2 rounded-lg bg-surface-muted hover:bg-canvas text-right cursor-pointer"
                        >
                          <span className="flex items-center gap-2 text-sm font-medium text-ink">
                            {alert.priority === 'critical' ? <AlertTriangle className="w-4 h-4 text-danger shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-warning shrink-0" />}
                            <span className="truncate">{formatCode(alert.title)}</span>
                          </span>
                          <span className="block text-xs text-ink-subtle line-clamp-1 mt-1">{formatCode(alert.description)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    onOpenAlertsModal();
                  }}
                  className="w-full mt-2 pt-2 border-t border-line text-sm font-medium text-brand-strong hover:underline cursor-pointer"
                >
                  مشاهده همه هشدارها
                </button>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
              aria-label={`حساب کاربری ${user.name}`}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-canvas cursor-pointer"
            >
              <span className="w-9 h-9 rounded-full overflow-hidden bg-canvas border border-line shrink-0 flex items-center justify-center">
                {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <UserRound className="w-5 h-5 text-ink-subtle" />}
              </span>
              <span className="hidden xl:block text-right leading-tight">
                <span className="block text-sm font-bold text-ink">{formatText(user.name)}</span>
                <span className="block text-xs text-ink-subtle">{formatText(user.role)}</span>
              </span>
              <ChevronDown className="w-4 h-4 text-ink-subtle hidden sm:block" />
            </button>
            {showUserMenu && (
              <div role="menu" className="absolute left-0 mt-2 w-60 card shadow-lg p-2 z-50">
                <div className="px-2 py-2 border-b border-line mb-1">
                  <p className="text-sm font-bold text-ink truncate">{formatText(user.name)}</p>
                  <p className="text-xs text-ink-subtle truncate">{formatText(user.role)}</p>
                </div>
                {onOpenAccount && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenAccount();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-ink hover:bg-canvas text-right cursor-pointer"
                  >
                    <UserRound className="w-4 h-4 text-ink-subtle" />
                    حساب کاربری من
                  </button>
                )}
                {onSwitchUser && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowUserMenu(false);
                      onSwitchUser();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-ink hover:bg-canvas text-right cursor-pointer"
                  >
                    تغییر نقش (فقط محیط توسعه)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 pb-3">
        <label className="sr-only" htmlFor="header-project-filter">
          پروژه
        </label>
        <select id="header-project-filter" value={selectedProjectId} onChange={(e) => onSelectProject(e.target.value)} className={`${selectClass} flex-1 sm:flex-none sm:w-72`}>
          <option value="all">همه پروژه‌ها ({formatInt(projects.length)} پروژه)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {formatCode(p.code)} - {formatText(p.name)}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="header-time-range">
          بازه زمانی
        </label>
        <select id="header-time-range" value={timeRange} onChange={(e) => onChangeTimeRange(e.target.value as TimeRange)} className={`${selectClass} flex-1 sm:flex-none sm:w-48`}>
          {(Object.keys(timeRangeLabels) as TimeRange[]).map((r) => (
            <option key={r} value={r}>
              {timeRangeLabels[r]}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
};
