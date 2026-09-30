/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CheckCircle2, XCircle, ShieldCheck, Plus, AlertTriangle, Wallet, FilePlus2 } from 'lucide-react';
import type { ContractServerInfo, GuaranteeKind, UserProfile } from '../../types';
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { canDecideAmendment, contractServerActions } from '../../store/views/contracts';
import { MoneyInput } from '../../ui/NumberInput';
import { formatDecimal, formatText } from '../../utils/formatters';
import { formatInt } from '../../utils/money';
import { getRelativePersianDate } from '../../utils/date';
import { Money } from '../common/Money';

const GUARANTEE_KINDS: [GuaranteeKind, string][] = [
  ['performance', 'حسن انجام تعهدات'],
  ['advance', 'پیش‌پرداخت'],
  ['retention', 'استرداد کسور وجه‌الضمان'],
  ['bid', 'شرکت در مناقصه'],
  ['other', 'سایر'],
];
const KIND_LABEL = Object.fromEntries(GUARANTEE_KINDS) as Record<GuaranteeKind, string>;
const STATUS_LABEL: Record<string, string> = { pending: 'در انتظار تأیید', active: 'فعال (تأییدشده)', rejected: 'رد شده', closed: 'بسته شده' };
const GUARANTEE_STATUS: Record<string, string> = { active: 'فعال', released: 'آزاد شده', expired: 'منقضی' };

interface ContractServerPanelProps {
  contract: { id: string; projectId: string; server?: ContractServerInfo };
  kind: 'client' | 'subcontract';
  currentUser: UserProfile;
  onToast?: (msg: string) => void;
  /** Opens the amendment form for this contract. */
  onNewAmendment?: () => void;
}

/**
 * Approval, amendments, guarantees and (subcontracts) advance of a contract kept on the server (akph/v1).
 * Every figure is the server's; the buttons send commands and the server decides.
 */
export const ContractServerPanel: React.FC<ContractServerPanelProps> = ({ contract, kind, currentUser, onToast, onNewAmendment }) => {
  const wf = useWorkflows();
  const { contractAmendments } = useAppState();
  const s = contract.server;
  const [comment, setComment] = useState('');
  const [adding, setAdding] = useState(false);
  const [g, setG] = useState({ kind: 'performance' as GuaranteeKind, guaranteeNo: '', bank: '', amount: 0, issueDate: getRelativePersianDate(0), dueDate: getRelativePersianDate(365), notes: '' });
  const [advance, setAdvance] = useState(0);
  if (!s) return null;
  const act = contractServerActions(currentUser, contract);
  const amendments = contractAmendments.filter((a) => a.contractId === contract.id);
  const toast = (r: { message: string }) => onToast?.(r.message);

  return (
    <div className="card p-4 space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs text-slate-500 block">وضعیت قرارداد در دفاتر رسمی</span>
          <strong className="text-slate-900">
            {formatText(s.number)} — {STATUS_LABEL[s.status] || s.status}
            {act.pendingStep && <span className="text-amber-700"> (مرحله: تأیید {formatText(act.pendingStep)})</span>}
          </strong>
          {s.rejectReason && <span className="block text-rose-700">علت رد: {formatText(s.rejectReason)}</span>}
        </div>
        {s.status === 'pending' && (
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="توضیح یا علت رد" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="توضیح / علت رد" className="p-2 rounded-lg border border-slate-300 text-sm" />
            <button type="button" disabled={!act.canApprove} title={act.approveReason} onClick={() => toast(wf.decideContract(contract.id, 'approve', comment))} className="btn btn-primary disabled:opacity-40 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> تأیید
            </button>
            <button type="button" disabled={!act.canApprove || !comment.trim()} title={act.approveReason} onClick={() => toast(wf.decideContract(contract.id, 'reject', comment))} className="btn btn-secondary disabled:opacity-40 flex items-center gap-1">
              <XCircle className="w-4 h-4" /> رد
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div>
          <span className="text-xs text-slate-500 block">الحاقیه‌های تأییدشده</span>
          <strong className="tabular-nums"><Money rial={s.amendmentsTotal} /></strong>
        </div>
        <div>
          <span className="text-xs text-slate-500 block">{kind === 'client' ? 'پیش‌دریافت' : 'پیش‌پرداخت'} (سقف <Money rial={s.advanceExpected} compact />)</span>
          <strong className="tabular-nums"><Money rial={s.advanceAmount} /></strong>
        </div>
        <div>
          <span className="text-xs text-slate-500 block">مانده پیش‌پرداخت مستهلک‌نشده</span>
          <strong className="tabular-nums"><Money rial={s.advanceRemaining} /></strong>
        </div>
        <div>
          <span className="text-xs text-slate-500 block">{kind === 'client' ? 'دریافت‌شده' : 'پرداخت‌شده'}</span>
          <strong className="tabular-nums"><Money rial={s.settledAmount} /></strong>
        </div>
        <div>
          <span className="text-xs text-slate-500 block">مانده {kind === 'client' ? 'مطالبات' : 'بدهی'}</span>
          <strong className="tabular-nums"><Money rial={s.balanceDue} /></strong>
        </div>
      </div>

      <div className="text-xs text-slate-600">
        کسورات قرارداد: پیش‌پرداخت {formatDecimal(s.percents.advance)}٪ · حسن انجام کار {formatDecimal(s.percents.retention)}٪ · بیمه {formatDecimal(s.percents.insurance)}٪ · مالیات تکلیفی {formatDecimal(s.percents.tax)}٪
        {s.percents.other > 0 && <> · سایر {formatDecimal(s.percents.other)}٪</>}
        {Object.keys(s.deductions).length > 0 && (
          <span className="block mt-1">
            کسورات انباشته:{' '}
            {Object.entries(s.deductions).map(([k, v]) => (
              <span key={k} className="ml-2 tabular-nums">
                {formatText(k)}: <Money rial={v} compact />
              </span>
            ))}
          </span>
        )}
      </div>

      {/* Amendments */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900">الحاقیه‌ها ({formatInt(amendments.length)})</span>
          {act.active && act.canManage && onNewAmendment && (
            <button type="button" onClick={onNewAmendment} className="text-sm font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer">
              <FilePlus2 className="w-4 h-4" /> ثبت الحاقیه
            </button>
          )}
        </div>
        {amendments.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <span>
              {formatText(a.number)} — <Money rial={a.amount} /> {a.extendedDays ? <>· تمدید {formatInt(a.extendedDays)} روز</> : null} · {formatText(a.status)}
              {a.rejectReason && <span className="text-rose-700"> ({formatText(a.rejectReason)})</span>}
            </span>
            {canDecideAmendment(currentUser, a) && (
              <span className="flex gap-2">
                <button type="button" onClick={() => toast(wf.decideContractAmendment(a.id, 'approve', ''))} className="btn btn-primary disabled:opacity-40 text-xs">
                  تأیید
                </button>
                <button type="button" disabled={!comment.trim()} title="علت رد را در کادر توضیح بنویسید" onClick={() => toast(wf.decideContractAmendment(a.id, 'reject', comment))} className="btn btn-secondary disabled:opacity-40 text-xs">
                  رد
                </button>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Guarantees */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> ضمانت‌نامه‌ها ({formatInt(s.guarantees.length)})
          </span>
          {act.canManage && (
            <button type="button" onClick={() => setAdding((v) => !v)} className="text-sm font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer">
              <Plus className="w-4 h-4" /> ثبت ضمانت‌نامه
            </button>
          )}
        </div>
        {s.guarantees.map((x) => (
          <div key={x.id} className={`flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 ${x.dueSoon ? 'text-rose-800' : ''}`}>
            <span>
              {x.dueSoon && <AlertTriangle className="inline w-4 h-4 ml-1" aria-label="سررسید نزدیک" />}
              {KIND_LABEL[x.kind]} {formatText(x.guaranteeNo)} — {formatText(x.bank)} — <Money rial={x.amount} /> — سررسید {formatText(x.dueDate)} ({GUARANTEE_STATUS[x.status]})
            </span>
            {act.canManage && x.status === 'active' && (
              <span className="flex gap-2">
                <button type="button" onClick={() => toast(wf.updateContractGuarantee(x.id, { status: 'released' }))} className="btn btn-secondary text-xs">
                  آزادسازی
                </button>
                <button type="button" onClick={() => toast(wf.updateContractGuarantee(x.id, { status: 'expired' }))} className="btn btn-secondary text-xs">
                  منقضی
                </button>
              </span>
            )}
          </div>
        ))}
        {adding && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="text-xs text-slate-600">
              نوع
              <select value={g.kind} onChange={(e) => setG({ ...g, kind: e.target.value as GuaranteeKind })} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white">
                {GUARANTEE_KINDS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              شماره ضمانت‌نامه
              <input value={g.guaranteeNo} onChange={(e) => setG({ ...g, guaranteeNo: e.target.value })} className="mt-1 w-full p-2 rounded border border-slate-300" />
            </label>
            <label className="text-xs text-slate-600">
              بانک صادرکننده
              <input value={g.bank} onChange={(e) => setG({ ...g, bank: e.target.value })} className="mt-1 w-full p-2 rounded border border-slate-300" />
            </label>
            <label className="text-xs text-slate-600">
              مبلغ
              <MoneyInput value={g.amount} onValueChange={(v) => setG({ ...g, amount: v })} className="mt-1 w-full p-2 rounded border border-slate-300" />
            </label>
            <label className="text-xs text-slate-600">
              تاریخ صدور
              <input value={g.issueDate} onChange={(e) => setG({ ...g, issueDate: e.target.value })} className="mt-1 w-full p-2 rounded border border-slate-300 tabular-nums" />
            </label>
            <label className="text-xs text-slate-600">
              سررسید
              <input value={g.dueDate} onChange={(e) => setG({ ...g, dueDate: e.target.value })} className="mt-1 w-full p-2 rounded border border-slate-300 tabular-nums" />
            </label>
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="button"
                disabled={!g.guaranteeNo.trim() || !g.bank.trim() || !(g.amount > 0)}
                onClick={() => {
                  toast(wf.addContractGuarantee(contract.id, g));
                  setAdding(false);
                }}
                className="btn btn-primary disabled:opacity-40"
              >
                ثبت ضمانت‌نامه
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subcontract advance: a treasury payment request */}
      {kind === 'subcontract' && act.active && act.canManage && (
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <label className="text-xs text-slate-600">
            درخواست پیش‌پرداخت (حداکثر <Money rial={s.advanceExpected} compact />)
            <MoneyInput value={advance} onValueChange={setAdvance} className="mt-1 w-48 p-2 rounded border border-slate-300" />
          </label>
          <button type="button" disabled={!(advance > 0)} onClick={() => toast(wf.requestSubcontractAdvance(contract.id, advance))} className="btn btn-secondary disabled:opacity-40 flex items-center gap-1">
            <Wallet className="w-4 h-4" /> ارسال به خزانه (درخواست پرداخت)
          </button>
        </div>
      )}
    </div>
  );
};
