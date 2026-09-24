/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react';
import { AppAction, AppState, FinancialEventInput, PostingResult, SliceKey, SliceUpdater } from './types';
import { applyPosting, preparePosting } from './postingEngine';
import { buildInitialState } from './initialState';

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SLICE': {
      const prev = state[action.key];
      const value = typeof action.updater === 'function' ? action.updater(prev) : action.updater;
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

export const AppStoreProvider: React.FC<{ children: React.ReactNode; initialState?: AppState }> = ({
  children,
  initialState,
}) => {
  // The reducer runs once, eagerly, against the latest committed state; React only receives the result.
  // This keeps postFinancialEvent synchronous (callers get the created entry back) and lets several
  // dispatches in one handler see each other's effects, e.g. idempotency checks within one click.
  const [state, commit] = useReducer(
    (_: AppState, next: AppState) => next,
    undefined,
    () => initialState ?? buildInitialState()
  );
  const latest = useRef(state);
  const reducing = useRef(false);
  const queued = useRef<AppAction[]>([]);

  const dispatch = useCallback((action: AppAction) => {
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
    }
  }, []);

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
