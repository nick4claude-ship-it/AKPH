import React, { useMemo } from 'react';
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
  AccountingSubTab,
  BankAccount,
  CashDesk,
  JournalEntry,
  ReceiptRecord,
  PaymentRecord,
  AccountsReceivableItem,
  AccountsPayableItem,
} from '../../types';
import { formatCurrencyCompact, formatInt, formatPercent, barWidth, formatText } from '../../utils/formatters';
import { moneyUnitLabel } from '../../utils/money';
import type { Balances, CashFlowPoint } from '../../store/selectors';
import { selectAccountingDashboard } from '../../store/views/accounting';
import { Money } from '../common/Money';

interface AccountingDashboardViewProps {
  bankAccounts: BankAccount[];
  cashDesks: CashDesk[];
  pettyCashTotal: number;
  journalEntries: JournalEntry[];
  receipts: ReceiptRecord[];
  payments: PaymentRecord[];
  receivables: AccountsReceivableItem[];
  payables: AccountsPayableItem[];
  /** Company-wide ledger totals (final entries). */
  ledger: Balances;
  cashFlow: CashFlowPoint[];
  onOpenNewDoc?: () => void;
  /** Receipts and payments are entered in treasury, not in accounting. */
  onOpenTreasury: (path: '/finance/receipts' | '/finance/payments') => void;
  onNavigateToTab: (tab: AccountingSubTab) => void;
}

export const AccountingDashboardView: React.FC<AccountingDashboardViewProps> = ({
  bankAccounts,
  cashDesks,
  journalEntries,
  receipts,
  payments,
  receivables,
  payables,
  pettyCashTotal,
  ledger,
  cashFlow,
  onOpenNewDoc,
  onOpenTreasury,
  onNavigateToTab,
}) => {
  // Every figure below comes from the store: balances, the ledger and the aging lists.
  const dash = useMemo(
    () => selectAccountingDashboard({ bankAccounts, cashDesks, receipts, payments, receivables, payables, journalEntries, pettyCashTotal, ledger, cashFlow }),
    [bankAccounts, cashDesks, receipts, payments, receivables, payables, journalEntries, pettyCashTotal, ledger, cashFlow]
  );
  const {
    totalBankBalance,
    totalCashBalance,
    totalPettyCash,
    totalLiquidity,
    totalReceipts,
    totalPayments,
    totalReceivables,
    totalPayables,
    pendingDocsCount,
    periodRevenue,
    periodExpense,
    periodProfit,
    profitMargin,
    netCashFlow,
  } = dash;
  const cashFlowData = dash.cashFlowBars;

  const kpis: { title: string; value: number; subtitle: string; icon: typeof Wallet; color: string; actionTab: AccountingSubTab; isCount?: boolean }[] = [
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
      title: 'مانده مطالبات تجاری',
      value: totalReceivables,
      subtitle: 'اسناد دریافتنی و مطالبات کارفرما',
      icon: Clock,
      color: 'text-rose-700 bg-rose-50',
      actionTab: 'accounts_receivable',
    },
    {
      title: 'بدهی‌ها و اسناد پرداختنی',
      value: totalPayables,
      subtitle: 'تعهدات باز به تأمین‌کنندگان و بیمه',
      icon: CreditCard,
      color: 'text-amber-800 bg-amber-50',
      actionTab: 'accounts_payable',
    },
    {
      title: 'اسناد در انتظار تأیید',
      value: pendingDocsCount,
      subtitle: 'نیازمند تأیید حسابدار یا مدیر ارشد',
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
          <h3 className="text-base font-bold text-slate-900">میز کار و داشبورد مرکزی حسابداری شرکت</h3>
          <p className="text-xs text-slate-500 mt-1">
            پایش برخط دفاتر مالی، تراز آزمایشی، جریان نقدینگی و اسناد در انتظار تأیید پیمانکاری
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenNewDoc && (
            <button
              onClick={onOpenNewDoc}
              className="btn btn-primary"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>ثبت سند حسابداری جدید</span>
            </button>
          )}
          <button
            onClick={() => onOpenTreasury('/finance/receipts')}
            className="flex items-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-teal-700" />
            <span>دریافت‌ها در خزانه</span>
          </button>
          <button
            onClick={() => onOpenTreasury('/finance/payments')}
            className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-700" />
            <span>پرداخت‌ها در خزانه</span>
          </button>
          <button
            onClick={() => onNavigateToTab('financial_reports')}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs"
          >
            <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
            <span>دفاتر کل و معین</span>
          </button>
        </div>
      </div>

      {/* 10 Key Performance Indicators (KPI Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.title}
              onClick={() => onNavigateToTab(kpi.actionTab)}
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-xs transition-all text-right cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 group-hover:text-slate-800 transition-colors truncate">
                  {formatText(kpi.title)}
                </span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${kpi.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="text-base font-bold text-slate-900 tabular-nums">
                {kpi.isCount ? (
                  <span>{formatInt(kpi.value)} سند</span>
                ) : (
                  <span><Money rial={kpi.value} compact /></span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1 truncate">
                {formatText(kpi.subtitle)}
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
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                <span>جریان نقدی تحقق‌یافته (دریافت‌ها در برابر پرداخت‌ها)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                پایش ورودی و خروجی نقدی حساب‌های بانکی و صندوق شرکت (بدون اقلام نسیه)
              </p>
            </div>

            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">۶ ماه آخر دفاتر</span>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center gap-4 pt-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs bg-emerald-600" />
              <span>دریافت‌های نقدی</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs bg-rose-600" />
              <span>پرداخت‌های نقدی</span>
            </div>
            <div className="mr-auto tabular-nums text-xs text-slate-500">واحد: {moneyUnitLabel()}</div>
          </div>

          {/* SVG Multi-Bar Visualization */}
          <div className="h-56 w-full pt-4 flex items-end justify-between gap-3 px-2 border-b border-slate-200 tabular-nums text-sm">
            {cashFlowData.map((d) => {
              const recHeight = d.receiptPercent;
              const payHeight = d.paymentPercent;

              return (
                <div key={d.period} className="flex-1 flex flex-col items-center justify-end h-full group">
                  <div className="w-full flex items-end justify-center gap-2 h-44">
                    <div
                      style={{ height: `${recHeight}%` }}
                      className="w-1/2 max-w-6 bg-emerald-600 group-hover:bg-emerald-500 rounded-t-sm transition-all"
                      title={`دریافت ${d.label}: ${formatCurrencyCompact(d.receipt)}`}
                    />
                    <div
                      style={{ height: `${payHeight}%` }}
                      className="w-1/2 max-w-6 bg-rose-600 group-hover:bg-rose-500 rounded-t-sm transition-all"
                      title={`پرداخت ${d.label}: ${formatCurrencyCompact(d.payment)}`}
                    />
                  </div>
                  <span className="mt-2 text-sm font-sans text-slate-600">{formatText(d.label)}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
            <span>
              خالص جریان نقد ۶ ماه اخیر: <strong><Money rial={netCashFlow} compact /></strong>
            </span>
            <span className={`font-bold tabular-nums ${netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{netCashFlow >= 0 ? 'ورودی بیش از خروجی' : 'خروجی بیش از ورودی'}</span>
          </div>
        </div>

        {/* Chart 2: Revenue vs Expense vs Profit & Key Accounts Balances */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-amber-700" />
                <span>تراز درآمدهای کارکرد در برابر هزینه‌ها و سود</span>
              </h4>
              <span className="text-sm tabular-nums text-amber-700 font-bold">
                حاشیه سود دوره: {formatPercent(profitMargin)}
              </span>
            </div>

            {/* Income Statement Stack Strip */}
            <div className="mt-4 space-y-3 tabular-nums text-sm">
              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-sans">
                  <span>درآمد شناسایی‌شده کارکرد:</span>
                  <span className="font-bold text-emerald-700"><Money rial={periodRevenue} compact /></span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-2.5 rounded-full w-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-sans">
                  <span>بهای تمام‌شده و هزینه‌های دوره:</span>
                  <span className="font-bold text-slate-800"><Money rial={periodExpense} compact /></span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-700 h-2.5 rounded-full"
                    style={{ width: barWidth(dash.expenseOfRevenuePercent) }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-sans">
                  <span>سود ناخالص عملیاتی شرکت:</span>
                  <span className="font-bold text-amber-700"><Money rial={periodProfit} compact /></span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-2.5 rounded-full"
                    style={{ width: barWidth(dash.profitOfRevenuePercent) }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Account Balances Grid */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h5 className="text-sm font-bold text-slate-700 mb-2 font-sans">
              مانده سرفصل‌های اصلی دارایی و بدهی:
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center tabular-nums">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs text-slate-500 block font-sans">بانک‌ها</span>
                <span className="font-bold text-sm text-slate-900"><Money rial={totalBankBalance} compact /></span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs text-slate-500 block font-sans">تنخواه‌ها</span>
                <span className="font-bold text-sm text-amber-700"><Money rial={totalPettyCash} compact /></span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs text-slate-500 block font-sans">حساب‌های دریافتنی</span>
                <span className="font-bold text-sm text-rose-700"><Money rial={totalReceivables} compact /></span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs text-slate-500 block font-sans">حساب‌های پرداختنی</span>
                <span className="font-bold text-sm text-slate-800"><Money rial={totalPayables} compact /></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
