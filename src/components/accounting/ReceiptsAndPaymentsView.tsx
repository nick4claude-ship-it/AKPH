import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Search, CheckCircle2 } from 'lucide-react';
import { ReceiptRecord, FinancialEvent, Counterparty } from '../../types';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { formatText } from '../../utils/formatters';

interface ReceiptsAndPaymentsViewProps {
  type: 'receipts' | 'payments';
  receipts: ReceiptRecord[];
  /** Posted financial events; payments are the TREASURY_PAYMENT events. */
  events: FinancialEvent[];
  counterparties: Counterparty[];
  projectName: (id?: string) => string | undefined;
  /** Receipts and payments are recorded in treasury (which chooses the bank and posts the entry). */
  onOpenTreasury: () => void;
}

/** Accounting view of the cash registers: read-only, every row is backed by a posted journal entry. */
export const ReceiptsAndPaymentsView: React.FC<ReceiptsAndPaymentsViewProps> = ({ type, receipts, events, counterparties, projectName, onOpenTreasury }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const unit = moneyUnitLabel();
  const q = searchTerm.trim();

  const payments = useMemo(
    () =>
      events
        .filter((e) => e.type === 'TREASURY_PAYMENT' && e.status === 'posted')
        .map((e) => ({
          id: e.id,
          journal: e.docNumber || '-',
          reference: String(e.details?.docNumber || '-'),
          date: e.date,
          payee: counterparties.find((c) => c.id === e.counterpartyId)?.name || String(e.details?.pettyCashTitle || e.details?.payableType || '-'),
          project: projectName(e.projectId) || 'دفتر مرکزی',
          account: String(e.details?.bankName || '-'),
          tracking: String(e.details?.trackingNumber || '-'),
          amount: e.amount,
        })),
    [events, counterparties, projectName]
  );

  const filteredReceipts = receipts.filter(
    (r) => !q || [r.docNumber, r.payer, r.projectName, r.trackingNumber, r.destinationAccount].some((v) => (v || '').includes(q))
  );
  const filteredPayments = payments.filter((p) => !q || [p.journal, p.reference, p.payee, p.project, p.tracking].some((v) => v.includes(q)));

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="جستجو"
            placeholder={type === 'receipts' ? 'جستجو در پرداخت‌کننده، شماره پیگیری، پروژه...' : 'جستجو در ذی‌نفع، شماره سند، پروژه...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
        <button
          onClick={onOpenTreasury}
          className={`flex items-center gap-2 font-bold px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer shadow-2xs text-white ${
            type === 'receipts' ? 'bg-teal-700 hover:bg-teal-800' : 'bg-rose-700 hover:bg-rose-800'
          }`}
        >
          {type === 'receipts' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
          <span>{type === 'receipts' ? 'ثبت دریافت در خزانه' : 'پرداخت در خزانه'}</span>
        </button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2 text-sm text-slate-700">
        <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
        <span>
          دریافت و پرداخت فقط در لایه خزانه (با انتخاب بانک یا صندوق و کنترل موجودی) ثبت می‌شود؛ این فهرست از اسناد قطعی همان عملیات ساخته می‌شود.
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="table-scroll">
          {type === 'receipts' ? (
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-3 px-4 tabular-nums">شماره رسید</th>
                  <th className="py-3 px-3">تاریخ</th>
                  <th className="py-3 px-4">پرداخت‌کننده</th>
                  <th className="py-3 px-3">پروژه</th>
                  <th className="py-3 px-3">حساب مقصد</th>
                  <th className="py-3 px-3">روش دریافت</th>
                  <th className="py-3 px-3 tabular-nums">شماره پیگیری</th>
                  <th className="py-3 px-3 tabular-nums">سند حسابداری</th>
                  <th className="py-3 px-3 tabular-nums text-left text-teal-800">مبلغ ({unit})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {filteredReceipts.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{formatText(rec.docNumber)}</td>
                    <td className="py-3 px-3 text-slate-600 text-sm">{formatText(rec.date)}</td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-900">{formatText(rec.payer)}</td>
                    <td className="py-3 px-3 font-sans text-slate-600">{formatText(rec.projectName || 'عمومی')}</td>
                    <td className="py-3 px-3 font-sans text-slate-600 text-sm">{formatText(rec.destinationAccount)}</td>
                    <td className="py-3 px-3 font-sans">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-medium">{formatText(rec.method)}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-xs">{formatText(rec.trackingNumber)}</td>
                    <td className="py-3 px-3 text-slate-500 text-xs">{formatText(rec.journalEntryId || '-')}</td>
                    <td className="py-3 px-3 text-left font-bold text-teal-700 tabular-nums">{formatMoney(rec.amount, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-3 px-4 tabular-nums">سند حسابداری</th>
                  <th className="py-3 px-3">تاریخ</th>
                  <th className="py-3 px-4">ذی‌نفع</th>
                  <th className="py-3 px-3">پروژه</th>
                  <th className="py-3 px-3">پرداخت از</th>
                  <th className="py-3 px-3 tabular-nums">مرجع</th>
                  <th className="py-3 px-3 tabular-nums">شماره پیگیری</th>
                  <th className="py-3 px-3 tabular-nums text-left text-rose-800">مبلغ ({unit})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {filteredPayments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{formatText(pay.journal)}</td>
                    <td className="py-3 px-3 text-slate-600 text-sm">{formatText(pay.date)}</td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-900">{formatText(pay.payee)}</td>
                    <td className="py-3 px-3 font-sans text-slate-600">{formatText(pay.project)}</td>
                    <td className="py-3 px-3 font-sans text-slate-600 text-sm">{formatText(pay.account)}</td>
                    <td className="py-3 px-3 text-slate-500 text-xs">{formatText(pay.reference)}</td>
                    <td className="py-3 px-3 text-slate-500 text-xs">{formatText(pay.tracking)}</td>
                    <td className="py-3 px-3 text-left font-bold text-rose-700 tabular-nums">{formatMoney(pay.amount, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {(type === 'receipts' ? filteredReceipts : filteredPayments).length === 0 && (
          <p className="py-10 text-center text-xs text-slate-500">موردی یافت نشد.</p>
        )}
      </div>
    </div>
  );
};
