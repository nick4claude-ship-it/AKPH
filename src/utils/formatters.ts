/**
 * Format numbers with thousand separators
 */
export function formatNumber(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '۰';
  return Math.round(value).toLocaleString('fa-IR');
}

/**
 * Format currency with Rial/Toman separators
 */
export function formatCurrency(value: number, unit: string = 'تومان'): string {
  if (value === undefined || value === null || isNaN(value)) return `۰ ${unit}`;
  return `${Math.round(value).toLocaleString('fa-IR')} ${unit}`;
}

/**
 * Format standard Latin number with commas (for clean readability when requested)
 */
export function formatCurrencyEn(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Format currency with billion/million shorthand in Persian (e.g., ۱۸.۵ میلیارد تومان)
 */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000_000) {
    return `${sign}${(abs / 1_000_000_000_000).toFixed(1)} همت`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1)} میلیارد`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(0)} میلیون`;
  }
  return `${sign}${formatNumber(abs)} تومان`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '۰٪';
  return `${value.toFixed(1)}٪`;
}

/**
 * Convert English digits to Persian digits
 */
export function toPersianDigits(num: string | number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num
    .toString()
    .replace(/[0-9]/g, (w) => persianDigits[+w]);
}
