/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import App from './App.tsx';
import './index.css';
import { createDataSource, DataSource, PortalSession } from './api';
import { AppStoreProvider } from './store/AppStore';
import { SessionProvider } from './store/session';
import { emitToast } from './store/toast';
import type { AppState } from './store/types';
import { initCurrencyUnit } from './utils/money';

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

  if (boot.status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-600" role="status">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-bold">در حال دریافت اطلاعات پرتال...</p>
      </div>
    );
  }

  if (boot.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="p-8 rounded-2xl bg-white border border-rose-200 text-center max-w-lg space-y-3 shadow-sm" role="alert">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h1 className="text-sm font-bold text-slate-900">خطا در بارگذاری پرتال</h1>
          <p className="text-xs text-slate-500 leading-relaxed">{boot.message}</p>
          <button
            onClick={() => {
              setBoot({ status: 'loading' });
              load();
            }}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 cursor-pointer"
          >
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  const devUsers = import.meta.env.DEV ? boot.source.devUsers?.() : undefined;
  return (
    <AppStoreProvider key={boot.epoch} initialState={boot.state} dataSource={boot.source} onSyncError={emitToast}>
      <SessionProvider
        session={boot.session}
        sourceLabel={boot.source.label}
        isDemoData={boot.source.kind === 'mock'}
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
