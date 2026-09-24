/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  DetailedProgressStatement,
  StatementPayment,
  Contract,
  BankAccount,
  UserProfile,
} from '../../types';
import { X, CheckCircle2, DollarSign, Calendar, Building } from 'lucide-react';

interface RecordReceiptModalProps {
  statements: DetailedProgressStatement[];
  contracts: Contract[];
  bankAccounts: BankAccount[];
  currentUser: UserProfile;
  onClose: () => void;
  onSavePayment: (
    payment: StatementPayment,
    updatedStatement: DetailedProgressStatement,
    updatedContract: Contract,
    destinationBankId?: string
  ) => void;
}

export const RecordReceiptModal: React.FC<RecordReceiptModalProps> = ({
  statements,
  contracts,
  bankAccounts,
  currentUser,
  onClose,
  onSavePayment,
}) => {
  // Statements with unpaid claims
  const payableStatements = statements.filter((s) => s.remainingPayable > 0);
  const [selectedStatementId, setSelectedStatementId] = useState(
    payableStatements[0]?.id || statements[0]?.id || ''
  );

  const selectedStatement = statements.find((s) => s.id === selectedStatementId) || statements[0];
  const linkedContract = contracts.find((c) => c.id === selectedStatement?.contractId);

  const [date, setDate] = useState('۱۴۰۳/۰۷/۰۵');
  const [amount, setAmount] = useState<number>(selectedStatement ? selectedStatement.remainingPayable : 500_000_000);
  const [method, setMethod] = useState<'حواله ساتنا/پایا' | 'اوراق خزانه اسلامی (اخزا)' | 'چک صیادی' | 'تهاتر ملک/زمین'>(
    'حواله ساتنا/پایا'
  );
  const [referenceNumber, setReferenceNumber] = useState('SAT-1403-99841');
  const [destinationBankId, setDestinationBankId] = useState(bankAccounts[0]?.id || '');
  const [payerAccount, setPayerAccount] = useState('حساب تمرکز وجوه کارفرما (بانک ملی)');
  const [notes, setNotes] = useState('واریز وجه صورت‌وضعیت با کسر کسورات قانونی');

  const selectedBank = bankAccounts.find((b) => b.id === destinationBankId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatement || !linkedContract) return;

    const newPayment: StatementPayment = {
      id: `sp-${Date.now()}`,
      statementId: selectedStatement.id,
      statementNumber: selectedStatement.statementNumber,
      contractId: linkedContract.id,
      date,
      amount,
      method,
      referenceNumber,
      payerAccount,
      destinationBank: selectedBank ? `${selectedBank.bankName} (${selectedBank.accountNumber})` : 'بانک شرکت',
      notes,
      journalEntryId: `ACC-REC-${Date.now().toString().slice(-4)}`,
    };

    // Update statement
    const newReceived = selectedStatement.receivedAmount + amount;
    const newRemaining = Math.max(0, selectedStatement.netPayable - newReceived);
    const newPaymentStatus = newRemaining === 0 ? 'Paid' : 'Partially Paid';

    const updatedStatement: DetailedProgressStatement = {
      ...selectedStatement,
      receivedAmount: newReceived,
      remainingPayable: newRemaining,
      paymentStatus: newPaymentStatus,
      status: newRemaining === 0 ? 'paid' : selectedStatement.status,
    };

    // Update contract
    const updatedContract: Contract = {
      ...linkedContract,
      receivedValue: linkedContract.receivedValue + amount,
      receivableValue: Math.max(0, linkedContract.receivableValue - amount),
    };

    onSavePayment(newPayment, updatedStatement, updatedContract, destinationBankId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in duration-150">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">ثبت وصولی و دریافت وجه صورت‌وضعیت</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                کاهش حساب‌های دریافتنی، افزایش موجودی بانک و صدور خودکار سند حسابداری
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">انتخاب صورت‌وضعیت مطالبات:</label>
            <select
              value={selectedStatementId}
              onChange={(e) => {
                setSelectedStatementId(e.target.value);
                const st = statements.find((s) => s.id === e.target.value);
                if (st) setAmount(st.remainingPayable);
              }}
              className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
            >
              {statements.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.statementNumber} · {s.projectName} (مانده طلب: {s.remainingPayable.toLocaleString('fa-IR')} تومان)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">مبلغ واریزی / وصولی (تومان):</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold text-emerald-700"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {(amount / 1_000_000_000).toFixed(3)} میلیارد تومان
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">روش وصول / نوع وجه:</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
              >
                <option value="حواله ساتنا/پایا">حواله نقدی ساتنا / پایا</option>
                <option value="اوراق خزانه اسلامی (اخزا)">اوراق خزانه اسلامی (اخزا - با سود حفظ قدرت)</option>
                <option value="چک صیادی">چک صیادی کارفرما</option>
                <option value="تهاتر ملک/مصالح">تهاتر ملک / حواله مصالح</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">شماره ارجاع / پیگیری / کد رهگیری:</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">تاریخ وصول / واریز:</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">حساب بانکی مقصد شرکت:</label>
              <select
                value={destinationBankId}
                onChange={(e) => setDestinationBankId(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountNumber} (موجودی: {(b.balance / 1_000_000).toFixed(0)} م.ت)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">حساب مبدا (کارفرما / خزانه):</label>
              <input
                type="text"
                value={payerAccount}
                onChange={(e) => setPayerAccount(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">توضیحات و بابت سند:</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300"
            />
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-950 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              با تأیید این فرم، سند حسابداری دوبل (بدهکار: بانک / بستانکار: حساب‌های دریافتنی کارفرما) به شکل خودکار در ماژول حسابداری ثبت می‌گردد.
            </span>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
            >
              ثبت وصولی و صدور سند
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
