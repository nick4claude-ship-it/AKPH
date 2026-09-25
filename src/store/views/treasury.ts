/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** View models of treasury: KPIs, request actions, payment schedule and receipts figures. */

import type { PaymentRequest, UserProfile } from '../../types';
import type { AppState } from '../types';
import type { ScheduledPayment } from '../domainSelectors';
import { paymentApprovalContext, paymentExecutionContext } from '../approvalContext';
import { checkPermission } from '../../utils/permissions';
import { sumBy } from './common';

export function selectTreasuryKpis(state: AppState) {
  const requests = state.paymentRequests;
  return {
    totalPendingPayments: sumBy(requests.filter((p) => p.status !== 'پرداخت شده' && p.status !== 'رد شده'), (p) => p.remainingAmount),
    totalPaidThisMonth: sumBy(requests.filter((p) => p.status === 'پرداخت شده'), (p) => p.paidAmount),
    totalLiquidCash: sumBy(state.bankAccounts, (b) => b.balance) + sumBy(state.cashDesks, (c) => c.balance),
    upcomingChecksDue: sumBy(
      state.treasuryChecks.filter((c) => c.status === 'در جریان وصول/سررسید' && c.checkType === 'صادره (پرداختی)'),
      (c) => c.amount
    ),
  };
}

/** Buttons of a payment request for the signed-in user (approval and execution are separate duties). */
export function paymentRequestActions(user: UserProfile, req: PaymentRequest) {
  return {
    canApprove: req.status === 'در انتظار تأیید مالی' && checkPermission(user, 'payment_request.approve', paymentApprovalContext(req)).ok,
    canPay: (req.status === 'تأیید مدیر ارشد' || req.status === 'در صف پرداخت خزانه') && checkPermission(user, 'payment.execute', paymentExecutionContext(req)).ok,
  };
}

/** Payment of a request from a bank account («bank:id») or a cash desk («cash:id»). */
export interface PaymentFormInput {
  requestId: string;
  sourceId: string;
  /** Integer Rials. */
  amount: number;
  trackingNumber: string;
}

/** Manual request without a source document (general expenses, advances, taxes and insurance). */
export interface ManualPaymentRequestInput {
  sourceType: PaymentRequest['sourceType'];
  /** For «حق بیمه و مالیات»: which liability is paid. */
  liability: 'insurance' | 'vat' | 'payroll' | 'withholding';
  projectId: string;
  beneficiaryName: string;
  /** Integer Rials. */
  amount: number;
  dueDate: string;
}

/** Beneficiary type of a manual request, from what is being paid. */
export function manualBeneficiaryType(input: Pick<ManualPaymentRequestInput, 'sourceType' | 'liability'>): PaymentRequest['beneficiaryType'] {
  if (input.sourceType === 'حق بیمه و مالیات') return input.liability === 'insurance' ? 'سازمان تامین اجتماعی' : 'سازمان امور مالیاتی';
  if (input.sourceType === 'پیش‌پرداخت پیمانکار جزء') return 'پیمانکار جزء';
  return 'تأمین‌کننده';
}

/** Open commitments by due date against available cash (surplus or shortage). */
export function paymentScheduleFigures(schedule: { rows: ScheduledPayment[]; availableCash: number }) {
  const total = sumBy(schedule.rows, (r) => r.request.remainingAmount);
  const overdue = schedule.rows.filter((r) => r.overdue);
  const gap = total - schedule.availableCash;
  return {
    total,
    overdue,
    overdueAmount: sumBy(overdue, (r) => r.request.remainingAmount),
    /** True when open commitments exceed available cash. */
    shortage: gap > 0,
    /** Size of the shortage or surplus. */
    gapAmount: Math.abs(gap),
  };
}

/** Client statements that can still be collected, and the receipts figures. */
export function selectReceiptsFigures(state: AppState) {
  const collectible = state.clientStatements.filter((s) => ['approved_by_employer', 'claimed', 'partially_paid'].includes(s.status) && s.remainingPayable > 0);
  return {
    collectible,
    totalReceived: sumBy(state.receipts, (r) => r.amount),
    receivable: sumBy(collectible, (s) => s.remainingPayable),
    clients: state.counterparties.filter((c) => c.kind === 'client'),
  };
}
