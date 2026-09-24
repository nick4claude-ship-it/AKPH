/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppAction, AppState, FinancialEventInput, PostingResult, SliceKey, SliceUpdater } from './types';
import { applyPosting, preparePosting } from './postingEngine';
import type { DataSource, StoreChange } from '../api/types';
import { isFinalJournalEntry } from '../api/types';
import type { JournalEntry } from '../types';

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
    default:
      return state;
  }
}

export type PostFinancialEvent = (input: FinancialEventInput, options?: { submitter?: string }) => PostingResult;

interface AppStoreValue {
  state: AppState;
  dispatch: (action: AppAction) => void;
  getState: () => AppState;
  postFinancialEvent: PostFinancialEvent;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

type Row = Record<string, unknown> & { id?: string };

/** Differences between two committed states, split into ledger writes and record saves. */
export function diffStates(prev: AppState, next: AppState): { changes: StoreChange[]; journal: { entry: JournalEntry; previous?: JournalEntry }[] } {
  const changes: StoreChange[] = [];
  const journal: { entry: JournalEntry; previous?: JournalEntry }[] = [];
  for (const key of Object.keys(next) as SliceKey[]) {
    const a = prev[key] as unknown;
    const b = next[key] as unknown;
    if (a === b) continue;
    if (key === 'journalEntries') {
      const before = new Map((a as JournalEntry[]).map((e) => [e.id, e]));
      for (const entry of b as JournalEntry[]) {
        const old = before.get(entry.id);
        if (old === entry) continue;
        if (old && isFinalJournalEntry(old)) {
          // Final entries are immutable; the workflow layer never edits them. Refuse to sync if it happens.
          console.error(`[Ledger] سند قطعی ${old.docNumber} قابل ویرایش نیست؛ اصلاح فقط با سند معکوس ممکن است.`);
          continue;
        }
        journal.push({ entry, previous: old });
      }
      continue;
    }
    if (!Array.isArray(b) || !(b as Row[]).every((r) => r && typeof r === 'object' && typeof r.id === 'string')) {
      changes.push({ slice: key, replaceWith: b });
      continue;
    }
    const before = new Map(((a as Row[]) || []).map((r) => [r.id as string, r]));
    const upserted = (b as Row[]).filter((r) => before.get(r.id as string) !== r);
    const nextIds = new Set((b as Row[]).map((r) => r.id as string));
    const removedIds = [...before.keys()].filter((id) => !nextIds.has(id));
    if (upserted.length || removedIds.length) changes.push({ slice: key, upserted, removedIds });
  }
  return { changes, journal };
}

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
  const latest = useRef(state);
  const reducing = useRef(false);
  const queued = useRef<AppAction[]>([]);
  const lastSaved = useRef(initialState);
  const saveTimer = useRef<number | null>(null);
  const onSyncErrorRef = useRef(onSyncError);
  onSyncErrorRef.current = onSyncError;

  const flush = useCallback(async () => {
    if (!dataSource) return;
    const target = latest.current;
    const { changes, journal } = diffStates(lastSaved.current, target);
    lastSaved.current = target;
    try {
      for (const j of journal) await dataSource.saveJournalEntry(j.entry, j.previous);
      if (changes.length) await dataSource.saveChanges(changes);
    } catch (err) {
      const farsi = (err as { farsiMessage?: string })?.farsiMessage;
      onSyncErrorRef.current?.(farsi || 'ذخیره تغییرات در سرور انجام نشد.');
    }
  }, [dataSource]);

  // Saves are batched per tick: one handler that touches several slices produces one round-trip.
  const scheduleSave = useCallback(() => {
    if (!dataSource || saveTimer.current !== null) return;
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      flush();
    }, 0);
  }, [dataSource, flush]);

  const dispatch = useCallback(
    (action: AppAction) => {
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
    [scheduleSave]
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
      const result = preparePosting(latest.current, input, options);
      if (result.ok && !result.duplicate && result.event && result.entry) {
        dispatch({ type: 'APPLY_POSTING', event: result.event, entry: result.entry });
      } else if (!result.ok) {
        console.error(result.error);
      }
      return result;
    },
    [dispatch]
  );

  const value = useMemo(() => ({ state, dispatch, getState, postFinancialEvent }), [state, dispatch, getState, postFinancialEvent]);
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
