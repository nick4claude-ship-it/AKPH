/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  PieChart,
  FileSpreadsheet,
  Printer,
  Calendar,
  Layers,
  Building2,
  HardHat,
  Truck,
  DollarSign,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Project } from '../../types';
import { formatNumber, formatCurrencyCompact } from '../../utils/formatters';

interface ReportsBIModuleProps {
  projects: Project[];
}

export const ReportsBIModule: React.FC<ReportsBIModuleProps> = ({ projects }) => {
  const [activeTab, setActiveTab] = useState<'financial_summary' | 'projects_variance' | 'receivables_aging' | 'cost_centers'>('financial_summary');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  // Aggregates
  const totalContractRevenue = projects.reduce((acc, p) => acc + p.contractAmount, 0);
  const totalApprovedRevenue = projects.reduce((acc, p) => acc + p.recordedRevenue, 0);
  const totalActualCost = projects.reduce((acc, p) => acc + p.actualCost, 0);
  const totalGrossProfit = totalApprovedRevenue - totalActualCost;
  const averageMargin = (totalGrossProfit / (totalApprovedRevenue || 1)) * 100;

  const totalReceivables = projects.reduce((acc, p) => acc + p.receivables, 0);
  const totalLiabilities = projects.reduce((acc, p) => acc + p.liabilities, 0);

  // Receivables aging mock breakdown
  const agingBuckets = [
    { label: 'کمتر از ۳۰ روز (جاری)', amount: Math.round(totalReceivables * 0.45), percentage: 45, color: 'bg-emerald-500' },
    { label: '۳۰ تا ۶۰ روز', amount: Math.round(totalReceivables * 0.28), percentage: 28, color: 'bg-blue-500' },
    { label: '۶۰ تا ۹۰ روز (نیازمند پیگیری)', amount: Math.round(totalReceivables * 0.17), percentage: 17, color: 'bg-amber-500' },
    { label: 'بیش از ۹۰ روز (مطالبات معوق/ریسک)', amount: Math.round(totalReceivables * 0.10), percentage: 10, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">
              سامانه هوش تجاری و گزارشات مدیریتی (BI & Management Reporting)
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              تحلیل سودآوری، جریان نقدینگی و انحراف پروژه‌ها
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            داشبورد تحلیلی عملکرد مالی، سنی مطالبات، مقایسه بودجه و پیش‌بینی سود
          </h2>
          <p className="text-xs text-slate-500">
            گزارش سود و زیان تجمیعی، انحراف فیزیکی و مالی، سن بدهی‌ها و بهای تمام‌شده بر اساس استانداردهای پیمانکاری
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>چاپ گزارش (PDF)</span>
          </button>
          <button
            onClick={() => alert('خروجی اکسل گزارش مدیریتی با موفقیت دانلود شد.')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>خروجی اکسل (Excel)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">درآمد کارکرد محقق شده</span>
          <div className="text-lg font-bold text-slate-900 font-mono">
            {formatNumber(totalApprovedRevenue)}{' '}
            <span className="text-xs text-slate-500 font-sans">تومان</span>
          </div>
          <span className="text-[11px] text-blue-600 font-medium">صورت‌وضعیت‌های تایید شده کارفرما</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">بهای تمام‌شده واقعی پروژه‌ها</span>
          <div className="text-lg font-bold text-slate-900 font-mono">
            {formatNumber(totalActualCost)}{' '}
            <span className="text-xs text-slate-500 font-sans">تومان</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">مصالح + دستمزد + ماشین‌آلات + سربار</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">سود ناخالص عملیاتی شرکت</span>
          <div className="text-lg font-bold text-emerald-700 font-mono">
            {formatNumber(totalGrossProfit)}{' '}
            <span className="text-xs text-slate-500 font-sans">تومان</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">حاشیه سود میانگین: {averageMargin.toFixed(1)}٪</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">خالص مطالبات منهای بدهی‌ها</span>
          <div className="text-lg font-bold text-indigo-700 font-mono">
            {formatNumber(totalReceivables - totalLiabilities)}{' '}
            <span className="text-xs text-slate-500 font-sans">تومان</span>
          </div>
          <span className="text-[11px] text-indigo-600 font-medium">شاخص سلامت نقدینگی و جریان وجوه</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        <button
          onClick={() => setActiveTab('financial_summary')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'financial_summary'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
          <span>صورت سود و زیان و عملکرد پروژه‌ها</span>
        </button>

        <button
          onClick={() => setActiveTab('projects_variance')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'projects_variance'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
          <span>انحراف بودجه و پیشرفت فیزیکی در برابر مالی</span>
        </button>

        <button
          onClick={() => setActiveTab('receivables_aging')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'receivables_aging'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <PieChart className="w-3.5 h-3.5 text-purple-400" />
          <span>تحلیل سنی مطالبات از کارفرمایان (Aging)</span>
        </button>
      </div>

      {/* View 1: P&L Statement */}
      {activeTab === 'financial_summary' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">
              جدول سود و زیان و عملکرد تفکیکی پروژه‌ها (P&L Breakdown)
            </h3>
            <span className="text-xs text-slate-500 font-mono">واحد مبالغ: میلیون تومان</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">کد و نام پروژه</th>
                  <th className="py-3 px-3">کارفرما</th>
                  <th className="py-3 px-3 text-left">مبلغ کل پیمان</th>
                  <th className="py-3 px-3 text-left">کارکرد مصوب (درآمد)</th>
                  <th className="py-3 px-3 text-left">بهای تمام شده (هزینه)</th>
                  <th className="py-3 px-3 text-left">سود ناخالص</th>
                  <th className="py-3 px-3 text-center">حاشیه سود</th>
                  <th className="py-3 px-3 text-left">مطالبات جاری</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {projects.map((p) => {
                  const profit = p.recordedRevenue - p.actualCost;
                  const margin = (profit / (p.recordedRevenue || 1)) * 100;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-sans">
                        <strong className="block text-slate-900">{p.name}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">{p.code}</span>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-600">{p.client}</td>
                      <td className="py-3 px-3 text-left">{formatNumber(p.contractAmount / 1_000_000)}</td>
                      <td className="py-3 px-3 text-left text-blue-700 font-bold">{formatNumber(p.recordedRevenue / 1_000_000)}</td>
                      <td className="py-3 px-3 text-left text-slate-700">{formatNumber(p.actualCost / 1_000_000)}</td>
                      <td className="py-3 px-3 text-left text-emerald-700 font-bold">{formatNumber(profit / 1_000_000)}</td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-800">{margin.toFixed(1)}٪</td>
                      <td className="py-3 px-3 text-left text-rose-700 font-bold">{formatNumber(p.receivables / 1_000_000)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: Projects Variance */}
      {activeTab === 'projects_variance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => {
            const costVariance = p.budget - p.actualCost;
            const progressVariance = p.physicalProgress - p.financialProgress;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold inline-block mb-1">
                      {p.code}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                  </div>
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-medium">
                    {p.status}
                  </span>
                </div>

                {/* Progress Comparison */}
                <div className="space-y-3 mb-4 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-600">پیشرفت فیزیکی کارگاه:</span>
                      <strong className="font-mono text-slate-900">{p.physicalProgress}٪</strong>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: `${p.physicalProgress}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-600">پیشرفت مالی (صورت‌وضعیت):</span>
                      <strong className="font-mono text-slate-900">{p.financialProgress}٪</strong>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${p.financialProgress}%` }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">بودجه مصوب:</span>
                    <strong className="text-slate-900">{formatCurrencyCompact(p.budget)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">هزینه واقعی (Actual):</span>
                    <strong className="text-slate-800">{formatCurrencyCompact(p.actualCost)}</strong>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center font-sans">
                    <span className="text-slate-600 text-xs">انحراف پیشرفت فیزیکی از مالی:</span>
                    <span className={`font-mono font-bold text-xs ${progressVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {progressVariance > 0 ? `+${progressVariance}٪ جلوتر` : `${progressVariance}٪ تاخیر مالی`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View 3: Receivables Aging */}
      {activeTab === 'receivables_aging' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-900 mb-4">
              نمودار توزیع سنی مطالبات شرکت از کارفرمایان (Aging Breakdown)
            </h3>

            <div className="space-y-3">
              {agingBuckets.map((bucket, idx) => (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-700">{bucket.label}</span>
                    <span className="font-mono text-slate-900">
                      {formatNumber(bucket.amount)} تومان ({bucket.percentage}٪)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className={`${bucket.color} h-full rounded-full transition-all`} style={{ width: `${bucket.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
