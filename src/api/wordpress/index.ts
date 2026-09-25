/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CompanyProfile, JournalEntry } from '../../types';
import type { AppState } from '../../store/types';
import { emptyState } from '../../store/state';
import { getCurrentFiscalYear } from '../../utils/date';
import { generateUUID } from '../../utils/ids';
import { apiClient, ApiError } from '../client';
import type { CommandGateway, CommandResult, DataSource, PortalSession } from '../types';
import { parseAccounts, parseAccountingSettings, parseAudit, parseEntries, parseEntry, parseMe, parseProjects, toEntryDraftBody } from './pluginMapping';

/**
 * WordPress data source (namespace paydar/v1, see client.ts for URL and nonce handling).
 *
 * It uses only the routes the installed paydar-portal plugin has today:
 *   GET /me, GET /projects, GET /accounting/settings, GET /accounting/accounts, GET /accounting/entries,
 *   GET /accounting/audit, POST /accounting/entries (draft), POST /accounting/entries/{id}/post,
 *   POST /accounting/entries/{id}/reverse.
 * The browser never sends balances, statuses, numbers or final entries: only user input and commands.
 * Every other module is read-only here until the server implements its commands (docs/API-CONTRACT.md).
 */

const optional = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch (err) {
    // A route the user may not read (403) leaves that part empty; anything else is a real failure.
    if (err instanceof ApiError && err.status === 403) return fallback;
    throw err;
  }
};

/** The installation's company: the WordPress site title the plugin passes in window.PaydarPortal.siteName. */
function siteCompany(): CompanyProfile {
  const name = window.PaydarPortal?.siteName?.trim() || 'پرتال مدیریت پیمانکاری';
  return { name, legalName: name };
}

function entryResult(raw: unknown, message: (e: JournalEntry) => string): CommandResult {
  const entry = parseEntry(raw);
  return { message: message(entry), id: entry.id, docNumber: entry.docNumber, records: [{ slice: 'journalEntries', upserted: [entry as unknown as Record<string, unknown>] }] };
}

/** Reversal responses may return the original and the new reversal entry. */
function reversalResult(raw: unknown): CommandResult {
  const o = raw as { original?: unknown; reversal?: unknown };
  const entries = o && typeof o === 'object' && 'reversal' in o ? [o.original, o.reversal].filter(Boolean).map((e) => parseEntry(e)) : [parseEntry(raw)];
  const reversal = entries[entries.length - 1];
  return {
    message: `سند معکوس ${reversal.docNumber} در سرور ثبت شد.`,
    id: reversal.id,
    docNumber: reversal.docNumber,
    records: [{ slice: 'journalEntries', upserted: entries as unknown as Record<string, unknown>[] }],
  };
}

const findEntry = (state: AppState, id: string) => state.journalEntries.find((j) => j.id === id);

/** Commands of the manual ledger; the key is the reference workflow each one replaces. */
const COMMANDS: Record<string, (args: unknown[], state: AppState) => Promise<CommandResult>> = {
  async createManualJournalEntry([entry]) {
    const raw = await apiClient.command('POST', 'accounting/entries', toEntryDraftBody(entry as JournalEntry), { idempotencyKey: generateUUID() });
    return entryResult(raw, (e) => `پیش‌نویس سند ${e.docNumber || ''} در سرور ثبت شد و در انتظار تأیید است.`);
  },
  async approveJournalEntry([id], state) {
    const current = findEntry(state, id as string);
    const raw = await apiClient.command('POST', `accounting/entries/${encodeURIComponent(id as string)}/post`, { version: current?.version }, {
      idempotencyKey: generateUUID(),
      version: current?.version,
    });
    return entryResult(raw, (e) => `سند ${e.docNumber} در سرور قطعی شد.`);
  },
  async reverseJournalEntry([id, reason], state) {
    const current = findEntry(state, id as string);
    const raw = await apiClient.command('POST', `accounting/entries/${encodeURIComponent(id as string)}/reverse`, { reason, version: current?.version }, {
      idempotencyKey: generateUUID(),
      version: current?.version,
    });
    return reversalResult(raw);
  },
};

export function createWordPressDataSource(): DataSource {
  let session: PortalSession | null = null;

  const commands: CommandGateway = {
    supports: (action) => action in COMMANDS,
    run: (action, args, state) => {
      const cmd = COMMANDS[action];
      if (!cmd) return Promise.reject(new ApiError(501, `Unsupported command ${action}`, 'این عملیات هنوز در سرور پیاده‌سازی نشده است.'));
      return cmd(args, state);
    },
  };

  return {
    kind: 'wordpress',
    label: 'دفاتر رسمی پرتال پایدار',
    commands,

    async loadSession(): Promise<PortalSession> {
      const me = parseMe(await apiClient.get<unknown>('me'));
      const settings = await optional(apiClient.get<unknown>('accounting/settings').then(parseAccountingSettings), null);
      session = {
        user: me.user,
        currency: settings?.currency || me.currency || (window.PaydarPortal?.accounting?.currency === 'rial' ? 'rial' : 'toman'),
        fiscalYear: settings?.fiscalYear || me.fiscalYear || window.PaydarPortal?.accounting?.fiscalYear || getCurrentFiscalYear(),
        company: siteCompany(),
      };
      return session;
    },

    async loadState(): Promise<AppState> {
      const [projects, accounts, entries, audit, settings] = await Promise.all([
        apiClient.get<unknown>('projects').then(parseProjects),
        optional(apiClient.get<unknown>('accounting/accounts').then(parseAccounts), []),
        optional(apiClient.get<unknown>('accounting/entries').then(parseEntries), []),
        optional(apiClient.get<unknown>('accounting/audit').then(parseAudit), []),
        optional(apiClient.get<unknown>('accounting/settings').then(parseAccountingSettings), null),
      ]);
      const base = emptyState();
      return {
        ...base,
        projects,
        chartOfAccounts: accounts,
        journalEntries: entries,
        auditLogs: audit,
        financeSettings: { ...base.financeSettings, closedFiscalYears: settings?.closedFiscalYears || [] },
      };
    },
  };
}
