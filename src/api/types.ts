/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JournalEntry, UserProfile } from '../types';
import type { AppState, SliceKey } from '../store/types';
import type { CurrencyUnit } from '../utils/money';

/** Who is signed in and the ledger conventions of this installation. */
export interface PortalSession {
  user: UserProfile;
  /** Display currency, chosen once in the paydar-portal plugin. Stored amounts are always Rials. */
  currency: CurrencyUnit;
  fiscalYear: number;
}

/** Records changed in one slice since the last save. */
export type StoreChange =
  | { slice: SliceKey; upserted: Record<string, unknown>[]; removedIds: string[] }
  | { slice: SliceKey; replaceWith: unknown };

/**
 * The only way the app reads or writes data. Modules never import seed data; they read the store,
 * which is loaded from and saved to a DataSource.
 */
export interface DataSource {
  readonly kind: 'mock' | 'wordpress';
  /** Shown in the footer so nobody mistakes demo data for real books. */
  readonly label: string;
  /** `userId` is honoured only by the mock source (DEV role switcher). */
  loadSession(userId?: string): Promise<PortalSession>;
  /** Everything the session's user may see (project managers: own projects only). */
  loadState(session: PortalSession): Promise<AppState>;
  /** Saves operational records. Journal entries never go through here. */
  saveChanges(changes: StoreChange[]): Promise<void>;
  /**
   * Ledger writes. A final entry is never edited or deleted; corrections are new reversal entries.
   * `previous` is set only when a pending (unapproved) entry changes status.
   */
  saveJournalEntry(entry: JournalEntry, previous?: JournalEntry): Promise<void>;
  /** DEV only: users the role switcher can sign in as. */
  devUsers?(): UserProfile[];
}

/** Journal entry statuses that are final in the ledger. */
export const FINAL_JOURNAL_STATUSES: ReadonlySet<JournalEntry['status']> = new Set<JournalEntry['status']>([
  'ثبت قطعی',
  'تأیید شده',
  'برگشت خورده',
]);

export function isFinalJournalEntry(entry: Pick<JournalEntry, 'status'>): boolean {
  return FINAL_JOURNAL_STATUSES.has(entry.status);
}
