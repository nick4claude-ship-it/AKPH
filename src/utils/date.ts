/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Persian (Jalali) date utilities adhering to standard ISO 8601 storage
 * and Intl.DateTimeFormat('fa-IR-u-ca-persian') display formatting.
 */

const persianDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const persianDateTimeFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const persianTimeFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const persianYearFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-u-nu-latn', {
  year: 'numeric',
});

/**
 * Parse any date representation safely into Date object
 */
export function safeParseDate(input?: string | number | Date | null): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Returns current ISO date string (UTC)
 */
export function getCurrentIsoDate(): string {
  return new Date().toISOString();
}

/**
 * Convert ISO / Date to formatted Persian date string (e.g., ۱۴۰۳/۰۷/۰۱)
 */
export function toPersianDate(input?: string | number | Date | null): string {
  if (!input) return '';
  // If it is already in Persian date format (like ۱۴۰۳/۰۶/۱۵ or 1403/06/15)
  if (typeof input === 'string' && input.includes('/')) {
    return input;
  }
  const date = safeParseDate(input);
  return persianDateFormatter.format(date);
}

/**
 * Convert ISO / Date to Persian date and time string
 */
export function toPersianDateTime(input?: string | number | Date | null): string {
  if (!input) return '';
  const date = safeParseDate(input);
  return persianDateTimeFormatter.format(date);
}

/**
 * Convert ISO / Date to Persian time string (HH:mm)
 */
export function toPersianTime(input?: string | number | Date | null): string {
  if (!input) return '';
  const date = safeParseDate(input);
  return persianTimeFormatter.format(date);
}

/**
 * Get current Jalali (Persian) year as Latin number (e.g. 1403, 1404)
 */
export function getCurrentPersianYear(): number {
  const yearStr = persianYearFormatter.format(new Date());
  const parsed = parseInt(yearStr, 10);
  return isNaN(parsed) ? 1403 : parsed;
}

/**
 * Format prefix with current fiscal year (e.g., prefix='ACC' -> 'ACC-1403')
 */
export function formatDocumentYearCode(prefix: string): string {
  return `${prefix}-${getCurrentPersianYear()}`;
}
