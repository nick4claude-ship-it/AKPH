import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  CreditCard,
  Building2,
  Layers,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  ReceiptRecord,
  PaymentRecord,
  BankAccount,
  Project,
  Subledger,
} from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface ReceiptsAndPaymentsViewProps {
  type: 'receipts' | 'payments';
  receipts: ReceiptRecord[];
  payments: PaymentRecord[];
  bankAccounts: BankAccount[];
  projects: Project[];
  subledgers: Subledger[];
  onAddReceipt: (record: ReceiptRecord) => void;
  onAddPayment: (record: PaymentRecord) => void;
  isNewModalOpen: boolean;
  setIsNewModalOpen: (open: boolean) => void;
}

export const ReceiptsAndPaymentsView: React.FC<ReceiptsAndPaymentsViewProps> = ({
  type,
  receipts,
  payments,
  bankAccounts,
  projects,
  subledgers,
  onAddReceipt,
  onAddPayment,
  isNewModalOpen,
  setIsNewModalOpen,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // New Receipt Form State
  const [recDate, setRecDate] = useState('۱۴۰۳/۰۷/۰۱');
  const [recAmount, setRecAmount] = useState<number>(0);
  const [recPayer, setRecPayer] = useState('');
  const [recProjectId, setRecProjectId] = useState('');
  const [recBank, setRecBank] = useState(bankAccounts[0]?.bankName || '');
  const [recMethod, setRecMethod] = useState<'حواله بانکی' | 'چک صیادی' | 'نقد' | 'پوز بانکی' | 'تهاتر'>('حواله بانکی');
  const [recTracking, setRecTracking] = useState('');
  const [recDesc, setRecDesc] = useState('');

  // New Payment Form State
  const [payDate, setPayDate] = useState('۱۴۰۳/۰۷/۰۱');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payIncurredExpense, setPayIncurredExpense] = useState<number>(0);
  const [payPayee, setPayPayee] = useState('');
  const [payProjectId, setPayProjectId] = useState('');
  const [payCostCenter, setPayCostCenter] = useState('کارگاه پروژه');
  const [payAccount, setPayAccount] = useState(bankAccounts[0]?.bankName || '');
  const [payMethod, setPayMethod] = useState<'حواله ساتنا/پایا' | 'چک بانکی صیادی' | 'نقد' | 'کارت تنخواه'>('حواله ساتنا/پایا');
  const [payRef, setPayRef] = useState('');
  const [payDesc, setPayDesc] = useState('');

  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recAmount || !recPayer) return;

    const project = projects.find((p) => p.id === recProjectId);

    const newRecord: ReceiptRecord = {
      id: `rec-${Date.now()}`,
      docNumber: `REC-1403-0${Math.floor(200 + Math.random() * 800)}`,
      date: recDate,
      amount: recAmount,
      payer: recPayer,
      receiver: 'شرکت سازه گستران پارس',
      projectId: project?.id,
      projectName: project?.name,
      destinationAccount: recBank,
      method: recMethod,
      trackingNumber: recTracking || `TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      description: recDesc,
      status: 'وصول شده',
    };

    onAddReceipt(newRecord);
    setIsNewModalOpen(false);
    setRecAmount(0);
    setRecPayer('');
    setRecDesc('');
  };

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || !payPayee) return;

    const project = projects.find((p) => p.id === payProjectId);
    const incurred = payIncurredExpense > 0 ? payIncurredExpense : payAmount;
    const remaining = Math.max(0, incurred - payAmount);

    const newRecord: PaymentRecord = {
      id: `pay-${Date.now()}`,
      docNumber: `PAY-1403-0${Math.floor(500 + Math.random() * 500)}`,
      date: payDate,
      amount: payAmount,
      payee: payPayee,
      payerAccount: payAccount,
      projectId: project?.id,
      projectName: project?.name,
      costCenter: payCostCenter,
      method: payMethod,
      referenceNumber: payRef || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      description: payDesc,
      expenseIncurred: incurred,
      payableRemaining: remaining,
      status: 'پرداخت قطعی',
    };

    onAddPayment(newRecord);
    setIsNewModalOpen(false);
    setPayAmount(0);
    setPayIncurredExpense(0);
    setPayPayee('');
    setPayDesc('');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                type === 'receipts'
                  ? 'جستجو در پرداخت‌کننده، شماره پیگیری، پروژه...'
                  : 'جستجو در دریافت‌کننده وجه، شماره چک، پروژه...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className={`flex items-center gap-1.5 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-2xs ${
            type === 'receipts' ? 'bg-teal-500 hover:bg-teal-600 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>{type === 'receipts' ? 'ثبت دریافت وجه / چک' : 'ثبت پرداخت و تادیه'}</span>
        </button>
      </div>

      {/* Logical Rule Showcase Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {type === 'receipts' ? (
              <>
                <strong>اصل تفکیک درآمد از دریافت:</strong> وصولی‌های نقدی یا اسناد دریافتی، مطالبات را کاهش می‌دهند و لزوماً برابر با درآمد کارکرد دوره نیستند.
              </>
            ) : (
              <>
                <strong>اصل تفکیک هزینه از پرداخت (Expense ≠ Payment):</strong> پرداخت وجه ممکن است علی‌الحساب، پیش‌پرداخت یا تادیه بدهی فاکتورهای گذشته باشد.
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-[11px] font-bold text-slate-600 shrink-0">
          {type === 'receipts' ? 'Revenue ≠ Receipt' : 'Expense ≠ Payment & Approved ≠ Paid'}
        </span>
      </div>

      {/* Table of Records */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {type === 'receipts' ? (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4 font-mono">شماره رسید</th>
                  <th className="py-3 px-3">تاریخ</th>
                  <th className="py-3 px-4">پرداخت‌کننده (کارفرما / شخص)</th>
                  <th className="py-3 px-3">پروژه مرتبط</th>
                  <th className="py-3 px-3">حساب مقصد</th>
                  <th className="py-3 px-3">روش دریافت</th>
                  <th className="py-3 px-3 font-mono">شماره پیگیری / چک</th>
                  <th className="py-3 px-3 font-mono text-left text-teal-800">مبلغ وصولی (تومان)</th>
                  <th className="py-3 px-4 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {receipts.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{rec.docNumber}</td>
                    <td className="py-3 px-3 text-slate-600 text-[11px]">{rec.date}</td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-900">{rec.payer}</td>
                    <td className="py-3 px-3 font-sans text-slate-600">{rec.projectName || 'عمومی'}</td>
                    <td className="py-3 px-3 font-sans text-slate-600 text-[11px]">{rec.destinationAccount}</td>
                    <td className="py-3 px-3 font-sans">
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                        {rec.method}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">{rec.trackingNumber}</td>
                    <td className="py-3 px-3 text-left font-bold text-teal-700 tabular-nums">
                      {formatCurrency(rec.amount)}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4 font-mono">شماره دستور</th>
                  <th className="py-3 px-3">تاریخ</th>
                  <th className="py-3 px-4">دریافت‌کننده وجه (بستانکار)</th>
                  <th className="py-3 px-3">پروژه و مرکز هزینه</th>
                  <th className="py-3 px-3">حساب پرداخت‌کننده</th>
                  <th className="py-3 px-3">روش پرداخت</th>
                  <th className="py-3 px-3 font-mono text-left text-slate-500">کل هزینه فاکتور</th>
                  <th className="py-3 px-3 font-mono text-left text-rose-800">مبلغ پرداختی (تادیه)</th>
                  <th className="py-3 px-3 font-mono text-left text-amber-800">مانده تعهد (بدهی)</th>
                  <th className="py-3 px-4 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {payments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{pay.docNumber}</td>
                    <td className="py-3 px-3 text-slate-600 text-[11px]">{pay.date}</td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-900">{pay.payee}</td>
                    <td className="py-3 px-3 font-sans text-slate-600">
                      <span className="block font-medium">{pay.projectName || 'دفتر مرکزی'}</span>
                      <span className="text-[10px] text-slate-400">{pay.costCenter}</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-600 text-[11px]">{pay.payerAccount}</td>
                    <td className="py-3 px-3 font-sans">
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                        {pay.method}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-left tabular-nums text-slate-500">
                      {formatCurrency(pay.expenseIncurred)}
                    </td>
                    <td className="py-3 px-3 text-left font-bold text-rose-700 tabular-nums">
                      {formatCurrency(pay.amount)}
                    </td>
                    <td className="py-3 px-3 text-left font-bold text-amber-700 tabular-nums">
                      {pay.payableRemaining > 0 ? formatCurrency(pay.payableRemaining) : 'تسویه'}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                        {pay.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL: NEW RECEIPT */}
      {isNewModalOpen && type === 'receipts' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateReceipt}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full text-right overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-4 bg-teal-800 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5" />
                <span>ثبت دریافت وجه نقد، حواله یا چک صیادی</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="text-teal-200 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تاریخ دریافت:</label>
                  <input
                    type="text"
                    value={recDate}
                    onChange={(e) => setRecDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">مبلغ دریافت (تومان):</label>
                  <input
                    type="number"
                    value={recAmount || ''}
                    onChange={(e) => setRecAmount(Number(e.target.value) || 0)}
                    placeholder="مثلاً: 14000000000"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-left"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">پرداخت‌کننده (کارفرما / شخص):</label>
                <input
                  type="text"
                  value={recPayer}
                  onChange={(e) => setRecPayer(e.target.value)}
                  placeholder="مثلاً: شرکت سرمایه‌گذاری تابان مسکن"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">پروژه مرتبط:</label>
                  <select
                    value={recProjectId}
                    onChange={(e) => setRecProjectId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    <option value="">عمومی شرکت</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">حساب مقصد بانکی:</label>
                  <select
                    value={recBank}
                    onChange={(e) => setRecBank(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.bankName}>{b.bankName} - {b.branch}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">روش دریافت:</label>
                  <select
                    value={recMethod}
                    onChange={(e) => setRecMethod(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    <option value="حواله بانکی">حواله ساتنا / پایا</option>
                    <option value="چک صیادی">چک بانکی صیادی</option>
                    <option value="نقد">نقدی به صندوق</option>
                    <option value="پوز بانکی">دستگاه کارتخوان</option>
                    <option value="تهاتر">تهاتر مصالح و ملک</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">شماره پیگیری / شناسه چک:</label>
                  <input
                    type="text"
                    value={recTracking}
                    onChange={(e) => setRecTracking(e.target.value)}
                    placeholder="TRK-9812401"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">شرح دریافت:</label>
                <input
                  type="text"
                  value={recDesc}
                  onChange={(e) => setRecDesc(e.target.value)}
                  placeholder="مثلاً: قسط سوم صورت‌وضعیت شماره ۵ پروژه رونیکا..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={!recAmount || !recPayer}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                ثبت دریافت قطعی
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NEW PAYMENT (Requirement 10: Incurred vs Paid vs Payable Remaining) */}
      {isNewModalOpen && type === 'payments' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePayment}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full text-right overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-rose-400" />
                <span>ثبت پرداخت وجه و تادیه تعهدات (Expense ≠ Payment)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تاریخ پرداخت:</label>
                  <input
                    type="text"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">مبلغ پرداختی نقدی (تومان):</label>
                  <input
                    type="number"
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                    placeholder="مبلغ واریزی..."
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-left"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  کل بهای تعهد فاکتور (در صورت پرداخت قسطی/علی‌الحساب):
                </label>
                <input
                  type="number"
                  value={payIncurredExpense || ''}
                  onChange={(e) => setPayIncurredExpense(Number(e.target.value) || 0)}
                  placeholder="اگر کل فاکتور بزرگتر از پرداختی است وارد کنید (مثلاً: 500,000,000)"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-left"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  اگر کل فاکتور تسویه می‌شود، این بخش را خالی بگذارید.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">دریافت‌کننده وجه (طرف حساب):</label>
                <input
                  type="text"
                  value={payPayee}
                  onChange={(e) => setPayPayee(e.target.value)}
                  placeholder="مثلاً: شرکت فولاد مبارکه اصفهان یا پیمانکار بتن..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">پروژه مرتبط:</label>
                  <select
                    value={payProjectId}
                    onChange={(e) => setPayProjectId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    <option value="">عمومی دفتر مرکزی</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">حساب پرداخت‌کننده:</label>
                  <select
                    value={payAccount}
                    onChange={(e) => setPayAccount(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.bankName}>{b.bankName} - {b.branch}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">روش پرداخت:</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    <option value="حواله ساتنا/پایا">حواله ساتنا / پایا</option>
                    <option value="چک بانکی صیادی">چک صیادی بنفش</option>
                    <option value="نقد">وجه نقد از صندوق</option>
                    <option value="کارت تنخواه">کارت تنخواه کارگاه</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">شماره سند / چک / ارجاع:</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="SATNA-1092841"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">شرح پرداخت:</label>
                <input
                  type="text"
                  value={payDesc}
                  onChange={(e) => setPayDesc(e.target.value)}
                  placeholder="مثلاً: تسویه مرحله اول فاکتور بتن آماده کارگاه فجر..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={!payAmount || !payPayee}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                ثبت پرداخت و صدور سند
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
