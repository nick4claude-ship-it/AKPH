/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Contract,
  DetailedProgressStatement,
  Project,
  UserProfile,
  ContractsMainViewMode,
  SubcontractorContract,
  SubcontractorProgressStatement,
  SubcontractorSubTab,
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
import { DeductionsEngineView } from './DeductionsEngineView';
import { AdjustmentsEngineView } from './AdjustmentsEngineView';
import { PaymentsReceivablesView } from './PaymentsReceivablesView';
import { ContractReportsView } from './ContractReportsView';
import { ContractDocumentsView } from './ContractDocumentsView';
import { useAppState, useSelector } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { useCompany } from '../../store/session';
import { formatInt } from '../../utils/money';
import { selectStatementPayments } from '../../store/domainSelectors';
import { selectContractFiles, subcontractorCounts } from '../../store/views/contracts';
import type { WorkflowResult } from '../../store/workflowKit';
import { SubcontractorDashboard } from './subcontractors/SubcontractorDashboard';
import { SubcontractorStatementsListView } from './subcontractors/SubcontractorStatementsListView';
import { SubcontractorContractsListView } from './subcontractors/SubcontractorContractsListView';
import { SubcontractorApprovalsQueue } from './subcontractors/SubcontractorApprovalsQueue';
import { SubcontractorMatrixView } from './subcontractors/SubcontractorMatrixView';
import { NewSubcontractorStatementModal } from './subcontractors/NewSubcontractorStatementModal';
import { NewSubcontractorContractModal } from './subcontractors/NewSubcontractorContractModal';
import { SubcontractorStatementDetailModal } from './subcontractors/SubcontractorStatementDetailModal';

interface ContractsModuleProps {
  /** Client (inbound revenue) and subcontract (outbound) contracts are separate pages. */
  mode: ContractsMainViewMode;
  projects: Project[];
  currentUser: UserProfile;
  onPosted?: (docNumber: string) => void;
  onToast?: (msg: string) => void;
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
  mode,
  projects,
  currentUser,
  onPosted,
  onToast,
}) => {
  const company = useCompany();
  const appState = useAppState();
  const wf = useWorkflows();
  const navigate = useNavigate();
  const toast = (r: WorkflowResult) => {
    onToast?.(r.message);
    if (r.ok && r.docNumber) onPosted?.(r.docNumber);
  };
  // Top-level mode comes from the route: /contracts/client or /contracts/subcontract.
  const mainMode = mode;
  const setMainMode = (m: ContractsMainViewMode) => navigate(m === 'client' ? '/contracts/client' : '/contracts/subcontract');

  // Client Section States
  const [activeTab, setActiveTab] = useState<ContractsSubTab>('dashboard');
  const {
    contracts,
    contractBoq: boqItems,
    clientStatements: statements,
    contractAmendments: amendments,
    advancePayments,
    priceAdjustments: adjustments,
    contractAuditLogs: auditLogs,
    subcontractorContracts: subContracts,
    subcontractorStatements: subStatements,
  } = appState;
  // Receipts and documents are single records in their own layers; contracts only view them.
  const payments = useSelector(selectStatementPayments);
  const documents = useSelector(selectContractFiles);
  const subCounts = useMemo(() => subcontractorCounts(subStatements), [subStatements]);

  // Subcontractor Section States
  const [subTab, setSubTab] = useState<SubcontractorSubTab>('dashboard');
  const [selectedSubContract, setSelectedSubContract] = useState<SubcontractorContract | null>(null);
  const [selectedSubStatement, setSelectedSubStatement] = useState<SubcontractorProgressStatement | null>(null);

  // Subcontractor Modals
  const [isNewSubContractOpen, setIsNewSubContractOpen] = useState(false);
  const [isNewSubStatementOpen, setIsNewSubStatementOpen] = useState(false);
  const [contractForNewSubStatement, setContractForNewSubStatement] = useState<SubcontractorContract | null>(null);
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
  const setIsRecordReceiptOpen = (_open: boolean) => navigate('/finance/receipts');

  // ---------------- Subcontractor Handlers ----------------
  const handleSelectSubContract = (subContract: SubcontractorContract) => {
    setSelectedSubContract(subContract);
    setSubTab('dashboard');
  };

  const handleOpenNewSubStatement = (contract?: SubcontractorContract) => {
    setContractForNewSubStatement(contract || selectedSubContract || subContracts[0] || null);
    setIsNewSubStatementOpen(true);
  };

  // Saving and approving run in the store's workflow service (same code as the approval center).
  const reportIfOk = (result: WorkflowResult) => {
    if (result.ok) onToast?.(result.message);
    return result;
  };

  const handleSubStatementDecision = (statementId: string, decision: 'approve' | 'return' | 'reject', comment?: string) => {
    toast(wf.decideSubcontractorStatement(statementId, decision, comment));
    if (selectedSubStatement?.id === statementId) setSelectedSubStatement(null);
  };

  // Payment happens only in treasury: open the payment queue for this statement.
  const openSubPayment = (statement: SubcontractorProgressStatement) => {
    navigate(`/finance/payments?source=${statement.id}`);
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

  // The open contract follows the store (an approved amendment changes its value).
  const openContract = selectedContract ? contracts.find((c) => c.id === selectedContract.id) || selectedContract : null;

  const handleStatementDecision = (statementId: string, decision: 'approve' | 'return', reason?: string) => {
    toast(wf.decideClientStatement(statementId, decision, reason));
    if (selectedStatement?.id === statementId) setSelectedStatement(null);
  };

  // Employer approval posts the receivable automatically; this only reports the existing document.
  const handleIssueAccountingEntryForStatement = (statement: DetailedProgressStatement) => {
    onToast?.(
      statement.accountingJournalEntryId
        ? `سند مطالبات ${statement.accountingJournalEntryId} هنگام تأیید کارفرما صادر شده است.`
        : 'سند مطالبات پس از ثبت تأیید کارفرما به‌صورت خودکار صادر می‌شود.'
    );
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP LEVEL PRIMARY DUAL MODE SELECTOR (Requested explicitly by USER):
          1. صورت‌وضعیت کارفرما (Client Progress Statements - پول ورودی به {company.name})
          2. صورت‌وضعیت پیمانکاران جزء (Subcontractor Progress Statements - پول خروجی از {company.name})
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
                  پولی که {company.name} از کارفرما مطالبه می‌کند (درآمد و وصولی)
                </span>
              </div>
              <span
                className={`mr-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  mainMode === 'client' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {formatInt(contracts.length)}
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
                  پولی که جوشکار، آرماتوربند، بنّا، تأسیسات و... از {company.name} مطالبه می‌کنند
                </span>
              </div>
              <div className="flex items-center gap-1 mr-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    mainMode === 'subcontractor' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {formatInt(subContracts.length)}
                </span>
                {subCounts.urgentPayments > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500 text-white animate-pulse">
                    {formatInt(subCounts.urgentPayments)} بدهی
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
                      setActiveTab(tab.id as ContractsSubTab);
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
                        {typeof tab.badge === 'number' ? formatInt(tab.badge) : tab.badge}
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

          {activeTab === 'contract_detail' && openContract && (
            <ContractDetailView
              contract={openContract}
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
              onUpload={() => navigate('/documents')}
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
                  badge: subCounts.pendingApprovals > 0 ? subCounts.pendingApprovals : undefined,
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
                    onClick={() => setSubTab(tab.id as SubcontractorSubTab)}
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
                        {typeof tab.badge === 'number' ? formatInt(tab.badge) : tab.badge}
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
              onPayStatement={(stm) => openSubPayment(stm)}
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
              onPayStatement={(stm) => openSubPayment(stm)}
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
              onDecide={handleSubStatementDecision}
              onPayStatement={(stm) => openSubPayment(stm)}
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
      {isNewSubStatementOpen && (
      <NewSubcontractorStatementModal
        onClose={() => setIsNewSubStatementOpen(false)}
        contracts={subContracts}
        initialContract={contractForNewSubStatement}
        currentUser={currentUser}
        onSave={(form) => reportIfOk(wf.submitSubcontractorStatementForm(form))}
      />
      )}

      {isNewSubContractOpen && (
      <NewSubcontractorContractModal
        isOpen={isNewSubContractOpen}
        onClose={() => setIsNewSubContractOpen(false)}
        projects={projects}
        currentUser={currentUser}
        onSave={(input) => reportIfOk(wf.createSubcontractorContract(input))}
      />
      )}

      <SubcontractorStatementDetailModal
        isOpen={isSubStatementDetailOpen}
        onClose={() => {
          setIsSubStatementDetailOpen(false);
          setSelectedSubStatement(null);
        }}
        statement={selectedSubStatement}
        currentUser={currentUser}
        onDecide={handleSubStatementDecision}
        onOpenPaymentModal={(stm) => openSubPayment(stm)}
      />

      {/* =========================================================================
          CLIENT MODALS
          ========================================================================= */}
      {selectedStatement && (
        <StatementDetailAndPrintModal
          statement={selectedStatement}
          currentUser={currentUser}
          onClose={() => setSelectedStatement(null)}
          onDecide={handleStatementDecision}
          onIssueAccountingEntry={handleIssueAccountingEntryForStatement}
        />
      )}

      {isNewStatementOpen && (
        <NewStatementModal
          contracts={contracts}
          preselectedContract={contractForNewStatement}
          currentUser={currentUser}
          onClose={() => setIsNewStatementOpen(false)}
          onSaveStatement={(form, target) => {
            const result = wf.submitClientStatementForm(form, target);
            onToast?.(result.message);
            return result;
          }}
        />
      )}

      {isNewContractOpen && (
        <NewContractModal
          projects={projects}
          currentUser={currentUser}
          onClose={() => setIsNewContractOpen(false)}
          onSaveContract={(input) => reportIfOk(wf.createClientContract(input))}
        />
      )}

      {isNewAmendmentOpen && contractForNewAmendment && (
        <NewAmendmentModal
          contract={contractForNewAmendment}
          currentUser={currentUser}
          onClose={() => setIsNewAmendmentOpen(false)}
          onSaveAmendment={(input) => reportIfOk(wf.createContractAmendment(contractForNewAmendment.id, input))}
        />
      )}

    </div>
  );
};
