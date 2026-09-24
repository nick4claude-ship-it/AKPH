/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Workflow scenarios over the central store (no UI): run with `npm run test:workflows`.
 */

import assert from 'node:assert/strict';
import { buildInitialState } from '../src/store/initialState';
import { postFinancialEventToState } from '../src/store/postingEngine';
import { selectProjectFinancials } from '../src/store/selectors';
import { selectApprovals, selectMaterials, availableQtyOf } from './helpers';
import * as wf from '../src/store/workflows';
import { AppState, SliceKey } from '../src/store/types';
import { UserProfile, StoreIssueVoucher } from '../src/types';

let state: AppState = buildInitialState();
const user = (role: UserProfile['role'], name: string = role): UserProfile => ({ id: role, name, role, email: '', avatar: '' });
const env = (u: UserProfile): wf.WorkflowEnv => ({
  getState: () => state,
  set: (key: SliceKey, updater: any) => {
    state = { ...state, [key]: typeof updater === 'function' ? updater(state[key]) : updater };
  },
  post: (input, options) => {
    const { state: next, result } = postFinancialEventToState(state, input, options);
    state = next;
    return result;
  },
  user: u,
});
const CEO = user('مدیرعامل', 'مدیرعامل آزمون');
const FIN = user('مدیر مالی', 'مدیر مالی آزمون');
const PM = user('مدیر پروژه', 'مدیر پروژه آزمون');
const SITE = user('سرپرست کارگاه', 'سرپرست آزمون');
const fa = (n: number) => n.toLocaleString('en-US');
const ok = (label: string, r: wf.WorkflowResult) => {
  assert.ok(r.ok, `${label}: ${r.message}`);
  console.log(`  ✔ ${label} — ${r.message}`);
};
const denied = (label: string, r: wf.WorkflowResult) => {
  assert.equal(r.ok, false, `${label} should be refused`);
  console.log(`  ✔ ${label} رد شد — ${r.message}`);
};
const ledgerNet = (code: string, filter: (r: any) => boolean = () => true) =>
  state.journalEntries.flatMap((e) => e.rows).filter((r) => r.accountCode === code && filter(r)).reduce((a, r) => a + r.debit - r.credit, 0);

// ---------------------------------------------------------------------------
console.log('\n۱) صورت‌وضعیت کارفرما: تأیید مشاور ← تأیید کارفرما ← مطالبات ← دریافت');
const stm = state.clientStatements.find((s) => s.status === 'under_consultant_review')!;
const receivableBefore = selectProjectFinancials(state, stm.projectId).receivables;
denied('تأیید مشاور توسط سرپرست کارگاه', wf.advanceClientStatement(env(SITE), stm.id));
ok('تأیید مشاور', wf.advanceClientStatement(env(PM), stm.id));
assert.ok(selectApprovals(state).some((a) => a.recordId === stm.id && a.stage === 'تأیید کارفرما'));
ok('تأیید کارفرما', wf.advanceClientStatement(env(FIN), stm.id));
const approved = state.clientStatements.find((s) => s.id === stm.id)!;
assert.equal(approved.status, 'approved_by_employer');
assert.ok(approved.accountingJournalEntryId, 'receivable posted');
const receivableAfter = selectProjectFinancials(state, stm.projectId).receivables;
assert.equal(receivableAfter - receivableBefore, stm.netPayable, 'receivable grows by the net amount');
console.log(`    مطالبات پروژه: ${fa(receivableBefore)} ← ${fa(receivableAfter)}`);

const bank = state.bankAccounts[0];
denied('دریافت بیش از مانده', wf.recordReceipt(env(FIN), { sourceType: 'صورت‌وضعیت کارفرما', statementId: stm.id, amount: stm.netPayable + 1, bankAccountId: bank.id, method: 'حواله بانکی', trackingNumber: 'T1' }));
denied('دریافت بدون انتخاب بانک', wf.recordReceipt(env(FIN), { sourceType: 'صورت‌وضعیت کارفرما', statementId: stm.id, amount: 1000, bankAccountId: '', method: 'حواله بانکی', trackingNumber: 'T1' }));
const partial = Math.round(stm.netPayable / 2);
ok('دریافت جزئی با ارجاع statementId', wf.recordReceipt(env(FIN), { sourceType: 'صورت‌وضعیت کارفرما', statementId: stm.id, amount: partial, bankAccountId: bank.id, method: 'حواله بانکی', trackingNumber: 'SAT-1' }));
const afterReceipt = state.clientStatements.find((s) => s.id === stm.id)!;
assert.equal(afterReceipt.remainingPayable, stm.netPayable - partial);
assert.equal(afterReceipt.status, 'partially_paid');
assert.equal(state.bankAccounts[0].balance, bank.balance + partial, 'bank balance grows only through the receipt entry');
assert.ok(state.receipts.some((r) => r.statementId === stm.id && r.amount === partial));

// ---------------------------------------------------------------------------
console.log('\n۲) صورت‌وضعیت جزء: تأیید مالی ← تأیید مدیرعامل ← بدهی و درخواست پرداخت ← پرداخت در خزانه');
const sub = state.subcontractorStatements.find((s) => s.status === 'pm_approved')!;
const costBefore = selectProjectFinancials(state, sub.projectId).actualCost;
ok('تأیید مالی', wf.advanceSubcontractorStatement(env(FIN), sub.id));
denied('تأیید مدیرعامل توسط مدیر مالی', wf.advanceSubcontractorStatement(env(FIN), sub.id));
ok('تأیید مدیرعامل', wf.advanceSubcontractorStatement(env(CEO), sub.id));
const gross = sub.netPayable + sub.totalDeductions;
assert.equal(selectProjectFinancials(state, sub.projectId).actualCost - costBefore, gross, 'project cost recognised at approval');
const req = state.paymentRequests.find((r) => r.sourceRefId === sub.id)!;
assert.ok(req, 'payment request created');
assert.equal(req.status, 'تأیید مدیرعامل');
assert.equal(req.remainingAmount, sub.netPayable);

const desk = state.cashDesks[0];
denied('پرداخت از صندوق با موجودی ناکافی', wf.executePayment(env(FIN), req.id, { cashDeskId: desk.id, amount: req.remainingAmount }));
denied('پرداخت بدون انتخاب حساب', wf.executePayment(env(FIN), req.id, { amount: 1000 }));
const bankBefore = state.bankAccounts[0].balance;
ok('پرداخت اول (جزئی)', wf.executePayment(env(FIN), req.id, { bankAccountId: state.bankAccounts[0].id, amount: 100_000_000 }));
ok('پرداخت مانده', wf.executePayment(env(FIN), req.id, { bankAccountId: state.bankAccounts[0].id, amount: sub.netPayable - 100_000_000 }));
const paidSub = state.subcontractorStatements.find((s) => s.id === sub.id)!;
assert.equal(paidSub.status, 'paid');
assert.equal(paidSub.remainingPayable, 0);
assert.equal(state.paymentRequests.find((r) => r.id === req.id)!.status, 'پرداخت شده');
assert.equal(state.bankAccounts[0].balance, bankBefore - sub.netPayable);
assert.equal(selectProjectFinancials(state, sub.projectId).actualCost - costBefore, gross, 'payment does not add project cost');
assert.equal(ledgerNet('21102', (r) => r.subledgerCode === sub.counterpartyId && r.projectId === sub.projectId) <= 0, true);

// ---------------------------------------------------------------------------
console.log('\n۳) تنخواه: سطح تأیید از تنظیمات ذخیره‌شده و تأیید مرحله‌ای');
const fund = state.pettyCashAccounts.find((a) => a.id === 'pc-101-pm')!;
const amount = 30_000_000; // between siteLevelMax and projectLevelMax
const expense = { ...state.pettyCashExpenses[0], id: 'exp-test', expenseNumber: 'EXP-T', pettyCashId: fund.id, projectId: fund.projectId, amount, status: 'draft' as const, approvalHistory: [] };
ok('ثبت هزینه', wf.submitPettyCashExpense(env(PM), expense));
const saved = state.pettyCashExpenses.find((e) => e.id === 'exp-test')!;
assert.equal(saved.approvalLevelRequired, 'project_and_finance');
assert.equal(saved.currentApprovalStep, 'مدیر پروژه');
denied('تأیید توسط سرپرست کارگاه', wf.approvePettyCashExpense(env(SITE), 'exp-test'));
ok('تأیید مدیر پروژه', wf.approvePettyCashExpense(env(PM), 'exp-test'));
assert.equal(state.pettyCashExpenses.find((e) => e.id === 'exp-test')!.currentApprovalStep, 'مدیر مالی');
const fundBefore = state.pettyCashAccounts.find((a) => a.id === fund.id)!.actualBalance;
ok('تأیید مدیر مالی و ثبت سند', wf.approvePettyCashExpense(env(FIN), 'exp-test'));
assert.equal(state.pettyCashAccounts.find((a) => a.id === fund.id)!.actualBalance, fundBefore - amount);
denied('هزینه بیش از سقف هر هزینه', wf.submitPettyCashExpense(env(PM), { ...expense, id: 'exp-big', amount: 150_000_000 }));
ok('درخواست شارژ ← خزانه', wf.requestPettyCashReplenishment(env(SITE), fund.id, 20_000_000, 'آزمون'));
const pettyReq = state.paymentRequests.find((r) => r.sourceType === 'شارژ و تسویه تنخواه' && r.projectId === fund.projectId && r.totalAmount === 20_000_000)!;
ok('تأیید درخواست پرداخت', wf.approvePaymentRequest(env(CEO), pettyReq.id));
const fundBeforeCharge = state.pettyCashAccounts.find((a) => a.id === fund.id)!.actualBalance;
ok('پرداخت شارژ در خزانه', wf.executePayment(env(FIN), pettyReq.id, { bankAccountId: state.bankAccounts[0].id, amount: 20_000_000 }));
assert.equal(state.pettyCashAccounts.find((a) => a.id === fund.id)!.actualBalance, fundBeforeCharge + 20_000_000);

// ---------------------------------------------------------------------------
console.log('\n۴) انبار: رزرو، خروج به میانگین موزون، برگشت از پروژه');
const bal = state.stockBalances.find((b) => b.qty > 100)!;
const material = selectMaterials(state).find((m) => m.id === bal.materialId)!;
const warehouse = state.warehouses.find((w) => w.id === bal.warehouseId)!;
const issue: StoreIssueVoucher = {
  id: 'siv-test', issueNumber: 'SIV-T', date: '۱۴۰۳/۰۷/۱۰', warehouseId: warehouse.id, warehouseName: warehouse.name,
  projectId: 'prj-101', projectName: '', costCenterId: 'cc-prj101-01', costCenter: '', wbsSection: '-', isSubcontractorContra: false,
  applicantName: '-', approvedByManagerName: '-', dispatchedByKeeperName: '-', receivedByCrewLeaderName: '-',
  items: [{ materialId: material.id, materialCode: material.code, materialName: material.name, unit: material.unit, requestedQty: 50, issuedQty: 50, unitCost: 0, totalCost: 0 }],
  totalCost: 0, status: 'درخواست اولیه',
};
const freeBefore = availableQtyOf(state, warehouse.id, material.id);
ok('درخواست حواله و رزرو', wf.requestStoreIssue(env(SITE), issue));
assert.equal(availableQtyOf(state, warehouse.id, material.id), freeBefore - 50, 'reserved qty is not available');
const projCost0 = selectProjectFinancials(state, 'prj-101').actualCost;
ok('تأیید خروج', wf.confirmStoreIssue(env(SITE), 'siv-test'));
const issueCost = state.storeIssues.find((v) => v.id === 'siv-test')!.totalCost;
assert.equal(issueCost, Math.round(50 * material.averageUnitPrice));
assert.equal(selectProjectFinancials(state, 'prj-101').actualCost - projCost0, issueCost);
ok('برگشت ۲۰ واحد از پروژه', wf.returnFromProject(env(SITE), 'siv-test', material.id, 20, 'مازاد'));
assert.equal(selectProjectFinancials(state, 'prj-101').actualCost - projCost0, issueCost - Math.round(20 * material.averageUnitPrice));
denied('برگشت بیش از مقدار حواله', wf.returnFromProject(env(SITE), 'siv-test', material.id, 31, 'x'));

// ---------------------------------------------------------------------------
console.log('\n۵) توازن کل دفاتر');
const debit = state.journalEntries.reduce((a, e) => a + e.totalDebit, 0);
const credit = state.journalEntries.reduce((a, e) => a + e.totalCredit, 0);
assert.equal(debit, credit);
for (const e of state.journalEntries) assert.equal(e.totalDebit, e.totalCredit, e.docNumber);
console.log(`  ✔ ${state.journalEntries.length} سند، جمع بدهکار ${fa(debit)} = جمع بستانکار ${fa(credit)}`);
console.log(`  ✔ ${selectApprovals(state).length} مورد در کارتابل تأییدات از ${new Set(selectApprovals(state).map((a) => a.module)).size} ماژول`);

console.log('\nهمه سناریوهای گردش‌کار با موفقیت گذشت.');
