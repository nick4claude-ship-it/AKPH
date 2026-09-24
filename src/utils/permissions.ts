/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PortalRole, UserProfile } from '../types';

export type { PortalRole };

export const PORTAL_ROLES: readonly PortalRole[] = ['مدیر سیستم', 'مدیر ارشد', 'مدیر پروژه', 'حسابدار'];

/** WordPress role slug (or capability-bearing role name) → portal role. Unknown slugs get no role. */
export function roleFromWordPress(slug: string | undefined | null): PortalRole | null {
  switch ((slug || '').trim().toLowerCase()) {
    case 'administrator':
    case 'paydar_admin':
    case 'paydar_system_admin':
    case 'مدیر سیستم':
      return 'مدیر سیستم';
    case 'paydar_senior_manager':
    case 'paydar_manager':
    case 'مدیر ارشد':
      return 'مدیر ارشد';
    case 'paydar_project_manager':
    case 'مدیر پروژه':
      return 'مدیر پروژه';
    case 'paydar_accountant':
    case 'حسابدار':
      return 'حسابدار';
    default:
      return null;
  }
}

export type UserAction =
  // صورت‌وضعیت کارفرما
  | 'client_statement.prepare'
  | 'client_statement.consultant_approval'
  | 'client_statement.employer_approval'
  | 'client_statement.return'
  | 'receipt.record'
  // صورت‌وضعیت پیمانکار جزء
  | 'sub_statement.create'
  | 'sub_statement.measure'
  | 'sub_statement.site_approval'
  | 'sub_statement.pm_approval'
  | 'sub_statement.finance_approval'
  | 'sub_statement.ceo_approval'
  | 'sub_statement.return'
  // قراردادها
  | 'contract.manage'
  // تنخواه
  | 'petty.submit_expense'
  | 'petty.approve_pm'
  | 'petty.approve_finance'
  | 'petty.approve_ceo'
  | 'petty.reject'
  | 'petty.request_replenishment'
  | 'petty.manage_funds'
  | 'petty.reconcile'
  // خرید
  | 'requisition.create'
  | 'requisition.approve_site'
  | 'requisition.approve_pm'
  | 'requisition.approve_procurement'
  | 'requisition.approve_final'
  | 'requisition.cancel'
  | 'purchase_order.create'
  | 'supplier.manage'
  | 'vendor_invoice.approve'
  // خزانه
  | 'payment_request.create'
  | 'payment_request.approve'
  | 'payment.execute'
  // حقوق
  | 'payroll.approve'
  // حسابداری
  | 'journal.create'
  | 'journal.approve'
  | 'journal.reverse'
  | 'fiscal.close'
  // انبار
  | 'inventory.receive'
  | 'inventory.issue_request'
  | 'inventory.issue_confirm'
  | 'inventory.return'
  | 'inventory.transfer'
  | 'inventory.stocktake'
  | 'inventory.manage_catalog'
  // سایر
  | 'document.manage'
  | 'settings.manage'
  | 'reports.financial';

/** Actions that approve someone else's work: the creator can never perform them. */
const APPROVAL_ACTIONS: ReadonlySet<UserAction> = new Set<UserAction>([
  'client_statement.consultant_approval',
  'client_statement.employer_approval',
  'sub_statement.site_approval',
  'sub_statement.pm_approval',
  'sub_statement.finance_approval',
  'sub_statement.ceo_approval',
  'petty.approve_pm',
  'petty.approve_finance',
  'petty.approve_ceo',
  'requisition.approve_site',
  'requisition.approve_pm',
  'requisition.approve_procurement',
  'requisition.approve_final',
  'vendor_invoice.approve',
  'payment_request.approve',
  'payroll.approve',
  'journal.approve',
  'inventory.issue_confirm',
]);

const ALL = '*' as const;

const ROLE_PERMISSIONS: Record<PortalRole, typeof ALL | ReadonlySet<UserAction>> = {
  'مدیر سیستم': ALL,
  'مدیر ارشد': ALL,
  'حسابدار': new Set<UserAction>([
    'client_statement.employer_approval',
    'client_statement.return',
    'receipt.record',
    'sub_statement.finance_approval',
    'sub_statement.return',
    'contract.manage',
    'petty.approve_finance',
    'petty.reject',
    'petty.request_replenishment',
    'petty.manage_funds',
    'petty.reconcile',
    'requisition.approve_procurement',
    'requisition.cancel',
    'purchase_order.create',
    'supplier.manage',
    'vendor_invoice.approve',
    'payment_request.create',
    'payment.execute',
    'payroll.approve',
    'journal.create',
    'journal.approve',
    'journal.reverse',
    'inventory.receive',
    'inventory.stocktake',
    'inventory.manage_catalog',
    'document.manage',
    'reports.financial',
  ]),
  'مدیر پروژه': new Set<UserAction>([
    'client_statement.prepare',
    'client_statement.consultant_approval',
    'client_statement.return',
    'sub_statement.create',
    'sub_statement.measure',
    'sub_statement.site_approval',
    'sub_statement.pm_approval',
    'sub_statement.return',
    'petty.submit_expense',
    'petty.approve_pm',
    'petty.reject',
    'petty.request_replenishment',
    'requisition.create',
    'requisition.approve_site',
    'requisition.approve_pm',
    'requisition.cancel',
    'inventory.receive',
    'inventory.issue_request',
    'inventory.issue_confirm',
    'inventory.return',
    'inventory.transfer',
    'document.manage',
    'reports.financial',
  ]),
};

/** Which approval action a configurable approval-chain role (e.g. petty-cash chain) performs. */
export const PETTY_STEP_ACTION: Record<PortalRole, UserAction> = {
  'مدیر پروژه': 'petty.approve_pm',
  'حسابدار': 'petty.approve_finance',
  'مدیر ارشد': 'petty.approve_ceo',
  'مدیر سیستم': 'petty.approve_ceo',
};

export interface ActionContext {
  /** Creator of the record being acted on (user id or display name). */
  createdBy?: string | null;
  /** Project of the record; project managers may act only inside their own projects. */
  projectId?: string | null;
  amount?: number;
  status?: string;
}

export interface PermissionCheck {
  ok: boolean;
  reason?: string;
}

const sameUser = (user: UserProfile, who?: string | null) => {
  const w = (who || '').trim();
  if (!w) return false;
  return w === user.id || w === user.name.trim() || w.startsWith(`${user.name.trim()} (`);
};

/** true when the user may see/act on data of this project (project managers: own projects only). */
export function canAccessProject(user: UserProfile | null | undefined, projectId?: string | null): boolean {
  if (!user) return false;
  if (!projectId || user.role !== 'مدیر پروژه') return true;
  return (user.projectIds || []).includes(projectId);
}

/**
 * Central permission check used by every approve / pay / post handler (through the workflow layer)
 * and by the UI to hide actions.
 *
 * Order matters:
 * 1. Separation of duties — nobody approves a record they created. This rule is checked first and
 *    cannot be overridden, not even by window.PaydarPortal.can.
 * 2. Project scope — a project manager acts only inside own projects.
 * 3. The WordPress runtime may decide the remaining cases (window.PaydarPortal.can).
 * 4. Otherwise the local role matrix, mirrored from the paydar-portal plugin.
 */
export function checkPermission(user: UserProfile | undefined | null, action: UserAction, context: ActionContext = {}): PermissionCheck {
  if (!user) return { ok: false, reason: 'کاربر وارد سامانه نشده است.' };

  if (APPROVAL_ACTIONS.has(action) && sameUser(user, context.createdBy)) {
    return { ok: false, reason: 'تأیید سندی که خودتان ایجاد کرده‌اید مجاز نیست (تفکیک وظایف).' };
  }

  if (!canAccessProject(user, context.projectId)) {
    return { ok: false, reason: 'این رکورد متعلق به پروژه‌ای است که مدیریت آن با شما نیست.' };
  }

  const portal = typeof window !== 'undefined' ? window.PaydarPortal : undefined;
  if (portal && typeof portal.can === 'function') {
    const allowed = Boolean(portal.can(action, user, context));
    return allowed ? { ok: true } : { ok: false, reason: 'سامانه وردپرس اجازه این عملیات را به شما نمی‌دهد.' };
  }

  const granted = ROLE_PERMISSIONS[user.role];
  if (granted === ALL || (granted && granted.has(action))) return { ok: true };
  return { ok: false, reason: `نقش «${user.role}» مجاز به این عملیات نیست.` };
}

export function can(user: UserProfile | undefined | null, action: UserAction, context?: ActionContext): boolean {
  return checkPermission(user, action, context).ok;
}
