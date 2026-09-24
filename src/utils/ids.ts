/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getCurrentFiscalYear, parseJalaliDate } from './date';
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

/** A document date that is not a valid Jalali date (never silently read as "this year"). */
export class InvalidDocumentDateError extends Error {
  readonly farsiMessage: string;
  constructor(date: unknown) {
    super(`Invalid Jalali document date: ${String(date)}`);
    this.name = 'InvalidDocumentDateError';
    this.farsiMessage = `تاریخ «${String(date ?? '')}» تاریخ شمسی معتبر (سال/ماه/روز) نیست.`;
  }
}

/** Fiscal (Persian) year of a document date such as «۱۴۰۵/۰۷/۰۲». Throws for anything else. */
export function fiscalYearOf(date: string | null | undefined): number {
  const parsed = parseJalaliDate(date);
  if (!parsed) throw new InvalidDocumentDateError(date);
  return parsed.y;
}

/** fiscalYearOf for lists and filters: null instead of an error. */
export function tryFiscalYearOf(date: string | null | undefined): number | null {
  return parseJalaliDate(date)?.y ?? null;
}

/**
 * Numbers already used by records the current user cannot see (e.g. headquarters documents hidden from a
 * project manager). The data source registers them at load and after each save, so a number issued from
 * a scoped view never collides with one issued elsewhere. Key: `PREFIX-YEAR`, value: highest sequence.
 */
const usedSequences = new Map<string, number>();

const SERIES = /^([A-Z]{2,4})-(1[2-5]\d{2})-(\d{1,7})$/;

export function registerDocNumbers(codes: Iterable<string | undefined | null>): void {
  for (const raw of codes) {
    const m = normalizeDigits(raw || '').match(SERIES);
    if (!m) continue;
    const key = `${m[1]}-${m[2]}`;
    usedSequences.set(key, Math.max(usedSequences.get(key) || 0, parseInt(m[3], 10)));
  }
}

/** Test helper: forget registered numbers. */
export function resetRegisteredDocNumbers(): void {
  usedSequences.clear();
}

/**
 * Next sequential document number for a prefix within one fiscal year:
 * `ACC-1405-00001`, `ACC-1405-00002`, … The counter restarts at 1 in every fiscal year —
 * numbers from other years (or other prefixes) never affect it.
 */
export function getNextSequentialDocNumber(existingCodes: readonly (string | undefined | null)[], prefix: string, year?: number): string {
  const fiscalYear = year || getCurrentFiscalYear();
  const yearPrefix = `${prefix}-${fiscalYear}-`;
  let maxSeq = usedSequences.get(`${prefix}-${fiscalYear}`) || 0;
  for (const raw of existingCodes) {
    const code = normalizeDigits(raw || '');
    if (!code.startsWith(yearPrefix)) continue;
    const seq = code.slice(yearPrefix.length);
    if (!/^\d+$/.test(seq)) continue;
    maxSeq = Math.max(maxSeq, parseInt(seq, 10));
  }
  return `${yearPrefix}${String(maxSeq + 1).padStart(DOC_SEQUENCE_DIGITS, '0')}`;
}

/**
 * Next number for a document dated `date` (its fiscal year decides the series; an invalid date throws).
 * Without a date the current fiscal year is used.
 */
export function nextDocNumber(existingCodes: readonly (string | undefined | null)[], prefix: string, date?: string | null): string {
  return getNextSequentialDocNumber(existingCodes, prefix, date === undefined || date === null || date === '' ? getCurrentFiscalYear() : fiscalYearOf(date));
}
