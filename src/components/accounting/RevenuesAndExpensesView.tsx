import React, { useState } from 'react';
import {
  TrendingUp,
  Receipt,
  Building2,
  Filter,
  Layers,
  ArrowUpRight,
  PieChart,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { Project, CostCenter } from '../../types';
import { formatCurrency, formatPercent } from '../../utils/formatters';

interface RevenuesAndExpensesViewProps {
  type: 'revenues' | 'expenses';
  projects: Project[];
  costCenters: CostCenter[];
  onOpenNewDocForExpense: () => void;
}

export const RevenuesAndExpensesView: React.FC<RevenuesAndExpensesViewProps> = ({
  type,
  projects,
  costCenters,
  onOpenNewDocForExpense,
}) => {
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const expenseCategories = [
    { name: 'مصالح مصرفی (میلگرد، بتن، سیمان)', amount: 138_000_000_000, percent: 40.5, type: 'مستقیم پروژه' },
    { name: 'دستمزد و نیروی انسانی اجرایی کارگاه', amount: 52_400_000_000, percent: 15.4, type: 'مستقیم پروژه' },
    { name: 'پیمانکاران جزء و اکیپ‌های تخصصی', amount: 41_200_000_000, percent: 12.1, type: 'مستقیم پروژه' },
    { name: 'ماشین‌آلات و تجهیزات سنگین کارگاهی', amount: 28_600_000_000, percent: 8.4, type: 'مستقیم پروژه' },
    { name: 'حمل‌ونقل، باربری و تخلیه مصالح', amount: 19_500_000_000, percent: 5.7, type: 'مستقیم پروژه' },
    { name: 'سوخت، روغن و روانکارها', amount: 9_200_000_000, percent: 2.7, type: 'مستقیم پروژه' },
    { name: 'تعمیرات و نگهداری اضطراری کارگاه', amount: 6_800_000_000, percent: 2.0, type: 'مستقیم پروژه' },
    { name: 'حقوق و مزایای ستاد مرکزی و مهندسی', amount: 22_500_000_000, percent: 6.6, type: 'سربار دفتر مرکزی' },
    { name: 'اجاره، ملزومات و قبوض دفتر مرکزی', amount: 6_800_000_000, percent: 2.0, type: 'سربار دفتر مرکزی' },
    { name: 'هزینه‌های حقوقی، مشاوره و حسابرسی', amount: 4_600_000_000, percent: 1.4, type: 'سربار دفتر مرکزی' },
    { name: 'کارمزد ضمانت‌نامه‌ها و هزینه‌های مالی', amount: 6_500_000_000, percent: 1.9, type: 'سربار دفتر مرکزی' },
    { name: 'بیمه پرسنل و مسئولیت مدنی ستادی', amount: 4_200_000_000, percent: 1.3, type: 'سربار دفتر مرکزی' },
  ];

  const totalDirectCosts = 295_700_000_000;
  const totalIndirectCosts = 44_600_000_000;
  const totalExpenses = totalDirectCosts + totalIndirectCosts;

  const revenueItems = [
    {
      project: 'برج تجاری رونیکا',
      client: 'سرمایه‌گذاری تابان مسکن',
      contractRevenue: 138_000_000_000,
      adjustmentRevenue: 8_200_000_000,
      totalRevenue: 146_200_000_000,
      receivedCash: 109_600_000_000,
      receivables: 36_600_000_000,
    },
    {
      project: 'تقاطع بزرگراه فجر',
      client: 'شهرداری شیراز',
      contractRevenue: 84_500_000_000,
      adjustmentRevenue: 6_500_000_000,
      totalRevenue: 91_000_000_000,
      receivedCash: 64_900_000_000,
      receivables: 26_100_000_000,
    },
    {
      project: 'بیمارستان تخصصی البرز',
      client: 'دانشگاه علوم پزشکی البرز',
      contractRevenue: 58_000_000_000,
      adjustmentRevenue: 4_800_000_000,
      totalRevenue: 62_800_000_000,
      receivedCash: 27_000_000_000,
      receivables: 35_800_000_000,
    },
    {
      project: 'مجتمع مسکونی نیلوفر',
      client: 'تعاونی مسکن پزشکان',
      contractRevenue: 49_200_000_000,
      adjustmentRevenue: 1_200_000_000,
      totalRevenue: 50_400_000_000,
      receivedCash: 40_400_000_000,
      receivables: 10_000_000_000,
    },
    {
      project: 'خط لوله انتقال گاز عسلویه',
      client: 'شرکت مهندسی و توسعه گاز',
      contractRevenue: 18_000_000_000,
      adjustmentRevenue: 1_800_000_000,
      totalRevenue: 19_800_000_000,
      receivedCash: 8_200_000_000,
      receivables: 11_600_000_000,
    },
  ];

  const totalContractRevenue = revenueItems.reduce((s, r) => s + r.contractRevenue, 0);
  const totalAdjustmentRevenue = revenueItems.reduce((s, r) => s + r.adjustmentRevenue, 0);
  const grandTotalRevenue = totalContractRevenue + totalAdjustmentRevenue;

  if (type === 'revenues') {
    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        {/* Banner with Architectural Accounting Principle */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              <strong>اصل تمایز تعهدی:</strong> درآمد شناسایی‌شده بر مبنای کارکرد تاییدشده صورت‌وضعیت‌ها (Revenue)
              با مبالغ وصول‌شده نقدی کارفرما (Receipt) کاملاً مجزا ثبت می‌شود.
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-700 font-bold shrink-0">
            Revenue ≠ Receipt
          </span>
        </div>

        {/* Revenue Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">درآمد کارکرد پیمانکاری</span>
            <strong className="text-base text-slate-900">{formatCurrency(totalContractRevenue)} تومان</strong>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">درآمد تعدیل نرخ و مصالح</span>
            <strong className="text-base text-blue-700">{formatCurrency(totalAdjustmentRevenue)} تومان</strong>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">مجموع کل درآمد شناسایی‌شده</span>
            <strong className="text-base text-emerald-700">{formatCurrency(grandTotalRevenue)} تومان</strong>
          </div>
        </div>

        {/* Revenue by Project Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800">
              جدول کارکرد، تعدیل و وصولی‌های پروژه‌های عمرانی:
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">پروژه عمرانی</th>
                  <th className="py-3 px-3">کارفرما</th>
                  <th className="py-3 px-3 font-mono text-left">کارکرد پیمان (تومان)</th>
                  <th className="py-3 px-3 font-mono text-left">تعدیل آحاد بها</th>
                  <th className="py-3 px-3 font-mono text-left text-emerald-800">کل درآمد تعهدی</th>
                  <th className="py-3 px-3 font-mono text-left text-blue-800">وصول نقدی</th>
                  <th className="py-3 px-4 font-mono text-left text-rose-800">مانده مطالبه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {revenueItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{item.project}</td>
                    <td className="py-3 px-3 font-sans text-slate-600">{item.client}</td>
                    <td className="py-3 px-3 text-left tabular-nums">{formatCurrency(item.contractRevenue)}</td>
                    <td className="py-3 px-3 text-left tabular-nums text-slate-600">{formatCurrency(item.adjustmentRevenue)}</td>
                    <td className="py-3 px-3 text-left tabular-nums font-bold text-emerald-700">{formatCurrency(item.totalRevenue)}</td>
                    <td className="py-3 px-3 text-left tabular-nums font-bold text-blue-700">{formatCurrency(item.receivedCash)}</td>
                    <td className="py-3 px-4 text-left tabular-nums font-bold text-rose-700">{formatCurrency(item.receivables)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // EXPENSES VIEW
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Banner with Architectural Accounting Principle */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-medium">
            <strong>تفکیک بهای تمام‌شده و هزینه‌های دوره:</strong> هزینه‌های مستقیم پروژه‌ها (Direct Costs)
            به‌صورت منفک از هزینه‌های ستادی و تشکیلاتی دفتر مرکزی (Company Overhead) در سرفصل‌های ۵ و ۶ کدینگ طبقه‌بندی می‌شوند.
          </span>
        </div>
        <button
          onClick={onOpenNewDocForExpense}
          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shrink-0"
        >
          ثبت سند هزینه
        </button>
      </div>

      {/* Expense Allocation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-sans text-slate-500 block mb-1">
            هزینه‌های مستقیم کارگاهی (Direct Costs)
          </span>
          <strong className="text-base text-slate-900">{formatCurrency(totalDirectCosts)} تومان</strong>
          <span className="text-[10px] font-sans text-slate-400 block mt-1">۸۶.۹٪ از کل هزینه‌های شرکت</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-sans text-slate-500 block mb-1">
            هزینه‌های سربار، عمومی و اداری (Overhead)
          </span>
          <strong className="text-base text-slate-800">{formatCurrency(totalIndirectCosts)} تومان</strong>
          <span className="text-[10px] font-sans text-slate-400 block mt-1">۱۳.۱٪ از کل هزینه‌های شرکت</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-sans text-slate-500 block mb-1">
            مجموع کل هزینه‌های تحقق‌یافته دوره
          </span>
          <strong className="text-base text-rose-700">{formatCurrency(totalExpenses)} تومان</strong>
          <span className="text-[10px] font-sans text-emerald-600 font-bold block mt-1">در محدوده بودجه مصوب</span>
        </div>
      </div>

      {/* Expense Breakdown Categories Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800">
            ریز سرفصل‌های هزینه‌ای شرکت پیمانکاری و سهم هر بخش:
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">عنوان سرفصل هزینه</th>
                <th className="py-2.5 px-3">طبقه‌بندی ساختاری</th>
                <th className="py-2.5 px-3 font-mono text-left">مبلغ هزینه (تومان)</th>
                <th className="py-2.5 px-3 font-mono text-left">درصد از کل هزینه</th>
                <th className="py-2.5 px-4">وضعیت در بودجه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {expenseCategories.map((cat, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-sans font-medium text-slate-900">{cat.name}</td>
                  <td className="py-2.5 px-3 font-sans">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        cat.type.includes('مستقیم')
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {cat.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-left tabular-nums font-bold text-slate-900">
                    {formatCurrency(cat.amount)}
                  </td>
                  <td className="py-2.5 px-3 text-left tabular-nums text-slate-600">
                    {formatPercent(cat.percent)}
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-500 text-[11px]">
                    <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full"
                        style={{ width: `${cat.percent * 2}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
