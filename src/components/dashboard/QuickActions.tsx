import React from 'react';
import {
  PlusCircle,
  Receipt,
  FileText,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  FolderPlus,
  Truck,
  BarChart2,
  Zap,
} from 'lucide-react';

interface QuickActionsProps {
  onTriggerAction: (actionKey: string, actionTitle: string) => void;
}

export const quickActionItems = [
  { id: 'record_expense', label: 'ثبت هزینه پروژه', icon: Receipt, color: 'text-amber-700', bg: 'bg-amber-50 hover:bg-amber-100/80 border-amber-200' },
  { id: 'record_invoice', label: 'ثبت فاکتور خرید', icon: FileText, color: 'text-blue-700', bg: 'bg-blue-50 hover:bg-blue-100/80 border-blue-200' },
  { id: 'charge_petty', label: 'شارژ تنخواه کارگاه', icon: Coins, color: 'text-emerald-700', bg: 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200' },
  { id: 'record_receipt', label: 'ثبت دریافت (کارفرما)', icon: ArrowDownLeft, color: 'text-teal-700', bg: 'bg-teal-50 hover:bg-teal-100/80 border-teal-200' },
  { id: 'record_payment', label: 'ثبت پرداخت (حسابداری)', icon: ArrowUpRight, color: 'text-rose-700', bg: 'bg-rose-50 hover:bg-rose-100/80 border-rose-200' },
  { id: 'submit_statement', label: 'ثبت صورت‌وضعیت جدید', icon: PlusCircle, color: 'text-indigo-700', bg: 'bg-indigo-50 hover:bg-indigo-100/80 border-indigo-200' },
  { id: 'new_project', label: 'تعریف پروژه جدید', icon: FolderPlus, color: 'text-purple-700', bg: 'bg-purple-50 hover:bg-purple-100/80 border-purple-200' },
  { id: 'new_supplier', label: 'ثبت تأمین‌کننده', icon: Truck, color: 'text-slate-700', bg: 'bg-slate-100 hover:bg-slate-200 border-slate-200' },
  { id: 'view_financial_report', label: 'مشاهده گزارش تحلیلی', icon: BarChart2, color: 'text-slate-800', bg: 'bg-slate-100 hover:bg-slate-200 border-slate-200' },
];

export const QuickActions: React.FC<QuickActionsProps> = ({ onTriggerAction }) => {
  return (
    <section className="card p-4" aria-labelledby="quick-actions-title">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-9 h-9 rounded-lg bg-brand-soft text-brand-strong flex items-center justify-center">
          <Zap className="w-5 h-5" />
        </span>
        <div>
          <h3 id="quick-actions-title" className="text-base font-bold text-ink">
            عملیات پرکاربرد
          </h3>
          <p className="text-xs text-ink-subtle">میانبر ثبت در حسابداری، تنخواه، تدارکات و صورت‌وضعیت</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9 gap-2">
        {quickActionItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTriggerAction(item.id, item.label)}
              className="min-h-20 p-3 rounded-lg border border-line bg-surface hover:border-amber-300 hover:bg-brand-soft flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-pointer"
            >
              <Icon className={`w-5 h-5 ${item.color}`} />
              <span className="text-sm font-medium text-ink">{item.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
