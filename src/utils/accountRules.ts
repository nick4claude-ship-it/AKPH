/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Checks of the account forms, the same as the server's (wordpress-plugin/akph-portal/includes/class-akph-account.php);
 * the server checks again and has the last word.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/** Iranian mobile → 09XXXXXXXXX; '' for an empty field; null when it is not a mobile number. */
export function normalizeMobile(value: string): string | null {
  const digits = value.replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d]).replace(/[\s\-()]+/g, '');
  if (digits === '') return '';
  const m = /^(?:\+98|0098|98|0)?(9\d{9})$/.exec(digits);
  return m ? `0${m[1]}` : null;
}

export function mobileError(value: string): string | null {
  return normalizeMobile(value) === null ? 'شماره همراه باید با ۰۹ شروع شود و ۱۱ رقم باشد (مثل ۰۹۱۲۳۴۵۶۷۸۹).' : null;
}

export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return 'ایمیل را وارد کنید.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'نشانی ایمیل معتبر نیست.';
}

/** Length counted in characters (as the server's mb_strlen). */
export function passwordError(next: string, current: string, min = PASSWORD_MIN_LENGTH): string | null {
  const length = Array.from(next).length;
  if (length < min) return `رمز عبور جدید باید دست‌کم ${min.toLocaleString('fa-IR')} نویسه باشد.`;
  if (next === current) return 'رمز عبور جدید باید با رمز فعلی فرق داشته باشد.';
  return null;
}

export function avatarFileError(file: { type: string; size: number }, maxBytes = AVATAR_MAX_BYTES): string | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return 'فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود.';
  if (file.size > maxBytes) return 'حجم تصویر باید حداکثر ۲ مگابایت باشد.';
  return null;
}
