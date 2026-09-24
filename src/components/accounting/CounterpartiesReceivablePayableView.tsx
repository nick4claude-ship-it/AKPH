import React, { useState } from 'react';
import {
  Users,
  Clock,
  CreditCard,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import {
  AccountsReceivableItem,
  AccountsPayableItem,
  Subledger,
} from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface CounterpartiesReceivablePayableViewProps {
  viewMode: 'counterparties' | 'receivables' | 'payables';
  receivables: AccountsReceivableItem[];
  payables: AccountsPayableItem[];
  subledgers: Subledger[];
  onOpenReceiptForDebtor: (debtor: AccountsReceivableItem) => void;
  onOpenPaymentForCreditor: (creditor: AccountsPayableItem) => void;
}

export const CounterpartiesReceivablePayableView: React.FC<CounterpartiesReceivablePayableViewProps> = ({
  viewMode,
  receivables,
  payables,
  subledgers,
  onOpenReceiptForDebtor,
  onOpenPaymentForCreditor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // RECEIVABLES VIEW
  if (viewMode === 'receivables') {
    const totalBilled = receivables.reduce((s, r) => s + r.billedAmount, 0);
    const totalReceived = receivables.reduce((s, r) => s + r.receivedAmount, 0);
    const totalRemaining = receivables.reduce((s, r) => s + r.remainingClaim, 0);
    const overdueCount = receivables.filter((r) => r.status.includes('معوق')).length;

    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">کل کارکرد تاییدشده (Billed)</span>
            <strong className="text-sm text-slate-800">{formatCurrency(totalBilled)} تومان</strong>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">کل وصولی‌های نقدی (Received)</span>
            <strong className="text-sm text-teal-700">{formatCurrency(totalReceived)} تومان</strong>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">مانده مطالبات تجاری (Claims)</span>
            <strong className="text-sm text-rose-700">{formatCurrency(totalRemaining)} تومان</strong>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">مطالبات معوق سررسید گذشته</span>
            <strong className="text-sm text-amber-700">{overdueCount} کارفرما</strong>
          </div>
        </div>

        {/* Table of Receivables */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-rose-600" />
              <span>فهرست تفکیکی مطالبات از کارفرمایان و اشخاص (Accounts Receivable):</span>
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">کارفرما / طرف حساب بدهکار</th>
                  <th className="py-3 px-3">پروژه مرتبط</th>
                  <th className="py-3 px-3 font-mono text-left">صورت‌وضعیت کارکرد (تومان)</th>
                  <th className="py-3 px-3 font-mono text-left text-teal-700">مبلغ دریافتی نقد</th>
                  <th className="py-3 px-3 font-mono text-left text-rose-700">مانده مطالبه</th>
                  <th className="py-3 px-3">تاریخ سررسید</th>
                  <th className="py-3 px-3 text-center">وضعیت وصول</th>
                  <th className="py-3 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {receivables.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{r.debtorName}</td>
                    <td className="py-3 px-3 font-sans text-slate-600">{r.projectName}</td>
                    <td className="py-3 px-3 text-left tabular-nums text-slate-600">{formatCurrency(r.billedAmount)}</td>
                    <td className="py-3 px-3 text-left tabular-nums font-medium text-teal-700">{formatCurrency(r.receivedAmount)}</td>
                    <td className="py-3 px-3 text-left tabular-nums font-bold text-rose-700">{formatCurrency(r.remainingClaim)}</td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">{r.dueDate}</td>
                    <td className="py-3 px-3 text-center font-sans">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          r.status.includes('معوق')
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : r.status.includes('نزدیک')
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <button
                        onClick={() => onOpenReceiptForDebtor(r)}
                        className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-xs font-semibold cursor-pointer"
                      >
                        ثبت دریافت قسط
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // PAYABLES VIEW
  if (viewMode === 'payables') {
    const totalIncurred = payables.reduce((s, p) => s + p.incurredDebt, 0);
    const totalPaid = payables.reduce((s, p) => s + p.paidAmount, 0);
    const totalRemainingPayable = payables.reduce((s, p) => s + p.remainingDebt, 0);

    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">کل بهای کالا و خدمات تحویلی</span>
            <strong className="text-sm text-slate-800">{formatCurrency(totalIncurred)} تومان</strong>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">مبالغ پرداخت‌شده تاکنون</span>
            <strong className="text-sm text-emerald-700">{formatCurrency(totalPaid)} تومان</strong>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block mb-1">مانده تعهد پرداختنی (بدهی باز)</span>
            <strong className="text-sm text-amber-800">{formatCurrency(totalRemainingPayable)} تومان</strong>
          </div>
        </div>

        {/* Table of Payables */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-amber-600" />
              <span>فهرست بستانکاران و تعهدات باز پیمانکاری (Accounts Payable):</span>
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">طرف حساب بستانکار</th>
                  <th className="py-3 px-3">نوع طرف حساب</th>
                  <th className="py-3 px-3">پروژه و کارگاه</th>
                  <th className="py-3 px-3 font-mono text-left">بهای فاکتور (تومان)</th>
                  <th className="py-3 px-3 font-mono text-left text-emerald-700">پرداختی تاکنون</th>
                  <th className="py-3 px-3 font-mono text-left text-amber-800">مانده بدهی شرکت</th>
                  <th className="py-3 px-3">موعد سررسید</th>
                  <th className="py-3 px-3 text-center">وضعیت تسویه</th>
                  <th className="py-3 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {payables.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{p.creditorName}</td>
                    <td className="py-3 px-3 font-sans">
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                        {p.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-600">{p.projectName}</td>
                    <td className="py-3 px-3 text-left tabular-nums text-slate-500">{formatCurrency(p.incurredDebt)}</td>
                    <td className="py-3 px-3 text-left tabular-nums text-emerald-700">{formatCurrency(p.paidAmount)}</td>
                    <td className="py-3 px-3 text-left tabular-nums font-bold text-amber-700">{formatCurrency(p.remainingDebt)}</td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">{p.dueDate}</td>
                    <td className="py-3 px-3 text-center font-sans">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          p.status === 'سررسید شده'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <button
                        onClick={() => onOpenPaymentForCreditor(p)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded text-xs font-semibold cursor-pointer"
                      >
                        ثبت تادیه وجه
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // COUNTERPARTIES & SUBLEDGERS DIRECTORY
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="جستجو در نام شخص، تأمین‌کننده، پیمانکار، کدملی، تلفن..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-mono">کد تفصیلی</th>
                <th className="py-3 px-4">نام طرف حساب / شرکت</th>
                <th className="py-3 px-3">نوع طرف حساب</th>
                <th className="py-3 px-3 font-mono">شناسه ملی / کد اقتصادی</th>
                <th className="py-3 px-3 font-mono">تلفن تماس</th>
                <th className="py-3 px-3 font-mono text-left">مانده حساب (تومان)</th>
                <th className="py-3 px-4 text-center">ماهیت مانده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {subledgers.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{sub.code}</td>
                  <td className="py-3 px-4 font-sans font-bold text-slate-900">{sub.name}</td>
                  <td className="py-3 px-3 font-sans">
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                      {sub.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-[11px]">{sub.nationalId || '-'}</td>
                  <td className="py-3 px-3 text-slate-500 text-[11px]">{sub.phone || '-'}</td>
                  <td className="py-3 px-3 text-left font-bold text-slate-900 tabular-nums">
                    {formatCurrency(sub.balance)}
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        sub.nature === 'بدهکار'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {sub.nature}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
