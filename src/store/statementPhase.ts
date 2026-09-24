/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DetailedProgressStatement } from '../types';
import { CLIENT_APPROVED_STATUSES } from './initialState';
import { dayIndex, todayIndex } from './domainSelectors';

export type ClientStatementPhase = 'in_review' | 'approved' | 'overdue' | 'settled' | 'returned';

/** Collection phase of a client statement, derived from its workflow status and receipts. */
export function clientStatementPhase(s: DetailedProgressStatement): ClientStatementPhase {
  if (s.status === 'returned_for_correction' || s.status === 'rejected') return 'returned';
  if (!CLIENT_APPROVED_STATUSES.includes(s.status)) return 'in_review';
  if (s.status === 'paid' || s.remainingPayable <= 0) return 'settled';
  return dayIndex(s.dueDate) < todayIndex() ? 'overdue' : 'approved';
}

export const clientStatementReceivable = (s: DetailedProgressStatement) =>
  CLIENT_APPROVED_STATUSES.includes(s.status) ? Math.max(0, s.remainingPayable) : 0;
