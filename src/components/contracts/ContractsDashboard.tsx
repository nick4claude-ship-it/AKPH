/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Contract,
  DetailedProgressStatement,
  UserProfile,
} from '../../types';
import {
  FileText,
  FileCheck,
  TrendingUp,
  Clock,
  AlertTriangle,
  Building,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Layers,
  CheckCircle2,
  DollarSign,
  ChevronLeft,
  FileSpreadsheet,
} from 'lucide-react';

interface ContractsDashboardProps {
  contracts: Contract[];
  statements: DetailedProgressStatement[];
  currentUser: UserProfile;
  onSelectContract: (contract: Contract) => void;
  onOpenNewContract: () => void;
  onOpenNewStatement: () => void;
  onSelectStatement: (statement: DetailedProgressStatement) => void;
  onNavigateTab: (tab: any) => void;
}

export const ContractsDashboard: React.FC<ContractsDashboardProps> = ({
  contracts,
  statements,
  currentUser,
  onSelectContract,
  onOpenNewContract,
  onOpenNewStatement,
  onSelectStatement,
  onNavigateTab,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | '1403' | '1402'>('all');

  // Aggregated KPIs
  const activeContractsCount = contracts.filter((c) => c.status === 'فعال' || c.status === 'تحویل موقت').length;
  const totalContractsValue = contracts.reduce((sum, c) => sum + c.currentValue, 0);
  const totalExecutedValue = contracts.reduce((sum, c) => sum + c.executedValue, 0);
  const totalBilledValue = contracts.reduce((sum, c) => sum + c.billedValue, 0);
  const totalApprovedBilledValue = contracts.reduce((sum, c) => sum + c.approvedBilledValue, 0);
  const totalReceivedValue = contracts.reduce((sum, c) => sum + c.receivedValue, 0);
  const totalReceivableValue = contracts.reduce((sum, c) => sum + c.receivableValue, 0);
  
  // Pending statements under review (consultant or employer)
  const pendingStatements = statements.filter(
    (s) => s.status === 'submitted_to_consultant' || s.status === 'under_consultant_review' || s.status === 'submitted_to_employer'
  );
  const totalPendingStatementsAmount = pendingStatements.reduce((sum, s) => sum + s.grossAmount, 0);

  // Overall financial execution ratios
  const executionRatio = totalContractsValue > 0 ? (totalExecutedValue / totalContractsValue) * 100 : 0;
  const billingRatio = totalContractsValue > 0 ? (totalBilledValue / totalContractsValue) * 100 : 0;
  const collectionRatio = totalBilledValue > 0 ? (totalReceivedValue / totalBilledValue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner: Action Bar & Context */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-sm border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -translate-x-20 -translate-y-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                فاز چهارم سامانه · چرخه جامع قراردادها و صورت‌وضعیت
              </span>
              <span className="text-xs text-slate-400">
                Contract ➔ BOQ ➔ Execution ➔ Statement ➔ Deductions ➔ Approval ➔ Accounting
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              پیشخوان مدیریت قراردادها و صورت‌وضعیت‌های عمرانی
            </h1>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              پایش بلادرنگ ۴ متغیر بنیادین: <span className="text-amber-300 font-bold">ارزش پیمان</span>،{' '}
              <span className="text-blue-300 font-bold">کارکرد واقعی متره</span>،{' '}
              <span className="text-purple-300 font-bold">مبلغ صورت‌وضعیت (Billed)</span>، و{' '}
              <span className="text-emerald-300 font-bold">دریافتی‌های نقدی (Receipt)</span> به تفکیک دستگاه‌های اجرایی.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={onOpenNewStatement}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>صورت‌وضعیت جدید</span>
            </button>
            <button
              onClick={onOpenNewContract}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs border border-white/20 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>ثبت قرارداد جدید</span>
            </button>
          </div>
        </div>
      </div>

      {/* 8 Primary Executive KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Contracts */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">قراردادهای فعال و جاری</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {activeContractsCount.toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-slate-500">از مجموع {contracts.length.toLocaleString('fa-IR')} پیمان</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>تحویل موقت: ۱ پروژه</span>
            <button
              onClick={() => onNavigateTab('contracts')}
              className="text-blue-600 hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
            >
              مشاهده لیست
              <ChevronLeft className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 2: Total Contract Value */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">مبلغ کل قراردادها (فعلی)</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {Number((totalContractsValue / 1_000_000_000).toFixed(1)).toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-slate-500 font-medium">میلیارد تومان</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>الحاقیه‌های مصوب: ۶.۴۵ م.ت</span>
            <span className="text-emerald-600 font-medium">+۱۰.۲٪ افزایش سقف</span>
          </div>
        </div>

        {/* KPI 3: Executed Value */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">کارکرد تجمعی اجراشده (متره)</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-950 tracking-tight">
              {Number((totalExecutedValue / 1_000_000_000).toFixed(1)).toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-slate-500 font-medium">میلیارد تومان</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">پیشرفت ریالی کارکرد:</span>
            <span className="font-bold text-indigo-700">{Number(executionRatio.toFixed(1)).toLocaleString('fa-IR')}٪</span>
          </div>
        </div>

        {/* KPI 4: Total Billed */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">صورت‌وضعیت‌های ارسال‌شده</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-950 tracking-tight">
              {Number((totalBilledValue / 1_000_000_000).toFixed(1)).toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-slate-500 font-medium">میلیارد تومان</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>تأییدشده: {Number((totalApprovedBilledValue / 1_000_000_000).toFixed(1)).toLocaleString('fa-IR')} م.ت</span>
            <span className="text-purple-600 font-medium">{Number(billingRatio.toFixed(1)).toLocaleString('fa-IR')}٪ از پیمان</span>
          </div>
        </div>

        {/* KPI 5: Received Amount */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">کل دریافتی‌های نقدی و اسناد</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700 tracking-tight">
              {Number((totalReceivedValue / 1_000_000_000).toFixed(1)).toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-slate-500 font-medium">میلیارد تومان</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">نسبت وصولی از صورت‌وضعیت:</span>
            <span className="font-bold text-emerald-600">{Number(collectionRatio.toFixed(1)).toLocaleString('fa-IR')}٪</span>
          </div>
        </div>

        {/* KPI 6: Receivables / Claims */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">مانده مطالبات از کارفرمایان</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-700 tracking-tight">
              {Number((totalReceivableValue / 1_000_000_000).toFixed(1)).toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-slate-500 font-medium">میلیارد تومان</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="text-rose-600 font-medium">۸۸۲ م.ت سررسید گذشته</span>
            <button
              onClick={() => onNavigateTab('receivables')}
              className="text-rose-700 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
            >
              پیگیری وصول
              <ChevronLeft className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 7: Under Review Statements */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">در انتظار بررسی و تأیید</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-800 tracking-tight">
              {Number((totalPendingStatementsAmount / 1_000_000_000).toFixed(2)).toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-slate-500 font-medium">میلیارد تومان</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{pendingStatements.length.toLocaleString('fa-IR')} فقره صورت‌وضعیت</span>
            <span className="text-amber-700 font-medium">مشاور و کارفرما</span>
          </div>
        </div>

        {/* KPI 8: Remaining Contract Work */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">تعهد کارکرد باقیمانده پیمان</span>
            <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-teal-900 tracking-tight">
              {Number(((totalContractsValue - totalExecutedValue) / 1_000_000_000).toFixed(1)).toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-slate-500 font-medium">میلیارد تومان</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>ظرفیت جذب کارگاه‌ها</span>
            <span className="text-teal-700 font-medium">{Number((100 - executionRatio).toFixed(1)).toLocaleString('fa-IR')}٪ مانده</span>
          </div>
        </div>
      </div>

      {/* Visual Execution Hierarchy Bar (Requirement 23 & 32: Contract != Executed != Billed != Received) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              تطابق موازنه ۴ متغیر بنیادین قراردادها (Quad-Variable Financial Balance)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              اصل تفکیک قطعی: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">Contract Value ≠ Executed Value ≠ Billed Value ≠ Received Value</code>
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-900"></span>
              <span className="text-slate-600">مبلغ قرارداد (۱۰۰٪)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-600"></span>
              <span className="text-slate-600">کارکرد اجراشده ({executionRatio.toFixed(0)}٪)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-purple-600"></span>
              <span className="text-slate-600">ارسال‌شده ({billingRatio.toFixed(0)}٪)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-600"></span>
              <span className="text-slate-600">وصول‌شده ({(totalReceivedValue / totalContractsValue * 100).toFixed(0)}٪)</span>
            </div>
          </div>
        </div>

        {/* Progress Bars for each active contract */}
        <div className="space-y-5">
          {contracts.map((contract) => {
            const cExecRatio = (contract.executedValue / contract.currentValue) * 100;
            const cBilledRatio = (contract.billedValue / contract.currentValue) * 100;
            const cRecRatio = (contract.receivedValue / contract.currentValue) * 100;

            return (
              <div
                key={contract.id}
                className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/60 hover:border-slate-300 transition-all cursor-pointer"
                onClick={() => onSelectContract(contract)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                      {contract.code}
                    </span>
                    <span className="text-xs font-bold text-slate-900 hover:text-blue-700">
                      {contract.projectTitle}
                    </span>
                    <span className="text-[11px] text-slate-500">({contract.employer})</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>مبلغ فعلی: <strong>{(contract.currentValue / 1_000_000_000).toFixed(1)}</strong> م.ت</span>
                    <span>کارکرد: <strong className="text-indigo-700">{(contract.executedValue / 1_000_000_000).toFixed(1)}</strong> م.ت</span>
                    <span>وصولی: <strong className="text-emerald-700">{(contract.receivedValue / 1_000_000_000).toFixed(1)}</strong> م.ت</span>
                    <span className="text-rose-700 font-bold">طلب: {(contract.receivableValue / 1_000_000_000).toFixed(1)} م.ت</span>
                  </div>
                </div>

                {/* Layered Bar */}
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${Math.min(100, cRecRatio)}%` }}
                      title={`دریافتی: ${cRecRatio.toFixed(1)}%`}
                    ></div>
                    <div
                      className="bg-purple-500 h-full transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, cBilledRatio - cRecRatio))}%` }}
                      title={`صورت‌وضعیت بدون وصول: ${(cBilledRatio - cRecRatio).toFixed(1)}%`}
                    ></div>
                    <div
                      className="bg-indigo-400 h-full transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, cExecRatio - cBilledRatio))}%` }}
                      title={`کارکرد صورت‌وضعیت‌نشده: ${(cExecRatio - cBilledRatio).toFixed(1)}%`}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="text-emerald-700 font-medium">
                      دریافتی نقدی: {Number(cRecRatio.toFixed(1)).toLocaleString('fa-IR')}٪
                    </span>
                    <span className="text-purple-700 font-medium">
                      صورت‌وضعیت ارسالی: {Number(cBilledRatio.toFixed(1)).toLocaleString('fa-IR')}٪
                    </span>
                    <span className="text-indigo-700 font-bold">
                      پیشرفت فیزیکی کارکرد: {Number(cExecRatio.toFixed(1)).toLocaleString('fa-IR')}٪
                    </span>
                    <span className="text-slate-400">سقف کل پیمان: ۱۰۰٪</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Management Alerts & Recent Statements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Executive Alerts (هشدارهای مدیریتی قراردادها و صورت‌وضعیت) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">هشدارهای مدیریتی و ریسک‌های مالی قراردادها</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                ۴ اعلان فعال
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Alert 1 */}
              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900">مطالبات معوق سررسید گذشته (۴۵ روز تاخیر)</span>
                    <span className="text-[10px] font-bold text-rose-700">۸۸۲,۷۵۰,۰۰۰ تومان</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    صورت‌وضعیت شماره ۰۸ تقاطع فجر توسط سازمان مهندسی و عمران شهر تهران تایید شده ولی واریز نشده است.
                  </p>
                  <button
                    onClick={() => onNavigateTab('receivables')}
                    className="mt-1.5 text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                  >
                    پیگیری وصول و ثبت اخطار مالی ➔
                  </button>
                </div>
              </div>

              {/* Alert 2 */}
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">عبور مقدار کارکرد از سقف اولیه پیمان (Quantity Exceeded)</span>
                    <span className="text-[10px] font-bold text-amber-700">+۵۰۰ مترمکعب مازاد</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    ردیف ۰۰۱ (خاکبرداری گود برج رونیکا) از سقف ۱۲,۰۰۰ به ۱۲,۵۰۰ مترمکعب رسیده و نیاز به ثبت الحاقیه یا دستورکار دارد.
                  </p>
                  <button
                    onClick={() => onNavigateTab('boq')}
                    className="mt-1.5 text-[11px] font-bold text-amber-800 hover:underline cursor-pointer"
                  >
                    بررسی کنترل احجام در فهرست‌بها ➔
                  </button>
                </div>
              </div>

              {/* Alert 3 */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900">صورت‌وضعیت در انتظار بررسی مشاور</span>
                    <span className="text-[10px] font-bold text-blue-700">۷۰۸,۱۸۰,۰۰۰ تومان</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    صورت‌وضعیت موقت ۰۵ برج رونیکا در کارتابل مهندسین مشاور سازه‌اندیش شرق بیش از ۵ روز معطل مانده است.
                  </p>
                </div>
              </div>

              {/* Alert 4 */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 shrink-0"></span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">نزدیک شدن قرارداد به تاریخ خاتمه</span>
                    <span className="text-[10px] font-bold text-slate-600">پروژه تقاطع فجر</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    مدت پیمان در تاریخ ۱۴۰۳/۰۸/۱۵ به پایان می‌رسد. لایحه تمدید مدت مجاز (تاخیرات) باید ارسال شود.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>سیستم کنترل تطابق هوشمند فعال است</span>
            <button
              onClick={() => onNavigateTab('reports')}
              className="text-blue-600 font-bold hover:underline cursor-pointer"
            >
              مشاهده گزارش تحلیل انحرافات
            </button>
          </div>
        </div>

        {/* Section 2: Recent Statements & Fast Approvals */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">آخرین وضعیت گردش صورت‌وضعیت‌ها (Workflow)</h3>
              </div>
              <button
                onClick={() => onNavigateTab('statements')}
                className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
              >
                مشاهده همه
              </button>
            </div>

            <div className="space-y-3">
              {statements.slice(0, 4).map((stm) => {
                const statusStyles: Record<string, { label: string; bg: string; text: string }> = {
                  draft: { label: 'پیش‌نویس کارگاه', bg: 'bg-slate-100', text: 'text-slate-700' },
                  prepared: { label: 'تهیه شده', bg: 'bg-blue-50', text: 'text-blue-700' },
                  submitted_to_consultant: { label: 'ارسال به مشاور', bg: 'bg-amber-50', text: 'text-amber-800' },
                  under_consultant_review: { label: 'بررسی مشاور', bg: 'bg-amber-100', text: 'text-amber-900' },
                  approved_by_consultant: { label: 'تأیید مشاور', bg: 'bg-indigo-50', text: 'text-indigo-800' },
                  approved_by_employer: { label: 'تأیید کارفرما', bg: 'bg-emerald-50', text: 'text-emerald-800' },
                  claimed: { label: 'اعلام بدهی و مطالبه', bg: 'bg-purple-50', text: 'text-purple-800' },
                  partially_paid: { label: 'پرداخت بخشی از وجه', bg: 'bg-teal-50', text: 'text-teal-800' },
                  paid: { label: 'تسویه کامل', bg: 'bg-emerald-100', text: 'text-emerald-900' },
                  rejected: { label: 'رد شده', bg: 'bg-rose-100', text: 'text-rose-900' },
                  returned_for_correction: { label: 'بازگشت جهت اصلاح', bg: 'bg-orange-100', text: 'text-orange-900' },
                };

                const st = statusStyles[stm.status] || { label: stm.status, bg: 'bg-slate-100', text: 'text-slate-700' };

                return (
                  <div
                    key={stm.id}
                    onClick={() => onSelectStatement(stm)}
                    className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50/50 transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {stm.type === 'قطعی' ? 'قطعی' : 'موقت'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{stm.statementNumber}</span>
                          <span className="text-[10px] text-slate-400">({stm.projectName})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>دوره: {stm.periodStartDate} تا {stm.periodEndDate}</span>
                          <span>·</span>
                          <span>کارفرما: {stm.client}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="text-xs font-black text-slate-900">
                        {stm.grossAmount.toLocaleString('fa-IR')} تومان
                      </div>
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>ثبت هوشمند کسورات و ارتباط مستقیم با حسابداری</span>
            <button
              onClick={onOpenNewStatement}
              className="text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              صدور صورت‌وضعیت این دوره
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
