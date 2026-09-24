/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CalendarClock, AlertTriangle, CheckCircle2, CreditCard } from 'lucide-react';
import { PaymentRequest } from '../../types';
import { ScheduledPayment } from '../../store/domainSelectors';
import { formatNumber } from '../../utils/formatters';

interface PaymentScheduleTabProps {
  schedule: { rows: ScheduledPayment[]; availableCash: number };
  onPay: (req: PaymentRequest) => void;
}

/** برنامه پرداخت: تعهدات باز به ترتیب سررسید در برابر نقدینگی موجود بانک‌ها و صندوق‌ها. */
export const PaymentScheduleTab: React.FC<PaymentScheduleTabProps> = ({ schedule, onPay }) => {
  const total = schedule.rows.reduce((a, r) => a + r.request.remainingAmount, 0);
  const overdue = schedule.rows.filter((r) => r.overdue);
  const gap = total - schedule.availableCash;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500">نقدینگی در دسترس</span>
          <div className="text-lg font-bold text-emerald-700 font-mono">{formatNumber(schedule.availableCash)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500">جمع تعهدات باز</span>
          <div className="text-lg font-bold text-slate-900 font-mono">{formatNumber(total)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500">سررسید گذشته</span>
          <div className="text-lg font-bold text-rose-700 font-mono">{formatNumber(overdue.reduce((a, r) => a + r.request.remainingAmount, 0))}</div>
          <span className="text-[11px] text-slate-400">{overdue.length.toLocaleString('fa-IR')} فقره</span>
        </div>
        <div className={`p-4 rounded-xl border ${gap > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <span className="text-xs text-slate-600">{gap > 0 ? 'کسری نقدینگی برای کل تعهدات' : 'مازاد نقدینگی پس از تعهدات'}</span>
          <div className={`text-lg font-bold font-mono ${gap > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatNumber(Math.abs(gap))}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead className="bg-slate-50 text-slate-500 text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">سررسید</th>
              <th className="py-2.5 px-3">درخواست / منبع</th>
              <th className="py-2.5 px-3">ذینفع</th>
              <th className="py-2.5 px-3">وضعیت</th>
              <th className="py-2.5 px-3 text-left">مانده</th>
              <th className="py-2.5 px-3 text-left">تجمعی</th>
              <th className="py-2.5 px-3">پوشش نقدینگی</th>
              <th className="py-2.5 px-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schedule.rows.map(({ request: r, overdue: late, cumulative, coveredByCash }) => (
              <tr key={r.id} className={late ? 'bg-rose-50/40' : ''}>
                <td className="py-2.5 px-3 font-mono">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="w-3 h-3 text-slate-400" />
                    {r.dueDate}
                  </span>
                  {late && <div className="text-[10px] text-rose-600 font-bold">سررسید گذشته</div>}
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-mono font-bold">{r.requestNumber}</div>
                  <div className="text-[10px] text-slate-500">
                    {r.sourceType} · {r.sourceRefNumber}
                  </div>
                </td>
                <td className="py-2.5 px-3">{r.beneficiaryName}</td>
                <td className="py-2.5 px-3 text-[11px]">{r.status}</td>
                <td className="py-2.5 px-3 text-left font-mono font-bold">{formatNumber(r.remainingAmount)}</td>
                <td className="py-2.5 px-3 text-left font-mono text-slate-500">{formatNumber(cumulative)}</td>
                <td className="py-2.5 px-3">
                  {coveredByCash ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" /> تأمین
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                      <AlertTriangle className="w-3 h-3" /> کسری
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  {(r.status === 'تأیید مدیرعامل' || r.status === 'در صف پرداخت خزانه') && (
                    <button
                      onClick={() => onPay(r)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500 text-slate-950 text-[11px] font-bold cursor-pointer"
                    >
                      <CreditCard className="w-3 h-3" /> پرداخت
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {schedule.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  تعهد پرداخت باز وجود ندارد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
