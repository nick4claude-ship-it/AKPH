/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JournalEntry, UserProfile } from '../../types';
import type { AppState } from '../../store/types';
import { emptyState } from '../../store/state';
import { roleFromWordPress } from '../../utils/permissions';
import { getCurrentFiscalYear } from '../../utils/date';
import type { CurrencyUnit } from '../../utils/money';
import { apiClient, ApiError } from '../client';
import { scaleMoney } from '../moneyFields';
import type { DataSource, PortalSession, StoreChange } from '../types';

/**
 * paydar-portal REST contract (namespace paydar/v1, see client.ts for URL and nonce handling).
 *
 *   GET  session                    → { user: { id, display_name, email, avatar, role, project_ids },
 *                                        currency: 'rial'|'toman', fiscal_year }
 *   GET  state                      → { [slice]: records } — only what the current user may see
 *   PUT  records/{slice}            ← { upserted: records[], removed_ids: string[] } | { replace_with: value }
 *   POST ledger/entries             ← journal entry (new final entry or new draft)
 *   PUT  ledger/entries/{id}        ← status change of a draft; the plugin rejects edits of final entries (409)
 *
 * Amounts travel in the ledger currency of the installation (chosen once in the plugin);
 * the store always holds integer Rials, so money fields are converted here, at the boundary.
 */

interface WpSessionResponse {
  user: { id: string | number; display_name: string; email?: string; avatar?: string; role: string; project_ids?: (string | number)[] };
  currency?: CurrencyUnit;
  fiscal_year?: number;
}

export function createWordPressDataSource(): DataSource {
  let currency: CurrencyUnit = window.PaydarPortal?.accounting?.currency === 'rial' ? 'rial' : 'toman';
  const toStore = <T>(v: T): T => (currency === 'toman' ? scaleMoney(v, 10) : v);
  const toServer = <T>(v: T): T => (currency === 'toman' ? scaleMoney(v, 0.1) : v);

  return {
    kind: 'wordpress',
    label: 'دفاتر رسمی پرتال پایدار',

    async loadSession(): Promise<PortalSession> {
      const res = await apiClient.get<WpSessionResponse>('session');
      const role = roleFromWordPress(res.user.role);
      if (!role) throw new ApiError(403, `Unknown role ${res.user.role}`, 'نقش کاربری شما در پرتال تعریف نشده است. با مدیر سیستم تماس بگیرید.');
      currency = res.currency === 'rial' ? 'rial' : res.currency === 'toman' ? 'toman' : currency;
      const user: UserProfile = {
        id: String(res.user.id),
        name: res.user.display_name,
        email: res.user.email || '',
        avatar: res.user.avatar || '',
        role,
        projectIds: role === 'مدیر پروژه' ? (res.user.project_ids || []).map(String) : undefined,
      };
      return { user, currency, fiscalYear: res.fiscal_year || window.PaydarPortal?.accounting?.fiscalYear || getCurrentFiscalYear() };
    },

    async loadState(): Promise<AppState> {
      const res = await apiClient.get<Partial<AppState>>('state');
      return { ...emptyState(), ...toStore(res) };
    },

    async saveChanges(changes: StoreChange[]): Promise<void> {
      for (const change of changes) {
        const body =
          'replaceWith' in change
            ? { replace_with: toServer(change.replaceWith) }
            : { upserted: toServer(change.upserted), removed_ids: change.removedIds };
        await apiClient.put(`records/${change.slice}`, body);
      }
    },

    async saveJournalEntry(entry: JournalEntry, previous?: JournalEntry): Promise<void> {
      if (previous) await apiClient.put(`ledger/entries/${encodeURIComponent(entry.id)}`, toServer(entry));
      else await apiClient.post('ledger/entries', toServer(entry));
    },
  };
}
