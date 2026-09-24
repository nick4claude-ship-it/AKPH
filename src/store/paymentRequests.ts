/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaymentRequest } from '../types';
import { generateUUID, nextDocNumber } from '../utils/ids';

/**
 * Maps a treasury payment request to the payable account role it settles (see PAYABLE_ACCOUNTS).
 * An unknown source type is an error: it is never booked to a general expense account by default.
 */
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
    case 'پیش‌پرداخت پیمانکار جزء':
      return 'subcontractor_advance';
    case 'پیش‌پرداخت خرید':
      return req.beneficiaryType === 'پیمانکار جزء' ? 'subcontractor_advance' : 'advance';
    case 'حق بیمه و مالیات':
      if (req.beneficiaryType !== 'سازمان امور مالیاتی') return 'insurance';
      if (!req.taxKind) throw new Error(`نوع مالیات درخواست ${req.requestNumber} (ارزش افزوده، حقوق یا تکلیفی پیمانکاران) مشخص نیست.`);
      return `tax_${req.taxKind}`;
    case 'سایر هزینه‌های عمومی':
      return 'general_expense';
    default:
      throw new Error(`نوع درخواست پرداخت «${String(req.sourceType)}» حساب تعریف‌شده ندارد.`);
  }
}

export type NewPaymentRequestInput = Pick<
  PaymentRequest,
  'sourceType' | 'sourceRefId' | 'sourceRefNumber' | 'projectId' | 'projectName' | 'costCenterId' | 'beneficiaryName' | 'beneficiaryType' | 'totalAmount'
> &
  Partial<Pick<PaymentRequest, 'counterpartyId' | 'dueDate' | 'date' | 'priority' | 'notes' | 'beneficiaryAccount' | 'taxKind'>>;

/** Builds a new payment request for the treasury queue; payment itself happens only in treasury. */
export function buildPaymentRequest(existing: PaymentRequest[], input: NewPaymentRequestInput, today: string): PaymentRequest {
  return {
    ...input,
    id: generateUUID(),
    requestNumber: nextDocNumber(existing.map((r) => r.requestNumber), 'PAY', input.date || today),
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
