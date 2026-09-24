import {
  formatInt,
  formatToman,
  formatRial,
  formatMoneyCompact,
  normalizeDigits,
} from './money';

export {
  formatInt,
  formatToman,
  formatRial,
  formatMoneyCompact,
  normalizeDigits,
};

/**
 * Format numbers with Persian digits and thousand separators
 */
export function formatNumber(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '۰';
  return formatInt(Math.floor(value));
}

/**
 * Format currency with Rial/Toman separators without duplicate units
 */
export function formatCurrency(value: number, unit: string = 'تومان'): string {
  if (value === undefined || value === null || isNaN(value)) return `۰ ${unit}`;
  if (unit === 'تومان') {
    return formatToman(value, true);
  }
  if (unit === 'ریال') {
    return formatRial(value, true);
  }
  return `${formatInt(Math.floor(value))} ${unit}`;
}

/**
 * Format standard Latin number with commas (for clean readability when requested)
 */
export function formatCurrencyEn(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return Math.floor(value).toLocaleString('en-US');
}

/**
 * Format currency with billion/million shorthand in Persian (e.g., ۱۸.۵ میلیارد تومان)
 * Accurately handles Hemmat (همت), Milliard, and Million.
 */
export function formatCurrencyCompact(value: number): string {
  return formatMoneyCompact(value, false);
}

/**
 * Format percentage with Persian digits
 */
export function formatPercent(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '۰٪';
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
