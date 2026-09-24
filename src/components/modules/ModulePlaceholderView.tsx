import React from 'react';
import {
  Calculator,
  Coins,
  FileText,
  Warehouse,
  ShoppingCart,
  BarChart3,
  CheckSquare,
  Users,
  Award,
  FolderLock,
  Settings,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Project, PettyCash, ProgressStatement } from '../../types';
import { formatCurrencyCompact, formatNumber } from '../../utils/formatters';

interface ModulePlaceholderViewProps {
  moduleId: string;
  onBackToDashboard: () => void;
  projects: Project[];
  pettyCashList: PettyCash[];
  statements: ProgressStatement[];
}

export const ModulePlaceholderView: React.FC<ModulePlaceholderViewProps> = ({
  moduleId,
  onBackToDashboard,
  projects,
  pettyCashList,
  statements,
}) => {
  const getModuleMeta = (id: string) => {
    switch (id) {
      case 'accounting':
        return {
          title: 'ماژول مستقل حسابداری و مالی (Accounting Engine)',
          subtitle: 'مدیریت کدینگ سرفصل‌ها، دفاتر کل و معین، تراز آزمایشی و اسناد مکانیزه',
          icon: Calculator,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          metrics: [
            { label: 'اسناد صادره این ماه', value: '۲۴۸ سند' },
            { label: 'تراز آزمایشی ۸ ستونی', value: 'متعادل و متوازن' },
            { label: 'گردش حساب‌های بانکی', value: '۴۱۰.۵ میلیارد تومان' },
          ],
          features: [
            'ثبت اتوماتیک اسناد از کارتابل داشبورد مدیرعامل',
            'جداسازی قطعی هزینه از پرداخت (Expense ≠ Payment)',
            'تخصیص هزینه‌های ستادی و غیرمستقیم به مراکز هزینه',
          ],
        };
      case 'petty_cash':
        return {
          title: 'ماژول مستقل تنخواه گردان کارگاهی (Petty Cash)',
          subtitle: 'مدیریت سقف اعتبارات، شارژ حساب، کنترل فاکتورهای میدانی و واریزها',
          icon: Coins,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          metrics: [
            { label: 'تعداد تنخواه‌داران فعال', value: `${pettyCashList.length} سرپرست کارگاه` },
            { label: 'موجودی واقعی کل تنخواه‌ها', value: '۲۸۷,۰۰۰,۰۰۰ تومان' },
            { label: 'هزینه‌های در انتظار تسویه', value: '۸۹,۵۰۰,۰۰۰ تومان' },
          ],
          features: [
            'پایش سقف مجاز تنخواه و اعلام هشدار کسری نقدینگی',
            'ارسال آنی فاکتورهای اسکن‌شده به کارتابل تاییدیه',
            'تسویه مکانیزه با انتقال خودکار به سرفصل هزینه‌های مستقیم پروژه',
          ],
        };
      case 'statements':
        return {
          title: 'ماژول مستقل صورت‌وضعیت و تعدیل (Progress Billing)',
          subtitle: 'تهیه، بررسی، دفاع و وصول صورت‌وضعیت‌های کارکرد موقت، ماقبل قطعی و قطعی',
          icon: FileText,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          metrics: [
            { label: 'صورت‌وضعیت‌های در دست بررسی', value: `${statements.length} مورد` },
            { label: 'مجموع مطالبات وصول‌نشده', value: '۹۷.۶ میلیارد تومان' },
            { label: 'مطالبات معوق سررسید', value: '۴.۲ میلیارد تومان' },
          ],
          features: [
            'جداسازی درآمد کارکرد ثبتی از وصول نقدی (Revenue ≠ Receipt)',
            'اعمال خودکار کسورات قانونی (۵٪ بیمه ماده ۳۸، ۱۰٪ سپرده حسن انجام کار، مالیات تکلیفی)',
            'محاسبه شاخص‌های تعدیل نرخ پیمان بر اساس بخشنامه‌های سازمان برنامه و بودجه',
          ],
        };
      case 'inventory':
        return {
          title: 'ماژول مستقل انبارداری و کنترل کالا (Warehouse & Inventory)',
          subtitle: 'مدیریت ورود و خروج مصالح، حواله انبار، نقطه سفارش آهن‌آلات و سیمان',
          icon: Warehouse,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
          metrics: [
            { label: 'تعداد انبارهای فعال', value: '۵ انبار کارگاهی + ۱ مرکزی' },
            { label: 'ارزش ریالی موجودی کالا', value: '۵۴ میلیارد تومان' },
            { label: 'حواله‌های صادرشده امروز', value: '۱۸ حواله مصرف' },
          ],
          features: [
            'سیستم ردیابی بچ بتن و سرتیفیکیت میلگرد',
            'کاهش موجودی همزمان با تایید فاکتور در کارتابل',
            'پایش نقطه سفارش مصالح استراتژیک پروژه‌ها',
          ],
        };
      case 'procurement':
        return {
          title: 'ماژول خرید و مدیریت تأمین‌کنندگان (Procurement & Vendors)',
          subtitle: 'استعلام بها، مقایسه قیمت تأمین‌کنندگان، قراردادهای خرید و ارزیابی کیفی',
          icon: ShoppingCart,
          color: 'text-cyan-600',
          bg: 'bg-cyan-50',
          metrics: [
            { label: 'تأمین‌کنندگان فعال', value: '۱۲۶ شرکت و پیمانکار' },
            { label: 'استعلام‌های در حال بررسی', value: '۹ استعلام بها' },
            { label: 'حجم سفارشات ماه جاری', value: '۲۸.۴ میلیارد تومان' },
          ],
          features: [
            'رتبه‌بندی کیفی و سوابق تحویل به موقع فروشندگان',
            'مدیریت شرایط پرداخت (چک‌های مدت‌دار و اعتباری)',
            'یکپارچگی مستقیم با سرفصل هزینه‌های مستقیم پروژه‌ها',
          ],
        };
      default:
        return {
          title: `ماژول تخصصی سازمانی: ${id}`,
          subtitle: 'بخشی از معماری یکپارچه سامانه مدیریت پروژه‌های EPC سازه گستران پارس',
          icon: Layers,
          color: 'text-slate-700',
          bg: 'bg-slate-100',
          metrics: [
            { label: 'وضعیت در معماری', value: 'ماژول مستقل متصل' },
            { label: 'پروتکل ارتباطی', value: 'REST API & Event Bus' },
            { label: 'یکپارچگی در هسته مالی', value: 'فعال در داشبورد مرکزی' },
          ],
          features: [
            'ارسال خودکار داده‌های تحلیلی به مرکز فرماندهی',
            'امکان جداسازی یا توسعه مستقل بدون اختلال در هسته مالی',
            'دسترسی با سطوح اختیارات سازمانی RBAC',
          ],
        };
    }
  };

  const meta = getModuleMeta(moduleId);
  const Icon = meta.icon;

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>بازگشت به مرکز فرماندهی و داشبورد اصلی</span>
        </button>

        <span className="text-xs text-slate-400 font-mono">
          معماری ماژولار: Independent Micro-Module
        </span>
      </div>

      {/* Module Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs text-right">
        <div className="flex items-start gap-4 pb-6 border-b border-slate-100">
          <div className={`w-14 h-14 rounded-2xl ${meta.bg} ${meta.color} flex items-center justify-center shrink-0`}>
            <Icon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                PHASE-2 INTEGRATION
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                متصل به داشبورد زنده
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{meta.title}</h2>
            <p className="text-xs text-slate-500 mt-1">{meta.subtitle}</p>
          </div>
        </div>

        {/* Live Aggregated Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
          {meta.metrics.map((m, idx) => (
            <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono">
              <span className="text-[11px] text-slate-500 block mb-1 font-sans">{m.label}</span>
              <strong className="text-sm font-bold text-slate-900">{m.value}</strong>
            </div>
          ))}
        </div>

        {/* Architectural Principles & Capabilities */}
        <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80 mb-6">
          <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-600" />
            <span>قوانین معماری و یکپارچگی در هسته مالی شرکت:</span>
          </h3>
          <ul className="space-y-2 text-xs text-slate-600">
            {meta.features.map((feat, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Return Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            اطلاعات این ماژول در داشبورد اصلی به‌صورت برخط تجمیع و پایش می‌شود.
          </span>
          <button
            onClick={onBackToDashboard}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            مشاهده شاخص‌ها در داشبورد
          </button>
        </div>
      </div>
    </div>
  );
};
