/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect } from 'react';
import { useStoreSlice } from './AppStore';
import { useCurrentUser } from './session';

const storageKey = (userId: string) => `paydar:dismissed-notifications:${userId}`;

function readStored(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeStored(userId: string, ids: string[]): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch {
    /* storage unavailable: dismissals last for this session only */
  }
}

/**
 * Notifications the signed-in user dismissed. Each user has their own list (one user closing an alert
 * never hides it from another); it is kept in this browser per user id.
 */
export function useDismissedNotifications(): [string[], (update: (prev: string[]) => string[]) => void] {
  const user = useCurrentUser();
  const [all, setAll] = useStoreSlice('dismissedNotificationIds');
  const mine = all[user.id] || [];

  useEffect(() => {
    const stored = readStored(user.id);
    if (stored.length) setAll((prev) => ({ ...prev, [user.id]: [...new Set([...(prev[user.id] || []), ...stored])] }));
  }, [user.id, setAll]);

  const update = useCallback(
    (fn: (prev: string[]) => string[]) =>
      setAll((prev) => {
        const next = fn(prev[user.id] || []);
        writeStored(user.id, next);
        return { ...prev, [user.id]: next };
      }),
    [setAll, user.id]
  );
  return [mine, update];
}
