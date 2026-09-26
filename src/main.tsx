/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.tsx';
import { BootError, BootLoading } from './components/layout/BootScreens';
// Vazirmatn ships inside the bundle (app/assets in the plugin); no external font service is used.
import '@fontsource-variable/vazirmatn';
import './index.css';
import { createDataSource, DataSource, PortalSession } from './api';
import { AppStoreProvider } from './store/AppStore';
import { SessionProvider, type SessionPatch } from './store/session';
import { emitToast } from './store/toast';
import type { AppState } from './store/types';
import { changeCurrencyUnit, initCurrencyUnit } from './utils/money';

type Boot =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; source: DataSource; session: PortalSession; state: AppState; epoch: number };

const errorMessage = (err: unknown) =>
  (err as { farsiMessage?: string })?.farsiMessage || 'بارگذاری اطلاعات پرتال انجام نشد. اتصال به سرور را بررسی کنید.';

/** Loads the session and the user's data from the data source, then mounts the app. */
function Root() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });

  const load = useCallback(async (userId?: string, previous?: { source: DataSource; epoch: number }) => {
    try {
      const source = previous?.source || (await createDataSource());
      const session = await source.loadSession(userId);
      initCurrencyUnit(session.currency);
      const state = await source.loadState(session);
      if (import.meta.env.DEV && source.kind === 'mock' && !previous) {
        import('./api/mock/validation').then((m) => m.validateMockReferences());
      }
      setBoot({ status: 'ready', source, session, state, epoch: (previous?.epoch || 0) + 1 });
    } catch (err) {
      setBoot({ status: 'error', message: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** The user's own saved name, avatar or preferences, applied without reloading the data. */
  const updateSession = useCallback((patch: SessionPatch) => {
    if (patch.currency) changeCurrencyUnit(patch.currency);
    setBoot((b) =>
      b.status === 'ready'
        ? {
            ...b,
            session: {
              ...b.session,
              user: { ...b.session.user, ...patch.user },
              preferences: patch.preferences ?? b.session.preferences,
              currency: patch.currency ?? b.session.currency,
            },
          }
        : b
    );
  }, []);

  if (boot.status === 'loading') return <BootLoading />;

  if (boot.status === 'error') {
    return (
      <BootError
        message={boot.message}
        onRetry={() => {
          setBoot({ status: 'loading' });
          load();
        }}
      />
    );
  }

  // The role switcher exists only with demo data (DEV, or a demo build); the server source never offers it.
  const demoBuild = import.meta.env.DEV || import.meta.env.VITE_DEMO_DATA === 'true';
  const devUsers = demoBuild && boot.source.kind === 'mock' ? boot.source.devUsers?.() : undefined;
  return (
    <AppStoreProvider key={boot.epoch} initialState={boot.state} dataSource={boot.source} onSyncError={emitToast}>
      <SessionProvider
        session={boot.session}
        sourceLabel={boot.source.label}
        isDemoData={boot.source.kind === 'mock'}
        writablePaths={boot.source.writablePaths}
        listManagers={boot.source.listManagers}
        account={boot.source.account}
        logoutUrl={typeof window !== 'undefined' ? window.AkphPortal?.logoutUrl : undefined}
        assistant={boot.source.assistant}
        updateSession={updateSession}
        devUsers={devUsers}
        switchUser={devUsers ? (userId) => load(userId, { source: boot.source, epoch: boot.epoch }) : undefined}
      >
        <HashRouter>
          <App />
        </HashRouter>
      </SessionProvider>
    </AppStoreProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
