/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Contract, AdvancePaymentRecord, UserProfile } from '../../types';
import { ShieldCheck, DollarSign, Calendar, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatMoneyCompact } from '../../utils/money';
import { barWidth, formatPercent } from '../../utils/formatters';
import { advanceAmortizedPercent } from '../../store/views/contracts';

interface DeductionsEngineViewProps {
  contracts: Contract[];
  advancePayments: AdvancePaymentRecord[];
  currentUser: UserProfile;
}

export const DeductionsEngineView: React.FC<DeductionsEngineViewProps> = ({
  contracts,
  advancePayments,
  currentUser,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h2 className="text-base font-bold text-slate-900">
          موتور هوشمند کسورات قانونی و استرداد پیش‌پرداخت (Deduction & Amortization Engine)
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
          مدیریت یکپارچه جدول استهلاک پیش‌پرداخت‌های دریافتی، ردیابی سپرده‌های ۱۰ درصدی حسن انجام کار (آزادسازی در تحویل موقت و قطعی)، و محاسبه حق بیمه ماده ۳۸ سازمان تأمین اجتماعی.
        </p>
      </div>

      {/* Advance Payments & Amortization Schedules */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-amber-600" />
          جدول استهلاک پیش‌پرداخت‌های دریافتی (Advance Payment Amortization)
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {advancePayments.map((adv) => {
            const contract = contracts.find((c) => c.id === adv.contractId);
            const amortizedPct = advanceAmortizedPercent(adv);
            return (
              <div key={adv.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900">
                    {contract?.code}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{adv.paymentDate}</span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 truncate">{contract?.projectTitle}</h4>
                  <span className="text-[11px] text-slate-500 block mt-0.5">کارفرما: {contract?.employer}</span>
                </div>

                <div className="space-y-1.5 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-500">کل پیش‌پرداخت دریافتی ({adv.percentage}٪):</span>
                    <span className="font-bold font-mono">{formatMoneyCompact(adv.totalAdvanceAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>مستهلک‌شده در صورت‌وضعیت‌ها:</span>
                    <span className="font-bold font-mono">{formatMoneyCompact(adv.totalAmortized)}</span>
                  </div>
                  <div className="flex justify-between text-amber-900 font-black">
                    <span>مانده مستهلک‌نشده:</span>
                    <span className="font-mono">{formatMoneyCompact(adv.remainingAdvance)}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>پیشرفت استهلاک:</span>
                    <span className="font-bold text-emerald-700">{formatPercent(amortizedPct)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: barWidth(amortizedPct) }}></div>
                  </div>
                </div>

                {/* Installments Breakdown if any */}
                {adv.installments && adv.installments.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 text-[10px] space-y-1">
                    <span className="font-bold text-slate-700 block">اقساط مستهلک‌شده اخیر:</span>
                    {adv.installments.map((inst) => (
                      <div key={`${inst.statementId}-${inst.date}`} className="flex justify-between text-slate-500">
                        <span>{inst.statementNumber} ({inst.date})</span>
                        <span className="font-mono font-bold">{formatMoneyCompact(inst.amortizedAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rules and Deductions Framework */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Retention */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-indigo-700">
            <ShieldCheck className="w-5 h-5" />
            <h4 className="text-xs font-bold text-slate-900">سپرده حسن انجام کار (۱۰٪)</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            از مبلغ ناخالص هر صورت‌وضعیت کسر و در حسابی نزد کارفرما بلوکه می‌شود. ۵۰٪ این مبلغ پس از امضای صورت‌جلسه تحویل موقت و ۵۰٪ باقیمانده پس از تحویل قطعی و رفع معایب دوره تضمین آزاد می‌گردد.
          </p>
        </div>

        {/* Card 2: Insurance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-purple-700">
            <Layers className="w-5 h-5" />
            <h4 className="text-xs font-bold text-slate-900">حق بیمه تأمین اجتماعی (ماده ۳۸)</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            ۵ درصد از هر صورت‌وضعیت کسر شده و پرداخت قسط آخر و آزادسازی سپرده‌ها منوط به ارائه مفاصاحساب رسمی از سازمان تأمین اجتماعی بر مبنای لیست دستمزد کارگران کارگاه می‌باشد.
          </p>
        </div>

        {/* Card 3: VAT */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
            <h4 className="text-xs font-bold text-slate-900">مالیات بر ارزش افزوده (۱۰٪)</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            طبق قانون مالیات بر ارزش افزوده مصوب ۱۴۰۰، ۱۰ درصد به مبلغ ناخالص کارکرد اضافه و کارفرما موظف است آن را به همراه صورت‌وضعیت کارکرد نقداً پرداخت نماید تا در سامانه مؤدیان ثبت شود.
          </p>
        </div>
      </div>
    </div>
  );
};
