/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// akph/v1 data source: reads from the server, sends only commands (Idempotency-Key, version/If-Match),
// never a computed record, number, status or total. Dates: ISO on the wire, Jalali in the app.
import assert from 'node:assert/strict';

type Call = { method: string; url: string; query: string; headers: Record<string, string>; body?: unknown };
const calls: Call[] = [];

const entry = (over: Record<string, unknown> = {}) => ({
  id: '11', doc_number: 'ACC-1405-00001', draft_number: 'DRF-1405-00001', fiscal_year: 1405, date: '2026-03-30', description: 'سند آزمون',
  entry_type: 'general', source_type: 'manual', project_id: '5', status: 'posted', total: 150,
  lines: [
    { line_no: 1, account_code: '61101', project_id: '5', cost_center_id: '8', counterparty_id: null, description: 'حقوق', debit: 150, credit: 0 },
    { line_no: 2, account_code: '11101', project_id: null, cost_center_id: null, counterparty_id: '3', description: 'بانک', debit: 0, credit: 150 },
  ],
  reversal_of: null, reversed_by: null, created_by: '7', created_by_name: 'حسابدار یک', created_at: '2026-03-30T08:00:00Z',
  approved_by: '9', approved_by_name: 'حسابدار دو', approved_at: '2026-03-30T09:00:00Z', rejected_by: null, rejected_at: null, status_note: '', version: 2,
  ...over,
});

const responses: Record<string, unknown> = {
  'GET me': { id: '7', display_name: 'حسابدار یک', role: 'حسابدار', role_slug: 'paydar_accountant', view_all: true, project_ids: [], currency: 'rial', fiscal_year: 1405, closed_fiscal_years: [1403], today: '2026-09-25' },
  'GET projects': { projects: [{
    id: '5', code: 'PRJ-1405-00001', name: 'پروژه آزمون', client_id: null, client_name: 'کارفرما', consultant_name: '', manager_user_id: '21', manager_name: 'مدیر پروژه',
    site_supervisor: '', location: '', contract_ref: '', description: '', status: 'mobilizing', physical_progress: 12, start_date: '2026-04-04', end_date: null,
    budget: 5_000_000_000, contract_amount: 9_000_000_000, manual_summary: { revenue: 125_000_000_000, cost: 0, cash: 0, receivable: 0, payable: 0, note: 'منتقل‌شده' },
    legacy_id: 'PRJ-24-AAA', version: 3, editable: ['financial'], created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
  }] },
  'GET cost-centers': { cost_centers: [{ id: '8', code: 'CC-1405-00001', name: 'کارگاه', project_id: '5', type: 'project_site', manager_name: '', budget: 0, active: true, version: 1 }] },
  'GET counterparties': { counterparties: [{ id: '3', kind: 'supplier', name: 'تأمین‌کننده', national_id: '', economic_code: '', phone: '', email: '', address: '', sheba: '', bank_name: '', trade_type: '', active: true, version: 1 }] },
  'GET accounts': { accounts: [
    { id: '1', code: '1', title: 'دارایی', level: 'group', nature: 'debit', parent_code: null, active: true, postable: false, version: 1 },
    { id: '2', code: '11', title: 'جاری', level: 'general', nature: 'debit', parent_code: '1', active: true, postable: false, version: 1 },
    { id: '3', code: '111', title: 'نقد', level: 'subsidiary', nature: 'debit', parent_code: '11', active: true, postable: false, version: 1 },
    { id: '4', code: '11101', title: 'بانک', level: 'detail', nature: 'debit', parent_code: '111', active: true, postable: true, version: 1 },
    { id: '5', code: '61101', title: 'حقوق ستاد', level: 'detail', nature: 'debit', parent_code: '111', active: true, postable: true, version: 1 },
  ] },
  'GET journal-entries': { entries: [entry(), entry({ id: '12', doc_number: null, draft_number: 'DRF-1405-00002', status: 'pending', approved_by: null, approved_at: null, version: 1 })], page: 1, total: 2 },
  'GET audit': { events: [], page: 1, total: 0 },
  'POST journal-entries': { message: 'سند DRF-1405-00003 ثبت شد.', id: '13', doc_number: 'DRF-1405-00003', records: { journal_entries: [entry({ id: '13', doc_number: null, draft_number: 'DRF-1405-00003', status: 'pending', version: 1 })] } },
  'POST journal-entries/12/post': { message: 'قطعی شد.', id: '12', doc_number: 'ACC-1405-00002', records: { journal_entries: [entry({ id: '12', doc_number: 'ACC-1405-00002', version: 2 })] } },
  'POST projects/5': { message: 'به‌روز شد.', id: '5', records: { projects: [] } },
};

const g = globalThis as unknown as Record<string, unknown>;
// Plain permalinks, as on the live site: the REST base is a query string.
g.window = { AkphPortal: { mode: 'live', restUrl: 'https://site.test/?rest_route=/akph/v1', nonce: 'nonce-1', siteName: 'شرکت آزمون' } };
g.fetch = async (url: string, init: RequestInit) => {
  const prefix = 'https://site.test/?rest_route=/akph/v1/';
  assert.ok(url.startsWith(prefix), `REST URL keeps rest_route: ${url}`);
  const [path, query = ''] = url.slice(prefix.length).split('&', 2);
  const method = init.method || 'GET';
  calls.push({ method, url: path, query, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined });
  const key = `${method} ${path}`;
  if (!(key in responses)) return new Response(JSON.stringify({ code: 'rest_no_route', message: 'No route' }), { status: 404 });
  return new Response(JSON.stringify(responses[key]), { status: 200 });
};

const { createAkphDataSource } = await import('../src/api/akph');
const { parseEntry, parseAccounts } = await import('../src/api/akph/mapping');
const { appReducer } = await import('../src/store/AppStore');
const { isoToJalali, jalaliToIso } = await import('../src/utils/jalali');

// ---------------------------------------------------------------- Jalali ↔ ISO (same algorithm as the server)
const fa = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
for (let d = Date.UTC(2015, 0, 1); d <= Date.UTC(2032, 11, 31); d += 86_400_000) {
  const iso = new Date(d).toISOString().slice(0, 10);
  const parts = Object.fromEntries(fa.formatToParts(new Date(d + 43_200_000)).map((p) => [p.type, p.value]));
  const expected = `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}`;
  const got = isoToJalali(iso).replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
  assert.equal(got, expected, iso);
  assert.equal(jalaliToIso(got), iso);
}
assert.equal(jalaliToIso('۱۴۰۴/۱۲/۳۰'), null, '1404 has no Esfand 30');
assert.equal(jalaliToIso('1403/12/30'), '2025-03-20');
console.log('  ✔ تبدیل شمسی ↔ میلادی با تقویم مرورگر برای ۱۸ سال یکسان است');

// ---------------------------------------------------------------- reading
const source = createAkphDataSource();
assert.equal(source.kind, 'akph');
const session = await source.loadSession();
assert.equal(session.user.role, 'حسابدار');
assert.equal(session.user.id, '7');
assert.equal(session.user.projectIds, undefined, 'view-all roles are not scoped');
assert.equal(session.currency, 'rial');
assert.equal(session.company.name, 'شرکت آزمون');
const state = await source.loadState(session);
assert.equal(state.projects[0].status, 'تجهیز کارگاه');
assert.equal(state.projects[0].startDate, '۱۴۰۵/۰۱/۱۵', 'ISO dates become Jalali');
assert.equal(state.projects[0].manualSummary?.revenue, 125_000_000_000, 'amounts stay integer Rials');
assert.equal(state.projects[0].recordedRevenue, 0, 'ledger figures are never taken from the project record');
assert.deepEqual(state.projects[0].costCenterIds, ['8']);
assert.deepEqual(state.projects[0].editableGroups, ['financial']);
assert.equal(state.chartOfAccounts.length, 1);
assert.equal(state.chartOfAccounts[0].children?.[0].children?.[0].children?.length, 2, 'flat accounts become the tree');
const [posted, pending] = state.journalEntries;
assert.equal(posted.status, 'تأیید شده');
assert.equal(posted.date, '۱۴۰۵/۰۱/۱۰');
assert.equal(posted.totalDebit, 150);
assert.equal(posted.rows[0].accountName, 'حقوق ستاد');
assert.equal(posted.rows[0].costCenterName, 'کارگاه');
assert.equal(posted.rows[1].subledgerCode, '3');
assert.equal(pending.status, 'در انتظار تأیید');
assert.equal(pending.docNumber, 'DRF-1405-00002');
assert.equal(state.subledgers[0].id, '3', 'counterparties are offered as subledgers');
assert.deepEqual(state.financeSettings.closedFiscalYears, [1403]);
assert.ok(!('saveChanges' in source) || source.saveChanges === undefined, 'no generic record write');
assert.ok(calls.every((c) => c.headers['X-WP-Nonce'] === 'nonce-1'), 'every request carries the nonce');
assert.ok(calls.find((c) => c.url === 'journal-entries')!.query.includes('per_page=500'), 'query joined with & under plain permalinks');
console.log('  ✔ نشست از /me، پروژه‌ها، مراکز هزینه، طرف‌های حساب، کدینگ و اسناد از akph/v1 خوانده شد');

// ---------------------------------------------------------------- commands
const commands = source.commands!;
for (const a of ['createManualJournalEntry', 'submitManualJournalEntryForm', 'approveJournalEntryLogged', 'rejectJournalEntryLogged', 'reverseJournalEntryLogged', 'createProject', 'updateProject', 'createCostCenter', 'createCounterparty', 'createAccount']) {
  assert.equal(commands.supports(a), true, a);
}
for (const a of ['approveVendorInvoice', 'executePayment', 'closeFiscalYearLogged', 'createClientContract']) assert.equal(commands.supports(a), false, a);
console.log('  ✔ فرمان‌های این مرحله پشتیبانی می‌شوند؛ بقیه «فقط خواندنی — به‌زودی»');

const draft = await commands.run('createManualJournalEntry', [{
  id: 'local', docNumber: 'LOCAL-1', date: '۱۴۰۵/۰۲/۰۱', title: 'دستی', type: 'پرداخت', submitter: 'x', status: 'تأیید شده',
  rows: [
    { id: 'r1', accountCode: '61101', accountName: '', description: '', debit: 15, credit: 0, projectId: '5', costCenterId: '8' },
    { id: 'r2', accountCode: '61101', accountName: '', description: '', debit: 15, credit: 0 },
    { id: 'r3', accountCode: '11101', accountName: '', description: '', debit: 0, credit: 30, subledgerCode: '3' },
  ],
  totalDebit: 30, totalCredit: 30, isBalanced: true, history: [],
}], state);
const create = calls.find((c) => c.method === 'POST' && c.url === 'journal-entries')!;
assert.match(create.headers['Idempotency-Key'], /^[0-9a-f-]{36}$/, 'Idempotency-Key header');
const body = create.body as Record<string, unknown>;
for (const k of ['id', 'status', 'doc_number', 'docNumber', 'draft_number', 'total', 'totalDebit', 'submitter', 'version']) assert.ok(!(k in body), `draft body must not carry ${k}`);
assert.equal(body.date, '2026-04-21', 'Jalali form date → ISO');
assert.equal(body.entry_type, 'payment');
const lines = body.lines as { debit: number; credit: number; cost_center_id: string | null; counterparty_id: string | null }[];
assert.deepEqual(lines.map((l) => l.debit), [15, 15, 0], 'Rials sent unchanged, row by row');
assert.equal(lines[0].cost_center_id, '8');
assert.equal(lines[2].counterparty_id, '3');
assert.equal(draft.records[0].slice, 'journalEntries');
assert.equal(draft.docNumber, 'DRF-1405-00003');
console.log('  ✔ سند دستی فقط به‌صورت ورودی کاربر و با Idempotency-Key ارسال شد؛ شماره، وضعیت و جمع‌ها را سرور داد');

const merged = appReducer(state, { type: 'MERGE_SERVER_RECORDS', records: draft.records });
assert.equal(merged.journalEntries[0].id, '13');
await commands.run('approveJournalEntryLogged', ['12'], merged);
const postCall = calls.find((c) => c.url === 'journal-entries/12/post')!;
assert.equal(postCall.headers['If-Match'], '"1"', 'If-Match carries the record version');
assert.deepEqual(postCall.body, { version: 1 });
console.log('  ✔ قطعی‌کردن با version و If-Match نسخه رکورد');

await commands.run('updateProject', ['5', { physicalProgress: 40, startDate: '۱۴۰۵/۰۲/۰۱', manualRevenue: 7 }], state);
const upd = calls.find((c) => c.url === 'projects/5')!;
assert.deepEqual(upd.body, { physical_progress: 40, start_date: '2026-04-21', manual_revenue: 7, version: 3 }, 'only the changed fields, with the version');
console.log('  ✔ ویرایش پروژه فقط فیلدهای تغییرکرده را با نسخه رکورد می‌فرستد');

const replaced = appReducer(state, { type: 'MERGE_SERVER_RECORDS', records: [{ slice: 'chartOfAccounts', replace: parseAccounts(responses['GET accounts']) }] });
assert.equal(replaced.chartOfAccounts[0].code, '1');

// ---------------------------------------------------------------- strict parsing
const look = { chart: [], projects: [], costCenters: [], counterparties: [] };
assert.throws(() => parseEntry(entry({ status: 'weird' }), look), /status/);
assert.throws(() => parseEntry(entry({ total: 1.5 }), look), /ریال/);
assert.throws(() => parseEntry(entry({ date: '1405/01/01' }), look), /تاریخ/);
console.log('  ✔ قالب نامنتظر پاسخ سرور با پیام روشن رد می‌شود');

console.log('\nقرارداد API سرور akph/v1: همه آزمون‌ها موفق.');
