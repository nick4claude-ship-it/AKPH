/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StoreChange } from '../api/types';
import { isFinalJournalEntry } from '../api/types';
import type { JournalEntry } from '../types';
import type { AppState, SliceKey } from './types';

type Row = Record<string, unknown> & { id?: string };

/**
 * Differences between two committed states (demo data source only). A change to a final journal entry is
 * never saved: final entries are immutable and corrected only by a reversal entry.
 */
export function diffStates(prev: AppState, next: AppState): StoreChange[] {
  const changes: StoreChange[] = [];
  for (const key of Object.keys(next) as SliceKey[]) {
    const a = prev[key] as unknown;
    const b = next[key] as unknown;
    if (a === b) continue;
    if (!Array.isArray(b) || !(b as Row[]).every((r) => r && typeof r === 'object' && typeof r.id === 'string')) {
      changes.push({ slice: key, replaceWith: b });
      continue;
    }
    const before = new Map(((a as Row[]) || []).map((r) => [r.id as string, r]));
    let upserted = (b as Row[]).filter((r) => before.get(r.id as string) !== r);
    if (key === 'journalEntries') {
      upserted = upserted.filter((r) => {
        const old = before.get(r.id as string) as JournalEntry | undefined;
        if (old && isFinalJournalEntry(old)) {
          console.error(`[Ledger] سند قطعی ${old.docNumber} قابل ویرایش نیست؛ اصلاح فقط با سند معکوس ممکن است.`);
          return false;
        }
        return true;
      });
    }
    const nextIds = new Set((b as Row[]).map((r) => r.id as string));
    const removedIds = [...before.keys()].filter((id) => !nextIds.has(id));
    if (upserted.length || removedIds.length) changes.push({ slice: key, upserted, removedIds });
  }
  return changes;
}

export interface SaveQueueDeps {
  save(changes: StoreChange[]): Promise<void>;
  /** Last state the data source confirmed. */
  getSaved(): AppState;
  setSaved(state: AppState): void;
  /** Latest committed state in the browser. */
  getLatest(): AppState;
  /** Called when a save still fails after the retries: the store goes back to the last saved state. */
  rollback(to: AppState, error: unknown): void;
  retries?: number;
  wait?(ms: number): Promise<void>;
}

/**
 * Saves run one after another, never in parallel. The "saved" state moves forward only after the data
 * source confirmed a save; a failed save is retried with back-off and, if it still fails, the unsaved
 * changes are rolled back so the screen never shows data the server does not have.
 */
export class SaveQueue {
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly deps: SaveQueueDeps) {}

  flush(): Promise<void> {
    this.chain = this.chain.then(() => this.run());
    return this.chain;
  }

  private async run(): Promise<void> {
    const { save, getSaved, setSaved, getLatest, rollback } = this.deps;
    const retries = this.deps.retries ?? 2;
    const wait = this.deps.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const base = getSaved();
    const target = getLatest();
    const changes = diffStates(base, target);
    if (!changes.length) {
      setSaved(target);
      return;
    }
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await save(changes);
        setSaved(target);
        return;
      } catch (err) {
        lastError = err;
        if (attempt < retries) await wait(400 * 2 ** attempt);
      }
    }
    rollback(base, lastError);
  }
}
