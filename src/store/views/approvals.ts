/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** View model of the central approval inbox: totals and per-module groups. */

import type { ApprovalItem, ApprovalModule } from '../../types';
import { sumBy } from './common';

export function approvalSummary(approvals: readonly ApprovalItem[]) {
  const groups = new Map<ApprovalModule, { label: string; count: number; amount: number }>();
  for (const a of approvals) {
    const g = groups.get(a.module) || { label: a.moduleLabel, count: 0, amount: 0 };
    g.count++;
    g.amount += a.amount;
    groups.set(a.module, g);
  }
  return { totalAmount: sumBy(approvals, (a) => a.amount), groups: [...groups.entries()] };
}
