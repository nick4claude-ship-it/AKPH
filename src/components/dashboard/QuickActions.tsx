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
  { id: 'record_expense', label: 'ثبت هزینه پروژه', icon: Receipt, color: 'text-amber-600', bg: 'bg-amber-50 hover:bg-amber-100/80 border-amber-200' },
  { id: 'record_invoice', label: 'ثبت فاکتور خرید', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 hover:bg-blue-100/80 border-blue-200' },
  { id: 'charge_petty', label: 'شارژ تنخواه کارگاه', icon: Coins, color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200' },
  { id: 'record_receipt', label: 'ثبت دریافت (کارفرما)', icon: ArrowDownLeft, color: 'text-teal-600', bg: 'bg-teal-50 hover:bg-teal-100/80 border-teal-200' },
  { id: 'record_payment', label: 'ثبت پرداخت (حسابداری)', icon: ArrowUpRight, color: 'text-rose-600', bg: 'bg-rose-50 hover:bg-rose-100/80 border-rose-200' },
  { id: 'submit_statement', label: 'ثبت صورت‌وضعیت جدید', icon: PlusCircle, color: 'text-indigo-600', bg: 'bg-indigo-50 hover:bg-indigo-100/80 border-indigo-200' },
  { id: 'new_project', label: 'تعریف پروژه جدید', icon: FolderPlus, color: 'text-purple-600', bg: 'bg-purple-50 hover:bg-purple-100/80 border-purple-200' },
  { id: 'new_supplier', label: 'ثبت تأمین‌کننده', icon: Truck, color: 'text-slate-700', bg: 'bg-slate-100 hover:bg-slate-200 border-slate-200' },
  { id: 'view_financial_report', label: 'مشاهده گزارش تحلیلی', icon: BarChart2, color: 'text-slate-800', bg: 'bg-slate-100 hover:bg-slate-200 border-slate-200' },
];

export const QuickActions: React.FC<QuickActionsProps> = ({ onTriggerAction }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">دسترسی سریع به عملیات پرکاربرد</h3>
          <p className="text-[11px] text-slate-500">میانبرهای مستقیم به ماژول‌های حسابداری، تنخواه، تدارکات و صورت‌وضعیت</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        {quickActionItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onTriggerAction(item.id, item.label)}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer group hover:scale-[1.02] shadow-2xs ${item.bg}`}
            >
              <div className={`p-2 rounded-lg bg-white shadow-2xs mb-1.5 ${item.color} group-hover:scale-110 transition-transform`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
