import React, { useState } from 'react';
import { TimeRange } from '../../types';
import { MonthlyTrendPoint } from '../../store/selectors';
import { formatCurrencyCompact, formatPercent, formatText } from '../../utils/formatters';
import { moneyUnitLabel } from '../../utils/money';
import { BarChart3, TrendingUp, Info } from 'lucide-react';
import { financialChart } from '../../store/views/dashboard';
import { Money } from '../common/Money';
import { EmptyState } from '../common/EmptyState';

interface FinancialChartsProps {
  data: MonthlyTrendPoint[];
  timeRange: TimeRange;
  onChangeTimeRange: (range: TimeRange) => void;
}

export const FinancialCharts: React.FC<FinancialChartsProps> = ({
  data,
  timeRange,
  onChangeTimeRange,
}) => {
  const [activeMetric, setActiveMetric] = useState<'all' | 'revenue' | 'cost' | 'profit'>('all');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter or scale data based on timeframe
  const chart = financialChart(data);
  const displayData = chart.points;
  const best = chart.best;

  if (data.length === 0 || data.every((p) => !p.revenue && !p.cost)) {
    return (
      <section className="card p-4">
        <h3 className="text-base font-bold text-ink">روند مقایسه‌ای درآمد، هزینه و سود</h3>
        <EmptyState description="روند ماهانه پس از ثبت نخستین سند قطعی درآمد یا هزینه نمایش داده می‌شود." />
      </section>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      {/* Header with Title and Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">روند مقایسه‌ای درآمد، هزینه و سود</h3>
            <p className="text-xs text-slate-500">پایش ماهانه جریان نقدی تعهدی و سود عملیاتی پروژه‌ها</p>
          </div>
        </div>

        {/* Metric toggles and Timeframe */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-sm">
            <button
              onClick={() => setActiveMetric('all')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                activeMetric === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه متغیرها
            </button>
            <button
              onClick={() => setActiveMetric('revenue')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                activeMetric === 'revenue'
                  ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              درآمد
            </button>
            <button
              onClick={() => setActiveMetric('cost')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                activeMetric === 'cost'
                  ? 'bg-white text-slate-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              هزینه
            </button>
            <button
              onClick={() => setActiveMetric('profit')}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                activeMetric === 'profit'
                  ? 'bg-white text-amber-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              سود
            </button>
          </div>
        </div>
      </div>

      {/* Chart Legend */}
      <div className="flex items-center justify-between py-2 text-sm">
        <div className="flex items-center gap-4 text-slate-600 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-emerald-600" />
            <span>درآمد ماهانه (کارکرد)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-slate-600" />
            <span>هزینه کل ماهانه</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-amber-500" />
            <span>سود ناخالص عملیاتی</span>
          </div>
        </div>

        <div className="text-xs text-slate-500 tabular-nums">واحد: {moneyUnitLabel()}</div>
      </div>

      {/* SVG Interactive Multi-Bar / Trend Display */}
      <div className="h-64 w-full pt-4 relative select-none">
        <div className="h-full flex items-end justify-between gap-3 px-2 border-b border-slate-200">
          {displayData.map((d, index) => {
            const revHeight = d.revenuePercent;
            const costHeight = d.costPercent;
            const profHeight = d.profitPercent;
            const isHovered = hoveredIndex === index;

            return (
              <div
                key={d.month}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
              >
                {/* Tooltip on hover */}
                {isHovered && (
                  <div className="absolute -top-16 z-20 bg-slate-900 text-white rounded-lg p-2 text-right shadow-lg text-sm w-40 pointer-events-none transition-all">
                    <p className="font-bold text-amber-400 mb-1">{formatText(d.month)}</p>
                    <div className="space-y-1 tabular-nums">
                      <div className="flex justify-between">
                        <span className="text-slate-300">درآمد:</span>
                        <span className="text-emerald-400"><Money rial={d.revenue} compact /></span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">هزینه:</span>
                        <span className="text-slate-200"><Money rial={d.cost} compact /></span>
                      </div>
                      <div className="flex justify-between border-t border-slate-700 pt-1">
                        <span className="text-slate-300">سود:</span>
                        <span className="text-amber-400 font-bold"><Money rial={d.profit} compact /></span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bars Container */}
                <div className="w-full flex items-end justify-center gap-2 h-48">
                  {/* Revenue Bar */}
                  {(activeMetric === 'all' || activeMetric === 'revenue') && (
                    <div
                      style={{ height: `${revHeight}%` }}
                      className="w-1/3 max-w-7 bg-emerald-600 group-hover:bg-emerald-500 rounded-t-sm transition-all duration-300 relative"
                    />
                  )}

                  {/* Cost Bar */}
                  {(activeMetric === 'all' || activeMetric === 'cost') && (
                    <div
                      style={{ height: `${costHeight}%` }}
                      className="w-1/3 max-w-7 bg-slate-600 group-hover:bg-slate-500 rounded-t-sm transition-all duration-300"
                    />
                  )}

                  {/* Profit Bar */}
                  {(activeMetric === 'all' || activeMetric === 'profit') && (
                    <div
                      style={{ height: `${profHeight}%` }}
                      className="w-1/3 max-w-7 bg-amber-500 group-hover:bg-amber-400 rounded-t-sm transition-all duration-300"
                    />
                  )}
                </div>

                {/* Month Label */}
                <span className="mt-2 text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                  {formatText(d.month)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analytical Summary Line below chart */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-amber-700" />
          {best
            ? `بالاترین سود در ماه ${best.month} با ${formatCurrencyCompact(best.profit)} ثبت شده است.`
            : 'در این بازه سود مثبتی در دفاتر ثبت نشده است.'}
        </span>
        <span className="tabular-nums text-slate-700">
          حاشیه سود دوره: {formatPercent(chart.margin)}
        </span>
      </div>
    </div>
  );
};
