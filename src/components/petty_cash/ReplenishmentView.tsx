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
import { formatCurrency, formatNumber, formatText } from '../../utils/formatters';
import { Dialog } from '../../ui/Dialog';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { fundRoom, openReplenishRequest } from '../../store/views/pettyCash';
import { Money } from '../common/Money';

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
    setAmount(String(fundRoom(fund)));
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
        <button onClick={onOpenTreasury} className="btn btn-secondary">
          <ExternalLink className="w-3.5 h-3.5" /> کارتابل پرداخت خزانه
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 table-scroll">
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-200">
            <tr>
              <th className="py-2 px-3">صندوق تنخواه</th>
              <th className="py-2 px-3">نوع</th>
              <th className="py-2 px-3 text-left">موجودی واقعی</th>
              <th className="py-2 px-3 text-left">قابل مصرف</th>
              <th className="py-2 px-3 text-left">سقف (تنظیمات)</th>
              <th className="py-2 px-3 text-left">ظرفیت شارژ</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts
              .filter((a) => a.status === 'active')
              .map((a) => {
                const room = fundRoom(a);
                const openReq = openReplenishRequest(requests, a.id);
                return (
                  <tr key={a.id}>
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-900">{formatText(a.title)}</div>
                      <div className="text-xs text-slate-500">
                        {formatText(a.projectName)} · {formatText(a.holderName)}
                      </div>
                    </td>
                    <td className="py-2 px-3">{PETTY_CASH_FUND_LABELS[a.fundType]}</td>
                    <td className="py-2 px-3 text-left tabular-nums">{formatMoney(a.actualBalance, false)}</td>
                    <td className={`py-2 px-3 text-left tabular-nums ${a.usableBalance <= a.minBalanceWarning ? 'text-rose-700 font-bold' : ''}`}>
                      {formatMoney(a.usableBalance, false)}
                    </td>
                    <td className="py-2 px-3 text-left tabular-nums text-slate-500">{formatMoney(a.ceilingLimit, false)}</td>
                    <td className="py-2 px-3 text-left tabular-nums text-emerald-700">{formatMoney(room, false)}</td>
                    <td className="py-2 px-3 text-left">
                      {openReq ? (
                        <span className="text-sm text-amber-700">درخواست باز: {formatText(openReq.requestNumber)}</span>
                      ) : (
                        <button
                          disabled={room <= 0}
                          onClick={() => open(a)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold disabled:opacity-40 cursor-pointer mr-auto"
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
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-amber-700" /> درخواست‌های شارژ
          </h3>
          {requests.length === 0 && <p className="text-xs text-slate-500">درخواستی ثبت نشده است.</p>}
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border-b border-slate-50 py-2">
              <div>
                <div className="font-bold">
                  {formatText(r.requestNumber)} · {formatText(r.pettyCashTitle)}
                </div>
                <div className="text-xs text-slate-500">
                  {formatText(r.date)} · {formatText(r.requesterName)} · {formatText(r.reason)}
                </div>
              </div>
              <div className="text-left">
                <div className="tabular-nums font-bold">{formatMoney(r.suggestedAmount, false)}</div>
                <div className="text-xs text-slate-500">
                  {formatText(r.status)}
                  {treasuryStatus(r) ? ` · خزانه: ${treasuryStatus(r)}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-700" /> شارژهای پرداخت‌شده
          </h3>
          {replenishments.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border-b border-slate-50 py-2">
              <div>
                <div className="font-bold">{formatText(r.pettyCashTitle)}</div>
                <div className="text-xs text-slate-500">
                  {formatText(r.date)} · {formatText(r.sourceBankAccountName)} · {formatText(r.trackingNumber)}
                </div>
              </div>
              <div className="text-left">
                <div className="tabular-nums font-bold text-emerald-700">{formatMoney(r.amount, false)}</div>
                <div className="text-xs text-slate-500 tabular-nums">{formatText(r.journalEntryId || '-')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalFund && (
        <Dialog as="form" onClose={() => setModalFund(null)} label="درخواست شارژ" overlayClassName="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" className="bg-white rounded-xl w-full max-w-md p-5 space-y-3 text-sm" onSubmit={submit}>
          
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">درخواست شارژ {formatText(modalFund.title)}</h3>
              <button type="button" onClick={() => setModalFund(null)} className="p-1 text-slate-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-500">
              موجودی <Money rial={modalFund.actualBalance} /> · سقف <Money rial={modalFund.ceilingLimit} />
            </p>
            <label className="block space-y-1">
              <span className="text-slate-600">مبلغ درخواستی ({moneyUnitLabel()})</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} className="w-full p-2 rounded-lg border border-slate-300 tabular-nums" />
            </label>
            <label className="block space-y-1">
              <span className="text-slate-600">علت</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full p-2 rounded-lg border border-slate-300" />
            </label>
            {error && <p className="text-rose-700 font-bold">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalFund(null)} className="px-3 py-2 rounded-lg border border-slate-200 cursor-pointer">
                انصراف
              </button>
              <button type="submit" className="btn btn-primary">
                ثبت و ارسال به خزانه
              </button>
            </div>
          </Dialog>
      )}
    </div>
  );
};
