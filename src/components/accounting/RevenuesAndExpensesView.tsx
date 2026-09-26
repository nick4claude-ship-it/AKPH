import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Project } from '../../types';
import { barWidth, formatMoney, formatPercent, moneyUnitLabel, formatText } from '../../utils/formatters';
import { useSelector } from '../../store/AppStore';
import { selectExpenseRows, selectRevenueRows } from '../../store/views/accounting';
import { Money } from '../common/Money';

interface RevenuesAndExpensesViewProps {
  type: 'revenues' | 'expenses';
  projects: Project[];
  onOpenNewDocForExpense?: () => void;
}

/** Revenue and expense analysis computed only from final journal entries (no manual figures). */
export const RevenuesAndExpensesView: React.FC<RevenuesAndExpensesViewProps> = ({ type, projects, onOpenNewDocForExpense }) => {
  const unit = moneyUnitLabel();

  // Revenue per project and expense accounts, from final entries only (store view models).
  const revenue = useSelector((s) => selectRevenueRows(s, projects), [projects]);
  const expenses = useSelector(selectExpenseRows);
  const revenueRows = revenue.rows;

  if (type === 'revenues') {
    const { totalContract, totalOther } = revenue;
    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-sm text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-medium">
              درآمد از اسناد قطعی صورت‌وضعیت‌های تأییدشده کارفرما (گروه ۴ کدینگ) محاسبه می‌شود و از وصول نقدی جداست.
            </span>
          </div>
          <span className="tabular-nums text-sm text-emerald-700 font-bold shrink-0">Revenue ≠ Receipt</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-sans text-slate-500 block mb-1">درآمد کارکرد پیمان (۴۱۱۰۱)</span>
            <strong className="text-base text-slate-900"><Money rial={totalContract} /></strong>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-sans text-slate-500 block mb-1">سایر درآمدهای پروژه (تعدیل، متفرقه)</span>
            <strong className="text-base text-blue-700"><Money rial={totalOther} /></strong>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-sans text-slate-500 block mb-1">جمع درآمد شناسایی‌شده</span>
            <strong className="text-base text-emerald-700"><Money rial={totalContract + totalOther} /></strong>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200">
            <h4 className="text-sm font-bold text-slate-800">درآمد، وصولی و مانده مطالبات هر پروژه (از دفاتر):</h4>
          </div>
          <div className="table-scroll">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">پروژه</th>
                  <th className="py-3 px-3">کارفرما</th>
                  <th className="py-3 px-3 tabular-nums text-left">کارکرد پیمان ({unit})</th>
                  <th className="py-3 px-3 tabular-nums text-left">سایر درآمد</th>
                  <th className="py-3 px-3 tabular-nums text-left text-emerald-800">کل درآمد</th>
                  <th className="py-3 px-3 tabular-nums text-left text-blue-800">وصول نقدی</th>
                  <th className="py-3 px-4 tabular-nums text-left text-rose-800">مانده مطالبات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {revenueRows.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{formatText(item.project)}</td>
                    <td className="py-3 px-3 font-sans text-slate-600">{formatText(item.client)}</td>
                    <td className="py-3 px-3 text-left tabular-nums">{formatMoney(item.contractRevenue, false)}</td>
                    <td className="py-3 px-3 text-left tabular-nums text-slate-600">{formatMoney(item.otherRevenue, false)}</td>
                    <td className="py-3 px-3 text-left tabular-nums font-bold text-emerald-700">{formatMoney(item.totalRevenue, false)}</td>
                    <td className="py-3 px-3 text-left tabular-nums font-bold text-blue-700">{formatMoney(item.receivedCash, false)}</td>
                    <td className="py-3 px-4 text-left tabular-nums font-bold text-rose-700">{formatMoney(item.receivables, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {revenueRows.length === 0 && <p className="py-10 text-center text-xs text-slate-500">پروژه‌ای ثبت نشده است.</p>}
        </div>
      </div>
    );
  }

  const { rows: expenseRows, totalDirect, totalOverhead, total } = expenses;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-sm text-amber-900">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="font-medium">هزینه‌های مستقیم پروژه (گروه ۵) و سربار دفتر مرکزی (گروه ۶) از مانده اسناد قطعی محاسبه می‌شوند.</span>
        </div>
        {onOpenNewDocForExpense && (
          <button onClick={onOpenNewDocForExpense} className="btn btn-primary btn-sm shrink-0">
            ثبت سند هزینه
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-sans text-slate-500 block mb-1">هزینه‌های مستقیم پروژه</span>
          <strong className="text-base text-slate-900"><Money rial={totalDirect} /></strong>
          <span className="text-xs font-sans text-slate-500 block mt-1">{formatPercent(expenses.directShare)} از کل</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-sans text-slate-500 block mb-1">سربار، عمومی و اداری</span>
          <strong className="text-base text-slate-800"><Money rial={totalOverhead} /></strong>
          <span className="text-xs font-sans text-slate-500 block mt-1">{formatPercent(expenses.overheadShare)} از کل</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-sans text-slate-500 block mb-1">جمع هزینه‌های ثبت‌شده</span>
          <strong className="text-base text-rose-700"><Money rial={total} /></strong>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200">
          <h4 className="text-sm font-bold text-slate-800">مانده هر حساب هزینه و سهم آن:</h4>
        </div>
        <div className="table-scroll">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="py-2 px-4">حساب</th>
                <th className="py-2 px-3">طبقه‌بندی</th>
                <th className="py-2 px-3 tabular-nums text-left">مبلغ ({unit})</th>
                <th className="py-2 px-3 tabular-nums text-left">سهم از کل</th>
                <th className="py-2 px-4" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {expenseRows.map((row) => (
                <tr key={row.code} className="hover:bg-slate-50">
                  <td className="py-2 px-4 font-sans font-medium text-slate-900">
                    <span className="tabular-nums text-xs text-slate-500 ml-1">{formatText(row.code)}</span>
                    {formatText(row.name)}
                  </td>
                  <td className="py-2 px-3 font-sans">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${row.direct ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {row.direct ? 'مستقیم پروژه' : 'سربار دفتر مرکزی'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-left tabular-nums font-bold text-slate-900">{formatMoney(row.amount, false)}</td>
                  <td className="py-2 px-3 text-left tabular-nums text-slate-600">{formatPercent(row.share)}</td>
                  <td className="py-2 px-4">
                    <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: barWidth(row.share) }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {expenseRows.length === 0 && <p className="py-10 text-center text-xs text-slate-500">هنوز هزینه‌ای در دفاتر ثبت نشده است.</p>}
      </div>
    </div>
  );
};
