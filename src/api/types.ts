/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CompanyProfile, JournalEntry, UserProfile } from '../types';
import type { AppState, SliceKey } from '../store/types';
import type { CurrencyUnit } from '../utils/money';

/** Who is signed in and the ledger conventions of this installation. */
export interface PortalSession {
  user: UserProfile;
  /** Display currency, chosen once in the paydar-portal plugin. Amounts are always integer Rials, in the store and on the wire. */
  currency: CurrencyUnit;
  fiscalYear: number;
  /** The company this installation belongs to (WordPress: the site name). */
  company: CompanyProfile;
}

/** Records changed in one slice since the last save (demo data source only). */
export type StoreChange =
  | { slice: SliceKey; upserted: Record<string, unknown>[]; removedIds: string[] }
  | { slice: SliceKey; replaceWith: unknown };

/** Records the server returns after a command; they replace the local copies by id. */
export interface CommandResult {
  message: string;
  records: { slice: SliceKey; upserted: Record<string, unknown>[] }[];
  id?: string;
  docNumber?: string;
}

/**
 * Server commands. The client sends only what the user entered and which action to take; the server
 * runs the workflow, posting rules, segregation of duties, amounts and numbering (docs/API-CONTRACT.md).
 * Keys are the names of the reference workflows in src/store/workflows.ts that each command replaces.
 */
export interface CommandGateway {
  /** Workflow actions the installed server can execute. Everything else is read-only in the UI. */
  supports(action: string): boolean;
  run(action: string, args: unknown[], state: AppState): Promise<CommandResult>;
}

/**
 * The only way the app reads or writes data. Modules never import seed data; they read the store,
 * which is loaded from a DataSource.
 *
 * - mock: the demo computes everything in the browser (reference rules in src/store) and keeps the
 *   result in memory through `saveChanges`.
 * - wordpress: the browser never sends computed records, balances, statuses or final entries. It sends
 *   commands through `commands`; the server's answer is merged into the store.
 */
export interface DataSource {
  readonly kind: 'mock' | 'wordpress';
  /** Shown in the footer so nobody mistakes demo data for real books. */
  readonly label: string;
  /** `userId` is honoured only by the mock source (DEV role switcher). */
  loadSession(userId?: string): Promise<PortalSession>;
  /** Everything the session's user may see (project managers: own projects only). */
  loadState(session: PortalSession): Promise<AppState>;
  /** Demo only: keeps locally computed changes. Absent for the WordPress source. */
  saveChanges?(changes: StoreChange[]): Promise<void>;
  /** WordPress only: server-side commands. */
  commands?: CommandGateway;
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
