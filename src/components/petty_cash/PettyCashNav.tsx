import React from 'react';
import {
  LayoutDashboard,
  WalletCards,
  PlusCircle,
  FileCheck2,
  ArrowDownToLine,
  HelpCircle,
  Scale,
  Lock,
  FileText,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { PettyCashSubTab } from '../../types';

interface PettyCashNavProps {
  activeSubTab: PettyCashSubTab;
  setActiveSubTab: (tab: PettyCashSubTab) => void;
  pendingApprovalsCount: number;
  lowBalanceCount: number;
  pendingRequestsCount: number;
}

export const PettyCashNav: React.FC<PettyCashNavProps> = ({
  activeSubTab,
  setActiveSubTab,
  pendingApprovalsCount,
  lowBalanceCount,
  pendingRequestsCount,
}) => {
  const navItems: {
    id: PettyCashSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'داشبورد تنخواه‌گردان',
      icon: LayoutDashboard,
    },
    {
      id: 'accounts',
      label: 'حساب‌های تنخواه',
      icon: WalletCards,
      badge: lowBalanceCount > 0 ? lowBalanceCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-700',
    },
    {
      id: 'new_expense',
      label: 'ثبت هزینه جدید',
      icon: PlusCircle,
    },
    {
      id: 'approvals',
      label: 'کارتابل تأییدات',
      icon: FileCheck2,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      badgeColor: 'bg-rose-100 text-rose-700 font-bold',
    },
    {
      id: 'replenishments',
      label: 'شارژ تنخواه',
      icon: ArrowDownToLine,
    },
    {
      id: 'requests',
      label: 'درخواست‌های شارژ',
      icon: HelpCircle,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
      badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
      id: 'reconciliation',
      label: 'تسویه و مغایرت‌گیری',
      icon: Scale,
    },
    {
      id: 'closing',
      label: 'بستن دوره تنخواه',
      icon: Lock,
    },
    {
      id: 'reports',
      label: 'گزارش‌ها و صورتجلسات',
      icon: FileText,
    },
    {
      id: 'settings',
      label: 'دسته‌بندی و تنظیمات',
      icon: Sliders,
    },
  ];

  return (
    <div className="bg-white border-b border-slate-200 sticky top-16 z-20 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between overflow-x-auto no-scrollbar py-2.5 gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors relative ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                      isActive ? 'bg-slate-950 text-white' : item.badgeColor
                    }`}
                  >
                    {item.badge.toLocaleString('fa-IR')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
