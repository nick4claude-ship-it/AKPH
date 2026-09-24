/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountNode, FinancialEvent, JournalEntry, JournalEntryRow } from '../types';
import { AppState, FinancialEventInput, PostingResult } from './types';
import { POSTING_RULES, PostingContext, ACCOUNTS } from './postingRules';
import { generateUUID, getNextSequentialDocNumber } from '../utils/ids';
import { toPersianDate, toPersianTime, getCurrentFiscalYear } from '../utils/date';

export function findAccountNode(chart: AccountNode[], code: string): AccountNode | null {
  for (const node of chart) {
    if (node.code === code) return node;
    if (node.children?.length) {
      const found = findAccountNode(node.children, code);
      if (found) return found;
    }
  }
  return null;
}

/** Idempotency key: one posting per source document and event type. */
export function financialEventKey(e: Pick<FinancialEvent, 'sourceModule' | 'sourceId' | 'type'>): string {
  return `${e.sourceModule}|${e.sourceId}|${e.type}`;
}

export function findPostedEvent(state: AppState, e: Pick<FinancialEvent, 'sourceModule' | 'sourceId' | 'type'>) {
  const key = financialEventKey(e);
  return state.financialEvents.find((x) => x.status === 'posted' && financialEventKey(x) === key);
}

function buildContext(state: AppState, event: FinancialEvent): PostingContext {
  const projectNameOf = (id?: string) => (id ? state.projects.find((p) => p.id === id)?.name : undefined);
  const costCenterNameOf = (id?: string) => (id ? state.costCenters.find((c) => c.id === id)?.name : undefined);
  return {
    account: (code) => {
      const node = findAccountNode(state.chartOfAccounts, code);
      if (!node) throw new Error(`[PostingEngine] کد حساب «${code}» در کدینگ حسابداری وجود ندارد.`);
      return node;
    },
    counterpartyName: state.counterparties.find((c) => c.id === event.counterpartyId)?.name || event.counterpartyId || 'نامشخص',
    projectName: projectNameOf(event.projectId),
    costCenterName: costCenterNameOf(event.costCenterId),
    isOverheadCostCenter: (id) => {
      const cc = state.costCenters.find((c) => c.id === id);
      return !cc || cc.type === 'دفتر مرکزی';
    },
    costCenterNameOf,
    projectNameOf,
  };
}

/**
 * Builds (but does not store) the balanced journal entry for a financial event.
 * Pure with respect to `state`: returns the event and entry that `applyPosting` will store.
 */
export function preparePosting(
  state: AppState,
  input: FinancialEventInput,
  options: { submitter?: string } = {}
): PostingResult {
  const existing = findPostedEvent(state, input);
  if (existing) {
    const entry = state.journalEntries.find((j) => j.id === existing.journalEntryId);
    return { ok: true, duplicate: true, event: existing, entry };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, duplicate: false, error: `[PostingEngine] مبلغ رویداد ${input.type} نامعتبر است (${input.amount}).` };
  }

  const rule = POSTING_RULES[input.type];
  if (!rule) {
    return { ok: false, duplicate: false, error: `[PostingEngine] قاعده ثبت برای رویداد ${input.type} تعریف نشده است.` };
  }

  const now = new Date();
  const event: FinancialEvent = {
    ...input,
    id: generateUUID(),
    date: input.date || toPersianDate(now),
    status: 'posted',
  };

  try {
    const { entryType, title, rows: rawRows } = rule(event, buildContext(state, event));

    let totalDebit = 0;
    let totalCredit = 0;
    const rows: JournalEntryRow[] = rawRows.map((r) => {
      const debit = Math.round(r.debit);
      const credit = Math.round(r.credit);
      if (debit < 0 || credit < 0 || (debit > 0 && credit > 0)) {
        throw new Error(`[PostingEngine] ردیف نامعتبر برای حساب ${r.accountCode}: بدهکار ${debit} / بستانکار ${credit}`);
      }
      totalDebit += debit;
      totalCredit += credit;
      return { ...r, id: generateUUID(), debit, credit, subledgerCode: r.subledgerCode || '', subledgerName: r.subledgerName || '' };
    }).filter((r) => r.debit > 0 || r.credit > 0);

    if (totalDebit !== totalCredit || totalDebit === 0) {
      return {
        ok: false,
        duplicate: false,
        error: `[PostingEngine] سند نامتوازن برای رویداد ${event.type}: بدهکار ${totalDebit} ≠ بستانکار ${totalCredit}`,
      };
    }

    const submitter = options.submitter || 'سیستم ثبت خودکار';
    const docNumber = getNextSequentialDocNumber(
      state.journalEntries.map((j) => j.docNumber),
      'ACC',
      4,
      getCurrentFiscalYear()
    );
    const projectName = state.projects.find((p) => p.id === event.projectId)?.name;
    const costCenterName = state.costCenters.find((c) => c.id === event.costCenterId)?.name;
    const entry: JournalEntry = {
      id: generateUUID(),
      docNumber,
      date: event.date,
      title,
      type: entryType,
      projectId: event.projectId || undefined,
      projectName,
      costCenterId: event.costCenterId || undefined,
      costCenterName,
      submitter,
      status: 'ثبت قطعی',
      rows,
      totalDebit,
      totalCredit,
      isBalanced: true,
      history: [
        {
          date: toPersianDate(now),
          time: toPersianTime(now),
          user: submitter,
          action: `صدور خودکار سند از رویداد مالی ${event.type}`,
          note: `منبع: ${event.sourceModule} / ${event.sourceId}`,
        },
      ],
    };

    return {
      ok: true,
      duplicate: false,
      event: { ...event, journalEntryId: entry.id, docNumber },
      entry,
    };
  } catch (err: any) {
    return { ok: false, duplicate: false, error: err?.message || String(err) };
  }
}

/**
 * Stores a prepared posting. Cash-type balances (bank, cash desk, petty cash) change only here,
 * from the rows of the posted entry.
 */
export function applyPosting(
  state: AppState,
  event: FinancialEvent,
  entry: JournalEntry,
  options: { syncBalances?: boolean } = {}
): AppState {
  if (findPostedEvent(state, event)) return state;

  const next: AppState = {
    ...state,
    financialEvents: [event, ...state.financialEvents],
    journalEntries: [entry, ...state.journalEntries],
  };
  if (options.syncBalances === false) return next;

  const delta = (code: string) => {
    const map = new Map<string, { debit: number; credit: number }>();
    for (const r of entry.rows) {
      if (r.accountCode !== code || !r.subledgerCode) continue;
      const cur = map.get(r.subledgerCode) || { debit: 0, credit: 0 };
      map.set(r.subledgerCode, { debit: cur.debit + r.debit, credit: cur.credit + r.credit });
    }
    return map;
  };

  const bankDelta = delta(ACCOUNTS.bank);
  if (bankDelta.size) {
    next.bankAccounts = state.bankAccounts.map((b) => {
      const d = bankDelta.get(b.id);
      if (!d) return b;
      const balance = b.balance + d.debit - d.credit;
      return {
        ...b,
        balance,
        closingBalance: balance,
        totalReceipts: b.totalReceipts + d.debit,
        totalPayments: b.totalPayments + d.credit,
      };
    });
  }

  const cashDelta = delta(ACCOUNTS.cashDesk);
  if (cashDelta.size) {
    next.cashDesks = state.cashDesks.map((c) => {
      const d = cashDelta.get(c.id);
      return d ? { ...c, balance: c.balance + d.debit - d.credit } : c;
    });
  }

  const pettyDelta = delta(ACCOUNTS.pettyCash);
  if (pettyDelta.size) {
    next.pettyCashAccounts = state.pettyCashAccounts.map((a) => {
      const d = pettyDelta.get(a.id);
      if (!d) return a;
      const change = d.debit - d.credit;
      return { ...a, actualBalance: a.actualBalance + change, usableBalance: a.usableBalance + change };
    });
  }

  return next;
}

/** Posts an event against a plain state object (used for seeding and tests). */
export function postFinancialEventToState(
  state: AppState,
  input: FinancialEventInput,
  options: { submitter?: string; syncBalances?: boolean } = {}
): { state: AppState; result: PostingResult } {
  const result = preparePosting(state, input, options);
  if (!result.ok || result.duplicate || !result.event || !result.entry) return { state, result };
  return { state: applyPosting(state, result.event, result.entry, options), result };
}
