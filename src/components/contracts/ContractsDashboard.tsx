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
import { formatInt, formatMoney, formatMoneyCompact } from '../../utils/money';
import { formatPercent } from '../../utils/formatters';
import { useAppState } from '../../store/AppStore';
import type { ContractsSubTab } from './ContractsModule';
import { dayIndex, todayIndex } from '../../store/domainSelectors';

interface ContractsDashboardProps {
  contracts: Contract[];
  statements: DetailedProgressStatement[];
  currentUser: UserProfile;
  onSelectContract: (contract: Contract) => void;
  onOpenNewContract: () => void;
  onOpenNewStatement: () => void;
  onSelectStatement: (statement: DetailedProgressStatement) => void;
  onNavigateTab: (tab: ContractsSubTab) => void;
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

  // Alerts and secondary figures computed from the store (no fixed samples).
  const store = useAppState();
  const today = todayIndex();
  const totalApprovedChanges = contracts.reduce((sum, c) => sum + c.approvedChangesValue, 0);
  const totalInitial = contracts.reduce((sum, c) => sum + c.initialValue, 0);
  const changesPercent = totalInitial > 0 ? (totalApprovedChanges / totalInitial) * 100 : 0;
  const overdue = statements.filter((s) => s.remainingPayable > 0 && ['approved_by_employer', 'claimed', 'partially_paid'].includes(s.status) && dayIndex(s.dueDate) < today);
  const overdueAmount = overdue.reduce((sum, s) => sum + s.remainingPayable, 0);
  const contractIds = new Set(contracts.map((c) => c.id));
  const exceeded = store.contractBoq.filter((b) => contractIds.has(b.contractId) && b.cumulativeExecutedQuantity > b.initialQuantity);
  const endingSoon = contracts.filter((c) => c.status === 'فعال' && dayIndex(c.endDate) - today >= 0 && dayIndex(c.endDate) - today <= 60);
  type Alert = { id: string; title: string; value: string; description: string; tone: string; tab?: ContractsSubTab; action?: string };
  const alerts: Alert[] = [
    ...(overdue.length
      ? [{ id: 'overdue', title: `مطالبات سررسیدگذشته (${formatInt(overdue.length)} صورت‌وضعیت)`, value: formatMoney(overdueAmount), description: overdue.slice(0, 3).map((s) => `${s.statementNumber} — ${s.projectName}`).join('، '), tone: 'bg-rose-50/70 border-rose-200/80 text-rose-900', tab: 'payments' as const, action: 'پیگیری وصول' }]
      : []),
    ...exceeded.slice(0, 3).map((b) => ({ id: `boq-${b.id}`, title: 'عبور کارکرد از مقدار پیمان', value: `+${formatInt(b.cumulativeExecutedQuantity - b.initialQuantity)} ${b.unit}`, description: `ردیف ${b.code} (${b.description}) نیاز به الحاقیه یا دستورکار دارد.`, tone: 'bg-amber-50/70 border-amber-200/80 text-amber-900', tab: 'boq' as const, action: 'بررسی فهرست‌بها' })),
    ...(pendingStatements.length
      ? [{ id: 'pending', title: `صورت‌وضعیت در انتظار مشاور/کارفرما (${formatInt(pendingStatements.length)})`, value: formatMoney(totalPendingStatementsAmount), description: pendingStatements.slice(0, 3).map((s) => s.statementNumber).join('، '), tone: 'bg-blue-50/70 border-blue-200/80 text-blue-900', tab: 'statements' as const, action: 'مشاهده صورت‌وضعیت‌ها' }]
      : []),
    ...endingSoon.map((c) => ({ id: `end-${c.id}`, title: 'نزدیک شدن به تاریخ خاتمه قرارداد', value: c.endDate, description: `${c.code} — ${c.projectTitle}`, tone: 'bg-slate-50 border-slate-200 text-slate-800' })),
  ];

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
              {formatMoneyCompact(totalContractsValue)}
            </span>
                      </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>الحاقیه‌های مصوب: {formatMoneyCompact(totalApprovedChanges)}</span>
            <span className="text-emerald-600 font-medium">+{formatPercent(changesPercent)} افزایش سقف</span>
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
              {formatMoneyCompact(totalExecutedValue)}
            </span>
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
              {formatMoneyCompact(totalBilledValue)}
            </span>
                      </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>تأییدشده: {formatMoneyCompact(totalApprovedBilledValue)}</span>
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
              {formatMoneyCompact(totalReceivedValue)}
            </span>
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
              {formatMoneyCompact(totalReceivableValue)}
            </span>
                      </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="text-rose-600 font-medium">{formatMoneyCompact(overdueAmount)} سررسید گذشته</span>
            <button
              onClick={() => onNavigateTab('payments')}
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
              {formatMoneyCompact(totalPendingStatementsAmount)}
            </span>
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
              {formatMoneyCompact((totalContractsValue - totalExecutedValue))}
            </span>
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
                    <span>مبلغ فعلی: <strong>{formatMoneyCompact(contract.currentValue)}</strong> م.ت</span>
                    <span>کارکرد: <strong className="text-indigo-700">{formatMoneyCompact(contract.executedValue)}</strong> م.ت</span>
                    <span>وصولی: <strong className="text-emerald-700">{formatMoneyCompact(contract.receivedValue)}</strong> م.ت</span>
                    <span className="text-rose-700 font-bold">طلب: {formatMoneyCompact(contract.receivableValue)}</span>
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
                {formatInt(alerts.length)} اعلان فعال
              </span>
            </div>

            <div className="space-y-2.5">
              {alerts.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">هشدار فعالی برای قراردادها وجود ندارد.</p>}
              {alerts.map((a) => (
                <div key={a.id} className={`p-3 rounded-xl border flex items-start gap-3 ${a.tone}`}>
                  <span className="w-2 h-2 rounded-full bg-current mt-1.5 shrink-0 opacity-70"></span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">{a.title}</span>
                      <span className="text-[10px] font-bold">{a.value}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{a.description}</p>
                    {a.tab && (
                      <button onClick={() => onNavigateTab(a.tab!)} className="mt-1.5 text-[11px] font-bold hover:underline cursor-pointer">
                        {a.action} ➔
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
                        {formatMoney(stm.grossAmount)}
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
