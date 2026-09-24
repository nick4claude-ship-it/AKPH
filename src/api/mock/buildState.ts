/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, FinancialEventInput } from '../../store/types';
import { postFinancialEventToState } from '../../store/postingEngine';
import { DOC_SEQUENCE_DIGITS, tryFiscalYearOf } from '../../utils/ids';
import { dayIndex } from '../../utils/date';
import {
  clientStatementApprovedEvent,
  subcontractorStatementApprovedEvent,
  goodsReceiptEvent,
  vendorInvoiceEvent,
  storeIssueEvent,
  pettyCashExpenseApprovedEvent,
  payrollApprovedEvent,
} from '../../store/events';
import { buildPaymentRequest } from '../../store/paymentRequests';
import {
  emptyState,
  payrollPeriodId,
  CLIENT_APPROVED_STATUSES,
  SUBCONTRACTOR_APPROVED_STATUSES,
  PETTY_CASH_APPROVED_STATUSES,
  VENDOR_INVOICE_APPROVED_STATUSES,
  PAYROLL_APPROVED_STATUSES,
  OPENING_BALANCE_SUBLEDGER,
  DEFAULT_FINANCE_SETTINGS,
} from '../../store/state';
import { AppDocument, DocumentCategory, DocumentLink, ReceiptRecord, StockBalance, PaymentRequest, JournalEntry } from '../../types';
import { getRelativePersianDate } from '../../utils/date';
import type { SeedContractDocument } from './data/contractsMockData';
import type { SeedDocument } from './data/documentsMockData';
import { loadMockSeeds, OperationalSeeds } from './seeds';

/**
 * Builds the demo AppState from the mock seeds (already in Rials): legacy attachments become linked
 * documents, stock is split per warehouse, and historical approvals are posted to the ledger.
 */

// ---------------------------------------------------------------------------
// Document center migration: every legacy attachment becomes a linked Document.
// ---------------------------------------------------------------------------

const CONTRACT_DOC_TYPES: Record<SeedContractDocument['fileType'], DocumentCategory> = {
  'قرارداد اولیه': 'قرارداد اصلی کارفرما',
  'الحاقیه': 'الحاقیه قرارداد',
  'صورت‌جلسه کارگاهی': 'صورتجلسه کارگاهی',
  'فایل اکسل متره': 'فایل متره و اندازه‌گیری',
  'نقشه فنی': 'نقشه اجرایی و ازبیلت',
  'سند تأییدیه': 'صورت‌وضعیت کارفرما',
  'مکاتبات': 'نامه و مکاتبات رسمی',
};

const formatOf = (fileName: string): AppDocument['fileFormat'] => {
  const ext = fileName.split('.').pop()?.toUpperCase();
  return ext === 'DWG' || ext === 'XLSX' || ext === 'JPG' || ext === 'DOCX' ? ext : ext === 'XLS' ? 'XLSX' : ext === 'PNG' || ext === 'JPEG' ? 'JPG' : 'PDF';
};

function fromSeedDocument(seeds: OperationalSeeds, d: SeedDocument): AppDocument {
  const links: DocumentLink[] = [];
  if (d.projectId) links.push({ entityType: 'project', entityId: d.projectId });
  if (d.contractId) {
    const isSub = seeds.subcontractorContracts.some((c) => c.id === d.contractId);
    links.push({ entityType: isSub ? 'subcontract' : 'contract', entityId: d.contractId });
  }
  if (d.statementId) {
    const isSub = seeds.subcontractorStatements.some((s) => s.id === d.statementId);
    links.push({ entityType: isSub ? 'subcontractor_statement' : 'client_statement', entityId: d.statementId });
  }
  const party = d.counterpartyId || d.partnerId;
  if (party) links.push({ entityType: 'counterparty', entityId: party });
  if (d.transactionId) links.push({ entityType: 'vendor_invoice', entityId: d.transactionId });
  return {
    id: d.id,
    title: d.title,
    type: d.category,
    fileName: `${d.docNumber}.${d.fileFormat.toLowerCase()}`,
    links,
    docNumber: d.docNumber,
    date: d.date,
    fileFormat: d.fileFormat,
    fileSize: d.fileSize,
    version: '1.0',
    status: d.status,
    confidentiality: d.confidentiality,
    registeredBy: d.registeredBy,
    tags: d.tags,
    description: d.description,
  };
}

function fromContractDocument(seeds: OperationalSeeds, d: SeedContractDocument): AppDocument {
  const links: DocumentLink[] = [];
  const contract = seeds.contracts.find((c) => c.id === d.contractId);
  if (contract) {
    links.push({ entityType: 'contract', entityId: contract.id }, { entityType: 'project', entityId: contract.projectId });
    if (contract.counterpartyId) links.push({ entityType: 'counterparty', entityId: contract.counterpartyId });
  }
  if (d.statementId) links.push({ entityType: 'client_statement', entityId: d.statementId });
  return {
    id: `doc-${d.id}`,
    title: d.fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
    type: CONTRACT_DOC_TYPES[d.fileType],
    fileName: d.fileName,
    links,
    docNumber: d.id.toUpperCase(),
    date: d.uploadDate,
    fileFormat: formatOf(d.fileName),
    fileSize: d.fileSize,
    version: d.version,
    status: 'معتبر و جاری',
    confidentiality: 'عادی',
    registeredBy: d.uploaderName,
    tags: [d.fileType],
    description: '',
    url: d.downloadUrl,
  };
}

function migrateDocuments(seeds: OperationalSeeds): AppDocument[] {
  const docs: AppDocument[] = [
    ...seeds.systemDocuments.map((d) => fromSeedDocument(seeds, d)),
    ...seeds.contractDocuments.map((d) => fromContractDocument(seeds, d)),
  ];

  for (const s of seeds.detailedStatements) {
    for (const a of s.attachments) {
      const doc = fromContractDocument(seeds, { ...a, contractId: s.contractId, statementId: s.id });
      if (!docs.some((d) => d.id === doc.id)) docs.push(doc);
    }
  }

  for (const e of seeds.pettyCashExpenses) {
    e.attachments.forEach((a, i) => {
      docs.push({
        id: `doc-${e.id}-${a.id || i}`,
        title: `فاکتور ${e.invoiceNumber} - ${e.description}`,
        type: 'فاکتور هزینه تنخواه',
        fileName: a.name,
        links: [
          { entityType: 'petty_cash_expense', entityId: e.id },
          { entityType: 'project', entityId: e.projectId },
          ...(e.counterpartyId ? [{ entityType: 'counterparty' as const, entityId: e.counterpartyId }] : []),
        ],
        docNumber: e.invoiceNumber || e.expenseNumber,
        date: e.invoiceDate || e.date,
        fileFormat: a.type === 'image' ? 'JPG' : 'PDF',
        fileSize: a.size || '-',
        version: '1.0',
        status: 'معتبر و جاری',
        confidentiality: 'عادی',
        registeredBy: e.submitterName,
        tags: ['تنخواه', e.category],
        description: e.description,
        url: a.url,
      });
    });
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Stock per warehouse: net documented movements per warehouse, remainder in the central warehouse.
// ---------------------------------------------------------------------------

function migrateStockBalances(seeds: OperationalSeeds): StockBalance[] {
  const key = (w: string, m: string) => `${w}|${m}`;
  const qty = new Map<string, number>();
  const add = (w: string, m: string, q: number) => qty.set(key(w, m), (qty.get(key(w, m)) || 0) + q);

  for (const g of seeds.goodsReceipts) {
    if (g.status !== 'تأیید نهایی انبارداری') continue;
    for (const i of g.items) add(g.warehouseId, i.materialId, i.acceptedQty);
  }
  for (const v of seeds.storeIssues) {
    if (v.status !== 'خروج قطعی از انبار') continue;
    for (const i of v.items) add(v.warehouseId, i.materialId, -i.issuedQty);
  }

  const central = seeds.warehouses.find((w) => w.type === 'مرکزی')?.id || seeds.warehouses[0]?.id;
  const balances: StockBalance[] = [];
  for (const m of seeds.materials) {
    let allocated = 0;
    for (const w of seeds.warehouses) {
      const q = Math.max(0, qty.get(key(w.id, m.id)) || 0);
      if (q > 0 && allocated + q <= m.currentStock) {
        balances.push({ warehouseId: w.id, materialId: m.id, qty: q, reservedQty: 0 });
        allocated += q;
      }
    }
    const rest = m.currentStock - allocated;
    if (rest > 0 && central) {
      const existing = balances.find((b) => b.warehouseId === central && b.materialId === m.id);
      if (existing) existing.qty += rest;
      else balances.push({ warehouseId: central, materialId: m.id, qty: rest, reservedQty: 0 });
    }
  }
  return balances;
}

// ---------------------------------------------------------------------------
// Receipts: one register, each client receipt references its statement.
// ---------------------------------------------------------------------------

function migrateReceipts(seeds: OperationalSeeds): ReceiptRecord[] {
  const receipts: ReceiptRecord[] = [...seeds.receipts];
  for (const s of seeds.detailedStatements) {
    if (!CLIENT_APPROVED_STATUSES.includes(s.status) || s.receivedAmount <= 0) continue;
    const contract = seeds.contracts.find((c) => c.id === s.contractId);
    const recorded = seeds.statementPayments.filter((p) => p.statementId === s.id);
    const base = {
      counterpartyId: s.counterpartyId || contract?.counterpartyId,
      costCenterId: s.costCenterId || contract?.costCenterId,
      payer: s.client,
      projectId: s.projectId,
      projectName: s.projectName,
      sourceType: 'صورت‌وضعیت کارفرما' as const,
      statementId: s.id,
      contractId: s.contractId,
      status: 'وصول شده' as const,
    };
    for (const p of recorded) {
      receipts.push({
        ...base,
        id: `rcp-${p.id}`,
        docNumber: p.referenceNumber,
        date: p.date,
        amount: p.amount,
        receiver: p.destinationBank,
        destinationAccount: p.destinationBank,
        method: p.method === 'چک صیادی' ? 'چک صیادی' : p.method === 'حواله ساتنا/پایا' ? 'حواله بانکی' : 'تهاتر',
        trackingNumber: p.referenceNumber,
        description: p.notes || `وصول ${s.statementNumber}`,
      });
    }
    const opening = s.receivedAmount - recorded.reduce((a, p) => a + p.amount, 0);
    if (opening > 0) {
      receipts.push({
        ...base,
        id: `rcp-opening-${s.id}`,
        docNumber: `OPEN-${s.id.toUpperCase()}`,
        date: s.dueDate || s.preparationDate,
        amount: opening,
        receiver: 'مانده افتتاحیه',
        destinationAccount: 'مانده افتتاحیه',
        method: 'حواله بانکی',
        trackingNumber: '-',
        description: `وصولی‌های پیشین ${s.statementNumber}`,
      });
    }
  }
  return receipts;
}

// ---------------------------------------------------------------------------
// Historical postings (their cash effect is already in the opening balances).
// ---------------------------------------------------------------------------

function seedEvents(state: AppState): FinancialEventInput[] {
  const events: FinancialEventInput[] = [];
  const opening = { bankAccountId: OPENING_BALANCE_SUBLEDGER, bankName: 'مانده افتتاحیه' };

  for (const s of state.clientStatements) {
    if (!CLIENT_APPROVED_STATUSES.includes(s.status)) continue;
    const contract = state.contracts.find((c) => c.id === s.contractId);
    events.push(clientStatementApprovedEvent(s, s.costCenterId || contract?.costCenterId || '', s.counterpartyId || contract?.counterpartyId || ''));
  }
  for (const r of state.receipts) {
    if (!r.statementId) continue;
    events.push({
      type: 'TREASURY_RECEIPT',
      sourceModule: 'treasury',
      sourceId: r.id,
      projectId: r.projectId || '',
      costCenterId: r.costCenterId || '',
      counterpartyId: r.counterpartyId || '',
      amount: r.amount,
      date: r.date,
      details: { docNumber: r.docNumber, receiptType: 'statement', statementId: r.statementId, ...opening },
    });
  }

  for (const s of state.subcontractorStatements) {
    if (!SUBCONTRACTOR_APPROVED_STATUSES.includes(s.status)) continue;
    events.push(subcontractorStatementApprovedEvent(s));
    if (s.paidAmount > 0) {
      events.push({
        type: 'TREASURY_PAYMENT',
        sourceModule: 'subcontractors',
        sourceId: `${s.id}:opening-payments`,
        projectId: s.projectId,
        costCenterId: s.costCenterId,
        counterpartyId: s.counterpartyId,
        amount: s.paidAmount,
        date: s.paymentDate || s.submissionDate,
        details: { docNumber: s.statementNumber, payableType: 'subcontractor', ...opening },
      });
    }
  }

  for (const g of state.goodsReceipts) {
    if (g.status === 'تأیید نهایی انبارداری') events.push(goodsReceiptEvent(g));
  }

  for (const inv of state.vendorInvoices) {
    if (!VENDOR_INVOICE_APPROVED_STATUSES.includes(inv.status)) continue;
    events.push(vendorInvoiceEvent(inv));
    if (inv.paidAmount > 0) {
      events.push({
        type: 'TREASURY_PAYMENT',
        sourceModule: 'procurement',
        sourceId: `${inv.id}:opening-payments`,
        projectId: inv.projectId,
        costCenterId: inv.costCenterId || '',
        counterpartyId: inv.counterpartyId || inv.supplierId,
        amount: inv.paidAmount,
        date: inv.invoiceDate,
        details: { docNumber: inv.invoiceNumber, payableType: 'supplier', ...opening },
      });
    }
  }

  for (const v of state.storeIssues) {
    if (v.status === 'خروج قطعی از انبار') events.push(storeIssueEvent(v, v.totalCost));
  }

  for (const exp of state.pettyCashExpenses) {
    if (!PETTY_CASH_APPROVED_STATUSES.includes(exp.status)) continue;
    const account = state.pettyCashAccounts.find((a) => a.id === exp.pettyCashId);
    events.push(pettyCashExpenseApprovedEvent(exp, account));
  }

  const approvedSlips = state.payrollSlips.filter((s) => PAYROLL_APPROVED_STATUSES.includes(s.status));
  for (const period of [...new Set(approvedSlips.map((s) => s.monthYear))]) {
    const slips = approvedSlips.filter((s) => s.monthYear === period);
    events.push(payrollApprovedEvent(payrollPeriodId(period), period, slips));
    const paid = slips.filter((s) => s.status === 'پرداخت شده');
    const paidNet = paid.reduce((a, s) => a + s.netPayableSalary, 0);
    if (paidNet > 0) {
      events.push({
        type: 'TREASURY_PAYMENT',
        sourceModule: 'payroll',
        sourceId: `${payrollPeriodId(period)}:opening-payments`,
        projectId: '',
        costCenterId: '',
        counterpartyId: '',
        amount: paidNet,
        date: paid[0].issueDate,
        details: { docNumber: `پرداخت حقوق ${period}`, payableType: 'payroll', ...opening },
      });
    }
  }

  return events;
}

/** Payment requests for every approved, unpaid payable (the treasury queue is derived from real records). */
function seedPaymentRequests(state: AppState): PaymentRequest[] {
  const requests: PaymentRequest[] = [];
  const today = getRelativePersianDate(0);
  const push = (input: Parameters<typeof buildPaymentRequest>[1], status: PaymentRequest['status']) =>
    requests.push({ ...buildPaymentRequest(requests, input, today), status });

  for (const s of state.subcontractorStatements) {
    if (s.status !== 'management_approved' || s.remainingPayable <= 0) continue;
    push(
      {
        sourceType: 'صورت‌وضعیت پیمانکار جزء', sourceRefId: s.id, sourceRefNumber: s.statementNumber,
        projectId: s.projectId, projectName: s.projectName, costCenterId: s.costCenterId, counterpartyId: s.counterpartyId,
        beneficiaryName: s.subcontractorName, beneficiaryType: 'پیمانکار جزء', totalAmount: s.remainingPayable,
        dueDate: s.managementApprovalDate,
      },
      'تأیید مدیر ارشد'
    );
  }
  for (const inv of state.vendorInvoices) {
    if (!VENDOR_INVOICE_APPROVED_STATUSES.includes(inv.status) || inv.remainingBalance <= 0) continue;
    push(
      {
        sourceType: 'فاکتور خرید تأمین‌کننده', sourceRefId: inv.id, sourceRefNumber: inv.invoiceNumber,
        projectId: inv.projectId, projectName: inv.projectName, costCenterId: inv.costCenterId || '',
        counterpartyId: inv.counterpartyId || inv.supplierId, beneficiaryName: inv.supplierName,
        beneficiaryType: 'تأمین‌کننده', totalAmount: inv.remainingBalance, dueDate: inv.dueDate,
      },
      'در انتظار تأیید مالی'
    );
  }
  const unpaidSlips = state.payrollSlips.filter((s) => s.status === 'صادر شده جهت پرداخت' || s.status === 'تأیید مالی');
  for (const period of [...new Set(unpaidSlips.map((s) => s.monthYear))]) {
    const slips = unpaidSlips.filter((s) => s.monthYear === period);
    push(
      {
        sourceType: 'حقوق و دستمزد ماهانه', sourceRefId: `${payrollPeriodId(period)}:${slips.map((s) => s.id).sort().join(',')}`,
        sourceRefNumber: `لیست حقوق ${period}`, projectId: '', projectName: 'ستاد مرکزی و کارگاه‌ها', costCenterId: '',
        beneficiaryName: 'پرسنل - فایل پایا واریز گروهی', beneficiaryType: 'پرسنل',
        totalAmount: slips.reduce((a, s) => a + s.netPayableSalary, 0),
      },
      'در انتظار تأیید مالی'
    );
  }
  for (const r of state.pettyCashRequests) {
    if (r.status !== 'در انتظار تأیید مالی') continue;
    const fund = state.pettyCashAccounts.find((a) => a.id === r.pettyCashId);
    push(
      {
        sourceType: 'شارژ و تسویه تنخواه', sourceRefId: r.id, sourceRefNumber: r.requestNumber,
        projectId: fund?.projectId || '', projectName: fund?.projectName || '', costCenterId: fund?.costCenterId || '',
        beneficiaryName: r.pettyCashTitle, beneficiaryType: 'مسئول تنخواه', totalAmount: r.suggestedAmount, date: r.date,
      },
      'در انتظار تأیید مالی'
    );
  }
  return requests;
}

export function buildMockState(): AppState {
  const seeds = loadMockSeeds();
  const base: AppState = {
    ...emptyState(),
    chartOfAccounts: seeds.chartOfAccounts,
    costCenters: seeds.costCenters,
    bankAccounts: seeds.bankAccounts,
    subledgers: seeds.subledgers,
    pettyCashSettings: seeds.pettyCashSettings,
    pettyCashCategories: seeds.pettyCashCategories,
    financeSettings: DEFAULT_FINANCE_SETTINGS,
  };
  const op = seeds.operational;
  if (!op) return base;

  let state: AppState = {
    ...base,
    projects: op.projects,
    counterparties: op.counterparties,
    contracts: op.contracts,
    clientStatements: op.detailedStatements.map(({ attachments: _a, ...s }) => s),
    subcontractorContracts: op.subcontractorContracts,
    subcontractorStatements: op.subcontractorStatements,
    contractBoq: op.contractBoq,
    contractAmendments: op.contractAmendments,
    advancePayments: op.advancePayments,
    priceAdjustments: op.priceAdjustments,
    contractAuditLogs: op.contractAuditLogs,
    journalEntries: op.journalEntries,
    cashDesks: op.cashDesks,
    treasuryChecks: op.treasuryChecks,
    auditLogs: op.auditLogs,
    pettyCashAccounts: op.pettyCashAccounts,
    pettyCashExpenses: op.pettyCashExpenses.map(({ attachments: _a, ...e }) => e),
    pettyCashReplenishments: op.pettyCashReplenishments,
    pettyCashRequests: op.pettyCashRequests,
    pettyCashReconciliations: op.pettyCashReconciliations,
    receipts: migrateReceipts(op),
    payments: op.payments,
    documents: migrateDocuments(op),
    bankReconciliations: op.bankReconciliations,
    purchaseRequisitions: op.requisitions,
    purchaseOrders: op.purchaseOrders,
    vendorInvoices: op.vendorInvoices,
    suppliers: op.suppliers,
    rfqs: op.rfqs,
    goodsReceipts: op.goodsReceipts,
    storeIssues: op.storeIssues,
    materials: op.materials,
    warehouses: op.warehouses,
    stockBalances: migrateStockBalances(op),
    interTransfers: op.interTransfers,
    stocktakes: op.stocktakes,
    kardex: op.kardex.map((k) => ({ ...k, warehouseId: op.warehouses.find((w) => w.name === k.warehouseName)?.id })),
    payrollSlips: op.payrollSlips,
    employees: op.employees,
    timesheets: op.timesheets,
  };

  for (const input of seedEvents(state)) {
    // Historical events keep their own dates; numbers are put in date order afterwards.
    const { state: next, result } = postFinancialEventToState(state, { ...input, postingDate: input.postingDate ?? input.date }, {
      submitter: 'انتقال مانده‌های افتتاحیه',
      syncBalances: false,
      enforceDateOrder: false,
    });
    if (!result.ok) console.warn('[Seed]', result.error);
    state = next;
  }
  state = { ...state, paymentRequests: seedPaymentRequests(state) };
  return normalizeSeedNumbers(linkSourceDocuments(state));
}

/**
 * Seed document numbers in the live format: every journal entry is renumbered ACC-YYYY-NNNNN per fiscal
 * year in date order, other series (PO-1403-12 …) are padded to the same width, and every reference to
 * an old number anywhere in the dataset is rewritten.
 */
function normalizeSeedNumbers(state: AppState): AppState {
  const map = new Map<string, string>();
  const byYear = new Map<number, JournalEntry[]>();
  for (const j of state.journalEntries) {
    const y = tryFiscalYearOf(j.date);
    if (y === null) throw new Error(`[Seed] سند ${j.docNumber} تاریخ نامعتبر دارد: ${j.date}`);
    byYear.set(y, [...(byYear.get(y) || []), j]);
  }
  for (const [y, list] of byYear) {
    const sorted = list
      .map((j, i) => ({ j, i }))
      .sort((a, b) => (dayIndex(a.j.date) || 0) - (dayIndex(b.j.date) || 0) || a.i - b.i);
    sorted.forEach(({ j }, n) => map.set(j.docNumber, `ACC-${y}-${String(n + 1).padStart(DOC_SEQUENCE_DIGITS, '0')}`));
  }
  const pad = (code: string) => {
    const m = code.match(/^([A-Z]{2,4})-(1[34]\d{2})-(\d{1,4})$/);
    return m ? `${m[1]}-${m[2]}-${m[3].padStart(DOC_SEQUENCE_DIGITS, '0')}` : code;
  };
  const oldCodes = [...map.keys()].filter(Boolean).sort((a, b) => b.length - a.length);
  const pattern = oldCodes.length ? new RegExp(oldCodes.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : null;
  const rewrite = (text: string): string => {
    if (map.has(text)) return map.get(text)!;
    const padded = pad(text);
    if (padded !== text) return padded;
    return pattern && text.length > 8 ? text.replace(pattern, (m) => map.get(m) || m) : text;
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return rewrite(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = k === 'id' ? x : walk(x);
      return out;
    }
    return v;
  };
  const next = walk(state) as AppState;
  // Keep entries sorted newest first, as the live ledger lists them.
  return { ...next, journalEntries: [...next.journalEntries].sort((a, b) => b.docNumber.localeCompare(a.docNumber)) };
}

/** Stamps each operational record with the accounting document created for it. */
function linkSourceDocuments(state: AppState): AppState {
  const doc = (type: string, sourceId: string) =>
    state.financialEvents.find((e) => e.type === type && e.sourceId === sourceId)?.docNumber;
  const payrollDocBySlip = new Map<string, string>();
  for (const e of state.financialEvents) {
    if (e.type !== 'PAYROLL_APPROVED') continue;
    for (const id of (e.details?.slipIds as string[]) || []) payrollDocBySlip.set(id, e.docNumber!);
  }
  return {
    ...state,
    clientStatements: state.clientStatements.map((s) => ({
      ...s,
      accountingJournalEntryId: doc('CLIENT_STATEMENT_APPROVED', s.id) || s.accountingJournalEntryId,
    })),
    subcontractorStatements: state.subcontractorStatements.map((s) => ({
      ...s,
      projectExpenseRecordId: doc('SUBCONTRACTOR_STATEMENT_APPROVED', s.id) || s.projectExpenseRecordId,
    })),
    goodsReceipts: state.goodsReceipts.map((g) => ({
      ...g,
      accountingJournalEntryId: doc('GOODS_RECEIPT', g.id) || g.accountingJournalEntryId,
    })),
    vendorInvoices: state.vendorInvoices.map((i) => ({
      ...i,
      accountingEntryNumber: doc('VENDOR_INVOICE', i.id) || i.accountingEntryNumber,
    })),
    storeIssues: state.storeIssues.map((v) => ({
      ...v,
      accountingJournalEntryId: doc('STORE_ISSUE', v.id) || v.accountingJournalEntryId,
    })),
    pettyCashExpenses: state.pettyCashExpenses.map((x) => ({
      ...x,
      journalEntryId: doc('PETTY_CASH_EXPENSE_APPROVED', x.id) || x.journalEntryId,
    })),
    receipts: state.receipts.map((r) => ({ ...r, journalEntryId: doc('TREASURY_RECEIPT', r.id) || r.journalEntryId })),
    payrollSlips: state.payrollSlips.map((s) => ({ ...s, journalEntryId: payrollDocBySlip.get(s.id) || s.journalEntryId })),
  };
}
