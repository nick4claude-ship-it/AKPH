import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, ChevronDown, LogOut, Sparkles } from 'lucide-react';
import { UserProfile } from '../../types';
import { matchNav, navTrail, visibleNav, NavNode } from '../../navigation/navConfig';
import { usePermission, useCompany } from '../../store/session';
import { companyLogo } from '../../assets/images';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  user: UserProfile;
  /** DEV only: opens the role switcher. Omitted in production (sign-out belongs to WordPress). */
  onOpenLogout?: () => void;
  onOpenAiAgent: () => void;
  counts?: Record<string, string>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  user,
  onOpenLogout,
  onOpenAiAgent,
  counts = {},
}) => {
  const company = useCompany();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTrail = navTrail(matchNav(location.pathname)).map((n) => n.id);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { can } = usePermission();
  const nodes = useMemo(() => visibleNav(can), [can]);
  const navChildren = (id: string) => nodes.filter((n) => n.parent === id);
  const navPath = (id: string): string => {
    const node = nodes.find((n) => n.id === id);
    if (node?.path) return node.path;
    const first = navChildren(id)[0];
    return first ? navPath(first.id) : '/';
  };

  // Keep the group of the current page expanded, including after Back/Forward navigation.
  useEffect(() => {
    const group = activeTrail[0];
    if (group && navChildren(group).length) setOpen((o) => (o[group] ? o : { ...o, [group]: true }));
  }, [location.pathname]);

  const go = (node: NavNode) => {
    navigate(navPath(node.id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderItem = (item: NavNode, depth: number) => {
    const Icon = item.icon;
    const children = navChildren(item.id).filter((c) => !c.hidden);
    const isGroup = children.length > 0;
    const inTrail = activeTrail.includes(item.id);
    const isActive = inTrail && (!isGroup || collapsed);
    const count = item.countKey ? counts[item.countKey] : undefined;
    const expanded = isGroup && !collapsed && (open[item.id] ?? false);

    return (
      <div key={item.id}>
        <button
          onClick={() => {
            if (isGroup && !collapsed) {
              setOpen((o) => ({ ...o, [item.id]: !expanded }));
              if (!expanded && !inTrail) go(item);
            } else {
              go(item);
            }
          }}
          title={collapsed ? item.label : undefined}
          aria-expanded={isGroup ? expanded : undefined}
          aria-current={isActive ? 'page' : undefined}
          className={`w-full flex items-center gap-3 px-3 ${depth ? 'py-2 pr-8 text-[11px]' : 'py-2.5 text-xs'} rounded-lg font-medium transition-colors cursor-pointer text-right group ${
            isActive
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : inTrail
                ? 'text-white bg-slate-800/60'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          } ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <Icon
            className={`${depth ? 'w-3.5 h-3.5' : 'w-4 h-4'} shrink-0 ${
              isActive ? 'text-slate-950' : inTrail ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-400'
            }`}
          />

          {!collapsed && (
            <div className="flex items-center justify-between w-full truncate">
              <span className="truncate">{item.label}</span>
              <span className="flex items-center gap-1.5">
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-300">
                    {item.badge}
                  </span>
                )}
                {count && !isActive && <span className="text-[11px] text-slate-400 font-mono">{count}</span>}
                {isGroup && (
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                )}
              </span>
            </div>
          )}
        </button>
        {expanded && <div className="mt-1 space-y-1">{children.map((c) => renderItem(c, depth + 1))}</div>}
      </div>
    );
  };

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
                src={companyLogo}
                alt={`لوگوی ${company.name}`}
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
                  {company.name}
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
                <span className="truncate">دستیار مدیریت (نسخه نمایشی)</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">AI</span>
              </div>
            )}
          </button>
        </div>

        {/* Navigation List (built from navConfig) */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-270px)] scrollbar-thin">
          {nodes.filter((n) => !n.parent && !n.hidden).map((n) => renderItem(n, 0))}
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

          {onOpenLogout && (
            <button
              onClick={onOpenLogout}
              title="تغییر کاربر (فقط محیط توسعه)"
              aria-label="تغییر کاربر (فقط محیط توسعه)"
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
