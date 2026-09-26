/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  SubcontractorContract,
  SubcontractorProgressStatement,
  Project,
  UserProfile,
} from '../../../types';
import {
  Users,
  HardHat,
  FileCheck2,
  Clock,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  TrendingDown,
  Building,
  Hammer,
  ArrowRight,
  Filter,
  Plus,
  ArrowUpRight,
  Eye,
  CheckSquare,
  ShieldAlert,
} from 'lucide-react';
import { formatMoneyCompact, moneyUnitLabel, formatInt } from '../../../utils/money';
import { useCompany } from '../../../store/session';
import { selectSubcontractorDashboard, subcontractProgress } from '../../../store/views/contracts';
import { formatDecimal, barWidth, formatPercent, formatText } from '../../../utils/formatters';
import { Money } from '../../common/Money';
import { PageHeader } from '../../common/PageHeader';
import { Button } from '../../common/Button';
import { StepStrip } from '../../common/StepStrip';

interface SubcontractorDashboardProps {
  contracts: SubcontractorContract[];
  statements: SubcontractorProgressStatement[];
  projects: Project[];
  currentUser: UserProfile;
  onSelectContract?: (contract: SubcontractorContract) => void;
  onSelectStatement?: (statement: SubcontractorProgressStatement) => void;
  onOpenNewStatement?: (contract?: SubcontractorContract) => void;
  onOpenNewContract?: () => void;
  onGoToApprovals?: () => void;
  onPayStatement?: (statement: SubcontractorProgressStatement) => void;
}

export const SubcontractorDashboard: React.FC<SubcontractorDashboardProps> = ({
  contracts,
  statements,
  projects,
  currentUser,
  onSelectContract,
  onSelectStatement,
  onOpenNewStatement,
  onOpenNewContract,
  onGoToApprovals,
  onPayStatement,
}) => {
  const company = useCompany();
  // Interactive Filter state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [drilldownContractId, setDrilldownContractId] = useState<string>(contracts[0]?.id || '');

  // Filtered dataset
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      const matchProject = selectedProjectId === 'all' || c.projectId === selectedProjectId;
      const matchTrade = selectedTrade === 'all' || c.tradeType === selectedTrade;
      return matchProject && matchTrade;
    });
  }, [contracts, selectedProjectId, selectedTrade]);

  const filteredStatements = useMemo(() => {
    return statements.filter((s) => {
      const matchProject = selectedProjectId === 'all' || s.projectId === selectedProjectId;
      const matchTrade = selectedTrade === 'all' || s.tradeType === selectedTrade;
      return matchProject && matchTrade;
    });
  }, [statements, selectedProjectId, selectedTrade]);

  // KPIs of the filtered contracts and statements (store view model).
  const dash = useMemo(() => selectSubcontractorDashboard(filteredContracts, filteredStatements), [filteredContracts, filteredStatements]);
  const { totals } = dash;

  // Selected Drilldown Contract (for "پروژه X ← پیمانکار جوشکاری ← قرارداد ۲ میلیارد ← کارکرد ۸۰۰ میلیون...")
  const drilldownContract = useMemo(() => {
    return contracts.find((c) => c.id === drilldownContractId) || contracts[0] || null;
  }, [contracts, drilldownContractId]);

  // Unique trade types for filter
  const tradeTypes = useMemo(() => selectSubcontractorDashboard(contracts, []).tradeTypes, [contracts]);
  const drill = drilldownContract ? subcontractProgress(drilldownContract) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={HardHat}
        title="قراردادها و صورت‌وضعیت پیمانکاران جزء"
        description="کنترل مالی و گردش کار مطالبات جوشکاران، آرماتوربندان، اکیپ‌های بتن‌ریزی، تأسیسات و نازک‌کاری پروژه‌ها."
        actions={
          <>
            {onOpenNewStatement && (
              <Button variant="primary" icon={FileCheck2} onClick={() => onOpenNewStatement()}>
                ثبت کارکرد و صورت‌وضعیت
              </Button>
            )}
            {onOpenNewContract && (
              <Button icon={Plus} onClick={onOpenNewContract}>
                ثبت قرارداد جزء جدید
              </Button>
            )}
          </>
        }
      />
      <StepStrip
        title="مراحل گردش کار پیمانکاران جزء"
        highlightLast
        steps={[
          { label: '۱. ثبت کار انجام‌شده', hint: 'پیمانکار جزء یا دفتر فنی' },
          { label: '۲. بررسی کارگاه', hint: 'سرپرست کارگاه (کنترل متره)' },
          { label: '۳. تأیید مدیر پروژه', hint: 'کیفیت و برنامه زمان‌بندی' },
          { label: '۴. تأیید مدیریت و مالی', hint: 'اعتبارسنجی و دستور پرداخت' },
          { label: '۵. پرداخت و تسویه', hint: 'حواله بانکی یا چک صیادی' },
          { label: '۶. ثبت هزینه پروژه', hint: 'سند حسابداری خودکار' },
        ]}
      />

      {/* Global Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            فیلتر پیشخوان:
          </span>
          <select aria-label="فیلتر: پروژه‌ها"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">همه پروژه‌ها ({formatInt(projects.length)})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {formatText(p.name)}
              </option>
            ))}
          </select>

          <select aria-label="فیلتر: رشته‌های کاری"
            value={selectedTrade}
            onChange={(e) => setSelectedTrade(e.target.value)}
            className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">همه رشته‌های کاری ({formatInt(tradeTypes.length)})</option>
            {tradeTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {(selectedProjectId !== 'all' || selectedTrade !== 'all') && (
            <button
              onClick={() => {
                setSelectedProjectId('all');
                setSelectedTrade('all');
              }}
              className="text-xs text-amber-700 hover:text-amber-800 font-bold px-2 py-1 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer"
            >
              پاکسازی فیلترها
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          نمایش {formatInt(filteredContracts.length)} قرارداد پیمانکار جزء | {formatInt(filteredStatements.length)} صورت‌وضعیت
        </div>
      </div>

      {/* 8 Primary KPI Metric Cards (As explicitly requested by user) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. کل تعهدات به پیمانکاران جزء */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-600">مبلغ کل تعهدات پیمانکاران جزء</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              <Money rial={totals.contractValue} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>تعداد قراردادها: {formatDecimal(filteredContracts.length)}</span>
            <span className="text-slate-700 font-bold">
              کارکرد: {formatMoneyCompact(totals.executed)}
            </span>
          </div>
        </div>

        {/* 2. در انتظار بررسی کارگاه */}
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-amber-900">در انتظار بررسی کارگاه</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-950">
              <Money rial={dash.pendingSite.amount} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-amber-200/50 flex items-center justify-between text-sm">
            <span className="text-amber-800 font-bold">{formatDecimal(dash.pendingSite.count)} صورت‌وضعیت</span>
            <span className="text-amber-700">کنترل احجام و متره میدانی</span>
          </div>
        </div>

        {/* 3. در انتظار تأیید مدیریت و مدیر پروژه */}
        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-indigo-900">در انتظار تأیید مدیریت</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-950">
              <Money rial={dash.pendingManagement.amount} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-indigo-200/50 flex items-center justify-between text-sm">
            <span className="text-indigo-800 font-bold">{formatDecimal(dash.pendingManagement.count)} صورت‌وضعیت</span>
            <span className="text-indigo-700">تأیید مدیر پروژه شده</span>
          </div>
        </div>

        {/* 4. تأییدشده و پرداخت‌نشده (تعهد فوری بدهی) */}
        <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-rose-900">تأییدشده و پرداخت‌نشده</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-950">
              <Money rial={dash.approvedUnpaid.amount} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-rose-200/50 flex items-center justify-between text-sm">
            <span className="text-rose-800 font-bold">{formatDecimal(dash.approvedUnpaid.count)} مورد پرداختنی فوری</span>
            <span className="text-rose-700 font-medium">دستور پرداخت صادرشده</span>
          </div>
        </div>

        {/* 5. مبلغ پرداخت‌شده به پیمانکاران جزء */}
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-emerald-900">مجموع پرداخت‌شده قطعی</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-900">
              <Money rial={dash.paid.amount} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-emerald-200/50 flex items-center justify-between text-sm text-emerald-800">
            <span>تسویه شده: {formatDecimal(dash.paid.count)} صورت‌وضعیت</span>
            <span className="font-bold">ثبت شده در هزینه پروژه</span>
          </div>
        </div>

        {/* 6. کل صورت‌وضعیت‌های پیمانکاران جزء (مجموع ناخالص) */}
        <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-purple-900">کل صورت‌وضعیت‌های ارسالی</span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-purple-950">
              <Money rial={dash.statementsGross} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-purple-200/50 flex items-center justify-between text-sm text-purple-800">
            <span>{formatDecimal(dash.statementCount)} دوره ثبت‌شده</span>
            <span className="font-bold">
              تأییدشده: {formatMoneyCompact(totals.approved)}
            </span>
          </div>
        </div>

        {/* 7. مانده بدهی تاییدشده (باقیمانده پرداختنی) */}
        <div className="bg-amber-100/60 p-4 rounded-xl border border-amber-300 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-amber-950">مبلغ باقیمانده بدهی پیمانکاران</span>
            <div className="w-8 h-8 rounded-lg bg-amber-200/80 flex items-center justify-center text-amber-900">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-950">
              <Money rial={totals.debt} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-amber-300/60 flex items-center justify-between text-sm text-amber-900">
            <span>تأییدشده منهای پرداخت‌شده</span>
            <span className="font-bold">
              {formatPercent(totals.debtOfApprovedPercent)} تعهد مانده
            </span>
          </div>
        </div>

        {/* 8. ظرفیت کار باقیمانده قراردادها */}
        <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-teal-900">ظرفیت کار باقیمانده قراردادها</span>
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-teal-950">
              <Money rial={totals.remainingCapacity} compact />
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-teal-200/50 flex items-center justify-between text-sm text-teal-800">
            <span>حجم کارهای انجام‌نشده</span>
            <span className="font-bold">
              {formatPercent(totals.remainingCapacityPercent)} سقف پیمان‌ها
            </span>
          </div>
        </div>
      </div>

      {/* Drill-down: project › subcontractor › commitments and settlement */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
                ماتریس ویژه تحلیل پیمانکار
              </span>
              <h3 className="text-lg font-bold">تحلیل زنجیره مالی: پروژه ← پیمانکار جزء ← تعهدات و تسویه</h3>
            </div>
            <p className="text-sm text-ink-muted mt-1">
              ردیابی تفکیک‌شده قرارداد، کارکرد متره، صورت‌وضعیت تأییدشده، پرداخت‌های نقدی و مانده بدهی قابل پرداخت
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="subcontractor-dashboard-1" className="text-xs text-ink-muted font-medium">انتخاب پیمانکار جزء:</label>
            <select id="subcontractor-dashboard-1"
              value={drilldownContractId}
              onChange={(e) => setDrilldownContractId(e.target.value)}
              className="px-3 py-2 bg-surface-muted border border-line rounded-xl text-ink text-sm font-bold focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatText(c.projectName)} — {formatText(c.tradeType)} ({c.subcontractorName})
                </option>
              ))}
            </select>
          </div>
        </div>

        {drilldownContract && (
          <div className="mt-6 space-y-6">
            {/* The Breadcrumb Formula representation as requested */}
            <div className="bg-surface-muted p-4 rounded-xl border border-line flex flex-wrap items-center justify-center gap-2 md:gap-3 text-sm md:text-sm font-bold text-center">
              <span className="bg-canvas px-3 py-2 rounded-lg text-amber-800 flex items-center gap-2 shadow-2xs">
                <Building className="w-4 h-4 text-amber-800" />
                {formatText(drilldownContract.projectName)}
              </span>
              <span className="text-ink-subtle">←</span>
              <span className="bg-canvas px-3 py-2 rounded-lg text-indigo-800 flex items-center gap-2 shadow-2xs">
                <Hammer className="w-4 h-4 text-indigo-800" />
                {formatText(drilldownContract.tradeType)} ({drilldownContract.subcontractorName})
              </span>
              <span className="text-ink-subtle">←</span>
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 rounded-lg">
                قرارداد <Money rial={drilldownContract.contractValue} compact />
              </span>
              <span className="text-ink-subtle">←</span>
              <span className="bg-blue-50 text-blue-800 border border-blue-200 px-3 py-2 rounded-lg">
                کارکرد <Money rial={drilldownContract.executedValue} compact />
              </span>
              <span className="text-ink-subtle">←</span>
              <span className="bg-purple-50 text-purple-800 border border-purple-200 px-3 py-2 rounded-lg">
                صورت‌وضعیت تاییدشده <Money rial={drilldownContract.approvedStatementsValue} compact />
              </span>
              <span className="text-ink-subtle">←</span>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-lg">
                پرداخت‌شده <Money rial={drilldownContract.paidValue} compact />
              </span>
              <span className="text-ink-subtle">←</span>
              <span className="bg-rose-50 text-rose-800 border border-rose-200 px-3 py-2 rounded-lg font-bold">
                مانده بدهی <Money rial={drilldownContract.remainingPayableValue} compact />
              </span>
            </div>

            {/* Visual breakdown cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-surface-muted p-3 rounded-xl border border-line">
                <span className="text-xs text-ink-subtle block mb-1">۱. سقف قرارداد</span>
                <span className="text-lg font-bold text-amber-800">
                  <Money rial={drilldownContract.contractValue} compact />
                </span>
                              </div>

              <div className="bg-surface-muted p-3 rounded-xl border border-line">
                <span className="text-xs text-ink-subtle block mb-1">۲. کارکرد متره (اجرا)</span>
                <span className="text-lg font-bold text-blue-800">
                  <Money rial={drilldownContract.executedValue} compact />
                </span>
                <span className="text-sm text-blue-800 block mt-1">
                  {formatPercent(drill!.executedPercent)} پیشرفت
                </span>
              </div>

              <div className="bg-surface-muted p-3 rounded-xl border border-line">
                <span className="text-xs text-ink-subtle block mb-1">۳. صورت‌وضعیت مصوب</span>
                <span className="text-lg font-bold text-purple-800">
                  <Money rial={drilldownContract.approvedStatementsValue} compact />
                </span>
                <span className="text-sm text-purple-800 block mt-1">
                  {formatPercent(drill!.approvedPercent)} از پیمان
                </span>
              </div>

              <div className="bg-surface-muted p-3 rounded-xl border border-line">
                <span className="text-xs text-ink-subtle block mb-1">۴. پرداختی نقدی قطعی</span>
                <span className="text-lg font-bold text-emerald-800">
                  <Money rial={drilldownContract.paidValue} compact />
                </span>
                <span className="text-sm text-emerald-800 block mt-1">
                  {formatPercent(drill!.settledPercent)} وصولی پیمانکار
                </span>
              </div>

              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50">
                <span className="text-sm text-rose-800 block mb-1 font-bold">۵. مانده بدهی (تسویه نشده)</span>
                <span className="text-lg font-bold text-rose-800">
                  <Money rial={drilldownContract.remainingPayableValue} compact />
                </span>
                <span className="text-sm text-rose-800 block mt-1">تأییدشده پرداخت‌نشده</span>
              </div>

              <div className="p-3 rounded-xl border border-teal-200 bg-teal-50">
                <span className="text-sm text-teal-800 block mb-1 font-bold">۶. مانده حجم کار</span>
                <span className="text-lg font-bold text-teal-800">
                  <Money rial={drilldownContract.remainingContractValue} compact />
                </span>
                <span className="text-sm text-teal-800 block mt-1">
                  {formatPercent(drill!.remainingPercent)} ظرفیت مانده
                </span>
              </div>
            </div>

            {/* Visual Multi-layered Progress Bar */}
            <div className="bg-surface-muted p-4 rounded-xl border border-line space-y-2">
              <div className="flex items-center justify-between text-sm text-ink-muted font-bold">
                <span>تراز مالی و پیشرفت قرارداد: {formatText(drilldownContract.contractNumber)}</span>
                <span className="text-amber-800 font-medium">{formatText(drilldownContract.unitRateDescription)}</span>
              </div>

              <div className="w-full h-4 bg-surface-muted rounded-full overflow-hidden flex relative border border-line">
                {/* Paid portion (emerald) */}
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: barWidth(drill!.paidOfContractPercent) }}
                  title={`پرداخت‌شده: ${formatMoneyCompact(drilldownContract.paidValue)}`}
                />
                {/* Approved unpaid portion (rose) */}
                <div
                  className="bg-rose-500 h-full transition-all"
                  style={{ width: barWidth(drill!.unpaidApprovedPercent) }}
                  title={`تأییدشده پرداخت‌نشده: ${formatMoneyCompact(drilldownContract.remainingPayableValue)}`}
                />
                {/* Executed unbilled portion (blue) */}
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{ width: barWidth(drill!.unapprovedExecutedPercent) }}
                  title="کارکرد در دست بررسی کارگاه"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-ink-subtle flex-wrap gap-2 pt-1">
                <span className="flex items-center gap-2 text-emerald-800 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  پرداخت‌شده: {formatPercent(drill!.paidOfContractPercent)}
                </span>
                <span className="flex items-center gap-2 text-rose-800 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  مانده بدهی تاییدشده: {formatPercent(drill!.unpaidApprovedPercent)}
                </span>
                <span className="flex items-center gap-2 text-blue-800 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  کارکرد اجراشده در انتظار تأیید: {formatPercent(drill!.unapprovedExecutedPercent)}
                </span>
                <span className="flex items-center gap-2 text-ink-subtle">
                  <span className="w-2.5 h-2.5 rounded-full bg-canvas inline-block" />
                  ظرفیت باقیمانده کار: {formatPercent(drill!.remainingPercent)}
                </span>
              </div>
            </div>

            {/* Quick Actions for this contract */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-ink-subtle">
                پیش‌پرداخت اولیه: {formatMoneyCompact(drilldownContract.advancePaid)} | سپرده حسن انجام کار مکسوره: {formatMoneyCompact(drilldownContract.retentionDeposit)}
              </div>
              <div className="flex items-center gap-2">
                {onSelectContract && (
                  <button
                    onClick={() => onSelectContract(drilldownContract)}
                    className="text-sm text-amber-800 hover:text-white font-bold px-3 py-2 rounded-lg bg-surface-muted border border-line hover:bg-canvas transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>مشاهده سوابق و ریز صورت‌وضعیت‌ها</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {onOpenNewStatement && (
                  <button
                    onClick={() => onOpenNewStatement(drilldownContract)}
                    className="text-sm text-slate-950 font-bold px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ثبت صورت‌وضعیت جدید این پیمانکار</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two-Column Layout: Pending Action Queue & Recent Subcontractor Progress Statements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (1 Col): Urgent Approval & Payment Queue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">کارتابل اقدامات فوری</h4>
                <p className="text-xs text-slate-500">موارد نیازمند بررسی کارگاه، تایید یا پرداخت</p>
              </div>
            </div>
            {onGoToApprovals && (
              <button
                onClick={onGoToApprovals}
                className="text-sm text-amber-700 hover:text-amber-800 font-bold hover:underline cursor-pointer"
              >
                مشاهده همه
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {dash.open
              .slice(0, 4)
              .map((stmt) => (
                <div
                  key={stmt.id}
                  className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-amber-50/40 hover:border-amber-200 transition-all text-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{formatText(stmt.statementNumber)}</span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        stmt.status === 'management_approved'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : stmt.status === 'pm_approved'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {stmt.status === 'management_approved'
                        ? 'تأیید مدیریت (آماده پرداخت)'
                        : stmt.status === 'pm_approved'
                        ? 'در انتظار تأیید مدیریت'
                        : stmt.status === 'site_review'
                        ? 'در حال بررسی کارگاه'
                        : 'ثبت جدید (پیمانکار)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600 text-sm">
                    <span>{formatText(stmt.subcontractorName)}</span>
                    <span className="font-bold text-slate-900">
                      <Money rial={stmt.netPayable} compact />
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs text-slate-500">
                    <span>{formatText(stmt.projectName)}</span>
                    <div className="flex items-center gap-2">
                      {stmt.status === 'management_approved' && onPayStatement && (
                        <button
                          onClick={() => onPayStatement(stmt)}
                          className="px-2 py-1 rounded bg-emerald-700 text-white font-bold hover:bg-emerald-800 cursor-pointer"
                        >
                          پرداخت و ثبت هزینه
                        </button>
                      )}
                      {onSelectStatement && (
                        <button
                          onClick={() => onSelectStatement(stmt)}
                          className="text-amber-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          بررسی
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Right (2 Cols): Subcontractor Breakdown Table by Project & Trade */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900">ماتریس تعهدات به تفکیک پروژه و پیمانکار جزء</h4>
              <p className="text-xs text-slate-500">مقایسه سقف قرارداد، کارکرد متره، تأییدشده، پرداختی و مانده</p>
            </div>
            <span className="text-xs text-slate-500 font-medium">واحد مبالغ: {moneyUnitLabel()}</span>
          </div>

          <div className="table-scroll">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2 rounded-r-lg">پیمانکار و رشته</th>
                  <th className="p-2">پروژه</th>
                  <th className="p-2 text-left">قرارداد</th>
                  <th className="p-2 text-left">کارکرد</th>
                  <th className="p-2 text-left">تأییدشده</th>
                  <th className="p-2 text-left">پرداخت‌شده</th>
                  <th className="p-2 text-left text-rose-700">مانده بدهی</th>
                  <th className="p-2 text-center rounded-l-lg">اقدام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContracts.map((c) => {
                  const payRatio = subcontractProgress(c).settledPercent;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 font-bold text-slate-900">
                        <div className="text-sm">{formatText(c.subcontractorName)}</div>
                        <div className="text-sm text-amber-700 font-medium">{formatText(c.tradeType)}</div>
                      </td>
                      <td className="p-2 text-slate-600 text-sm">{formatText(c.projectName)}</td>
                      <td className="p-2 text-left font-bold text-slate-800">
                        <Money rial={c.contractValue} compact />
                      </td>
                      <td className="p-2 text-left font-bold text-blue-700">
                        <Money rial={c.executedValue} compact />
                      </td>
                      <td className="p-2 text-left font-bold text-purple-700">
                        <Money rial={c.approvedStatementsValue} compact />
                      </td>
                      <td className="p-2 text-left font-bold text-emerald-700">
                        <Money rial={c.paidValue} compact />
                        <div className="text-sm text-emerald-700 font-normal">
                          {formatPercent(payRatio, 0)} تسویه
                        </div>
                      </td>
                      <td className="p-2 text-left font-bold text-rose-700">
                        <Money rial={c.remainingPayableValue} compact />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => {
                            setDrilldownContractId(c.id);
                            if (onSelectContract) onSelectContract(c);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 text-xs font-bold transition-all cursor-pointer"
                        >
                          تحلیل
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
