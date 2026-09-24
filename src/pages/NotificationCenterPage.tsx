/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertCircle, AlertTriangle, Info, EyeOff, RotateCcw, ArrowUpLeft } from 'lucide-react';
import { useAppState, useStoreSlice } from '../store/AppStore';
import { selectNotifications } from '../store/domainSelectors';
import { NotificationKind, AlertPriority } from '../types';
import { formatCurrencyCompact } from '../utils/formatters';

const KIND_LABELS: Record<NotificationKind, string> = {
  low_stock: 'موجودی پایین انبار',
  low_petty_cash: 'موجودی کم تنخواه',
  contract_ending: 'قرارداد رو به اتمام',
  overdue_receivable: 'مطالبات معوق',
  payable_due: 'بدهی سررسیدشده',
  approval_required: 'تأیید لازم',
  missing_document: 'سند ناقص',
};

const PRIORITY_STYLE: Record<AlertPriority, { icon: typeof Info; box: string; badge: string; label: string }> = {
  critical: { icon: AlertCircle, box: 'border-rose-200 bg-rose-50/40', badge: 'bg-rose-100 text-rose-800', label: 'بحرانی' },
  warning: { icon: AlertTriangle, box: 'border-amber-200 bg-amber-50/40', badge: 'bg-amber-100 text-amber-800', label: 'هشدار' },
  info: { icon: Info, box: 'border-blue-200 bg-blue-50/30', badge: 'bg-blue-100 text-blue-800', label: 'اطلاع' },
};

/** مرکز اعلان‌ها: همه هشدارها از داده‌های store محاسبه می‌شوند؛ فقط «بستن» ذخیره می‌شود. */
export const NotificationCenterPage: React.FC = () => {
  const state = useAppState();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useStoreSlice('dismissedNotificationIds');
  const [kind, setKind] = useState<NotificationKind | 'all'>('all');
  const [showDismissed, setShowDismissed] = useState(false);

  const all = useMemo(() => selectNotifications(state, true), [state]);
  const visible = all.filter((n) => (showDismissed || !dismissed.includes(n.id)) && (kind === 'all' || n.kind === kind));
  const counts = (Object.keys(KIND_LABELS) as NotificationKind[]).map((k) => [k, all.filter((n) => n.kind === k && !dismissed.includes(n.id)).length] as const);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">مرکز اعلان‌ها و هشدارهای سیستم</h2>
            <p className="text-xs text-slate-500">محاسبه‌شده از موجودی انبار و تنخواه، قراردادها، مطالبات، بدهی‌ها، کارتابل تأیید و پیوست اسناد</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} />
          نمایش اعلان‌های بسته‌شده
        </label>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setKind('all')}
          className={`px-3 py-1.5 rounded-lg border cursor-pointer ${kind === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
        >
          همه ({all.filter((n) => !dismissed.includes(n.id)).length.toLocaleString('fa-IR')})
        </button>
        {counts.map(([k, n]) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`px-3 py-1.5 rounded-lg border cursor-pointer ${kind === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            {KIND_LABELS[k]} ({n.toLocaleString('fa-IR')})
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {visible.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">اعلان فعالی در این دسته وجود ندارد.</div>
        )}
        {visible.map((n) => {
          const style = PRIORITY_STYLE[n.priority];
          const Icon = style.icon;
          const isDismissed = dismissed.includes(n.id);
          return (
            <div key={n.id} className={`rounded-xl border p-3.5 flex items-start justify-between gap-3 ${style.box} ${isDismissed ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3 min-w-0">
                <Icon className="w-4 h-4 mt-0.5 shrink-0 text-slate-600" />
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.badge}`}>{style.label}</span>
                    <span className="text-[10px] text-slate-500 bg-white/70 px-1.5 py-0.5 rounded border border-slate-200">{KIND_LABELS[n.kind]}</span>
                    <h3 className="text-xs font-bold text-slate-900">{n.title}</h3>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{n.description}</p>
                  <div className="text-[10px] text-slate-400 flex gap-3">
                    {n.relatedProjectName && <span>پروژه: {n.relatedProjectName}</span>}
                    {typeof n.amount === 'number' && <span>مبلغ: {formatCurrencyCompact(n.amount)}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {n.actionPath && (
                  <button
                    onClick={() => navigate(n.actionPath!)}
                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <ArrowUpLeft className="w-3 h-3" />
                    {n.actionLabel || 'اقدام'}
                  </button>
                )}
                <button
                  onClick={() => setDismissed((prev) => (isDismissed ? prev.filter((x) => x !== n.id) : [...prev, n.id]))}
                  title={isDismissed ? 'بازگردانی' : 'بستن اعلان'}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-white cursor-pointer"
                >
                  {isDismissed ? <RotateCcw className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
