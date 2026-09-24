/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StatementWorkflowStatus, SubcontractorStatementWorkflowStatus } from '../../types';

export const CLIENT_STATUS_LABELS: Record<StatementWorkflowStatus, string> = {
  draft: 'پیش‌نویس کارکرد',
  prepared: 'اندازه‌گیری شد',
  internal_review: 'بررسی دفتر فنی',
  submitted_to_consultant: 'ارسال به مشاور',
  under_consultant_review: 'در بررسی مشاور',
  approved_by_consultant: 'تأیید مشاور',
  submitted_to_employer: 'ارسال به کارفرما',
  approved_by_employer: 'تأیید کارفرما — مطالبه',
  claimed: 'مطالبه ثبت‌شده',
  partially_paid: 'وصول جزئی',
  paid: 'وصول کامل',
  rejected: 'رد شده',
  returned_for_correction: 'برگشت جهت اصلاح',
};

export const SUB_STATUS_LABELS: Record<SubcontractorStatementWorkflowStatus, string> = {
  submitted: 'ثبت کارکرد',
  measured: 'اندازه‌گیری شد',
  site_review: 'تأیید کارگاه',
  pm_approved: 'تأیید مدیر پروژه',
  finance_approved: 'تأیید مالی',
  management_approved: 'تأیید مدیر ارشد — بدهی',
  paid: 'پرداخت‌شده',
  rejected: 'رد شده',
  returned_for_revision: 'برگشت جهت اصلاح',
};

/** Workflow steps as defined by the architecture document. */
export const CLIENT_FLOW_STEPS = ['اندازه‌گیری', 'صورت‌وضعیت', 'تأیید مشاور', 'تأیید کارفرما', 'مطالبات', 'دریافت'];
export const SUB_FLOW_STEPS = ['کارکرد', 'اندازه‌گیری', 'تأیید کارگاه', 'تأیید مدیر پروژه', 'تأیید مالی', 'تأیید مدیر ارشد', 'بدهی', 'پرداخت'];

export function clientFlowIndex(status: StatementWorkflowStatus, remaining: number): number {
  switch (status) {
    case 'draft':
    case 'returned_for_correction':
      return 0;
    case 'prepared':
    case 'internal_review':
      return 1;
    case 'submitted_to_consultant':
    case 'under_consultant_review':
      return 2;
    case 'approved_by_consultant':
    case 'submitted_to_employer':
      return 3;
    case 'approved_by_employer':
    case 'claimed':
      return 4;
    case 'partially_paid':
      return 5;
    case 'paid':
      return remaining > 0 ? 5 : 6;
    default:
      return 0;
  }
}

export function subFlowIndex(status: SubcontractorStatementWorkflowStatus, remaining: number): number {
  const order: SubcontractorStatementWorkflowStatus[] = ['submitted', 'measured', 'site_review', 'pm_approved', 'finance_approved', 'management_approved'];
  if (status === 'paid') return remaining > 0 ? 7 : 8;
  if (status === 'management_approved') return 7;
  const i = order.indexOf(status);
  return i < 0 ? 0 : i + 1;
}
