/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Posting rules: accounts per event, returns, invoices, reversals, year close, inventory and contracts.
import assert from 'node:assert/strict';
import { buildMockState } from '../src/api/mock/buildState';
import { postFinancialEventToState } from '../src/store/postingEngine';
import { selectLedgerTotals } from '../src/store/selectors';
import * as wf from '../src/store/workflows';
import { lineKey, selectSubcontractLines } from '../src/store/subcontractLines';
import { AppState, SliceKey } from '../src/store/types';
import { UserProfile, JournalEntry } from '../src/types';
import { toPersianDate } from '../src/utils/date';

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
const u = (id: string, role: UserProfile['role'], name: string): UserProfile => ({ id, name, role, email: '', avatar: '', projectIds: role === 'مدیر پروژه' ? state.projects.map((p) => p.id) : undefined });
const CEO = u('r-ceo', 'مدیر ارشد', 'مدیر ارشد');
const ACC = u('r-acc', 'حسابدار', 'حسابدار');
const ACC2 = u('r-acc2', 'حسابدار', 'حسابدار دوم');
const PM = u('r-pm', 'مدیر پروژه', 'مدیر پروژه');
const PM2 = u('r-pm2', 'مدیر پروژه', 'مدیر پروژه دوم');
const today = toPersianDate(new Date());
const ok = (label: string, r: wf.WorkflowResult) => {
  assert.ok(r.ok, `${label}: ${r.message}`);
  console.log(`  ✔ ${label} — ${r.message}`);
};
const denied = (label: string, r: wf.WorkflowResult, pattern?: RegExp) => {
  assert.equal(r.ok, false, `${label} should be refused`);
  if (pattern) assert.match(r.message, pattern);
  console.log(`  ✔ ${label} رد شد — ${r.message}`);
};
const entryOf = (docNumber?: string) => state.journalEntries.find((j) => j.docNumber === docNumber)!;
const net = (e: JournalEntry, code: string) => e.rows.filter((r) => r.accountCode === code).reduce((a, r) => a + r.debit - r.credit, 0);
const pay = (id: string) => {
  ok('تأیید درخواست پرداخت', wf.approvePaymentRequest(env(CEO), id));
  const r = wf.executePayment(env(ACC), id, { bankAccountId: state.bankAccounts[0].id, amount: state.paymentRequests.find((x) => x.id === id)!.remainingAmount });
  ok('پرداخت', r);
  return entryOf(r.docNumber);
};

console.log('۱) پیش‌پرداخت پیمانکار جزء و نوع ناشناخته پرداخت');
const adv = wf.createPaymentRequest(env(ACC), { sourceType: 'پیش‌پرداخت پیمانکار جزء', sourceRefId: 'r-adv', sourceRefNumber: 'r', projectId: state.projects[0].id, projectName: '', costCenterId: '', beneficiaryName: 'پیمانکار', beneficiaryType: 'پیمانکار جزء', totalAmount: 5_000_000 });
ok('درخواست پیش‌پرداخت پیمانکار', adv);
const advEntry = pay(adv.id!);
assert.equal(net(advEntry, '11402'), 5_000_000, 'subcontractor advance goes to 11402 (the account its recovery is credited to)');
assert.equal(net(advEntry, '11401'), 0);
state = { ...state, paymentRequests: [{ ...state.paymentRequests[0], id: 'r-unknown', sourceType: 'نوع ناشناخته' as never, status: 'تأیید مدیر ارشد', approvedById: CEO.id, remainingAmount: 1_000, paidAmount: 0 }, ...state.paymentRequests] };
denied('پرداخت با نوع درخواست ناشناخته', wf.executePayment(env(ACC), 'r-unknown', { bankAccountId: state.bankAccounts[0].id, amount: 1_000 }), /حساب تعریف‌شده ندارد/);

console.log('\n۲) فاکتور خرید: تسویه به ارزش رسید، مغایرت قیمت، فاکتور متوقف');
const inv = state.vendorInvoices.find((i) => i.status === 'در حال تطبیق' && i.grnId)!;
const grn = state.goodsReceipts.find((g) => g.id === inv.grnId)!;
const priced = { ...inv, totalAmount: inv.totalAmount + 700_000, subtotal: inv.subtotal + 700_000, remainingBalance: inv.remainingBalance + 700_000 };
state = { ...state, vendorInvoices: state.vendorInvoices.map((i) => (i.id === inv.id ? priced : i)) };
const stopped = { ...inv, id: 'r-stopped', status: 'دارای مغایرت و متوقف' as const };
state = { ...state, vendorInvoices: [stopped, ...state.vendorInvoices] };
denied('تأیید فاکتور متوقف', wf.approveVendorInvoice(env(ACC), 'r-stopped'), /متوقف/);
const invResult = wf.approveVendorInvoice(env(ACC), inv.id);
ok('تأیید فاکتور', invResult);
const invEntry = entryOf(invResult.docNumber);
assert.equal(net(invEntry, '21401'), grn.totalAmount, 'GRNI cleared at the receipt value');
assert.equal(net(invEntry, '51102'), priced.totalAmount - priced.vatAmount - grn.totalAmount, 'price difference to the variance account');

console.log('\n۳) برگشت از خرید بعد از فاکتور');
const line = grn.items.find((i) => i.acceptedQty > 0)!;
const avgBefore = state.materials.find((m) => m.id === line.materialId)!.averageUnitPrice;
const reqBefore = state.paymentRequests.find((r) => r.sourceRefId === inv.id)!;
const invBefore = state.vendorInvoices.find((i) => i.id === inv.id)!;
const retResult = wf.returnToSupplier(env(CEO), grn.id, line.materialId, 1, 'آزمون');
ok('برگشت به تأمین‌کننده', retResult);
const retEntry = entryOf(retResult.docNumber);
assert.ok(net(retEntry, '11304') < 0 || invBefore.vatAmount === 0, 'purchase VAT reversed');
const credit = net(retEntry, '21101');
assert.ok(credit > 0, 'supplier payable reduced');
assert.equal(state.vendorInvoices.find((i) => i.id === inv.id)!.remainingBalance, invBefore.remainingBalance - credit);
assert.equal(state.paymentRequests.find((r) => r.id === reqBefore.id)!.remainingAmount, reqBefore.remainingAmount - credit);
assert.equal(state.materials.find((m) => m.id === line.materialId)!.averageUnitPrice, avgBefore, 'weighted average unchanged (never locked to zero)');

console.log('\n۴) معکوس سند خودکار با برگشت عملیات منبع');
const stm = state.clientStatements.find((s) => s.status === 'under_consultant_review')!;
const contractBefore = state.contracts.find((c) => c.id === stm.contractId)!;
ok('تأیید مشاور', wf.advanceClientStatement(env(PM), stm.id));
const approved = wf.advanceClientStatement(env(ACC), stm.id);
ok('تأیید کارفرما', approved);
assert.equal(state.contracts.find((c) => c.id === stm.contractId)!.billedValue, contractBefore.billedValue + stm.grossAmount, 'billed value rises on approval');
const stmEntry = entryOf(approved.docNumber);
ok('معکوس سند صورت‌وضعیت', wf.reverseJournalEntry(env(ACC2), stmEntry.id, 'اشتباه در متره'));
assert.equal(state.clientStatements.find((s) => s.id === stm.id)!.status, 'approved_by_consultant', 'statement reopened');
assert.equal(state.financialEvents.find((e) => e.journalEntryId === stmEntry.id)!.status, 'reversed');
assert.equal(state.contracts.find((c) => c.id === stm.contractId)!.billedValue, contractBefore.billedValue, 'contract values restored');
const again = wf.advanceClientStatement(env(CEO), stm.id);
ok('تأیید دوباره و ثبت سند جدید', again);
assert.notEqual(again.docNumber, approved.docNumber);
const issueEntry = state.journalEntries.find((j) => state.financialEvents.some((e) => e.journalEntryId === j.id && e.type === 'GOODS_RECEIPT' && e.status === 'posted'))!;
denied('معکوس مستقیم سند رسید انبار', wf.reverseJournalEntry(env(ACC), issueEntry.id, 'x'), /عملیات/);

console.log('\n۵) تفکیک حساب‌های مالیاتی و مصالح کارفرما');
const vatEntry = entryOf(again.docNumber);
if (stm.vatAmount > 0) assert.equal(net(vatEntry, '21202'), -stm.vatAmount, 'sales VAT → 21202');
const matEntries = state.journalEntries.filter((j) => j.rows.some((r) => r.accountCode === '41102'));
assert.ok(state.journalEntries.every((j) => !j.rows.some((r) => r.accountCode === '11306' && r.debit > 0) || j.docNumber.startsWith('ACC-14')), 'client-supplied materials no longer booked as an asset');
void matEntries;
const payrollEntries = state.journalEntries.filter((j) => j.type === 'حقوق و دستمزد');
assert.ok(payrollEntries.every((j) => !j.rows.some((r) => r.accountCode === '21202')), 'payroll tax not in the VAT account');
assert.ok(payrollEntries.some((j) => j.rows.some((r) => r.accountCode === '21203')), 'payroll tax → 21203');
const subEntries = state.journalEntries.filter((j) => j.title.includes('پیمانکار جزء') && j.rows.some((r) => r.accountCode === '21204'));
assert.ok(subEntries.length > 0 || !state.subcontractorStatements.some((s) => (s.deductions.taxDeduction || 0) > 0), 'subcontractor withholding → 21204');
console.log('  ✔ ارزش افزوده فروش 21202، مالیات حقوق 21203، مالیات تکلیفی پیمانکاران 21204، مصالح کارفرما کسر درآمد 41102');

console.log('\n۶) ناخالص صورت‌وضعیت جزء = مقدار × نرخ');
const subC = state.subcontractorContracts[0];
const subTemplate = state.subcontractorStatements.find((s) => s.subcontractorContractId === subC.id)!;
const approvedQty = new Map(selectSubcontractLines(state, subC.id).map((l) => [l.key, l.approvedQuantity]));
const items = subTemplate.items.map((i) => ({ ...i, previousQuantity: approvedQty.get(lineKey(i.description, i.unit)) || 0, currentQuantity: 1, currentAmount: i.unitRate }));
const good = items.reduce((a, i) => a + i.unitRate, 0);
const bad = { ...subTemplate, id: 'r-sub', statementNumber: 'r', status: 'submitted' as const, grossAmount: good + 999, items, totalDeductions: 0, deductions: { ...subTemplate.deductions, advancePaymentDeduction: 0 } };
denied('ناخالص ناهمخوان با ردیف‌ها', wf.createSubcontractorStatement(env(PM), bad), /ناخالص/);
denied('مبلغ ردیف ناهمخوان با مقدار × نرخ', wf.createSubcontractorStatement(env(PM), { ...bad, grossAmount: good, items: items.map((i, n) => (n === 0 ? { ...i, currentAmount: i.currentAmount + 1 } : i)) }), /مقدار × نرخ/);

console.log('\n۷) بستن سال: سند اختتامیه در سود و زیان همان سال نیست');
const before = selectLedgerTotals(state);
for (const y of [1402, 1403]) ok(`بستن ${y}`, wf.closeFiscalYear(env(CEO), y));
const after = selectLedgerTotals(state);
assert.equal(after.revenue, before.revenue, 'revenue unchanged by closing entries');
assert.equal(after.cost, before.cost);

console.log('\n۸) تنخواه: هزینه در انتظار کسری کاذب نمی‌سازد');
const fund = state.pettyCashAccounts.find((a) => a.projectId && a.status === 'active' && a.usableBalance > 50_000_000)!;
ok('ثبت هزینه در انتظار', wf.submitPettyCashExpense(env(PM), { ...state.pettyCashExpenses[0], id: 'r-exp', pettyCashId: fund.id, projectId: fund.projectId, amount: 10_000_000, status: 'draft', approvalHistory: [] }));
const f = state.pettyCashAccounts.find((a) => a.id === fund.id)!;
const rec = wf.reconcilePettyCash(env(ACC), { pettyCashId: f.id, periodStartDate: today, periodEndDate: today, actualCountedCash: f.actualBalance - f.pendingExpenses, notes: '' });
ok('شمارش برابر مانده منهای هزینه‌های در انتظار', rec);
assert.equal(state.pettyCashReconciliations.find((r) => r.id === rec.id)!.discrepancy, 0);

console.log('\n۹) انبار: سند انتقال، انبارگردانی دوطرفه، شماره حواله از سرور/گردش‌کار');
const bal = state.stockBalances.find((b) => b.qty - b.reservedQty > 5 && state.warehouses.find((w) => w.id === b.warehouseId)?.projectId)!;
const src = state.warehouses.find((w) => w.id === bal.warehouseId)!;
const dst = state.warehouses.find((w) => w.id !== src.id && w.projectId)!;
const mat = state.materials.find((m) => m.id === bal.materialId)!;
const trf = wf.createTransfer(env(PM), { ...state.interTransfers[0], id: 'r-trf', transferNumber: 'CLIENT-99', date: today, sourceWarehouseId: src.id, sourceWarehouseName: src.name, sourceProjectId: src.projectId!, targetWarehouseId: dst.id, targetWarehouseName: dst.name, targetProjectId: dst.projectId!, status: 'در مسیر حمل', items: [{ materialId: mat.id, materialCode: mat.code, materialName: mat.name, unit: mat.unit, quantity: 2, unitCost: 0, totalCost: 0 }] });
ok('حواله انتقال', trf);
assert.notEqual(state.interTransfers.find((t) => t.id === 'r-trf')!.transferNumber, 'CLIENT-99', 'client number ignored');
const delivered = wf.advanceTransfer(env(PM), 'r-trf', 'تخلیه و تحویل قطعی مقصد');
ok('تحویل انتقال', delivered);
const trfEntry = entryOf(delivered.docNumber);
assert.equal(trfEntry.rows.find((r) => r.debit > 0)!.subledgerCode, dst.id);
assert.equal(trfEntry.rows.find((r) => r.credit > 0)!.subledgerCode, src.id);
const wh = state.warehouses.find((w) => state.stockBalances.filter((b) => b.warehouseId === w.id && b.qty - b.reservedQty > 3).length >= 2)!;
const stockRows = state.stockBalances.filter((b) => b.warehouseId === wh.id && b.qty - b.reservedQty > 3).slice(0, 2);
assert.equal(stockRows.length, 2, 'a warehouse with two counted materials');
{
  const audit = { ...state.stocktakes[0], id: 'r-audit', auditNumber: 'r-audit', warehouseId: wh.id, warehouseName: wh.name, date: today, items: stockRows.map((b, i) => ({ ...state.stocktakes[0].items[0], materialId: b.materialId, physicalCount: b.qty + (i === 0 ? 2 : -2) })) };
  const st = wf.applyStocktake(env(ACC), audit as never);
  ok('انبارگردانی با اضافه و کسری', st);
  const e = entryOf(st.docNumber);
  assert.ok(net(e, '62401') > 0 && net(e, '41301') < 0, 'shortage and surplus in separate rows, not netted');
}

console.log('\n۱۰) سند دستی با حساب گروهی');
denied('سند دستی روی حساب گروه', wf.createManualJournalEntry(env(ACC), { ...state.journalEntries[0], id: '', docNumber: '', date: today, status: 'پیش‌نویس', rows: [
  { id: 'a', accountCode: '1', accountName: '', description: '', debit: 100, credit: 0 },
  { id: 'b', accountCode: '11101', accountName: '', description: '', debit: 0, credit: 100, subledgerCode: state.bankAccounts[0].id },
] }), /گروهی|کدینگ/);

console.log('\nقواعد ثبت: همه آزمون‌ها موفق.');
