import React, { useState } from 'react';
import { Project } from '../../types';
import { formatCurrencyCompact, formatPercent, formatNumber, formatText } from '../../utils/formatters';
import {
  X,
  Building2,
  Calendar,
  User,
  DollarSign,
  TrendingUp,
  PieChart,
  ShieldCheck,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  FileText,
  Printer,
} from 'lucide-react';
import { Dialog } from '../../ui/Dialog';
import { useAppState } from '../../store/AppStore';
import { selectProjects, selectProjectCostBreakdown, selectProjectCashFlow } from '../../store/selectors';
import { Money } from '../common/Money';

interface ProjectDashboardModalProps {
  project: Project | null;
  onClose: () => void;
  onPrintProjectPdf: (project: Project) => void;
}

export const ProjectDashboardModal: React.FC<ProjectDashboardModalProps> = ({
  project,
  onClose,
  onPrintProjectPdf,
}) => {
  const state = useAppState();
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'budget' | 'cashflow'>(
    'overview'
  );

  if (!project) return null;

  // Every financial figure below comes from final ledger entries tagged with this project;
  // manual project summaries (expense breakdown, cash in/out, overhead, EAC) are not used.
  const ledger = selectProjects(state).find((p) => p.id === project.id) ?? project;
  const breakdownList = selectProjectCostBreakdown(state, project.id);
  const cash = selectProjectCashFlow(state, project.id);
  // Budget is a planning figure, shown only next to the ledger cost and never added to it.
  const budgetUsed = project.budget > 0 ? (ledger.cost * 100) / project.budget : 0;
  const isBudgetOverrun = project.budget > 0 && ledger.cost > project.budget;

  return (
    <Dialog onClose={onClose} label="داشبورد پروژه" overlayClassName="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto" className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="tabular-nums text-xs font-bold bg-amber-500 text-slate-950 px-2 py-1 rounded">
                  {formatText(project.code)}
                </span>
                <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
                  وضعیت: {formatText(project.status)}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">{formatText(project.name)}</h2>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300 mt-2">
                <span>کارفرما: <strong className="text-white font-medium">{formatText(project.client)}</strong></span>
                <span>·</span>
                <span>مدیر پروژه: <strong className="text-white font-medium">{formatText(project.manager)}</strong></span>
                <span>·</span>
                <span>بازه اجرا: {formatText(project.startDate)} تا {formatText(project.expectedEndDate)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrintProjectPdf(project)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>چاپ کارنامه پروژه</span>
            </button>

            <button
              onClick={onClose}
              aria-label="بستن"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-sm font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'border-amber-500 text-amber-800 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            دید کلی و شاخص‌های مالی
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'financial'
                ? 'border-amber-500 text-amber-800 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            تفکیک بهای تمام‌شده و مصالح
          </button>
          <button
            onClick={() => setActiveTab('budget')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'budget'
                ? 'border-amber-500 text-amber-800 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            بودجه در برابر هزینه واقعی
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'cashflow'
                ? 'border-amber-500 text-amber-800 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            جریان نقدینگی و مطالبات
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[calc(85vh-180px)] overflow-y-auto space-y-6">
          {/* Key 8 Metric Cards directly required by prompt */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-right">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">مبلغ قرارداد (ناخالص)</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                <Money rial={project.contractAmount} compact />
              </span>
              <span className="text-xs text-slate-500 block mt-1">ارزش اولیه پیمان</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">کارکرد تأییدشده (درآمد)</span>
              <span className="text-sm font-bold text-emerald-700 tabular-nums">
                <Money rial={ledger.recordedRevenue} compact />
              </span>
              <span className="text-sm text-emerald-700 block mt-1">صورت‌وضعیت‌های قطعی</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">هزینه کل تمام‌شده</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                <Money rial={ledger.cost} compact />
              </span>
              <span className="text-xs text-slate-500 block mt-1">هزینه‌های ثبت‌شده در دفاتر</span>
            </div>

            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
              <span className="text-sm text-amber-900 block mb-1">سود عملیاتی پروژه</span>
              <span className="text-sm font-bold text-amber-700 tabular-nums">
                <Money rial={ledger.profit} compact />
              </span>
              <span className="text-sm text-amber-700 block mt-1 font-bold">
                حاشیه سود: {formatPercent(ledger.profitMargin)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">پیشرفت فیزیکی / مالی</span>
              <div className="flex items-center justify-between text-sm font-bold tabular-nums text-slate-800">
                <span>فیزیکی: {formatPercent(project.physicalProgress)}</span>
                <span>مالی: {formatPercent(ledger.financialProgress)}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-1.5 rounded-full"
                  style={{ width: `${project.physicalProgress}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">مطالبات از کارفرما</span>
              <span className="text-sm font-bold text-rose-700 tabular-nums">
                <Money rial={ledger.receivables} compact />
              </span>
              <span className="text-xs text-slate-500 block mt-1">اسناد وصول‌نشده</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">بدهی به پیمانکاران/خرید</span>
              <span className="text-sm font-bold text-slate-700 tabular-nums">
                <Money rial={ledger.liabilities} compact />
              </span>
              <span className="text-xs text-slate-500 block mt-1">تعهدات پرداخت جاری</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">بودجه مصوب (برنامه)</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                <Money rial={project.budget} compact />
              </span>
              <span
                className={`text-sm block mt-1 font-bold ${
                  isBudgetOverrun ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                مصرف‌شده: {formatPercent(budgetUsed)} {isBudgetOverrun ? '(فراتر از بودجه)' : ''}
              </span>
            </div>
          </div>

          {/* Direct cost vs overhead: overhead stays in company accounts and is not allocated to projects */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-700" />
              <span>منطق تفکیک هزینه مستقیم در برابر سربار ستادی</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm tabular-nums">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex justify-between items-center text-slate-600 mb-1">
                  <span>هزینه مستقیم پروژه:</span>
                  <strong className="text-slate-900"><Money rial={ledger.cost} compact /></strong>
                </div>
                <p className="text-xs text-slate-500 font-sans">
                  از ردیف‌های قطعی دفاتر با برچسب همین پروژه؛ سود ناخالص کارگاهی را تعیین می‌کند.
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex justify-between items-center text-slate-600 mb-1">
                  <span>هزینه غیرمستقیم و سربار:</span>
                  <strong className="text-slate-500 font-sans">در سطح شرکت</strong>
                </div>
                <p className="text-xs text-slate-500 font-sans">
                  هزینه‌های ستادی در حساب‌های گروه ۶ ثبت می‌شوند و به سود این پروژه تخصیص داده نمی‌شوند.
                </p>
              </div>
            </div>
          </div>

          {/* Cost by Type Bar Grid */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-700" />
              <span>ترکیب سرفصل‌های هزینه این پروژه</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {breakdownList.length === 0 && (
                <p className="col-span-full text-xs text-slate-500">هنوز هزینه قطعی برای این پروژه در دفاتر ثبت نشده است.</p>
              )}
              {breakdownList.map((item) => (
                <div
                  key={item.accountCode}
                  className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm tabular-nums"
                >
                  <div className="text-xs text-slate-500 mb-1 font-sans">{formatText(item.accountName)}</div>
                  <div className="font-bold text-slate-900 tabular-nums">
                    <Money rial={item.amount} compact />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatPercent(ledger.cost ? (item.amount * 100) / ledger.cost : 0)} از کل هزینه
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cash Flow Section (Expense != Payment & Revenue != Receipt) */}
          <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200">
            <h4 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-700" />
              <span>جریان نقدی تحقق‌یافته</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm tabular-nums text-center">
              <div className="bg-white p-3 rounded-lg border border-amber-200">
                <span className="text-xs text-slate-500 block mb-1 font-sans">دریافتی نقد قطعی</span>
                <span className="text-emerald-700 font-bold text-sm tabular-nums">
                  <Money rial={cash.inflow} compact />
                </span>
                <span className="text-xs text-slate-500 block mt-1 font-sans">
                  مطالبات وصول‌نشده: {formatCurrencyCompact(ledger.receivables)}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-amber-200">
                <span className="text-xs text-slate-500 block mb-1 font-sans">پرداختی نقد کل</span>
                <span className="text-slate-800 font-bold text-sm tabular-nums">
                  <Money rial={cash.outflow} compact />
                </span>
                <span className="text-xs text-slate-500 block mt-1 font-sans">
                  بدهی باز تأمین‌کنندگان: {formatCurrencyCompact(ledger.liabilities)}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-amber-200">
                <span className="text-xs text-slate-500 block mb-1 font-sans">مازاد نقدینگی پروژه</span>
                <span className="text-amber-700 font-bold text-sm tabular-nums">
                  <Money rial={cash.net} compact />
                </span>
                <span className="text-xs text-slate-500 block mt-1 font-sans">{cash.net >= 0 ? 'تراز نقدینگی مثبت' : 'تراز نقدینگی منفی'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            کد مرجع در دیتابیس مهندسی: <code className="tabular-nums text-slate-700 font-bold">{formatText(project.id)}</code>
          </span>
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            بستن داشبورد
          </button>
        </div>
      </Dialog>
  );
};
