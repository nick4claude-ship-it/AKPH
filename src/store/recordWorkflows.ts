/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Workflows that create or change master records (contracts, suppliers, materials, funds...).
 * Screens send only what the user typed; ids, numbers, statuses, derived amounts, permission checks
 * and audit rows are produced here. Exposed to the UI through useWorkflows().
 */

import type {
  AmendmentType,
  AppDocument,
  DocumentLink,
  AuditLog,
  PettyCashAccount,
  PettyCashCategoryItem,
  PettyCashExpense,
  Contract,
  ContractAmendment,
  ContractAuditLog,
  ContractStatus,
  ContractType,
  DetailedProgressStatement,
  InterWarehouseTransfer,
  MaterialItem,
  StoreIssueVoucher,
  PurchaseOrder,
  PurchaseRequisition,
  RequestForQuotation,
  Supplier,
  SubcontractorContract,
  SubcontractorProgressStatement,
  SubcontractorTradeType,
} from '../types';
import { fail, guard, historyEntry, now, ok, today, type WorkflowEnv, type WorkflowResult } from './workflowKit';
import {
  addDocument,
  advanceClientStatement,
  advanceSubcontractorStatement,
  applyStocktake,
  approveJournalEntry,
  closeFiscalYear,
  createManualJournalEntry,
  createPaymentRequest,
  executePayment,
  reconcileBankItem,
  rejectJournalEntry,
  reverseJournalEntry,
  createClientStatement,
  createSubcontractorStatement,
  createTransfer,
  requestStoreIssue,
  submitPettyCashExpense,
  returnClientStatement,
  returnSubcontractorStatement,
} from './workflows';
import {
  amendmentChangePercent,
  computeClientStatementDraft,
  computeSubcontractorStatementDraft,
  subcontractRetentionDeposit,
  type ClientStatementFormInput,
  type SubcontractorStatementFormInput,
} from './views/contracts';
import { validateSubcontractorStatement } from './subcontractLines';
import { computePurchaseOrderDraft, requisitionEstimate, type PurchaseOrderFormInput, type RequisitionFormInput } from './views/procurement';
import { formatMoney, roundRial } from '../utils/money';
import { manualBeneficiaryType, type ManualPaymentRequestInput, type PaymentFormInput } from './views/treasury';
import { buildManualEntry, computeManualEntryDraft, type ManualEntryFormInput } from './views/accounting';
import { fundTypeForHolderRole, type PettyExpenseFormInput } from './views/pettyCash';
import { computeStoreIssueDraft, computeTransferDraft, type StoreIssueFormInput, type TransferFormInput } from './views/inventory';
import { generateUUID, nextDocNumber } from '../utils/ids';
import { getRelativePersianDate } from '../utils/date';
import { toPersianDigits } from '../utils/formatters';

// =============================================================================
// Client contracts
// =============================================================================

export interface NewClientContractInput {
  code: string;
  number: string;
  projectTitle: string;
  projectId: string;
  employer: string;
  executiveBody: string;
  consultant: string;
  contractor: string;
  /** Integer Rials. */
  initialValue: number;
  contractDate: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  contractType: ContractType;
  status: ContractStatus;
  advancePaymentPercentage: number;
  retentionPercentage: number;
  description: string;
}

function contractAudit(env: WorkflowEnv, contractId: string, action: ContractAuditLog['action'], targetField: string, oldValue: string, newValue: string, reason: string): ContractAuditLog {
  return { id: generateUUID(), contractId, user: env.user.name, role: env.user.role, date: today(), time: now(), action, targetField, oldValue, newValue, reason };
}

/** A new client contract; its client and cost center come from the project. */
export function createClientContract(env: WorkflowEnv, input: NewClientContractInput): WorkflowResult {
  const deny = guard(env, 'contract.manage', { projectId: input.projectId });
  if (deny) return deny;
  if (!input.projectTitle.trim() || !input.employer.trim()) return fail('لطفاً عنوان پیمان و نام کارفرما را وارد فرمایید.');
  if (!(input.initialValue > 0)) return fail('مبلغ اولیه قرارداد باید بیش از صفر باشد.');
  if (input.advancePaymentPercentage > 100 || input.retentionPercentage > 100) return fail('درصدها نمی‌توانند بیش از ۱۰۰ باشند.');
  const state = env.getState();
  const project = state.projects.find((p) => p.id === input.projectId);
  if (!project) return fail('پروژه را انتخاب کنید.');
  if (!project.clientId || !project.costCenterIds?.[0]) return fail('برای این پروژه کارفرما یا مرکز هزینه تعریف نشده است.');
  const code = input.code.trim() || nextDocNumber(state.contracts.map((c) => c.code), 'CNT');
  if (state.contracts.some((c) => c.code === code)) return fail(`کد قرارداد ${code} قبلاً ثبت شده است.`);

  const contract: Contract = {
    id: generateUUID(),
    code,
    number: input.number,
    projectTitle: input.projectTitle,
    projectId: project.id,
    projectName: project.name,
    counterpartyId: project.clientId,
    costCenterId: project.costCenterIds[0],
    employer: input.employer,
    executiveBody: input.executiveBody || input.employer,
    consultant: input.consultant || 'مهندسین مشاور همکار',
    contractor: input.contractor,
    initialValue: input.initialValue,
    approvedChangesValue: 0,
    currentValue: input.initialValue,
    executedValue: 0,
    remainingValue: input.initialValue,
    billedValue: 0,
    approvedBilledValue: 0,
    receivedValue: 0,
    receivableValue: 0,
    contractDate: input.contractDate,
    startDate: input.startDate,
    endDate: input.endDate,
    durationMonths: input.durationMonths,
    durationExtensionMonths: 0,
    contractType: input.contractType,
    status: input.status,
    advancePaymentPercentage: input.advancePaymentPercentage,
    retentionPercentage: input.retentionPercentage,
    description: input.description,
  };
  env.set('contracts', (prev) => [contract, ...prev]);
  env.set('contractAuditLogs', (prev) => [contractAudit(env, contract.id, 'تأیید', 'contract', '-', contract.code, 'انعقاد قرارداد جدید'), ...prev]);
  return ok(`قرارداد ${contract.code} ثبت شد.`, { id: contract.id });
}

export interface NewAmendmentInput {
  number: string;
  type: AmendmentType;
  date: string;
  /** Integer Rials; the effect on the contract value. */
  amount: number;
  extendedDays: number;
  description: string;
  status: ContractAmendment['status'];
}

/** An amendment; an approved one raises the contract value and extends its duration. */
export function createContractAmendment(env: WorkflowEnv, contractId: string, input: NewAmendmentInput): WorkflowResult {
  const contract = env.getState().contracts.find((c) => c.id === contractId);
  if (!contract) return fail('قرارداد یافت نشد.');
  const deny = guard(env, 'contract.manage', { projectId: contract.projectId });
  if (deny) return deny;
  if (!input.number.trim()) return fail('شماره الحاقیه را وارد کنید.');
  if (input.amount <= 0 && input.extendedDays <= 0) return fail('مبلغ یا مدت تمدید الحاقیه را وارد کنید.');

  const approved = input.status === 'تأیید شده';
  const amendment: ContractAmendment = {
    id: generateUUID(),
    contractId,
    number: input.number,
    type: input.type,
    date: input.date,
    amount: input.amount,
    changePercentage: amendmentChangePercent(contract, input.amount),
    extendedDays: input.extendedDays,
    description: input.description,
    status: input.status,
    approvedBy: approved ? contract.employer : undefined,
    approvalDate: approved ? input.date : undefined,
  };
  env.set('contractAmendments', (prev) => [amendment, ...prev]);
  if (approved) {
    env.set('contracts', (prev) =>
      prev.map((c) => {
        if (c.id !== contractId) return c;
        const approvedChangesValue = c.approvedChangesValue + input.amount;
        const currentValue = c.initialValue + approvedChangesValue;
        return {
          ...c,
          approvedChangesValue,
          currentValue,
          remainingValue: Math.max(0, currentValue - c.executedValue),
          durationExtensionMonths: c.durationExtensionMonths + Math.round(input.extendedDays / 30),
        };
      })
    );
  }
  return ok(`الحاقیه ${amendment.number} ثبت شد.`, { id: amendment.id });
}

// =============================================================================
// Client statements
// =============================================================================

/** Saves the statement form: amounts are recomputed here from the quantities and rates, never taken from the screen. */
export function submitClientStatementForm(env: WorkflowEnv, form: ClientStatementFormInput, target: 'draft' | 'submitted_to_consultant'): WorkflowResult {
  const draft = computeClientStatementDraft(env.getState(), form);
  if (draft.error || !draft.contract) return fail(draft.error || 'قرارداد را انتخاب کنید.');
  const c = draft.contract;
  const statement: DetailedProgressStatement = {
    id: generateUUID(),
    statementNumber: form.statementNumber,
    contractId: c.id,
    contractCode: c.code,
    contractNumber: c.number,
    projectId: c.projectId,
    projectName: c.projectName,
    costCenterId: c.costCenterId,
    counterpartyId: c.counterpartyId,
    client: c.employer,
    consultant: c.consultant || 'مهندسین مشاور پروژه',
    type: form.statementType,
    periodStartDate: form.periodStartDate,
    periodEndDate: form.periodEndDate,
    preparationDate: form.preparationDate,
    preparerName: env.user.name,
    description: form.description,
    status: target,
    items: draft.items.filter((i) => i.currentQuantity > 0).map((i) => ({ ...i, id: generateUUID() })),
    workAmountCurrent: draft.workAmountCurrent,
    otherAllowableItemsAmount: form.otherAllowables,
    adjustmentAmount: form.adjustmentAmount,
    vatAmount: draft.vatAmount,
    grossAmount: draft.grossAmount,
    deductions: draft.deductions,
    totalDeductions: draft.totalDeductions,
    netPayable: draft.netPayable,
    approvedNetPayable: 0,
    receivedAmount: 0,
    remainingPayable: draft.netPayable,
    dueDate: getRelativePersianDate(30),
    paymentStatus: 'Unpaid',
    overdueDays: 0,
    workflowHistory: [
      historyEntry(env, 'draft', target, target === 'draft' ? 'ایجاد پیش‌نویس صورت‌وضعیت کارگاه' : 'ارسال مستقیم به مهندس مشاور'),
    ],
  };
  return createClientStatement(env, statement);
}

/** The next approval step of a client statement, or its return to the site with a reason. */
export function decideClientStatement(env: WorkflowEnv, id: string, decision: 'approve' | 'return', reason?: string): WorkflowResult {
  if (decision === 'return') {
    if (!reason?.trim()) return fail('دلیل بازگشت صورت‌وضعیت را بنویسید.');
    return returnClientStatement(env, id, reason.trim());
  }
  return advanceClientStatement(env, id, reason);
}

// =============================================================================
// Subcontracts
// =============================================================================

export interface NewSubcontractInput {
  projectId: string;
  subcontractorName: string;
  subcontractorPhone: string;
  tradeType: SubcontractorTradeType;
  contractNumber: string;
  title: string;
  /** Integer Rials. */
  contractValue: number;
  unitRateDescription: string;
  startDate: string;
  endDate: string;
  advancePaid: number;
  retentionDepositRate: number;
  notes: string;
}

export function createSubcontractorContract(env: WorkflowEnv, input: NewSubcontractInput): WorkflowResult {
  const state = env.getState();
  const project = state.projects.find((p) => p.id === input.projectId);
  if (!project) return fail('پروژه را انتخاب کنید.');
  const deny = guard(env, 'contract.manage', { projectId: project.id });
  if (deny) return deny;
  if (!input.subcontractorName.trim()) return fail('نام پیمانکار را وارد کنید.');
  if (!(input.contractValue > 0)) return fail('مبلغ قرارداد باید بیش از صفر باشد.');
  if (input.advancePaid > input.contractValue) return fail('پیش‌پرداخت از مبلغ قرارداد بیشتر است.');
  if (input.retentionDepositRate > 100) return fail('درصد سپرده نمی‌تواند بیش از ۱۰۰ باشد.');
  if (!project.costCenterIds?.[0]) return fail('برای این پروژه مرکز هزینه تعریف نشده است.');
  // The subcontractor's ledger account: the counterparty with the same name, else the general subcontractors account.
  const subcontractors = state.counterparties.filter((c) => c.kind === 'subcontractor');
  const counterpartyId = (subcontractors.find((c) => c.name === input.subcontractorName.trim()) || subcontractors[0])?.id || 'cp-sub-01';

  const contract: SubcontractorContract = {
    id: generateUUID(),
    contractNumber: input.contractNumber.trim() || nextDocNumber(state.subcontractorContracts.map((c) => c.contractNumber), 'SUB'),
    title: input.title || `عملیات ${input.tradeType} پروژه ${project.name}`,
    projectId: project.id,
    projectName: project.name,
    costCenterId: project.costCenterIds[0],
    counterpartyId,
    subcontractorName: input.subcontractorName.trim(),
    subcontractorPhone: input.subcontractorPhone,
    tradeType: input.tradeType,
    contractValue: input.contractValue,
    executedValue: 0,
    approvedStatementsValue: 0,
    paidValue: 0,
    remainingPayableValue: 0,
    remainingContractValue: input.contractValue,
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'فعال',
    unitRateDescription: input.unitRateDescription,
    advancePaid: input.advancePaid,
    retentionDeposit: subcontractRetentionDeposit(input.contractValue, input.retentionDepositRate),
    penaltyOrDeductions: 0,
    notes: input.notes,
  };
  env.set('subcontractorContracts', (prev) => [contract, ...prev]);
  return ok(`قرارداد ${contract.contractNumber} با ${contract.subcontractorName} ثبت شد.`, { id: contract.id });
}

/** Saves the subcontractor statement form (amounts recomputed from the lines). */
export function submitSubcontractorStatementForm(env: WorkflowEnv, form: SubcontractorStatementFormInput): WorkflowResult {
  const state = env.getState();
  const contract = state.subcontractorContracts.find((c) => c.id === form.contractId);
  if (!contract) return fail('قرارداد پیمانکار را انتخاب کنید.');
  const draft = computeSubcontractorStatementDraft(state, form);
  if (draft.error) return fail(draft.error);
  const statement: SubcontractorProgressStatement = {
    id: generateUUID(),
    statementNumber: form.statementNumber,
    subcontractorContractId: contract.id,
    subcontractorContractNumber: contract.contractNumber,
    costCenterId: contract.costCenterId,
    counterpartyId: contract.counterpartyId,
    subcontractorName: contract.subcontractorName,
    tradeType: contract.tradeType,
    projectId: contract.projectId,
    projectName: contract.projectName,
    periodStartDate: form.periodStartDate,
    periodEndDate: form.periodEndDate,
    submissionDate: today(),
    items: draft.items,
    grossAmount: draft.grossAmount,
    siteVerifiedAmount: draft.grossAmount,
    deductions: {
      retention: draft.retentionAmount,
      advancePaymentDeduction: form.advanceDeduction,
      safetyOrWastePenalty: form.penaltyAmount,
      otherDeductions: form.otherDeduction,
      description: `کسر ${toPersianDigits(form.retentionRate)}٪ سپرده حسن انجام کار و استهلاک پیش‌پرداخت`,
    },
    totalDeductions: draft.totalDeductions,
    netPayable: draft.netPayable,
    paidAmount: 0,
    remainingPayable: draft.netPayable,
    status: 'submitted',
    workflowHistory: [
      historyEntry(env, 'submitted', 'submitted', 'ثبت صورت‌وضعیت در سامانه', `کارکرد دوره ${form.periodStartDate} الی ${form.periodEndDate}`),
    ],
  };
  const invalid = validateSubcontractorStatement(state, statement);
  if (invalid) return fail(invalid);
  return createSubcontractorStatement(env, statement);
}

/** Next approval step of a subcontractor statement, its return for revision, or its rejection. */
export function decideSubcontractorStatement(env: WorkflowEnv, id: string, decision: 'approve' | 'return' | 'reject', comment?: string): WorkflowResult {
  if (decision === 'approve') return advanceSubcontractorStatement(env, id, comment);
  return returnSubcontractorStatement(env, id, comment?.trim() || 'نیاز به اصلاح متره', decision === 'reject');
}

// =============================================================================
// Procurement
// =============================================================================

/** A purchase requisition by the signed-in user; nobody's approval is pre-filled. */
export function createRequisition(env: WorkflowEnv, form: RequisitionFormInput): WorkflowResult {
  const state = env.getState();
  const project = state.projects.find((p) => p.id === form.projectId);
  if (!project) return fail('پروژه را انتخاب کنید.');
  const deny = guard(env, 'requisition.create', { projectId: project.id });
  if (deny) return deny;
  if (form.items.some((it) => !it.materialName.trim())) return fail('نام کالای هر ردیف را وارد کنید.');
  if (form.items.some((it) => it.requestedQty <= 0)) return fail('مقدار هر ردیف باید بیش از صفر باشد.');
  const requisition: PurchaseRequisition = {
    id: generateUUID(),
    requisitionNumber: nextDocNumber(state.purchaseRequisitions.map((r) => r.requisitionNumber), 'PR'),
    date: today(),
    projectId: project.id,
    projectName: project.name,
    wbsCode: form.costCenter.trim(),
    costCenter: form.costCenter.trim(),
    priority: form.priority,
    status: 'پیش‌نویس کارگاه',
    requesterName: env.user.name,
    requesterId: env.user.id,
    requesterRole: env.user.role,
    justification: form.justification.trim(),
    totalEstimatedAmount: requisitionEstimate(form.items),
    approvals: {},
    items: form.items.map((it) => ({
      id: it.id,
      materialCode: it.materialCode,
      materialName: it.materialName.trim(),
      specification: it.specification,
      category: it.category,
      requestedQty: it.requestedQty,
      approvedQty: it.requestedQty,
      unit: it.unit,
      estimatedUnitPrice: it.estimatedUnitPrice,
      estimatedTotalPrice: it.requestedQty * it.estimatedUnitPrice,
      requiredDeliveryDate: it.requiredDeliveryDate,
      suggestedVendors: it.suggestedVendors ? [it.suggestedVendors] : [],
    })),
  };
  env.set('purchaseRequisitions', (prev) => [requisition, ...prev]);
  return ok(`درخواست خرید ${requisition.requisitionNumber} ثبت شد.`, { id: requisition.id });
}

/** A request for quotation for the lines of a requisition. */
export function createRfqFromRequisition(env: WorkflowEnv, requisitionId: string): WorkflowResult {
  const state = env.getState();
  const req = state.purchaseRequisitions.find((r) => r.id === requisitionId);
  if (!req) return fail('درخواست خرید یافت نشد.');
  const deny = guard(env, 'purchase_order.create', { projectId: req.projectId });
  if (deny) return fail('اجازه صدور استعلام بها را ندارید.');
  const rfq: RequestForQuotation = {
    id: generateUUID(),
    rfqNumber: nextDocNumber(state.rfqs.map((r) => r.rfqNumber), 'RFQ'),
    title: `استعلام بهای اقلام درخواست ${req.requisitionNumber}`,
    dateCreated: today(),
    submissionDeadline: getRelativePersianDate(7),
    requisitionId: req.id,
    requisitionNumber: req.requisitionNumber,
    projectId: req.projectId,
    projectName: req.projectName,
    category: req.items[0]?.category || 'آهن‌آلات و مقاطع فولادی',
    materialName: req.items.map((i) => i.materialName).join('، '),
    specification: req.items[0]?.specification || 'طبق استاندارد پروژه',
    requiredQty: req.items.reduce((acc, i) => acc + i.approvedQty, 0),
    unit: req.items[0]?.unit || 'واحد',
    quotes: [],
    status: 'در حال استعلام',
  };
  env.set('rfqs', (prev) => [rfq, ...prev]);
  return ok(`استعلام بها ${rfq.rfqNumber} صادر شد.`, { id: rfq.id });
}

/** The commission's choice among the quotes of an RFQ. */
export function selectWinningBid(env: WorkflowEnv, rfqId: string, quoteId: string): WorkflowResult {
  const rfq = env.getState().rfqs.find((r) => r.id === rfqId);
  if (!rfq) return fail('استعلام یافت نشد.');
  const deny = guard(env, 'purchase_order.create', { projectId: rfq.projectId });
  if (deny) return deny;
  const winning = rfq.quotes.find((q) => q.id === quoteId);
  if (!winning) return fail('پیشنهاد انتخاب‌شده در این استعلام نیست.');
  env.set('rfqs', (prev) =>
    prev.map((r) =>
      r.id !== rfqId
        ? r
        : {
            ...r,
            quotes: r.quotes.map((q) => ({ ...q, isWinningBid: q.id === quoteId })),
            status: 'برنده مشخص شد',
            selectedSupplierId: winning.supplierId,
            selectedSupplierName: winning.supplierName,
          }
    )
  );
  return ok(`${winning.supplierName} برنده استعلام ${rfq.rfqNumber} شد.`);
}

function purchaseOrderBase(env: WorkflowEnv, state: ReturnType<WorkflowEnv['getState']>) {
  return {
    id: generateUUID(),
    poNumber: nextDocNumber(state.purchaseOrders.map((o) => o.poNumber), 'PO'),
    issueDate: today(),
    advancePaymentPaid: false,
    status: 'صادر شده و ابلاغ به فروشنده' as PurchaseOrder['status'],
    deliveryProgressPercentage: 0,
    issuedBy: `${env.user.name} (${env.user.role})`,
    approvedBy: '',
  };
}

/** A purchase order from the winning quote of an RFQ (VAT only when the supplier is VAT-registered). */
export function createPurchaseOrderFromRfq(env: WorkflowEnv, rfqId: string): WorkflowResult {
  const state = env.getState();
  const rfq = state.rfqs.find((r) => r.id === rfqId);
  if (!rfq) return fail('استعلام یافت نشد.');
  const winning = rfq.quotes.find((q) => q.isWinningBid);
  if (!winning) return fail('ابتدا برنده استعلام را مشخص کنید.');
  const deny = guard(env, 'purchase_order.create', { projectId: rfq.projectId });
  if (deny) return fail('اجازه صدور سفارش خرید را ندارید.');
  const supplier = state.suppliers.find((s) => s.id === winning.supplierId);
  const project = state.projects.find((p) => p.id === rfq.projectId);
  const material = state.materials.find((m) => m.name === rfq.materialName);
  const vatRate = winning.vatIncluded ? state.financeSettings.vatRatePercent / 100 : 0;
  const net = roundRial(winning.unitPrice * rfq.requiredQty);
  const vat = roundRial(net * vatRate);
  const freight = roundRial(winning.freightCostPerUnit * rfq.requiredQty);
  const total = net + vat + freight;
  const order: PurchaseOrder = {
    ...purchaseOrderBase(env, state),
    deliveryDueDate: getRelativePersianDate(winning.deliveryLeadTimeDays || 14),
    requisitionId: rfq.requisitionId,
    rfqId: rfq.id,
    projectId: rfq.projectId,
    projectName: rfq.projectName,
    costCenterId: project?.costCenterIds?.[0],
    counterpartyId: state.counterparties.find((c) => c.kind === 'supplier' && c.name === winning.supplierName)?.id,
    destinationWarehouse: state.warehouses.find((w) => w.projectId === rfq.projectId)?.name ?? 'انبار کارگاه پروژه',
    supplierId: winning.supplierId,
    supplierName: winning.supplierName,
    supplierPhone: supplier?.phone ?? '',
    supplierAddress: supplier?.address ?? '',
    items: [
      {
        id: generateUUID(),
        materialCode: material?.code ?? '',
        materialName: rfq.materialName,
        specifications: rfq.specification,
        orderedQty: rfq.requiredQty,
        receivedQty: 0,
        unit: rfq.unit,
        unitPrice: winning.unitPrice,
        totalNetPrice: net,
        vatRate,
        vatAmount: vat,
        freightAndUnloadingCost: freight,
        totalGrossAmount: total,
      },
    ],
    subtotalAmount: net,
    totalVatAmount: vat,
    totalFreightCost: freight,
    totalOrderAmount: total,
    paymentTerms: winning.paymentTerms,
    advancePaymentAmount: 0,
    termsAndConditions: ['تحویل با بارنامه رسمی'],
  };
  env.set('purchaseOrders', (prev) => [order, ...prev]);
  return ok(`سفارش ${order.poNumber} صادر شد.`, { id: order.id });
}

/** A purchase order typed in the form (amounts recomputed here). */
export function createPurchaseOrder(env: WorkflowEnv, form: PurchaseOrderFormInput): WorkflowResult {
  const state = env.getState();
  const draft = computePurchaseOrderDraft(state, form);
  if (draft.error) return fail(draft.error);
  const project = state.projects.find((p) => p.id === form.projectId)!;
  const supplier = state.suppliers.find((s) => s.id === form.supplierId)!;
  const deny = guard(env, 'purchase_order.create', { projectId: project.id });
  if (deny) return fail('اجازه صدور سفارش خرید را ندارید.');
  const order: PurchaseOrder = {
    ...purchaseOrderBase(env, state),
    deliveryDueDate: form.deliveryDueDate,
    projectId: project.id,
    projectName: project.name,
    costCenterId: project.costCenterIds?.[0],
    destinationWarehouse: form.destinationWarehouse,
    supplierId: supplier.id,
    counterpartyId: state.counterparties.find((c) => c.kind === 'supplier' && c.name === supplier.name)?.id,
    supplierName: supplier.name,
    supplierPhone: supplier.phone,
    supplierAddress: supplier.address,
    items: draft.lines.map((l) => ({
      id: l.id,
      materialCode: l.materialCode,
      materialName: l.materialName.trim(),
      specifications: l.specifications,
      orderedQty: l.orderedQty,
      receivedQty: 0,
      unit: l.unit.trim(),
      unitPrice: l.unitPrice,
      totalNetPrice: l.net,
      vatRate: draft.vatRate,
      vatAmount: l.vat,
      freightAndUnloadingCost: l.freightAndUnloadingCost,
      totalGrossAmount: l.gross,
    })),
    subtotalAmount: draft.subtotal,
    totalVatAmount: draft.totalVat,
    totalFreightCost: draft.totalFreight,
    totalOrderAmount: draft.grandTotal,
    paymentTerms: form.paymentTerms,
    // Issuing the order does not pay the advance; treasury does.
    advancePaymentAmount: form.advancePaymentAmount,
    termsAndConditions: [
      'توزین نهایی ملاک تسویه، باسکول دیجیتال پای کارگاه می‌باشد.',
      'فروشنده متعهد به صدور فاکتور رسمی در سامانه مودیان مالیاتی کشور است.',
      'هرگونه مغایرت فنی در آزمایشگاه موجب عودت کل بار به هزینه فروشنده است.',
    ],
  };
  env.set('purchaseOrders', (prev) => [order, ...prev]);
  return ok(`سفارش ${order.poNumber} صادر شد.`, { id: order.id });
}

export function updatePurchaseOrderStatus(env: WorkflowEnv, orderId: string, status: PurchaseOrder['status']): WorkflowResult {
  const order = env.getState().purchaseOrders.find((o) => o.id === orderId);
  if (!order) return fail('سفارش یافت نشد.');
  const deny = guard(env, 'purchase_order.create', { projectId: order.projectId });
  if (deny) return fail('اجازه تغییر وضعیت سفارش را ندارید.');
  env.set('purchaseOrders', (prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  return ok(`وضعیت سفارش ${order.poNumber}: ${status}`);
}

export type NewSupplierInput = Pick<
  Supplier,
  'name' | 'category' | 'grade' | 'nationalId' | 'economicCode' | 'contactPerson' | 'phone' | 'mobile' | 'email' | 'city' | 'address' | 'hasVatCertificate' | 'paymentTerms' | 'notes'
> & { bankName: string; shebaNumber: string; accountNumber: string; cardHolder: string };

/** A supplier in the vendor list; performance and balances start empty and build from orders and receipts. */
export function createSupplier(env: WorkflowEnv, input: NewSupplierInput): WorkflowResult {
  const deny = guard(env, 'supplier.manage');
  if (deny) return fail('اجازه تعریف تأمین‌کننده را ندارید.');
  if (!input.name.trim()) return fail('نام تأمین‌کننده را وارد کنید.');
  const state = env.getState();
  const supplier: Supplier = {
    id: generateUUID(),
    code: nextDocNumber(state.suppliers.map((s) => s.code), 'VEN'),
    name: input.name.trim(),
    category: input.category,
    grade: input.grade,
    nationalId: input.nationalId,
    economicCode: input.economicCode,
    contactPerson: input.contactPerson,
    phone: input.phone,
    mobile: input.mobile,
    email: input.email,
    city: input.city,
    address: input.address,
    bankAccount: { bankName: input.bankName, shebaNumber: input.shebaNumber, accountNumber: input.accountNumber, cardHolder: input.cardHolder || input.name },
    hasVatCertificate: input.hasVatCertificate,
    paymentTerms: input.paymentTerms,
    performance: { qualityScore: 0, deliveryScore: 0, priceCompetitiveness: 0, paymentFlexibility: 0, overallRating: 0, totalOrdersCount: 0, onTimeDeliveryRate: 0, rejectionRate: 0 },
    financials: { totalPurchasesAmount: 0, currentPayableBalance: 0, unclearedChecksAmount: 0, lastTransactionDate: '—' },
    status: 'فعال در وندورلیست',
    notes: input.notes,
  };
  env.set('suppliers', (prev) => [supplier, ...prev]);
  return ok(`تأمین‌کننده ${supplier.name} با کد ${supplier.code} ثبت شد.`, { id: supplier.id });
}

// =============================================================================
// Inventory
// =============================================================================

export type NewMaterialInput = Pick<MaterialItem, 'name' | 'category' | 'unit' | 'reorderLevel' | 'minSafetyStock' | 'maxCapacity'> & {
  specifications: string;
  standardGrade: string;
  storageLocationBin: string;
};

/** A catalog item. Stock and its cost enter only through goods receipts (so the ledger and the kardex agree). */
export function createMaterial(env: WorkflowEnv, input: NewMaterialInput): WorkflowResult {
  const deny = guard(env, 'inventory.manage_catalog');
  if (deny) return fail('اجازه تعریف کالا را ندارید.');
  if (!input.name.trim()) return fail('نام کالا را وارد کنید.');
  if (input.minSafetyStock > input.reorderLevel && input.reorderLevel > 0) return fail('حداقل موجودی ایمن نباید از نقطه سفارش بیشتر باشد.');
  const material: MaterialItem = {
    id: generateUUID(),
    code: nextDocNumber(env.getState().materials.map((m) => m.code), 'MAT'),
    name: input.name.trim(),
    category: input.category,
    unit: input.unit,
    specifications: input.specifications.trim() || 'مشخصات استاندارد مهندسی',
    standardGrade: input.standardGrade.trim() || undefined,
    reorderLevel: input.reorderLevel,
    minSafetyStock: input.minSafetyStock,
    maxCapacity: input.maxCapacity,
    currentStock: 0,
    averageUnitPrice: 0,
    totalStockValue: 0,
    requiresInspection: true,
    storageLocationBin: input.storageLocationBin.trim() || 'انبار سرپوشیده',
  };
  env.set('materials', (prev) => [material, ...prev]);
  return ok(`کدینگ متریال جدید "${material.name}" در کاتالوگ ثبت شد.`, { id: material.id });
}

/** Store issue from the form: priced at the weighted average; reserves or issues the stock. */
export function submitStoreIssueForm(env: WorkflowEnv, form: StoreIssueFormInput): WorkflowResult {
  const draft = computeStoreIssueDraft(env.getState(), form);
  if (draft.error || !draft.warehouse || !draft.project) return fail(draft.error || 'انبار مبدأ را انتخاب کنید.');
  const sub = form.subcontractorName.trim();
  const voucher: StoreIssueVoucher = {
    id: generateUUID(),
    issueNumber: '',
    date: today(),
    warehouseId: draft.warehouse.id,
    warehouseName: draft.warehouse.name,
    projectId: draft.project.id,
    projectName: draft.project.name,
    costCenterId: draft.project.costCenterIds?.[0],
    costCenter: form.costCenter,
    wbsSection: form.wbsSection.trim(),
    subcontractorName: sub || undefined,
    tradeType: sub ? form.tradeType : undefined,
    isSubcontractorContra: sub ? form.isSubcontractorContra : false,
    subcontractorStatementDeductionRef: sub && form.isSubcontractorContra ? form.subcontractorDeductionRef : undefined,
    applicantName: env.user.name,
    approvedByManagerName: '',
    dispatchedByKeeperName: draft.warehouse.keeperName,
    receivedByCrewLeaderName: form.receivedByCrewLeaderName.trim(),
    items: draft.lines.map((l) => ({
      materialId: l.materialId,
      materialCode: l.materialCode,
      materialName: l.materialName,
      unit: l.unit,
      requestedQty: l.qty,
      issuedQty: l.qty,
      unitCost: l.unitCost,
      totalCost: l.totalCost,
      remarks: l.remarks,
    })),
    totalCost: draft.totalCost,
    status: form.reserveOnly ? 'درخواست اولیه' : 'خروج قطعی از انبار',
  };
  return requestStoreIssue(env, voucher);
}

/** Transfer between warehouses from the form (valued at the weighted average). */
export function submitTransferForm(env: WorkflowEnv, form: TransferFormInput): WorkflowResult {
  const draft = computeTransferDraft(env.getState(), form);
  if (draft.error || !draft.source || !draft.target) return fail(draft.error || 'انبار مبدأ و مقصد را انتخاب کنید.');
  const transfer: InterWarehouseTransfer = {
    id: generateUUID(),
    transferNumber: '',
    date: today(),
    sourceWarehouseId: draft.source.id,
    sourceWarehouseName: draft.source.name,
    sourceProjectId: draft.source.projectId || '',
    targetWarehouseId: draft.target.id,
    targetWarehouseName: draft.target.name,
    targetProjectId: draft.target.projectId || '',
    waybillNumber: form.waybillNumber.trim(),
    driverName: form.driverName.trim(),
    truckPlate: form.truckPlate.trim(),
    items: draft.lines.map((l) => ({
      materialId: l.materialId,
      materialCode: l.materialCode,
      materialName: l.materialName,
      unit: l.unit,
      quantity: l.quantity,
      unitCost: l.unitCost,
      totalCost: l.totalCost,
    })),
    totalCost: draft.totalCost,
    status: 'در مسیر حمل',
    authorizedBy: `${env.user.name} (${env.user.role})`,
  };
  return createTransfer(env, transfer);
}

/** Applies a counted stocktake (variance recomputed from stored balances, posted, kardex rows written). */
export function applyStocktakeById(env: WorkflowEnv, stocktakeId: string): WorkflowResult {
  const audit = env.getState().stocktakes.find((s) => s.id === stocktakeId);
  if (!audit) return fail('انبارگردانی یافت نشد.');
  if (audit.status === 'تأیید نهایی و صدور سند تعدیل') return fail('سند تعدیل این انبارگردانی قبلاً صادر شده است.');
  return applyStocktake(env, audit);
}

// =============================================================================
// Petty cash
// =============================================================================

export interface NewPettyFundInput {
  title: string;
  holderName: string;
  holderRole: string;
  holderPhone: string;
  projectId: string;
  sourceBankAccountId: string;
  notes: string;
}

/** A new fund starts empty; money reaches it only through a replenishment paid by treasury. */
export function createPettyCashFund(env: WorkflowEnv, input: NewPettyFundInput): WorkflowResult {
  const deny = guard(env, 'petty.manage_funds', { projectId: input.projectId || undefined });
  if (deny) return fail('اجازه تعریف تنخواه را ندارید.');
  if (!input.title.trim() || !input.holderName.trim()) return fail('لطفاً عنوان تنخواه و نام مسئول را وارد نمایید.');
  const state = env.getState();
  const project = state.projects.find((p) => p.id === input.projectId);
  const bank = state.bankAccounts.find((b) => b.id === input.sourceBankAccountId);
  const costCenter = state.costCenters.find((c) => c.projectId === input.projectId && c.type === 'کارگاه پروژه');
  // One project can hold several funds; the holder role decides the fund type and its stored limits.
  const fundType = fundTypeForHolderRole(input.holderRole);
  const limits = state.pettyCashSettings.fundLimits[fundType];
  const fund: PettyCashAccount = {
    id: generateUUID(),
    fundType,
    code: nextDocNumber(state.pettyCashAccounts.map((a) => a.code), 'PCF'),
    title: input.title,
    holderName: input.holderName,
    holderRole: input.holderRole,
    holderPhone: input.holderPhone,
    projectId: input.projectId,
    projectName: project ? project.name : 'ستاد مرکزی',
    costCenterId: costCenter?.id || '',
    costCenterName: costCenter?.name || 'ستاد مرکزی',
    ceilingLimit: limits.ceiling,
    minBalanceWarning: limits.minBalanceWarning,
    actualBalance: 0,
    pendingExpenses: 0,
    usableBalance: 0,
    sourceBankAccountId: input.sourceBankAccountId,
    sourceBankAccountTitle: bank ? `${bank.bankName} - ${bank.accountNumber}` : 'بانک شرکت',
    startDate: today(),
    status: 'active',
    monthlySpent: 0,
    lastReplenishmentDate: '-',
    lastReplenishmentAmount: 0,
    notes: input.notes,
  };
  env.set('pettyCashAccounts', (prev) => [...prev, fund]);
  return ok(`تنخواه ${fund.code} تعریف شد.`, { id: fund.id });
}

/** Expense from the form; approval level, first approver and number come from the stored policy. */
export function submitPettyExpenseForm(env: WorkflowEnv, form: PettyExpenseFormInput): WorkflowResult {
  const state = env.getState();
  const account = state.pettyCashAccounts.find((a) => a.id === form.accountId);
  if (!account) return fail('صندوق تنخواه انتخاب نشده است.');
  if (!form.amount || form.amount <= 0) return fail('مبلغ هزینه باید بیشتر از صفر باشد.');
  const toWarehouse = form.inventoryTarget === 'send_to_warehouse';
  const expense: PettyCashExpense = {
    id: generateUUID(),
    expenseNumber: '',
    pettyCashId: account.id,
    pettyCashTitle: account.title,
    projectId: account.projectId,
    projectName: account.projectName,
    costCenter: account.costCenterName,
    date: form.date,
    category: form.category,
    subCategory: form.subCategory,
    amount: form.amount,
    vendor: form.vendor,
    vendorNationalId: form.vendorNationalId,
    invoiceNumber: form.invoiceNumber,
    invoiceDate: form.invoiceDate,
    description: form.description,
    paymentMethod: form.paymentMethod,
    costCenterId: account.costCenterId,
    status: 'pending_approval',
    // Replaced by the stored thresholds and approval chains in submitPettyCashExpense.
    approvalLevelRequired: 'site_manager_and_finance',
    currentApprovalStep: 'مدیر پروژه',
    approvalHistory: [
      { level: 'ثبت اولیه', approverName: env.user.name, approverRole: env.user.role, date: form.date, time: now(), action: 'approved', comment: 'ثبت هزینه و ارسال به کارتابل تأییدات' },
    ],
    submitterName: env.user.name,
    submitterRole: env.user.role,
    inventoryTarget: form.inventoryTarget,
    inventoryItemCode: toWarehouse ? form.inventoryItemCode : undefined,
    inventoryItemName: toWarehouse ? form.inventoryItemName : undefined,
    inventoryQuantity: toWarehouse ? form.inventoryQuantity : undefined,
    inventoryUnit: toWarehouse ? form.inventoryUnit : undefined,
    accountingAccountCode: '511',
    accountingAccountName: `هزینه ${form.category} کارگاهی`,
  };
  // Attachments are archived in the document center and linked to the expense.
  const ref = form.invoiceNumber || 'تنخواه';
  const docs: Omit<AppDocument, 'links'>[] = form.attachments.map((a) => ({
    id: generateUUID(),
    title: `فاکتور ${ref} - ${form.description}`,
    type: 'فاکتور هزینه تنخواه',
    fileName: a.name,
    docNumber: ref,
    date: form.invoiceDate || form.date,
    fileFormat: a.type === 'image' ? 'JPG' : 'PDF',
    fileSize: a.size || '-',
    version: '1.0',
    status: 'معتبر و جاری',
    confidentiality: 'عادی',
    registeredBy: env.user.name,
    tags: ['تنخواه', form.category],
    description: form.description,
    url: a.url,
  }));
  return submitPettyCashExpense(env, expense, docs);
}

/** Expense categories and subcategories of petty cash (settings). */
export function updatePettyCashCategories(env: WorkflowEnv, categories: PettyCashCategoryItem[]): WorkflowResult {
  const deny = guard(env, 'settings.manage');
  if (deny) return fail('ویرایش سرفصل‌های هزینه فقط با مجوز تنظیمات ممکن است.');
  if (categories.some((c) => !c.name.trim())) return fail('نام سرفصل خالی است.');
  env.set('pettyCashCategories', () => categories);
  return ok('سرفصل‌های هزینه تنخواه ذخیره شد.');
}

// =============================================================================
// Accounting (manual vouchers, approvals, reversals and bank reconciliation, with the audit trail)
// =============================================================================

function logAudit(env: WorkflowEnv, action: AuditLog['action'], targetDoc: string, description: string) {
  env.set('auditLogs', (prev) => [
    { id: generateUUID(), date: today(), time: now(), user: env.user.name, role: env.user.role, action, targetDoc, description },
    ...prev,
  ]);
}

/** Runs a workflow and records it in the audit trail when it succeeds. */
function audited(env: WorkflowEnv, result: WorkflowResult, action: AuditLog['action'], target: string, description: string): WorkflowResult {
  if (result.ok) logAudit(env, action, result.docNumber || target, description);
  return result;
}

/** Manual voucher from the form (totals recomputed; saved pending approval by another user). */
export function submitManualJournalEntryForm(env: WorkflowEnv, form: ManualEntryFormInput): WorkflowResult {
  const draft = computeManualEntryDraft(form);
  if (draft.error) return fail(draft.error);
  const entry = buildManualEntry(env.getState(), form);
  return audited(env, createManualJournalEntry(env, entry), 'ایجاد سند', entry.title, `ثبت سند دستی «${entry.title}»`);
}

export function approveJournalEntryLogged(env: WorkflowEnv, id: string): WorkflowResult {
  return audited(env, approveJournalEntry(env, id), 'تأیید سند', id, 'تأیید و ثبت قطعی سند دستی');
}

export function rejectJournalEntryLogged(env: WorkflowEnv, id: string, reason: string): WorkflowResult {
  return audited(env, rejectJournalEntry(env, id, reason), 'رد سند', id, `رد سند: ${reason}`);
}

export function reverseJournalEntryLogged(env: WorkflowEnv, id: string, reason: string): WorkflowResult {
  return audited(env, reverseJournalEntry(env, id, reason), 'سند معکوس', id, `صدور سند معکوس: ${reason}`);
}

/** A bank statement line without a ledger document becomes a pending voucher (second approval). */
export function reconcileBankItemLogged(env: WorkflowEnv, itemId: string): WorkflowResult {
  const item = env.getState().bankReconciliations.find((r) => r.id === itemId);
  if (!item) return fail('قلم صورت‌حساب بانکی یافت نشد.');
  return audited(env, reconcileBankItem(env, itemId), 'تطبیق بانکی', item.id, `تطبیق قلم صورت‌حساب بانکی: ${item.description}`);
}

export function closeFiscalYearLogged(env: WorkflowEnv, year: number): WorkflowResult {
  return audited(env, closeFiscalYear(env, year), 'بستن دوره', `FY-${year}`, `بستن سال مالی ${year}`);
}

// =============================================================================
// Treasury
// =============================================================================

/** Pays (part of) an approved request from a bank account or a cash desk. */
export function payRequestForm(env: WorkflowEnv, form: PaymentFormInput): WorkflowResult {
  const req = env.getState().paymentRequests.find((r) => r.id === form.requestId);
  if (!req) return fail('درخواست پرداخت یافت نشد.');
  if (form.amount <= 0) return fail('مبلغ پرداخت باید بیش از صفر باشد.');
  if (form.amount > req.remainingAmount) return fail(`مبلغ پرداخت از مانده (${formatMoney(req.remainingAmount)}) بیشتر است.`);
  if (!form.sourceId) return fail('حساب بانکی یا صندوق پرداخت‌کننده را انتخاب کنید.');
  const [kind, id] = form.sourceId.split(':');
  return executePayment(env, req.id, {
    bankAccountId: kind === 'bank' ? id : undefined,
    cashDeskId: kind === 'cash' ? id : undefined,
    amount: form.amount,
    trackingNumber: form.trackingNumber || undefined,
  });
}

/** Manual payment request (no source document); approval and payment follow in treasury. */
export function createManualPaymentRequest(env: WorkflowEnv, input: ManualPaymentRequestInput): WorkflowResult {
  if (input.amount <= 0) return fail('مبلغ درخواست باید بیش از صفر باشد.');
  const project = env.getState().projects.find((p) => p.id === input.projectId);
  if (!project) return fail('پروژه را انتخاب کنید.');
  return createPaymentRequest(env, {
    sourceType: input.sourceType,
    sourceRefId: generateUUID(),
    sourceRefNumber: 'بدون سند مبدأ',
    projectId: project.id,
    projectName: project.name,
    costCenterId: '',
    beneficiaryName: input.beneficiaryName.trim(),
    beneficiaryType: manualBeneficiaryType(input),
    taxKind: input.sourceType === 'حق بیمه و مالیات' && input.liability !== 'insurance' ? input.liability : undefined,
    totalAmount: input.amount,
    dueDate: input.dueDate,
  });
}

// =============================================================================
// Document center
// =============================================================================

export interface NewDocumentInput {
  title: string;
  category: AppDocument['type'];
  format: AppDocument['fileFormat'];
  projectId: string;
  /** Counterparty (optional). */
  partnerId: string;
  /** Another record to link (optional). */
  linkType: DocumentLink['entityType'];
  linkId: string;
  description: string;
}

/** Registers a document in the center, linked to its project and, optionally, a counterparty and a record. */
export function uploadDocument(env: WorkflowEnv, input: NewDocumentInput): WorkflowResult {
  if (!input.title.trim()) return fail('عنوان سند را وارد کنید.');
  const projects = env.getState().projects;
  const project = projects.find((p) => p.id === input.projectId) || projects[0];
  if (!project) return fail('پروژه سند را انتخاب کنید.');
  const links: DocumentLink[] = [{ entityType: 'project', entityId: project.id }];
  if (input.partnerId) links.push({ entityType: 'counterparty', entityId: input.partnerId });
  if (input.linkId) links.push({ entityType: input.linkType, entityId: input.linkId });
  const id = generateUUID();
  return addDocument(env, {
    id,
    title: input.title,
    type: input.category,
    fileName: `${input.title.replace(/[\/\\:*?"<>|]/g, '_')}.${String(input.format).toLowerCase()}`,
    links,
    docNumber: `DOC-${id.slice(0, 6).toUpperCase()}`,
    date: today(),
    fileFormat: input.format,
    fileSize: '-',
    version: '1.0',
    status: 'معتبر و جاری',
    confidentiality: 'عادی',
    registeredBy: env.user.name,
    tags: [project.name],
    description: input.description || 'سند بارگذاری شده در مرکز اسناد.',
  });
}
