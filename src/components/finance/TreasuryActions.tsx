/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeftRight, FileSpreadsheet, Plus, X } from 'lucide-react';
import { TreasuryCheck } from '../../types';
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { usePermission } from '../../store/session';
import { Dialog } from '../../ui/Dialog';
import { MoneyInput } from '../../ui/NumberInput';
import { formatText } from '../../utils/formatters';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import type { TreasuryAccountInput } from '../../store/recordWorkflows';

const overlay = 'fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4';
const panel = 'bg-white rounded-xl max-w-lg w-full p-5 space-y-3 text-sm text-right';
const field = 'w-full p-2 rounded-lg border border-slate-300';
const actionButton = 'flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer';

const DialogHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
    <h3 className="text-base font-bold text-slate-900">{title}</h3>
    <button type="button" onClick={onClose} aria-label="بستن" className="p-1 text-slate-500 cursor-pointer">
      <X className="w-4 h-4" />
    </button>
  </div>
);

const DialogFooter: React.FC<{ error: string | null; submit: string; onClose: () => void }> = ({ error, submit, onClose }) => (
  <>
    {error && (
      <p className="text-rose-700 font-bold" role="alert">
        {error}
      </p>
    )}
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-200 cursor-pointer">
        انصراف
      </button>
      <button type="submit" className="btn btn-primary">
        {submit}
      </button>
    </div>
  </>
);

/** «تعریف حساب بانکی» / «تعریف صندوق»: the account starts at zero; money reaches it only through postings. */
export const NewTreasuryAccountButton: React.FC<{ kind: 'bank' | 'cash'; onToast: (msg: string) => void }> = ({ kind, onToast }) => {
  const wf = useWorkflows();
  const { can } = usePermission();
  const state = useAppState();
  const empty: TreasuryAccountInput = { kind, title: '', bankName: '', branch: '', accountNumber: '', sheba: '', holderName: '', location: '', projectId: '' };
  const [form, setForm] = useState<TreasuryAccountInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!can('payment.execute')) return null;
  const label = kind === 'bank' ? 'تعریف حساب بانکی' : 'تعریف صندوق';
  const set = (k: keyof TreasuryAccountInput, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const close = () => {
    setForm(null);
    setError(null);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const result = wf.createTreasuryAccount(form);
    if (!result.ok) return setError(result.message);
    onToast(result.message);
    close();
  };
  return (
    <>
      <button type="button" onClick={() => setForm(empty)} className={actionButton}>
        <Plus className="w-4 h-4" /> {label}
      </button>
      {form && (
        <Dialog as="form" onClose={close} label={label} overlayClassName={overlay} className={panel} onSubmit={submit}>
          <DialogHeader title={label} onClose={close} />
          <label className="block space-y-1">
            <span className="text-slate-600">عنوان</span>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} required className={field} />
          </label>
          {kind === 'bank' ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-slate-600">نام بانک</span>
                <input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} required className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-600">شعبه</span>
                <input value={form.branch} onChange={(e) => set('branch', e.target.value)} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-600">شماره حساب</span>
                <input value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} className={`${field} tabular-nums`} />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-600">شماره شبا</span>
                <input value={form.sheba} onChange={(e) => set('sheba', e.target.value)} placeholder="IR…" className={`${field} tabular-nums`} />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-slate-600">محل صندوق</span>
                <input value={form.location} onChange={(e) => set('location', e.target.value)} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-600">پروژه</span>
                <select value={form.projectId} onChange={(e) => set('projectId', e.target.value)} className={field}>
                  <option value="">— ستاد مرکزی —</option>
                  {state.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatText(p.name)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label className="block space-y-1">
            <span className="text-slate-600">{kind === 'bank' ? 'صاحب حساب' : 'مسئول صندوق'}</span>
            <input value={form.holderName} onChange={(e) => set('holderName', e.target.value)} className={field} />
          </label>
          <DialogFooter error={error} submit={label} onClose={close} />
        </Dialog>
      )}
    </>
  );
};

/** «انتقال بین حساب‌ها»: bank ↔ bank or cash desk, with its entry; never below zero. */
export const TransferButton: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const wf = useWorkflows();
  const { can } = usePermission();
  const { bankAccounts, cashDesks } = useAppState();
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState(0);
  const [tracking, setTracking] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!can('payment.execute')) return null;
  const close = () => {
    setOpen(false);
    setError(null);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = wf.transferBetweenAccounts({ fromId, toId, amount, trackingNumber: tracking, description });
    if (!result.ok) return setError(result.message);
    onToast(result.message);
    setAmount(0);
    setTracking('');
    setDescription('');
    close();
  };
  const options = (
    <>
      <option value="">— انتخاب حساب —</option>
      {bankAccounts.map((b) => (
        <option key={b.id} value={`bank:${b.id}`}>
          {formatText(b.bankName)} - {formatText(b.accountNumber)} ({formatMoney(b.balance)})
        </option>
      ))}
      {cashDesks.map((c) => (
        <option key={c.id} value={`cash:${c.id}`}>
          {formatText(c.title)} ({formatMoney(c.balance)})
        </option>
      ))}
    </>
  );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={actionButton}>
        <ArrowLeftRight className="w-4 h-4" /> انتقال بین حساب‌ها
      </button>
      {open && (
        <Dialog as="form" onClose={close} label="انتقال وجه بین حساب‌ها" overlayClassName={overlay} className={panel} onSubmit={submit}>
          <DialogHeader title="انتقال وجه بین حساب‌ها" onClose={close} />
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-slate-600">از حساب</span>
              <select value={fromId} onChange={(e) => setFromId(e.target.value)} required className={field}>
                {options}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-slate-600">به حساب</span>
              <select value={toId} onChange={(e) => setToId(e.target.value)} required className={field}>
                {options}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-slate-600">مبلغ ({moneyUnitLabel()})</span>
              <MoneyInput value={amount} onValueChange={setAmount} aria-invalid={amount <= 0} className={`${field} tabular-nums`} />
            </label>
            <label className="block space-y-1">
              <span className="text-slate-600">شماره پیگیری</span>
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} className={`${field} tabular-nums`} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-slate-600">شرح</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
          </label>
          <DialogFooter error={error} submit="ثبت انتقال و صدور سند" onClose={close} />
        </Dialog>
      )}
    </>
  );
};

/** «ورود صورت‌حساب بانک»: rows of the bank statement (CSV) for manual reconciliation. */
export const StatementImportButton: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const wf = useWorkflows();
  const { can } = usePermission();
  const { bankAccounts } = useAppState();
  const [open, setOpen] = useState(false);
  const [bankId, setBankId] = useState('');
  const [csv, setCsv] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!can('payment.execute')) return null;
  const close = () => {
    setOpen(false);
    setError(null);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = wf.importBankStatement(bankId, csv);
    if (!result.ok) return setError(result.message);
    onToast(result.message);
    setCsv('');
    close();
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={actionButton}>
        <FileSpreadsheet className="w-4 h-4" /> ورود صورت‌حساب بانک
      </button>
      {open && (
        <Dialog as="form" onClose={close} label="ورود صورت‌حساب بانک" overlayClassName={overlay} className={panel} onSubmit={submit}>
          <DialogHeader title="ورود صورت‌حساب بانک (CSV)" onClose={close} />
          <label className="block space-y-1">
            <span className="text-slate-600">حساب بانکی</span>
            <select value={bankId} onChange={(e) => setBankId(e.target.value)} required className={field}>
              <option value="">— انتخاب حساب —</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {formatText(b.bankName)} - {formatText(b.accountNumber)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-slate-600">ردیف‌ها: تاریخ، شرح، واریز، برداشت، شماره پیگیری (هر ردیف در یک خط)</span>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} required rows={6} dir="ltr" className={`${field} tabular-nums text-left`} placeholder="1405/07/01,کارمزد,,25000,B2" />
          </label>
          <DialogFooter error={error} submit="ثبت ردیف‌ها" onClose={close} />
        </Dialog>
      )}
    </>
  );
};

/** Pending cheque: «وصول/پاس» or «برگشت» (with a reason), each with its entry. */
export const ChequeStatusActions: React.FC<{ cheque: TreasuryCheck; onToast: (msg: string) => void }> = ({ cheque, onToast }) => {
  const wf = useWorkflows();
  const { can } = usePermission();
  const [bouncing, setBouncing] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (cheque.status !== 'در جریان وصول/سررسید' || !can('payment.execute')) return null;
  const clear = () => onToast(wf.changeChequeStatus(cheque.id, 'cleared', '').message);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = wf.changeChequeStatus(cheque.id, 'bounced', note);
    if (!result.ok) return setError(result.message);
    onToast(result.message);
    setBouncing(false);
    setNote('');
  };
  return (
    <div className="flex gap-1 mt-1">
      <button type="button" onClick={clear} className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold cursor-pointer">
        وصول/پاس
      </button>
      <button type="button" onClick={() => setBouncing(true)} className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer">
        برگشت
      </button>
      {bouncing && (
        <Dialog as="form" onClose={() => setBouncing(false)} label="ثبت چک برگشتی" overlayClassName={overlay} className={panel} onSubmit={submit}>
          <DialogHeader title={`چک برگشتی ${cheque.checkNumber}`} onClose={() => setBouncing(false)} />
          <label className="block space-y-1">
            <span className="text-slate-600">علت برگشت</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} required className={field} />
          </label>
          <DialogFooter error={error} submit="ثبت برگشت و صدور سند" onClose={() => setBouncing(false)} />
        </Dialog>
      )}
    </div>
  );
};
