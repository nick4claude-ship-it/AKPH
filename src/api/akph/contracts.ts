/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Contracts and progress statements of akph/v1 (0.7.0) → app records (docs/API-CONTRACT.md §contracts,
 * §statements). Every figure — contract value after amendments, executed and approved work, deductions,
 * received/paid, remaining — is computed by the server; the app only shows it. Quantities travel as
 * decimal strings (DECIMAL(18,3)), amounts as integer Rials.
 */

import type {
  Contract,
  ContractAmendment,
  ContractBOQItem,
  ContractGuarantee,
  ContractServerInfo,
  ContractServerLine,
  DeductionItem,
  DeductionType,
  DetailedProgressStatement,
  GuaranteeKind,
  StatementServerInfo,
  StatementWorkflowHistory,
  StatementWorkflowStatus,
  SubcontractorContract,
  SubcontractorProgressStatement,
  SubcontractorStatementWorkflowStatus,
  SubcontractorTradeType,
} from '../../types';
import { isoToJalali } from '../../utils/jalali';
import { arr, int, jdate, obj, rial, str } from './mapping';

type Obj = Record<string, unknown>;

const idOrEmpty = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** Decimal string of the wire ('12.5', '-3') → number (display only; the server keeps the exact value). */
export function qty(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** Quantity typed in the app → decimal string with at most three decimals. */
export const qtyString = (n: number) => String(Math.round(n * 1000) / 1000);

const pct = (v: unknown) => qty(v);

function stamp(at: unknown): [string, string] {
  const s = typeof at === 'string' ? at : '';
  return [isoToJalali(s.slice(0, 10)) || '', s.slice(11, 16)];
}

const CONTRACT_STATUS: Record<string, Contract['status']> = { pending: 'در انتظار تأیید', active: 'فعال', rejected: 'رد شده', closed: 'خاتمه‌یافته' };
const SUB_STATUS: Record<string, SubcontractorContract['status']> = { pending: 'در انتظار تأیید', active: 'فعال', rejected: 'رد شده', closed: 'خاتمه‌یافته' };
const AMENDMENT_STATUS: Record<string, ContractAmendment['status']> = { pending: 'در انتظار تأیید', approved: 'تأیید شده', rejected: 'رد شده' };
const GUARANTEE_KINDS: readonly GuaranteeKind[] = ['performance', 'advance', 'retention', 'bid', 'other'];

export const GUARANTEE_KIND_LABEL: Record<GuaranteeKind, string> = {
  performance: 'حسن انجام تعهدات',
  advance: 'پیش‌پرداخت',
  retention: 'استرداد کسور وجه‌الضمان',
  bid: 'شرکت در مناقصه',
  other: 'سایر',
};

export function parseGuarantee(raw: unknown): ContractGuarantee {
  const route = '/contracts';
  const o = obj(route, raw);
  const kind = GUARANTEE_KINDS.includes(o.kind as GuaranteeKind) ? (o.kind as GuaranteeKind) : 'other';
  const status = o.status === 'released' || o.status === 'expired' ? o.status : 'active';
  return {
    id: str(route, o, 'id'),
    contractId: str(route, o, 'contract_id'),
    kind,
    guaranteeNo: str(route, o, 'guarantee_no'),
    bank: str(route, o, 'bank', true),
    amount: rial(route, o, 'amount'),
    issueDate: jdate(route, o, 'issue_date', true),
    dueDate: jdate(route, o, 'due_date'),
    status,
    notes: str(route, o, 'notes', true),
    daysToDue: typeof o.days_to_due === 'number' ? o.days_to_due : null,
    dueSoon: o.due_soon === true,
    version: int(route, o, 'version'),
    contractNumber: str(route, o, 'contract_number', true) || undefined,
    contractTitle: str(route, o, 'contract_title', true) || undefined,
    projectId: idOrEmpty(o.project_id) || undefined,
  };
}

function parseLine(raw: unknown): ContractServerLine {
  const route = '/contracts';
  const o = obj(route, raw);
  return {
    id: str(route, o, 'id'),
    rowNo: int(route, o, 'row_no'),
    code: str(route, o, 'code', true),
    description: str(route, o, 'description'),
    unit: str(route, o, 'unit'),
    baseQuantity: qty(o.base_quantity),
    quantity: qty(o.quantity),
    rate: rial(route, o, 'rate'),
    amount: rial(route, o, 'amount'),
    approvedQuantity: qty(o.approved_quantity),
    pendingQuantity: qty(o.pending_quantity),
  };
}

function serverInfo(o: Obj): ContractServerInfo {
  const route = '/contracts';
  const deductions: Record<string, number> = {};
  const d = o.deductions && typeof o.deductions === 'object' ? (o.deductions as Obj) : {};
  for (const [k, v] of Object.entries(d)) if (typeof v === 'number') deductions[k] = v;
  const index = o.adjustment_base_index;
  return {
    status: str(route, o, 'status'),
    version: int(route, o, 'version'),
    number: str(route, o, 'number'),
    currentStep: typeof o.current_step === 'string' ? o.current_step : null,
    createdById: idOrEmpty(o.created_by),
    createdByName: str(route, o, 'created_by_name', true),
    lastApprovedById: idOrEmpty(o.last_approved_by) || null,
    rejectReason: str(route, o, 'reject_reason', true),
    percents: { advance: pct(o.advance_pct), retention: pct(o.retention_pct), insurance: pct(o.insurance_pct), tax: pct(o.tax_pct), other: pct(o.other_pct) },
    adjustmentBaseIndex: index === null || index === undefined || index === '' ? null : qty(index),
    adjustmentFactorPercent: pct(o.adjustment_factor_pct),
    durationDays: int(route, o, 'duration_days'),
    lines: arr(route, o, 'lines').map(parseLine),
    guarantees: arr(route, o, 'guarantees').map(parseGuarantee),
    amendmentsTotal: rial(route, o, 'amendments_total'),
    advanceAmount: rial(route, o, 'advance_amount'),
    advanceExpected: rial(route, o, 'advance_expected'),
    advanceRemaining: rial(route, o, 'advance_remaining'),
    deductions,
    settledAmount: rial(route, o, 'settled_amount'),
    balanceDue: rial(route, o, 'balance_due'),
  };
}

function parseAmendment(raw: unknown, contractAmount: number): ContractAmendment {
  const route = '/contracts';
  const o = obj(route, raw);
  const delta = rial(route, o, 'amount_delta');
  const days = int(route, o, 'extend_days');
  return {
    id: str(route, o, 'id'),
    contractId: str(route, o, 'contract_id'),
    number: str(route, o, 'amendment_no'),
    type: delta > 0 ? 'افزایش مبلغ' : delta < 0 ? 'کاهش مبلغ' : days > 0 ? 'تمدید مدت' : 'تغییر مقادیر',
    date: jdate(route, o, 'date', true),
    amount: delta,
    changePercentage: contractAmount > 0 ? Math.round((delta / contractAmount) * 10000) / 100 : 0,
    extendedDays: days,
    description: str(route, o, 'description', true),
    status: AMENDMENT_STATUS[String(o.status)] || 'در انتظار تأیید',
    approvedBy: str(route, o, 'approved_by_name', true) || undefined,
    approvalDate: stamp(o.approved_at)[0] || undefined,
    version: int(route, o, 'version'),
    createdById: idOrEmpty(o.created_by),
    rejectReason: str(route, o, 'reject_reason', true) || undefined,
    lines: arr(route, o, 'lines').map((l) => {
      const x = obj(route, l);
      return {
        contractLineId: idOrEmpty(x.contract_line_id) || null,
        newLine: x.new_line === true,
        description: str(route, x, 'description'),
        unit: str(route, x, 'unit'),
        rate: rial(route, x, 'rate'),
        quantityDelta: qty(x.quantity_delta),
        amount: rial(route, x, 'amount'),
      };
    }),
  };
}

export interface ParsedContract {
  kind: 'client' | 'subcontract';
  client?: Contract;
  sub?: SubcontractorContract;
  boq: ContractBOQItem[];
  amendments: ContractAmendment[];
}

/** One server contract → the client contract (with BOQ and amendments) or the subcontract record. */
export function parseContract(raw: unknown): ParsedContract {
  const route = '/contracts';
  const o = obj(route, raw);
  const server = serverInfo(o);
  const id = str(route, o, 'id');
  const amount = rial(route, o, 'amount');
  const amendments = arr(route, o, 'amendments').map((a) => parseAmendment(a, amount));
  const extendDays = int(route, o, 'extend_days');
  const boq: ContractBOQItem[] = server.lines.map((l) => ({
    id: l.id,
    contractId: id,
    rowNumber: String(l.rowNo).padStart(3, '0'),
    code: l.code,
    chapter: '',
    description: l.description,
    unit: l.unit,
    initialQuantity: l.quantity,
    unitRate: l.rate,
    initialAmount: l.amount,
    previousQuantity: l.approvedQuantity,
    currentPeriodQuantity: l.pendingQuantity,
    cumulativeExecutedQuantity: l.approvedQuantity,
    executedAmount: Math.round(l.approvedQuantity * l.rate),
    progressPercentage: l.quantity > 0 ? Math.round((l.approvedQuantity / l.quantity) * 1000) / 10 : 0,
    isSurplusQuantity: false,
  }));
  const common = {
    projectId: str(route, o, 'project_id'),
    projectName: str(route, o, 'project_name', true),
    counterpartyId: str(route, o, 'counterparty_id'),
    costCenterId: idOrEmpty(o.cost_center_id),
    startDate: jdate(route, o, 'start_date', true),
    endDate: jdate(route, o, 'end_date', true),
  };
  if (o.kind === 'subcontract') {
    const d = server.deductions;
    const sub: SubcontractorContract = {
      id,
      contractNumber: str(route, o, 'contract_no'),
      title: str(route, o, 'title'),
      ...common,
      subcontractorName: str(route, o, 'counterparty_name', true),
      tradeType: (str(route, o, 'trade_type', true) || 'سایر پیمانکاری جزء') as SubcontractorTradeType,
      contractValue: rial(route, o, 'current_amount'),
      executedValue: rial(route, o, 'measured_amount'),
      approvedStatementsValue: rial(route, o, 'approved_amount'),
      paidValue: server.settledAmount,
      remainingPayableValue: server.balanceDue,
      remainingContractValue: rial(route, o, 'remaining_amount'),
      status: SUB_STATUS[server.status] || 'در انتظار تأیید',
      unitRateDescription: server.lines.map((l) => `${l.description}: ${l.rate.toLocaleString('fa-IR')} ریال/${l.unit}`).join('، '),
      advancePaid: server.advanceAmount,
      retentionDeposit: d.retention || 0,
      penaltyOrDeductions: (d.penalty || 0) + (d.other || 0),
      notes: str(route, o, 'description', true),
      server,
    };
    return { kind: 'subcontract', sub, boq: [], amendments };
  }
  const client: Contract = {
    id,
    code: server.number,
    number: str(route, o, 'contract_no'),
    projectTitle: str(route, o, 'title'),
    ...common,
    employer: str(route, o, 'counterparty_name', true),
    contractor: '',
    initialValue: amount,
    approvedChangesValue: server.amendmentsTotal,
    currentValue: rial(route, o, 'current_amount'),
    executedValue: rial(route, o, 'approved_amount'),
    remainingValue: rial(route, o, 'remaining_amount'),
    billedValue: rial(route, o, 'measured_amount'),
    approvedBilledValue: rial(route, o, 'approved_net'),
    receivedValue: server.settledAmount,
    receivableValue: server.balanceDue,
    contractDate: jdate(route, o, 'contract_date', true),
    durationMonths: Math.round(server.durationDays / 30),
    durationExtensionMonths: Math.round(extendDays / 30),
    contractType: 'فهرست‌بهایی',
    status: CONTRACT_STATUS[server.status] || 'در انتظار تأیید',
    advancePaymentPercentage: server.percents.advance,
    retentionPercentage: server.percents.retention,
    description: str(route, o, 'description', true),
    server,
  };
  return { kind: 'client', client, boq, amendments };
}

// ---------------------------------------------------------------------------- statements

const DEDUCTION_TYPE: Record<string, DeductionType> = {
  advance_payment: 'advance_payment',
  retention: 'retention',
  insurance: 'insurance',
  tax: 'tax',
  materials: 'materials',
  penalty: 'penalties',
  other: 'other',
};

function statementServer(o: Obj): StatementServerInfo {
  const route = '/statements';
  const step = o.current_step && typeof o.current_step === 'object' ? (o.current_step as Obj) : null;
  const pr = o.payment_request && typeof o.payment_request === 'object' ? (o.payment_request as Obj) : null;
  const entry = o.entry && typeof o.entry === 'object' ? (o.entry as Obj) : null;
  const voidEntry = o.void_entry && typeof o.void_entry === 'object' ? (o.void_entry as Obj) : null;
  const index = o.adjustment_index;
  return {
    version: int(route, o, 'version'),
    title: str(route, o, 'title', true),
    number: str(route, o, 'number'),
    currentStep: step
      ? {
          label: String(step.label || ''),
          role: String(step.role || ''),
          approval: step.approval === true,
          nextStatus: String(step.next_status || ''),
          requires: Array.isArray(step.requires) ? step.requires.map(String) : [],
        }
      : null,
    createdById: idOrEmpty(o.created_by),
    lastApprovedById: idOrEmpty(o.last_approved_by) || null,
    employerRef: str(route, o, 'employer_ref', true),
    employerDate: jdate(route, o, 'employer_date', true),
    entryNumber: entry && typeof entry.number === 'string' ? entry.number : undefined,
    voidEntryNumber: voidEntry && typeof voidEntry.number === 'string' ? voidEntry.number : undefined,
    adjustmentIndex: index === null || index === undefined || index === '' ? null : qty(index),
    includeVat: o.include_vat === true,
    pendingReceipts: typeof o.pending_receipts === 'number' ? o.pending_receipts : 0,
    paymentRequest: pr
      ? { id: String(pr.id), number: String(pr.number || ''), status: String(pr.status || ''), amount: Number(pr.amount) || 0, paidAmount: Number(pr.paid_amount) || 0 }
      : null,
  };
}

/** Server history rows → the step trail of the app (user ids drive the separation-of-duties checks). */
function history<S extends string>(o: Obj, stepAction: (to: string) => string | undefined): { date: string; time: string; user: string; userId?: string; stepAction?: string; role: string; fromStatus: S; toStatus: S; action: string; comment?: string }[] {
  return arr('/statements', o, 'history').map((raw) => {
    const h = obj('/statements', raw);
    const [date, time] = stamp(h.at);
    const to = String(h.to || '');
    return {
      date,
      time,
      user: String(h.user_name || ''),
      userId: idOrEmpty(h.user_id) || undefined,
      stepAction: h.action === 'approved' ? stepAction(to) : undefined,
      role: String(h.role || ''),
      fromStatus: String(h.from || to) as S,
      toStatus: to as S,
      action: String(h.step || ''),
      comment: typeof h.comment === 'string' && h.comment ? h.comment : undefined,
    };
  });
}

const CLIENT_APPROVAL_ACTION: Record<string, string> = {
  approved_by_consultant: 'client_statement.consultant_approval',
  approved_by_employer: 'client_statement.employer_approval',
};
const SUB_APPROVAL_ACTION: Record<string, string> = {
  site_review: 'sub_statement.site_approval',
  pm_approved: 'sub_statement.pm_approval',
  finance_approved: 'sub_statement.finance_approval',
  management_approved: 'sub_statement.ceo_approval',
};

const APPROVED_CLIENT = new Set(['approved_by_employer', 'partially_paid', 'paid']);

export function parseClientStatement(raw: unknown): DetailedProgressStatement {
  const route = '/statements';
  const o = obj(route, raw);
  const server = statementServer(o);
  const status = str(route, o, 'status') as StatementWorkflowStatus;
  const work = rial(route, o, 'work_amount');
  const adjustment = rial(route, o, 'adjustment_amount');
  const net = rial(route, o, 'net_amount');
  const settled = rial(route, o, 'settled_amount');
  const approved = APPROVED_CLIENT.has(status);
  const [preparationDate] = stamp(o.created_at);
  return {
    id: str(route, o, 'id'),
    statementNumber: server.number,
    contractId: str(route, o, 'contract_id'),
    contractCode: str(route, o, 'contract_number', true),
    contractNumber: str(route, o, 'contract_no', true),
    projectId: str(route, o, 'project_id'),
    projectName: str(route, o, 'project_name', true),
    counterpartyId: str(route, o, 'counterparty_id', true),
    costCenterId: idOrEmpty(o.cost_center_id) || undefined,
    client: str(route, o, 'counterparty_name', true),
    consultant: '',
    type: 'موقت',
    periodStartDate: jdate(route, o, 'period_start', true),
    periodEndDate: jdate(route, o, 'period_end', true),
    preparationDate,
    preparerName: str(route, o, 'created_by_name', true),
    description: str(route, o, 'description', true) || server.title,
    status,
    rejectionReason: str(route, o, 'reject_reason', true) || undefined,
    items: arr(route, o, 'lines').map((raw) => {
      const l = obj(route, raw);
      const contractQty = qty(l.contract_quantity);
      const cumulative = qty(l.cumulative_quantity);
      return {
        id: str(route, l, 'id'),
        boqItemId: str(route, l, 'contract_line_id'),
        rowNumber: String(l.row_no ?? '').padStart(3, '0'),
        code: str(route, l, 'code', true),
        description: str(route, l, 'description', true),
        unit: str(route, l, 'unit', true),
        contractQuantity: contractQty,
        previousQuantity: qty(l.previous_quantity),
        currentQuantity: qty(l.quantity),
        cumulativeQuantity: cumulative,
        unitRate: rial(route, l, 'rate'),
        currentAmount: rial(route, l, 'amount'),
        cumulativeAmount: rial(route, l, 'cumulative_amount'),
        isExceeded: cumulative > contractQty,
        exceededQuantity: Math.max(0, cumulative - contractQty),
      };
    }),
    workAmountCurrent: work,
    otherAllowableItemsAmount: 0,
    adjustmentAmount: adjustment,
    vatAmount: rial(route, o, 'vat_amount'),
    grossAmount: rial(route, o, 'gross_amount'),
    deductions: arr(route, o, 'deductions').map((raw): DeductionItem => {
      const d = obj(route, raw);
      const rate = pct(d.rate);
      return {
        id: String(d.type),
        title: String(d.title || ''),
        type: DEDUCTION_TYPE[String(d.type)] || 'other',
        mode: rate > 0 ? 'percentage' : 'fixed',
        rate,
        baseAmount: work + adjustment,
        calculatedAmount: typeof d.amount === 'number' ? d.amount : 0,
      };
    }),
    totalDeductions: rial(route, o, 'total_deductions'),
    netPayable: net,
    approvedNetPayable: approved ? net : 0,
    receivedAmount: settled,
    remainingPayable: approved ? rial(route, o, 'balance_due') : net,
    dueDate: '',
    paymentStatus: status === 'paid' ? 'Paid' : settled > 0 ? 'Partially Paid' : 'Unpaid',
    overdueDays: 0,
    workflowHistory: history<StatementWorkflowStatus>(o, (to) => CLIENT_APPROVAL_ACTION[to]) as StatementWorkflowHistory[],
    accountingJournalEntryId: server.entryNumber,
    server,
  };
}

export function parseSubcontractorStatement(raw: unknown): SubcontractorProgressStatement {
  const route = '/statements';
  const o = obj(route, raw);
  const server = statementServer(o);
  const deductions = arr(route, o, 'deductions').map((d) => obj(route, d));
  const amountOf = (type: string) => deductions.filter((d) => d.type === type).reduce((a, d) => a + (typeof d.amount === 'number' ? d.amount : 0), 0);
  const net = rial(route, o, 'net_amount');
  const paid = rial(route, o, 'settled_amount');
  const status = str(route, o, 'status') as SubcontractorStatementWorkflowStatus;
  const gross = rial(route, o, 'gross_amount');
  const [submissionDate] = stamp(o.created_at);
  return {
    id: str(route, o, 'id'),
    statementNumber: server.number,
    subcontractorContractId: str(route, o, 'contract_id'),
    subcontractorContractNumber: str(route, o, 'contract_no', true),
    costCenterId: idOrEmpty(o.cost_center_id),
    counterpartyId: str(route, o, 'counterparty_id', true),
    subcontractorName: str(route, o, 'counterparty_name', true),
    tradeType: (str(route, o, 'trade_type', true) || 'سایر پیمانکاری جزء') as SubcontractorTradeType,
    projectId: str(route, o, 'project_id'),
    projectName: str(route, o, 'project_name', true),
    periodStartDate: jdate(route, o, 'period_start', true),
    periodEndDate: jdate(route, o, 'period_end', true),
    submissionDate,
    items: arr(route, o, 'lines').map((raw) => {
      const l = obj(route, raw);
      return {
        id: str(route, l, 'id'),
        contractLineId: str(route, l, 'contract_line_id'),
        description: str(route, l, 'description', true),
        unit: str(route, l, 'unit', true),
        contractQuantity: qty(l.contract_quantity),
        previousQuantity: qty(l.previous_quantity),
        currentQuantity: qty(l.quantity),
        cumulativeQuantity: qty(l.cumulative_quantity),
        unitRate: rial(route, l, 'rate'),
        currentAmount: rial(route, l, 'amount'),
        cumulativeAmount: rial(route, l, 'cumulative_amount'),
      };
    }),
    grossAmount: gross,
    siteVerifiedAmount: gross,
    deductions: {
      retention: amountOf('retention'),
      advancePaymentDeduction: amountOf('advance_payment'),
      safetyOrWastePenalty: amountOf('penalty'),
      insuranceDeduction: amountOf('insurance'),
      taxDeduction: amountOf('tax'),
      otherDeductions: amountOf('other'),
    },
    totalDeductions: rial(route, o, 'total_deductions'),
    netPayable: net,
    paidAmount: paid,
    remainingPayable: Math.max(0, net - paid),
    status,
    rejectionReason: str(route, o, 'reject_reason', true) || undefined,
    projectExpenseRecordId: server.entryNumber,
    server,
    workflowHistory: history<SubcontractorStatementWorkflowStatus>(o, (to) => SUB_APPROVAL_ACTION[to]),
  };
}

export interface ContractSlices {
  contracts: Contract[];
  contractBoq: ContractBOQItem[];
  contractAmendments: ContractAmendment[];
  subcontractorContracts: SubcontractorContract[];
}

export function contractSlices(rows: readonly unknown[]): ContractSlices {
  const out: ContractSlices = { contracts: [], contractBoq: [], contractAmendments: [], subcontractorContracts: [] };
  for (const raw of rows) {
    const p = parseContract(raw);
    if (p.client) out.contracts.push(p.client);
    if (p.sub) out.subcontractorContracts.push(p.sub);
    out.contractBoq.push(...p.boq);
    out.contractAmendments.push(...p.amendments);
  }
  return out;
}

export function statementSlices(rows: readonly unknown[]) {
  const clientStatements: DetailedProgressStatement[] = [];
  const subcontractorStatements: SubcontractorProgressStatement[] = [];
  for (const raw of rows) {
    const kind = obj('/statements', raw).kind;
    if (kind === 'subcontract') subcontractorStatements.push(parseSubcontractorStatement(raw));
    else clientStatements.push(parseClientStatement(raw));
  }
  return { clientStatements, subcontractorStatements };
}
