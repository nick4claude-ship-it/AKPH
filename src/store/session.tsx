/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CompanyProfile, UserProfile } from '../types';
import type { PortalSession } from '../api/types';
import { DEFAULT_PREFERENCES, type AccountApi, type AccountPreferences } from '../api/account';
import type { AssistantApi } from '../api/assistant';
import type { CurrencyUnit } from '../utils/money';
import { ActionContext, can, checkPermission, PermissionCheck, UserAction } from '../utils/permissions';
import { matchNav } from '../navigation/navConfig';

/** A change of the signed-in user's own data, applied to the running app without reloading it. */
export interface SessionPatch {
  user?: Partial<Pick<UserProfile, 'name' | 'avatar'>>;
  preferences?: AccountPreferences;
  /** New display unit (the screens are drawn again with it). */
  currency?: CurrencyUnit;
}

interface SessionValue {
  session: PortalSession;
  /** DEV only: sign in as another demo user (reloads that user's data). Undefined in production. */
  switchUser?: (userId: string) => Promise<void>;
  devUsers?: UserProfile[];
  /** Label of the data source (demo vs. official books). */
  sourceLabel: string;
  isDemoData: boolean;
  /** Server mode: sections whose writes the server executes (the others are read-only). */
  writablePaths?: readonly string[];
  /** Users who may be assigned as project manager. */
  listManagers?: () => Promise<{ id: string; name: string }[]>;
  /** «حساب کاربری من» API of the data source. */
  account?: AccountApi;
  /** Server assistant (akph); absent with demo data. */
  assistant?: AssistantApi;
  updateSession?: (patch: SessionPatch) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export const SessionProvider: React.FC<SessionValue & { children: React.ReactNode }> = ({ children, ...value }) => (
  <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
);

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** The signed-in user; workflows use it for permission checks and audit trails. */
export function useCurrentUser(): UserProfile {
  return useSession().session.user;
}

/** The installation's company, for letterheads, print headers and the footer. */
export function useCompany(): CompanyProfile {
  return useSession().session.company;
}

/**
 * Text of the banner above every page while demo data is loaded; null with real books.
 * The public GitHub Pages site (VITE_PAGES=true) states that everything on it is made up.
 */
export function useDemoBanner(): string | null {
  const { isDemoData } = useSession();
  if (!isDemoData) return null;
  return import.meta.env.VITE_PAGES === 'true'
    ? 'نسخه نمایشی — داده ساختگی'
    : 'نسخه نمایشی (فقط مدیر سیستم) — هیچ چیز در پایگاه‌داده ذخیره نمی‌شود و با تازه‌کردن صفحه پاک می‌شود';
}

/** Notice for a section that is read-only with the current data source (null when writes work there). */
export function useReadOnlyNotice(pathname: string): string | null {
  const { writablePaths } = useSession();
  if (!writablePaths) return null;
  const backed = writablePaths.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));
  return backed ? null : 'فقط خواندنی — به‌زودی: ثبت و تأیید این بخش هنوز در سرور پیاده نشده است.';
}

/** Users who may be assigned as project manager (empty while loading or when unavailable). */
export function useProjectManagers(): { id: string; name: string }[] {
  const { listManagers } = useSession();
  const [managers, setManagers] = React.useState<{ id: string; name: string }[]>([]);
  React.useEffect(() => {
    let alive = true;
    listManagers?.()
      .then((m) => alive && setManagers(m))
      .catch(() => alive && setManagers([]));
    return () => {
      alive = false;
    };
  }, [listManagers]);
  return managers;
}

/** Permission check bound to the signed-in user, for hiding or disabling actions in the UI. */
export function usePermission(): {
  can: (action: UserAction, context?: ActionContext) => boolean;
  check: (action: UserAction, context?: ActionContext) => PermissionCheck;
} {
  const user = useCurrentUser();
  return {
    can: useCallback((action: UserAction, context?: ActionContext) => can(user, action, context), [user]),
    check: useCallback((action: UserAction, context?: ActionContext) => checkPermission(user, action, context), [user]),
  };
}

/** The user's own settings (defaults until they choose). */
export function usePreferences(): AccountPreferences {
  return useSession().session.preferences ?? DEFAULT_PREFERENCES;
}

/** Whether the signed-in user may open an app path (its menu node's permission). */
export function useCanOpenPath(): (path: string) => boolean {
  const user = useCurrentUser();
  return useCallback(
    (path: string) => {
      const node = matchNav(path);
      return !!node && (!node.requires || can(user, node.requires));
    },
    [user]
  );
}

let startPageApplied = false;

/** Opens the user's start page once, right after sign-in, when the app starts on the dashboard. */
export function useApplyStartPage(): void {
  const target = usePreferences().startPage;
  const canOpen = useCanOpenPath();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (startPageApplied) return;
    startPageApplied = true;
    if (target !== '/' && pathname === '/' && canOpen(target)) navigate(target, { replace: true });
    // Only the first render of the session counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
