import React, { useState } from 'react';
import {
  Scale,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  FileText,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  PettyCashAccount,
  PettyCashReconciliation,
  PettyCashExpense,
  PettyCashReplenishment,
  User,
} from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { dayIndex, toPersianDate } from '../../utils/date';
import { IntegerInput, MoneyInput } from '../common/NumberInput';
import { moneyUnitLabel } from '../../utils/money';

interface PettyCashReconciliationViewProps {
  accounts: PettyCashAccount[];
  reconciliations: PettyCashReconciliation[];
  expenses: PettyCashExpense[];
  replenishments: PettyCashReplenishment[];
  currentUser: User;
  onSaveReconciliation: (input: ReconciliationInput) => { ok: boolean; message: string };
}

export type ReconciliationInput = Pick<
  PettyCashReconciliation,
  'pettyCashId' | 'periodStartDate' | 'periodEndDate' | 'actualCountedCash' | 'discrepancyReason' | 'notes'
>;

/** First day of the current Jalali month, e.g. «۱۴۰۵/۰۷/۰۱». */
const monthStart = () => toPersianDate(new Date()).replace(/\/[۰-۹0-9]+$/, '/۰۱');

export const PettyCashReconciliationView: React.FC<PettyCashReconciliationViewProps> = ({
  accounts,
  reconciliations,
  expenses,
  replenishments,
  currentUser,
  onSaveReconciliation,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  // The count is made today; the period starts on the chosen date.
  const [periodStartDate, setPeriodStartDate] = useState(monthStart);
  const periodEndDate = toPersianDate(new Date());
  const start = dayIndex(periodStartDate) || 0;
  const inPeriod = (d: string) => (dayIndex(d) || 0) >= start;

  // Expected balance is the fund's book balance; the period's movements explain how it was reached.
  const expectedBalance = selectedAccount?.actualBalance ?? 0;
  const accountReplenishmentsSum = replenishments
    .filter((r) => r.pettyCashId === selectedAccount?.id && inPeriod(r.date))
    .reduce((sum, r) => sum + r.amount, 0);
  const accountApprovedExpensesSum = expenses
    .filter(
      (e) =>
        e.pettyCashId === selectedAccount?.id &&
        (e.status === 'approved' || e.status === 'accounting_posted') &&
        inPeriod(e.date)
    )
    .reduce((sum, e) => sum + e.amount, 0);
  const openingBalance = expectedBalance - accountReplenishmentsSum + accountApprovedExpensesSum;

  // Actual physical counted cash input
  const [actualCountedCash, setActualCountedCash] = useState<number>(expectedBalance);
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [notes, setNotes] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const discrepancy = actualCountedCash - expectedBalance; // 0 = balanced, < 0 = deficit, > 0 = surplus

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return setFormError('تنخواه را انتخاب کنید.');
    const result = onSaveReconciliation({
      pettyCashId: selectedAccount.id,
      periodStartDate,
      periodEndDate,
      actualCountedCash,
      discrepancyReason: discrepancy !== 0 ? discrepancyReason : undefined,
      notes,
    });
    if (!result.ok) return setFormError(result.message);
    setFormError(null);
    setDiscrepancyReason('');
    setNotes('');
    setNotification(result.message);
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900">
          تسویه و مغایرت‌گیری دوره‌ای تنخواه‌گردان (Petty Cash Reconciliation)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          کنترل فرمول ریاضی: موجودی ابتدای دوره + شارژها - هزینه‌های تاییدشده = موجودی دفتری در برابر شمارش فیزیکی
        </p>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-xl flex items-center gap-2 text-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Reconciliation Calculation Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              کاربرگ تسویه و تطبیق مانده نقدینگی تنخواه
            </h3>
          </div>
          <span className="text-xs text-slate-500">کنترل سیستمی اسناد و ته‌مانده فیزیکی کارگاه</span>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Account & Date Range selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                انتخاب حساب تنخواه‌گردان جهت تسویه
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setActualCountedCash(accounts.find((a) => a.id === e.target.value)?.actualBalance ?? 0);
                }}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white font-medium"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.code}) - {a.projectName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">از تاریخ</label>
              <input
                type="text"
                value={periodStartDate}
                onChange={(e) => setPeriodStartDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تا تاریخ</label>
              <input
                type="text"
                value={periodEndDate}
                readOnly
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono bg-slate-50"
              />
            </div>
          </div>

          {/* Formula Interactive Box (Prompt Section 13) */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 mb-3">
              محاسبه مکانیزه موجودی مورد انتظار دفتری:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">موجودی ابتدای دوره</span>
                <span className="text-sm font-bold font-mono text-slate-900 mt-1 block tabular-nums">
                  {formatCurrency(openingBalance)}
                </span>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
                <span className="text-[11px] text-emerald-800 block">+ مجموع شارژهای واریزی</span>
                <span className="text-sm font-bold font-mono text-emerald-700 mt-1 block tabular-nums">
                  +{formatCurrency(accountReplenishmentsSum)}
                </span>
              </div>

              <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-200">
                <span className="text-[11px] text-rose-800 block">- هزینه‌های تأییدشده مصوب</span>
                <span className="text-sm font-bold font-mono text-rose-700 mt-1 block tabular-nums">
                  -{formatCurrency(accountApprovedExpensesSum)}
                </span>
              </div>

              <div className="p-3 bg-blue-50/80 rounded-lg border-2 border-blue-300">
                <span className="text-[11px] text-blue-900 font-bold block">
                  = موجودی مورد انتظار دفتری
                </span>
                <span className="text-base font-black font-mono text-blue-950 mt-1 block tabular-nums">
                  {formatCurrency(expectedBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Actual Counted Cash & Discrepancy comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                موجودی واقعی شمارش‌شده کارگاه / پرینت بانکی ({moneyUnitLabel()}) <span className="text-rose-500">*</span>
              </label>
              <MoneyInput
                required
                value={actualCountedCash}
                onValueChange={(v) => setActualCountedCash(v)}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-amber-500 tabular-nums"
              />
              <span className="text-[11px] text-slate-500 block">
                مبلغ اعلام‌شده توسط تنخواه‌دار ({selectedAccount?.holderName}) در پایان دوره: {formatCurrency(actualCountedCash)}
              </span>
            </div>

            {/* Discrepancy Result Card */}
            <div
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                discrepancy === 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : discrepancy < 0
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>وضعیت تطبیق و مغایرت:</span>
                  <span>
                    {discrepancy === 0
                      ? 'کاملاً متعادل (تراز صفر)'
                      : discrepancy < 0
                      ? 'دارای کسری صندوق'
                      : 'دارای مازاد صندوق'}
                  </span>
                </div>
                <div className="text-xl font-black font-mono mt-2 tabular-nums">
                  {discrepancy === 0
                    ? 'بدون اختلاف'
                    : `${discrepancy > 0 ? '+' : ''}${formatCurrency(discrepancy)}`}
                </div>
              </div>

              <div className="text-[11px] mt-2 pt-2 border-t border-slate-200/60">
                {discrepancy === 0
                  ? 'حساب تنخواه بدون هیچ‌گونه انحراف با دفاتر قانونی تطبیق داده شد.'
                  : 'در صورت تایید مغایرت، سند تعدیل حسابداری در حسابرسی صادر خواهد شد.'}
              </div>
            </div>
          </div>

          {/* If Discrepancy != 0, require reason and note */}
          {discrepancy !== 0 && (
            <div className="space-y-3 p-4 bg-amber-50/70 border border-amber-300 rounded-xl">
              <label className="block text-xs font-bold text-amber-950">
                علت مغایرت و انحراف مانده <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: کارمزد بانکی حواله‌ها، خطای شمارش دستی، گرد کردن ارقام ریز خریدهای مصالح..."
                value={discrepancyReason}
                onChange={(e) => setDiscrepancyReason(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              توضیحات و مصوبات صورتجلسه تسویه
            </label>
            <textarea
              rows={2}
              placeholder="نکات مطابقت مدارک، بررسی رسیدهای بانکی و تاییدات مدیر پروژه..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {formError && (
            <p className="text-xs text-rose-700 font-bold" role="alert">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              مسئول تسویه:{' '}
              <span className="font-semibold text-slate-800">{currentUser.name}</span> ({currentUser.role})
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4 text-emerald-400" />
              تأیید و صدور صورتجلسه تسویه
            </button>
          </div>
        </form>
      </div>

      {/* History of Past Reconciliations */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">سوابق صورتجلسات تسویه دوره‌ای تنخواه‌ها</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            آرشیو رسمی صورتجلسات مغایرت‌گیری و تأییدات مالی
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">شماره صورتجلسه</th>
                <th className="py-3 px-4">تنخواه‌گردان</th>
                <th className="py-3 px-4">بازه زمانی</th>
                <th className="py-3 px-4 text-left">موجودی دفتری</th>
                <th className="py-3 px-4 text-left">موجودی شمارش‌شده</th>
                <th className="py-3 px-4 text-left">مغایرت</th>
                <th className="py-3 px-4 text-center">وضعیت</th>
                <th className="py-3 px-4">تنخواه‌دار</th>
                <th className="py-3 px-4">تأییدکننده مالی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reconciliations.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                    {rec.reconNumber}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{rec.pettyCashTitle}</td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                    {rec.periodStartDate} تا {rec.periodEndDate}
                  </td>
                  <td className="py-3.5 px-4 text-left font-mono tabular-nums text-slate-700">
                    {formatCurrency(rec.expectedBalance)}
                  </td>
                  <td className="py-3.5 px-4 text-left font-mono font-bold tabular-nums text-slate-900">
                    {formatCurrency(rec.actualCountedCash)}
                  </td>
                  <td className="py-3.5 px-4 text-left font-mono font-bold tabular-nums">
                    <span
                      className={
                        rec.discrepancy === 0
                          ? 'text-emerald-700'
                          : rec.discrepancy < 0
                          ? 'text-rose-600'
                          : 'text-amber-600'
                      }
                    >
                      {rec.discrepancy === 0 ? '۰' : formatCurrency(rec.discrepancy)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        rec.status.includes('متعادل')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{rec.officerName}</td>
                  <td className="py-3.5 px-4 text-slate-600 text-[11px]">{rec.financeApproverName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
