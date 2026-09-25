/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mockProjects } from './data/mockData';
import { mockCounterparties } from './data/counterpartiesMockData';
import { mockContracts, mockDetailedStatements } from './data/contractsMockData';
import { mockSubcontractorContracts, mockSubcontractorStatements } from './data/subcontractorsMockData';
import { mockPurchaseOrders, mockVendorInvoices } from './data/procurementMockData';
import { mockGoodsReceipts, mockStoreIssues } from './data/inventoryMockData';
import { mockSystemDocuments } from './data/documentsMockData';
import { mockCostCenters } from './data/accountingMockData';
import { mockPaymentRequests, mockCashDesks } from './data/paymentsTreasuryMockData';
import { mockPettyCashAccounts, mockPettyCashExpenses } from './data/pettyCashMockData';

export interface ReferenceValidationResult {
  valid: boolean;
  totalChecks: number;
  brokenCount: number;
  errors: string[];
}

/**
 * Validates cross-entity referential integrity across all mock datasets.
 * Checks for:
 * - Valid project IDs (prj-101..105, strictly no 'all')
 * - Valid cost centers (cc-hq, cc-prj101-01, etc.)
 * - Valid counterparties (cp-...)
 * - Valid contracts (cnt-...)
 * - Valid GoodsReceiptNote -> PurchaseOrder references
 * - Valid VendorInvoice -> PurchaseOrder & GoodsReceiptNote references
 * - Valid Document -> Contract & Statement references
 * - Valid SubcontractorStatement -> SubcontractorContract references
 */
export function validateMockReferences(): ReferenceValidationResult {
  const errors: string[] = [];
  let checks = 0;

  // Build ID lookup sets
  const validProjectIds = new Set(mockProjects.map((p) => p.id));
  const validCostCenterIds = new Set(mockCostCenters.map((c) => c.id));
  // In addition, allow dynamically generated project cost center IDs matching project codes
  validProjectIds.forEach((pId) => {
    validCostCenterIds.add(`cc-${pId}-01`);
    validCostCenterIds.add(`cc-${pId}-02`);
    validCostCenterIds.add(`cc-${pId.replace('prj-', 'prj')}-01`);
    validCostCenterIds.add(`cc-${pId.replace('prj-', 'prj')}-02`);
  });
  validCostCenterIds.add('cc-hq');

  const validCounterpartyIds = new Set(mockCounterparties.map((c) => c.id));
  const validContractIds = new Set(mockContracts.map((c) => c.id));
  const validStatementIds = new Set(mockDetailedStatements.map((s) => s.id));
  const validSubcontractorContractIds = new Set(mockSubcontractorContracts.map((s) => s.id));
  const validPoIds = new Set(mockPurchaseOrders.map((p) => p.id));
  const validGrnIds = new Set(mockGoodsReceipts.map((g) => g.id));

  const checkRef = (
    entity: string,
    id: string,
    field: string,
    refId: string | undefined | null,
    validSet: Set<string>,
    optional = false
  ) => {
    checks++;
    if (!refId) {
      if (!optional) {
        errors.push(`[${entity} ${id}] Missing mandatory reference in field '${field}'`);
      }
      return;
    }
    if (refId === 'all') {
      errors.push(`[${entity} ${id}] Invalid wildcard 'all' found in field '${field}'`);
      return;
    }
    if (!validSet.has(refId)) {
      errors.push(`[${entity} ${id}] Broken reference: '${field}' = '${refId}' does not exist.`);
    }
  };

  // 1. Validate Projects
  mockProjects.forEach((prj) => {
    checkRef('Project', prj.id, 'clientId', prj.clientId, validCounterpartyIds, true);
    checkRef('Project', prj.id, 'consultantId', prj.consultantId, validCounterpartyIds, true);
    if (prj.contractIds) {
      prj.contractIds.forEach((cId) => checkRef('Project', prj.id, 'contractIds', cId, validContractIds));
    }
    if (prj.costCenterIds) {
      prj.costCenterIds.forEach((ccId) => checkRef('Project', prj.id, 'costCenterIds', ccId, validCostCenterIds));
    }
  });

  // 2. Validate Contracts & Statements
  mockContracts.forEach((cnt) => {
    checkRef('Contract', cnt.id, 'projectId', cnt.projectId, validProjectIds);
    checkRef('Contract', cnt.id, 'counterpartyId', cnt.counterpartyId, validCounterpartyIds, true);
    checkRef('Contract', cnt.id, 'costCenterId', cnt.costCenterId, validCostCenterIds, true);
  });

  mockDetailedStatements.forEach((stm) => {
    checkRef('Statement', stm.id, 'projectId', stm.projectId, validProjectIds);
    checkRef('Statement', stm.id, 'contractId', stm.contractId, validContractIds);
    checkRef('Statement', stm.id, 'counterpartyId', stm.counterpartyId, validCounterpartyIds, true);
    checkRef('Statement', stm.id, 'costCenterId', stm.costCenterId, validCostCenterIds, true);
  });

  // 3. Validate Subcontractors
  mockSubcontractorContracts.forEach((subCnt) => {
    checkRef('SubcontractorContract', subCnt.id, 'projectId', subCnt.projectId, validProjectIds);
    checkRef('SubcontractorContract', subCnt.id, 'counterpartyId', subCnt.counterpartyId, validCounterpartyIds, true);
    checkRef('SubcontractorContract', subCnt.id, 'costCenterId', subCnt.costCenterId, validCostCenterIds, true);
  });

  mockSubcontractorStatements.forEach((subStm) => {
    checkRef('SubcontractorStatement', subStm.id, 'projectId', subStm.projectId, validProjectIds);
    checkRef('SubcontractorStatement', subStm.id, 'subcontractorContractId', subStm.subcontractorContractId, validSubcontractorContractIds);
    checkRef('SubcontractorStatement', subStm.id, 'counterpartyId', subStm.counterpartyId, validCounterpartyIds, true);
    checkRef('SubcontractorStatement', subStm.id, 'costCenterId', subStm.costCenterId, validCostCenterIds, true);
  });

  // 4. Validate Procurement & Inventory (GoodsReceiptNote.poId, VendorInvoice.grnId)
  mockPurchaseOrders.forEach((po) => {
    checkRef('PurchaseOrder', po.id, 'projectId', po.projectId, validProjectIds);
    checkRef('PurchaseOrder', po.id, 'counterpartyId', po.counterpartyId, validCounterpartyIds, true);
    checkRef('PurchaseOrder', po.id, 'costCenterId', po.costCenterId, validCostCenterIds, true);
  });

  mockGoodsReceipts.forEach((grn) => {
    checkRef('GoodsReceiptNote', grn.id, 'projectId', grn.projectId, validProjectIds);
    checkRef('GoodsReceiptNote', grn.id, 'poId', grn.poId, validPoIds);
    checkRef('GoodsReceiptNote', grn.id, 'counterpartyId', grn.counterpartyId, validCounterpartyIds, true);
    checkRef('GoodsReceiptNote', grn.id, 'costCenterId', grn.costCenterId, validCostCenterIds, true);
  });

  mockVendorInvoices.forEach((vinv) => {
    checkRef('VendorInvoice', vinv.id, 'projectId', vinv.projectId, validProjectIds);
    checkRef('VendorInvoice', vinv.id, 'poId', vinv.poId, validPoIds);
    checkRef('VendorInvoice', vinv.id, 'grnId', vinv.grnId, validGrnIds);
    checkRef('VendorInvoice', vinv.id, 'counterpartyId', vinv.counterpartyId, validCounterpartyIds, true);
    checkRef('VendorInvoice', vinv.id, 'costCenterId', vinv.costCenterId, validCostCenterIds, true);
  });

  mockStoreIssues.forEach((siv) => {
    checkRef('StoreIssueVoucher', siv.id, 'projectId', siv.projectId, validProjectIds);
    checkRef('StoreIssueVoucher', siv.id, 'costCenterId', siv.costCenterId, validCostCenterIds, true);
  });

  // 5. Validate Documents (SystemDocument contractId, statementId, partnerId)
  mockSystemDocuments.forEach((doc) => {
    checkRef('SystemDocument', doc.id, 'projectId', doc.projectId, validProjectIds);
    if (doc.contractId) {
      checkRef('SystemDocument', doc.id, 'contractId', doc.contractId, validContractIds);
    }
    if (doc.statementId) {
      checkRef('SystemDocument', doc.id, 'statementId', doc.statementId, validStatementIds, true);
    }
    if (doc.partnerId) {
      checkRef('SystemDocument', doc.id, 'partnerId', doc.partnerId, validCounterpartyIds, true);
    }
    checkRef('SystemDocument', doc.id, 'costCenterId', doc.costCenterId, validCostCenterIds, true);
  });

  // 6. Validate Payments & Petty Cash
  mockPaymentRequests.forEach((pr) => {
    checkRef('PaymentRequest', pr.id, 'projectId', pr.projectId, validProjectIds);
    checkRef('PaymentRequest', pr.id, 'costCenterId', pr.costCenterId, validCostCenterIds, true);
    checkRef('PaymentRequest', pr.id, 'counterpartyId', pr.counterpartyId, validCounterpartyIds, true);
  });

  mockCashDesks.forEach((csh) => {
    if (csh.projectId) {
      checkRef('CashDesk', csh.id, 'projectId', csh.projectId, validProjectIds);
    }
  });

  mockPettyCashAccounts.forEach((pca) => {
    checkRef('PettyCashAccount', pca.id, 'projectId', pca.projectId, validProjectIds);
    checkRef('PettyCashAccount', pca.id, 'costCenterId', pca.costCenterId, validCostCenterIds, true);
  });

  mockPettyCashExpenses.forEach((pce) => {
    checkRef('PettyCashExpense', pce.id, 'projectId', pce.projectId, validProjectIds);
    checkRef('PettyCashExpense', pce.id, 'costCenterId', pce.costCenterId, validCostCenterIds, true);
    checkRef('PettyCashExpense', pce.id, 'counterpartyId', pce.counterpartyId, validCounterpartyIds, true);
  });

  const result: ReferenceValidationResult = {
    valid: errors.length === 0,
    totalChecks: checks,
    brokenCount: errors.length,
    errors,
  };

  if (result.valid) {
    console.log(
      `%c[Demo data reference validation] SUCCESS: All ${checks} cross-entity references verified with 0 broken references.`,
      'color: #10b981; font-weight: bold;'
    );
  } else {
    console.error(
      `%c[Demo data reference validation] FAILED: ${errors.length} broken references found out of ${checks} checks:`,
      'color: #ef4444; font-weight: bold;',
      errors
    );
  }

  return result;
}
