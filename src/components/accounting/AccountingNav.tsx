import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  TrendingUp,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Wallet,
  Users,
  Clock,
  CreditCard,
  Network,
  Layers,
  Building2,
  BarChart3,
  CalendarCheck,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { AccountingSubTab } from '../../types';
import { formatText } from '../../utils/formatters';

interface AccountingNavProps {
  activeSubTab: AccountingSubTab;
  onSelectSubTab: (tab: AccountingSubTab) => void;
  pendingApprovalsCount: number;
}

export const AccountingNav: React.FC<AccountingNavProps> = ({
  activeSubTab,
  onSelectSubTab,
  pendingApprovalsCount,
}) => {
  const navItems: {
    id: AccountingSubTab;
    label: string;
    icon: React.ElementType;
    badge?: number | string;
    badgeColor?: string;
  }[] = [
    { id: 'dashboard', label: 'داشبورد حسابداری', icon: LayoutDashboard },
    {
      id: 'journal_entries',
      label: 'اسناد حسابداری',
      icon: FileSpreadsheet,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      badgeColor: 'bg-rose-700 text-white',
    },
    { id: 'revenues', label: 'درآمدها (کارکرد)', icon: TrendingUp },
    { id: 'expenses', label: 'هزینه‌ها (سرفصل‌ها)', icon: Receipt },
    { id: 'receipts', label: 'دریافت‌ها (وجوه نقد/چک)', icon: ArrowDownLeft },
    { id: 'payments', label: 'پرداخت‌ها (تادیه)', icon: ArrowUpRight },
    { id: 'bank_accounts', label: 'حساب‌های بانکی', icon: Landmark },
    { id: 'cash_desks', label: 'صندوق‌های ریالی', icon: Wallet },
    { id: 'counterparties', label: 'طرف حساب‌ها و اشخاص', icon: Users },
    { id: 'accounts_receivable', label: 'بدهکاران و مطالبات', icon: Clock },
    { id: 'accounts_payable', label: 'بستانکاران و بدهی‌ها', icon: CreditCard },
    { id: 'chart_of_accounts', label: 'سرفصل‌های حسابداری (کدینگ)', icon: Network },
    { id: 'subledgers', label: 'حساب‌های تفصیلی', icon: Layers },
    { id: 'projects_cost_centers', label: 'پروژه‌ها و مراکز هزینه', icon: Building2 },
    { id: 'financial_reports', label: 'گزارش‌های مالی و دفاتر', icon: BarChart3 },
    { id: 'period_closing', label: 'بستن دوره مالی', icon: CalendarCheck },
    { id: 'reconciliation_settings', label: 'تطبیق بانکی و بازرسی', icon: ShieldCheck },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs overflow-x-auto select-none">
      <div className="flex items-center gap-2 min-w-max pb-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSubTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectSubTab(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
              <span>{formatText(item.label)}</span>
              {item.badge !== undefined && (
                <span
                  className={`text-xs px-2 py-0.2 rounded-full tabular-nums font-bold ${
                    item.badgeColor || 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {formatText(item.badge)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
