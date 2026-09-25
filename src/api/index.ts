/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DataSource } from './types';

export type { DataSource, PortalSession, StoreChange, CommandGateway, CommandResult } from './types';
export { isFinalJournalEntry } from './types';

/**
 * Picks the data source once at startup:
 * - the app page of the plugin in live mode (window.AkphPortal.mode === 'live' with restUrl): the akph/v1 server;
 * - everything else (DEV, the plugin's demo mode, the GitHub Pages site): the in-browser demo source.
 * Each implementation is a separate chunk. The Pages build (VITE_PAGES=true) never talks to a server.
 */
export async function createDataSource(): Promise<DataSource> {
  const config = typeof window !== 'undefined' ? window.AkphPortal : undefined;
  if (import.meta.env.VITE_PAGES !== 'true' && config?.mode === 'live' && config.restUrl) {
    const { createAkphDataSource } = await import('./akph');
    return createAkphDataSource();
  }
  const { createMockDataSource } = await import('./mock');
  return createMockDataSource();
}
