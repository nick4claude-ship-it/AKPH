import React, { useState } from 'react';
import {
  CalendarCheck,
  ShieldCheck,
  History,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Key,
} from 'lucide-react';
import { AuditLog, UserProfile } from '../../types';

interface PeriodClosingAndAuditViewProps {
  auditLogs: AuditLog[];
  currentUser: UserProfile;
}

export const PeriodClosingAndAuditView: React.FC<PeriodClosingAndAuditViewProps> = ({
  auditLogs,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'closing' | 'audit' | 'roles'>('closing');
  const [closingStep, setClosingStep] = useState<number>(1);
  const [isPeriodClosed, setIsPeriodClosed] = useState<boolean>(false);

  const rolesMatrix = [
    {
      role: 'مدیرعامل (CEO)',
      access: 'دسترسی نامحدود و کامل (Full Access)',
      permissions: ['تأیید نهایی اسناد', 'مشاهده تمام دفاتر و سود و زیان', 'بستن دوره مالی', 'ابلاغ دستور پرداخت'],
      color: 'bg-amber-50 text-amber-900 border-amber-200',
    },
    {
      role: 'مدیر مالی (Finance Manager)',
      access: 'مدیریت حسابداری + گزارش‌ها + تاییدیه',
      permissions: ['تأیید اولیه اسناد', 'تطبیق بانکی', 'صدور سند معکوس', 'مدیریت سرفصل‌ها', 'گزارش‌های مالیاتی'],
      color: 'bg-blue-50 text-blue-900 border-blue-200',
    },
    {
      role: 'حسابدار ارشد (Accountant)',
      access: 'ثبت و مدیریت اسناد و دفاتر',
      permissions: ['ثبت سند دوبل', 'ثبت دریافت و پرداخت', 'کنترل فاکتورها', 'مغایرت‌گیری بانکی'],
      color: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    },
    {
      role: 'مدیر پروژه (Project Manager)',
      access: 'مشاهده مالی پروژه اختصاصی',
      permissions: ['مشاهده کارنامه مالی پروژه', 'ارسال فاکتور کارگاهی', 'پایش انحراف بودجه پروژه'],
      color: 'bg-purple-50 text-purple-900 border-purple-200',
    },
    {
      role: 'سرپرست کارگاه (Site Manager)',
      access: 'محدود به هزینه‌های میدانی و تنخواه',
      permissions: ['ثبت فاکتور تنخواه', 'درخواست شارژ تنخواه', 'مشاهده حواله انبار'],
      color: 'bg-slate-50 text-slate-900 border-slate-200',
    },
    {
      role: 'حسابرس و ناظر (Viewer)',
      access: 'فقط خواندنی (Read-Only)',
      permissions: ['مشاهده دفاتر', 'مشاهده تراز آزمایشی', 'دریافت خروجی اکسل و PDF'],
      color: 'bg-slate-100 text-slate-700 border-slate-300',
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Tab Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('closing')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'closing' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>بستن دوره مالی و صدور سند اختتامیه</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'audit' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>ردپای حسابرسی و لاگ تغییرات (Audit Trail)</span>
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'roles' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>ماتریس سطوح دسترسی سازمانی (RBAC)</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: PERIOD CLOSING */}
      {activeTab === 'closing' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                فرآیند مکانیزه بستن دوره مالی (Financial Year-End Closing)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                کنترل تراز آزمایشی، بستن حساب‌های موقت سود و زیانی، انتقال به سود انباشته و صدور سند اختتامیه
              </p>
            </div>
            {isPeriodClosed && (
              <span className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>دوره مالی بسته و قفل شده است</span>
              </span>
            )}
          </div>

          {/* Stepper Wizard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div
              className={`p-4 rounded-xl border ${
                closingStep >= 1 ? 'bg-blue-50/60 border-blue-300 text-blue-950' : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <div className="font-bold mb-1">گام اول: کنترل اسناد باز</div>
              <p className="text-[11px] text-slate-500">
                بررسی تراز آزمایشی و اطمینان از عدم وجود سند در انتظار تأیید یا نامتوازن.
              </p>
              <div className="mt-3 flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>اسناد تراز و آماده</span>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                closingStep >= 2 ? 'bg-blue-50/60 border-blue-300 text-blue-950' : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <div className="font-bold mb-1">گام دوم: بستن حساب‌های موقت</div>
              <p className="text-[11px] text-slate-500">
                بستن سرفصل‌های درآمد و هزینه (سرفصل ۴، ۵ و ۶) و انتقال به خلاصه سود و زیان.
              </p>
              {closingStep >= 2 && (
                <div className="mt-3 flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>سود دوره: ۷۰.۲ میلیارد تومان</span>
                </div>
              )}
            </div>

            <div
              className={`p-4 rounded-xl border ${
                closingStep >= 3 ? 'bg-blue-50/60 border-blue-300 text-blue-950' : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <div className="font-bold mb-1">گام سوم: انتقال به سود انباشته</div>
              <p className="text-[11px] text-slate-500">
                کسر ذخیره اندوخته قانونی (۵٪) و انتقال باقیمانده سود به حساب سود انباشته (سرفصل ۳۳).
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                closingStep >= 4 ? 'bg-blue-50/60 border-blue-300 text-blue-950' : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <div className="font-bold mb-1">گام چهارم: صدور سند اختتامیه</div>
              <p className="text-[11px] text-slate-500">
                صفر کردن مانده دارایی‌ها و بدهی‌ها و انتقال خودکار به سند افتتاحیه سال مالی جدید.
              </p>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <span className="text-xs text-slate-600">
              توجه: پس از بستن قطعی دوره، هیچ سند مالی در این بازه قابل ویرایش نخواهد بود.
            </span>

            {!isPeriodClosed ? (
              <button
                onClick={() => {
                  setClosingStep(4);
                  setIsPeriodClosed(true);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
              >
                اجرای فرآیند بستن دوره مالی
              </button>
            ) : (
              <span className="text-xs font-bold text-emerald-700">
                سند اختتامیه صادر و دوره سال مالی ۱۴۰۳ با موفقیت بسته شد.
              </span>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: AUDIT TRAIL LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-amber-600" />
              <span>تاریخچه کامل عملیات مالی و ردیابی حسابرسی (Audit Trail):</span>
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-mono">زمان و تاریخ</th>
                  <th className="py-2.5 px-3">کاربر اقدام‌کننده</th>
                  <th className="py-2.5 px-3">نقش سازمانی</th>
                  <th className="py-2.5 px-3">نوع اقدام مالی</th>
                  <th className="py-2.5 px-3 font-mono">سند هدف</th>
                  <th className="py-2.5 px-4">شرح رویداد حسابرسی</th>
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
                      <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-blue-700">{log.targetDoc}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-700">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3: RBAC MATRIX */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-600" />
              <span>ماتریس دسترسی نقش‌ها در ماژول حسابداری (Role-Based Access Control):</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              کنترل اختیارات بر اساس جایگاه سازمانی مدیرعامل، مدیر مالی، حسابدار، مدیر پروژه و سرپرست کارگاه
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rolesMatrix.map((item, idx) => (
              <div key={idx} className={`p-4 rounded-xl border ${item.color} text-right space-y-2`}>
                <div className="font-bold text-xs">{item.role}</div>
                <div className="text-[11px] font-semibold opacity-90">{item.access}</div>
                <ul className="text-[11px] space-y-1 pt-2 border-t border-slate-200/60 opacity-85 font-sans">
                  {item.permissions.map((p, pIdx) => (
                    <li key={pIdx} className="flex items-center gap-1.5">
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
    </div>
  );
};
