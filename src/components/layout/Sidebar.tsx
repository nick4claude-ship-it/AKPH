import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, ChevronDown, LogOut, Sparkles, X } from 'lucide-react';
import { UserProfile } from '../../types';
import { matchNav, navTrail, visibleNav, NavNode } from '../../navigation/navConfig';
import { usePermission, useSession } from '../../store/session';
import { companyLogo } from '../../assets/images';
import { Dialog } from '../../ui/Dialog';
import { toPersianDigits, formatText } from '../../utils/formatters';

export const PRODUCT_NAME = 'سامانه پاک';
export const PRODUCT_SUBTITLE = 'پورتال آریا کاوش';
export const PRODUCT_TITLE = `${PRODUCT_NAME}: ${PRODUCT_SUBTITLE}`;

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  user: UserProfile;
  /** DEV only: opens the role switcher. Omitted in production (sign-out belongs to WordPress). */
  onOpenLogout?: () => void;
  onOpenAiAgent: () => void;
  /** Opens the signed-in user's account page. */
  onOpenAccount?: () => void;
  counts?: Record<string, string>;
  /** Mobile and tablet: the menu is a drawer opened from the header. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

/** Navigation panel: brand, assistant shortcut, the menu built from navConfig, and the signed-in user. */
const NavPanel: React.FC<Omit<SidebarProps, 'mobileOpen'> & { drawer?: boolean }> = ({
  collapsed,
  onToggleCollapse,
  user,
  onOpenLogout,
  onOpenAiAgent,
  onOpenAccount,
  counts = {},
  onCloseMobile,
  drawer = false,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDemoData } = useSession();
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
  const narrow = collapsed && !drawer;

  // Keep the group of the current page expanded, including after Back/Forward navigation.
  useEffect(() => {
    const group = activeTrail[0];
    if (group && navChildren(group).length) setOpen((o) => (o[group] ? o : { ...o, [group]: true }));
  }, [location.pathname]);

  const go = (node: NavNode) => {
    navigate(navPath(node.id));
    onCloseMobile();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderItem = (item: NavNode, depth: number) => {
    const Icon = item.icon;
    const children = navChildren(item.id).filter((c) => !c.hidden);
    const isGroup = children.length > 0;
    const inTrail = activeTrail.includes(item.id);
    const isActive = inTrail && (!isGroup || narrow);
    const count = item.countKey ? counts[item.countKey] : undefined;
    const expanded = isGroup && !narrow && (open[item.id] ?? false);

    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => {
            if (isGroup && !narrow) {
              setOpen((o) => ({ ...o, [item.id]: !expanded }));
              if (!expanded && !inTrail) go(item);
            } else {
              go(item);
            }
          }}
          title={narrow ? item.label : undefined}
          aria-label={narrow ? item.label : undefined}
          aria-expanded={isGroup && !narrow ? expanded : undefined}
          aria-current={isActive ? 'page' : undefined}
          className={`w-full flex items-center gap-3 rounded-lg text-sm transition-colors cursor-pointer text-right ${depth ? 'py-2 pr-9 pl-3' : 'py-2 px-3'} ${
            isActive ? 'bg-brand text-brand-ink font-bold' : inTrail ? 'text-white bg-white/10 font-medium' : 'text-slate-300 hover:bg-white/10 hover:text-white'
          } ${narrow ? 'justify-center px-0' : ''}`}
        >
          <Icon className={`${depth ? 'w-4 h-4' : 'w-5 h-5'} shrink-0 ${isActive ? 'text-brand-ink' : inTrail ? 'text-amber-400' : 'text-slate-400'}`} />
          {!narrow && (
            <span className="flex items-center justify-between gap-2 flex-1 min-w-0">
              <span className="truncate">{formatText(item.label)}</span>
              <span className="flex items-center gap-2 shrink-0">
                {count && !isActive && (
                  <span className="min-w-6 px-2 rounded-full bg-white/10 text-xs text-slate-200 text-center tabular-nums">{toPersianDigits(count)}</span>
                )}
                {isGroup && <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />}
              </span>
            </span>
          )}
        </button>
        {expanded && <ul className="mt-1 space-y-1">{children.map((c) => renderItem(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="h-full flex flex-col bg-nav text-slate-200">
      {/* Brand */}
      <div className="h-16 flex items-center justify-between gap-2 px-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src={companyLogo}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          {!narrow && (
            <div className="min-w-0">
              <p className="text-base font-bold text-white truncate" title={PRODUCT_TITLE}>
                {PRODUCT_NAME}
                <span className="sr-only">:</span>
              </p>
              <p className="text-xs text-amber-300 truncate">{PRODUCT_SUBTITLE}</p>
            </div>
          )}
        </div>
        {drawer ? (
          <button type="button" onClick={onCloseMobile} aria-label="بستن منو" className="btn btn-icon text-slate-300 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'گسترش منو' : 'جمع کردن منو'}
            className="btn btn-icon text-slate-300 hover:text-white hover:bg-white/10"
          >
            {collapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Assistant */}
      <div className="px-3 pt-3 shrink-0">
        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onOpenAiAgent();
          }}
          aria-label={narrow ? 'دستیار مدیریت' : undefined}
          className={`w-full flex items-center gap-3 py-2 px-3 rounded-lg border border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 transition-colors text-sm font-medium cursor-pointer ${
            narrow ? 'justify-center px-0' : ''
          }`}
        >
          <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
          {!narrow && (
            <span className="flex items-center justify-between gap-2 flex-1">
              <span className="truncate">دستیار مدیریت</span>
              {isDemoData && <span className="px-2 rounded-full bg-amber-300/20 text-xs text-amber-200">نمایشی</span>}
            </span>
          )}
        </button>
      </div>

      {/* Menu (built from navConfig) */}
      <nav aria-label="منوی اصلی" className="flex-1 min-h-0 overflow-y-auto p-3">
        <ul className="space-y-1">{nodes.filter((n) => !n.parent && !n.hidden).map((n) => renderItem(n, 0))}</ul>
      </nav>

      {/* Signed-in user */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <div className={`flex items-center gap-2 ${narrow ? 'justify-center' : 'justify-between'}`}>
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onOpenAccount?.();
            }}
            disabled={!onOpenAccount}
            aria-label={narrow ? `حساب کاربری ${user.name}` : undefined}
            className="flex items-center gap-3 min-w-0 flex-1 rounded-lg p-1 text-right hover:bg-white/10 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
          >
            <span className="w-10 h-10 rounded-full overflow-hidden bg-slate-700 shrink-0">
              {user.avatar && <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />}
            </span>
            {!narrow && (
              <span className="min-w-0">
                <span className="block text-sm font-bold text-white truncate">{formatText(user.name)}</span>
                <span className="block text-xs text-slate-400 truncate">{formatText(user.role)}</span>
              </span>
            )}
          </button>
          {onOpenLogout && !narrow && (
            <button type="button" onClick={onOpenLogout} title="تغییر کاربر (فقط محیط توسعه)" aria-label="تغییر کاربر (فقط محیط توسعه)" className="btn btn-icon text-slate-300 hover:text-white hover:bg-white/10">
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const { collapsed, mobileOpen, onCloseMobile } = props;
  return (
    <>
      <aside className={`no-print hidden lg:block fixed top-0 right-0 z-30 h-screen border-l border-white/10 transition-[width] duration-200 ${collapsed ? 'w-20' : 'w-68'}`}>
        <NavPanel {...props} />
      </aside>
      {mobileOpen && (
        <Dialog
          label="منوی اصلی"
          onClose={onCloseMobile}
          closeOnBackdrop
          overlayClassName="fixed inset-0 z-50 bg-slate-950/60 lg:hidden"
          className="fixed inset-y-0 right-0 w-72 shadow-xl outline-none"
        >
          <NavPanel {...props} collapsed={false} drawer />
        </Dialog>
      )}
    </>
  );
};
