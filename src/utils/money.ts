/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Money and numeric utilities adhering to Iranian banking and accounting rules:
 * - Internal canonical calculations are done in integer Rials or Tomans with integer precision (no floats).
 * - 1 Toman = 10 Rials.
 * - 1 Hemmat (همت) = 1,000 Billion Tomans = 10,000 Billion Rials (10^12 Tomans).
 * - Persian/Arabic digits conversion for all inputs.
 */

export type CurrencyUnit = 'toman' | 'rial';

export interface CurrencyConfig {
  displayUnit: CurrencyUnit;
}

export const globalCurrencyConfig: CurrencyConfig = {
  displayUnit: 'toman',
};

/**
 * Convert Persian and Arabic digits to standard Latin digits (0-9).
 */
export function normalizeDigits(value: string | number): string {
  if (value === null || value === undefined) return '';
  const str = value.toString();
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianDigits[i], 'g'), i.toString());
    result = result.replace(new RegExp(arabicDigits[i], 'g'), i.toString());
  }
  return result;
}

/**
 * Parse any numeric input string with Persian/Arabic/Latin digits and thousand separators
 * into a safe, positive integer.
 * Rejects negative numbers, decimals, or invalid formats by clamping to non-negative integer.
 */
export function parseIntegerAmount(input: string | number | undefined | null): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input) || input < 0) return 0;
    return Math.floor(input);
  }

  const normalized = normalizeDigits(input.trim());
  // Remove thousand separators, commas, spaces, currency symbols
  const digitsOnly = normalized.replace(/[^\d]/g, '');
  if (!digitsOnly) return 0;

  const parsed = parseInt(digitsOnly, 10);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

/**
 * Convert Rial to Toman (toman = Math.floor(rial / 10))
 */
export function rialToToman(rial: number): number {
  return Math.floor((rial || 0) / 10);
}

/**
 * Convert Toman to Rial (rial = toman * 10)
 */
export function tomanToRial(toman: number): number {
  return Math.round((toman || 0) * 10);
}

/**
 * Format raw integer into Persian localized number string with thousand separators.
 */
export function formatInt(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '۰';
  const cleanInt = Math.floor(Math.abs(value));
  const sign = value < 0 ? '-' : '';
  return `${sign}${cleanInt.toLocaleString('fa-IR')}`;
}

/**
 * Format Rial amount with optional Persian suffix
 */
export function formatRial(rial: number, withSuffix: boolean = true): string {
  const formatted = formatInt(rial);
  return withSuffix ? `${formatted} ریال` : formatted;
}

/**
 * Format Toman amount with optional Persian suffix.
 * Prevents double suffixing (never print 'تومان تومان').
 */
export function formatToman(toman: number, withSuffix: boolean = true): string {
  const formatted = formatInt(toman);
  return withSuffix ? `${formatted} تومان` : formatted;
}

/**
 * Standard money formatting based on current system displayUnit configuration.
 * Default is Toman.
 */
export function formatMoney(amount: number, isRialInput: boolean = false, withSuffix: boolean = true): string {
  const tomanValue = isRialInput ? rialToToman(amount) : Math.floor(amount || 0);

  if (globalCurrencyConfig.displayUnit === 'rial') {
    const rialValue = isRialInput ? Math.floor(amount || 0) : tomanToRial(tomanValue);
    return formatRial(rialValue, withSuffix);
  }

  return formatToman(tomanValue, withSuffix);
}

/**
 * Format money with shorthand Persian units (همت، میلیارد، میلیون).
 * 1 همت = ۱,۰۰۰ میلیارد تومان (10^12 تومان).
 * 1 میلیارد = ۱,۰۰۰ میلیون تومان (10^9 تومان).
 * 1 میلیون = ۱,۰۰۰,۰۰۰ تومان (10^6 تومان).
 */
export function formatMoneyCompact(amount: number, isRialInput: boolean = false): string {
  const toman = isRialInput ? rialToToman(amount) : Math.floor(amount || 0);
  const abs = Math.abs(toman);
  const sign = toman < 0 ? '-' : '';

  // 1 Trillion Tomans = 1 Hemmat (همت)
  if (abs >= 1_000_000_000_000) {
    const hemmatVal = (abs / 1_000_000_000_000).toLocaleString('fa-IR', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    return `${sign}${hemmatVal} همت`;
  }

  // 1 Billion Tomans (میلیارد تومان)
  if (abs >= 1_000_000_000) {
    const bilVal = (abs / 1_000_000_000).toLocaleString('fa-IR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    });
    return `${sign}${bilVal} میلیارد تومان`;
  }

  // 1 Million Tomans (میلیون تومان)
  if (abs >= 1_000_000) {
    const milVal = (abs / 1_000_000).toLocaleString('fa-IR', {
      maximumFractionDigits: 0,
    });
    return `${sign}${milVal} میلیون تومان`;
  }

  return `${sign}${formatInt(abs)} تومان`;
}
