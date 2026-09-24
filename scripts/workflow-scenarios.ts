/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Workflow scenarios over the central store (no UI): run with `npm run test:workflows`.
 * Amounts are integer Rials (the store's only unit).
 */

import assert from 'node:assert/strict';
import { buildMockState } from '../src/api/mock/buildState';
import { postFinancialEventToState, reversedEntryIds } from '../src/store/postingEngine';
import { selectProjectFinancials } from '../src/store/selectors';
import { selectApprovals, selectMaterials, availableQtyOf } from './helpers';
import * as wf from '../src/store/workflows';
import { AppState, SliceKey } from '../src/store/types';
import { UserProfile, StoreIssueVoucher, InterWarehouseTransfer, StocktakeAudit } from '../src/types';
import { getNextSequentialDocNumber, DOC_SEQUENCE_DIGITS } from '../src/utils/ids';
import { parseIntegerAmount, parseMoneyInput } from '../src/utils/money';
import { toPersianDate } from '../src/utils/date';
import { can } from '../src/utils/permissions';

let state: AppState = buildMockState();
const user = (id: string, role: UserProfile['role'], name: string, projectIds?: string[]): UserProfile => ({ id, name, role, email: '', avatar: '', projectIds });
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
const ALL_PROJECTS = state.projects.map((p) => p.id);
const CEO = user('t-ceo', 'مدیر ارشد', 'مدیر ارشد آزمون');
const ACC = user('t-acc', 'حسابدار', 'حسابدار آزمون');
const PM = user('t-pm', 'مدیر پروژه', 'مدیر پروژه آزمون', ALL_PROJECTS);
const PM_B = user('t-pm3', 'مدیر پروژه', 'مدیر پروژه دوم', ALL_PROJECTS);
const PM_OTHER = user('t-pm2', 'مدیر پروژه', 'مدیر پروژه دیگر', ['prj-105']);
const fa = (n: number) => n.toLocaleString('en-US');
const ok = (label: string, r: wf.WorkflowResult) => {
  assert.ok(r.ok, `${label}: ${r.message}`);
  console.log(`  ✔ ${label} — ${r.message}`);
};
const denied = (label: string, r: wf.WorkflowResult) => {
  assert.equal(r.ok, false, `${label} should be refused`);
  console.log(`  ✔ ${label} رد شد — ${r.message}`);
};
const ledgerNet = (code: string, filter: (r: AppState['journalEntries'][number]['rows'][number]) => boolean = () => true) =>
  state.journalEntries.flatMap((e) => e.rows).filter((r) => r.accountCode === code && filter(r)).reduce((a, r) => a + r.debit - r.credit, 0);

// ---------------------------------------------------------------------------
console.log('\n۰) ورودی عددی، شماره‌گذاری و دسترسی');
assert.equal(parseIntegerAmount('۱۲٬۳۴۵'), 12345);
assert.equal(parseIntegerAmount('-5'), 5);
assert.equal(parseIntegerAmount('abc'), 0);
assert.throws(() => parseIntegerAmount('123456789012345678901'), /بزرگ|safe/i);
assert.equal(parseMoneyInput('۱۰۰۰'), 10_000, 'toman input is stored as rials');
assert.equal(getNextSequentialDocNumber(['ACC-1404-00007', 'ACC-1405-00002'], 'ACC', 1405), 'ACC-1405-00003');
assert.equal(getNextSequentialDocNumber(['ACC-1404-00007'], 'ACC', 1405), `ACC-1405-${'1'.padStart(DOC_SEQUENCE_DIGITS, '0')}`, 'counter restarts every fiscal year');
console.log('  ✔ parseIntegerAmount / شماره سند سال‌به‌سال');
const g = globalThis as unknown as { window?: { PaydarPortal?: { can?: () => boolean } } };
g.window = { PaydarPortal: { can: () => true } };
assert.equal(can(ACC, 'journal.approve', { createdBy: ACC.id }), false, 'self-approval stays forbidden even if WordPress allows everything');
assert.equal(can(ACC, 'journal.approve', { createdBy: 'someone-else' }), true);
assert.equal(can(ACC, 'journal.approve', { createdBy: ACC.name }), true, 'duties compare user ids, not display names');
assert.equal(can(ACC, 'journal.approve', { lastApprovedBy: ACC.id }), false, 'no two consecutive approvals by one user');
assert.equal(can(PM, 'fiscal.close'), false, 'PaydarPortal.can cannot grant what the role matrix denies');
assert.equal(can(ACC, 'payment.execute', { approvedBy: ACC.id }), false, 'payer ≠ approver');
g.window = { PaydarPortal: { can: () => false } };
assert.equal(can(CEO, 'journal.approve', { createdBy: 'x' }), false, 'PaydarPortal.can may restrict');
delete g.window;
assert.equal(can(PM_OTHER, 'sub_statement.pm_approval', { projectId: 'prj-101' }), false, 'project manager limited to own projects');
assert.equal(can(PM, 'inventory.transfer', { projectId: '' }), false, 'a record without a project is outside a project manager scope');
assert.equal(can(PM, 'inventory.transfer'), true, 'capability check without a record');
console.log('  ✔ قاعده «تأییدنکردن سند خود» با PaydarPortal.can قابل لغو نیست؛ مدیر پروژه فقط پروژه خودش');

// ---------------------------------------------------------------------------
console.log('\n۱) صورت‌وضعیت کارفرما: تأیید مشاور ← تأیید کارفرما ← مطالبات ← دریافت');
const stm = state.clientStatements.find((s) => s.status === 'under_consultant_review')!;
const receivableBefore = selectProjectFinancials(state, stm.projectId).receivables;
denied('تأیید مشاور توسط حسابدار', wf.advanceClientStatement(env(ACC), stm.id));
ok('تأیید مشاور', wf.advanceClientStatement(env(PM), stm.id));
assert.ok(selectApprovals(state).some((a) => a.recordId === stm.id && a.stage === 'تأیید کارفرما'));
ok('تأیید کارفرما', wf.advanceClientStatement(env(ACC), stm.id));
const approved = state.clientStatements.find((s) => s.id === stm.id)!;
assert.equal(approved.status, 'approved_by_employer');
assert.ok(approved.accountingJournalEntryId, 'receivable posted');
const receivableAfter = selectProjectFinancials(state, stm.projectId).receivables;
assert.equal(receivableAfter - receivableBefore, stm.netPayable, 'receivable grows by the net amount');
console.log(`    مطالبات پروژه: ${fa(receivableBefore)} ← ${fa(receivableAfter)} ریال`);

const bank = state.bankAccounts[0];
denied('دریافت بیش از مانده', wf.recordReceipt(env(ACC), { sourceType: 'صورت‌وضعیت کارفرما', statementId: stm.id, amount: stm.netPayable + 1, bankAccountId: bank.id, method: 'حواله بانکی', trackingNumber: 'T1' }));
denied('دریافت بدون انتخاب بانک', wf.recordReceipt(env(ACC), { sourceType: 'صورت‌وضعیت کارفرما', statementId: stm.id, amount: 1000, bankAccountId: '', method: 'حواله بانکی', trackingNumber: 'T1' }));
denied('دریافت توسط مدیر پروژه', wf.recordReceipt(env(PM), { sourceType: 'صورت‌وضعیت کارفرما', statementId: stm.id, amount: 1000, bankAccountId: bank.id, method: 'حواله بانکی', trackingNumber: 'T1' }));
const partial = Math.round(stm.netPayable / 2);
ok('دریافت جزئی با ارجاع statementId', wf.recordReceipt(env(ACC), { sourceType: 'صورت‌وضعیت کارفرما', statementId: stm.id, amount: partial, bankAccountId: bank.id, method: 'حواله بانکی', trackingNumber: 'SAT-1' }));
const afterReceipt = state.clientStatements.find((s) => s.id === stm.id)!;
assert.equal(afterReceipt.remainingPayable, stm.netPayable - partial);
assert.equal(afterReceipt.status, 'partially_paid');
assert.equal(state.bankAccounts[0].balance, bank.balance + partial, 'bank balance grows only through the receipt entry');
assert.ok(state.receipts.some((r) => r.statementId === stm.id && r.amount === partial));

// ---------------------------------------------------------------------------
console.log('\n۲) صورت‌وضعیت جزء: تأیید مالی ← تأیید مدیر ارشد ← بدهی و درخواست پرداخت ← پرداخت در خزانه');
const sub = state.subcontractorStatements.find((s) => s.status === 'pm_approved')!;
const costBefore = selectProjectFinancials(state, sub.projectId).actualCost;
denied('تأیید مالی توسط مدیر پروژه', wf.advanceSubcontractorStatement(env(PM), sub.id));
ok('تأیید مالی', wf.advanceSubcontractorStatement(env(ACC), sub.id));
denied('تأیید مدیر ارشد توسط حسابدار', wf.advanceSubcontractorStatement(env(ACC), sub.id));
ok('تأیید مدیر ارشد', wf.advanceSubcontractorStatement(env(CEO), sub.id));
const gross = sub.netPayable + sub.totalDeductions;
assert.equal(selectProjectFinancials(state, sub.projectId).actualCost - costBefore, gross, 'project cost recognised at approval');
const req = state.paymentRequests.find((r) => r.sourceRefId === sub.id)!;
assert.ok(req, 'payment request created');
assert.equal(req.status, 'تأیید مدیر ارشد');
assert.equal(req.remainingAmount, sub.netPayable);

const desk = state.cashDesks[0];
denied('پرداخت از صندوق با موجودی ناکافی', wf.executePayment(env(ACC), req.id, { cashDeskId: desk.id, amount: req.remainingAmount }));
denied('پرداخت بدون انتخاب حساب', wf.executePayment(env(ACC), req.id, { amount: 1000 }));
denied('پرداخت صفر', wf.executePayment(env(ACC), req.id, { bankAccountId: state.bankAccounts[0].id, amount: 0 }));
denied('پرداخت بیش از مانده', wf.executePayment(env(ACC), req.id, { bankAccountId: state.bankAccounts[0].id, amount: req.remainingAmount + 1 }));
const bankBefore = state.bankAccounts[0].balance;
const firstPart = 1_000_000_000;
ok('پرداخت اول (جزئی)', wf.executePayment(env(ACC), req.id, { bankAccountId: state.bankAccounts[0].id, amount: firstPart }));
ok('پرداخت مانده', wf.executePayment(env(ACC), req.id, { bankAccountId: state.bankAccounts[0].id, amount: sub.netPayable - firstPart }));
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
const amount = 300_000_000; // between siteLevelMax and projectLevelMax (Rials)
const expense = { ...state.pettyCashExpenses[0], id: 'exp-test', expenseNumber: 'EXP-T', pettyCashId: fund.id, projectId: fund.projectId, amount, status: 'draft' as const, approvalHistory: [], submitterName: PM.name };
ok('ثبت هزینه', wf.submitPettyCashExpense(env(PM), expense));
const saved = state.pettyCashExpenses.find((e) => e.id === 'exp-test')!;
assert.equal(saved.approvalLevelRequired, 'project_and_finance');
assert.equal(saved.currentApprovalStep, 'مدیر پروژه');
denied('تأیید هزینه توسط ثبت‌کننده خودش', wf.approvePettyCashExpense(env(PM), 'exp-test'));
ok('تأیید مدیر پروژه', wf.approvePettyCashExpense(env(PM_B), 'exp-test'));
assert.equal(state.pettyCashExpenses.find((e) => e.id === 'exp-test')!.currentApprovalStep, 'حسابدار');
const fundBefore = state.pettyCashAccounts.find((a) => a.id === fund.id)!.actualBalance;
ok('تأیید حسابدار و ثبت سند', wf.approvePettyCashExpense(env(ACC), 'exp-test'));
assert.equal(state.pettyCashAccounts.find((a) => a.id === fund.id)!.actualBalance, fundBefore - amount);
denied('هزینه بیش از سقف هر هزینه', wf.submitPettyCashExpense(env(PM), { ...expense, id: 'exp-big', amount: 1_500_000_000 }));
ok('درخواست شارژ ← خزانه', wf.requestPettyCashReplenishment(env(PM), fund.id, 200_000_000, 'آزمون'));
const pettyReq = state.paymentRequests.find((r) => r.sourceType === 'شارژ و تسویه تنخواه' && r.projectId === fund.projectId && r.totalAmount === 200_000_000)!;
ok('تأیید درخواست پرداخت', wf.approvePaymentRequest(env(CEO), pettyReq.id));
const fundBeforeCharge = state.pettyCashAccounts.find((a) => a.id === fund.id)!.actualBalance;
ok('پرداخت شارژ در خزانه', wf.executePayment(env(ACC), pettyReq.id, { bankAccountId: state.bankAccounts[0].id, amount: 200_000_000 }));
assert.equal(state.pettyCashAccounts.find((a) => a.id === fund.id)!.actualBalance, fundBeforeCharge + 200_000_000);

// Physical count with a deficit: a pending adjustment voucher, booked only after another accountant approves it.
const bookBalance = state.pettyCashAccounts.find((a) => a.id === fund.id)!.actualBalance;
const countInput = { pettyCashId: fund.id, periodStartDate: '1405/01/01', periodEndDate: '1405/12/29', actualCountedCash: bookBalance - 5_000_000, notes: '' };
denied('شمارش با کسری بدون علت', wf.reconcilePettyCash(env(ACC), countInput));
const recon = wf.reconcilePettyCash(env(ACC), { ...countInput, discrepancyReason: 'خطای شمارش' });
ok('ثبت صورتجلسه شمارش با کسری', recon);
const reconRow = state.pettyCashReconciliations.find((r) => r.id === recon.id)!;
assert.equal(reconRow.discrepancy, -5_000_000);
assert.equal(state.pettyCashAccounts.find((a) => a.id === fund.id)!.actualBalance, bookBalance, 'no booking before approval');
const adjustment = state.journalEntries.find((j) => j.docNumber === reconRow.adjustmentDocNumber)!;
assert.equal(adjustment.status, 'در انتظار تأیید');
denied('تأیید سند تعدیل توسط تهیه‌کننده', wf.approveJournalEntry(env(ACC), adjustment.id));
ok('تأیید سند تعدیل کسری تنخواه', wf.approveJournalEntry(env(CEO), adjustment.id));
assert.equal(state.pettyCashAccounts.find((a) => a.id === fund.id)!.actualBalance, bookBalance - 5_000_000);

// ---------------------------------------------------------------------------
console.log('\n۴) انبار: جمع ردیف‌های تکراری، رزرو، خروج به میانگین موزون، برگشت، انتقال، انبارگردانی');
const bal = state.stockBalances.find((b) => b.qty > 100 && b.reservedQty === 0)!;
const material = selectMaterials(state).find((m) => m.id === bal.materialId)!;
const warehouse = state.warehouses.find((w) => w.id === bal.warehouseId)!;
const line = (qty: number) => ({ materialId: material.id, materialCode: material.code, materialName: material.name, unit: material.unit, requestedQty: qty, issuedQty: qty, unitCost: 0, totalCost: 0 });
const issueBase: StoreIssueVoucher = {
  id: 'siv-test', issueNumber: '', date: '۱۴۰۵/۰۷/۱۰', warehouseId: warehouse.id, warehouseName: warehouse.name,
  projectId: 'prj-101', projectName: '', costCenterId: 'cc-prj101-01', costCenter: '', wbsSection: '-', isSubcontractorContra: false,
  applicantName: '-', approvedByManagerName: '-', dispatchedByKeeperName: '-', receivedByCrewLeaderName: '-',
  items: [line(50)], totalCost: 0, status: 'درخواست اولیه',
};
const free = availableQtyOf(state, warehouse.id, material.id);
denied('دو ردیف یک کالا که با هم از موجودی بیشترند', wf.requestStoreIssue(env(PM), { ...issueBase, id: 'siv-over', items: [line(Math.ceil(free / 2) + 1), line(Math.ceil(free / 2) + 1)] }));
const freeBefore = availableQtyOf(state, warehouse.id, material.id);
ok('درخواست حواله و رزرو', wf.requestStoreIssue(env(PM), issueBase));
assert.equal(availableQtyOf(state, warehouse.id, material.id), freeBefore - 50, 'reserved qty is not available');
assert.match(state.storeIssues.find((v) => v.id === 'siv-test')!.issueNumber, new RegExp(`^SIV-1405-\\d{${DOC_SEQUENCE_DIGITS}}$`));
const projCost0 = selectProjectFinancials(state, 'prj-101').actualCost;
const avg = state.materials.find((m) => m.id === material.id)!.averageUnitPrice;
const kardexBefore = state.kardex.length;
ok('تأیید خروج', wf.confirmStoreIssue(env(PM_B), 'siv-test'));
const issueCost = state.storeIssues.find((v) => v.id === 'siv-test')!.totalCost;
assert.equal(issueCost, Math.round(50 * avg));
assert.equal(selectProjectFinancials(state, 'prj-101').actualCost - projCost0, issueCost);
assert.equal(state.kardex.length, kardexBefore + 1, 'issue writes a kardex row');
ok('برگشت ۲۰ واحد از پروژه', wf.returnFromProject(env(PM), 'siv-test', material.id, 20, 'مازاد'));
assert.equal(selectProjectFinancials(state, 'prj-101').actualCost - projCost0, issueCost - 20 * Math.round(issueCost / 50));
denied('برگشت بیش از مقدار حواله', wf.returnFromProject(env(PM), 'siv-test', material.id, 31, 'x'));

const target = state.warehouses.find((w) => w.id !== warehouse.id)!;
const srcQty = state.stockBalances.find((b) => b.warehouseId === warehouse.id && b.materialId === material.id)!.qty;
const dstQty = state.stockBalances.find((b) => b.warehouseId === target.id && b.materialId === material.id)?.qty || 0;
const transfer: InterWarehouseTransfer = {
  id: 'trf-test', transferNumber: '', date: '۱۴۰۵/۰۷/۱۱', sourceWarehouseId: warehouse.id, sourceWarehouseName: warehouse.name, sourceProjectId: warehouse.projectId || '',
  targetWarehouseId: target.id, targetWarehouseName: target.name, targetProjectId: target.projectId || '', waybillNumber: '-', driverName: '-', truckPlate: '-',
  items: [{ materialId: material.id, materialCode: material.code, materialName: material.name, unit: material.unit, quantity: 10, unitCost: 0, totalCost: 0 }],
  totalCost: 0, status: 'صدور مجوز', authorizedBy: '-',
};
ok('صدور حواله انتقال', wf.createTransfer(env(CEO), transfer));
ok('تحویل انتقال', wf.advanceTransfer(env(CEO), 'trf-test', 'تخلیه و تحویل قطعی مقصد'));
assert.equal(state.stockBalances.find((b) => b.warehouseId === warehouse.id && b.materialId === material.id)!.qty, srcQty - 10);
assert.equal(state.stockBalances.find((b) => b.warehouseId === target.id && b.materialId === material.id)!.qty, dstQty + 10);
const trfNumber = state.interTransfers.find((t) => t.id === 'trf-test')!.transferNumber;
assert.equal(state.kardex.filter((k) => k.docNumber === trfNumber).length, 2, 'transfer writes out and in kardex rows');

const onHand = state.stockBalances.find((b) => b.warehouseId === target.id && b.materialId === material.id)!.qty;
const audit: StocktakeAudit = {
  id: 'stk-test', auditNumber: 'STK-T', date: '۱۴۰۵/۰۷/۱۲', warehouseId: target.id, warehouseName: target.name, leadAuditor: '-', teamMembers: [],
  items: [{ materialId: material.id, materialCode: material.code, materialName: material.name, unit: material.unit, systemStock: 0, physicalCount: onHand - 3, varianceQty: 0, unitPrice: 0, varianceAmount: 0 }],
  netVarianceAmount: 0, status: 'شمارش در جریان',
};
ok('انبارگردانی با کسری ۳ واحد', wf.applyStocktake(env(CEO), audit));
assert.equal(state.stockBalances.find((b) => b.warehouseId === target.id && b.materialId === material.id)!.qty, onHand - 3);
assert.ok(state.kardex.some((k) => k.docType === 'تعدیل انبارگردانی' && k.docNumber === 'STK-T' && k.outQty === 3), 'stocktake writes an adjustment kardex row');

// ---------------------------------------------------------------------------
console.log('\n۵) دفتر: سند دستی، تأیید، معکوس، بستن سال');
const manual = wf.createManualJournalEntry(env(ACC), {
  id: '', docNumber: '', date: toPersianDate(new Date()), title: 'سند آزمون', type: 'عمومی', submitter: '', status: 'پیش‌نویس',
  rows: [
    { id: 'r1', accountCode: '612', accountName: 'اجاره', description: 'اجاره', debit: 5_000_000, credit: 0 },
    { id: 'r2', accountCode: '11101', accountName: 'بانک', description: 'پرداخت', debit: 0, credit: 5_000_000, subledgerCode: state.bankAccounts[0].id },
  ],
  totalDebit: 0, totalCredit: 0, isBalanced: true, history: [],
});
ok('ثبت سند دستی', manual);
denied('معکوس سند در انتظار تأیید', wf.reverseJournalEntry(env(CEO), manual.id!, 'x'));
denied('تأیید سند توسط ثبت‌کننده', wf.approveJournalEntry(env(ACC), manual.id!));
const bankBeforeManual = state.bankAccounts[0].balance;
ok('تأیید سند توسط مدیر ارشد', wf.approveJournalEntry(env(CEO), manual.id!));
assert.equal(state.bankAccounts[0].balance, bankBeforeManual - 5_000_000, 'approved voucher moves the bank balance');
const original = state.journalEntries.find((j) => j.id === manual.id)!;
ok('صدور سند معکوس', wf.reverseJournalEntry(env(ACC), original.id, 'اشتباه در حساب'));
assert.equal(state.journalEntries.find((j) => j.id === original.id), original, 'the original final entry is not modified');
assert.equal(state.bankAccounts[0].balance, bankBeforeManual, 'reversal restores the bank balance');
const reversal = state.journalEntries.find((j) => j.reversedFromDocId === original.id)!;
assert.ok(reversedEntryIds(state).has(original.id));
denied('معکوس دوباره همان سند', wf.reverseJournalEntry(env(ACC), original.id, 'x'));
denied('معکوس سند معکوس', wf.reverseJournalEntry(env(ACC), reversal.id, 'x'));

const lastYear = 1403;
ok(`بستن سال مالی ${lastYear}`, wf.closeFiscalYear(env(CEO), lastYear));
assert.ok(state.financeSettings.closedFiscalYears.includes(lastYear));
denied('ثبت سند در سال بسته', wf.createManualJournalEntry(env(ACC), { ...original, id: '', date: '۱۴۰۳/۰۵/۰۱', status: 'پیش‌نویس' }));
denied('بستن دوباره همان سال', wf.closeFiscalYear(env(CEO), lastYear));

// ---------------------------------------------------------------------------
console.log('\n۶) توازن کل دفاتر');
const debit = state.journalEntries.reduce((a, e) => a + e.totalDebit, 0);
const credit = state.journalEntries.reduce((a, e) => a + e.totalCredit, 0);
assert.equal(debit, credit);
for (const e of state.journalEntries) {
  assert.equal(e.totalDebit, e.totalCredit, e.docNumber);
  for (const r of e.rows) assert.ok(Number.isSafeInteger(r.debit) && Number.isSafeInteger(r.credit), `${e.docNumber}: amounts are integer Rials`);
}
console.log(`  ✔ ${state.journalEntries.length} سند، جمع بدهکار ${fa(debit)} = جمع بستانکار ${fa(credit)} ریال`);
console.log(`  ✔ ${selectApprovals(state).length} مورد در کارتابل تأییدات از ${new Set(selectApprovals(state).map((a) => a.module)).size} ماژول`);

console.log('\nهمه سناریوهای گردش‌کار با موفقیت گذشت.');
