/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PortalRole } from '../../types';
import { PORTAL_ROLES } from '../../utils/permissions';
import { DEFAULT_PREFERENCES, ROWS_PER_PAGE_OPTIONS, type Account, type AccountApi, type AccountPreferences, type AccountResult, type AccountSession, type ProfileInput } from '../account';
import { apiClient } from '../client';
import { arr, obj, ShapeError } from './mapping';

/** Account API of the akph/v1 server: GET /account and the commands under /account (current user only). */

const text = (v: unknown) => (typeof v === 'string' ? v : '');

export function parsePreferences(raw: unknown): AccountPreferences {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rows = Number(o.rows_per_page);
  return {
    currency: o.currency === 'toman' || o.currency === 'rial' ? o.currency : 'site',
    rowsPerPage: (ROWS_PER_PAGE_OPTIONS as number[]).includes(rows) ? (rows as AccountPreferences['rowsPerPage']) : DEFAULT_PREFERENCES.rowsPerPage,
    startPage: typeof o.start_page === 'string' && o.start_page.startsWith('/') ? o.start_page : '/',
  };
}

export function parseAccount(raw: unknown): Account {
  const route = '/account';
  const o = obj(route, raw, 'account');
  const version = Number(o.version);
  if (!Number.isInteger(version) || version < 1) throw new ShapeError(route, 'version', 'عدد صحیح نیست');
  const id = text(o.id);
  if (!id) throw new ShapeError(route, 'id', 'وجود ندارد');
  const role = text(o.role);
  return {
    id,
    userLogin: text(o.user_login),
    displayName: text(o.display_name),
    firstName: text(o.first_name),
    lastName: text(o.last_name),
    email: text(o.email),
    mobile: text(o.mobile),
    role: (PORTAL_ROLES as readonly string[]).includes(role) ? (role as PortalRole) : '',
    avatarUrl: typeof o.avatar_url === 'string' && o.avatar_url ? o.avatar_url : null,
    preferences: parsePreferences(o.preferences),
    siteCurrency: o.site_currency === 'rial' ? 'rial' : 'toman',
    registeredAt: typeof o.registered_at === 'string' ? o.registered_at : null,
    version,
    passwordMinLength: Number(o.password_min_length) || 12,
    avatarMaxBytes: Number(o.avatar_max_bytes) || 2 * 1024 * 1024,
  };
}

function parseSession(raw: unknown): AccountSession {
  const o = obj('/account/sessions', raw, 'session');
  return {
    current: o.current === true,
    loginAt: typeof o.login_at === 'string' ? o.login_at : null,
    expiresAt: typeof o.expires_at === 'string' ? o.expires_at : null,
    ip: text(o.ip),
    device: text(o.device) || 'مرورگر ناشناخته',
  };
}

/** Command answer → message and the account record it returned. */
function result(raw: unknown): AccountResult {
  const o = obj('/account', raw);
  const records = obj('/account', o.records ?? {}, 'records');
  const account = Array.isArray(records.account) ? records.account[0] : undefined;
  return { message: typeof o.message === 'string' ? o.message : 'انجام شد.', account: parseAccount(account) };
}

function profileBody(input: ProfileInput, version: number) {
  const body: Record<string, unknown> = { version };
  if (input.displayName !== undefined) body.display_name = input.displayName.trim();
  if (input.firstName !== undefined) body.first_name = input.firstName.trim();
  if (input.lastName !== undefined) body.last_name = input.lastName.trim();
  if (input.mobile !== undefined) body.mobile = input.mobile.trim();
  if (input.preferences) {
    const p: Record<string, unknown> = {};
    if (input.preferences.currency !== undefined) p.currency = input.preferences.currency;
    if (input.preferences.rowsPerPage !== undefined) p.rows_per_page = input.preferences.rowsPerPage;
    if (input.preferences.startPage !== undefined) p.start_page = input.preferences.startPage;
    body.preferences = p;
  }
  return body;
}

export function createAkphAccountApi(): AccountApi {
  const post = (path: string, body: unknown, key: string, version?: number) => apiClient.command<unknown>('POST', path, body, { idempotencyKey: key, version });
  return {
    demo: false,
    async get() {
      return parseAccount(obj('/account', await apiClient.get<unknown>('account')).account);
    },
    async updateProfile(input, version, key) {
      return result(await post('account/profile', profileBody(input, version), key, version));
    },
    async changeEmail(email, currentPassword, key) {
      return result(await post('account/email', { email: email.trim(), current_password: currentPassword }, key));
    },
    async changePassword(currentPassword, newPassword, key) {
      return result(await post('account/password', { current_password: currentPassword, new_password: newPassword }, key));
    },
    async uploadAvatar(image, fileName, key) {
      const form = new FormData();
      form.append('avatar', image, fileName);
      return result(await apiClient.command<unknown>('POST', 'account/avatar', form, { idempotencyKey: key }));
    },
    async removeAvatar(key) {
      return result(await apiClient.command<unknown>('DELETE', 'account/avatar', undefined, { idempotencyKey: key }));
    },
    async sessions() {
      return arr('/account/sessions', obj('/account/sessions', await apiClient.get<unknown>('account/sessions')), 'sessions').map(parseSession);
    },
    async logoutOthers(key) {
      const o = obj('/account/sessions/logout-others', await post('account/sessions/logout-others', {}, key));
      return { message: typeof o.message === 'string' ? o.message : 'انجام شد.' };
    },
  };
}
