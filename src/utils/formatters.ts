/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  formatInt,
  formatToman,
  formatRial,
  formatMoney,
  formatMoneyCompact,
  moneyUnitLabel,
  normalizeDigits,
} from './money';

export { formatInt, formatToman, formatRial, formatMoney, formatMoneyCompact, moneyUnitLabel, normalizeDigits };

/**
 * Format quantities and counts (not money) with Persian digits and thousand separators.
 */
export function formatNumber(value: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '۰';
  return formatInt(Math.floor(value));
}

/**
 * Format a stored Rial amount in the display currency, with its unit
 * (the unit is part of the result — never append «تومان» after it).
 */
export function formatCurrency(rial: number): string {
  return formatMoney(rial, true);
}

/**
 * Stored Rial amount in the display currency with magnitude words (e.g., ۱۸٫۵ میلیارد تومان).
 */
export function formatCurrencyCompact(rial: number): string {
  return formatMoneyCompact(rial, true);
}

/**
 * Percentage with Persian digits and the ٪ sign, rounded to `digits` decimals (default 1).
 */
export function formatPercent(value: number, digits = 1): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '۰٪';
  const num = Number(value.toFixed(digits)).toLocaleString('fa-IR');
  return `${num}٪`;
}

/**
 * Convert English digits to Persian digits
 */
export function toPersianDigits(num: string | number): string {
  if (num === null || num === undefined) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num
    .toString()
    .replace(/[0-9]/g, (w) => persianDigits[+w]);
}

/** CSS width of a progress bar: the percentage clamped to 0–100 (e.g. style={{ width: barWidth(p) }}). */
export function barWidth(percent: number): string {
  const p = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return `${p}%`;
}

/**
 * Any number (counts, quantities, indices, percentages without the sign) with Persian digits and
 * separators, keeping up to `maxFractionDigits` decimals. Empty for a missing value.
 */
export function formatDecimal(value: number | null | undefined, maxFractionDigits = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return value.toLocaleString('fa-IR', { maximumFractionDigits: maxFractionDigits });
}
