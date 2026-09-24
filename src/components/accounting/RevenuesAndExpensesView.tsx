import React, { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Project } from '../../types';
import { formatMoney, formatPercent, moneyUnitLabel } from '../../utils/formatters';
import { useAppState } from '../../store/AppStore';
import { postedEntries, selectProjectFinancials } from '../../store/selectors';

interface RevenuesAndExpensesViewProps {
  type: 'revenues' | 'expenses';
  projects: Project[];
  onOpenNewDocForExpense?: () => void;
}

/** Revenue and expense analysis computed only from final journal entries (no manual figures). */
export const RevenuesAndExpensesView: React.FC<RevenuesAndExpensesViewProps> = ({ type, projects, onOpenNewDocForExpense }) => {
  const state = useAppState();
  const unit = moneyUnitLabel();

  const accountTotals = useMemo(() => {
    const map = new Map<string, { name: string; amount: number }>();
    for (const e of postedEntries(state)) {
      for (const r of e.rows) {
        if (!/^[456]/.test(r.accountCode)) continue;
        const cur = map.get(r.accountCode) || { name: r.accountName, amount: 0 };
        map.set(r.accountCode, { name: cur.name, amount: cur.amount + r.debit - r.credit });
      }
    }
    return map;
  }, [state]);

  const revenueRows = useMemo(
    () =>
      projects.map((p) => {
        let contractRevenue = 0;
        let otherRevenue = 0;
        for (const e of postedEntries(state)) {
          for (const r of e.rows) {
            if (r.projectId !== p.id || !r.accountCode.startsWith('4')) continue;
            const amount = r.credit - r.debit;
            if (r.accountCode === '41101') contractRevenue += amount;
            else otherRevenue += amount;
          }
        }
        const receivedCash = state.receipts.filter((x) => x.projectId === p.id).reduce((a, x) => a + x.amount, 0);
        return {
          id: p.id,
          project: p.name,
          client: p.client,
          contractRevenue,
          otherRevenue,
          totalRevenue: contractRevenue + otherRevenue,
          receivedCash,
          receivables: selectProjectFinancials(state, p.id).receivables,
        };
      }),
    [projects, state]
  );

  if (type === 'revenues') {
    const totalContract = revenueRows.reduce((s, r) => s + r.contractRevenue, 0);
    const totalOther = revenueRows.reduce((s, r) => s + r.otherRevenue, 0);
    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              درآمد از اسناد قطعی صورت‌وضعیت‌های تأییدشده کارفرما (گروه ۴ کدینگ) محاسبه می‌شود و از وصول نقدی جداست.
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-700 font-bold shrink-0">Revenue ≠ Receipt</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">درآمد کارکرد پیمان (۴۱۱۰۱)</span>
            <strong className="text-base text-slate-900">{formatMoney(totalContract)}</strong>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">سایر درآمدهای پروژه (تعدیل، متفرقه)</span>
            <strong className="text-base text-blue-700">{formatMoney(totalOther)}</strong>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">جمع درآمد شناسایی‌شده</span>
            <strong className="text-base text-emerald-700">{formatMoney(totalContract + totalOther)}</strong>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200">
            <h4 className="text-xs font-bold text-slate-800">درآمد، وصولی و مانده مطالبات هر پروژه (از دفاتر):</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">پروژه</th>
                  <th className="py-3 px-3">کارفرما</th>
                  <th className="py-3 px-3 font-mono text-left">کارکرد پیمان ({unit})</th>
                  <th className="py-3 px-3 font-mono text-left">سایر درآمد</th>
                  <th className="py-3 px-3 font-mono text-left text-emerald-800">کل درآمد</th>
                  <th className="py-3 px-3 font-mono text-left text-blue-800">وصول نقدی</th>
                  <th className="py-3 px-4 font-mono text-left text-rose-800">مانده مطالبات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {revenueRows.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{item.project}</td>
                    <td className="py-3 px-3 font-sans text-slate-600">{item.client}</td>
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
          {revenueRows.length === 0 && <p className="py-10 text-center text-xs text-slate-400">پروژه‌ای ثبت نشده است.</p>}
        </div>
      </div>
    );
  }

  const expenseRows = [...accountTotals]
    .filter(([code, v]) => /^[56]/.test(code) && v.amount !== 0)
    .map(([code, v]) => ({ code, name: v.name, amount: v.amount, direct: code.startsWith('5') }))
    .sort((a, b) => b.amount - a.amount);
  const totalDirect = expenseRows.filter((r) => r.direct).reduce((a, r) => a + r.amount, 0);
  const totalOverhead = expenseRows.filter((r) => !r.direct).reduce((a, r) => a + r.amount, 0);
  const total = totalDirect + totalOverhead;
  const share = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-medium">هزینه‌های مستقیم پروژه (گروه ۵) و سربار دفتر مرکزی (گروه ۶) از مانده اسناد قطعی محاسبه می‌شوند.</span>
        </div>
        {onOpenNewDocForExpense && (
          <button onClick={onOpenNewDocForExpense} className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shrink-0">
            ثبت سند هزینه
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-sans text-slate-500 block mb-1">هزینه‌های مستقیم پروژه</span>
          <strong className="text-base text-slate-900">{formatMoney(totalDirect)}</strong>
          <span className="text-[10px] font-sans text-slate-400 block mt-1">{formatPercent(share(totalDirect))} از کل</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-sans text-slate-500 block mb-1">سربار، عمومی و اداری</span>
          <strong className="text-base text-slate-800">{formatMoney(totalOverhead)}</strong>
          <span className="text-[10px] font-sans text-slate-400 block mt-1">{formatPercent(share(totalOverhead))} از کل</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-sans text-slate-500 block mb-1">جمع هزینه‌های ثبت‌شده</span>
          <strong className="text-base text-rose-700">{formatMoney(total)}</strong>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200">
          <h4 className="text-xs font-bold text-slate-800">مانده هر حساب هزینه و سهم آن:</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">حساب</th>
                <th className="py-2.5 px-3">طبقه‌بندی</th>
                <th className="py-2.5 px-3 font-mono text-left">مبلغ ({unit})</th>
                <th className="py-2.5 px-3 font-mono text-left">سهم از کل</th>
                <th className="py-2.5 px-4" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {expenseRows.map((row) => (
                <tr key={row.code} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-sans font-medium text-slate-900">
                    <span className="font-mono text-[10px] text-slate-400 ml-1">{row.code}</span>
                    {row.name}
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${row.direct ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {row.direct ? 'مستقیم پروژه' : 'سربار دفتر مرکزی'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-left tabular-nums font-bold text-slate-900">{formatMoney(row.amount, false)}</td>
                  <td className="py-2.5 px-3 text-left tabular-nums text-slate-600">{formatPercent(share(row.amount))}</td>
                  <td className="py-2.5 px-4">
                    <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, share(row.amount))}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {expenseRows.length === 0 && <p className="py-10 text-center text-xs text-slate-400">هنوز هزینه‌ای در دفاتر ثبت نشده است.</p>}
      </div>
    </div>
  );
};
