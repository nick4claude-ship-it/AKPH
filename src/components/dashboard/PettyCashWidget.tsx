import React from 'react';
import { PettyCash } from '../../types';
import { formatNumber, formatCurrencyCompact } from '../../utils/formatters';
import { Coins, AlertCircle, CheckCircle2, AlertTriangle, PlusCircle, ArrowUpRight } from 'lucide-react';

interface PettyCashWidgetProps {
  items: PettyCash[];
  onChargeClick: (pettyCash: PettyCash) => void;
  onViewAllClick: () => void;
}

export const PettyCashWidget: React.FC<PettyCashWidgetProps> = ({
  items,
  onChargeClick,
  onViewAllClick,
}) => {
  const getStatusBadge = (status: PettyCash['status'], usableBalance: number) => {
    if (usableBalance < 0 || status === 'critical') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          کسری بحرانی
        </span>
      );
    }
    if (status === 'warning') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          نیازمند شارژ
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        مطلوب
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      {/* Widget Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">وضعیت تنخواه‌های فعال کارگاه‌ها</h3>
            <p className="text-[11px] text-slate-500">پایش موجودی واقعی، مبالغ در انتظار تأیید و مانده قابل مصرف</p>
          </div>
        </div>

        <button
          onClick={onViewAllClick}
          className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-0.5 cursor-pointer"
        >
          <span>ماژول تنخواه</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Petty Cash Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
        {items.map((item) => {
          const isCritical = item.usableBalance < 0 || item.status === 'critical';
          const isWarning = item.status === 'warning';

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border transition-all text-xs ${
                isCritical
                  ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
                  : isWarning
                  ? 'bg-amber-50/30 border-amber-200 hover:border-amber-400'
                  : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Top: Project & Responsible */}
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{item.projectName}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-white px-1 py-0.5 rounded border border-slate-200">
                      {item.code}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    مسئول: <strong className="text-slate-700 font-medium">{item.holderName}</strong>
                  </div>
                </div>
                <div>{getStatusBadge(item.status, item.usableBalance)}</div>
              </div>

              {/* Balances Display - Strict formula matching prompt */}
              <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-white rounded-lg border border-slate-200/80 mb-2.5 text-center font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">موجودی واقعی</span>
                  <span className="font-bold text-slate-800 text-xs tabular-nums">
                    {formatCurrencyCompact(item.actualBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-600 block mb-0.5">در انتظار تأیید</span>
                  <span className="font-bold text-amber-600 text-xs tabular-nums">
                    {formatCurrencyCompact(item.pendingExpenses)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">قابل مصرف</span>
                  <span
                    className={`font-bold text-xs tabular-nums ${
                      item.usableBalance < 0
                        ? 'text-rose-600 font-black'
                        : 'text-emerald-700'
                    }`}
                  >
                    {formatCurrencyCompact(item.usableBalance)}
                  </span>
                </div>
              </div>

              {/* Bottom: Last Transaction & Charge Action */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <div className="truncate max-w-[200px]" title={item.lastTransactionDesc}>
                  آخرین: {item.lastTransactionDesc}
                </div>
                <button
                  onClick={() => onChargeClick(item)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-100/70 hover:bg-amber-100 px-2 py-1 rounded cursor-pointer transition-colors shrink-0"
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
