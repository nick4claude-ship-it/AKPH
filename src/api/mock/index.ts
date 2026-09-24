/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserProfile } from '../../types';
import type { AppState } from '../../store/types';
import { scopeStateToProjects } from '../../store/state';
import { getCurrentFiscalYear } from '../../utils/date';
import type { DataSource, PortalSession, StoreChange } from '../types';
import { buildMockState } from './buildState';
import { registerDocNumbers } from '../../utils/ids';
import { mockUsers } from './seeds';

/** Project ids a project manager may see; undefined for roles that see every project. */
function projectScope(user: UserProfile, state: AppState): string[] | undefined {
  if (user.role !== 'مدیر پروژه') return undefined;
  return state.projects.filter((p) => p.managerUserId === user.id).map((p) => p.id);
}

function applyChanges(state: AppState, changes: StoreChange[]): AppState {
  const next = { ...state } as unknown as Record<string, unknown>;
  for (const change of changes) {
    if ('replaceWith' in change) {
      next[change.slice] = change.replaceWith;
      continue;
    }
    const rows = [...((next[change.slice] as Record<string, unknown>[]) || [])];
    const index = new Map(rows.map((r, i) => [r.id as string, i]));
    for (const r of change.upserted) {
      const i = index.get(r.id as string);
      if (i === undefined) rows.unshift(r);
      else rows[i] = r;
    }
    const removed = new Set(change.removedIds);
    next[change.slice] = rows.filter((r) => !removed.has(r.id as string));
  }
  return next as unknown as AppState;
}

/** Every string in the dataset; registerDocNumbers keeps only document numbers. */
function* strings(v: unknown): Generator<string> {
  if (typeof v === 'string') yield v;
  else if (Array.isArray(v)) for (const x of v) yield* strings(x);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* strings(x);
}

/**
 * Demo data source. It keeps one in-memory "server" copy of the full dataset; every save is merged
 * into it, so switching roles in DEV keeps the work done in this browser tab.
 */
export function createMockDataSource(): DataSource {
  let server: AppState | null = null;
  const ensure = () => (server ??= buildMockState());

  return {
    kind: 'mock',
    label: 'داده نمایشی (محیط توسعه)',

    async loadSession(userId?: string): Promise<PortalSession> {
      const state = ensure();
      const base = mockUsers.find((u) => u.id === userId) || mockUsers[0];
      return {
        user: { ...base, projectIds: projectScope(base, state) },
        currency: 'toman',
        fiscalYear: getCurrentFiscalYear(),
      };
    },

    async loadState(session: PortalSession): Promise<AppState> {
      // Numbers are issued against the whole dataset, not the user's scoped view: a project manager's
      // new document must never reuse a number taken by a headquarters document they cannot see.
      registerDocNumbers(strings(ensure()));
      return scopeStateToProjects(ensure(), session.user.projectIds);
    },

    async saveChanges(changes: StoreChange[]): Promise<void> {
      server = applyChanges(ensure(), changes);
      registerDocNumbers(strings(changes));
    },

    devUsers: () => mockUsers,
  };
}
