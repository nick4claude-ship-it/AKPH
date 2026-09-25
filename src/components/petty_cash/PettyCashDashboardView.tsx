import React, { useMemo } from 'react';
import {
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  HelpCircle,
  Scale,
  Eye,
  CreditCard,
  Building2,
  ShieldCheck,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react';
import {
  PettyCashAccount,
  PettyCashExpense,
  PettyCashReplenishment,
  PettyCashReplenishmentRequest,
  PettyCashSubTab,
} from '../../types';
import { barWidth, formatCurrency, formatNumber, formatDecimal, formatPercent } from '../../utils/formatters';
import { selectPettyCashDashboard } from '../../store/views/pettyCash';

interface PettyCashDashboardViewProps {
  accounts: PettyCashAccount[];
  expenses: PettyCashExpense[];
  replenishments: PettyCashReplenishment[];
  requests: PettyCashReplenishmentRequest[];
  onNavigateTab: (tab: PettyCashSubTab) => void;
  onSelectAccount: (account: PettyCashAccount) => void;
  onOpenNewExpense: (accountId?: string) => void;
  onOpenReplenishment: (accountId?: string) => void;
  onOpenReplenishRequest: (accountId?: string) => void;
}

export const PettyCashDashboardView: React.FC<PettyCashDashboardViewProps> = ({
  accounts,
  expenses,
  replenishments,
  requests,
  onNavigateTab,
  onSelectAccount,
  onOpenNewExpense,
  onOpenReplenishment,
  onOpenReplenishRequest,
}) => {
  // Figures of the dashboard (store view model).
  const dash = useMemo(() => selectPettyCashDashboard(accounts, expenses), [accounts, expenses]);
  const { totalActualBalance, totalPendingExpenses, totalUsableBalance, totalMonthlySpent, lowBalanceAccounts, pendingApprovalsCount, monthlyTrends } = dash;

  return (
    <div className="space-y-6">
      {/* Top Banner for Low Balance Alert if any */}
      {lowBalanceAccounts.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-lg shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-950">
                  هشدار کاهش موجودی در {formatDecimal(lowBalanceAccounts.length)} تنخواه‌گردان کارگاهی
                </h4>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                  نیاز به شارژ مجدد
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                موجودی قابل مصرف تنخواه{' '}
                {lowBalanceAccounts.map((a) => `${a.title} (${formatCurrency(a.usableBalance)})`).join(' و ')}{' '}
                به کمتر از سقف مجاز هشدار رسیده است.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <button
              onClick={() => onOpenReplenishRequest(lowBalanceAccounts[0]?.id)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
            >
              <HelpCircle className="w-4 h-4" />
              ارسال درخواست شارژ
            </button>
            <button
              onClick={() => onOpenReplenishment(lowBalanceAccounts[0]?.id)}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
            >
              <ArrowDownLeft className="w-4 h-4" />
              شارژ مستقیم
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards (3 Main Balance Concepts strictly separated) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Actual Balance */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">موجودی واقعی کل</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 tracking-tight tabular-nums">
              {formatCurrency(totalActualBalance)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">موجودی نقد فیزیکی و بانکی تنخواه‌ها</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-medium">
            <span>{formatDecimal(accounts.length)} حساب تنخواه فعال</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* 2. Pending Expenses */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">در انتظار تأیید</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-amber-600 tracking-tight tabular-nums">
              {formatCurrency(totalPendingExpenses)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">مبالغ هزینه ثبت‌شده و بلاتکلیف</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-amber-800 font-medium">
            <span>{formatDecimal(pendingApprovalsCount)} فاکتور در کارتابل</span>
            <button
              onClick={() => onNavigateTab('approvals')}
              className="text-amber-700 hover:text-amber-900 underline flex items-center"
            >
              بررسی
              <ChevronLeft className="w-3 h-3 mr-0.5" />
            </button>
          </div>
        </div>

        {/* 3. Usable Balance */}
        <div className="bg-white rounded-xl p-4 border-2 border-emerald-500 shadow-xs relative overflow-hidden bg-gradient-to-br from-emerald-50/40 to-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-950">مانده قابل مصرف کل</span>
            <div className="p-2 bg-emerald-500 text-white rounded-lg shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-emerald-800 tracking-tight tabular-nums">
              {formatCurrency(totalUsableBalance)}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1 font-medium">
              موجودی واقعی منهای اسناد در انتظار
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800">
            <span>ظرفیت مخارج آزاد</span>
            <span className="font-bold">
              {formatPercent(dash.usablePercent, 0)} کل
            </span>
          </div>
        </div>

        {/* 4. Low Balance Alerts */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">تنخواه‌های کم‌موجودی</span>
            <div
              className={`p-2 rounded-lg ${
                lowBalanceAccounts.length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div
              className={`text-xl font-black tracking-tight tabular-nums ${
                lowBalanceAccounts.length > 0 ? 'text-rose-600' : 'text-slate-800'
              }`}
            >
              {formatDecimal(lowBalanceAccounts.length)} تنخواه
            </div>
            <div className="text-[11px] text-slate-500 mt-1">زیر حداقل مجاز تعیین‌شده</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>درخواست‌های شارژ باز: {formatDecimal(requests.length)}</span>
            <button
              onClick={() => onNavigateTab('requests')}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              مشاهده
            </button>
          </div>
        </div>

        {/* 5. Monthly Spent */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">مخارج ماه جاری</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 tracking-tight tabular-nums">
              {formatCurrency(totalMonthlySpent)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">مصارف تاییدشده شهریور ۱۴۰۳</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-blue-700 font-medium">
            <span>تخصیص به ۵ پروژه</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 ml-2">دسترسی سریع عملیاتی:</span>
          <button
            onClick={() => onOpenNewExpense()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            ثبت هزینه تنخواه
          </button>
          <button
            onClick={() => onOpenReplenishment()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors shadow-xs"
          >
            <ArrowDownLeft className="w-4 h-4" />
            شارژ تنخواه‌گردان
          </button>
          <button
            onClick={() => onOpenReplenishRequest()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-slate-500" />
            درخواست شارژ مجدد
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('reconciliation')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors"
          >
            <Scale className="w-4 h-4 text-slate-500" />
            تسویه و مغایرت‌گیری
          </button>
          <button
            onClick={() => onNavigateTab('reports')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg transition-colors"
          >
            گزارش‌های رسمی و PDF
          </button>
        </div>
      </div>

      {/* Main Table: All Petty Cash Accounts */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">فهرست تنخواه‌گردان‌های شرکت و کارگاه‌ها</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              پایش مانده تفکیکی، سقف مصوب، تعهدات در انتظار و موجودی قابل مصرف
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('accounts')}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 self-start sm:self-auto"
          >
            مشاهده تمام کارنامه‌ها
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">عنوان تنخواه</th>
                <th className="py-3 px-4">کد</th>
                <th className="py-3 px-4">مسئول تنخواه</th>
                <th className="py-3 px-4">پروژه / مرکز هزینه</th>
                <th className="py-3 px-4 text-left">سقف مجاز</th>
                <th className="py-3 px-4 text-left">موجودی واقعی</th>
                <th className="py-3 px-4 text-left">در انتظار تأیید</th>
                <th className="py-3 px-4 text-left">موجودی قابل مصرف</th>
                <th className="py-3 px-4 text-center">وضعیت</th>
                <th className="py-3 px-4 text-center">اقدامات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((account) => {
                const isLow = account.usableBalance <= account.minBalanceWarning;
                return (
                  <tr
                    key={account.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isLow ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectAccount(account)}
                          className="hover:text-amber-700 text-right font-bold transition-colors"
                        >
                          {account.title}
                        </button>
                        {isLow && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-sm font-semibold shrink-0">
                            کسری موجودی
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {account.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{account.holderName}</div>
                      <div className="text-[10px] text-slate-500">{account.holderRole}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{account.projectName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-left font-mono tabular-nums text-slate-600">
                      {formatCurrency(account.ceilingLimit)}
                    </td>
                    <td className="py-3.5 px-4 text-left font-mono font-bold tabular-nums text-slate-900">
                      {formatCurrency(account.actualBalance)}
                    </td>
                    <td className="py-3.5 px-4 text-left font-mono tabular-nums text-amber-700">
                      {account.pendingExpenses > 0 ? (
                        formatCurrency(account.pendingExpenses)
                      ) : (
                        <span className="text-slate-400">۰</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-left font-mono font-bold tabular-nums">
                      <span
                        className={
                          isLow
                            ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md'
                            : 'text-emerald-700'
                        }
                      >
                        {formatCurrency(account.usableBalance)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          account.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {account.status === 'active' ? 'فعال' : 'معلق'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onSelectAccount(account)}
                          title="مشاهده کارنامه و تراکنش‌ها"
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenNewExpense(account.id)}
                          title="ثبت هزینه تنخواه"
                          className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenReplenishment(account.id)}
                          title="شارژ تنخواه"
                          className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                        >
                          <ArrowDownLeft className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Analytical Charts: Monthly Trend & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Monthly Petty Cash Spend Trend */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">روند مخارج ماهانه تنخواه‌ها</h4>
              <p className="text-xs text-slate-500 mt-0.5">روند مصرف نقدینگی در کارگاه‌ها در ۵ ماه گذشته</p>
            </div>
            {monthlyTrends.length > 0 && (
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md tabular-nums">
                {monthlyTrends[monthlyTrends.length - 1].month}: {formatCurrency(monthlyTrends[monthlyTrends.length - 1].amount)}
              </span>
            )}
          </div>

          <div className="space-y-3.5 pt-2">
            {monthlyTrends.map((trend) => {
              const pct = trend.barPercent;
              return (
                <div key={trend.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{trend.month}</span>
                    <span className="font-mono text-slate-900 font-bold tabular-nums">
                      {formatCurrency(trend.amount)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: barWidth(pct) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Category Breakdown */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">توزیع سرفصل‌های هزینه تنخواه</h4>
              <p className="text-xs text-slate-500 mt-0.5">سهم هر دسته از مخارج جاری کارگاهی</p>
            </div>
            <button
              onClick={() => onNavigateTab('reports')}
              className="text-xs text-amber-700 hover:text-amber-800 font-medium"
            >
              مشاهده جزئیات
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {dash.categoryBars.slice(0, 6).map(({ category: cat, amount, barPercent: pct }) => {
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{cat}</span>
                    <span className="font-mono text-slate-900 font-bold tabular-nums">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-slate-800 h-full rounded-full transition-all duration-500"
                      style={{ width: barWidth(pct) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Field Expenses List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">آخرین هزینه‌های ثبت‌شده تنخواه</h4>
            <p className="text-xs text-slate-500 mt-0.5">فاکتورها و خریدهای اخیر ثبت‌شده توسط کارپردازان</p>
          </div>
          <button
            onClick={() => onNavigateTab('approvals')}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1"
          >
            مشاهده کارتابل تاییدات
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {expenses.slice(0, 5).map((exp) => (
            <div key={exp.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900">{exp.description}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-sm">
                    {exp.category}
                  </span>
                  {exp.inventoryTarget === 'send_to_warehouse' && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-sm">
                      تحویل انبار
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>تنخواه: {exp.pettyCashTitle}</span>
                  <span>•</span>
                  <span>فروشنده: {exp.vendor}</span>
                  <span>•</span>
                  <span>ثبت‌کننده: {exp.submitterName}</span>
                  <span>•</span>
                  <span>تاریخ: {exp.date}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-auto shrink-0">
                <div className="text-left font-mono font-bold text-sm text-slate-900 tabular-nums">
                  {formatCurrency(exp.amount)}
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    exp.status === 'approved' || exp.status === 'accounting_posted'
                      ? 'bg-emerald-100 text-emerald-800'
                      : exp.status === 'rejected'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {exp.status === 'approved' || exp.status === 'accounting_posted'
                    ? 'تأیید و ثبت سند'
                    : exp.status === 'rejected'
                    ? 'رد شده'
                    : 'در انتظار تأیید'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
