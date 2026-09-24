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

const persianFullDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const persianMonthFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  month: 'long',
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

const persianYearFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
  year: 'numeric',
});

/**
 * Parse any date representation safely into Date object.
 * Returns null if input is invalid or missing (does NOT default to today).
 */
export function safeParseDate(input?: string | number | Date | null): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
    return null;
  }
  return null;
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
  if (input === null || input === undefined || input === '') return '';
  // If it is already in Persian date format (like ۱۴۰۳/۰۶/۱۵ or 1403/06/15)
  if (typeof input === 'string' && input.includes('/')) {
    return input;
  }
  const date = safeParseDate(input);
  if (!date) return '';
  try {
    return persianDateFormatter.format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Convert ISO / Date to Persian date and time string
 */
export function toPersianDateTime(input?: string | number | Date | null): string {
  if (input === null || input === undefined || input === '') return '';
  const date = safeParseDate(input);
  if (!date) return '';
  try {
    return persianDateTimeFormatter.format(date);
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Convert ISO / Date to Persian time string (HH:mm)
 */
export function toPersianTime(input?: string | number | Date | null): string {
  if (input === null || input === undefined || input === '') return '';
  const date = safeParseDate(input);
  if (!date) return '';
  try {
    return persianTimeFormatter.format(date);
  } catch {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Get current Jalali (Persian) year as Latin number (e.g. 1403, 1404, 1405)
 */
export function getCurrentPersianYear(): number {
  try {
    const yearStr = persianYearFormatter.format(new Date());
    const digitsOnly = yearStr.replace(/\D/g, '');
    const parsed = parseInt(digitsOnly, 10);
    return isNaN(parsed) || parsed < 1300 ? 1403 : parsed;
  } catch {
    return 1403;
  }
}

/**
 * Get current fiscal year as number
 */
export function getCurrentFiscalYear(): number {
  return getCurrentPersianYear();
}

/**
 * Get formatted current Persian date string with full weekday, day, month, and year
 * e.g., 'چهارشنبه ۲ مهر ۱۴۰۵'
 */
export function getFormattedCurrentPersianDate(): string {
  try {
    return persianFullDateFormatter.format(new Date());
  } catch {
    return toPersianDate(new Date());
  }
}

/**
 * Get name of current Persian month (e.g. فروردین, مهر, ...)
 */
export function getCurrentPersianMonthName(): string {
  try {
    return persianMonthFormatter.format(new Date());
  } catch {
    return 'مهر';
  }
}

/**
 * Generates Persian date string offset by N days from today.
 * e.g., getRelativePersianDate(0) => today
 * getRelativePersianDate(-30) => 30 days ago
 */
export function getRelativePersianDate(daysOffset: number = 0): string {
  const d = new Date();
  if (daysOffset !== 0) {
    d.setDate(d.getDate() + daysOffset);
  }
  return toPersianDate(d);
}

/**
 * Format prefix with current fiscal year (e.g., prefix='ACC' -> 'ACC-1403')
 */
export function formatDocumentYearCode(prefix: string): string {
  return `${prefix}-${getCurrentFiscalYear()}`;
}

/** Sortable day index of a Jalali 'YYYY/MM/DD' date (NaN when unparseable). */
export function dayIndex(date?: string): number {
  const m = (date || '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return y * 365 + (mo <= 6 ? (mo - 1) * 31 : 186 + (mo - 7) * 30) + d;
}

const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const toFa = (n: number, width = 0) => String(n).padStart(width, '0').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

const persianPartsFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
const leapCache = new Map<number, boolean>();

/** true when Esfand of Jalali year `y` has 30 days (from the platform's Persian calendar). */
export function isJalaliLeapYear(y: number): boolean {
  const cached = leapCache.get(y);
  if (cached !== undefined) return cached;
  // The last days of Esfand fall on 19–21 March of Gregorian year y + 622.
  let leap = false;
  for (const day of [19, 20, 21]) {
    const parts = persianPartsFormatter.formatToParts(new Date(Date.UTC(y + 622, 2, day, 12)));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    if (get('year') === y && get('month') === 12 && get('day') === 30) leap = true;
  }
  leapCache.set(y, leap);
  return leap;
}

export function jalaliMonthLength(y: number, m: number): number {
  if (m <= 6) return 31;
  if (m <= 11) return 30;
  return isJalaliLeapYear(y) ? 30 : 29;
}

/** A valid Jalali calendar date «YYYY/MM/DD» (Persian or Latin digits), or null. */
export function parseJalaliDate(date?: string | null): { y: number; m: number; d: number } | null {
  const match = toLatin((date || '').trim()).match(/^(1[2-5]\d{2})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > jalaliMonthLength(y, m)) return null;
  return { y, m, d };
}

/** Last real day of Jalali year `y`: ۱۲/۳۰ in a leap year, otherwise ۱۲/۲۹. */
export function jalaliYearEnd(y: number): string {
  return `${toFa(y)}/${toFa(12, 2)}/${toFa(jalaliMonthLength(y, 12), 2)}`;
}
