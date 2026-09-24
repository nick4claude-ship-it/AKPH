import React, { useState } from 'react';
import {
  Landmark,
  Wallet,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  Clock,
  CreditCard,
  FileSpreadsheet,
  AlertCircle,
  BarChart2,
  Calendar,
  CheckCircle2,
  PieChart,
} from 'lucide-react';
import {
  BankAccount,
  CashDesk,
  JournalEntry,
  ReceiptRecord,
  PaymentRecord,
  AccountsReceivableItem,
  AccountsPayableItem,
} from '../../types';
import { formatCurrencyCompact, formatNumber, formatPercent } from '../../utils/formatters';

interface AccountingDashboardViewProps {
  bankAccounts: BankAccount[];
  cashDesks: CashDesk[];
  journalEntries: JournalEntry[];
  receipts: ReceiptRecord[];
  payments: PaymentRecord[];
  receivables: AccountsReceivableItem[];
  payables: AccountsPayableItem[];
  onOpenNewDoc: () => void;
  onOpenNewReceipt: () => void;
  onOpenNewPayment: () => void;
  onNavigateToTab: (tab: any) => void;
}

export const AccountingDashboardView: React.FC<AccountingDashboardViewProps> = ({
  bankAccounts,
  cashDesks,
  journalEntries,
  receipts,
  payments,
  receivables,
  payables,
  onOpenNewDoc,
  onOpenNewReceipt,
  onOpenNewPayment,
  onNavigateToTab,
}) => {
  const [cashFlowRange, setCashFlowRange] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');

  // Calculations
  const totalBankBalance = bankAccounts.reduce((sum, b) => sum + b.balance, 0);
  const totalCashBalance = cashDesks.reduce((sum, c) => sum + c.balance, 0);
  const totalPettyCash = 287_000_000; // From petty cash module
  const totalLiquidity = totalBankBalance + totalCashBalance + totalPettyCash;

  const totalReceipts = receipts.reduce((sum, r) => sum + r.amount, 0);
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

  const totalReceivables = receivables.reduce((sum, r) => sum + r.remainingClaim, 0);
  const totalPayables = payables.reduce((sum, p) => sum + p.remainingDebt, 0);

  const pendingDocsCount = journalEntries.filter((j) => j.status === 'در انتظار تأیید').length;

  const periodRevenue = 410_500_000_000;
  const periodExpense = 340_300_000_000;
  const periodProfit = periodRevenue - periodExpense;
  const profitMargin = (periodProfit / periodRevenue) * 100;

  // Monthly Cash Flow data (Receipts vs Payments)
  const cashFlowData = [
    { period: 'فروردین', receipt: 28_000_000_000, payment: 22_000_000_000 },
    { period: 'اردیبهشت', receipt: 34_000_000_000, payment: 29_500_000_000 },
    { period: 'خرداد', receipt: 42_000_000_000, payment: 36_000_000_000 },
    { period: 'تیر', receipt: 48_500_000_000, payment: 41_200_000_000 },
    { period: 'مرداد', receipt: 55_000_000_000, payment: 46_000_000_000 },
    { period: 'شهریور', receipt: 62_500_000_000, payment: 49_800_000_000 },
  ];

  const maxCashFlow = Math.max(
    ...cashFlowData.flatMap((d) => [d.receipt, d.payment])
  );

  const kpis = [
    {
      title: 'مانده کل نقدینگی شرکت',
      value: totalLiquidity,
      subtitle: 'بانک‌ها + صندوق‌ها + تنخواه‌ها',
      icon: Wallet,
      color: 'text-emerald-700 bg-emerald-50',
      actionTab: 'bank_accounts',
    },
    {
      title: 'موجودی حساب‌های بانکی',
      value: totalBankBalance,
      subtitle: `${bankAccounts.length} حساب جاری شرکتی فعال`,
      icon: Landmark,
      color: 'text-blue-700 bg-blue-50',
      actionTab: 'bank_accounts',
    },
    {
      title: 'موجودی صندوق‌های ریالی',
      value: totalCashBalance,
      subtitle: 'صندوق مرکزی و کارگاه‌ها',
      icon: Coins,
      color: 'text-amber-700 bg-amber-50',
      actionTab: 'cash_desks',
    },
    {
      title: 'مجموع دریافت‌های قطعی',
      value: totalReceipts,
      subtitle: 'حواله‌ها، چک‌ها و نقد وصولی',
      icon: ArrowDownLeft,
      color: 'text-teal-700 bg-teal-50',
      actionTab: 'receipts',
    },
    {
      title: 'مجموع پرداخت‌های قطعی',
      value: totalPayments,
      subtitle: 'تادیه بدهی مصالح و پیمانکاران',
      icon: ArrowUpRight,
      color: 'text-slate-800 bg-slate-100',
      actionTab: 'payments',
    },
    {
      title: 'درآمد کارکرد دوره (تعهدی)',
      value: periodRevenue,
      subtitle: 'صورت‌وضعیت‌های قطعی و موقت',
      icon: TrendingUp,
      color: 'text-emerald-700 bg-emerald-50',
      actionTab: 'revenues',
    },
    {
      title: 'هزینه کل تمام‌شده دوره',
      value: periodExpense,
      subtitle: 'مستقیم پروژه + سربار و ستادی',
      icon: Receipt,
      color: 'text-slate-800 bg-slate-100',
      actionTab: 'expenses',
    },
    {
      title: 'مانده مطالبات تجاری (Receivables)',
      value: totalReceivables,
      subtitle: 'اسناد دریافتنی و مطالبات کارفرما',
      icon: Clock,
      color: 'text-rose-700 bg-rose-50',
      actionTab: 'accounts_receivable',
    },
    {
      title: 'بدهی‌ها و اسناد پرداختنی (Payables)',
      value: totalPayables,
      subtitle: 'تعهدات باز به تأمین‌کنندگان و بیمه',
      icon: CreditCard,
      color: 'text-amber-800 bg-amber-50',
      actionTab: 'accounts_payable',
    },
    {
      title: 'اسناد در انتظار تأیید',
      value: pendingDocsCount,
      subtitle: 'نیازمند بررسی مدیر مالی و مدیرعامل',
      icon: FileSpreadsheet,
      color: 'text-rose-700 bg-rose-50',
      isCount: true,
      actionTab: 'journal_entries',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Action Bar with Quick Accounting Shortcuts */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">میز کار و داشبورد مرکزی حسابداری شرکت</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            پایش برخط دفاتر مالی، تراز آزمایشی، جریان نقدینگی و اسناد در انتظار تأیید پیمانکاری
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenNewDoc}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ثبت سند حسابداری جدید</span>
          </button>
          <button
            onClick={onOpenNewReceipt}
            className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-teal-600" />
            <span>ثبت دریافت وجه / چک</span>
          </button>
          <button
            onClick={onOpenNewPayment}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
            <span>ثبت پرداخت و تادیه</span>
          </button>
          <button
            onClick={() => onNavigateToTab('financial_reports')}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-xs"
          >
            <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
            <span>دفاتر کل و معین</span>
          </button>
        </div>
      </div>

      {/* 10 Key Performance Indicators (KPI Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <button
              key={idx}
              onClick={() => onNavigateToTab(kpi.actionTab)}
              className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-xs transition-all text-right cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-800 transition-colors truncate">
                  {kpi.title}
                </span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${kpi.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
                {kpi.isCount ? (
                  <span>{kpi.value} سند</span>
                ) : (
                  <span>{formatCurrencyCompact(kpi.value)}</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 truncate">
                {kpi.subtitle}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Cash Flow (Receipts vs Payments) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>جریان نقدی تحقق‌یافته (دریافت‌ها در برابر پرداخت‌ها)</span>
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                پایش ورودی و خروجی نقدی حساب‌های بانکی و صندوق شرکت (بدون اقلام نسیه)
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px]">
              <button
                onClick={() => setCashFlowRange('monthly')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  cashFlowRange === 'monthly' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                ماهانه
              </button>
              <button
                onClick={() => setCashFlowRange('quarterly')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  cashFlowRange === 'quarterly' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                فصلی
              </button>
              <button
                onClick={() => setCashFlowRange('yearly')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  cashFlowRange === 'yearly' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                سالانه
              </button>
            </div>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center gap-4 pt-3 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-emerald-600" />
              <span>دریافت‌های نقدی (Receipts)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-rose-600" />
              <span>پرداخت‌های نقدی (Payments)</span>
            </div>
            <div className="mr-auto font-mono text-[10px] text-slate-400">واحد: میلیارد تومان</div>
          </div>

          {/* SVG Multi-Bar Visualization */}
          <div className="h-56 w-full pt-4 flex items-end justify-between gap-3 px-2 border-b border-slate-200 font-mono text-xs">
            {cashFlowData.map((d) => {
              const recHeight = (d.receipt / maxCashFlow) * 100;
              const payHeight = (d.payment / maxCashFlow) * 100;

              return (
                <div key={d.period} className="flex-1 flex flex-col items-center justify-end h-full group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-44">
                    <div
                      style={{ height: `${recHeight}%` }}
                      className="w-1/2 max-w-6 bg-emerald-600 group-hover:bg-emerald-500 rounded-t-sm transition-all"
                      title={`دریافت ${d.period}: ${formatCurrencyCompact(d.receipt)}`}
                    />
                    <div
                      style={{ height: `${payHeight}%` }}
                      className="w-1/2 max-w-6 bg-rose-600 group-hover:bg-rose-500 rounded-t-sm transition-all"
                      title={`پرداخت ${d.period}: ${formatCurrencyCompact(d.payment)}`}
                    />
                  </div>
                  <span className="mt-2 text-[10px] font-sans text-slate-600">{d.period}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
            <span>مازاد تراز نقدینگی ۶ ماه اخیر: <strong>+۳۳.۷ میلیارد تومان</strong></span>
            <span className="text-emerald-700 font-bold font-mono">وضعیت نقدینگی مطلوب</span>
          </div>
        </div>

        {/* Chart 2: Revenue vs Expense vs Profit & Key Accounts Balances */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-amber-600" />
                <span>تراز درآمدهای کارکرد در برابر هزینه‌ها و سود</span>
              </h4>
              <span className="text-[11px] font-mono text-amber-700 font-bold">
                حاشیه سود دوره: {formatPercent(profitMargin)}
              </span>
            </div>

            {/* Income Statement Stack Strip */}
            <div className="mt-4 space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-sans">
                  <span>درآمد شناسایی‌شده کارکرد (Revenue):</span>
                  <span className="font-bold text-emerald-700">{formatCurrencyCompact(periodRevenue)}</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-2.5 rounded-full w-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-sans">
                  <span>بهای تمام‌شده و هزینه‌های دوره (Cost & Overhead):</span>
                  <span className="font-bold text-slate-800">{formatCurrencyCompact(periodExpense)}</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-700 h-2.5 rounded-full"
                    style={{ width: `${(periodExpense / periodRevenue) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-sans">
                  <span>سود ناخالص عملیاتی شرکت (Gross Profit):</span>
                  <span className="font-bold text-amber-700">{formatCurrencyCompact(periodProfit)}</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-2.5 rounded-full"
                    style={{ width: `${(periodProfit / periodRevenue) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Account Balances Grid */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h5 className="text-[11px] font-bold text-slate-700 mb-2 font-sans">
              مانده سرفصل‌های اصلی دارایی و بدهی:
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block font-sans">بانک‌ها</span>
                <span className="font-bold text-xs text-slate-900">{formatCurrencyCompact(totalBankBalance)}</span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block font-sans">تنخواه‌ها</span>
                <span className="font-bold text-xs text-amber-700">{formatCurrencyCompact(totalPettyCash)}</span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block font-sans">حساب‌های دریافتنی</span>
                <span className="font-bold text-xs text-rose-600">{formatCurrencyCompact(totalReceivables)}</span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block font-sans">حساب‌های پرداختنی</span>
                <span className="font-bold text-xs text-slate-800">{formatCurrencyCompact(totalPayables)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
