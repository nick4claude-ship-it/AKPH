import React, { useMemo, useState } from 'react';
import { CalendarCheck, ShieldCheck, History, Lock, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { AuditLog, JournalEntry } from '../../types';
import { formatMoney } from '../../utils/money';
import { fiscalYearsOf, selectYearClosing } from '../../store/views/accounting';
import { toPersianDigits } from '../../utils/formatters';
import { usePermission } from '../../store/session';
import type { WorkflowResult } from '../../store/workflowKit';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface PeriodClosingAndAuditViewProps {
  auditLogs: AuditLog[];
  journalEntries: JournalEntry[];
  closedFiscalYears: number[];
  onCloseFiscalYear: (year: number) => WorkflowResult;
}

/** Roles of the paydar-portal plugin and what each may do in the ledger (mirrors utils/permissions). */
const ROLE_SUMMARY = [
  { role: 'مدیر سیستم', access: 'دسترسی کامل', items: ['مدیریت تنظیمات و سیاست‌ها', 'همه عملیات مالی (با قاعده تفکیک وظایف)'], color: 'bg-slate-50 text-slate-900 border-slate-200' },
  { role: 'مدیر ارشد', access: 'تأییدهای نهایی و بستن سال', items: ['تأیید نهایی صورت‌وضعیت جزء و درخواست پرداخت', 'بستن سال مالی', 'تأیید اسناد دستی'], color: 'bg-amber-50 text-amber-900 border-amber-200' },
  { role: 'حسابدار', access: 'دفاتر، خزانه و تأیید مالی', items: ['ثبت سند دستی و سند معکوس', 'ثبت دریافت و اجرای پرداخت', 'تأیید مالی صورت‌وضعیت، فاکتور و تنخواه'], color: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
  { role: 'مدیر پروژه', access: 'فقط پروژه‌های خودش', items: ['تهیه و تأیید کارگاهی صورت‌وضعیت', 'درخواست خرید، حواله و انتقال انبار', 'ثبت هزینه تنخواه'], color: 'bg-purple-50 text-purple-900 border-purple-200' },
];

export const PeriodClosingAndAuditView: React.FC<PeriodClosingAndAuditViewProps> = ({ auditLogs, journalEntries, closedFiscalYears, onCloseFiscalYear }) => {
  const { can } = usePermission();
  const [activeTab, setActiveTab] = useState<'closing' | 'audit' | 'roles'>('closing');
  const years = useMemo(() => fiscalYearsOf(journalEntries), [journalEntries]);
  const [year, setYear] = useState<number>(() => years.find((y) => !closedFiscalYears.includes(y)) || years[0]);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Figures of the selected year (store view model).
  const closing = useMemo(() => selectYearClosing(journalEntries, closedFiscalYears, year), [journalEntries, closedFiscalYears, year]);
  const { yearEntries, pending, final, revenue, cost } = closing;
  const isClosed = closing.isClosed;
  const allowed = can('fiscal.close');

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex items-center gap-1.5" role="tablist">
        {(
          [
            ['closing', 'بستن سال مالی و سند اختتامیه', CalendarCheck],
            ['audit', 'ردیابی حسابرسی', History],
            ['roles', 'نقش‌ها و دسترسی‌ها', ShieldCheck],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              activeTab === key ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'closing' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">بستن سال مالی</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                حساب‌های درآمد و هزینه (گروه ۴، ۵ و ۶) سال انتخاب‌شده با یک سند قطعی به سود (زیان) انباشته بسته می‌شوند و ثبت سند در آن سال قفل می‌شود.
              </p>
            </div>
            <label className="text-xs text-slate-700 flex items-center gap-2">
              سال مالی:
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                {years.map((y) => (
                  <option key={y} value={y}>
                    {toPersianDigits(y)} {closedFiscalYears.includes(y) ? '(بسته)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className={`p-4 rounded-xl border ${pending.length ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
              <div className="font-bold mb-1">اسناد در انتظار تأیید</div>
              <p className="text-[11px]">{pending.length ? `${toPersianDigits(pending.length)} سند باید پیش از بستن تعیین تکلیف شود.` : 'سند بازی در این سال وجود ندارد.'}</p>
            </div>
            <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
              <div className="font-bold mb-1">درآمد سال</div>
              <p className="font-mono">{formatMoney(revenue)}</p>
            </div>
            <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
              <div className="font-bold mb-1">هزینه سال</div>
              <p className="font-mono">{formatMoney(cost)}</p>
            </div>
            <div className="p-4 rounded-xl border bg-amber-50 border-amber-200 text-amber-900">
              <div className="font-bold mb-1">{closing.isProfit ? 'سود' : 'زیان'} قابل انتقال</div>
              <p className="font-mono">{formatMoney(closing.result)}</p>
            </div>
          </div>

          {message && (
            <p className={`p-3 rounded-xl text-xs border ${message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`} role="status">
              {message.text}
            </p>
          )}

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              پس از بستن، هیچ سندی با تاریخ این سال ثبت نمی‌شود؛ اصلاحات بعدی در سال جاری و با سند معکوس انجام می‌شود.
            </span>
            {isClosed ? (
              <span className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                سال مالی {toPersianDigits(year)} بسته است
              </span>
            ) : allowed ? (
              <button
                onClick={() => setConfirming(true)}
                disabled={pending.length > 0}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-lg cursor-pointer inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-4 h-4" />
                بستن سال مالی {toPersianDigits(year)}
              </button>
            ) : (
              <span className="text-xs text-slate-500">بستن سال مالی فقط توسط مدیر ارشد یا مدیر سیستم انجام می‌شود.</span>
            )}
          </div>

          {closedFiscalYears.length > 0 && (
            <p className="text-[11px] text-slate-500">سال‌های بسته‌شده: {closedFiscalYears.map((y) => toPersianDigits(y)).join('، ')}</p>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-amber-600" />
              <span>تاریخچه عملیات مالی (Audit Trail):</span>
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-mono">زمان و تاریخ</th>
                  <th className="py-2.5 px-3">کاربر</th>
                  <th className="py-2.5 px-3">نقش</th>
                  <th className="py-2.5 px-3">اقدام</th>
                  <th className="py-2.5 px-3 font-mono">سند</th>
                  <th className="py-2.5 px-4">شرح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {log.date} · {log.time}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900">{log.user}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-600">{log.role}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold">{log.action}</span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-blue-700">{log.targetDoc}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-700">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {auditLogs.length === 0 && <p className="py-10 text-center text-xs text-slate-400">رویدادی ثبت نشده است.</p>}
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-600" />
              <span>نقش‌های افزونه پرتال پایدار:</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              در همه نقش‌ها تأیید سندی که خود کاربر ایجاد کرده ممنوع است؛ این قاعده حتی با تنظیمات وردپرس قابل لغو نیست.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ROLE_SUMMARY.map((item) => (
              <div key={item.role} className={`p-4 rounded-xl border ${item.color} text-right space-y-2`}>
                <div className="font-bold text-xs">{item.role}</div>
                <div className="text-[11px] font-semibold opacity-90">{item.access}</div>
                <ul className="text-[11px] space-y-1 pt-2 border-t border-slate-200/60 opacity-85 font-sans">
                  {item.items.map((p) => (
                    <li key={p} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700 shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirming}
        title={`بستن سال مالی ${toPersianDigits(year)}`}
        message="سند اختتامیه صادر و سال قفل می‌شود. این عمل برگشت‌پذیر نیست."
        type="danger"
        confirmText="بستن سال"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          const r = onCloseFiscalYear(year);
          setMessage({ ok: r.ok, text: r.message });
          setConfirming(false);
        }}
      />
    </div>
  );
};
