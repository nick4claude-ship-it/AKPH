import React, { useState } from 'react';
import {
  Search,
  Bell,
  Calendar,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Printer,
  Sparkles,
} from 'lucide-react';
import { Project, TimeRange, UserProfile, ManagementAlert } from '../../types';
import {
  getCurrentFiscalYear,
  getFormattedCurrentPersianDate,
  getCurrentPersianMonthName,
} from '../../utils/date';

interface HeaderProps {
  title: string;
  subtitle?: string;
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  timeRange: TimeRange;
  onChangeTimeRange: (range: TimeRange) => void;
  onOpenSearch: () => void;
  onOpenPdfReport: () => void;
  onOpenAiAgent: () => void;
  user: UserProfile;
  alerts: ManagementAlert[];
  onOpenAlertsModal: () => void;
  onSwitchUser: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  projects,
  selectedProjectId,
  onSelectProject,
  timeRange,
  onChangeTimeRange,
  onOpenSearch,
  onOpenPdfReport,
  onOpenAiAgent,
  user,
  alerts,
  onOpenAlertsModal,
  onSwitchUser,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const currentFiscalYear = getCurrentFiscalYear();
  const currentMonthName = getCurrentPersianMonthName();

  const timeRangeLabels: Record<TimeRange, string> = {
    this_month: `این ماه (${currentMonthName})`,
    last_3_months: '۳ ماه اخیر',
    last_6_months: '۶ ماه اخیر',
    current_year: `سال جاری (${currentFiscalYear})`,
    custom: 'بازه سفارشی',
  };

  const criticalCount = alerts.filter((a) => a.priority === 'critical').length;

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Zone 1: Title, Subtitle, & Persian Date */}
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium border border-slate-200/80">
            <Calendar className="w-3 h-3 text-slate-400" />
            {getFormattedCurrentPersianDate()}
          </span>
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      {/* Zone 2: Filters & Global Search */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Project Selector Filter */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 transition-colors">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedProjectId}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-transparent border-none text-xs text-slate-800 font-medium focus:outline-none cursor-pointer pr-1 pl-4"
            >
              <option value="all">تمام پروژه‌ها (۵ پروژه فعال)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="relative">
          <select
            value={timeRange}
            onChange={(e) => onChangeTimeRange(e.target.value as TimeRange)}
            className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none cursor-pointer"
          >
            <option value="this_month">{timeRangeLabels.this_month}</option>
            <option value="last_3_months">{timeRangeLabels.last_3_months}</option>
            <option value="last_6_months">{timeRangeLabels.last_6_months}</option>
            <option value="current_year">{timeRangeLabels.current_year}</option>
            <option value="custom">{timeRangeLabels.custom}</option>
          </select>
        </div>

        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-700 px-3.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
          title="جستجوی پروژه، فاکتور، سند، تأمین‌کننده، صورت‌وضعیت"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline text-slate-600 font-normal">جستجوی سراسری...</span>
          <kbd className="hidden lg:inline text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-400 font-mono shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Zone 3: Actions & Notifications */}
      <div className="flex items-center gap-2.5">
        {/* AI Agent Quick Icon Button */}
        <button
          onClick={onOpenAiAgent}
          className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden sm:inline">دستیار هوشمند</span>
        </button>

        {/* Export PDF Button */}
        <button
          onClick={onOpenPdfReport}
          className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-xs"
        >
          <Printer className="w-3.5 h-3.5 text-amber-400" />
          <span>دریافت PDF</span>
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="اعلان‌ها و هشدارهای سیستم"
          >
            <Bell className="w-4 h-4" />
            {criticalCount > 0 && (
              <span className="absolute top-1 left-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                <span className="text-xs font-bold text-slate-800">هشدارهای مدیریتی</span>
                <span className="text-[11px] text-amber-600 font-medium">
                  {alerts.length} مورد فعال
                </span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {alerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => {
                      setShowNotifications(false);
                      onOpenAlertsModal();
                    }}
                    className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-right border border-slate-100"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      {alert.priority === 'critical' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate">{alert.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">
                      {alert.description}
                    </p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowNotifications(false);
                  onOpenAlertsModal();
                }}
                className="w-full text-center text-xs font-medium text-amber-600 hover:text-amber-700 pt-2 border-t border-slate-100 mt-2 block cursor-pointer"
              >
                مشاهده همه هشدارها
              </button>
            </div>
          )}
        </div>

        {/* User Role Switcher */}
        <button
          onClick={onSwitchUser}
          className="flex items-center gap-2 p-1 pl-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
          title="تغییر نقش کاربری برای آزمودن دسترسی‌ها"
        >
          <img
            src={user.avatar}
            alt={user.name}
            className="w-7 h-7 rounded-full object-cover border border-slate-200"
          />
          <div className="text-right hidden xl:block">
            <p className="text-xs font-bold text-slate-800 leading-tight">{user.name}</p>
            <p className="text-[10px] text-slate-500">{user.role}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </header>
  );
};
