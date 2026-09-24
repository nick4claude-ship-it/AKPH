import React, { useState } from 'react';
import { Project } from '../../types';
import {
  formatCurrencyCompact,
  formatPercent,
  formatNumber,
} from '../../utils/formatters';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'budget' | 'cashflow'>(
    'overview'
  );

  if (!project) return null;

  // Budget Variance (EAC vs Budget)
  const budgetVariance = project.forecastFinalCost - project.budget;
  const isBudgetOverrun = budgetVariance > 0;

  // Breakdown array
  const breakdownList = [
    { label: 'مصالح پایه', amount: project.expenseBreakdown.materials, color: 'bg-amber-500' },
    { label: 'نیروی انسانی', amount: project.expenseBreakdown.labor, color: 'bg-blue-500' },
    { label: 'پیمانکاران جزء', amount: project.expenseBreakdown.subcontractors, color: 'bg-emerald-500' },
    { label: 'ماشین‌آلات', amount: project.expenseBreakdown.machinery, color: 'bg-purple-500' },
    { label: 'حمل‌ونقل', amount: project.expenseBreakdown.transport, color: 'bg-pink-500' },
    { label: 'تجهیزات خاص', amount: project.expenseBreakdown.procurement, color: 'bg-cyan-500' },
    { label: 'اداری کارگاه', amount: project.expenseBreakdown.office, color: 'bg-slate-500' },
    { label: 'بیمه و حوادث', amount: project.expenseBreakdown.insurance, color: 'bg-teal-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                  {project.code}
                </span>
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                  وضعیت: {project.status}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">{project.name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-1.5">
                <span>کارفرما: <strong className="text-white font-medium">{project.client}</strong></span>
                <span>·</span>
                <span>مدیر پروژه: <strong className="text-white font-medium">{project.manager}</strong></span>
                <span>·</span>
                <span>بازه اجرا: {project.startDate} تا {project.expectedEndDate}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrintProjectPdf(project)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>چاپ کارنامه پروژه</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-xs font-medium">
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
            بودجه در برابر هزینه واقعی (EAC)
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
              <span className="text-[11px] text-slate-500 block mb-1">مبلغ قرارداد (ناخالص)</span>
              <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                {formatCurrencyCompact(project.contractAmount)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">ارزش اولیه پیمان</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1">کارکرد تأییدشده (درآمد)</span>
              <span className="text-sm font-bold text-emerald-700 font-mono tabular-nums">
                {formatCurrencyCompact(project.recordedRevenue)}
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">صورت‌وضعیت‌های قطعی</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1">هزینه کل تمام‌شده</span>
              <span className="text-sm font-bold text-slate-800 font-mono tabular-nums">
                {formatCurrencyCompact(project.cost)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">مستقیم و غیرمستقیم</span>
            </div>

            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
              <span className="text-[11px] text-amber-900 block mb-1">سود عملیاتی پروژه</span>
              <span className="text-sm font-extrabold text-amber-700 font-mono tabular-nums">
                {formatCurrencyCompact(project.profit)}
              </span>
              <span className="text-[10px] text-amber-700 block mt-0.5 font-bold">
                حاشیه سود: {formatPercent(project.profitMargin)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1">پیشرفت فیزیکی / مالی</span>
              <div className="flex items-center justify-between text-xs font-bold font-mono text-slate-800">
                <span>فیزیکی: {project.physicalProgress}٪</span>
                <span>مالی: {project.financialProgress}٪</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-1.5 rounded-full"
                  style={{ width: `${project.physicalProgress}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1">مطالبات از کارفرما</span>
              <span className="text-sm font-bold text-rose-600 font-mono tabular-nums">
                {formatCurrencyCompact(project.receivables)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">اسناد وصول‌نشده</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1">بدهی به پیمانکاران/خرید</span>
              <span className="text-sm font-bold text-slate-700 font-mono tabular-nums">
                {formatCurrencyCompact(project.liabilities)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">تعهدات پرداخت جاری</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] text-slate-500 block mb-1">پیش‌بینی هزینه نهایی (EAC)</span>
              <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                {formatCurrencyCompact(project.forecastFinalCost)}
              </span>
              <span
                className={`text-[10px] block mt-0.5 font-bold ${
                  isBudgetOverrun ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {isBudgetOverrun ? 'انحراف نامساعد بودجه' : 'در محدوده بودجه مصوب'}
              </span>
            </div>
          </div>

          {/* Direct Cost vs Indirect Cost Breakdown Principle */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>منطق تفکیک هزینه مستقیم در برابر سربار ستادی</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex justify-between items-center text-slate-600 mb-1">
                  <span>هزینه مستقیم پروژه (Direct Cost):</span>
                  <strong className="text-slate-900">{formatCurrencyCompact(project.directCost)}</strong>
                </div>
                <p className="text-[11px] text-slate-500 font-sans">
                  مستقیماً از درآمد همین پروژه کسر شده و سود ناخالص کارگاهی را تعیین می‌کند.
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex justify-between items-center text-slate-600 mb-1">
                  <span>هزینه غیرمستقیم و سربار (Indirect / Overhead):</span>
                  <strong className="text-slate-900">{formatCurrencyCompact(project.indirectCost)}</strong>
                </div>
                <p className="text-[11px] text-slate-500 font-sans">
                  سهم تخصیص یافته از هزینه‌های ستادی دفتر مرکزی، نرم‌افزارها و پشتیبانی حقوقی.
                </p>
              </div>
            </div>
          </div>

          {/* Cost by Type Bar Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-amber-600" />
              <span>ترکیب سرفصل‌های هزینه این پروژه</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {breakdownList.map((item) => (
                <div
                  key={item.label}
                  className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono"
                >
                  <div className="text-[11px] text-slate-500 mb-1 font-sans">{item.label}</div>
                  <div className="font-bold text-slate-900 tabular-nums">
                    {formatCurrencyCompact(item.amount)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {((item.amount / project.cost) * 100).toFixed(1)}٪ از کل هزینه
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cash Flow Section (Expense != Payment & Revenue != Receipt) */}
          <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200">
            <h4 className="text-xs font-bold text-amber-900 mb-2 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-600" />
              <span>جریان نقدی تحقق‌یافته (Cash Flow vs Incurred Financials)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono text-center">
              <div className="bg-white p-3 rounded-lg border border-amber-200">
                <span className="text-[10px] text-slate-500 block mb-0.5 font-sans">دریافتی نقد قطعی (Receipts)</span>
                <span className="text-emerald-700 font-bold text-sm tabular-nums">
                  {formatCurrencyCompact(project.cashInflow)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">
                  مانده تا درآمد ثبتی: {formatCurrencyCompact(project.recordedRevenue - project.cashInflow)}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-amber-200">
                <span className="text-[10px] text-slate-500 block mb-0.5 font-sans">پرداختی نقد کل (Payments)</span>
                <span className="text-slate-800 font-bold text-sm tabular-nums">
                  {formatCurrencyCompact(project.cashOutflow)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">
                  بدهی باز تأمین‌کنندگان: {formatCurrencyCompact(project.liabilities)}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-amber-200">
                <span className="text-[10px] text-slate-500 block mb-0.5 font-sans">مازاد نقدینگی پروژه</span>
                <span className="text-amber-700 font-black text-sm tabular-nums">
                  {formatCurrencyCompact(project.cashInflow - project.cashOutflow)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">تراز نقدینگی مثبت</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            کد مرجع در دیتابیس مهندسی: <code className="font-mono text-slate-700 font-bold">{project.id}</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            بستن داشبورد
          </button>
        </div>
      </div>
    </div>
  );
};
