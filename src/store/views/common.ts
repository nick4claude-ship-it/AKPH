/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Shared arithmetic for view models. The UI never sums or divides amounts itself. */

/** part / whole as a percentage; 0 when the whole is 0 or missing. */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? ((part || 0) / whole) * 100 : 0;
}

/** Sum of one numeric field over a list. */
export function sumBy<T>(rows: readonly T[], pick: (row: T) => number): number {
  let total = 0;
  for (const r of rows) total += pick(r) || 0;
  return total;
}

/** Sums several numeric fields at once: sumFields(rows, ['grossAmount', 'netPayable']). */
export function sumFields<T, K extends keyof T>(rows: readonly T[], keys: readonly K[]): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = sumBy(rows, (r) => Number(r[k]) || 0);
  return out;
}

/** Distinct values of one field, in first-seen order (filter dropdowns). */
export function distinct<T, V>(rows: readonly T[], pick: (row: T) => V): V[] {
  return Array.from(new Set(rows.map(pick)));
}

/** Rows grouped by a key, in first-seen order. */
export function groupBy<T>(rows: readonly T[], key: (row: T) => string): { key: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return Array.from(map, ([k, list]) => ({ key: k, rows: list }));
}

/** Case-insensitive "contains" over several text fields (search boxes). */
export function matchesText(query: string, ...fields: (string | undefined | null)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f || '').toLowerCase().includes(q));
}

/** Largest value of a list, at least `floor` (chart scales). */
export function maxOf(values: readonly number[], floor = 1): number {
  let m = floor;
  for (const v of values) if (v > m) m = v;
  return m;
}
