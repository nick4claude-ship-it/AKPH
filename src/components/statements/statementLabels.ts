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
