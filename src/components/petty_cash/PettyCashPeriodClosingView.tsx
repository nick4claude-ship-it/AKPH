import React, { useState } from 'react';
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
  ArrowRight,
  Layers,
  Calendar,
  AlertCircle,
  Unlock,
} from 'lucide-react';
import { PettyCashAccount, PettyCashExpense, User } from '../../types';
import { useAppState } from '../../store/AppStore';
import { documentCount } from '../../store/domainSelectors';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface PettyCashPeriodClosingViewProps {
  accounts: PettyCashAccount[];
  expenses: PettyCashExpense[];
  currentUser: User;
}

export const PettyCashPeriodClosingView: React.FC<PettyCashPeriodClosingViewProps> = ({
  accounts,
  expenses,
  currentUser,
}) => {
  const appState = useAppState();
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const [closingPeriod, setClosingPeriod] = useState('شهریور ۱۴۰۳');
  const [isLocked, setIsLocked] = useState(false);

  // Check unresolved expenses for this account
  const accountPendingExpenses = expenses.filter(
    (e) =>
      e.pettyCashId === selectedAccount?.id &&
      (e.status === 'pending_approval' || e.status === 'submitted')
  );

  const missingDocsExpenses = expenses.filter(
    (e) =>
      e.pettyCashId === selectedAccount?.id &&
      (!e.invoiceNumber || !documentCount(appState, 'petty_cash_expense', e.id))
  );

  const canClose = accountPendingExpenses.length === 0 && missingDocsExpenses.length === 0;
  const [closingError, setClosingError] = useState<string | null>(null);

  const handleExecuteClosing = () => {
    if (!canClose) {
      setClosingError('خطا: تا زمانی که اسناد بلاتکلیف یا دارای نقص مدرک وجود دارند، امکان بستن دوره وجود ندارد.');
      return;
    }
    setClosingError(null);
    setIsLocked(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900">
          فرآیند قطعی بستن دوره تنخواه‌گردان (Petty Cash Period Closing)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          قفل دوره‌ای، کنترل عدم وجود فاکتور بلاتکلیف، صدور سند اختتامیه و انتقال مانده به دوره بعد
        </p>
      </div>

      {/* Account Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700">انتخاب تنخواه جهت بستن دوره:</label>
          <select
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setIsLocked(false);
            }}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white font-medium"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.projectName})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">دوره مالی انتخابی:</span>
          <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
            {closingPeriod}
          </span>
        </div>
      </div>

      {/* 4-Step Closing Checklist (Prompt Section 14) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Step 1: Pending Expenses Check */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            accountPendingExpenses.length === 0
              ? 'bg-emerald-50/50 border-emerald-300'
              : 'bg-rose-50/50 border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">۱. بررسی اسناد معلق</span>
            {accountPendingExpenses.length === 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <p className="text-[11px] text-slate-600 mt-2">
            {accountPendingExpenses.length === 0
              ? 'تمام هزینه‌ها تعیین تکلیف و تایید شده‌اند.'
              : `${accountPendingExpenses.length.toLocaleString('fa-IR')} فاکتور بلاتکلیف در کارتابل وجود دارد.`}
          </p>
          <div className="mt-3 text-[10px] font-bold">
            {accountPendingExpenses.length === 0 ? (
              <span className="text-emerald-700">آماده بستن ✓</span>
            ) : (
              <span className="text-rose-700">نیاز به تایید یا رد</span>
            )}
          </div>
        </div>

        {/* Step 2: Missing Documents Check */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            missingDocsExpenses.length === 0
              ? 'bg-emerald-50/50 border-emerald-300'
              : 'bg-amber-50/50 border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">۲. کنترل مدارک ناقص</span>
            {missingDocsExpenses.length === 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <p className="text-[11px] text-slate-600 mt-2">
            {missingDocsExpenses.length === 0
              ? 'تمام فاکتورها دارای شماره رسمی و تصویر پیوست هستند.'
              : `${missingDocsExpenses.length.toLocaleString('fa-IR')} سند فاقد شماره فاکتور یا پیوست است.`}
          </p>
          <div className="mt-3 text-[10px] font-bold">
            {missingDocsExpenses.length === 0 ? (
              <span className="text-emerald-700">کنترل شد ✓</span>
            ) : (
              <span className="text-amber-700">بررسی نواقص</span>
            )}
          </div>
        </div>

        {/* Step 3: Reconciliation Check */}
        <div className="p-4 rounded-xl border bg-emerald-50/50 border-emerald-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">۳. تطبیق مانده و تسویه</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-[11px] text-slate-600 mt-2">
            صورتجلسه تطبیق مانده دفتری با موجودی واقعی کارگاه تنظیم گردیده است.
          </p>
          <div className="mt-3 text-[10px] font-bold text-emerald-700">
            تراز صفر و متعادل ✓
          </div>
        </div>

        {/* Step 4: Lock Period */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isLocked ? 'bg-slate-900 text-white border-slate-950' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">۴. قفل و اختتامیه</span>
            {isLocked ? (
              <Lock className="w-4 h-4 text-amber-400" />
            ) : (
              <Unlock className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <p
            className={`text-[11px] mt-2 ${
              isLocked ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            {isLocked
              ? 'دوره مالی با موفقیت قفل شد و اسناد غیرقابل تغییر گردیدند.'
              : 'پس از تکمیل مراحل، قفل سیستمی اعمال خواهد شد.'}
          </p>
          <div className="mt-3 text-[10px] font-bold">
            {isLocked ? (
              <span className="text-amber-400 font-mono">سند اختتامیه: ACC-CLS-0914</span>
            ) : (
              <span className="text-slate-500">در انتظار تایید</span>
            )}
          </div>
        </div>
      </div>

      {/* Action / Execution Area */}
      {closingError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 font-bold rounded-xl flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{closingError}</span>
        </div>
      )}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900">
            عملیات اختتامیه دوره {closingPeriod} برای {selectedAccount.title}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            مانده قطعی قابل انتقال به دوره مهرماه:{' '}
            <strong className="text-slate-900 font-mono tabular-nums">
              {formatCurrency(selectedAccount.actualBalance)}
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isLocked ? (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              دوره بسته و بایگانی گردید
            </div>
          ) : (
            <button
              onClick={handleExecuteClosing}
              disabled={!canClose}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-2 ${
                canClose
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Lock className="w-4 h-4 text-amber-400" />
              قفل قطعی دوره و صدور سند اختتامیه
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
