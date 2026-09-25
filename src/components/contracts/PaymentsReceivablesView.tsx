/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Contract,
  DetailedProgressStatement,
  StatementPayment,
  UserProfile,
} from '../../types';
import {
  DollarSign,
  Plus,
  Calendar,
  Building,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { formatMoney, formatMoneyCompact, moneyUnitLabel, formatInt } from '../../utils/money';
import { selectClientReceivables } from '../../store/views/contracts';

interface PaymentsReceivablesViewProps {
  contracts: Contract[];
  statements: DetailedProgressStatement[];
  payments: StatementPayment[];
  currentUser: UserProfile;
  onOpenRecordReceipt: () => void;
  onSelectStatement: (statement: DetailedProgressStatement) => void;
}

export const PaymentsReceivablesView: React.FC<PaymentsReceivablesViewProps> = ({
  contracts,
  statements,
  payments,
  currentUser,
  onOpenRecordReceipt,
  onSelectStatement,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'receivables' | 'payments_history'>('receivables');

  // Statements with remaining receivables, by age
  const receivables = selectClientReceivables(statements, payments);
  const unpaidStatements = receivables.unpaid;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            مدیریت مطالبات معوق و وصولی‌های پروژه‌ها (Receivables & Receipts)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            پیگیری سررسید مطالبات از کارفرمایان، تحلیل کهنگی بدهی‌ها (Aging)، و ثبت واریزی‌های نقدی و اسناد خزانه (اخزا)
          </p>
        </div>

        <button
          onClick={onOpenRecordReceipt}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت دریافت وجه / وصولی جدید</span>
        </button>
      </div>

      {/* Aging Analysis Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">کل مانده مطالبات معوق</span>
            <DollarSign className="w-4 h-4 text-slate-600" />
          </div>
          <span className="text-xl font-black text-slate-900 font-mono">
            {formatMoneyCompact(receivables.totalReceivable)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">
            از {formatInt(unpaidStatements.length)} فقره صورت‌وضعیت
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">مطالبات جاری (در مهلت مقرر)</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-xl font-black text-emerald-700 font-mono">
            {formatMoneyCompact(receivables.current.amount)}
          </span>
          <span className="text-[10px] text-emerald-600 block mt-1">کمتر از ۳۰ روز تا سررسید</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">تاخیر ۱ تا ۳۰ روز</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-xl font-black text-amber-800 font-mono">
            {formatMoneyCompact(receivables.overdue30.amount)}
          </span>
          <span className="text-[10px] text-amber-700 block mt-1">نیاز به پیگیری امور مالی</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">تاخیر بحرانی (+۳۰ روز)</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-xl font-black text-rose-700 font-mono">
            {formatMoneyCompact(receivables.overdueCritical.amount)}
          </span>
          <span className="text-[10px] text-rose-700 block mt-1">مشمول خسارت تأخیر تادیه</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex items-center border-b border-slate-200 bg-slate-50/70 px-4 text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('receivables')}
            className={`py-3 px-4 border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'receivables'
                ? 'border-amber-500 text-amber-950 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            لیست مطالبات معوق به تفکیک کارفرما ({formatInt(unpaidStatements.length)})
          </button>
          <button
            onClick={() => setActiveSubTab('payments_history')}
            className={`py-3 px-4 border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'payments_history'
                ? 'border-amber-500 text-amber-950 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            سوابق وصولی‌ها و واریزی‌های بانکی ({formatInt(payments.length)})
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {activeSubTab === 'receivables' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">صورت‌وضعیت</th>
                    <th className="p-3">پیمان و پروژه</th>
                    <th className="p-3">کارفرما</th>
                    <th className="p-3 text-left">مبلغ خالص مصوب</th>
                    <th className="p-3 text-left">دریافتی تا کنون</th>
                    <th className="p-3 text-left">مانده طلب ({moneyUnitLabel()})</th>
                    <th className="p-3 text-center">سررسید پرداخت</th>
                    <th className="p-3 text-center">تاخیر (روز)</th>
                    <th className="p-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unpaidStatements.map((stm) => (
                    <tr key={stm.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{stm.statementNumber}</td>
                      <td className="p-3 max-w-xs font-medium text-slate-800">{stm.projectName}</td>
                      <td className="p-3 text-slate-600">{stm.client}</td>
                      <td className="p-3 text-left font-mono font-bold text-slate-800">
                        {formatMoney(stm.netPayable, false)}
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-emerald-700">
                        {formatMoney(stm.receivedAmount, false)}
                      </td>
                      <td className="p-3 text-left font-mono font-black text-rose-700">
                        {formatMoney(stm.remainingPayable, false)}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">{stm.dueDate}</td>
                      <td className="p-3 text-center">
                        {stm.overdueDays && stm.overdueDays > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900">
                            {stm.overdueDays} روز تاخیر
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium text-[11px]">در مهلت مجاز</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onSelectStatement(stm)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
                        >
                          بررسی سند
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">تاریخ وصول</th>
                    <th className="p-3">بابت صورت‌وضعیت</th>
                    <th className="p-3">نوع و روش وصول</th>
                    <th className="p-3">شماره پیگیری / حواله</th>
                    <th className="p-3">حساب واریزی شرکت</th>
                    <th className="p-3 text-left">مبلغ وصولی ({moneyUnitLabel()})</th>
                    <th className="p-3 text-center">سند حسابداری</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono">{p.date}</td>
                      <td className="p-3 font-medium text-slate-900">{p.statementNumber}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                          {p.method}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">{p.referenceNumber}</td>
                      <td className="p-3 font-medium text-slate-800">{p.destinationBank}</td>
                      <td className="p-3 text-left font-mono font-black text-emerald-700">
                        {formatMoney(p.amount, false)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 font-mono">
                          {p.journalEntryId || 'ACC-REC'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
