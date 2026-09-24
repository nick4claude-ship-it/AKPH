/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Separation of duties (by user id) and project scope.
import assert from 'node:assert/strict';
import { buildMockState } from '../src/api/mock/buildState';
import { createMockDataSource } from '../src/api/mock';
import { postFinancialEventToState, preparePosting } from '../src/store/postingEngine';
import * as wf from '../src/store/workflows';
import { AppState, SliceKey } from '../src/store/types';
import { UserProfile, StoreIssueVoucher } from '../src/types';
import { toPersianDate } from '../src/utils/date';

let state: AppState = buildMockState();
const env = (u: UserProfile): wf.WorkflowEnv => ({
  getState: () => state,
  set: (key: SliceKey, updater: unknown) => {
    state = { ...state, [key]: typeof updater === 'function' ? (updater as (p: unknown) => unknown)(state[key]) : updater };
  },
  post: (input, options) => {
    const { state: next, result } = postFinancialEventToState(state, input, { ...options, actor: u } as never);
    state = next;
    return result;
  },
  user: u,
});
const u = (id: string, role: UserProfile['role'], name: string, projectIds?: string[]): UserProfile => ({ id, name, role, email: '', avatar: '', projectIds });
const ALL = state.projects.map((p) => p.id);
const CEO = u('d-ceo', 'مدیر ارشد', 'مدیر ارشد');
const CEO_TWIN = u('d-ceo-2', 'مدیر ارشد', 'مدیر ارشد'); // same display name, different user
const ACC = u('d-acc', 'حسابدار', 'حسابدار');
const ACC2 = u('d-acc2', 'حسابدار', 'حسابدار دوم');
const PM = u('d-pm', 'مدیر پروژه', 'مدیر پروژه', ALL);
const PM2 = u('d-pm2', 'مدیر پروژه', 'مدیر پروژه دوم', ALL);
const ok = (label: string, r: wf.WorkflowResult) => {
  assert.ok(r.ok, `${label}: ${r.message}`);
  console.log(`  ✔ ${label}`);
};
const denied = (label: string, r: wf.WorkflowResult, pattern?: RegExp) => {
  assert.equal(r.ok, false, `${label} should be refused`);
  if (pattern) assert.match(r.message, pattern);
  console.log(`  ✔ ${label} رد شد — ${r.message}`);
};

console.log('۱) دو مرحله پشت‌سرهم یک سند با یک کاربر');
const sub = state.subcontractorStatements.find((s) => s.status === 'measured') || state.subcontractorStatements.find((s) => s.status === 'submitted')!;
if (sub.status === 'submitted') ok('اندازه‌گیری', wf.advanceSubcontractorStatement(env(PM2), sub.id));
ok('تأیید کارگاه توسط مدیر ارشد', wf.advanceSubcontractorStatement(env(CEO), sub.id));
denied('تأیید مدیر پروژه توسط همان مدیر ارشد', wf.advanceSubcontractorStatement(env(CEO), sub.id), /پشت‌سرهم/);
ok('تأیید مدیر پروژه توسط کاربر همنام ولی متفاوت', wf.advanceSubcontractorStatement(env(CEO_TWIN), sub.id));
denied('تأیید مالی توسط همان کاربر مرحله قبل', wf.advanceSubcontractorStatement(env(CEO_TWIN), sub.id), /پشت‌سرهم/);
ok('تأیید مالی توسط حسابدار', wf.advanceSubcontractorStatement(env(ACC), sub.id));
const h = state.subcontractorStatements.find((s) => s.id === sub.id)!.workflowHistory;
assert.ok(h.slice(-3).every((x) => x.userId), 'history records user ids');

const fund = state.pettyCashAccounts.find((a) => a.projectId && a.status === 'active' && a.usableBalance > 400_000_000)!;
const exp = { ...state.pettyCashExpenses[0], id: 'd-exp', expenseNumber: '', pettyCashId: fund.id, projectId: fund.projectId, amount: 300_000_000, status: 'draft' as const, approvalHistory: [] };
ok('ثبت هزینه تنخواه', wf.submitPettyCashExpense(env(PM), exp));
assert.equal(state.pettyCashExpenses.find((e) => e.id === 'd-exp')!.submitterId, PM.id);
denied('تأیید هزینه توسط ثبت‌کننده', wf.approvePettyCashExpense(env(PM), 'd-exp'), /خودتان/);
ok('تأیید مرحله اول توسط مدیر ارشد', wf.approvePettyCashExpense(env(CEO), 'd-exp'));
denied('تأیید مرحله دوم توسط همان مدیر ارشد', wf.approvePettyCashExpense(env(CEO), 'd-exp'), /پشت‌سرهم/);

const req = state.purchaseRequisitions.find((r) => wf.nextRequisitionStep(r))!;
state = { ...state, purchaseRequisitions: state.purchaseRequisitions.map((r) => (r.id === req.id ? { ...r, requesterId: 'someone', approvals: {} } : r)) };
ok('تأیید کارگاه درخواست خرید', wf.approveRequisition(env(CEO), req.id));
denied('تأیید مرحله بعد درخواست خرید توسط همان کاربر', wf.approveRequisition(env(CEO), req.id), /پشت‌سرهم/);

console.log('\n۲) حواله انبار، فاکتور، حقوق، پرداخت');
const bal = state.stockBalances.find((b) => b.qty - b.reservedQty > 10 && state.warehouses.find((w) => w.id === b.warehouseId)?.projectId)!;
const wh = state.warehouses.find((w) => w.id === bal.warehouseId)!;
const mat = state.materials.find((m) => m.id === bal.materialId)!;
const issue: StoreIssueVoucher = {
  ...state.storeIssues[0], id: 'd-siv', issueNumber: '', date: toPersianDate(new Date()), warehouseId: wh.id, projectId: wh.projectId!,
  status: 'خروج قطعی از انبار',
  items: [{ materialId: mat.id, materialCode: mat.code, materialName: mat.name, unit: mat.unit, requestedQty: 2, issuedQty: 2, unitCost: 0, totalCost: 0 }],
};
ok('درخواست حواله با وضعیت «خروج قطعی»', wf.requestStoreIssue(env(PM), issue));
const saved = state.storeIssues.find((v) => v.id === 'd-siv')!;
assert.notEqual(saved.status, 'خروج قطعی از انبار', 'no automatic confirmation by the requester');
assert.equal(saved.requestedById, PM.id);
denied('تأیید خروج توسط درخواست‌کننده', wf.confirmStoreIssue(env(PM), 'd-siv'), /خودتان/);
ok('تأیید خروج توسط کاربر دیگر', wf.confirmStoreIssue(env(PM2), 'd-siv'));
assert.equal(state.storeIssues.find((v) => v.id === 'd-siv')!.confirmedById, PM2.id);

const inv = state.vendorInvoices.find((i) => i.status === 'در حال تطبیق' && i.grnId)!;
state = { ...state, vendorInvoices: state.vendorInvoices.map((i) => (i.id === inv.id ? { ...i, registeredById: ACC.id } : i)) };
denied('تأیید فاکتور توسط ثبت‌کننده آن', wf.approveVendorInvoice(env(ACC), inv.id), /خودتان/);

const period = 'd-1405/06';
{
  const slip = state.payrollSlips[0];
  state = { ...state, payrollSlips: [{ ...slip, id: 'd-slip', monthYear: period, status: 'محاسبه شده', calculatedById: ACC.id, journalEntryId: undefined, paymentRequestId: undefined }, ...state.payrollSlips] };
  denied('تأیید حقوق توسط محاسبه‌کننده', wf.approvePayrollPeriod(env(ACC), period), /خودتان/);
  ok('تأیید حقوق توسط حسابدار دیگر', wf.approvePayrollPeriod(env(ACC2), period));
  assert.ok(state.payrollSlips.filter((s) => s.monthYear === period).every((s) => s.approvedById === ACC2.id));
}

const pr = wf.createPaymentRequest(env(ACC), { sourceType: 'حق بیمه و مالیات', sourceRefId: 'd-pr', sourceRefNumber: 'd', projectId: '', projectName: '', costCenterId: '', beneficiaryName: 'اداره مالیات', beneficiaryType: 'سازمان امور مالیاتی', taxKind: 'vat', totalAmount: 1_000_000 });
ok('درخواست پرداخت', pr);
denied('تأیید درخواست توسط درخواست‌کننده', wf.approvePaymentRequest(env(ACC), pr.id!), /خودتان/);
ok('تأیید درخواست توسط مدیر ارشد', wf.approvePaymentRequest(env(CEO), pr.id!));
denied('پرداخت توسط تأییدکننده', wf.executePayment(env(CEO), pr.id!, { bankAccountId: state.bankAccounts[0].id, amount: 1_000_000 }), /تأییدکننده/);
ok('پرداخت توسط حسابدار دیگر', wf.executePayment(env(ACC2), pr.id!, { bankAccountId: state.bankAccounts[0].id, amount: 1_000_000 }));

console.log('\n۳) رکورد بدون پروژه برای مدیر پروژه، مغایرت بانکی، موتور ثبت');
const hqWh = state.warehouses.find((w) => !w.projectId);
if (hqWh) {
  denied('انتقال از انبار ستاد توسط مدیر پروژه', wf.createTransfer(env(PM), { ...state.interTransfers[0], id: 'd-trf', transferNumber: '', sourceWarehouseId: hqWh.id, sourceProjectId: '', targetWarehouseId: wh.id, targetProjectId: wh.projectId! }), /ستادی/);
}
const hqFund = state.pettyCashAccounts.find((a) => !a.projectId);
if (hqFund) denied('شارژ تنخواه ستاد توسط مدیر پروژه', wf.requestPettyCashReplenishment(env(PM), hqFund.id, 1_000_000, 'x'), /ستادی/);
denied('سند دستی بدون پروژه توسط مدیر پروژه', wf.createManualJournalEntry(env(PM), { ...state.journalEntries[0], id: '', projectId: undefined, date: toPersianDate(new Date()) }));

const item = state.bankReconciliations.find((r) => !r.matched && r.discrepancyType !== 'سند حسابداری بدون گردش بانکی')!;
const finalBefore = state.journalEntries.filter((j) => j.status !== 'در انتظار تأیید').length;
const rec = wf.reconcileBankItem(env(ACC), item.id);
ok('تطبیق بانکی', rec);
assert.equal(state.journalEntries.filter((j) => j.status !== 'در انتظار تأیید').length, finalBefore, 'no final entry without a second approval');
const pending = state.journalEntries.find((j) => j.docNumber === rec.docNumber)!;
assert.equal(pending.status, 'در انتظار تأیید');
denied('تأیید سند مغایرت توسط همان حسابدار', wf.approveJournalEntry(env(ACC), pending.id));
ok('تأیید سند مغایرت توسط حسابدار دیگر', wf.approveJournalEntry(env(ACC2), pending.id));

const payrollEvent = { type: 'PAYROLL_APPROVED' as const, sourceModule: 'payroll' as const, sourceId: 'x', projectId: '', costCenterId: '', counterpartyId: '', amount: 10, date: toPersianDate(new Date()), details: {} };
const r = preparePosting(state, payrollEvent, { actor: PM });
assert.equal(r.ok, false, 'the engine refuses an event the actor may not produce');
console.log(`  ✔ موتور ثبت رویداد را بدون مجوز کاربر نمی‌پذیرد — ${r.error}`);

const source = createMockDataSource();
const pmSession = await source.loadSession('usr-005');
const scoped = await source.loadState(pmSession);
assert.equal(scoped.bankAccounts.length, 0, 'no bank balances');
assert.equal(scoped.cashDesks.length, 0);
assert.ok(scoped.pettyCashAccounts.every((a) => a.projectId && pmSession.user.projectIds!.includes(a.projectId)), 'no head-office funds');
assert.ok(scoped.warehouses.every((w) => w.projectId), 'no head-office warehouse');
assert.ok(scoped.journalEntries.every((j) => j.projectId), 'no entries without a project');
const balances = (nodes: typeof scoped.chartOfAccounts): number => nodes.reduce((a, n) => a + Math.abs(n.balance) + balances(n.children || []), 0);
assert.equal(balances(scoped.chartOfAccounts), 0, 'chart without company balances');
console.log('  ✔ نمای مدیر پروژه: بدون بانک، صندوق، تنخواه و انبار ستاد، اسناد بدون پروژه و مانده کدینگ');

console.log('\nتفکیک وظایف و دسترسی: همه آزمون‌ها موفق.');
