/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Contract,
  ContractBOQItem,
  DetailedProgressStatement,
  ContractAmendment,
  AdvancePaymentRecord,
  PriceAdjustment,
  StatementPayment,
  ContractDocument,
  ContractAuditLog,
  Project,
  BankAccount,
  UserProfile,
  ContractsMainViewMode,
  SubcontractorContract,
  SubcontractorProgressStatement,
  SubcontractorSubTab,
  SubcontractorStatementWorkflowStatus,
} from '../../types';
import {
  FileText,
  FileSpreadsheet,
  Layers,
  Building,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  FileCheck,
  Plus,
  BookOpen,
  PieChart,
  Paperclip,
  CheckCircle2,
  Clock,
  ChevronLeft,
  HardHat,
  ArrowUpRight,
  ArrowDownLeft,
  Hammer,
  UserCheck,
  CheckSquare,
} from 'lucide-react';
import { ContractsDashboard } from './ContractsDashboard';
import { ContractsListView } from './ContractsListView';
import { ContractDetailView } from './ContractDetailView';
import { BOQManagementView } from './BOQManagementView';
import { ProgressStatementsListView } from './ProgressStatementsListView';
import { StatementDetailAndPrintModal } from './StatementDetailAndPrintModal';
import { NewStatementModal } from './NewStatementModal';
import { NewContractModal } from './NewContractModal';
import { NewAmendmentModal } from './NewAmendmentModal';
import { RecordReceiptModal } from './RecordReceiptModal';
import { DeductionsEngineView } from './DeductionsEngineView';
import { AdjustmentsEngineView } from './AdjustmentsEngineView';
import { PaymentsReceivablesView } from './PaymentsReceivablesView';
import { ContractReportsView } from './ContractReportsView';
import { ContractDocumentsView } from './ContractDocumentsView';
import {
  mockContractBOQ,
  mockAmendments,
  mockAdvancePayments,
  mockPriceAdjustments,
  mockContractDocuments,
  mockContractAuditLogs,
} from '../../data/contractsMockData';
import { useAppState, useStoreSlice, usePostFinancialEvent } from '../../store/AppStore';
import { clientStatementApprovedEvent, subcontractorStatementApprovedEvent } from '../../store/events';
import { buildPaymentRequest } from '../../store/paymentRequests';
import { generateUUID } from '../../utils/ids';
import { toPersianDate } from '../../utils/date';
import { SubcontractorDashboard } from './subcontractors/SubcontractorDashboard';
import { SubcontractorStatementsListView } from './subcontractors/SubcontractorStatementsListView';
import { SubcontractorContractsListView } from './subcontractors/SubcontractorContractsListView';
import { SubcontractorApprovalsQueue } from './subcontractors/SubcontractorApprovalsQueue';
import { SubcontractorMatrixView } from './subcontractors/SubcontractorMatrixView';
import { NewSubcontractorStatementModal } from './subcontractors/NewSubcontractorStatementModal';
import { NewSubcontractorContractModal } from './subcontractors/NewSubcontractorContractModal';
import { SubcontractorPaymentModal } from './subcontractors/SubcontractorPaymentModal';
import { SubcontractorStatementDetailModal } from './subcontractors/SubcontractorStatementDetailModal';

interface ContractsModuleProps {
  projects: Project[];
  currentUser: UserProfile;
  onPosted?: (docNumber: string) => void;
}

export type ContractsSubTab =
  | 'dashboard'
  | 'contracts'
  | 'contract_detail'
  | 'boq'
  | 'statements'
  | 'deductions'
  | 'adjustments'
  | 'payments'
  | 'reports'
  | 'documents';

export const ContractsModule: React.FC<ContractsModuleProps> = ({
  projects,
  currentUser,
  onPosted,
}) => {
  const { bankAccounts } = useAppState();
  const postFinancialEvent = usePostFinancialEvent();
  const [, setPaymentRequests] = useStoreSlice('paymentRequests');
  const [, setReceipts] = useStoreSlice('receipts');
  // Top-Level Mode: 'client' (مطالبات از کارفرما) vs 'subcontractor' (تعهدات پیمانکاران جزء)
  const [mainMode, setMainMode] = useState<ContractsMainViewMode>('client');

  // Client Section States
  const [activeTab, setActiveTab] = useState<ContractsSubTab>('dashboard');
  const [contracts, setContracts] = useStoreSlice('contracts');
  const [boqItems, setBOQItems] = useState<ContractBOQItem[]>(mockContractBOQ);
  const [statements, setStatements] = useStoreSlice('clientStatements');
  const [amendments, setAmendments] = useState<ContractAmendment[]>(mockAmendments);
  const [advancePayments, setAdvancePayments] = useState<AdvancePaymentRecord[]>(mockAdvancePayments);
  const [adjustments, setAdjustments] = useState<PriceAdjustment[]>(mockPriceAdjustments);
  const [payments, setPayments] = useStoreSlice('statementPayments');
  const [documents, setDocuments] = useState<ContractDocument[]>(mockContractDocuments);
  const [auditLogs, setAuditLogs] = useState<ContractAuditLog[]>(mockContractAuditLogs);

  // Subcontractor Section States
  const [subTab, setSubTab] = useState<SubcontractorSubTab>('dashboard');
  const [subContracts, setSubContracts] = useStoreSlice('subcontractorContracts');
  const [subStatements, setSubStatements] = useStoreSlice('subcontractorStatements');
  const [selectedSubContract, setSelectedSubContract] = useState<SubcontractorContract | null>(null);
  const [selectedSubStatement, setSelectedSubStatement] = useState<SubcontractorProgressStatement | null>(null);

  // Subcontractor Modals
  const [isNewSubContractOpen, setIsNewSubContractOpen] = useState(false);
  const [isNewSubStatementOpen, setIsNewSubStatementOpen] = useState(false);
  const [contractForNewSubStatement, setContractForNewSubStatement] = useState<SubcontractorContract | null>(null);
  const [isSubPaymentOpen, setIsSubPaymentOpen] = useState(false);
  const [statementForPayment, setStatementForPayment] = useState<SubcontractorProgressStatement | null>(null);
  const [isSubStatementDetailOpen, setIsSubStatementDetailOpen] = useState(false);

  // Client Selected entities for modals / detail views
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<DetailedProgressStatement | null>(null);

  // Client Modals state
  const [isNewContractOpen, setIsNewContractOpen] = useState(false);
  const [isNewStatementOpen, setIsNewStatementOpen] = useState(false);
  const [contractForNewStatement, setContractForNewStatement] = useState<Contract | null>(null);
  const [isNewAmendmentOpen, setIsNewAmendmentOpen] = useState(false);
  const [contractForNewAmendment, setContractForNewAmendment] = useState<Contract | null>(null);
  const [isRecordReceiptOpen, setIsRecordReceiptOpen] = useState(false);

  // ---------------- Subcontractor Handlers ----------------
  const handleSelectSubContract = (subContract: SubcontractorContract) => {
    setSelectedSubContract(subContract);
    setSubTab('dashboard');
  };

  const handleOpenNewSubStatement = (contract?: SubcontractorContract) => {
    setContractForNewSubStatement(contract || selectedSubContract || subContracts[0] || null);
    setIsNewSubStatementOpen(true);
  };

  const handleSaveSubContract = (newContract: SubcontractorContract) => {
    setSubContracts([newContract, ...subContracts]);
  };

  const handleSaveSubStatement = (newStatement: SubcontractorProgressStatement) => {
    setSubStatements([newStatement, ...subStatements]);
    // Update subcontractor contract executedValue & remaining capacity
    setSubContracts(
      subContracts.map((c) => {
        if (c.id === newStatement.subcontractorContractId) {
          const newExecuted = c.executedValue + newStatement.grossAmount;
          return {
            ...c,
            executedValue: newExecuted,
            remainingContractValue: Math.max(0, c.contractValue - newExecuted),
          };
        }
        return c;
      })
    );
  };

  const handleUpdateSubStatementStatus = (
    statementId: string,
    newStatus: SubcontractorStatementWorkflowStatus,
    comment?: string
  ) => {
    const current = subStatements.find((s) => s.id === statementId);
    if (!current) return;

    const updated: SubcontractorProgressStatement = {
      ...current,
      status: newStatus,
      workflowHistory: [
        ...current.workflowHistory,
        {
          date: '۱۴۰۳/۰۷/۰۳',
          time: '۱۴:۳۰',
          user: currentUser.name,
          role: currentUser.role,
          fromStatus: current.status,
          toStatus: newStatus,
          action: `تغییر وضعیت به ${newStatus}`,
          comment: comment || 'تأیید مرحله در گردش کار',
        },
      ],
    };

    if (newStatus === 'site_review') {
      updated.siteReviewNote = comment || updated.siteReviewNote;
      updated.siteReviewerName = currentUser.name;
      updated.siteReviewDate = '۱۴۰۳/۰۷/۰۳';
    } else if (newStatus === 'pm_approved') {
      updated.pmApprovalNote = comment || updated.pmApprovalNote;
      updated.pmApproverName = currentUser.name;
      updated.pmApprovalDate = '۱۴۰۳/۰۷/۰۳';
    } else if (newStatus === 'management_approved') {
      updated.managementApprovalNote = comment || updated.managementApprovalNote;
      updated.managementApproverName = currentUser.name;
      updated.managementApprovalDate = '۱۴۰۳/۰۷/۰۳';

      // CEO approval is the financial trigger: Dr project cost / Cr subcontractor payable and deductions.
      const posting = postFinancialEvent(subcontractorStatementApprovedEvent(updated), { submitter: currentUser.name });
      if (!posting.ok) return;
      updated.projectExpenseRecordId = posting.event?.docNumber;

      if (!posting.duplicate) {
        setSubContracts((prevContracts) =>
          prevContracts.map((c) =>
            c.id === current.subcontractorContractId
              ? {
                  ...c,
                  approvedStatementsValue: c.approvedStatementsValue + current.netPayable,
                  remainingPayableValue: c.remainingPayableValue + current.netPayable,
                }
              : c
          )
        );
        const remaining = current.netPayable - current.paidAmount;
        if (remaining > 0) {
          setPaymentRequests((prev) => [
            buildPaymentRequest(
              prev,
              {
                sourceType: 'صورت‌وضعیت پیمانکار جزء',
                sourceRefId: current.id,
                sourceRefNumber: current.statementNumber,
                projectId: current.projectId,
                projectName: current.projectName,
                costCenterId: current.costCenterId,
                counterpartyId: current.counterpartyId,
                beneficiaryName: current.subcontractorName,
                beneficiaryType: 'پیمانکار جزء',
                totalAmount: remaining,
              },
              toPersianDate(new Date())
            ),
            ...prev,
          ]);
        }
        if (posting.event?.docNumber) onPosted?.(posting.event.docNumber);
      }
    }

    setSubStatements((prev) => prev.map((s) => (s.id === statementId ? updated : s)));
    if (selectedSubStatement?.id === statementId) {
      setSelectedSubStatement(updated);
    }
  };

  const handleConfirmSubPayment = (
    statement: SubcontractorProgressStatement,
    amount: number,
    bankId: string,
    method: 'حواله بانکی پایا/ساتنا' | 'چک صیادی' | 'صندوق تنخواه کارگاه' | 'تهاتر مصالح',
    refNumber: string,
    date: string
  ) => {
    const expenseRecordId = `EXP-${statement.projectId.toUpperCase()}-${Date.now().toString().slice(-5)}`;
    const selectedBank = bankAccounts.find((b) => b.id === bankId);

    // 1. Update Subcontractor statement status
    const newRemaining = Math.max(0, statement.remainingPayable - amount);
    const updatedStatement: SubcontractorProgressStatement = {
      ...statement,
      status: newRemaining === 0 ? 'paid' : statement.status,
      paidAmount: statement.paidAmount + amount,
      remainingPayable: newRemaining,
      paymentDate: date,
      paymentMethod: method,
      paymentRefNumber: refNumber,
      payingBankId: bankId,
      payingBankTitle: selectedBank?.bankName || 'بانک',
      projectExpenseRecordId: expenseRecordId,
      workflowHistory: [
        ...statement.workflowHistory,
        {
          date,
          time: '۱۵:۰۰',
          user: currentUser.name,
          role: currentUser.role,
          fromStatus: statement.status,
          toStatus: newRemaining === 0 ? 'paid' : statement.status,
          action: `واریز وجه و صدور سند ثبت هزینه پروژه ${expenseRecordId}`,
          comment: `واریز مبلغ ${amount.toLocaleString('fa-IR')} تومان به پیمانکار (${method}) - رهگیری: ${refNumber}`,
        },
      ],
    };

    setSubStatements((prev) =>
      prev.map((s) => (s.id === statement.id ? updatedStatement : s))
    );

    // 2. Update Subcontractor Contract metrics
    setSubContracts((prev) =>
      prev.map((c) => {
        if (c.id === statement.subcontractorContractId) {
          return {
            ...c,
            paidValue: c.paidValue + amount,
            remainingPayableValue: Math.max(0, c.remainingPayableValue - amount),
          };
        }
        return c;
      })
    );

    if (selectedSubStatement?.id === statement.id) {
      setSelectedSubStatement(updatedStatement);
    }

    // 3. Payment belongs to the financial layer only: Dr subcontractor payable / Cr bank.
    //    The project cost was already recognised when the statement was approved.
    const posting = postFinancialEvent(
      {
        type: 'TREASURY_PAYMENT',
        sourceModule: 'treasury',
        sourceId: expenseRecordId,
        projectId: statement.projectId,
        costCenterId: statement.costCenterId,
        counterpartyId: statement.counterpartyId,
        amount,
        date,
        details: {
          docNumber: statement.statementNumber,
          payableType: 'subcontractor',
          bankAccountId: bankId,
          bankName: selectedBank?.bankName,
          trackingNumber: refNumber,
        },
      },
      { submitter: currentUser.name }
    );
    if (posting.ok && !posting.duplicate) {
      setPaymentRequests((prev) =>
        prev.map((r) =>
          r.sourceType === 'صورت‌وضعیت پیمانکار جزء' && r.sourceRefId === statement.id && r.status !== 'پرداخت شده'
            ? {
                ...r,
                paidAmount: r.paidAmount + amount,
                remainingAmount: Math.max(0, r.remainingAmount - amount),
                status: r.remainingAmount - amount <= 0 ? 'پرداخت شده' : r.status,
                payerBankAccountId: bankId,
                paymentDate: date,
                trackingNumber: refNumber,
                journalEntryId: posting.event?.docNumber,
              }
            : r
        )
      );
      if (posting.event?.docNumber) onPosted?.(posting.event.docNumber);
    }
  };

  // ---------------- Client Handlers ----------------
  const handleSelectContract = (contract: Contract) => {
    setSelectedContract(contract);
    setActiveTab('contract_detail');
  };

  const handleOpenNewStatement = (contract?: Contract) => {
    setContractForNewStatement(contract || selectedContract || contracts[0] || null);
    setIsNewStatementOpen(true);
  };

  const handleOpenNewAmendment = (contract?: Contract) => {
    setContractForNewAmendment(contract || selectedContract || contracts[0] || null);
    setIsNewAmendmentOpen(true);
  };

  const handleSaveContract = (newContract: Contract) => {
    setContracts([newContract, ...contracts]);
    const newLog: ContractAuditLog = {
      id: `cal-${Date.now()}`,
      contractId: newContract.id,
      user: currentUser.name,
      role: currentUser.role,
      date: '۱۴۰۳/۰۷/۰۲',
      time: '۱۰:۰۰',
      action: 'تأیید',
      targetField: 'contract',
      oldValue: '-',
      newValue: newContract.code,
      reason: 'انعقاد قرارداد جدید',
    };
    setAuditLogs([newLog, ...auditLogs]);
  };

  const handleSaveStatement = (newStatement: DetailedProgressStatement) => {
    setStatements([newStatement, ...statements]);
    // Also update contract billedValue
    setContracts(
      contracts.map((c) => {
        if (c.id === newStatement.contractId) {
          const newBilled = c.billedValue + newStatement.grossAmount;
          return {
            ...c,
            billedValue: newBilled,
            executedValue: Math.max(c.executedValue, newBilled),
          };
        }
        return c;
      })
    );
  };

  const handleSaveAmendment = (newAmendment: ContractAmendment, updatedContract: Contract) => {
    setAmendments([newAmendment, ...amendments]);
    setContracts(contracts.map((c) => (c.id === updatedContract.id ? updatedContract : c)));
    if (selectedContract?.id === updatedContract.id) {
      setSelectedContract(updatedContract);
    }
  };

  const handleSavePaymentReceipt = (
    newPayment: StatementPayment,
    updatedStatement: DetailedProgressStatement,
    updatedContract: Contract,
    destinationBankId?: string
  ) => {
    setPayments([newPayment, ...payments]);
    setStatements(statements.map((s) => (s.id === updatedStatement.id ? updatedStatement : s)));
    setContracts(contracts.map((c) => (c.id === updatedContract.id ? updatedContract : c)));
    if (selectedStatement?.id === updatedStatement.id) {
      setSelectedStatement(updatedStatement);
    }
    if (selectedContract?.id === updatedContract.id) {
      setSelectedContract(updatedContract);
    }

    // Receipt is posted in the financial layer: Dr bank / Cr receivables.
    const bank = bankAccounts.find((b) => b.id === destinationBankId) || bankAccounts[0];
    const posting = postFinancialEvent(
      {
        type: 'TREASURY_RECEIPT',
        sourceModule: 'treasury',
        sourceId: newPayment.id,
        projectId: updatedContract.projectId,
        costCenterId: updatedStatement.costCenterId || updatedContract.costCenterId,
        counterpartyId: updatedStatement.counterpartyId || updatedContract.counterpartyId,
        amount: newPayment.amount,
        date: newPayment.date,
        details: {
          docNumber: newPayment.statementNumber,
          bankAccountId: bank?.id,
          bankName: bank?.bankName || newPayment.destinationBank,
          trackingNumber: newPayment.referenceNumber,
        },
      },
      { submitter: currentUser.name }
    );
    if (posting.ok && !posting.duplicate && posting.event) {
      setPayments((prev) => prev.map((p) => (p.id === newPayment.id ? { ...p, journalEntryId: posting.event!.docNumber } : p)));
      setReceipts((prev) => [
        {
          id: generateUUID(),
          docNumber: posting.event!.docNumber!,
          date: newPayment.date,
          amount: newPayment.amount,
          counterpartyId: posting.event!.counterpartyId,
          costCenterId: posting.event!.costCenterId,
          payer: updatedContract.employer,
          receiver: bank?.bankName || newPayment.destinationBank,
          projectId: updatedContract.projectId,
          projectName: updatedContract.projectName,
          destinationAccount: bank ? `${bank.bankName} - ${bank.accountNumber}` : newPayment.destinationBank,
          method: newPayment.method === 'چک صیادی' ? 'چک صیادی' : newPayment.method === 'حواله ساتنا/پایا' ? 'حواله بانکی' : 'تهاتر',
          trackingNumber: newPayment.referenceNumber,
          description: `وصول ${newPayment.statementNumber} - پیمان ${updatedContract.code}`,
          journalEntryId: posting.event!.journalEntryId,
          status: 'وصول شده',
        },
        ...prev,
      ]);
      onPosted?.(posting.event.docNumber!);
    }
  };

  // Employer approval is the financial trigger for a client statement.
  const postClientStatement = (statement: DetailedProgressStatement): string | undefined => {
    const contract = contracts.find((c) => c.id === statement.contractId);
    const posting = postFinancialEvent(
      clientStatementApprovedEvent(
        statement,
        statement.costCenterId || contract?.costCenterId || '',
        statement.counterpartyId || contract?.counterpartyId || ''
      ),
      { submitter: currentUser.name }
    );
    if (!posting.ok) return undefined;
    if (!posting.duplicate && posting.event?.docNumber) onPosted?.(posting.event.docNumber);
    return posting.event?.docNumber;
  };

  const handleUpdateStatementStatus = (statementId: string, newStatus: any, reason?: string) => {
    const target = statements.find((s) => s.id === statementId);
    const accountingDoc =
      target && newStatus === 'approved_by_employer' ? postClientStatement(target) : undefined;
    if (target && newStatus === 'approved_by_employer' && !accountingDoc) return;
    setStatements(
      statements.map((s) => {
        if (s.id === statementId) {
          const updated: DetailedProgressStatement = {
            ...s,
            status: newStatus,
            accountingJournalEntryId: accountingDoc || s.accountingJournalEntryId,
            rejectionReason: reason || s.rejectionReason,
            workflowHistory: [
              ...s.workflowHistory,
              {
                date: '۱۴۰۳/۰۷/۰۳',
                time: '۱۲:۳۰',
                user: currentUser.name,
                role: currentUser.role,
                fromStatus: s.status,
                toStatus: newStatus,
                action: `تغییر وضعیت به ${newStatus}`,
                comment: reason,
              },
            ],
          };
          if (selectedStatement?.id === statementId) {
            setSelectedStatement(updated);
          }
          return updated;
        }
        return s;
      })
    );
  };

  const handleIssueAccountingEntryForStatement = (statement: DetailedProgressStatement) => {
    if (statement.status !== 'approved_by_employer') return;
    const docNumber = postClientStatement(statement);
    if (!docNumber) return;
    setStatements((prev) => prev.map((s) => (s.id === statement.id ? { ...s, accountingJournalEntryId: docNumber } : s)));
  };

  // Subcontractor Pending Counts
  const pendingSubcontractorApprovalsCount = subStatements.filter(
    (s) => s.status === 'submitted' || s.status === 'site_review' || s.status === 'pm_approved'
  ).length;

  const urgentSubcontractorPaymentCount = subStatements.filter(
    (s) => s.status === 'management_approved' && s.remainingPayable > 0
  ).length;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP LEVEL PRIMARY DUAL MODE SELECTOR (Requested explicitly by USER):
          1. صورت‌وضعیت کارفرما (Client Progress Statements - پول ورودی به AKPH)
          2. صورت‌وضعیت پیمانکاران جزء (Subcontractor Progress Statements - پول خروجی از AKPH)
          ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-2.5 text-white shadow-md border border-slate-700">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {/* Tab 1: Client Statements */}
            <button
              onClick={() => setMainMode('client')}
              className={`flex-1 sm:flex-initial flex items-center justify-center sm:justify-start gap-2.5 px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs font-bold ${
                mainMode === 'client'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ArrowDownLeft className={`w-4 h-4 ${mainMode === 'client' ? 'text-slate-950' : 'text-emerald-400'}`} />
              <div className="text-right">
                <span className="block">صورت‌وضعیت و مطالبات کارفرما (Client)</span>
                <span className={`text-[10px] block font-normal ${mainMode === 'client' ? 'text-slate-900' : 'text-slate-400'}`}>
                  پولی که AKPH از کارفرما مطالبه می‌کند (درآمد و وصولی)
                </span>
              </div>
              <span
                className={`mr-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  mainMode === 'client' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {contracts.length}
              </span>
            </button>

            {/* Tab 2: Subcontractor Statements */}
            <button
              onClick={() => setMainMode('subcontractor')}
              className={`flex-1 sm:flex-initial flex items-center justify-center sm:justify-start gap-2.5 px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs font-bold ${
                mainMode === 'subcontractor'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ArrowUpRight className={`w-4 h-4 ${mainMode === 'subcontractor' ? 'text-slate-950' : 'text-rose-400'}`} />
              <div className="text-right">
                <span className="block">صورت‌وضعیت و تعهدات پیمانکاران جزء (Subcontractors)</span>
                <span className={`text-[10px] block font-normal ${mainMode === 'subcontractor' ? 'text-slate-900' : 'text-slate-400'}`}>
                  پولی که جوشکار، آرماتوربند، بنّا، تأسیسات و... از AKPH مطالبه می‌کنند
                </span>
              </div>
              <div className="flex items-center gap-1 mr-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    mainMode === 'subcontractor' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {subContracts.length}
                </span>
                {urgentSubcontractorPaymentCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500 text-white animate-pulse">
                    {urgentSubcontractorPaymentCount} بدهی
                  </span>
                )}
              </div>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400 pl-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>مدیریت یکپارچه جریان‌های ورودی و خروجی فاز ۴ پیمانکاری</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: CLIENT PROGRESS STATEMENTS (صورت‌وضعیت و مطالبات از کارفرما)
          ========================================================================= */}
      {mainMode === 'client' && (
        <div className="space-y-6">
          {/* Sub-navigation tabs for Client Contracts Module */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-2 shadow-2xs">
            <div className="flex items-center overflow-x-auto gap-1 scrollbar-none text-xs font-medium">
              {[
                { id: 'dashboard', label: 'پیشخوان کارفرما', icon: PieChart },
                { id: 'contracts', label: 'قراردادهای کارفرما', icon: Building, badge: contracts.length },
                { id: 'statements', label: 'صورت‌وضعیت‌های کارفرما', icon: FileSpreadsheet, badge: statements.length },
                { id: 'boq', label: 'فهرست‌بها و کنترل مقادیر', icon: Layers },
                { id: 'payments', label: 'مطالبات و وصولی‌ها', icon: DollarSign, badge: 'وصولی' },
                { id: 'deductions', label: 'موتور کسورات و پیش‌پرداخت', icon: ShieldCheck },
                { id: 'adjustments', label: 'تعدیل آحاد بها', icon: TrendingUp },
                { id: 'reports', label: 'گزارش‌های رسمی و تحلیلی', icon: FileText },
                { id: 'documents', label: 'آرشیو اسناد و نقشه‌ها', icon: Paperclip, badge: documents.length },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      if (tab.id !== 'contract_detail') setSelectedContract(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                          isActive ? 'bg-amber-600 text-white font-bold' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {typeof tab.badge === 'number' ? tab.badge.toLocaleString('fa-IR') : tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Client Subtab Content */}
          {activeTab === 'dashboard' && (
            <ContractsDashboard
              contracts={contracts}
              statements={statements}
              currentUser={currentUser}
              onSelectContract={handleSelectContract}
              onOpenNewContract={() => setIsNewContractOpen(true)}
              onOpenNewStatement={() => handleOpenNewStatement()}
              onSelectStatement={(stm) => setSelectedStatement(stm)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'contracts' && (
            <ContractsListView
              contracts={contracts}
              currentUser={currentUser}
              onSelectContract={handleSelectContract}
              onOpenNewContract={() => setIsNewContractOpen(true)}
            />
          )}

          {activeTab === 'contract_detail' && selectedContract && (
            <ContractDetailView
              contract={selectedContract}
              boqItems={boqItems}
              statements={statements}
              amendments={amendments}
              payments={payments}
              documents={documents}
              auditLogs={auditLogs}
              currentUser={currentUser}
              onBack={() => setActiveTab('contracts')}
              onOpenNewStatement={(c) => handleOpenNewStatement(c)}
              onOpenNewAmendment={(c) => handleOpenNewAmendment(c)}
              onSelectStatement={(stm) => setSelectedStatement(stm)}
            />
          )}

          {activeTab === 'boq' && (
            <BOQManagementView
              contracts={contracts}
              boqItems={boqItems}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'statements' && (
            <ProgressStatementsListView
              statements={statements}
              currentUser={currentUser}
              onSelectStatement={(stm) => setSelectedStatement(stm)}
              onOpenNewStatement={() => handleOpenNewStatement()}
            />
          )}

          {activeTab === 'deductions' && (
            <DeductionsEngineView
              contracts={contracts}
              advancePayments={advancePayments}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'adjustments' && (
            <AdjustmentsEngineView
              contracts={contracts}
              adjustments={adjustments}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsReceivablesView
              contracts={contracts}
              statements={statements}
              payments={payments}
              currentUser={currentUser}
              onOpenRecordReceipt={() => setIsRecordReceiptOpen(true)}
              onSelectStatement={(stm) => setSelectedStatement(stm)}
            />
          )}

          {activeTab === 'reports' && (
            <ContractReportsView
              contracts={contracts}
              statements={statements}
              boqItems={boqItems}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'documents' && (
            <ContractDocumentsView
              contracts={contracts}
              documents={documents}
              currentUser={currentUser}
            />
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION 2: SUBCONTRACTOR PROGRESS STATEMENTS (صورت‌وضعیت و تعهدات پیمانکاران جزء)
          ========================================================================= */}
      {mainMode === 'subcontractor' && (
        <div className="space-y-6">
          {/* Sub-navigation tabs for Subcontractor Module */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-2 shadow-2xs">
            <div className="flex items-center overflow-x-auto gap-1 scrollbar-none text-xs font-medium">
              {[
                { id: 'dashboard', label: 'پیشخوان پیمانکاران جزء', icon: PieChart },
                {
                  id: 'statements',
                  label: 'صورت‌وضعیت‌های جزء',
                  icon: FileSpreadsheet,
                  badge: subStatements.length,
                },
                {
                  id: 'contracts',
                  label: 'قراردادهای پیمانکاران جزء',
                  icon: Hammer,
                  badge: subContracts.length,
                },
                {
                  id: 'approvals',
                  label: 'کارتابل گردش کار و تاییدات',
                  icon: CheckSquare,
                  badge:
                    pendingSubcontractorApprovalsCount > 0
                      ? pendingSubcontractorApprovalsCount
                      : undefined,
                },
                {
                  id: 'matrix',
                  label: 'ماتریس پروژه و پیمانکار',
                  icon: Layers,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = subTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSubTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                          isActive
                            ? 'bg-amber-600 text-white font-bold'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {typeof tab.badge === 'number'
                          ? tab.badge.toLocaleString('fa-IR')
                          : tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subcontractor Subtab Content */}
          {subTab === 'dashboard' && (
            <SubcontractorDashboard
              contracts={subContracts}
              statements={subStatements}
              projects={projects}
              currentUser={currentUser}
              onSelectContract={handleSelectSubContract}
              onSelectStatement={(stm) => {
                setSelectedSubStatement(stm);
                setIsSubStatementDetailOpen(true);
              }}
              onOpenNewStatement={(c) => handleOpenNewSubStatement(c)}
              onOpenNewContract={() => setIsNewSubContractOpen(true)}
              onGoToApprovals={() => setSubTab('approvals')}
              onPayStatement={(stm) => {
                setStatementForPayment(stm);
                setIsSubPaymentOpen(true);
              }}
            />
          )}

          {subTab === 'statements' && (
            <SubcontractorStatementsListView
              statements={subStatements}
              projects={projects}
              currentUser={currentUser}
              onSelectStatement={(stm) => {
                setSelectedSubStatement(stm);
                setIsSubStatementDetailOpen(true);
              }}
              onOpenNewStatement={() => handleOpenNewSubStatement()}
              onPayStatement={(stm) => {
                setStatementForPayment(stm);
                setIsSubPaymentOpen(true);
              }}
            />
          )}

          {subTab === 'contracts' && (
            <SubcontractorContractsListView
              contracts={subContracts}
              projects={projects}
              currentUser={currentUser}
              onSelectContract={handleSelectSubContract}
              onOpenNewContract={() => setIsNewSubContractOpen(true)}
              onOpenNewStatement={(c) => handleOpenNewSubStatement(c)}
            />
          )}

          {subTab === 'approvals' && (
            <SubcontractorApprovalsQueue
              statements={subStatements}
              currentUser={currentUser}
              onSelectStatement={(stm) => {
                setSelectedSubStatement(stm);
                setIsSubStatementDetailOpen(true);
              }}
              onUpdateStatus={handleUpdateSubStatementStatus}
              onPayStatement={(stm) => {
                setStatementForPayment(stm);
                setIsSubPaymentOpen(true);
              }}
            />
          )}

          {subTab === 'matrix' && (
            <SubcontractorMatrixView
              contracts={subContracts}
              projects={projects}
              onSelectContract={handleSelectSubContract}
              onOpenNewStatement={(c) => handleOpenNewSubStatement(c)}
            />
          )}
        </div>
      )}

      {/* =========================================================================
          SUBCONTRACTOR MODALS
          ========================================================================= */}
      <NewSubcontractorStatementModal
        isOpen={isNewSubStatementOpen}
        onClose={() => setIsNewSubStatementOpen(false)}
        contracts={subContracts}
        initialContract={contractForNewSubStatement}
        currentUser={currentUser}
        onSave={handleSaveSubStatement}
      />

      <NewSubcontractorContractModal
        isOpen={isNewSubContractOpen}
        onClose={() => setIsNewSubContractOpen(false)}
        projects={projects}
        currentUser={currentUser}
        onSave={handleSaveSubContract}
      />

      <SubcontractorPaymentModal
        isOpen={isSubPaymentOpen}
        onClose={() => {
          setIsSubPaymentOpen(false);
          setStatementForPayment(null);
        }}
        statement={statementForPayment}
        bankAccounts={bankAccounts}
        currentUser={currentUser}
        onConfirmPayment={handleConfirmSubPayment}
      />

      <SubcontractorStatementDetailModal
        isOpen={isSubStatementDetailOpen}
        onClose={() => {
          setIsSubStatementDetailOpen(false);
          setSelectedSubStatement(null);
        }}
        statement={selectedSubStatement}
        currentUser={currentUser}
        onUpdateStatus={handleUpdateSubStatementStatus}
        onOpenPaymentModal={(stm) => {
          setStatementForPayment(stm);
          setIsSubPaymentOpen(true);
        }}
      />

      {/* =========================================================================
          CLIENT MODALS
          ========================================================================= */}
      {selectedStatement && (
        <StatementDetailAndPrintModal
          statement={selectedStatement}
          currentUser={currentUser}
          onClose={() => setSelectedStatement(null)}
          onUpdateStatus={handleUpdateStatementStatus}
          onIssueAccountingEntry={handleIssueAccountingEntryForStatement}
        />
      )}

      {isNewStatementOpen && (
        <NewStatementModal
          contracts={contracts}
          allBOQItems={boqItems}
          preselectedContract={contractForNewStatement}
          currentUser={currentUser}
          onClose={() => setIsNewStatementOpen(false)}
          onSaveStatement={handleSaveStatement}
        />
      )}

      {isNewContractOpen && (
        <NewContractModal
          projects={projects}
          currentUser={currentUser}
          onClose={() => setIsNewContractOpen(false)}
          onSaveContract={handleSaveContract}
        />
      )}

      {isNewAmendmentOpen && contractForNewAmendment && (
        <NewAmendmentModal
          contract={contractForNewAmendment}
          currentUser={currentUser}
          onClose={() => setIsNewAmendmentOpen(false)}
          onSaveAmendment={handleSaveAmendment}
        />
      )}

      {isRecordReceiptOpen && (
        <RecordReceiptModal
          statements={statements}
          contracts={contracts}
          bankAccounts={bankAccounts}
          currentUser={currentUser}
          onClose={() => setIsRecordReceiptOpen(false)}
          onSavePayment={handleSavePaymentReceipt}
        />
      )}
    </div>
  );
};
