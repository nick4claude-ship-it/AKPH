/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownLeft, Plus, X } from 'lucide-react';
import { ReceiptRecord } from '../../types';
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { formatNumber, formatCurrencyCompact } from '../../utils/formatters';
import { Dialog } from '../common/Dialog';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { MoneyInput } from '../common/NumberInput';

type ReceiptSource = NonNullable<ReceiptRecord['sourceType']>;

/**
 * لایه دریافت‌ها: مطالبات ← دریافت ← بانک ← حسابداری. هر دریافت صورت‌وضعیت با ارجاع statementId ثبت می‌شود.
 */
export const TreasuryReceiptsTab: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const state = useAppState();
  const wf = useWorkflows();
  const [params] = useSearchParams();
  const preselected = params.get('statement') || '';

  const collectible = useMemo(
    () => state.clientStatements.filter((s) => ['approved_by_employer', 'claimed', 'partially_paid'].includes(s.status) && s.remainingPayable > 0),
    [state.clientStatements]
  );

  const [open, setOpen] = useState(Boolean(preselected));
  const [sourceType, setSourceType] = useState<ReceiptSource>('صورت‌وضعیت کارفرما');
  const [statementId, setStatementId] = useState(preselected);
  const [counterpartyId, setCounterpartyId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [amount, setAmount] = useState(() => state.clientStatements.find((s) => s.id === preselected)?.remainingPayable || 0);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<ReceiptRecord['method']>('حواله بانکی');
  const [tracking, setTracking] = useState('');

  const statement = state.clientStatements.find((s) => s.id === statementId);
  const clients = state.counterparties.filter((c) => c.kind === 'client');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return setError('مبلغ دریافت باید بیش از صفر باشد.');
    if (sourceType === 'صورت‌وضعیت کارفرما' && statement && amount > statement.remainingPayable) {
      return setError(`مبلغ از مانده مطالبات این صورت‌وضعیت (${formatMoney(statement.remainingPayable)}) بیشتر است.`);
    }
    if (!bankAccountId) return setError('حساب بانکی مقصد را انتخاب کنید.');
    const result = wf.recordReceipt({
      sourceType,
      statementId: sourceType === 'صورت‌وضعیت کارفرما' ? statementId : undefined,
      counterpartyId: sourceType === 'صورت‌وضعیت کارفرما' ? undefined : counterpartyId,
      projectId: sourceType === 'صورت‌وضعیت کارفرما' ? undefined : projectId,
      amount,
      bankAccountId,
      method,
      trackingNumber: tracking || '-',
    });
    if (!result.ok) return setError(result.message);
    onToast(result.message);
    setError(null);
    setOpen(false);
    setAmount(0);
    setTracking('');
  };

  const totalReceived = state.receipts.reduce((a, r) => a + r.amount, 0);
  const receivable = collectible.reduce((a, s) => a + s.remainingPayable, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500">مانده مطالبات قابل وصول</span>
          <div className="text-lg font-bold text-blue-700 font-mono">{formatMoney(receivable, false)}</div>
          <span className="text-[11px] text-slate-400">{collectible.length.toLocaleString('fa-IR')} صورت‌وضعیت مصوب</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500">جمع دریافت‌های ثبت‌شده</span>
          <div className="text-lg font-bold text-emerald-700 font-mono">{formatMoney(totalReceived, false)}</div>
          <span className="text-[11px] text-slate-400">{state.receipts.length.toLocaleString('fa-IR')} فقره</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-center">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> ثبت دریافت جدید
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead className="bg-slate-50 text-slate-500 text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">شماره / تاریخ</th>
              <th className="py-2.5 px-3">منبع دریافت</th>
              <th className="py-2.5 px-3">پرداخت‌کننده</th>
              <th className="py-2.5 px-3">پروژه</th>
              <th className="py-2.5 px-3">بانک مقصد</th>
              <th className="py-2.5 px-3 text-left">مبلغ</th>
              <th className="py-2.5 px-3">سند</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.receipts.map((r) => {
              const st = r.statementId ? state.clientStatements.find((s) => s.id === r.statementId) : undefined;
              return (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3">
                    <div className="font-mono font-bold text-slate-900">{r.docNumber}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{r.date}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div>{r.sourceType || 'سایر'}</div>
                    {st && <div className="text-[10px] text-blue-700">{st.statementNumber}</div>}
                  </td>
                  <td className="py-2.5 px-3">{r.payer}</td>
                  <td className="py-2.5 px-3">{r.projectName || '-'}</td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-600">{r.destinationAccount}</td>
                  <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-700">{formatMoney(r.amount, false)}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{r.journalEntryId || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <Dialog as="form" onClose={() => setOpen(false)} label="ثبت دریافت (مطالبات ← دریافت ← بانک ← حسابداری)" overlayClassName="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-3 text-xs text-right" onSubmit={submit}>
          
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> ثبت دریافت (مطالبات ← دریافت ← بانک ← حسابداری)
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block space-y-1">
              <span className="text-slate-600">منبع دریافت</span>
              <select value={sourceType} onChange={(e) => setSourceType(e.target.value as ReceiptSource)} className="w-full p-2 rounded-lg border border-slate-300">
                <option value="صورت‌وضعیت کارفرما">صورت‌وضعیت کارفرما</option>
                <option value="پیش‌پرداخت">پیش‌پرداخت (پیش‌دریافت از کارفرما)</option>
                <option value="سایر درآمدها">سایر درآمدها</option>
              </select>
            </label>
            {sourceType === 'صورت‌وضعیت کارفرما' ? (
              <label className="block space-y-1">
                <span className="text-slate-600">صورت‌وضعیت مصوب</span>
                <select
                  value={statementId}
                  onChange={(e) => {
                    setStatementId(e.target.value);
                    const s = collectible.find((x) => x.id === e.target.value);
                    if (s) setAmount(s.remainingPayable);
                  }}
                  required
                  className="w-full p-2 rounded-lg border border-slate-300"
                >
                  <option value="">— انتخاب صورت‌وضعیت —</option>
                  {collectible.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.statementNumber} · {s.projectName} · مانده {formatCurrencyCompact(s.remainingPayable)}
                    </option>
                  ))}
                </select>
                {statement && <span className="text-[10px] text-slate-500">کارفرما: {statement.client}</span>}
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-slate-600">پرداخت‌کننده</span>
                  <select value={counterpartyId} onChange={(e) => setCounterpartyId(e.target.value)} required className="w-full p-2 rounded-lg border border-slate-300">
                    <option value="">— انتخاب —</option>
                    {(sourceType === 'پیش‌پرداخت' ? clients : state.counterparties).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-600">پروژه</span>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300">
                    <option value="">— بدون پروژه —</option>
                    {state.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <label className="block space-y-1">
              <span className="text-slate-600">حساب بانکی مقصد</span>
              <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required className="w-full p-2 rounded-lg border border-slate-300">
                <option value="">— انتخاب حساب —</option>
                {state.bankAccounts
                  .filter((b) => b.status === 'فعال')
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-slate-600">مبلغ ({moneyUnitLabel()})</span>
                <MoneyInput
                  value={amount}
                  onValueChange={(v) => {
                    setAmount(v);
                    setError(null);
                  }}
                  aria-invalid={amount <= 0 || (!!statement && sourceType === 'صورت‌وضعیت کارفرما' && amount > statement.remainingPayable)}
                  className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-600">روش</span>
                <select value={method} onChange={(e) => setMethod(e.target.value as ReceiptRecord['method'])} className="w-full p-2 rounded-lg border border-slate-300">
                  {(['حواله بانکی', 'چک صیادی', 'پوز بانکی', 'تهاتر'] as const).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-slate-600">شماره پیگیری</span>
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 font-mono" />
            </label>
            {error && (
              <p className="text-rose-700 font-bold" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer">
                انصراف
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer">
                ثبت دریافت و صدور سند
              </button>
            </div>
          </Dialog>
      )}
    </div>
  );
};
