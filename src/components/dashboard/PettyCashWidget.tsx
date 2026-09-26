import React from 'react';
import { PettyCashAccount, PETTY_CASH_FUND_LABELS } from '../../types';
import { formatNumber, formatCurrencyCompact, formatText } from '../../utils/formatters';
import { Coins, AlertCircle, CheckCircle2, AlertTriangle, PlusCircle, ArrowUpRight } from 'lucide-react';
import { Money } from '../common/Money';
import { EmptyState } from '../common/EmptyState';

interface PettyCashWidgetProps {
  items: PettyCashAccount[];
  onChargeClick: (fund: PettyCashAccount) => void;
  onViewAllClick: () => void;
  /** Share of the ceiling below which a fund needs replenishment (from stored settings). */
  lowBalancePercent: number;
}

type FundHealth = 'normal' | 'warning' | 'critical';

export const PettyCashWidget: React.FC<PettyCashWidgetProps> = ({
  items,
  onChargeClick,
  onViewAllClick,
  lowBalancePercent,
}) => {
  const health = (f: PettyCashAccount): FundHealth =>
    f.usableBalance <= 0 ? 'critical' : f.usableBalance <= f.ceilingLimit * (lowBalancePercent / 100) ? 'warning' : 'normal';

  const getStatusBadge = (status: FundHealth, usableBalance: number) => {
    if (usableBalance < 0 || status === 'critical') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-700" />
          کسری بحرانی
        </span>
      );
    }
    if (status === 'warning') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-700" />
          نیازمند شارژ
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
        مطلوب
      </span>
    );
  };

  if (items.length === 0) {
    return (
      <section className="card p-4">
        <h3 className="text-base font-bold text-ink">تنخواه‌گردان‌های فعال کارگاه‌ها</h3>
        <EmptyState
          description="هنوز تنخواه فعالی تعریف نشده است."
          action={
            <button type="button" onClick={onViewAllClick} className="btn btn-secondary btn-sm">
              رفتن به تنخواه
            </button>
          }
        />
      </section>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      {/* Widget Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">وضعیت تنخواه‌های فعال کارگاه‌ها</h3>
            <p className="text-xs text-slate-500">پایش موجودی واقعی، مبالغ در انتظار تأیید و مانده قابل مصرف</p>
          </div>
        </div>

        <button
          onClick={onViewAllClick}
          className="text-sm text-amber-700 hover:text-amber-700 font-medium flex items-center gap-1 cursor-pointer"
        >
          <span>ماژول تنخواه</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Petty Cash Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
        {items.map((item) => {
          const isCritical = health(item) === 'critical';
          const isWarning = health(item) === 'warning';

          return (
            <div
              key={item.id}
              className={`p-3 rounded-xl border transition-all text-sm ${
                isCritical
                  ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
                  : isWarning
                  ? 'bg-amber-50/30 border-amber-200 hover:border-amber-400'
                  : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Top: Project & Responsible */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>{formatText(item.projectName)}</span>
                    <span className="text-xs tabular-nums text-slate-500 bg-white px-1 py-1 rounded border border-slate-200">
                      {formatText(item.code)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    مسئول: <strong className="text-slate-700 font-medium">{formatText(item.holderName)}</strong>
                  </div>
                </div>
                <div>{getStatusBadge(health(item), item.usableBalance)}</div>
              </div>

              {/* Balances Display - Strict formula matching prompt */}
              <div className="grid grid-cols-3 gap-2 py-2 px-2 bg-white rounded-lg border border-slate-200/80 mb-2 text-center tabular-nums">
                <div>
                  <span className="text-xs text-slate-500 block mb-1">موجودی واقعی</span>
                  <span className="font-bold text-slate-800 text-sm tabular-nums">
                    <Money rial={item.actualBalance} compact />
                  </span>
                </div>
                <div>
                  <span className="text-sm text-amber-700 block mb-1">در انتظار تأیید</span>
                  <span className="font-bold text-amber-700 text-sm tabular-nums">
                    <Money rial={item.pendingExpenses} compact />
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">قابل مصرف</span>
                  <span
                    className={`font-bold text-sm tabular-nums ${
                      item.usableBalance < 0
                        ? 'text-rose-700 font-bold'
                        : 'text-emerald-700'
                    }`}
                  >
                    <Money rial={item.usableBalance} compact />
                  </span>
                </div>
              </div>

              {/* Bottom: Last Transaction & Charge Action */}
              <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                <div className="truncate max-w-[200px]" title={PETTY_CASH_FUND_LABELS[item.fundType]}>
                  {PETTY_CASH_FUND_LABELS[item.fundType]} · آخرین شارژ: {formatText(item.lastReplenishmentDate)}
                </div>
                <button
                  onClick={() => onChargeClick(item)}
                  className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-100/70 hover:bg-amber-100 px-2 py-1 rounded cursor-pointer transition-colors shrink-0"
                >
                  <PlusCircle className="w-3 h-3" />
                  <span>شارژ تنخواه</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
