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
 * Format percentage with Persian digits
 */
export function formatPercent(value: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '۰٪';
  const num = Number(value.toFixed(1)).toLocaleString('fa-IR');
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
