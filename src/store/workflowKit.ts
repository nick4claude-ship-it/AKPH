/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserProfile } from '../types';
import type { AppState, FinancialEventInput, PostingResult, SliceKey, SliceUpdater } from './types';
import { checkPermission, type ActionContext, type UserAction } from '../utils/permissions';
import { toPersianDate, toPersianTime } from '../utils/date';

/** What every workflow receives: the store, the posting engine and the signed-in user. */
export interface WorkflowEnv {
  getState: () => AppState;
  set: <K extends SliceKey>(key: K, updater: SliceUpdater<K>) => void;
  /** Posts a financial event as env.user (the engine checks that user's permission). */
  post: (input: FinancialEventInput, options?: { submitter?: string }) => PostingResult;
  user: UserProfile;
}

export interface WorkflowResult {
  ok: boolean;
  message: string;
  docNumber?: string;
  id?: string;
}

export const ok = (message: string, extra: Partial<WorkflowResult> = {}): WorkflowResult => ({ ok: true, message, ...extra });
export const fail = (message: string): WorkflowResult => ({ ok: false, message });
export const today = () => toPersianDate(new Date());
export const now = () => toPersianTime(new Date());

/** Every state-changing workflow starts here: can(user, action) with separation of duties. */
export function guard(env: WorkflowEnv, action: UserAction, context?: ActionContext): WorkflowResult | null {
  const check = checkPermission(env.user, action, context);
  return check.ok ? null : fail(check.reason || 'اجازه این عملیات را ندارید.');
}

/** One row of a record's workflow history, signed by env.user. */
export function historyEntry<S extends string>(env: WorkflowEnv, from: S, to: S, action: string, comment?: string, stepAction?: UserAction) {
  return { date: today(), time: now(), user: env.user.name, userId: env.user.id, stepAction, role: env.user.role, fromStatus: from, toStatus: to, action, comment };
}
