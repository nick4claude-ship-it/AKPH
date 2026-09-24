/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaymentRequest } from '../types';
import { generateUUID, nextDocNumber } from '../utils/ids';

/** Maps a treasury payment request to the payable account role it settles (see PAYABLE_ACCOUNTS). */
export function payableTypeForRequest(req: PaymentRequest): string {
  switch (req.sourceType) {
    case 'صورت‌وضعیت پیمانکار جزء':
      return 'subcontractor';
    case 'فاکتور خرید تأمین‌کننده':
      return 'supplier';
    case 'شارژ و تسویه تنخواه':
      return 'petty_cash';
    case 'حقوق و دستمزد ماهانه':
      return 'payroll';
    case 'پیش‌پرداخت خرید':
      return 'advance';
    case 'حق بیمه و مالیات':
      return req.beneficiaryType === 'سازمان امور مالیاتی' ? 'tax' : 'insurance';
    default:
      return 'general_expense';
  }
}

export type NewPaymentRequestInput = Pick<
  PaymentRequest,
  'sourceType' | 'sourceRefId' | 'sourceRefNumber' | 'projectId' | 'projectName' | 'costCenterId' | 'beneficiaryName' | 'beneficiaryType' | 'totalAmount'
> &
  Partial<Pick<PaymentRequest, 'counterpartyId' | 'dueDate' | 'date' | 'priority' | 'notes' | 'beneficiaryAccount'>>;

/** Builds a new payment request for the treasury queue; payment itself happens only in treasury. */
export function buildPaymentRequest(existing: PaymentRequest[], input: NewPaymentRequestInput, today: string): PaymentRequest {
  return {
    ...input,
    id: generateUUID(),
    requestNumber: nextDocNumber(existing.map((r) => r.requestNumber), 'PR', input.date || today),
    date: input.date || today,
    dueDate: input.dueDate || today,
    beneficiaryAccount: input.beneficiaryAccount || { bankName: '-', shebaNumber: '-', accountNumber: '-' },
    approvedAmount: input.totalAmount,
    paidAmount: 0,
    remainingAmount: input.totalAmount,
    priority: input.priority || 'عادی',
    status: 'در انتظار تأیید مالی',
  };
}
