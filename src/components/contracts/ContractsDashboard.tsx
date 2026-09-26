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
import { barWidth, formatPercent, formatText } from '../../utils/formatters';
import { useSelector } from '../../store/AppStore';
import { selectClientContractsDashboard, type AlertSeverity } from '../../store/views/contracts';
import type { ContractsSubTab } from './ContractsModule';
import { Money } from '../common/Money';
import { PageHeader } from '../common/PageHeader';
import { Button } from '../common/Button';

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

  const dash = useSelector((s) => selectClientContractsDashboard(s, contracts, statements), [contracts, statements]);
  const { totals, percents, alerts } = dash;
  const alertTone: Record<AlertSeverity, string> = {
    critical: 'bg-rose-50/70 border-rose-200/80 text-rose-900',
    warning: 'bg-amber-50/70 border-amber-200/80 text-amber-900',
    info: 'bg-blue-50/70 border-blue-200/80 text-blue-900',
    neutral: 'bg-slate-50 border-slate-200 text-slate-800',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="پیشخوان قراردادها و صورت‌وضعیت‌ها"
        description="ارزش پیمان، کارکرد واقعی، مبلغ صورت‌وضعیت و دریافتی نقدی قراردادها به تفکیک کارفرما در یک نگاه."
        actions={
          <>
            <Button variant="primary" icon={Plus} onClick={onOpenNewStatement}>
              ثبت صورت‌وضعیت جدید
            </Button>
            <Button icon={FileText} onClick={onOpenNewContract}>
              ثبت قرارداد جدید
            </Button>
          </>
        }
      />

      {/* 8 Primary Executive KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Contracts */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">قراردادهای فعال و جاری</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              {formatInt(dash.activeCount)}
            </span>
            <span className="text-xs text-slate-500">از مجموع {formatInt(dash.contractCount)} پیمان</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>تحویل موقت: {formatInt(dash.provisionalHandoverCount)} پروژه</span>
            <button
              onClick={() => onNavigateTab('contracts')}
              className="text-blue-600 hover:underline font-medium flex items-center gap-1 cursor-pointer"
            >
              مشاهده لیست
              <ChevronLeft className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 2: Total Contract Value */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">مبلغ کل قراردادها (فعلی)</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              <Money rial={totals.contractValue} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>الحاقیه‌های مصوب: {formatMoneyCompact(totals.approvedChanges)}</span>
            <span className="text-emerald-700 font-medium">+{formatPercent(percents.changes)} افزایش سقف</span>
          </div>
        </div>

        {/* KPI 3: Executed Value */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">کارکرد تجمعی اجراشده (متره)</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-950">
              <Money rial={totals.executedValue} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">پیشرفت ریالی کارکرد:</span>
            <span className="font-bold text-indigo-700">{formatPercent(percents.execution)}</span>
          </div>
        </div>

        {/* KPI 4: Total Billed */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">صورت‌وضعیت‌های ارسال‌شده</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-purple-950">
              <Money rial={totals.billedValue} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>تأییدشده: {formatMoneyCompact(totals.approvedBilledValue)}</span>
            <span className="text-purple-600 font-medium">{formatPercent(percents.billing)} از پیمان</span>
          </div>
        </div>

        {/* KPI 5: Received Amount */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">کل دریافتی‌های نقدی و اسناد</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700">
              <Money rial={totals.receivedValue} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">نسبت وصولی از صورت‌وضعیت:</span>
            <span className="font-bold text-emerald-700">{formatPercent(percents.collection)}</span>
          </div>
        </div>

        {/* KPI 6: Receivables / Claims */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">مانده مطالبات از کارفرمایان</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-700">
              <Money rial={totals.receivableValue} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-rose-700 font-medium"><Money rial={totals.overdueAmount} compact /> سررسید گذشته</span>
            <button
              onClick={() => onNavigateTab('payments')}
              className="text-rose-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              پیگیری وصول
              <ChevronLeft className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 7: Under Review Statements */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">در انتظار بررسی و تأیید</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-800">
              <Money rial={totals.pendingAmount} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{formatInt(dash.pendingStatements.length)} فقره صورت‌وضعیت</span>
            <span className="text-amber-700 font-medium">مشاور و کارفرما</span>
          </div>
        </div>

        {/* KPI 8: Remaining Contract Work */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">تعهد کارکرد باقیمانده پیمان</span>
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-teal-900">
              <Money rial={totals.remainingWork} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>ظرفیت جذب کارگاه‌ها</span>
            <span className="text-teal-700 font-medium">{formatPercent(percents.remaining)} مانده</span>
          </div>
        </div>
      </div>

      {/* Visual Execution Hierarchy Bar (Requirement 23 & 32: Contract != Executed != Billed != Received) */}
      <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              تطابق موازنه ۴ متغیر بنیادین قراردادها
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              مبلغ قرارداد، کار اجراشده، مبلغ صورت‌وضعیت و مبلغ دریافتی جدا از هم پایش می‌شوند.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-slate-900"></span>
              <span className="text-slate-600">مبلغ قرارداد (۱۰۰٪)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-indigo-600"></span>
              <span className="text-slate-600">کارکرد اجراشده ({formatPercent(percents.execution, 0)})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-purple-600"></span>
              <span className="text-slate-600">ارسال‌شده ({formatPercent(percents.billing, 0)})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-emerald-600"></span>
              <span className="text-slate-600">وصول‌شده ({formatPercent(percents.received, 0)})</span>
            </div>
          </div>
        </div>

        {/* Progress Bars for each active contract */}
        <div className="space-y-5">
          {dash.rows.map(({ contract, progress }) => {
            return (
              <div
                key={contract.id}
                className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 hover:border-slate-300 transition-all cursor-pointer"
                onClick={() => onSelectContract(contract)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded text-xs font-bold bg-slate-200 text-slate-800">
                      {formatText(contract.code)}
                    </span>
                    <span className="text-sm font-bold text-slate-900 hover:text-blue-700">
                      {formatText(contract.projectTitle)}
                    </span>
                    <span className="text-xs text-slate-500">({contract.employer})</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <span>مبلغ فعلی: <strong><Money rial={contract.currentValue} compact /></strong> م.ت</span>
                    <span>کارکرد: <strong className="text-indigo-700"><Money rial={contract.executedValue} compact /></strong> م.ت</span>
                    <span>وصولی: <strong className="text-emerald-700"><Money rial={contract.receivedValue} compact /></strong> م.ت</span>
                    <span className="text-rose-700 font-bold">طلب: {formatMoneyCompact(contract.receivableValue)}</span>
                  </div>
                </div>

                {/* Layered Bar */}
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: barWidth(progress.receivedPercent) }}
                      title={`دریافتی: ${formatPercent(progress.receivedPercent)}`}
                    ></div>
                    <div
                      className="bg-purple-500 h-full transition-all"
                      style={{ width: barWidth(progress.billedNotReceivedPercent) }}
                      title={`صورت‌وضعیت بدون وصول: ${formatPercent(progress.billedNotReceivedPercent)}`}
                    ></div>
                    <div
                      className="bg-indigo-400 h-full transition-all"
                      style={{ width: barWidth(progress.executedNotBilledPercent) }}
                      title={`کارکرد صورت‌وضعیت‌نشده: ${formatPercent(progress.executedNotBilledPercent)}`}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="text-emerald-700 font-medium">
                      دریافتی نقدی: {formatPercent(progress.receivedPercent)}
                    </span>
                    <span className="text-purple-700 font-medium">
                      صورت‌وضعیت ارسالی: {formatPercent(progress.billedPercent)}
                    </span>
                    <span className="text-indigo-700 font-bold">
                      پیشرفت فیزیکی کارکرد: {formatPercent(progress.executedPercent)}
                    </span>
                    <span className="text-slate-500">سقف کل پیمان: ۱۰۰٪</span>
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
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <h3 className="text-base font-bold text-slate-900">هشدارهای مدیریتی و ریسک‌های مالی قراردادها</h3>
              </div>
              <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {formatInt(alerts.length)} اعلان فعال
              </span>
            </div>

            <div className="space-y-2.5">
              {alerts.length === 0 && <p className="text-xs text-slate-500 py-4 text-center">هشدار فعالی برای قراردادها وجود ندارد.</p>}
              {alerts.map((a) => (
                <div key={a.id} className={`p-3 rounded-xl border flex items-start gap-3 ${alertTone[a.severity]}`}>
                  <span className="w-2 h-2 rounded-full bg-current mt-2 shrink-0 opacity-70"></span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{formatText(a.title)}</span>
                      <span className="text-sm font-bold">{formatText(a.value)}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{formatText(a.description)}</p>
                    {a.tab && (
                      <button onClick={() => onNavigateTab(a.tab!)} className="mt-2 text-sm font-bold hover:underline cursor-pointer">
                        {formatText(a.actionLabel)} ➔
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
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">آخرین وضعیت گردش صورت‌وضعیت‌ها</h3>
              </div>
              <button
                onClick={() => onNavigateTab('statements')}
                className="text-sm text-blue-600 hover:underline font-medium cursor-pointer"
              >
                مشاهده همه
              </button>
            </div>

            <div className="space-y-3">
              {dash.recentStatements.map((stm) => {
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
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {stm.type === 'قطعی' ? 'قطعی' : 'موقت'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{formatText(stm.statementNumber)}</span>
                          <span className="text-xs text-slate-500">({stm.projectName})</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <span>دوره: {formatText(stm.periodStartDate)} تا {formatText(stm.periodEndDate)}</span>
                          <span>·</span>
                          <span>کارفرما: {formatText(stm.client)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="text-sm font-bold text-slate-900">
                        <Money rial={stm.grossAmount} />
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${st.bg} ${st.text}`}>
                          {formatText(st.label)}
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
