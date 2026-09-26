/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserProfile } from '../../types';
import { DEFAULT_PREFERENCES, type Account, type AccountApi, type AccountResult, type AccountSession } from '../account';
import { ApiError } from '../client';
import { normalizeMobile, passwordError, PASSWORD_MIN_LENGTH, AVATAR_MAX_BYTES } from '../../utils/accountRules';

/**
 * Account of the demo: kept in this browser tab only (nothing reaches a server). There is no real password,
 * so the current password is only required, not checked. Addresses use example.com and 192.0.2.x (reserved
 * for documentation).
 */
export function createMockAccountApi(user: () => UserProfile): AccountApi {
  const accounts = new Map<string, Account>();
  const sessions = new Map<string, AccountSession[]>();
  const now = new Date().toISOString();

  const ensure = (): Account => {
    const u = user();
    let a = accounts.get(u.id);
    if (!a) {
      a = {
        id: u.id,
        userLogin: `demo-${u.id}`,
        displayName: u.name,
        firstName: '',
        lastName: '',
        email: u.email || 'demo@example.com',
        mobile: '',
        role: u.role,
        avatarUrl: null,
        preferences: { ...DEFAULT_PREFERENCES },
        siteCurrency: 'toman',
        registeredAt: now,
        version: 1,
        passwordMinLength: PASSWORD_MIN_LENGTH,
        avatarMaxBytes: AVATAR_MAX_BYTES,
      };
      accounts.set(u.id, a);
      sessions.set(u.id, [
        { current: true, loginAt: now, expiresAt: null, ip: '192.0.2.10', device: 'Chrome روی Windows' },
        { current: false, loginAt: now, expiresAt: null, ip: '192.0.2.24', device: 'Safari روی iOS' },
      ]);
    }
    return a;
  };
  const save = (a: Account, message: string): AccountResult => {
    accounts.set(a.id, a);
    return { message: `${message} (نسخه نمایشی: فقط در همین مرورگر)`, account: a };
  };
  const refuse = (status: number, message: string) => new ApiError(status, message, message);
  const requirePassword = (current: string) => {
    if (!current) throw refuse(400, 'رمز عبور فعلی الزامی است.');
  };

  return {
    demo: true,
    async get() {
      return ensure();
    },
    async updateProfile(input, version) {
      const a = ensure();
      if (version !== a.version) throw refuse(409, 'این اطلاعات هم‌زمان تغییر کرده است؛ صفحه را تازه کنید.');
      const mobile = input.mobile === undefined ? a.mobile : normalizeMobile(input.mobile);
      if (mobile === null) throw refuse(400, 'شماره همراه معتبر نیست.');
      if (input.displayName !== undefined && !input.displayName.trim()) throw refuse(400, 'نام نمایشی الزامی است.');
      return save(
        {
          ...a,
          displayName: input.displayName?.trim() ?? a.displayName,
          firstName: input.firstName?.trim() ?? a.firstName,
          lastName: input.lastName?.trim() ?? a.lastName,
          mobile,
          preferences: { ...a.preferences, ...input.preferences },
          version: a.version + 1,
        },
        'اطلاعات حساب ذخیره شد.'
      );
    },
    async changeEmail(email, currentPassword) {
      requirePassword(currentPassword);
      return save({ ...ensure(), email: email.trim() }, 'ایمیل حساب تغییر کرد.');
    },
    async changePassword(currentPassword, newPassword) {
      requirePassword(currentPassword);
      const error = passwordError(newPassword, currentPassword);
      if (error) throw refuse(400, error);
      const a = ensure();
      sessions.set(a.id, (sessions.get(a.id) || []).filter((s) => s.current));
      return save(a, 'رمز عبور تغییر کرد و نشست‌های دیگر بسته شد.');
    },
    async uploadAvatar(image) {
      const a = ensure();
      if (a.avatarUrl) URL.revokeObjectURL(a.avatarUrl);
      return save({ ...a, avatarUrl: URL.createObjectURL(image) }, 'تصویر پروفایل ذخیره شد.');
    },
    async removeAvatar() {
      const a = ensure();
      if (a.avatarUrl) URL.revokeObjectURL(a.avatarUrl);
      return save({ ...a, avatarUrl: null }, 'تصویر پروفایل حذف شد.');
    },
    async sessions() {
      ensure();
      return sessions.get(user().id) || [];
    },
    async logoutOthers() {
      const id = ensure().id;
      sessions.set(id, (sessions.get(id) || []).filter((s) => s.current));
      return { message: 'از نشست‌های دیگر خارج شدید (نسخه نمایشی).' };
    },
  };
}
