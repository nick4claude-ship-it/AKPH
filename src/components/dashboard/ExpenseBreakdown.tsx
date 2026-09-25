import React, { useState } from 'react';
import { ExpenseCategoryTotal } from '../../store/selectors';
import { formatCurrencyCompact, formatPercent, formatNumber, barWidth } from '../../utils/formatters';
import { PieChart, Layers, Split } from 'lucide-react';
import { expenseBreakdown } from '../../store/views/dashboard';

export const ExpenseBreakdown: React.FC<{ totals: ExpenseCategoryTotal[] }> = ({ totals }) => {
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'indirect'>('all');

  const breakdown = expenseBreakdown(totals, filterType);
  const filteredTotals = breakdown.rows;
  const totalExpense = breakdown.total;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      {/* Title & Classification Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">تفکیک هزینه‌ها بر اساس ساختار</h3>
            <p className="text-[11px] text-slate-500">تفکیک ۱۰ گانه هزینه‌های مستقیم پروژه در برابر سربار و ستادی</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px]">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              filterType === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            کل هزینه‌ها
          </button>
          <button
            onClick={() => setFilterType('direct')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              filterType === 'direct'
                ? 'bg-white text-amber-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            مستقیم پروژه (Direct)
          </button>
          <button
            onClick={() => setFilterType('indirect')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              filterType === 'indirect'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            سربار و ستادی (Overhead)
          </button>
        </div>
      </div>

      {/* Visual Stack Bar */}
      <div className="pt-4 pb-2">
        <div className="h-4 w-full bg-slate-100 rounded-lg overflow-hidden flex shadow-inner">
          {filteredTotals.map((cat) => {
            const widthPct = cat.percent;
            return (
              <div
                key={cat.name}
                style={{ width: barWidth(widthPct), backgroundColor: cat.color }}
                title={`${cat.name}: ${formatCurrencyCompact(cat.amount)} (${formatPercent(widthPct)})`}
                className="h-full hover:opacity-85 transition-opacity"
              />
            );
          })}
        </div>
      </div>

      {/* Category List with Amounts & Percentages */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
        {filteredTotals.map((item) => {
          return (
            <div
              key={item.name}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50/70 hover:bg-slate-100 transition-colors text-xs border border-slate-100"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-700 font-medium truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                <span className="font-bold text-slate-900">{formatCurrencyCompact(item.amount)}</span>
                <span className="text-[11px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {formatPercent(item.percent)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Financial Core Insight: Direct vs Overhead distinction */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Split className="w-3.5 h-3.5 text-amber-600" />
          <span>هزینه مستقیم مستقیماً در سود پروژه منظور شده و هزینه سربار جداگانه ثبت گردیده است.</span>
        </div>
        <span className="font-bold text-slate-800 tabular-nums">
          مجموع: {formatCurrencyCompact(totalExpense)}
        </span>
      </div>
    </div>
  );
};
