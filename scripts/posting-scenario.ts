/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Scenario: purchase order → goods receipt → vendor invoice → payment → store issue.
 * Run with: npm run test:posting
 */

import assert from 'node:assert/strict';
import { buildInitialState } from '../src/store/initialState';
import { postFinancialEventToState } from '../src/store/postingEngine';
import { selectProjectFinancials } from '../src/store/selectors';
import { goodsReceiptEvent, vendorInvoiceEvent, storeIssueEvent, clientStatementApprovedEvent } from '../src/store/events';
import { receiveIntoStock, issueFromStock } from '../src/store/inventoryCosting';
import { AppState, FinancialEventInput } from '../src/store/types';
import { GoodsReceiptNote, VendorInvoice, StoreIssueVoucher, JournalEntry } from '../src/types';

const fmt = (n: number) => n.toLocaleString('en-US');
let state: AppState = buildInitialState();

const PROJECT = 'prj-101';
const COST_CENTER = 'cc-prj101-01';
const SUPPLIER = 'cp-sup-01';
const BANK = state.bankAccounts[0].id;
const material = state.materials[0];

const startEntries = state.journalEntries.length;
const startCost = selectProjectFinancials(state, PROJECT).actualCost;
const startBank = state.bankAccounts[0].balance;
const costLog: Array<[string, number]> = [['شروع', startCost]];

function post(label: string, input: FinancialEventInput): JournalEntry {
  const { state: next, result } = postFinancialEventToState(state, input, { submitter: 'scenario' });
  assert.ok(result.ok, `${label}: ${result.error}`);
  assert.equal(result.duplicate, false, `${label}: unexpected duplicate`);
  state = next;
  const entry = result.entry!;
  assert.equal(entry.totalDebit, entry.totalCredit, `${label}: unbalanced`);
  assert.equal(entry.rows.reduce((a, r) => a + r.debit, 0), entry.totalDebit);
  assert.equal(entry.rows.reduce((a, r) => a + r.credit, 0), entry.totalCredit);
  const cost = selectProjectFinancials(state, PROJECT).actualCost;
  costLog.push([label, cost]);
  console.log(`\n${label}  —  سند ${entry.docNumber}`);
  for (const r of entry.rows) {
    console.log(`  ${r.accountCode.padEnd(6)} ${r.accountName.slice(0, 42).padEnd(42)}  بد ${fmt(r.debit).padStart(13)}  بس ${fmt(r.credit).padStart(13)}`);
  }
  console.log(`  جمع: بدهکار ${fmt(entry.totalDebit)} = بستانکار ${fmt(entry.totalCredit)}  |  هزینه پروژه: ${fmt(cost)}`);
  return entry;
}

// 1) Purchase order — commitment only, no accounting entry.
const qty = 10_000;
const unitPrice = 32_000;
const vat = (qty * unitPrice) / 10;
console.log(`خرید: ${qty} ${material.unit} «${material.name}» × ${fmt(unitPrice)} (میانگین فعلی ${fmt(material.averageUnitPrice)}، موجودی ${material.currentStock})`);
assert.equal(state.journalEntries.length, startEntries, 'purchase order must not post');

// 2) Goods receipt.
const grn: GoodsReceiptNote = {
  id: 'scn-grn-1', receiptNumber: 'GRN-SCN-1', date: '۱۴۰۳/۰۷/۱۰', poId: 'scn-po-1',
  warehouseId: state.warehouses[0].id, warehouseName: state.warehouses[0].name,
  projectId: PROJECT, projectName: '', costCenterId: COST_CENTER, counterpartyId: SUPPLIER, supplierName: '',
  invoiceNumber: 'INV-SCN-1', waybillNumber: '-', truckPlateNumber: '-', driverName: '-', driverPhone: '-',
  qcApprovalStatus: 'تأیید کامل',
  items: [{ materialId: material.id, materialCode: material.code, materialName: material.name, unit: material.unit,
    orderedQty: qty, deliveredQty: qty, rejectedQty: 0, acceptedQty: qty, unitPrice, totalPrice: qty * unitPrice }],
  totalAmount: qty * unitPrice, status: 'تأیید نهایی انبارداری', receiverName: '-',
};
const received = receiveIntoStock(material, qty, unitPrice);
state = { ...state, materials: state.materials.map((m) => (m.id === material.id ? received : m)) };
post('۲) رسید انبار', goodsReceiptEvent(grn));

// Idempotency: the same receipt cannot be posted twice.
const before = state.journalEntries.length;
const dup = postFinancialEventToState(state, goodsReceiptEvent(grn));
assert.equal(dup.result.duplicate, true);
assert.equal(dup.state.journalEntries.length, before, 'duplicate must not create a second entry');
console.log('\n  ثبت دوباره همان رسید ← duplicate=true، سند دوم ساخته نشد.');

// 3) Vendor invoice.
const invoice: VendorInvoice = {
  id: 'scn-inv-1', invoiceNumber: 'INV-SCN-1', systemRefNumber: '-', invoiceDate: '۱۴۰۳/۰۷/۱۲', dueDate: '۱۴۰۳/۰۸/۱۲',
  projectId: PROJECT, projectName: '', costCenterId: COST_CENTER, counterpartyId: SUPPLIER, supplierId: SUPPLIER, supplierName: '',
  poId: 'scn-po-1', poNumber: 'PO-SCN-1', grnId: grn.id, taxRegistrationNumber: '-',
  subtotal: qty * unitPrice, vatAmount: vat, shippingCost: 0, discounts: 0, totalAmount: qty * unitPrice + vat,
  paidAmount: 0, remainingBalance: qty * unitPrice + vat, status: 'تأیید تطبیق سه‌جانبه',
  threeWayMatching: { poMatched: true, grnMatched: true, priceVarianceAmount: 0, qtyVarianceAmount: 0, status: 'تطبیق کامل و بدون مغایرت' as any },
};
post('۳) فاکتور خرید', vendorInvoiceEvent(invoice));

// 4) Payment (treasury).
post('۴) پرداخت', {
  type: 'TREASURY_PAYMENT', sourceModule: 'treasury', sourceId: 'scn-pay-1', projectId: PROJECT, costCenterId: COST_CENTER,
  counterpartyId: SUPPLIER, amount: invoice.totalAmount, date: '۱۴۰۳/۰۷/۲۰',
  details: { docNumber: 'PR-SCN-1', payableType: 'supplier', bankAccountId: BANK },
});

// 5) Store issue at weighted-average cost.
const issueQty = 3_000;
const current = state.materials.find((m) => m.id === material.id)!;
const { cost: issueCost } = issueFromStock(current, issueQty);
const issue: StoreIssueVoucher = {
  id: 'scn-siv-1', issueNumber: 'SIV-SCN-1', date: '۱۴۰۳/۰۷/۲۲', warehouseId: grn.warehouseId, warehouseName: grn.warehouseName,
  projectId: PROJECT, projectName: '', costCenterId: COST_CENTER, costCenter: '', wbsSection: '-', isSubcontractorContra: false,
  applicantName: '-', approvedByManagerName: '-', dispatchedByKeeperName: '-', receivedByCrewLeaderName: '-',
  items: [{ materialId: material.id, materialCode: material.code, materialName: material.name, unit: material.unit,
    requestedQty: issueQty, issuedQty: issueQty, unitCost: current.averageUnitPrice, totalCost: issueCost }],
  totalCost: issueCost, status: 'خروج قطعی از انبار',
};
console.log(`\nمیانگین موزون پس از رسید: ${fmt(current.averageUnitPrice)} ← بهای ${issueQty} واحد: ${fmt(issueCost)}`);
post('۵) مصرف انبار', storeIssueEvent(issue, issueCost));

// ---------------- Assertions over the whole scenario ----------------
const newEntries = state.journalEntries.slice(0, state.journalEntries.length - startEntries);
assert.equal(newEntries.length, 4, 'receipt, invoice, payment and issue each create exactly one entry');
const totalDebit = newEntries.reduce((a, e) => a + e.totalDebit, 0);
const totalCredit = newEntries.reduce((a, e) => a + e.totalCredit, 0);
assert.equal(totalDebit, totalCredit);

const net = (code: string) =>
  newEntries.flatMap((e) => e.rows).filter((r) => r.accountCode === code).reduce((a, r) => a + r.debit - r.credit, 0);
assert.equal(net('21401'), 0, 'goods-received-not-invoiced clears to zero');
assert.equal(net('21101'), 0, 'supplier payable is settled');
assert.equal(net('11501'), qty * unitPrice - issueCost, 'inventory keeps the unissued value');
assert.equal(net('51101'), issueCost, 'project material cost equals the issue cost');

const costs = costLog.map(([, c]) => c);
assert.equal(costs[1], startCost, 'receipt does not change project cost');
assert.equal(costs[2], startCost, 'invoice does not change project cost');
assert.equal(costs[3], startCost, 'payment does not change project cost');
assert.equal(costs[4], startCost + issueCost, 'issue increases project cost once, by the weighted-average cost');
assert.equal(state.bankAccounts[0].balance, startBank - invoice.totalAmount, 'bank decreases only through the payment entry');

console.log('\n──────── خلاصه ────────');
console.log(`جمع بدهکار چهار سند: ${fmt(totalDebit)}  |  جمع بستانکار: ${fmt(totalCredit)}  →  برابر ✔`);
console.log('هزینه پروژه در هر مرحله:');
for (const [label, c] of costLog) console.log(`  ${label.padEnd(16)} ${fmt(c).padStart(16)}  (تغییر: ${fmt(c - startCost)})`);
console.log(`مانده خالص: کالای فاکتورنشده ${fmt(net('21401'))} | بستانکاران ${fmt(net('21101'))} | موجودی ${fmt(net('11501'))} | بهای پروژه ${fmt(net('51101'))}`);

// ---------------- Client statement: balanced, each deduction in its own account ----------------
const stm = state.clientStatements.find((s) => s.id === 'stm-04')!;
const contract = state.contracts.find((c) => c.id === stm.contractId)!;
const probe = postFinancialEventToState(
  { ...state, financialEvents: state.financialEvents.filter((e) => e.sourceId !== stm.id) },
  clientStatementApprovedEvent(stm, contract.costCenterId, contract.counterpartyId)
).result;
assert.ok(probe.ok, probe.error);
assert.equal(probe.entry!.totalDebit, probe.entry!.totalCredit);
console.log(`\nصورت‌وضعیت ${stm.statementNumber}: بدهکار ${fmt(probe.entry!.totalDebit)} = بستانکار ${fmt(probe.entry!.totalCredit)}`);
for (const r of probe.entry!.rows) console.log(`  ${r.accountCode.padEnd(6)} ${r.accountName.slice(0, 42).padEnd(42)}  بد ${fmt(r.debit).padStart(13)}  بس ${fmt(r.credit).padStart(13)}`);

console.log('\nهمه آزمون‌ها با موفقیت گذشت.');
