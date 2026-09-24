/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Building2,
  HardHat,
  CheckCircle2,
  Undo2,
  X,
  FileText,
  Wallet,
  ChevronLeft,
} from 'lucide-react';
import { Project, DetailedProgressStatement, SubcontractorProgressStatement } from '../../types';
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { useCurrentUser, usePermission } from '../../store/session';
import { Dialog } from '../common/Dialog';
import { CLIENT_STATEMENT_FLOW, SUBCONTRACTOR_STATEMENT_FLOW, creatorOf } from '../../store/workflows';
import { selectDocumentsFor } from '../../store/domainSelectors';
import { CLIENT_APPROVED_STATUSES } from '../../store/state';
import { formatNumber, formatCurrencyCompact } from '../../utils/formatters';
import {
  CLIENT_STATUS_LABELS,
  SUB_STATUS_LABELS,
  CLIENT_FLOW_STEPS,
  SUB_FLOW_STEPS,
  clientFlowIndex,
  subFlowIndex,
} from './statementLabels';
import { formatInt, formatMoney } from '../../utils/money';

type StatementsTab = 'client_statements' | 'subcontractor_statements';

interface ProgressStatementsModuleProps {
  projects: Project[];
  tab: StatementsTab;
  onToast: (msg: string) => void;
}

const FlowBar: React.FC<{ steps: string[]; index: number }> = ({ steps, index }) => (
  <div className="flex items-center gap-1 flex-wrap">
    {steps.map((s, i) => (
      <React.Fragment key={s}>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            i < index ? 'bg-emerald-100 text-emerald-800' : i === index ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-100 text-slate-400'
          }`}
        >
          {s}
        </span>
        {i < steps.length - 1 && <ChevronLeft className="w-3 h-3 text-slate-300" />}
      </React.Fragment>
    ))}
  </div>
);

/**
 * صورت‌وضعیت‌ها — یک مدل داده در store برای هر دو نوع:
 * کارفرما: اندازه‌گیری ← صورت‌وضعیت ← تأیید مشاور ← تأیید کارفرما ← مطالبات ← دریافت (در لایه دریافت‌ها)
 * پیمانکار جزء: کارکرد ← اندازه‌گیری ← تأیید کارگاه ← مدیر پروژه ← مالی ← مدیر ارشد ← بدهی و درخواست پرداخت ← پرداخت (خزانه)
 */
export const ProgressStatementsModule: React.FC<ProgressStatementsModuleProps> = ({ projects, tab, onToast }) => {
  const state = useAppState();
  const wf = useWorkflows();
  const user = useCurrentUser();
  const { check } = usePermission();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [detail, setDetail] = useState<{ kind: 'client' | 'sub'; id: string } | null>(null);
  const [returning, setReturning] = useState<{ kind: 'client' | 'sub'; id: string } | null>(null);
  const [reason, setReason] = useState('');

  const q = searchQuery.trim().toLowerCase();
  const clientRows = useMemo(
    () =>
      state.clientStatements.filter(
        (s) =>
          (selectedProjectId === 'all' || s.projectId === selectedProjectId) &&
          (!q || s.statementNumber.toLowerCase().includes(q) || s.projectName.toLowerCase().includes(q) || s.client.toLowerCase().includes(q))
      ),
    [state.clientStatements, selectedProjectId, q]
  );
  const subRows = useMemo(
    () =>
      state.subcontractorStatements.filter(
        (s) =>
          (selectedProjectId === 'all' || s.projectId === selectedProjectId) &&
          (!q || s.statementNumber.toLowerCase().includes(q) || s.subcontractorName.toLowerCase().includes(q) || s.projectName.toLowerCase().includes(q))
      ),
    [state.subcontractorStatements, selectedProjectId, q]
  );

  const approvedClient = state.clientStatements.filter((s) => CLIENT_APPROVED_STATUSES.includes(s.status));
  const receivable = approvedClient.reduce((a, s) => a + s.remainingPayable, 0);
  const approvedSub = state.subcontractorStatements.filter((s) => s.status === 'management_approved' || s.status === 'paid');
  const payable = approvedSub.reduce((a, s) => a + s.remainingPayable, 0);

  const run = (r: { ok: boolean; message: string }) => onToast(r.message);

  const detailClient = detail?.kind === 'client' ? state.clientStatements.find((s) => s.id === detail.id) : undefined;
  const detailSub = detail?.kind === 'sub' ? state.subcontractorStatements.find((s) => s.id === detail.id) : undefined;
  const detailDocs = detailClient
    ? selectDocumentsFor(state, 'client_statement', detailClient.id)
    : detailSub
      ? selectDocumentsFor(state, 'subcontractor_statement', detailSub.id)
      : [];

  const clientAction = (s: DetailedProgressStatement) => {
    const step = CLIENT_STATEMENT_FLOW[s.status];
    if (step) {
      const permission = check(step.action, { projectId: s.projectId, createdBy: creatorOf(s.workflowHistory) });
      const canReturn = check('client_statement.return', { projectId: s.projectId }).ok;
      return (
        <div className="flex items-center gap-1 justify-end">
          <button
            disabled={!permission.ok}
            title={permission.ok ? '' : permission.reason}
            onClick={() => run(wf.advanceClientStatement(s.id))}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <CheckCircle2 className="w-3 h-3" /> {step.label}
          </button>
          <button disabled={!canReturn} onClick={() => setReturning({ kind: 'client', id: s.id })} className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40 cursor-pointer" title="برگشت جهت اصلاح">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }
    if (CLIENT_APPROVED_STATUSES.includes(s.status) && s.remainingPayable > 0) {
      return (
        <button
          onClick={() => navigate(`/finance/receipts?statement=${s.id}`)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 cursor-pointer mr-auto"
        >
          <Wallet className="w-3 h-3" /> ثبت دریافت
        </button>
      );
    }
    return <span className="text-[11px] text-slate-400">—</span>;
  };

  const subAction = (s: SubcontractorProgressStatement) => {
    const step = SUBCONTRACTOR_STATEMENT_FLOW[s.status];
    if (step) {
      const permission = check(step.action, { projectId: s.projectId, createdBy: creatorOf(s.workflowHistory) });
      const canReturn = check('sub_statement.return', { projectId: s.projectId }).ok;
      return (
        <div className="flex items-center gap-1 justify-end">
          <button
            disabled={!permission.ok}
            title={permission.ok ? '' : permission.reason}
            onClick={() => run(wf.advanceSubcontractorStatement(s.id))}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <CheckCircle2 className="w-3 h-3" /> {step.label}
          </button>
          <button disabled={!canReturn} onClick={() => setReturning({ kind: 'sub', id: s.id })} className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40 cursor-pointer" title="برگشت جهت اصلاح">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }
    if (s.status === 'management_approved' && s.remainingPayable > 0) {
      return (
        <button
          onClick={() => navigate(`/finance/payments?source=${s.id}`)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold hover:bg-amber-600 cursor-pointer mr-auto"
        >
          <Wallet className="w-3 h-3" /> پرداخت در خزانه
        </button>
      );
    }
    return <span className="text-[11px] text-slate-400">—</span>;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded font-mono">
              ماژول صورت‌وضعیت‌ها (Progress Statements)
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              کارفرما ← مطالبات • پیمانکار جزء ← بدهی
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {tab === 'client_statements' ? 'صورت‌وضعیت کارفرما — پولی که شرکت دریافت می‌کند' : 'صورت‌وضعیت پیمانکار جزء — پولی که شرکت پرداخت می‌کند'}
          </h2>
          <div className="mt-1.5">
            <FlowBar steps={tab === 'client_statements' ? CLIENT_FLOW_STEPS : SUB_FLOW_STEPS} index={-1} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => navigate('/statements/client')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === 'client_statements' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
            <span>کارفرما</span>
          </button>
          <button
            onClick={() => navigate('/statements/subcontractor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === 'subcontractor_statements' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
            <span>پیمانکار جزء</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">مانده مطالبات صورت‌وضعیت‌های مصوب کارفرما</span>
            <div className="text-lg font-bold text-blue-700 font-mono">{formatMoney(receivable)}</div>
            <span className="text-[11px] text-slate-400 font-medium">
              {formatInt(approvedClient.length)} صورت‌وضعیت مصوب · وصول در لایه دریافت‌ها
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">مانده بدهی صورت‌وضعیت‌های مصوب پیمانکاران جزء</span>
            <div className="text-lg font-bold text-amber-700 font-mono">{formatMoney(payable)}</div>
            <span className="text-[11px] text-slate-400 font-medium">
              {formatInt(approvedSub.length)} صورت‌وضعیت با تأیید مدیر ارشد · پرداخت فقط در خزانه
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <HardHat className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center gap-3 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
          <input
            type="text"
            placeholder="جستجوی شماره صورت‌وضعیت، پروژه، کارفرما یا پیمانکار..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
        >
          <option value="all">همه پروژه‌ها</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="text-slate-400 mr-auto">
          نقش شما: <strong className="text-slate-700">{user.role}</strong>
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead className="bg-slate-50 text-slate-500 text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">شماره</th>
              <th className="py-2.5 px-3">پروژه / {tab === 'client_statements' ? 'کارفرما' : 'پیمانکار'}</th>
              <th className="py-2.5 px-3 text-left">ناخالص</th>
              <th className="py-2.5 px-3 text-left">کسورات</th>
              <th className="py-2.5 px-3 text-left">خالص</th>
              <th className="py-2.5 px-3 text-left">{tab === 'client_statements' ? 'وصول‌شده' : 'پرداخت‌شده'}</th>
              <th className="py-2.5 px-3 text-left">مانده</th>
              <th className="py-2.5 px-3">مرحله گردش‌کار</th>
              <th className="py-2.5 px-3 text-left">اقدام</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tab === 'client_statements'
              ? clientRows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <button onClick={() => setDetail({ kind: 'client', id: s.id })} className="font-bold text-slate-900 hover:text-amber-700 cursor-pointer text-right">
                        {s.statementNumber}
                      </button>
                      <div className="text-[10px] text-slate-400 font-mono">{s.contractCode}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-800">{s.projectName}</div>
                      <div className="text-[10px] text-slate-500">{s.client}</div>
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono">{formatCurrencyCompact(s.grossAmount)}</td>
                    <td className="py-2.5 px-3 text-left font-mono text-rose-600">{formatCurrencyCompact(s.totalDeductions)}</td>
                    <td className="py-2.5 px-3 text-left font-mono font-bold">{formatCurrencyCompact(s.netPayable)}</td>
                    <td className="py-2.5 px-3 text-left font-mono text-emerald-700">{formatCurrencyCompact(s.receivedAmount)}</td>
                    <td className="py-2.5 px-3 text-left font-mono text-blue-700">
                      {CLIENT_APPROVED_STATUSES.includes(s.status) ? formatCurrencyCompact(s.remainingPayable) : '—'}
                    </td>
                    <td className="py-2.5 px-3 min-w-[140px]">
                      <span className="text-[11px] font-bold text-slate-700">{CLIENT_STATUS_LABELS[s.status]}</span>
                      {CLIENT_STATEMENT_FLOW[s.status] && (
                        <div className="text-[10px] text-slate-400">بعدی: {CLIENT_STATEMENT_FLOW[s.status]!.label}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-left">{clientAction(s)}</td>
                  </tr>
                ))
              : subRows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <button onClick={() => setDetail({ kind: 'sub', id: s.id })} className="font-bold text-slate-900 hover:text-amber-700 cursor-pointer text-right">
                        {s.statementNumber}
                      </button>
                      <div className="text-[10px] text-slate-400 font-mono">{s.subcontractorContractNumber}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-800">{s.projectName}</div>
                      <div className="text-[10px] text-slate-500">
                        {s.subcontractorName} · {s.tradeType}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono">{formatCurrencyCompact(s.grossAmount)}</td>
                    <td className="py-2.5 px-3 text-left font-mono text-rose-600">{formatCurrencyCompact(s.totalDeductions)}</td>
                    <td className="py-2.5 px-3 text-left font-mono font-bold">{formatCurrencyCompact(s.netPayable)}</td>
                    <td className="py-2.5 px-3 text-left font-mono text-emerald-700">{formatCurrencyCompact(s.paidAmount)}</td>
                    <td className="py-2.5 px-3 text-left font-mono text-amber-700">
                      {s.status === 'management_approved' || s.status === 'paid' ? formatCurrencyCompact(s.remainingPayable) : '—'}
                    </td>
                    <td className="py-2.5 px-3 min-w-[140px]">
                      <span className="text-[11px] font-bold text-slate-700">{SUB_STATUS_LABELS[s.status]}</span>
                      {SUBCONTRACTOR_STATEMENT_FLOW[s.status] && (
                        <div className="text-[10px] text-slate-400">
                          بعدی: {SUBCONTRACTOR_STATEMENT_FLOW[s.status]!.label} ({SUBCONTRACTOR_STATEMENT_FLOW[s.status]!.role})
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-left">{subAction(s)}</td>
                  </tr>
                ))}
            {(tab === 'client_statements' ? clientRows : subRows).length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  صورت‌وضعیتی مطابق فیلتر یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {returning && (
        <Dialog
          onClose={() => setReturning(null)}
          label="برگشت صورت‌وضعیت جهت اصلاح"
          overlayClassName="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3 text-xs"
        >
            <h3 className="text-sm font-bold text-slate-900">برگشت صورت‌وضعیت جهت اصلاح</h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="علت برگشت (مثلاً مغایرت متره با صورتجلسه کارگاهی)"
              className="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setReturning(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer">
                انصراف
              </button>
              <button
                disabled={!reason.trim()}
                onClick={() => {
                  const why = reason.trim();
                  run(returning.kind === 'client' ? wf.returnClientStatement(returning.id, why) : wf.returnSubcontractorStatement(returning.id, why));
                  setReturning(null);
                  setReason('');
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold cursor-pointer disabled:opacity-40"
              >
                ثبت برگشت
              </button>
            </div>
        </Dialog>
      )}

      {(detailClient || detailSub) && (
        <Dialog
          onClose={() => setDetail(null)}
          label={detailClient?.statementNumber || detailSub?.statementNumber || 'جزئیات صورت‌وضعیت'}
          overlayClassName="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto"
          className="bg-white rounded-2xl w-full max-w-3xl text-xs overflow-hidden"
        >
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">{detailClient?.statementNumber || detailSub?.statementNumber}</h3>
                <p className="text-[11px] text-slate-400">
                  {detailClient ? `${detailClient.projectName} · ${detailClient.client}` : `${detailSub!.projectName} · ${detailSub!.subcontractorName}`}
                </p>
              </div>
              <button onClick={() => setDetail(null)} aria-label="بستن" className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <FlowBar
                steps={detailClient ? CLIENT_FLOW_STEPS : SUB_FLOW_STEPS}
                index={detailClient ? clientFlowIndex(detailClient.status, detailClient.remainingPayable) : subFlowIndex(detailSub!.status, detailSub!.remainingPayable)}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                  ['ناخالص', (detailClient || detailSub)!.grossAmount],
                  ['کسورات', (detailClient || detailSub)!.totalDeductions],
                  ['خالص', (detailClient || detailSub)!.netPayable],
                  ['مانده', (detailClient || detailSub)!.remainingPayable],
                ].map(([label, v]) => (
                  <div key={label as string} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">{label}</div>
                    <div className="font-bold font-mono">{formatMoney(v as number, false)}</div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-slate-600">
                سند حسابداری:{' '}
                <strong className="font-mono">{detailClient?.accountingJournalEntryId || detailSub?.projectExpenseRecordId || 'هنوز صادر نشده (پس از تأیید نهایی)'}</strong>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1.5">سوابق گردش‌کار</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {(detailClient?.workflowHistory || detailSub?.workflowHistory || []).map((h) => (
                    <div key={`${h.date}|${h.time}|${h.fromStatus}|${h.toStatus}|${h.user}`} className="flex justify-between bg-slate-50 rounded px-2 py-1">
                      <span>
                        {h.action} — {h.user} ({h.role})
                      </span>
                      <span className="text-slate-400 font-mono">{h.date}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1.5">اسناد پیوست (مرکز اسناد)</h4>
                {detailDocs.length === 0 ? (
                  <p className="text-slate-400">سندی متصل نیست.</p>
                ) : (
                  detailDocs.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 py-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>{d.title}</span>
                      <span className="text-slate-400">({d.type})</span>
                    </div>
                  ))
                )}
              </div>
            </div>
        </Dialog>
      )}
    </div>
  );
};
