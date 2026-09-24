/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserProfile } from '../types';

export type UserAction =
  | 'create_journal_entry'
  | 'approve_journal_entry'
  | 'reverse_journal_entry'
  | 'create_petty_cash_expense'
  | 'approve_petty_cash'
  | 'replenish_petty_cash'
  | 'approve_client_statement'
  | 'approve_subcontractor_statement'
  | 'create_payment_order'
  | 'execute_payment'
  | 'manage_procurement'
  | 'approve_requisition'
  | 'manage_inventory'
  | 'approve_store_issue'
  | 'perform_stocktake'
  | 'close_fiscal_period'
  | 'view_financial_reports';

export interface ActionContext {
  createdByUserId?: string;
  creatorName?: string;
  amount?: number;
  projectId?: string;
  status?: string;
}

/**
 * Centralized permission checker for the UI and event handlers.
 * Enforces rule: Users can never approve documents they created themselves (separation of duties).
 * In WordPress integration, window.PaydarPortal?.can may override.
 */
export function can(
  user: UserProfile | undefined | null,
  action: UserAction,
  context?: ActionContext
): boolean {
  if (!user) return false;

  // Check if WordPress runtime provides custom permissions function
  const wpPortal = (window as any).PaydarPortal;
  if (wpPortal && typeof wpPortal.can === 'function') {
    return Boolean(wpPortal.can(action, user, context));
  }

  // Separation of duties: Never allow approving a document created by oneself
  if (
    action.startsWith('approve_') &&
    context &&
    (
      (context.createdByUserId && context.createdByUserId === user.id) ||
      (context.creatorName && context.creatorName.trim() === user.name.trim())
    )
  ) {
    return false;
  }

  const role = (user.role || '').toLowerCase();

  // CEO / مدیرعامل has full access
  if (role.includes('مدیرعامل') || role.includes('ceo') || role.includes('admin')) {
    return true;
  }

  // Financial Director / CFO / مدیر مالی
  if (role.includes('مدیر مالی') || role.includes('cfo')) {
    if (action === 'perform_stocktake') return false;
    return true;
  }

  // Senior Accountant / حسابدار ارشد
  if (role.includes('حسابدار') || role.includes('accountant')) {
    const accountantDisallowed: UserAction[] = [
      'close_fiscal_period',
      'execute_payment',
      'approve_client_statement',
    ];
    return !accountantDisallowed.includes(action);
  }

  // Project Manager / مدیر پروژه
  if (role.includes('مدیر پروژه') || role.includes('project manager')) {
    const pmAllowed: UserAction[] = [
      'approve_requisition',
      'approve_store_issue',
      'approve_subcontractor_statement',
      'create_petty_cash_expense',
      'view_financial_reports',
    ];
    return pmAllowed.includes(action);
  }

  // Site Supervisor / سرپرست کارگاه
  if (role.includes('سرپرست کارگاه') || role.includes('supervisor')) {
    const siteAllowed: UserAction[] = [
      'create_petty_cash_expense',
      'approve_store_issue',
    ];
    return siteAllowed.includes(action);
  }

  // Default fallback for safe viewer access
  return false;
}
