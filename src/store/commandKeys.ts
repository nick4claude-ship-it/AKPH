/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { generateUUID } from '../utils/ids';

/**
 * One Idempotency-Key per form submission (docs/API-CONTRACT.md), not one per call.
 *
 * A submission is identified by its action and its arguments (what the user typed or picked). Every send of
 * the same submission carries the same key, so the server runs it once and replays the first answer:
 * - pressing the button again while the first send is still on its way is not sent again;
 * - pressing it again right after success (a double click that arrived late) gets the stored answer;
 * - submitting again after the connection failed (no answer: the command may have run) reuses the key,
 *   so a command that did run is not run twice.
 * A definite refusal (validation error, conflict, forbidden) leaves no trace on the server; the key is
 * dropped and a corrected form is a new submission.
 */

export type CommandOutcome = 'ok' | 'rejected' | 'unknown';

export interface CommandKeyOptions {
  now?: () => number;
  newKey?: () => string;
  /** How long a successful submission keeps its key (late double clicks). */
  successGraceMs?: number;
  /** How long a submission without an answer keeps its key (the user retries by hand). */
  unknownKeepMs?: number;
}

interface Slot {
  key: string;
  inFlight: boolean;
  expires: number;
}

/** JSON with object keys sorted, so the same form always gives the same fingerprint. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') return stableStringify((value as { toJSON: () => unknown }).toJSON());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && typeof v !== 'function')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export function createCommandKeys(options: CommandKeyOptions = {}) {
  const now = options.now ?? Date.now;
  const newKey = options.newKey ?? generateUUID;
  const successGraceMs = options.successGraceMs ?? 15_000;
  const unknownKeepMs = options.unknownKeepMs ?? 10 * 60_000;
  const slots = new Map<string, Slot>();
  const byKey = new Map<string, string>();

  const drop = (fingerprint: string) => {
    const slot = slots.get(fingerprint);
    if (slot) byKey.delete(slot.key);
    slots.delete(fingerprint);
  };
  const sweep = () => {
    const t = now();
    for (const [fp, slot] of slots) if (!slot.inFlight && slot.expires <= t) drop(fp);
  };

  return {
    /**
     * Key for this submission. `inFlight` is true when the same submission is still waiting for its answer:
     * the caller does not send it a second time.
     */
    acquire(action: string, args: readonly unknown[]): { key: string; inFlight: boolean } {
      sweep();
      const fingerprint = `${action}:${stableStringify(args)}`;
      const slot = slots.get(fingerprint);
      if (slot) {
        const inFlight = slot.inFlight;
        slot.inFlight = true;
        return { key: slot.key, inFlight };
      }
      const key = newKey();
      slots.set(fingerprint, { key, inFlight: true, expires: Infinity });
      byKey.set(key, fingerprint);
      return { key, inFlight: false };
    },

    /** The answer of a send with `key`. */
    settle(key: string, outcome: CommandOutcome): void {
      const fingerprint = byKey.get(key);
      const slot = fingerprint ? slots.get(fingerprint) : undefined;
      if (!fingerprint || !slot) return;
      if (outcome === 'rejected') return drop(fingerprint);
      slot.inFlight = false;
      slot.expires = now() + (outcome === 'ok' ? successGraceMs : unknownKeepMs);
    },

    /** Submissions currently remembered (tests). */
    size(): number {
      sweep();
      return slots.size;
    },
  };
}

export type CommandKeys = ReturnType<typeof createCommandKeys>;

/** Keys of this browser tab. */
export const commandKeys: CommandKeys = createCommandKeys();
