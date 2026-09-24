/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RefreshCw, Send, X, ExternalLink, History } from 'lucide-react';
import {
  PettyCashAccount,
  PettyCashReplenishment,
  PettyCashReplenishmentRequest,
  PaymentRequest,
  PETTY_CASH_FUND_LABELS,
} from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface ReplenishmentViewProps {
  accounts: PettyCashAccount[];
  replenishments: PettyCashReplenishment[];
  requests: PettyCashReplenishmentRequest[];
  paymentRequests: PaymentRequest[];
  onRequestReplenishment: (fundId: string, amount: number, reason: string) => { ok: boolean; message: string };
  onOpenTreasury: () => void;
}

/**
 * شارژ تنخواه: درخواست در این ماژول ثبت و خودکار به خزانه ارسال می‌شود؛ پرداخت (بستانکار بانک / بدهکار تنخواه)
 * فقط در خزانه انجام می‌شود.
 */
export const ReplenishmentView: React.FC<ReplenishmentViewProps> = ({
  accounts,
  replenishments,
  requests,
  paymentRequests,
  onRequestReplenishment,
  onOpenTreasury,
}) => {
  const [modalFund, setModalFund] = useState<PettyCashAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = (fund: PettyCashAccount) => {
    setModalFund(fund);
    setAmount(String(Math.max(0, fund.ceilingLimit - fund.actualBalance)));
    setReason('شارژ نوبتی تنخواه بر اساس مخارج مصوب دوره');
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFund) return;
    const result = onRequestReplenishment(modalFund.id, Number(amount.replace(/[^\d]/g, '')), reason);
    if (!result.ok) return setError(result.message);
    setModalFund(null);
  };

  const treasuryStatus = (req: PettyCashReplenishmentRequest) =>
    paymentRequests.find((p) => p.sourceType === 'شارژ و تسویه تنخواه' && p.sourceRefId === req.id)?.status;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">درخواست شارژ تنخواه‌ها</h2>
          <p className="text-xs text-slate-500">درخواست ← تأیید و پرداخت در خزانه ← سند بستانکار بانک / بدهکار تنخواه ← افزایش موجودی صندوق</p>
        </div>
        <button onClick={onOpenTreasury} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer">
          <ExternalLink className="w-3.5 h-3.5" /> کارتابل پرداخت خزانه
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead className="bg-slate-50 text-slate-500 text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">صندوق تنخواه</th>
              <th className="py-2.5 px-3">نوع</th>
              <th className="py-2.5 px-3 text-left">موجودی واقعی</th>
              <th className="py-2.5 px-3 text-left">قابل مصرف</th>
              <th className="py-2.5 px-3 text-left">سقف (تنظیمات)</th>
              <th className="py-2.5 px-3 text-left">ظرفیت شارژ</th>
              <th className="py-2.5 px-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts
              .filter((a) => a.status === 'active')
              .map((a) => {
                const room = Math.max(0, a.ceilingLimit - a.actualBalance);
                const openReq = requests.find((r) => r.pettyCashId === a.id && r.status === 'در انتظار تأیید مالی');
                return (
                  <tr key={a.id}>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{a.title}</div>
                      <div className="text-[10px] text-slate-500">
                        {a.projectName} · {a.holderName}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">{PETTY_CASH_FUND_LABELS[a.fundType]}</td>
                    <td className="py-2.5 px-3 text-left font-mono">{formatNumber(a.actualBalance)}</td>
                    <td className={`py-2.5 px-3 text-left font-mono ${a.usableBalance <= a.minBalanceWarning ? 'text-rose-600 font-bold' : ''}`}>
                      {formatNumber(a.usableBalance)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono text-slate-500">{formatNumber(a.ceilingLimit)}</td>
                    <td className="py-2.5 px-3 text-left font-mono text-emerald-700">{formatNumber(room)}</td>
                    <td className="py-2.5 px-3 text-left">
                      {openReq ? (
                        <span className="text-[11px] text-amber-700">درخواست باز: {openReq.requestNumber}</span>
                      ) : (
                        <button
                          disabled={room <= 0}
                          onClick={() => open(a)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold disabled:opacity-40 cursor-pointer mr-auto"
                        >
                          <RefreshCw className="w-3 h-3" /> درخواست شارژ
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-amber-600" /> درخواست‌های شارژ
          </h3>
          {requests.length === 0 && <p className="text-xs text-slate-400">درخواستی ثبت نشده است.</p>}
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs border-b border-slate-50 py-1.5">
              <div>
                <div className="font-bold">
                  {r.requestNumber} · {r.pettyCashTitle}
                </div>
                <div className="text-[10px] text-slate-500">
                  {r.date} · {r.requesterName} · {r.reason}
                </div>
              </div>
              <div className="text-left">
                <div className="font-mono font-bold">{formatNumber(r.suggestedAmount)}</div>
                <div className="text-[10px] text-slate-500">
                  {r.status}
                  {treasuryStatus(r) ? ` · خزانه: ${treasuryStatus(r)}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600" /> شارژهای پرداخت‌شده
          </h3>
          {replenishments.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs border-b border-slate-50 py-1.5">
              <div>
                <div className="font-bold">{r.pettyCashTitle}</div>
                <div className="text-[10px] text-slate-500">
                  {r.date} · {r.sourceBankAccountName} · {r.trackingNumber}
                </div>
              </div>
              <div className="text-left">
                <div className="font-mono font-bold text-emerald-700">{formatNumber(r.amount)}</div>
                <div className="text-[10px] text-slate-500 font-mono">{r.journalEntryId || '-'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalFund && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">درخواست شارژ {modalFund.title}</h3>
              <button type="button" onClick={() => setModalFund(null)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-500">
              موجودی {formatCurrency(modalFund.actualBalance)} · سقف {formatCurrency(modalFund.ceilingLimit)}
            </p>
            <label className="block space-y-1">
              <span className="text-slate-600">مبلغ درخواستی (تومان)</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} className="w-full p-2 rounded-lg border border-slate-300 font-mono" />
            </label>
            <label className="block space-y-1">
              <span className="text-slate-600">علت</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full p-2 rounded-lg border border-slate-300" />
            </label>
            {error && <p className="text-rose-600 font-bold">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalFund(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer">
                انصراف
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold cursor-pointer">
                ثبت و ارسال به خزانه
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
