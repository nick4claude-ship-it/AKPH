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

/**
 * A stored Rial amount split for display: the number (Persian digits and separators, shown with dir="ltr"
 * so the sign stays on its side), an optional magnitude word (compact form: میلیون، میلیارد، همت) and the
 * display unit (تومان/ریال, omitted after «همت»). Same values as formatMoney / formatMoneyCompact.
 */
export function moneyParts(rial: number, compact = false): { number: string; magnitude: string; unit: string } {
  const unit = moneyUnitLabel();
  if (!compact) return { number: formatMoney(rial, false), magnitude: '', unit };
  const text = formatMoneyCompact(rial, false);
  const m = /^(-?[۰-۹٬٫]+)(?:\s+(.+))?$/.exec(text);
  if (!m) return { number: text, magnitude: '', unit };
  const magnitude = m[2] || '';
  return { number: m[1], magnitude, unit: magnitude === 'همت' ? '' : unit };
}

/** Codes and document numbers (PRJ-101, ACC-1405-00001) for display: the same text with Persian digits. */
export function formatCode(code: string | number | null | undefined): string {
  return code === null || code === undefined ? '' : toPersianDigits(code);
}

/** Free text from records (names, descriptions) for display, digits in Persian. */
export function formatText(text: string | number | null | undefined): string {
  return text === null || text === undefined ? '' : toPersianDigits(text);
}

/** File size for display (کیلوبایت / مگابایت) from a size in bytes. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '۰ کیلوبایت';
  if (bytes >= 1024 * 1024) return `${formatDecimal(bytes / (1024 * 1024), 1)} مگابایت`;
  return `${formatDecimal(Math.max(1, Math.round(bytes / 1024)), 0)} کیلوبایت`;
}
