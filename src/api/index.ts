/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DataSource } from './types';

export type { DataSource, PortalSession, StoreChange } from './types';
export { isFinalJournalEntry } from './types';

/**
 * Picks the data source once at startup: inside WordPress (window.PaydarPortal.restUrl is set by the
 * paydar-portal plugin) the REST implementation, otherwise the demo data. Each implementation is a
 * separate chunk, so the production WordPress bundle never downloads the demo dataset.
 */
export async function createDataSource(): Promise<DataSource> {
  if (window.PaydarPortal?.restUrl) {
    const { createWordPressDataSource } = await import('./wordpress');
    return createWordPressDataSource();
  }
  const { createMockDataSource } = await import('./mock');
  return createMockDataSource();
}
