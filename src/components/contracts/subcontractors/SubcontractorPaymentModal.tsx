/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  SubcontractorProgressStatement,
  BankAccount,
  UserProfile,
} from '../../../types';
import {
  X,
  DollarSign,
  Building,
  CheckCircle2,
  FileCheck2,
  AlertCircle,
  CreditCard,
  Layers,
} from 'lucide-react';

interface SubcontractorPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  statement: SubcontractorProgressStatement | null;
  bankAccounts: BankAccount[];
  currentUser: UserProfile;
  onConfirmPayment: (
    statement: SubcontractorProgressStatement,
    amount: number,
    bankId: string,
    method: 'حواله بانکی پایا/ساتنا' | 'چک صیادی' | 'صندوق تنخواه کارگاه' | 'تهاتر مصالح',
    refNumber: string,
    date: string
  ) => void;
}

export const SubcontractorPaymentModal: React.FC<SubcontractorPaymentModalProps> = ({
  isOpen,
  onClose,
  statement,
  bankAccounts,
  currentUser,
  onConfirmPayment,
}) => {
  if (!isOpen || !statement) return null;

  const [amount, setAmount] = useState<number>(statement.remainingPayable);
  const [bankId, setBankId] = useState<string>(bankAccounts[0]?.id || 'bank-mellat-01');
  const [method, setMethod] = useState<
    'حواله بانکی پایا/ساتنا' | 'چک صیادی' | 'صندوق تنخواه کارگاه' | 'تهاتر مصالح'
  >('حواله بانکی پایا/ساتنا');
  const [refNumber, setRefNumber] = useState<string>(
    `PAYA-${Date.now().toString().slice(-6)}`
  );
  const [paymentDate, setPaymentDate] = useState<string>('۱۴۰۳/۰۷/۰۳');

  const selectedBank = bankAccounts.find((b) => b.id === bankId) || bankAccounts[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    onConfirmPayment(statement, amount, bankId, method, refNumber, paymentDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-emerald-500/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                دستور پرداخت و ثبت هزینه پروژه
              </h3>
              <p className="text-xs text-slate-500">
                مرحله ۵ و ۶ گردش کار: تسویه مطالبات پیمانکار جزء و صدور خودکار سند حسابداری
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Statement details summary */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">عنوان صورت‌وضعیت:</span>
              <strong className="text-slate-900">{statement.statementNumber}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">پیمانکار جزء:</span>
              <strong className="text-slate-800">{statement.subcontractorName}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">پروژه و رشته:</span>
              <span className="font-bold text-amber-800">
                {statement.projectName} ({statement.tradeType})
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-slate-500">مانده قابل تسویه:</span>
              <span className="text-base font-black text-rose-700">
                {(statement.remainingPayable / 1_000_000).toLocaleString('fa-IR')} میلیون تومان
              </span>
            </div>
          </div>

          {/* Amount to pay */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">مبلغ پرداختی (تومان):</label>
            <input
              type="number"
              required
              max={statement.remainingPayable}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-emerald-800 focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-[10px] text-slate-400 block mt-1">
              معادل {(amount / 1_000_000).toLocaleString('fa-IR')} میلیون تومان
            </span>
          </div>

          {/* Payment Method & Bank */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">روش پرداخت:</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                <option value="حواله بانکی پایا/ساتنا">حواله بانکی پایا / ساتنا</option>
                <option value="چک صیادی">چک صیادی بانکی</option>
                <option value="صندوق تنخواه کارگاه">پرداخت نقدی تنخواه کارگاه</option>
                <option value="تهاتر مصالح">تهاتر مصالح و آهن‌آلات</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">حساب بانکی مبدأ پرداخت:</label>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium cursor-pointer"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountNumber} (موجودی:{' '}
                    {(b.balance / 1_000_000).toLocaleString('fa-IR')} م.ت)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">شماره پیگیری / شماره چک:</label>
              <input
                type="text"
                required
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">تاریخ پرداخت / اعمال:</label>
              <input
                type="text"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Automatic Project Cost Booking Notice */}
          <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200/90 text-xs text-emerald-950 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>صدور خودکار سند حسابداری و ثبت در هزینه پروژه:</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              با تأیید پرداخت، به صورت خودکار سند مالی دوبل صادر می‌گردد:
              <br />
              <strong>بدهکار:</strong> حساب بهای تمام شده پیمان / هزینه اجرای پروژه ({statement.projectName})
              <br />
              <strong>بستانکار:</strong> موجودی نزد بانک‌ها ({selectedBank?.bankName || 'بانک'})
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <DollarSign className="w-4 h-4" />
              <span>تأیید پرداخت و ثبت سند هزینه پروژه</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
