import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Receipt, Coins, Percent as PercentIcon, Clock, FileSpreadsheet, Wallet, CreditCard, Minus, Plus } from 'lucide-react';
import { KpiItem } from '../../types';
import { formatPercent } from '../../utils/formatters';
import { moneyUnitLabel } from '../../utils/money';
import { Money, Percent } from '../common/Money';

interface KpiCardsProps {
  kpis: KpiItem[];
  onCardClick?: (kpi: KpiItem) => void;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  Receipt,
  Coins,
  Percent: PercentIcon,
  Clock,
  FileSpreadsheet,
  Wallet,
  CreditCard,
};

/** Where each indicator's data comes from: the action that fills an empty card. */
const EMPTY_ACTION: Record<string, { label: string; path: string }> = {
  'kpi-1': { label: 'ثبت صورت‌وضعیت', path: '/statements/client' },
  'kpi-2': { label: 'ثبت سند هزینه', path: '/finance/accounting' },
  'kpi-3': { label: 'ثبت صورت‌وضعیت', path: '/statements/client' },
  'kpi-4': { label: 'ثبت صورت‌وضعیت', path: '/statements/client' },
  'kpi-5': { label: 'ثبت صورت‌وضعیت', path: '/statements/client' },
  'kpi-6': { label: 'ثبت صورت‌وضعیت', path: '/statements/client' },
  'kpi-7': { label: 'مشاهده بانک‌ها', path: '/finance/banks' },
  'kpi-8': { label: 'ثبت فاکتور خرید', path: '/procurement' },
};

/** Change against the previous period, shown only when that period had data. */
const Delta: React.FC<{ kpi: KpiItem }> = ({ kpi }) => {
  if (kpi.previousValue === 0) return <span className="text-xs text-ink-subtle">دوره قبل داده‌ای برای مقایسه ندارد</span>;
  if (kpi.changePercent === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-subtle">
        <Minus className="w-4 h-4" />
        بدون تغییر نسبت به دوره قبل
      </span>
    );
  }
  const up = kpi.changePercent > 0;
  const good = kpi.isPositiveGood ? up : !up;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${good ? 'text-success' : 'text-danger'}`}>
      {up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      <span dir="ltr" className="tabular-nums">
        {up ? '+' : ''}
        {formatPercent(kpi.changePercent)}
      </span>
      <span className="font-normal text-ink-subtle">نسبت به دوره قبل</span>
    </span>
  );
};

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis, onCardClick }) => {
  const navigate = useNavigate();
  return (
    <section aria-labelledby="kpi-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 id="kpi-title" className="text-base font-bold text-ink">
          شاخص‌های کلیدی عملکرد مالی
        </h3>
        <span className="text-xs text-ink-subtle">واحد مبالغ: {moneyUnitLabel()}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = ICONS[kpi.icon] || TrendingUp;
          const empty = kpi.value === 0 && kpi.previousValue === 0;
          const action = EMPTY_ACTION[kpi.id];
          return (
            <article key={kpi.id} className="card p-4 flex flex-col gap-3" title={kpi.description}>
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium text-ink-muted">{kpi.title}</h4>
                <span className="w-9 h-9 rounded-lg bg-canvas text-ink-muted flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
              </div>

              {empty ? (
                <div className="flex-1 flex flex-col items-start gap-2">
                  <p className="text-sm text-ink-subtle">هنوز داده‌ای ثبت نشده</p>
                  {action && (
                    <button type="button" onClick={() => navigate(action.path)} className="btn btn-secondary btn-sm">
                      <Plus className="w-4 h-4" />
                      {action.label}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-xl font-bold text-ink">
                      {kpi.unit === 'درصد' ? <Percent value={kpi.value} /> : <Money rial={kpi.value} compact />}
                    </div>
                    {kpi.unit !== 'درصد' && (
                      <div className="text-xs text-ink-subtle mt-1 truncate">
                        <Money rial={kpi.value} unit={false} />
                      </div>
                    )}
                  </div>
                  <div className="mt-auto pt-3 border-t border-line flex items-center justify-between gap-2">
                    <Delta kpi={kpi} />
                    {onCardClick && (
                      <button type="button" onClick={() => onCardClick(kpi)} className="text-xs font-medium text-brand-strong hover:underline cursor-pointer">
                        جزئیات
                      </button>
                    )}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
