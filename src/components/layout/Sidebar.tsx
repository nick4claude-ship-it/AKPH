import React from 'react';
import {
  LayoutDashboard,
  Building2,
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
  ChevronRight,
  ChevronLeft,
  LogOut,
  Sparkles,
  CreditCard,
  Briefcase,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { UserProfile } from '../../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  user: UserProfile;
  onOpenLogout: () => void;
  onOpenAiAgent: () => void;
  counts?: Record<string, string>;
}

export const navItems = [
  { id: 'dashboard', label: 'داشبورد مدیریتی', icon: LayoutDashboard, badge: 'زنده' },
  { id: 'projects', label: 'مدیریت پروژه‌ها', icon: Building2 },
  { id: 'contracts', label: 'قراردادها (کارفرما و جزء)', icon: Briefcase },
  { id: 'statements', label: 'صورت‌وضعیت‌ها', icon: FileSpreadsheet },
  { id: 'procurement', label: 'بازرگانی و تدارکات', icon: ShoppingCart },
  { id: 'inventory', label: 'انبارداری و مصالح', icon: Warehouse },
  { id: 'petty_cash', label: 'تنخواه گردان کارگاه‌ها', icon: Coins },
  { id: 'finance', label: 'خزانه‌داری و پرداخت‌ها', icon: CreditCard },
  { id: 'accounting', label: 'حسابداری مالی', icon: Calculator },
  { id: 'partners', label: 'شرکا و ذینفعان', icon: Users },
  { id: 'payroll', label: 'پرسنل و حقوق دستمزد', icon: Award },
  { id: 'documents', label: 'مرکز اسناد یکپارچه', icon: FolderLock },
  { id: 'approvals', label: 'کارتابل مصوبات مدیریت', icon: ShieldCheck, badge: 'فوری' },
  { id: 'reports', label: 'هوش تجاری و گزارشات', icon: BarChart3 },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  user,
  onOpenLogout,
  onOpenAiAgent,
  counts = {},
}) => {
  return (
    <aside
      className={`fixed top-0 right-0 z-30 h-screen bg-slate-900 text-slate-200 border-l border-slate-800 transition-all duration-300 flex flex-col justify-between select-none ${
        collapsed ? 'w-20' : 'w-68'
      }`}
    >
      {/* Top Brand Header */}
      <div>
        <div className="h-18 flex items-center justify-between px-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/src/assets/images/company_logo_emblem_1790176049355.jpg"
                alt="لوگوی شرکت سازه گستران پارس"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-white tracking-tight truncate">
                  سازه گستران پارس
                </h1>
                <p className="text-[11px] text-amber-400 font-medium truncate">
                  سامانه جامع پیمانکاری EPC
                </p>
              </div>
            )}
          </div>

          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'گسترش منو' : 'جمع کردن منو'}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* AI Assistant Quick Pill Button in Sidebar */}
        <div className="px-3 pt-3">
          <button
            onClick={onOpenAiAgent}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-all text-xs font-semibold cursor-pointer group shadow-xs ${
              collapsed ? 'justify-center px-2' : ''
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
            {!collapsed && (
              <div className="flex items-center justify-between w-full">
                <span className="truncate">دستیار هوشمند مدیریت</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">AI</span>
              </div>
            )}
          </button>
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-270px)] scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-right group ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-amber-400'
                  }`}
                />

                {!collapsed && (
                  <div className="flex items-center justify-between w-full truncate">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-300">
                        {item.badge}
                      </span>
                    )}
                    {counts[item.id] && !isActive && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {counts[item.id]}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Footer Profile & Logout */}
      <div className="p-3 border-t border-slate-800/90 bg-slate-950/60">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-700 border border-slate-600 shrink-0">
              <img
                src={user.avatar}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.role}</p>
              </div>
            )}
          </div>

          <button
            onClick={onOpenLogout}
            title="خروج از حساب / تغییر کاربر"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
