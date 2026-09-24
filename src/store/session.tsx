/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext } from 'react';
import { UserProfile } from '../types';
import type { PortalSession } from '../api/types';
import { ActionContext, can, checkPermission, PermissionCheck, UserAction } from '../utils/permissions';

interface SessionValue {
  session: PortalSession;
  /** DEV only: sign in as another demo user (reloads that user's data). Undefined in production. */
  switchUser?: (userId: string) => Promise<void>;
  devUsers?: UserProfile[];
  /** Label of the data source (demo vs. official books). */
  sourceLabel: string;
  isDemoData: boolean;
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
