/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LayoutDashboard,
  Building2,
  Briefcase,
  FileSpreadsheet,
  ShoppingCart,
  Warehouse,
  Coins,
  Landmark,
  Calculator,
  CreditCard,
  ArrowDownLeft,
  Wallet,
  Users,
  Award,
  FolderLock,
  ShieldCheck,
  BarChart3,
  Sparkles,
  Settings,
  UserCheck,
  HardHat,
  Truck,
  FileSignature,
  Bell,
  type LucideIcon,
} from 'lucide-react';

/**
 * پیکربندی واحد منوی کناری و مسیرها. هر گره فقط والد خود را می‌شناسد؛
 * درخت منو، عنوان صفحه و مسیریابی همگی از همین آرایه ساخته می‌شوند.
 */
export interface NavNode {
  id: string;
  parent?: string;
  label: string;
  icon: LucideIcon;
  /** Route path (hash router). Group nodes without a path open their first child. */
  path?: string;
  /** Key into the sidebar counters selector. */
  countKey?: string;
  badge?: string;
  /** Routed page that is reached from the header rather than the sidebar. */
  hidden?: boolean;
}

export const navConfig: NavNode[] = [
  { id: 'dashboard', label: 'داشبورد مدیریتی', icon: LayoutDashboard, path: '/', badge: 'زنده' },
  { id: 'projects', label: 'پروژه‌ها', icon: Building2, path: '/projects', countKey: 'projects' },

  { id: 'contracts', label: 'قراردادها', icon: Briefcase, countKey: 'contracts' },
  { id: 'contracts.client', parent: 'contracts', label: 'قرارداد کارفرما', icon: FileSignature, path: '/contracts/client' },
  { id: 'contracts.subcontract', parent: 'contracts', label: 'قرارداد پیمانکار جزء', icon: HardHat, path: '/contracts/subcontract' },

  { id: 'statements', label: 'صورت‌وضعیت', icon: FileSpreadsheet, countKey: 'statements' },
  { id: 'statements.client', parent: 'statements', label: 'صورت‌وضعیت کارفرما', icon: ArrowDownLeft, path: '/statements/client' },
  { id: 'statements.subcontractor', parent: 'statements', label: 'صورت‌وضعیت پیمانکار جزء', icon: HardHat, path: '/statements/subcontractor' },

  { id: 'procurement', label: 'خرید', icon: ShoppingCart, path: '/procurement' },
  { id: 'inventory', label: 'انبار', icon: Warehouse, path: '/inventory', countKey: 'inventory' },
  { id: 'petty_cash', label: 'تنخواه', icon: Coins, path: '/petty-cash', countKey: 'petty_cash' },

  { id: 'finance', label: 'مالی', icon: Landmark },
  { id: 'finance.accounting', parent: 'finance', label: 'حسابداری', icon: Calculator, path: '/finance/accounting' },
  { id: 'finance.payments', parent: 'finance', label: 'پرداخت‌ها', icon: CreditCard, path: '/finance/payments', countKey: 'payments' },
  { id: 'finance.receipts', parent: 'finance', label: 'دریافت‌ها', icon: ArrowDownLeft, path: '/finance/receipts' },
  { id: 'finance.banks', parent: 'finance', label: 'بانک‌ها', icon: Landmark, path: '/finance/banks' },
  { id: 'finance.cash', parent: 'finance', label: 'صندوق', icon: Wallet, path: '/finance/cash' },

  { id: 'partners', label: 'طرف‌های حساب', icon: Users },
  { id: 'partners.clients', parent: 'partners', label: 'کارفرمایان', icon: UserCheck, path: '/partners/clients' },
  { id: 'partners.subcontractors', parent: 'partners', label: 'پیمانکاران جزء', icon: HardHat, path: '/partners/subcontractors' },
  { id: 'partners.suppliers', parent: 'partners', label: 'تأمین‌کنندگان', icon: Truck, path: '/partners/suppliers' },

  { id: 'payroll', label: 'منابع انسانی و حقوق', icon: Award, path: '/payroll' },
  { id: 'documents', label: 'اسناد', icon: FolderLock, path: '/documents' },
  { id: 'approvals', label: 'تأییدات', icon: ShieldCheck, path: '/approvals', countKey: 'approvals' },
  { id: 'notifications', label: 'مرکز اعلان‌ها', icon: Bell, path: '/notifications', hidden: true },
  { id: 'reports', label: 'گزارش‌ها', icon: BarChart3, path: '/reports' },
  { id: 'ai', label: 'دستیار هوشمند', icon: Sparkles, path: '/ai' },
  { id: 'settings', label: 'تنظیمات', icon: Settings, path: '/settings' },
];

export const navById = (id: string) => navConfig.find((n) => n.id === id);
export const navChildren = (id?: string) => navConfig.filter((n) => n.parent === id);

/** Path of a node; group nodes resolve to their first child. */
export function navPath(id: string): string {
  const node = navById(id);
  if (!node) return '/';
  if (node.path) return node.path;
  const first = navChildren(id)[0];
  return first ? navPath(first.id) : '/';
}

/** The nav node whose path is the longest prefix of the current location. */
export function matchNav(pathname: string): NavNode | undefined {
  let best: NavNode | undefined;
  for (const n of navConfig) {
    if (!n.path) continue;
    const hit = n.path === '/' ? pathname === '/' : pathname === n.path || pathname.startsWith(`${n.path}/`);
    if (hit && (!best || n.path.length > (best.path?.length ?? 0))) best = n;
  }
  return best;
}

/** Breadcrumb of labels from the root group to the matched node. */
export function navTrail(node?: NavNode): NavNode[] {
  const trail: NavNode[] = [];
  let cur = node;
  while (cur) {
    trail.unshift(cur);
    cur = cur.parent ? navById(cur.parent) : undefined;
  }
  return trail;
}
