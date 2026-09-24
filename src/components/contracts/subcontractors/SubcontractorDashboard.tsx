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
  const [drilldownContractId, setDrilldownContractId] = useState<string>('sub-cnt-01');

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

  // Aggregate KPI metrics requested by user:
  // 1. کل صورت‌وضعیت‌های پیمانکاران جزء
  const totalStatementsCount = filteredStatements.length;
  const totalStatementsGross = filteredStatements.reduce((sum, s) => sum + s.grossAmount, 0);

  // 2. در انتظار بررسی (کارگاه)
  const pendingSiteReview = filteredStatements.filter((s) => s.status === 'submitted' || s.status === 'measured' || s.status === 'site_review');
  const pendingSiteReviewCount = pendingSiteReview.length;
  const pendingSiteReviewAmount = pendingSiteReview.reduce((sum, s) => sum + s.netPayable, 0);

  // 3. در انتظار تأیید مدیریت (و مدیر پروژه)
  const pendingManagementReview = filteredStatements.filter((s) => s.status === 'pm_approved' || s.status === 'finance_approved');
  const pendingManagementReviewCount = pendingManagementReview.length;
  const pendingManagementReviewAmount = pendingManagementReview.reduce((sum, s) => sum + s.netPayable, 0);

  // 4. تأییدشده و پرداخت‌نشده (تعهدات فوری پرداختنی)
  const approvedUnpaidStatements = filteredStatements.filter((s) => s.status === 'management_approved' && s.remainingPayable > 0);
  const approvedUnpaidCount = approvedUnpaidStatements.length;
  const approvedUnpaidAmount = approvedUnpaidStatements.reduce((sum, s) => sum + s.remainingPayable, 0);

  // 5. پرداخت‌شده
  const paidStatements = filteredStatements.filter((s) => s.status === 'paid' || s.paidAmount > 0);
  const paidCount = paidStatements.length;
  const paidAmount = filteredStatements.reduce((sum, s) => sum + s.paidAmount, 0);

  // 6. مبلغ کل تعهدات به پیمانکاران جزء (ارزش کل قراردادها)
  const totalContractCommitments = filteredContracts.reduce((sum, c) => sum + c.contractValue, 0);

  // 7. مبلغ کارکرد اجراشده متره
  const totalExecutedValue = filteredContracts.reduce((sum, c) => sum + c.executedValue, 0);

  // 8. صورت‌وضعیت‌های تأییدشده کل
  const totalApprovedStatements = filteredContracts.reduce((sum, c) => sum + c.approvedStatementsValue, 0);

  // 9. مبلغ باقیمانده (تعهدات مانده پرداخت نشده: تأییدشده منهای پرداختی)
  const totalRemainingPayableDebt = filteredContracts.reduce((sum, c) => sum + c.remainingPayableValue, 0);

  // 10. مانده ظرفیت قراردادها (سقف قرارداد - کارکرد)
  const totalRemainingWorkCapacity = totalContractCommitments - totalExecutedValue;

  // Selected Drilldown Contract (for "پروژه X ← پیمانکار جوشکاری ← قرارداد ۲ میلیارد ← کارکرد ۸۰۰ میلیون...")
  const drilldownContract = useMemo(() => {
    return contracts.find((c) => c.id === drilldownContractId) || contracts[0] || null;
  }, [contracts, drilldownContractId]);

  // Unique trade types for filter
  const tradeTypes = useMemo(() => {
    const set = new Set<string>();
    contracts.forEach((c) => set.add(c.tradeType));
    return Array.from(set);
  }, [contracts]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Context Description */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 rounded-2xl p-5 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
              <HardHat className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black">مدیریت تعهدات و صورت‌وضعیت پیمانکاران جزء</h2>
                <span className="text-[11px] bg-amber-500/40 text-amber-100 px-2 py-0.5 rounded-full font-bold border border-amber-300/30">
                  Subcontractor Outflows
                </span>
              </div>
              <p className="text-xs text-amber-100/90 mt-1">
                کنترل مالی و گردش کار مطالبات جوشکاران، آرماتوربندان، اکیپ‌های بتن‌ریزی، تأسیسات و نازک‌کاری پروژه‌های {company.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenNewContract && (
              <button
                onClick={onOpenNewContract}
                className="flex items-center gap-1.5 px-3 py-2 bg-white text-amber-900 rounded-xl text-xs font-black shadow-xs hover:bg-amber-50 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت قرارداد جزء جدید</span>
              </button>
            )}
            {onOpenNewStatement && (
              <button
                onClick={() => onOpenNewStatement()}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-900/60 hover:bg-amber-900 text-amber-100 rounded-xl text-xs font-bold border border-amber-400/40 shadow-xs transition-all cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>ثبت کارکرد / صورت‌وضعیت</span>
              </button>
            )}
          </div>
        </div>

        {/* Workflow Pipeline Bar */}
        <div className="mt-4 pt-4 border-t border-white/15">
          <div className="text-[11px] font-bold text-amber-200 mb-2 flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" />
            <span>چرخه گردش کار استاندارد پیمانکاران جزء:</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-[10px]">
            <div className="bg-white/10 rounded-lg p-2 border border-white/15">
              <span className="block font-bold text-amber-200">۱. ثبت کار انجام‌شده</span>
              <span className="text-[9px] text-amber-100/80">پیمانکار جزء / دفتر فنی</span>
            </div>
            <div className="bg-white/10 rounded-lg p-2 border border-white/15">
              <span className="block font-bold text-amber-200">۲. بررسی کارگاه</span>
              <span className="text-[9px] text-amber-100/80">سرپرست کارگاه (کنترل متره)</span>
            </div>
            <div className="bg-white/10 rounded-lg p-2 border border-white/15">
              <span className="block font-bold text-amber-200">۳. تأیید مدیر پروژه</span>
              <span className="text-[9px] text-amber-100/80">بررسی کیفیت و برنامه زمانبندی</span>
            </div>
            <div className="bg-white/10 rounded-lg p-2 border border-white/15">
              <span className="block font-bold text-amber-200">۴. تأیید مدیریت / مالی</span>
              <span className="text-[9px] text-amber-100/80">اعتبارسنجی و دستور پرداخت</span>
            </div>
            <div className="bg-white/10 rounded-lg p-2 border border-white/15">
              <span className="block font-bold text-amber-200">۵. پرداخت و تسویه</span>
              <span className="text-[9px] text-amber-100/80">حواله بانکی / چک صیادی</span>
            </div>
            <div className="bg-amber-400 text-slate-950 font-black rounded-lg p-2 border border-amber-300 shadow-xs">
              <span className="block">۶. ثبت هزینه پروژه</span>
              <span className="text-[9px] opacity-90">سند حسابداری اتوماتیک</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            فیلتر پیشخوان:
          </span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">همه پروژه‌ها ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={selectedTrade}
            onChange={(e) => setSelectedTrade(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">همه رشته‌های کاری ({tradeTypes.length})</option>
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
              className="text-[11px] text-amber-700 hover:text-amber-800 font-bold px-2 py-1 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer"
            >
              پاکسازی فیلترها
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          نمایش {filteredContracts.length} قرارداد پیمانکار جزء | {filteredStatements.length} صورت‌وضعیت
        </div>
      </div>

      {/* 8 Primary KPI Metric Cards (As explicitly requested by user) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. کل تعهدات به پیمانکاران جزء */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">مبلغ کل تعهدات پیمانکاران جزء</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {formatMoneyCompact(totalContractCommitments)}
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>تعداد قراردادها: {filteredContracts.length.toLocaleString('fa-IR')}</span>
            <span className="text-slate-700 font-bold">
              کارکرد: {formatMoneyCompact(totalExecutedValue)}
            </span>
          </div>
        </div>

        {/* 2. در انتظار بررسی کارگاه */}
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-900">در انتظار بررسی کارگاه</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-950 tracking-tight">
              {formatMoneyCompact(pendingSiteReviewAmount)}
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-amber-200/50 flex items-center justify-between text-[11px]">
            <span className="text-amber-800 font-bold">{pendingSiteReviewCount.toLocaleString('fa-IR')} صورت‌وضعیت</span>
            <span className="text-amber-700">کنترل احجام و متره میدانی</span>
          </div>
        </div>

        {/* 3. در انتظار تأیید مدیریت و مدیر پروژه */}
        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-900">در انتظار تأیید مدیریت</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-950 tracking-tight">
              {formatMoneyCompact(pendingManagementReviewAmount)}
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-indigo-200/50 flex items-center justify-between text-[11px]">
            <span className="text-indigo-800 font-bold">{pendingManagementReviewCount.toLocaleString('fa-IR')} صورت‌وضعیت</span>
            <span className="text-indigo-700">تأیید مدیر پروژه شده</span>
          </div>
        </div>

        {/* 4. تأییدشده و پرداخت‌نشده (تعهد فوری بدهی) */}
        <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-900">تأییدشده و پرداخت‌نشده</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-950 tracking-tight">
              {formatMoneyCompact(approvedUnpaidAmount)}
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-rose-200/50 flex items-center justify-between text-[11px]">
            <span className="text-rose-800 font-bold">{approvedUnpaidCount.toLocaleString('fa-IR')} مورد پرداختنی فوری</span>
            <span className="text-rose-600 font-medium">دستور پرداخت صادرشده</span>
          </div>
        </div>

        {/* 5. مبلغ پرداخت‌شده به پیمانکاران جزء */}
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-900">مجموع پرداخت‌شده قطعی</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-900 tracking-tight">
              {formatMoneyCompact(paidAmount)}
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-emerald-200/50 flex items-center justify-between text-[11px] text-emerald-800">
            <span>تسویه شده: {paidCount.toLocaleString('fa-IR')} صورت‌وضعیت</span>
            <span className="font-bold">ثبت شده در هزینه پروژه</span>
          </div>
        </div>

        {/* 6. کل صورت‌وضعیت‌های پیمانکاران جزء (مجموع ناخالص) */}
        <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-900">کل صورت‌وضعیت‌های ارسالی</span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-950 tracking-tight">
              {formatMoneyCompact(totalStatementsGross)}
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-purple-200/50 flex items-center justify-between text-[11px] text-purple-800">
            <span>{totalStatementsCount.toLocaleString('fa-IR')} دوره ثبت‌شده</span>
            <span className="font-bold">
              تأییدشده: {formatMoneyCompact(totalApprovedStatements)}
            </span>
          </div>
        </div>

        {/* 7. مانده بدهی تاییدشده (باقیمانده پرداختنی) */}
        <div className="bg-amber-100/60 p-4 rounded-xl border border-amber-300 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-950">مبلغ باقیمانده بدهی پیمانکاران</span>
            <div className="w-8 h-8 rounded-lg bg-amber-200/80 flex items-center justify-center text-amber-900">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-950 tracking-tight">
              {formatMoneyCompact(totalRemainingPayableDebt)}
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-amber-300/60 flex items-center justify-between text-[11px] text-amber-900">
            <span>تأییدشده منهای پرداخت‌شده</span>
            <span className="font-bold">
              {totalApprovedStatements > 0
                ? Number(((totalRemainingPayableDebt / totalApprovedStatements) * 100).toFixed(1)).toLocaleString('fa-IR')
                : '۰'}
              ٪ تعهد مانده
            </span>
          </div>
        </div>

        {/* 8. ظرفیت کار باقیمانده قراردادها */}
        <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-teal-900">ظرفیت کار باقیمانده قراردادها</span>
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-teal-950 tracking-tight">
              {formatMoneyCompact(totalRemainingWorkCapacity)}
            </span>
                      </div>
          <div className="mt-3 pt-2 border-t border-teal-200/50 flex items-center justify-between text-[11px] text-teal-800">
            <span>حجم کارهای انجام‌نشده</span>
            <span className="font-bold">
              {totalContractCommitments > 0
                ? Number(((totalRemainingWorkCapacity / totalContractCommitments) * 100).toFixed(1)).toLocaleString('fa-IR')
                : '۰'}
              ٪ سقف پیمان‌ها
            </span>
          </div>
        </div>
      </div>

      {/* SPECIAL DRILLDOWN SECTION REQUESTED BY USER:
          "حتی باید بتوانیم مثلاً بزنیم:
           پروژه X ← پیمانکار جوشکاری ← قرارداد ۲ میلیارد ← کارکرد ۸۰۰ میلیون ← صورتوضعیتهای تأییدشده ۵۰۰ میلیون ← پرداختشده ۳۰۰ میلیون ← مانده ۲۰۰ میلیون" */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-lg border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-700/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                ماتریس ویژه تحلیل پیمانکار
              </span>
              <h3 className="text-lg font-black">تحلیل زنجیره مالی: پروژه ← پیمانکار جزء ← تعهدات و تسویه</h3>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              ردیابی تفکیک‌شده قرارداد، کارکرد متره، صورت‌وضعیت تأییدشده، پرداخت‌های نقدی و مانده بدهی قابل پرداخت
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-300 font-medium">انتخاب پیمانکار جزء:</label>
            <select
              value={drilldownContractId}
              onChange={(e) => setDrilldownContractId(e.target.value)}
              className="px-3 py-2 bg-slate-800/90 border border-slate-600 rounded-xl text-white text-xs font-bold focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.projectName} — {c.tradeType} ({c.subcontractorName})
                </option>
              ))}
            </select>
          </div>
        </div>

        {drilldownContract && (
          <div className="mt-6 space-y-6">
            {/* The Breadcrumb Formula representation as requested */}
            <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700 flex flex-wrap items-center justify-center gap-2 md:gap-3 text-xs md:text-sm font-bold text-center">
              <span className="bg-slate-700/90 px-3 py-1.5 rounded-lg text-amber-300 flex items-center gap-1.5 shadow-2xs">
                <Building className="w-4 h-4 text-amber-400" />
                {drilldownContract.projectName}
              </span>
              <span className="text-slate-400">←</span>
              <span className="bg-slate-700/90 px-3 py-1.5 rounded-lg text-indigo-300 flex items-center gap-1.5 shadow-2xs">
                <Hammer className="w-4 h-4 text-indigo-400" />
                {drilldownContract.tradeType} ({drilldownContract.subcontractorName})
              </span>
              <span className="text-slate-400">←</span>
              <span className="bg-amber-500/20 text-amber-200 border border-amber-400/40 px-3 py-1.5 rounded-lg">
                قرارداد {formatMoneyCompact(drilldownContract.contractValue)}
              </span>
              <span className="text-slate-400">←</span>
              <span className="bg-blue-500/20 text-blue-200 border border-blue-400/40 px-3 py-1.5 rounded-lg">
                کارکرد {formatMoneyCompact(drilldownContract.executedValue)}
              </span>
              <span className="text-slate-400">←</span>
              <span className="bg-purple-500/20 text-purple-200 border border-purple-400/40 px-3 py-1.5 rounded-lg">
                صورت‌وضعیت تاییدشده {formatMoneyCompact(drilldownContract.approvedStatementsValue)}
              </span>
              <span className="text-slate-400">←</span>
              <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 px-3 py-1.5 rounded-lg">
                پرداخت‌شده {formatMoneyCompact(drilldownContract.paidValue)}
              </span>
              <span className="text-slate-400">←</span>
              <span className="bg-rose-500/30 text-rose-200 border border-rose-400/60 px-3 py-1.5 rounded-lg font-black text-rose-300">
                مانده بدهی {formatMoneyCompact(drilldownContract.remainingPayableValue)}
              </span>
            </div>

            {/* Visual breakdown cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                <span className="text-[11px] text-slate-400 block mb-1">۱. سقف قرارداد</span>
                <span className="text-lg font-black text-amber-400">
                  {formatMoneyCompact(drilldownContract.contractValue)}
                </span>
                              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                <span className="text-[11px] text-slate-400 block mb-1">۲. کارکرد متره (اجرا)</span>
                <span className="text-lg font-black text-blue-300">
                  {formatMoneyCompact(drilldownContract.executedValue)}
                </span>
                <span className="text-[10px] text-blue-400 block mt-0.5">
                  {Number(((drilldownContract.executedValue / drilldownContract.contractValue) * 100).toFixed(1)).toLocaleString('fa-IR')}٪ پیشرفت
                </span>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                <span className="text-[11px] text-slate-400 block mb-1">۳. صورت‌وضعیت مصوب</span>
                <span className="text-lg font-black text-purple-300">
                  {formatMoneyCompact(drilldownContract.approvedStatementsValue)}
                </span>
                <span className="text-[10px] text-purple-400 block mt-0.5">
                  {Number(((drilldownContract.approvedStatementsValue / drilldownContract.contractValue) * 100).toFixed(1)).toLocaleString('fa-IR')}٪ از پیمان
                </span>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                <span className="text-[11px] text-slate-400 block mb-1">۴. پرداختی نقدی قطعی</span>
                <span className="text-lg font-black text-emerald-400">
                  {formatMoneyCompact(drilldownContract.paidValue)}
                </span>
                <span className="text-[10px] text-emerald-400 block mt-0.5">
                  {drilldownContract.approvedStatementsValue > 0
                    ? Number(((drilldownContract.paidValue / drilldownContract.approvedStatementsValue) * 100).toFixed(1)).toLocaleString('fa-IR')
                    : '۰'}
                  ٪ وصولی پیمانکار
                </span>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-rose-900/50 bg-rose-950/20">
                <span className="text-[11px] text-rose-300 block mb-1 font-bold">۵. مانده بدهی (تسویه نشده)</span>
                <span className="text-lg font-black text-rose-400">
                  {formatMoneyCompact(drilldownContract.remainingPayableValue)}
                </span>
                <span className="text-[10px] text-rose-300 block mt-0.5">تأییدشده پرداخت‌نشده</span>
              </div>

              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-teal-900/50 bg-teal-950/20">
                <span className="text-[11px] text-teal-300 block mb-1 font-bold">۶. مانده حجم کار</span>
                <span className="text-lg font-black text-teal-400">
                  {formatMoneyCompact(drilldownContract.remainingContractValue)}
                </span>
                <span className="text-[10px] text-teal-300 block mt-0.5">
                  {Number(((drilldownContract.remainingContractValue / drilldownContract.contractValue) * 100).toFixed(1)).toLocaleString('fa-IR')}٪ ظرفیت مانده
                </span>
              </div>
            </div>

            {/* Visual Multi-layered Progress Bar */}
            <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                <span>تراز مالی و پیشرفت قرارداد: {drilldownContract.contractNumber}</span>
                <span className="text-amber-400 font-medium">{drilldownContract.unitRateDescription}</span>
              </div>

              <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden flex relative border border-slate-700">
                {/* Paid portion (emerald) */}
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{
                    width: `${Math.min(100, (drilldownContract.paidValue / drilldownContract.contractValue) * 100)}%`,
                  }}
                  title={`پرداخت‌شده: ${formatMoneyCompact(drilldownContract.paidValue)}`}
                />
                {/* Approved unpaid portion (rose) */}
                <div
                  className="bg-rose-500 h-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (drilldownContract.remainingPayableValue / drilldownContract.contractValue) * 100
                    )}%`,
                  }}
                  title={`تأییدشده پرداخت‌نشده: ${formatMoneyCompact(drilldownContract.remainingPayableValue)}`}
                />
                {/* Executed unbilled portion (blue) */}
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{
                    width: `${Math.max(
                      0,
                      ((drilldownContract.executedValue - drilldownContract.approvedStatementsValue) /
                        drilldownContract.contractValue) *
                        100
                    )}%`,
                  }}
                  title="کارکرد در دست بررسی کارگاه"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2 pt-1">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  پرداخت‌شده: {Number(((drilldownContract.paidValue / drilldownContract.contractValue) * 100).toFixed(1)).toLocaleString('fa-IR')}٪
                </span>
                <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  مانده بدهی تاییدشده: {Number(((drilldownContract.remainingPayableValue / drilldownContract.contractValue) * 100).toFixed(1)).toLocaleString('fa-IR')}٪
                </span>
                <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  کارکرد اجراشده در انتظار تأیید: {drilldownContract.executedValue - drilldownContract.approvedStatementsValue > 0 ? Number((((drilldownContract.executedValue - drilldownContract.approvedStatementsValue) / drilldownContract.contractValue) * 100).toFixed(1)).toLocaleString('fa-IR') : '۰'}٪
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
                  ظرفیت باقیمانده کار: {Number(((drilldownContract.remainingContractValue / drilldownContract.contractValue) * 100).toFixed(1)).toLocaleString('fa-IR')}٪
                </span>
              </div>
            </div>

            {/* Quick Actions for this contract */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-400">
                پیش‌پرداخت اولیه: {formatMoneyCompact(drilldownContract.advancePaid)} | سپرده حسن انجام کار مکسوره: {formatMoneyCompact(drilldownContract.retentionDeposit)}
              </div>
              <div className="flex items-center gap-2">
                {onSelectContract && (
                  <button
                    onClick={() => onSelectContract(drilldownContract)}
                    className="text-xs text-amber-300 hover:text-white font-bold px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>مشاهده سوابق و ریز صورت‌وضعیت‌ها</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {onOpenNewStatement && (
                  <button
                    onClick={() => onOpenNewStatement(drilldownContract)}
                    className="text-xs text-slate-950 font-black px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 transition-all flex items-center gap-1 cursor-pointer"
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
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">کارتابل اقدامات فوری</h4>
                <p className="text-[11px] text-slate-500">موارد نیازمند بررسی کارگاه، تایید یا پرداخت</p>
              </div>
            </div>
            {onGoToApprovals && (
              <button
                onClick={onGoToApprovals}
                className="text-xs text-amber-700 hover:text-amber-800 font-bold hover:underline cursor-pointer"
              >
                مشاهده همه
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {filteredStatements
              .filter((s) => s.status !== 'paid')
              .slice(0, 4)
              .map((stmt) => (
                <div
                  key={stmt.id}
                  className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-amber-50/40 hover:border-amber-200 transition-all text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{stmt.statementNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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

                  <div className="flex items-center justify-between text-slate-600 text-[11px]">
                    <span>{stmt.subcontractorName}</span>
                    <span className="font-bold text-slate-900">
                      {formatMoneyCompact(stmt.netPayable)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-500">
                    <span>{stmt.projectName}</span>
                    <div className="flex items-center gap-1.5">
                      {stmt.status === 'management_approved' && onPayStatement && (
                        <button
                          onClick={() => onPayStatement(stmt)}
                          className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700 cursor-pointer"
                        >
                          پرداخت و ثبت هزینه
                        </button>
                      )}
                      {onSelectStatement && (
                        <button
                          onClick={() => onSelectStatement(stmt)}
                          className="text-amber-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
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
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">ماتریس تعهدات به تفکیک پروژه و پیمانکار جزء</h4>
              <p className="text-[11px] text-slate-500">مقایسه سقف قرارداد، کارکرد متره، تأییدشده، پرداختی و مانده</p>
            </div>
            <span className="text-xs text-slate-400 font-medium">واحد مبالغ: {moneyUnitLabel()}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5 rounded-r-lg">پیمانکار و رشته</th>
                  <th className="p-2.5">پروژه</th>
                  <th className="p-2.5 text-left">قرارداد</th>
                  <th className="p-2.5 text-left">کارکرد</th>
                  <th className="p-2.5 text-left">تأییدشده</th>
                  <th className="p-2.5 text-left">پرداخت‌شده</th>
                  <th className="p-2.5 text-left text-rose-700">مانده بدهی</th>
                  <th className="p-2.5 text-center rounded-l-lg">اقدام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContracts.map((c) => {
                  const payRatio =
                    c.approvedStatementsValue > 0 ? (c.paidValue / c.approvedStatementsValue) * 100 : 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2.5 font-bold text-slate-900">
                        <div className="text-xs">{c.subcontractorName}</div>
                        <div className="text-[10px] text-amber-700 font-medium">{c.tradeType}</div>
                      </td>
                      <td className="p-2.5 text-slate-600 text-[11px]">{c.projectName}</td>
                      <td className="p-2.5 text-left font-black text-slate-800">
                        {formatMoneyCompact(c.contractValue)}
                      </td>
                      <td className="p-2.5 text-left font-bold text-blue-700">
                        {formatMoneyCompact(c.executedValue)}
                      </td>
                      <td className="p-2.5 text-left font-bold text-purple-700">
                        {formatMoneyCompact(c.approvedStatementsValue)}
                      </td>
                      <td className="p-2.5 text-left font-bold text-emerald-700">
                        {formatMoneyCompact(c.paidValue)}
                        <div className="text-[9px] text-emerald-600 font-normal">
                          {formatInt(Math.round(payRatio))}٪ تسویه
                        </div>
                      </td>
                      <td className="p-2.5 text-left font-black text-rose-600">
                        {formatMoneyCompact(c.remainingPayableValue)}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => {
                            setDrilldownContractId(c.id);
                            if (onSelectContract) onSelectContract(c);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 text-[10px] font-bold transition-all cursor-pointer"
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
