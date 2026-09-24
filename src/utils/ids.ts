/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getCurrentFiscalYear } from './date';
import { normalizeDigits } from './money';

/**
 * Generate a cryptographically secure UUID for all internal entity IDs.
 * Never uses Math.random() or Date.now().
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Entity id with a readable prefix, e.g. `po-3f2a…`. */
export function newId(prefix: string): string {
  return `${prefix}-${generateUUID()}`;
}

/** Every document number has the same width: PREFIX-YYYY-NNNNN. */
export const DOC_SEQUENCE_DIGITS = 5;

/**
 * Fiscal (Persian) year of a document date such as «۱۴۰۵/۰۷/۰۲» or «1405/07/02».
 * Falls back to the current fiscal year when the date is missing or not Persian.
 */
export function fiscalYearOf(date?: string | null): number {
  const m = normalizeDigits(date || '').match(/^(1[34]\d{2})[/-]/);
  return m ? parseInt(m[1], 10) : getCurrentFiscalYear();
}

/**
 * Next sequential document number for a prefix within one fiscal year:
 * `ACC-1405-00001`, `ACC-1405-00002`, … The counter restarts at 1 in every fiscal year —
 * numbers from other years (or other prefixes) never affect it.
 */
export function getNextSequentialDocNumber(existingCodes: readonly (string | undefined | null)[], prefix: string, year?: number): string {
  const fiscalYear = year || getCurrentFiscalYear();
  const yearPrefix = `${prefix}-${fiscalYear}-`;
  let maxSeq = 0;
  for (const raw of existingCodes) {
    const code = normalizeDigits(raw || '');
    if (!code.startsWith(yearPrefix)) continue;
    const seq = code.slice(yearPrefix.length);
    if (!/^\d+$/.test(seq)) continue;
    maxSeq = Math.max(maxSeq, parseInt(seq, 10));
  }
  return `${yearPrefix}${String(maxSeq + 1).padStart(DOC_SEQUENCE_DIGITS, '0')}`;
}

/** Next number for a document dated `date` (its fiscal year decides the series). */
export function nextDocNumber(existingCodes: readonly (string | undefined | null)[], prefix: string, date?: string | null): string {
  return getNextSequentialDocNumber(existingCodes, prefix, fiscalYearOf(date));
}
