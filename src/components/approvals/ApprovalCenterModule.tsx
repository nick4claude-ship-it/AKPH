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
import { approvalSummary } from '../../store/views/approvals';
import { useApprovalActions, APPROVAL_MODULE_PATHS } from '../../store/useApprovalActions';
import { useCurrentUser, usePermission } from '../../store/session';
import { Dialog } from '../../ui/Dialog';
import { formatCurrencyCompact, formatNumber, formatText } from '../../utils/formatters';
import { formatInt, formatMoney } from '../../utils/money';
import { Money } from '../common/Money';

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
  const { check } = usePermission();
  const permissionFor = (a: ApprovalItem) => check(a.action, a.context);
  const navigate = useNavigate();
  const { approve, reject } = useApprovalActions();
  const approvals = useMemo(() => selectApprovals(state), [state]);

  const [moduleFilter, setModuleFilter] = useState<ApprovalModule | 'all' | 'mine'>('all');
  const [search, setSearch] = useState('');
  const [rejecting, setRejecting] = useState<ApprovalItem | null>(null);
  const [reason, setReason] = useState('');

  const { groups, totalAmount } = useMemo(() => approvalSummary(approvals), [approvals]);

  const q = search.trim().toLowerCase();
  const rows = approvals.filter(
    (a) =>
      (moduleFilter === 'all' || (moduleFilter === 'mine' ? permissionFor(a).ok : a.module === moduleFilter)) &&
      (!q || a.docNumber.toLowerCase().includes(q) || a.title.toLowerCase().includes(q) || a.projectName.toLowerCase().includes(q) || (a.counterpartyName || '').toLowerCase().includes(q))
  );
  const mine = approvals.filter((a) => permissionFor(a).ok).length;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-slate-900 text-amber-300 font-bold px-2 py-1 rounded tabular-nums">Approval Center</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">هر رکورد در ماژول مالک خود باقی می‌ماند</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" /> کارتابل تأییدات مرکزی مدیریت
          </h2>
          <p className="text-xs text-slate-500">
            {formatInt(approvals.length)} مورد در انتظار به ارزش <Money rial={totalAmount} compact /> ·{' '}
            {formatInt(mine)} مورد در حیطه نقش شما ({user.role})
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
          <input aria-label="جستجوی شماره، عنوان، پروژه یا طرف حساب"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی شماره، عنوان، پروژه یا طرف حساب..."
            className="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <button
          onClick={() => setModuleFilter('all')}
          className={`p-2 rounded-xl border text-right cursor-pointer ${moduleFilter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}
        >
          <div className="text-sm opacity-70">همه موارد</div>
          <div className="text-sm font-bold">{formatInt(approvals.length)}</div>
        </button>
        <button
          onClick={() => setModuleFilter('mine')}
          className={`p-2 rounded-xl border text-right cursor-pointer ${moduleFilter === 'mine' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-white border-slate-200'}`}
        >
          <div className="text-sm opacity-70">کارتابل من</div>
          <div className="text-sm font-bold">{formatInt(mine)}</div>
        </button>
        {groups.map(([mod, g]) => (
          <button
            key={mod}
            onClick={() => setModuleFilter(mod)}
            className={`p-2 rounded-xl border text-right cursor-pointer ${moduleFilter === mod ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}
          >
            <div className="text-sm opacity-70 truncate">{formatText(g.label)}</div>
            <div className="text-sm font-bold">{formatInt(g.count)}</div>
            <div className="text-sm opacity-70 tabular-nums"><Money rial={g.amount} compact /></div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs table-scroll">
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-200">
            <tr>
              <th className="py-2 px-3">نوع / شماره</th>
              <th className="py-2 px-3">شرح</th>
              <th className="py-2 px-3">پروژه</th>
              <th className="py-2 px-3">درخواست‌کننده</th>
              <th className="py-2 px-3 text-left">مبلغ</th>
              <th className="py-2 px-3">مرحله در انتظار</th>
              <th className="py-2 px-3 text-center">پیوست</th>
              <th className="py-2 px-3 text-left">اقدام</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((a) => {
              const permission = permissionFor(a);
              const allowed = permission.ok;
              return (
                <tr key={a.id} className="hover:bg-slate-50/70">
                  <td className="py-2 px-3">
                    <div className="text-xs text-slate-500">{formatText(a.moduleLabel)}</div>
                    <div className="font-bold text-slate-900 tabular-nums">{formatText(a.docNumber)}</div>
                  </td>
                  <td className="py-2 px-3 max-w-[240px]">
                    <div className="truncate text-slate-800" title={a.title}>
                      {formatText(a.title)}
                    </div>
                    {a.counterpartyName && <div className="text-xs text-slate-500 truncate">طرف حساب: {formatText(a.counterpartyName)}</div>}
                  </td>
                  <td className="py-2 px-3">
                    <div className="text-slate-800">{formatText(a.projectName)}</div>
                    {a.costCenterName && <div className="text-xs text-slate-500">{formatText(a.costCenterName)}</div>}
                  </td>
                  <td className="py-2 px-3 text-slate-700">
                    {formatText(a.requester)}
                    <div className="text-xs text-slate-500 tabular-nums">{formatText(a.date)}</div>
                  </td>
                  <td className="py-2 px-3 text-left tabular-nums font-bold">{formatMoney(a.amount, false)}</td>
                  <td className="py-2 px-3">
                    <div className="font-bold text-slate-800">{formatText(a.stage)}</div>
                    <div className="text-xs text-slate-500">تأییدکننده: {formatText(a.approverRole)}</div>
                  </td>
                  <td className="py-2 px-3 text-center">
                    {a.documentCount ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Paperclip className="w-3 h-3" />
                        {formatInt(a.documentCount)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700" title="سند ناقص">
                        <AlertTriangle className="w-3 h-3" />
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => navigate(APPROVAL_MODULE_PATHS[a.module])}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                        title="مشاهده در ماژول مالک"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={!allowed}
                        title={allowed ? 'تأیید' : permission.reason}
                        onClick={() => onToast(approve(a).message)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 disabled:opacity-40 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" /> تأیید
                      </button>
                      <button
                        disabled={!allowed}
                        title={allowed ? 'رد / برگشت' : permission.reason}
                        onClick={() => setRejecting(a)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100 disabled:opacity-40 cursor-pointer"
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
                <td colSpan={8} className="py-10 text-center text-slate-500">
                  موردی در انتظار تأیید نیست.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <Dialog
          onClose={() => setRejecting(null)}
          label={`رد / برگشت ${rejecting.moduleLabel} ${rejecting.docNumber}`}
          overlayClassName="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl p-5 text-right space-y-3 text-sm"
        >
            <h3 className="text-base font-bold text-slate-900">
              رد / برگشت {formatText(rejecting.moduleLabel)} {formatText(rejecting.docNumber)}
            </h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="علت رد یا برگشت برای ماژول مالک ثبت می‌شود"
              className="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejecting(null)} className="px-3 py-2 rounded-lg border border-slate-200 cursor-pointer">
                انصراف
              </button>
              <button
                disabled={!reason.trim()}
                onClick={() => {
                  onToast(reject(rejecting, reason.trim()).message);
                  setRejecting(null);
                  setReason('');
                }}
                className="px-3 py-2 rounded-lg bg-rose-700 text-white font-bold cursor-pointer disabled:opacity-40"
              >
                ثبت
              </button>
            </div>
        </Dialog>
      )}
    </div>
  );
};
