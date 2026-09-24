import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Receipt,
  Coins,
  Percent,
  Clock,
  FileSpreadsheet,
  Wallet,
  CreditCard,
  HelpCircle,
} from 'lucide-react';
import { KpiItem } from '../../types';
import { formatCurrencyCompact, formatPercent, formatNumber } from '../../utils/formatters';

interface KpiCardsProps {
  kpis: KpiItem[];
  onCardClick: (kpi: KpiItem) => void;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis, onCardClick }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'TrendingUp':
        return TrendingUp;
      case 'Receipt':
        return Receipt;
      case 'Coins':
        return Coins;
      case 'Percent':
        return Percent;
      case 'Clock':
        return Clock;
      case 'FileSpreadsheet':
        return FileSpreadsheet;
      case 'Wallet':
        return Wallet;
      case 'CreditCard':
        return CreditCard;
      default:
        return TrendingUp;
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span>شاخص‌های کلیدی عملکرد مالی (KPIs)</span>
          <span className="text-xs font-normal text-slate-400">· کلیک برای جزئیات و پایش</span>
        </h3>
        <span className="text-xs text-slate-400 hidden sm:inline">واحد مبالغ: تومان</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpis.map((kpi) => {
          const Icon = getIcon(kpi.icon);
          const isPositiveChange = kpi.changePercent >= 0;
          const isGood = kpi.isPositiveGood ? isPositiveChange : !isPositiveChange;

          return (
            <button
              key={kpi.id}
              onClick={() => onCardClick(kpi)}
              className="text-right p-4 rounded-xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all duration-200 cursor-pointer group relative overflow-hidden"
            >
              {/* Top Row: Icon + Change Badge */}
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-medium text-slate-500 group-hover:text-slate-800 transition-colors">
                  {kpi.title}
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-amber-50 group-hover:text-amber-600 text-slate-600 flex items-center justify-center transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              {/* Main Metric Value */}
              <div className="mb-2">
                <div className="text-xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                  {kpi.unit === 'درصد' ? (
                    <span>{formatPercent(kpi.value)}</span>
                  ) : (
                    <span>{formatCurrencyCompact(kpi.value)}</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5 truncate">
                  {kpi.unit === 'درصد'
                    ? `${kpi.value.toFixed(1)} درصد سود انباشته`
                    : `${formatNumber(kpi.value)} ${kpi.unit}`}
                </div>
              </div>

              {/* Bottom Row: Percentage Delta vs Previous Period */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <div
                  className={`flex items-center gap-1 font-semibold tabular-nums text-[11px] ${
                    isGood ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {isPositiveChange ? (
                    <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>
                    {isPositiveChange ? '+' : ''}
                    {kpi.changePercent.toFixed(1)}٪
                  </span>
                  <span className="font-normal text-slate-400 text-[10px]">نسبت به دوره قبل</span>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-600 flex items-center gap-0.5 text-[10px] font-medium">
                  <span>گزارش</span>
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
