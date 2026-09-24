/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, XCircle, Search, ExternalLink, Paperclip, AlertTriangle } from 'lucide-react';
import { ApprovalItem, ApprovalModule } from '../../types';
import { useAppState } from '../../store/AppStore';
import { selectApprovals } from '../../store/domainSelectors';
import { useApprovalActions, APPROVAL_MODULE_PATHS } from '../../store/useApprovalActions';
import { useCurrentUser, canAct } from '../../store/session';
import { formatCurrencyCompact, formatNumber } from '../../utils/formatters';

interface ApprovalCenterModuleProps {
  onToast: (msg: string) => void;
}

/**
 * کارتابل تأییدات مرکزی: همه موارد در انتظار از store جمع می‌شوند و تأیید/رد به گردش‌کار ماژول مالک برمی‌گردد؛
 * رکورد همیشه در ماژول اصلی خودش باقی می‌ماند.
 */
export const ApprovalCenterModule: React.FC<ApprovalCenterModuleProps> = ({ onToast }) => {
  const state = useAppState();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { approve, reject } = useApprovalActions();
  const approvals = useMemo(() => selectApprovals(state), [state]);

  const [moduleFilter, setModuleFilter] = useState<ApprovalModule | 'all' | 'mine'>('all');
  const [search, setSearch] = useState('');
  const [rejecting, setRejecting] = useState<ApprovalItem | null>(null);
  const [reason, setReason] = useState('');

  const groups = useMemo(() => {
    const m = new Map<ApprovalModule, { label: string; count: number; amount: number }>();
    for (const a of approvals) {
      const g = m.get(a.module) || { label: a.moduleLabel, count: 0, amount: 0 };
      g.count++;
      g.amount += a.amount;
      m.set(a.module, g);
    }
    return [...m.entries()];
  }, [approvals]);

  const q = search.trim().toLowerCase();
  const rows = approvals.filter(
    (a) =>
      (moduleFilter === 'all' || (moduleFilter === 'mine' ? canAct(user, a.approverRole) : a.module === moduleFilter)) &&
      (!q || a.docNumber.toLowerCase().includes(q) || a.title.toLowerCase().includes(q) || a.projectName.toLowerCase().includes(q) || (a.counterpartyName || '').toLowerCase().includes(q))
  );
  const mine = approvals.filter((a) => canAct(user, a.approverRole)).length;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-slate-900 text-amber-300 font-bold px-2 py-0.5 rounded font-mono">Approval Center</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">هر رکورد در ماژول مالک خود باقی می‌ماند</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" /> کارتابل تأییدات مرکزی مدیریت
          </h2>
          <p className="text-xs text-slate-500">
            {approvals.length.toLocaleString('fa-IR')} مورد در انتظار به ارزش {formatCurrencyCompact(approvals.reduce((s, a) => s + a.amount, 0))} ·{' '}
            {mine.toLocaleString('fa-IR')} مورد در حیطه نقش شما ({user.role})
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی شماره، عنوان، پروژه یا طرف حساب..."
            className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <button
          onClick={() => setModuleFilter('all')}
          className={`p-2.5 rounded-xl border text-right cursor-pointer ${moduleFilter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}
        >
          <div className="text-[10px] opacity-70">همه موارد</div>
          <div className="text-sm font-bold">{approvals.length.toLocaleString('fa-IR')}</div>
        </button>
        <button
          onClick={() => setModuleFilter('mine')}
          className={`p-2.5 rounded-xl border text-right cursor-pointer ${moduleFilter === 'mine' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-white border-slate-200'}`}
        >
          <div className="text-[10px] opacity-70">کارتابل من</div>
          <div className="text-sm font-bold">{mine.toLocaleString('fa-IR')}</div>
        </button>
        {groups.map(([mod, g]) => (
          <button
            key={mod}
            onClick={() => setModuleFilter(mod)}
            className={`p-2.5 rounded-xl border text-right cursor-pointer ${moduleFilter === mod ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}
          >
            <div className="text-[10px] opacity-70 truncate">{g.label}</div>
            <div className="text-sm font-bold">{g.count.toLocaleString('fa-IR')}</div>
            <div className="text-[10px] opacity-70 font-mono">{formatCurrencyCompact(g.amount)}</div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead className="bg-slate-50 text-slate-500 text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">نوع / شماره</th>
              <th className="py-2.5 px-3">شرح</th>
              <th className="py-2.5 px-3">پروژه</th>
              <th className="py-2.5 px-3">درخواست‌کننده</th>
              <th className="py-2.5 px-3 text-left">مبلغ</th>
              <th className="py-2.5 px-3">مرحله در انتظار</th>
              <th className="py-2.5 px-3 text-center">پیوست</th>
              <th className="py-2.5 px-3 text-left">اقدام</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((a) => {
              const allowed = canAct(user, a.approverRole);
              return (
                <tr key={a.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3">
                    <div className="text-[10px] text-slate-500">{a.moduleLabel}</div>
                    <div className="font-bold text-slate-900 font-mono">{a.docNumber}</div>
                  </td>
                  <td className="py-2.5 px-3 max-w-[240px]">
                    <div className="truncate text-slate-800" title={a.title}>
                      {a.title}
                    </div>
                    {a.counterpartyName && <div className="text-[10px] text-slate-500 truncate">طرف حساب: {a.counterpartyName}</div>}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="text-slate-800">{a.projectName}</div>
                    {a.costCenterName && <div className="text-[10px] text-slate-500">{a.costCenterName}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {a.requester}
                    <div className="text-[10px] text-slate-400 font-mono">{a.date}</div>
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono font-bold">{formatNumber(a.amount)}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-800">{a.stage}</div>
                    <div className="text-[10px] text-slate-500">تأییدکننده: {a.approverRole}</div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {a.documentCount ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Paperclip className="w-3 h-3" />
                        {a.documentCount.toLocaleString('fa-IR')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-500" title="سند ناقص">
                        <AlertTriangle className="w-3 h-3" />
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => navigate(APPROVAL_MODULE_PATHS[a.module])}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                        title="مشاهده در ماژول مالک"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={!allowed}
                        title={allowed ? 'تأیید' : `نیازمند نقش ${a.approverRole}`}
                        onClick={() => onToast(approve(a).message)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" /> تأیید
                      </button>
                      <button
                        disabled={!allowed}
                        onClick={() => setRejecting(a)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold hover:bg-rose-100 disabled:opacity-40 cursor-pointer"
                      >
                        <XCircle className="w-3 h-3" /> رد/برگشت
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400">
                  موردی در انتظار تأیید نیست.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-5 text-right space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900">
              رد / برگشت {rejecting.moduleLabel} {rejecting.docNumber}
            </h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="علت رد یا برگشت برای ماژول مالک ثبت می‌شود"
              className="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejecting(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer">
                انصراف
              </button>
              <button
                onClick={() => {
                  onToast(reject(rejecting, reason.trim() || 'عدم تطابق با مستندات').message);
                  setRejecting(null);
                  setReason('');
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
              >
                ثبت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
