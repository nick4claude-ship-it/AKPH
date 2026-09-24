/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// WordPress data source: only the plugin's existing routes, commands with Idempotency-Key / If-Match,
// never a computed record or a final entry sent from the browser.
import assert from 'node:assert/strict';

type Call = { method: string; url: string; headers: Record<string, string>; body?: unknown };
const calls: Call[] = [];
const responses: Record<string, unknown> = {
  'GET me': { id: 7, display_name: 'حسابدار وردپرس', email: 'a@x.ir', role: 'paydar_accountant', project_ids: [] },
  'GET accounting/settings': { currency: 'toman', fiscal_year: 1405, closed_fiscal_years: [1403] },
  'GET projects': [{ id: 'p1', code: 'PRJ-1', name: 'پروژه آزمون', status: 'در حال اجرا', contract_amount: 1_000_000_000 }],
  'GET accounting/accounts': [
    { code: '1', title: 'دارایی' },
    { code: '11101', title: 'بانک', parent_code: '1' },
    { code: '61101', title: 'حقوق ستاد', parent_code: '1' },
  ],
  'GET accounting/entries': [
    { id: 'e1', number: 'ACC-1405-00001', date: '1405/01/10', status: 'posted', version: 3, description: 'سند', lines: [
      { account_code: '61101', debit: 150, credit: 0 },
      { account_code: '11101', debit: 0, credit: 150 },
    ] },
  ],
  'GET accounting/audit': [],
  'POST accounting/entries': { id: 'e2', number: 'ACC-1405-00002', date: '1405/02/01', status: 'draft', version: 1, description: 'دستی', lines: [
    { account_code: '61101', debit: 15, credit: 0 },
    { account_code: '61101', debit: 15, credit: 0 },
    { account_code: '11101', debit: 0, credit: 30 },
  ] },
  'POST accounting/entries/e2/post': { id: 'e2', number: 'ACC-1405-00002', date: '1405/02/01', status: 'posted', version: 2, lines: [
    { account_code: '61101', debit: 30, credit: 0 },
    { account_code: '11101', debit: 0, credit: 30 },
  ] },
};

const g = globalThis as unknown as Record<string, unknown>;
g.window = { PaydarPortal: { restUrl: 'https://site.test/wp-json/paydar/v1', nonce: 'nonce-1' } };
g.fetch = async (url: string, init: RequestInit) => {
  const path = url.replace('https://site.test/wp-json/paydar/v1/', '').split('?')[0];
  const method = init.method || 'GET';
  calls.push({ method, url: path, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined });
  const key = `${method} ${path}`;
  if (!(key in responses)) return new Response(JSON.stringify({ code: 'rest_no_route', message: 'No route' }), { status: 404 });
  return new Response(JSON.stringify(responses[key]), { status: 200 });
};

const { createWordPressDataSource } = await import('../src/api/wordpress');
const { parseEntries } = await import('../src/api/wordpress/pluginMapping');
const { appReducer } = await import('../src/store/AppStore');

const source = createWordPressDataSource();
const session = await source.loadSession();
assert.equal(session.user.role, 'حسابدار');
assert.equal(session.user.id, '7');
assert.equal(session.currency, 'toman');
const state = await source.loadState(session);
assert.equal(state.projects.length, 1);
assert.equal(state.journalEntries[0].totalDebit, 150, 'amounts stay in Rials (no ×0.1 on the wire)');
assert.equal(state.financeSettings.closedFiscalYears[0], 1403);
assert.ok(!('saveChanges' in source) || source.saveChanges === undefined, 'no generic record write');

const used = new Set(calls.map((c) => c.url));
for (const forbidden of ['session', 'state']) assert.ok(!used.has(forbidden), `must not call ${forbidden}`);
assert.ok(calls.every((c) => !c.url.startsWith('records/') && !c.url.startsWith('ledger/')));
console.log('  ✔ نشست از /me و داده از /projects و /accounting/* خوانده شد؛ مسیرهای session/state/records استفاده نشد');

const commands = source.commands!;
assert.equal(commands.supports('approveVendorInvoice'), false);
assert.equal(commands.supports('executePayment'), false);
assert.equal(commands.supports('createManualJournalEntry'), true);
console.log('  ✔ فقط فرمان‌های دفتر دستی پشتیبانی می‌شوند؛ بقیه «به‌زودی»');

const draft = await commands.run('createManualJournalEntry', [{
  id: 'local', docNumber: 'LOCAL-1', date: '1405/02/01', title: 'دستی', type: 'عمومی', submitter: 'x', status: 'تأیید شده',
  rows: [
    { id: 'r1', accountCode: '61101', accountName: '', description: '', debit: 15, credit: 0 },
    { id: 'r2', accountCode: '61101', accountName: '', description: '', debit: 15, credit: 0 },
    { id: 'r3', accountCode: '11101', accountName: '', description: '', debit: 0, credit: 30 },
  ],
  totalDebit: 30, totalCredit: 30, isBalanced: true, history: [],
}], state);
const create = calls.find((c) => c.method === 'POST' && c.url === 'accounting/entries')!;
assert.ok(create.headers['Idempotency-Key'], 'Idempotency-Key header');
assert.equal(create.headers['X-WP-Nonce'], 'nonce-1');
const body = create.body as Record<string, unknown>;
for (const k of ['status', 'number', 'docNumber', 'total_debit', 'totalDebit', 'id']) assert.ok(!(k in body), `draft body must not carry ${k}`);
assert.deepEqual((body.lines as { debit: number }[]).map((l) => l.debit), [15, 15, 0], 'Rials sent unchanged, row by row');
assert.equal(draft.records[0].upserted.length, 1);
console.log('  ✔ سند دستی فقط به‌صورت پیش‌نویس و با Idempotency-Key ارسال شد؛ شماره، وضعیت و جمع‌ها را سرور داد');

const merged = appReducer(state, { type: 'MERGE_SERVER_RECORDS', records: draft.records });
await commands.run('approveJournalEntry', ['e2'], merged);
const postCall = calls.find((c) => c.url === 'accounting/entries/e2/post')!;
assert.equal(postCall.headers['If-Match'], '"1"', 'If-Match carries the record version');
console.log('  ✔ قطعی‌کردن با If-Match نسخه رکورد');

assert.throws(() => parseEntries([{ id: 'x', status: 'weird', date: '1405/01/01', lines: [] }]), /status/);
assert.throws(() => parseEntries([{ id: 'x', status: 'posted', date: '1405/01/01', lines: [{ account_code: '1', debit: 1.5, credit: 0 }] }]), /ریال/);
console.log('  ✔ قالب نامنتظر پاسخ افزونه با پیام روشن رد می‌شود');

console.log('\nقرارداد API وردپرس: همه آزمون‌ها موفق.');
