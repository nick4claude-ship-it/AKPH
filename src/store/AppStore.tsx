/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppAction, AppState, FinancialEventInput, PostingResult, SliceKey, SliceUpdater } from './types';
import { applyPosting, preparePosting } from './postingEngine';
import { SaveQueue } from './saveQueue';
import type { DataSource, StoreChange } from '../api/types';
import { isFinalJournalEntry } from '../api/types';
import type { JournalEntry, UserProfile } from '../types';

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SLICE': {
      const prev = state[action.key];
      const value = typeof action.updater === 'function' ? (action.updater as (p: unknown) => unknown)(prev) : action.updater;
      return value === prev ? state : { ...state, [action.key]: value };
    }
    case 'APPLY_POSTING':
      return applyPosting(state, action.event, action.entry);
    case 'REPLACE_STATE':
      return action.state;
    case 'MERGE_SERVER_RECORDS': {
      let next = state;
      for (const { slice, upserted } of action.records) {
        const rows = [...((next[slice] as unknown as { id: string }[]) || [])];
        const index = new Map(rows.map((r, i) => [r.id, i]));
        for (const r of upserted as unknown as { id: string }[]) {
          const i = index.get(r.id);
          if (i === undefined) rows.unshift(r);
          else rows[i] = r;
        }
        next = { ...next, [slice]: rows };
      }
      return next;
    }
    default:
      return state;
  }
}

/** Posts an event on behalf of `actor`; the engine checks that user's permission for the operation. */
export type PostFinancialEvent = (input: FinancialEventInput, options: { submitter?: string; actor: UserProfile }) => PostingResult;

interface AppStoreValue {
  state: AppState;
  dispatch: (action: AppAction) => void;
  getState: () => AppState;
  postFinancialEvent: PostFinancialEvent;
  dataSource?: DataSource;
}

function isServerAllowed(action: AppAction): boolean {
  if (action.type === 'MERGE_SERVER_RECORDS' || action.type === 'REPLACE_STATE') return true;
  return action.type === 'SET_SLICE' && LOCAL_ONLY_SLICES.has(action.key);
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export { diffStates } from './saveQueue';

/** Slices that only hold per-browser UI state; they may change locally even when the server owns the data. */
const LOCAL_ONLY_SLICES: ReadonlySet<SliceKey> = new Set<SliceKey>(['dismissedNotificationIds']);

export const SERVER_REQUIRED_MESSAGE = 'این عملیات در نسخه وردپرس به‌زودی فعال می‌شود (نیازمند پیاده‌سازی در سرور).';

export const AppStoreProvider: React.FC<{
  children: React.ReactNode;
  initialState: AppState;
  /** Where committed changes are saved; omitted in tests. */
  dataSource?: DataSource;
  onSyncError?: (message: string) => void;
}> = ({ children, initialState, dataSource, onSyncError }) => {
  // The reducer runs once, eagerly, against the latest committed state; React only receives the result.
  // This keeps postFinancialEvent synchronous (callers get the created entry back) and lets several
  // dispatches in one handler see each other's effects, e.g. idempotency checks within one click.
  const [state, commit] = useReducer((_: AppState, next: AppState) => next, initialState);
  // With a server (WordPress) the browser never changes business records itself: only server answers do.
  const serverOwned = !!dataSource?.commands;
  const latest = useRef(state);
  const reducing = useRef(false);
  const queued = useRef<AppAction[]>([]);
  const lastSaved = useRef(initialState);
  const saveTimer = useRef<number | null>(null);
  const onSyncErrorRef = useRef(onSyncError);
  onSyncErrorRef.current = onSyncError;

  // One queue per provider: saves are serial, confirmed before they count, retried, and rolled back on failure.
  const queue = useRef<SaveQueue | null>(null);
  if (!queue.current && dataSource?.saveChanges) {
    const save = dataSource.saveChanges.bind(dataSource);
    queue.current = new SaveQueue({
      save,
      getSaved: () => lastSaved.current,
      setSaved: (s) => {
        lastSaved.current = s;
      },
      getLatest: () => latest.current,
      rollback: (to, err) => {
        latest.current = to;
        lastSaved.current = to;
        commit(to);
        const farsi = (err as { farsiMessage?: string })?.farsiMessage;
        onSyncErrorRef.current?.(`${farsi || 'ذخیره تغییرات در سرور انجام نشد.'} تغییرات ذخیره‌نشده برگردانده شد.`);
      },
    });
  }
  const flush = useCallback(() => queue.current?.flush(), []);

  // Saves are batched per tick: one handler that touches several slices produces one round-trip.
  const scheduleSave = useCallback(() => {
    if (!queue.current || saveTimer.current !== null) return;
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      flush();
    }, 0);
  }, [flush]);

  const dispatch = useCallback(
    (action: AppAction) => {
      if (serverOwned && !isServerAllowed(action)) {
        onSyncErrorRef.current?.(SERVER_REQUIRED_MESSAGE);
        return;
      }
      // A setter called from inside another slice updater is queued and applied after it,
      // so neither update is computed from a stale snapshot.
      if (reducing.current) {
        queued.current.push(action);
        return;
      }
      reducing.current = true;
      let next = latest.current;
      try {
        next = appReducer(next, action);
        while (queued.current.length) next = appReducer(next, queued.current.shift()!);
      } finally {
        reducing.current = false;
        queued.current = [];
      }
      if (next !== latest.current) {
        latest.current = next;
        commit(next);
        if (action.type === 'REPLACE_STATE') lastSaved.current = next;
        else scheduleSave();
      }
    },
    [scheduleSave, serverOwned]
  );

  // Nothing is lost on unmount (e.g. the DEV role switch): a pending save is sent immediately.
  useEffect(
    () => () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
        flush();
      }
    },
    [flush]
  );

  const getState = useCallback(() => latest.current, []);

  const postFinancialEvent = useCallback<PostFinancialEvent>(
    (input, options) => {
      if (serverOwned) return { ok: false, duplicate: false, error: SERVER_REQUIRED_MESSAGE };
      if (!options?.actor) return { ok: false, duplicate: false, error: '[PostingEngine] ثبت رویداد مالی بدون کاربر مجاز ممکن نیست.' };
      const result = preparePosting(latest.current, input, options);
      if (result.ok && !result.duplicate && result.event && result.entry) {
        dispatch({ type: 'APPLY_POSTING', event: result.event, entry: result.entry });
      } else if (!result.ok) {
        console.error(result.error);
      }
      return result;
    },
    [dispatch, serverOwned]
  );

  const value = useMemo(
    () => ({ state, dispatch, getState, postFinancialEvent, dataSource }),
    [state, dispatch, getState, postFinancialEvent, dataSource]
  );
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
};

function useStoreContext(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used inside <AppStoreProvider>');
  return ctx;
}

export function useAppState(): AppState {
  return useStoreContext().state;
}

export function useAppDispatch() {
  return useStoreContext().dispatch;
}

export function useGetState(): () => AppState {
  return useStoreContext().getState;
}

export function usePostFinancialEvent(): PostFinancialEvent {
  return useStoreContext().postFinancialEvent;
}

/** useState-like access to one slice of the central store. */
export function useStoreSlice<K extends SliceKey>(key: K): [AppState[K], (updater: SliceUpdater<K>) => void] {
  const { state, dispatch } = useStoreContext();
  const set = useCallback((updater: SliceUpdater<K>) => dispatch({ type: 'SET_SLICE', key, updater }), [dispatch, key]);
  return [state[key], set];
}

/** The data source of this session (undefined in tests). */
export function useDataSource(): DataSource | undefined {
  return useStoreContext().dataSource;
}
