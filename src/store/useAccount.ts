/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import type { Account, AccountPreferences, AccountResult, AccountSession } from '../api/account';
import { navConfig } from '../navigation/navConfig';
import { avatarFileError, emailError, mobileError, passwordError } from '../utils/accountRules';
import { commandKeys } from './commandKeys';
import { useCanOpenPath, useSession } from './session';

/** Which form is being sent. */
export type AccountForm = 'profile' | 'preferences' | 'email' | 'password' | 'avatar' | 'sessions';

export interface ProfileForm {
  displayName: string;
  firstName: string;
  lastName: string;
  mobile: string;
}

/** Outcome of a form: a message for the whole form and errors of single fields. */
export interface FormOutcome {
  ok: boolean;
  message: string;
  errors: Record<string, string>;
}

const SERVER_FIELD: Record<string, string> = {
  display_name: 'displayName',
  first_name: 'firstName',
  last_name: 'lastName',
  mobile: 'mobile',
  email: 'email',
  current_password: 'currentPassword',
  new_password: 'newPassword',
  avatar: 'avatar',
};

const failed = (errors: Record<string, string>, message = 'چند مورد را اصلاح کنید.'): FormOutcome => ({ ok: false, message, errors });

function refusal(err: unknown): FormOutcome {
  const message = err instanceof ApiError ? err.farsiMessage : 'انجام نشد؛ دوباره تلاش کنید.';
  const field = err instanceof ApiError ? SERVER_FIELD[err.field] : undefined;
  return { ok: false, message, errors: field ? { [field]: message } : {} };
}

/**
 * «حساب کاربری من»: the signed-in user's own account through the data source's account API. Checks each
 * form in the browser first (same rules as the server), sends one Idempotency-Key per submission, and applies
 * the saved name, avatar and preferences to the running app.
 */
export function useAccount() {
  const { account: api, updateSession, session } = useSession();
  const canOpen = useCanOpenPath();
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unavailable'>(api ? 'loading' : 'unavailable');
  const [loadError, setLoadError] = useState('');
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [sessionsError, setSessionsError] = useState('');
  const [busy, setBusy] = useState<AccountForm | null>(null);

  const loadSessions = useCallback(async () => {
    if (!api) return;
    setSessionsError('');
    try {
      setSessions(await api.sessions());
    } catch (err) {
      setSessionsError(err instanceof ApiError ? err.farsiMessage : 'فهرست نشست‌ها دریافت نشد.');
    }
  }, [api]);

  const load = useCallback(async () => {
    if (!api) return;
    setStatus('loading');
    try {
      setAccount(await api.get());
      setStatus('ready');
      loadSessions();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.farsiMessage : 'اطلاعات حساب دریافت نشد.');
      setStatus('error');
    }
  }, [api, loadSessions]);

  useEffect(() => {
    load();
  }, [load]);

  /** Saved account → this page and the rest of the app (header name and avatar, preferences, currency). */
  const apply = useCallback(
    (result: AccountResult) => {
      const a = result.account;
      setAccount(a);
      const currency = a.preferences.currency === 'site' ? a.siteCurrency : a.preferences.currency;
      updateSession?.({
        user: { name: a.displayName, avatar: a.avatarUrl || '' },
        preferences: a.preferences,
        currency: currency !== session.currency ? currency : undefined,
      });
    },
    [updateSession, session.currency]
  );

  /** Sends one submission with its Idempotency-Key (the same key when the same form is sent again). */
  const send = useCallback(
    async (form: AccountForm, action: string, fingerprint: unknown[], run: (key: string) => Promise<AccountResult | { message: string }>): Promise<FormOutcome> => {
      const { key, inFlight } = commandKeys.acquire(`account.${action}`, fingerprint);
      if (inFlight) return failed({}, 'درخواست قبلی هنوز در حال ارسال است.');
      setBusy(form);
      try {
        const result = await run(key);
        commandKeys.settle(key, 'ok');
        if ('account' in result) apply(result);
        return { ok: true, message: result.message, errors: {} };
      } catch (err) {
        commandKeys.settle(key, err instanceof ApiError && err.outcomeUnknown ? 'unknown' : 'rejected');
        return refusal(err);
      } finally {
        setBusy(null);
      }
    },
    [apply]
  );

  const saveProfile = useCallback(
    async (form: ProfileForm): Promise<FormOutcome> => {
      if (!api || !account) return failed({}, 'اطلاعات حساب هنوز بارگذاری نشده است.');
      const errors: Record<string, string> = {};
      if (!form.displayName.trim()) errors.displayName = 'نام نمایشی را وارد کنید.';
      const mobile = mobileError(form.mobile);
      if (mobile) errors.mobile = mobile;
      if (Object.keys(errors).length) return failed(errors);
      const version = account.version;
      return send('profile', 'profile', [form, version], (key) => api.updateProfile(form, version, key));
    },
    [api, account, send]
  );

  const savePreferences = useCallback(
    async (preferences: AccountPreferences): Promise<FormOutcome> => {
      if (!api || !account) return failed({}, 'اطلاعات حساب هنوز بارگذاری نشده است.');
      const version = account.version;
      return send('preferences', 'preferences', [preferences, version], (key) => api.updateProfile({ preferences }, version, key));
    },
    [api, account, send]
  );

  const changeEmail = useCallback(
    async (email: string, currentPassword: string): Promise<FormOutcome> => {
      if (!api) return failed({}, 'این بخش در دسترس نیست.');
      const errors: Record<string, string> = {};
      const e = emailError(email);
      if (e) errors.email = e;
      if (!currentPassword) errors.currentPassword = 'رمز عبور فعلی را وارد کنید.';
      if (Object.keys(errors).length) return failed(errors);
      return send('email', 'email', [email.trim(), currentPassword], (key) => api.changeEmail(email, currentPassword, key));
    },
    [api, send]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string, repeat: string): Promise<FormOutcome> => {
      if (!api) return failed({}, 'این بخش در دسترس نیست.');
      const errors: Record<string, string> = {};
      if (!currentPassword) errors.currentPassword = 'رمز عبور فعلی را وارد کنید.';
      const p = passwordError(newPassword, currentPassword, account?.passwordMinLength);
      if (p) errors.newPassword = p;
      else if (repeat !== newPassword) errors.repeat = 'تکرار رمز با رمز جدید یکی نیست.';
      if (Object.keys(errors).length) return failed(errors);
      const outcome = await send('password', 'password', [currentPassword, newPassword], (key) => api.changePassword(currentPassword, newPassword, key));
      if (outcome.ok) loadSessions();
      return outcome;
    },
    [api, account, send, loadSessions]
  );

  /** The cropped square from useAvatarCrop; `id` tells two crops apart for the submission key. */
  const uploadAvatar = useCallback(
    async (image: { blob: Blob; fileName: string; id: string }): Promise<FormOutcome> => {
      if (!api) return failed({}, 'این بخش در دسترس نیست.');
      const error = avatarFileError({ type: image.blob.type, size: image.blob.size }, account?.avatarMaxBytes);
      if (error) return failed({ avatar: error }, error);
      return send('avatar', 'avatar', [image.id, image.blob.size], (key) => api.uploadAvatar(image.blob, image.fileName, key));
    },
    [api, account, send]
  );

  const removeAvatar = useCallback(async (): Promise<FormOutcome> => {
    if (!api) return failed({}, 'این بخش در دسترس نیست.');
    return send('avatar', 'avatar-remove', [account?.avatarUrl], (key) => api.removeAvatar(key));
  }, [api, account, send]);

  const logoutOthers = useCallback(async (): Promise<FormOutcome> => {
    if (!api) return failed({}, 'این بخش در دسترس نیست.');
    const outcome = await send('sessions', 'logout-others', [sessions?.length], (key) => api.logoutOthers(key));
    if (outcome.ok) loadSessions();
    return outcome;
  }, [api, send, sessions, loadSessions]);

  /** Pages the user may choose as start page (those their role can open). */
  const startPages = useMemo(
    () =>
      navConfig
        .filter((n) => n.path && !n.hidden && canOpen(n.path) && START_PAGES.includes(n.path))
        .map((n) => ({ path: n.path as string, label: n.parent ? `${navConfig.find((p) => p.id === n.parent)?.label ?? ''} ← ${n.label}` : n.label })),
    [canOpen]
  );

  return {
    status,
    loadError,
    reload: load,
    account,
    demo: api?.demo ?? false,
    busy,
    sessions,
    sessionsError,
    reloadSessions: loadSessions,
    startPages,
    saveProfile,
    savePreferences,
    changeEmail,
    changePassword,
    uploadAvatar,
    removeAvatar,
    logoutOthers,
    checkAvatarFile: (file: { type: string; size: number }) => avatarFileError(file, account?.avatarMaxBytes),
  };
}

/** The server's list of start pages (class-akph-account.php START_PAGES). */
const START_PAGES = [
  '/', '/projects', '/contracts/client', '/contracts/subcontract', '/statements/client', '/statements/subcontractor',
  '/procurement', '/inventory', '/petty-cash', '/finance/accounting', '/finance/payments', '/finance/receipts',
  '/documents', '/approvals', '/reports', '/ai',
];
