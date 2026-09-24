/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Entry dates and document numbering.
import assert from 'node:assert/strict';
import { buildMockState } from '../src/api/mock/buildState';
import { createMockDataSource } from '../src/api/mock';
import { postFinancialEventToState } from '../src/store/postingEngine';
import * as wf from '../src/store/workflows';
import { AppState, SliceKey } from '../src/store/types';
import { UserProfile } from '../src/types';
import { fiscalYearOf, InvalidDocumentDateError, nextDocNumber, resetRegisteredDocNumbers } from '../src/utils/ids';
import { dayIndex, getCurrentFiscalYear, jalaliYearEnd, parseJalaliDate, toPersianDate } from '../src/utils/date';
import { normalizeDigits } from '../src/utils/money';

const today = toPersianDate(new Date());
const FY = getCurrentFiscalYear();
let state: AppState = buildMockState();
const env = (u: UserProfile): wf.WorkflowEnv => ({
  getState: () => state,
  set: (key: SliceKey, updater: unknown) => {
    state = { ...state, [key]: typeof updater === 'function' ? (updater as (p: unknown) => unknown)(state[key]) : updater };
  },
  post: (input, options) => {
    const { state: next, result } = postFinancialEventToState(state, input, options);
    state = next;
    return result;
  },
  user: u,
});
const PM: UserProfile = { id: 't-pm', name: 'مدیر پروژه آزمون', role: 'مدیر پروژه', email: '', avatar: '', projectIds: state.projects.map((p) => p.id) };
const ACC: UserProfile = { id: 't-acc', name: 'حسابدار آزمون', role: 'حسابدار', email: '', avatar: '' };
const ACC2: UserProfile = { id: 't-acc2', name: 'حسابدار دوم', role: 'حسابدار', email: '', avatar: '' };

// 1) Seed numbers: ACC-YYYY-NNNNN, 1..n per year in date order.
const byYear = new Map<number, typeof state.journalEntries>();
for (const j of state.journalEntries) byYear.set(fiscalYearOf(j.date), [...(byYear.get(fiscalYearOf(j.date)) || []), j]);
for (const [y, list] of byYear) {
  const sorted = [...list].sort((a, b) => a.docNumber.localeCompare(b.docNumber));
  sorted.forEach((j, i) => {
    assert.match(j.docNumber, /^ACC-\d{4}-\d{5}$/, `${j.docNumber} format`);
    assert.equal(j.docNumber, `ACC-${y}-${String(i + 1).padStart(5, '0')}`, `year ${y} numbers start at 1 without gaps`);
    if (i > 0) assert.ok((dayIndex(j.date) || 0) >= (dayIndex(sorted[i - 1].date) || 0), `${j.docNumber} is dated before the previous number`);
  });
}
assert.ok(state.purchaseOrders.every((p) => /^PO-\d{4}-\d{5}$/.test(p.poNumber)), 'other series padded to the same width');
console.log('  ✔ شماره اسناد نمونه: ACC-سال-۵رقم، برای هر سال از ۱ و به ترتیب تاریخ؛ سری‌های دیگر هم‌طول');

// 2) Approving an old statement today dates the entry today, in the current year's series.
const stm = state.clientStatements.find((s) => s.status === 'under_consultant_review')!;
assert.ok(fiscalYearOf(stm.preparationDate) < FY || stm.preparationDate !== today);
wf.advanceClientStatement(env(PM), stm.id);
const r = wf.advanceClientStatement(env(ACC), stm.id);
assert.ok(r.ok, r.message);
const ev = state.financialEvents.find((e) => e.type === 'CLIENT_STATEMENT_APPROVED' && e.sourceId === stm.id)!;
const entry = state.journalEntries.find((j) => j.id === ev.journalEntryId)!;
assert.equal(entry.date, today, 'entry dated on approval day');
assert.ok(entry.docNumber.startsWith(`ACC-${FY}-`), `number in current year: ${entry.docNumber}`);
assert.equal(ev.date, stm.preparationDate, 'the event still records the source document date');
console.log(`  ✔ تأیید امروزِ صورت‌وضعیت قدیمی: سند ${entry.docNumber} با تاریخ امروز`);

// 3) Manual entries: temporary DRF number, permanent ACC number on approval; no future or back-dated final entries.
const base = {
  id: '', docNumber: '', title: 'آزمون', type: 'عمومی' as const, submitter: '', status: 'پیش‌نویس' as const,
  rows: [
    { id: 'a', accountCode: '612', accountName: '', description: '', debit: 1_000, credit: 0 },
    { id: 'b', accountCode: '11101', accountName: '', description: '', debit: 0, credit: 1_000, subledgerCode: state.bankAccounts[0].id },
  ],
  totalDebit: 0, totalCredit: 0, isBalanced: true, history: [],
};
const draft = wf.createManualJournalEntry(env(ACC), { ...base, date: today });
assert.ok(draft.ok, draft.message);
assert.match(draft.docNumber!, new RegExp(`^DRF-${FY}-\\d{5}$`));
const approved = wf.approveJournalEntry(env(ACC2), draft.id!);
assert.ok(approved.ok, approved.message);
assert.match(approved.docNumber!, new RegExp(`^ACC-${FY}-\\d{5}$`));
const lastYearDay = `${FY - 1}/06/01`;
const old = wf.createManualJournalEntry(env(ACC), { ...base, date: `${FY}/01/01` });
assert.ok(old.ok);
const oldApprove = wf.approveJournalEntry(env(ACC2), old.id!);
assert.equal(oldApprove.ok, false, 'a final entry may not be dated before the last final entry of its year');
const future = wf.createManualJournalEntry(env(ACC), { ...base, date: `${FY}/12/29` });
assert.equal(wf.approveJournalEntry(env(ACC2), future.id!).ok, false, 'no future-dated final entry');
void lastYearDay;
console.log('  ✔ سند دستی: شماره موقت DRF، شماره دائم ACC هنگام تأیید؛ تاریخ آینده یا قبل از آخرین سند قطعی رد می‌شود');

// 4) Dates must be real Jalali dates.
assert.throws(() => fiscalYearOf('2025-01-01'), InvalidDocumentDateError);
assert.throws(() => fiscalYearOf(''), InvalidDocumentDateError);
assert.throws(() => nextDocNumber([], 'ACC', 'not a date'), InvalidDocumentDateError);
assert.equal(parseJalaliDate('1403/12/30') !== null, normalizeDigits(jalaliYearEnd(1403)).endsWith('/30'));
assert.equal(normalizeDigits(jalaliYearEnd(1403)), '1403/12/30', '1403 is a leap year');
assert.equal(normalizeDigits(jalaliYearEnd(1404)), '1404/12/29');
assert.equal(parseJalaliDate('1404/12/30'), null);
console.log('  ✔ تاریخ غیرشمسی یا نامعتبر خطا می‌دهد (نه سال جاری)؛ ۱۲/۳۰ فقط در سال کبیسه');

// 5) Numbers issued from a project manager's scoped view never reuse a number of a hidden document.
resetRegisteredDocNumbers();
const source = createMockDataSource();
const pmSession = await source.loadSession('usr-005');
const scoped = await source.loadState(pmSession);
const full = buildMockState();
const seqOf = (code: string) => Number(code.slice(-5));
const yearOf = (code: string) => code.split('-')[1];
const fullAcc = full.journalEntries.map((j) => j.docNumber);
const scopedAcc = scoped.journalEntries.map((j) => j.docNumber);
const year = [...new Set(fullAcc.map(yearOf))].find((y) => {
  const f = Math.max(...fullAcc.filter((c) => yearOf(c) === y).map(seqOf));
  const sc = Math.max(0, ...scopedAcc.filter((c) => yearOf(c) === y).map(seqOf));
  return sc < f;
})!;
assert.ok(year, 'the scoped view hides some entries');
const hiddenMax = Math.max(...fullAcc.filter((c) => yearOf(c) === year).map(seqOf));
const issued = nextDocNumber(scopedAcc, 'ACC', `${year}/06/01`);
assert.equal(issued, `ACC-${year}-${String(hiddenMax + 1).padStart(5, '0')}`);
console.log(`  ✔ شماره‌گذاری در نمای محدود مدیر پروژه روی کل داده انجام شد (${issued})`);

console.log('\nتاریخ سند و شماره‌گذاری: همه آزمون‌ها موفق.');
