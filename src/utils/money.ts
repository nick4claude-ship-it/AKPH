/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Money rules (aligned with the paydar-portal ledger):
 * - Every stored amount is an integer number of Rials. No floats, no Tomans in state.
 * - The display currency (ریال or تومان) is chosen once, at bootstrap, by the data source
 *   (WordPress: PaydarPortal.accounting.currency). The UI never offers a switch.
 * - Amounts are shown only through formatRial / formatToman (via formatMoney).
 * - Typed amounts are read with parseIntegerAmount (Persian/Arabic digits, positive integers)
 *   in the display currency and converted to Rials with parseMoneyInput.
 */

export type CurrencyUnit = 'toman' | 'rial';

let displayUnit: CurrencyUnit = 'toman';
let displayUnitLocked = false;

/** Called once by the data source during bootstrap. Later calls are ignored. */
export function initCurrencyUnit(unit: CurrencyUnit): void {
  if (displayUnitLocked) return;
  displayUnit = unit === 'rial' ? 'rial' : 'toman';
  displayUnitLocked = true;
}

export function getCurrencyUnit(): CurrencyUnit {
  return displayUnit;
}

/** «تومان» or «ریال» — for column headers and input suffixes. */
export function moneyUnitLabel(): string {
  return displayUnit === 'rial' ? 'ریال' : 'تومان';
}

/**
 * Convert Persian and Arabic digits to standard Latin digits (0-9).
 */
export function normalizeDigits(value: string | number): string {
  if (value === null || value === undefined) return '';
  return value
    .toString()
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * Parse any numeric input (Persian/Arabic/Latin digits, thousand separators) into a
 * non-negative integer. Anything that is not a digit is ignored; empty input gives 0.
 */
export function parseIntegerAmount(input: string | number | undefined | null): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return 0;
    return Math.floor(input);
  }
  const digitsOnly = normalizeDigits(input.trim()).replace(/[^\d]/g, '');
  if (!digitsOnly) return 0;
  const parsed = parseInt(digitsOnly, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/** Rial → Toman (integer, truncated). */
export function rialToToman(rial: number): number {
  return Math.trunc((rial || 0) / 10);
}

/** Toman → Rial. */
export function tomanToRial(toman: number): number {
  return Math.round((toman || 0) * 10);
}

/** Stored Rial amount → number in the display currency (for charts and pre-filled inputs). */
export function toDisplayAmount(rial: number): number {
  return displayUnit === 'rial' ? Math.round(rial || 0) : rialToToman(rial);
}

/** Number typed in the display currency → stored Rial amount. */
export function fromDisplayAmount(amount: number): number {
  return displayUnit === 'rial' ? Math.round(amount || 0) : tomanToRial(amount);
}

/** Text typed in a money field (display currency) → integer Rials. */
export function parseMoneyInput(input: string | number | undefined | null): number {
  return fromDisplayAmount(parseIntegerAmount(input));
}

/** Round any computed amount (percentages, VAT) to whole Rials. */
export function roundRial(value: number): number {
  return Math.round(value || 0);
}

/**
 * Format raw integer into Persian localized number string with thousand separators.
 */
export function formatInt(value: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '۰';
  const cleanInt = Math.floor(Math.abs(value));
  const sign = value < 0 ? '-' : '';
  return `${sign}${cleanInt.toLocaleString('fa-IR')}`;
}

/** Format a Rial amount. */
export function formatRial(rial: number, withSuffix: boolean = true): string {
  const formatted = formatInt(Math.round(rial || 0));
  return withSuffix ? `${formatted} ریال` : formatted;
}

/** Format a Toman amount (the caller converts from Rials). */
export function formatToman(toman: number, withSuffix: boolean = true): string {
  const formatted = formatInt(Math.trunc(toman || 0));
  return withSuffix ? `${formatted} تومان` : formatted;
}

/** Format a stored Rial amount in the display currency. */
export function formatMoney(rial: number, withSuffix: boolean = true): string {
  return displayUnit === 'rial' ? formatRial(rial, withSuffix) : formatToman(rialToToman(rial), withSuffix);
}

/**
 * Stored Rial amount with Persian magnitude words in the display currency
 * (میلیارد = 10^9, میلیون = 10^6 of the display unit; همت = 10^12 Tomans).
 */
export function formatMoneyCompact(rial: number, withSuffix: boolean = true): string {
  const amount = toDisplayAmount(rial);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const unit = withSuffix ? ` ${moneyUnitLabel()}` : '';
  const scaled = (div: number, digits: number) =>
    (abs / div).toLocaleString('fa-IR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

  if (abs >= 1_000_000_000_000) {
    // «همت» is defined as 10^12 Tomans; in Rial display the magnitude is spelled out instead.
    return displayUnit === 'toman'
      ? `${sign}${scaled(1_000_000_000_000, 2)} همت`
      : `${sign}${scaled(1_000_000_000_000, 2)} هزار میلیارد${unit}`;
  }
  if (abs >= 1_000_000_000) return `${sign}${scaled(1_000_000_000, 1)} میلیارد${unit}`;
  if (abs >= 1_000_000) return `${sign}${scaled(1_000_000, 0)} میلیون${unit}`;
  return `${sign}${formatInt(abs)}${unit}`;
}
