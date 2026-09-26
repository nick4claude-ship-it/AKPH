/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PortalRole } from '../types';

/**
 * «حساب کاربری من»: the signed-in user's own account (akph/v1 /account*, docs/API-CONTRACT.md). There is no
 * user id anywhere in this API: every call acts on the current user, and role or capabilities are never sent.
 */

export type CurrencyPreference = 'site' | 'toman' | 'rial';

export interface AccountPreferences {
  /** 'site': the installation's display unit. */
  currency: CurrencyPreference;
  rowsPerPage: 10 | 25 | 50 | 100;
  /** App path opened after sign-in. */
  startPage: string;
}

export interface Account {
  id: string;
  userLogin: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  /** 09XXXXXXXXX or ''. */
  mobile: string;
  role: PortalRole | '';
  /** Uploaded avatar; null shows initials (no external avatar service). */
  avatarUrl: string | null;
  preferences: AccountPreferences;
  siteCurrency: 'toman' | 'rial';
  registeredAt: string | null;
  /** Concurrency token of the profile form. */
  version: number;
  passwordMinLength: number;
  avatarMaxBytes: number;
}

export interface AccountSession {
  current: boolean;
  loginAt: string | null;
  expiresAt: string | null;
  ip: string;
  /** «Chrome روی Windows» */
  device: string;
}

export interface ProfileInput {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  preferences?: Partial<AccountPreferences>;
}

export interface AccountResult {
  message: string;
  account: Account;
}

export const ROWS_PER_PAGE_OPTIONS: AccountPreferences['rowsPerPage'][] = [10, 25, 50, 100];
export const DEFAULT_PREFERENCES: AccountPreferences = { currency: 'site', rowsPerPage: 25, startPage: '/' };

/** Calls of the account API. `key` is the Idempotency-Key of the form submission (src/store/commandKeys.ts). */
export interface AccountApi {
  /** Demo: changes stay in this browser tab only. */
  readonly demo: boolean;
  get(): Promise<Account>;
  updateProfile(input: ProfileInput, version: number, key: string): Promise<AccountResult>;
  changeEmail(email: string, currentPassword: string, key: string): Promise<AccountResult>;
  changePassword(currentPassword: string, newPassword: string, key: string): Promise<AccountResult>;
  uploadAvatar(image: Blob, fileName: string, key: string): Promise<AccountResult>;
  removeAvatar(key: string): Promise<AccountResult>;
  sessions(): Promise<AccountSession[]>;
  logoutOthers(key: string): Promise<{ message: string }>;
}
