/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  InventorySubTab,
  Warehouse,
  MaterialItem,
  GoodsReceiptNote,
  StoreIssueVoucher,
  InterWarehouseTransfer,
  StocktakeAudit,
  KardexEntry,
  Project,
  UserProfile,
} from '../../types';
import {
  mockInterTransfers,
  mockStocktakeAudits,
  mockKardexRecords,
} from '../../data/inventoryMockData';

import { InventoryDashboard } from './InventoryDashboard';
import { useStoreSlice, usePostFinancialEvent } from '../../store/AppStore';
import { goodsReceiptEvent, storeIssueEvent } from '../../store/events';
import { receiveIntoStock, issueFromStock } from '../../store/inventoryCosting';
import { MaterialsCatalogView } from './MaterialsCatalogView';
import { GoodsReceiptsListView } from './GoodsReceiptsListView';
import { StoreIssuesListView } from './StoreIssuesListView';
import { InterTransfersView } from './InterTransfersView';
import { KardexView } from './KardexView';
import { StocktakeView } from './StocktakeView';
import { WarehousesListView } from './WarehousesListView';

import { NewGoodsReceiptModal } from './NewGoodsReceiptModal';
import { NewStoreIssueModal } from './NewStoreIssueModal';
import { NewTransferModal } from './NewTransferModal';
import { NewMaterialModal } from './NewMaterialModal';
import { InventoryDocumentModal } from './InventoryDocumentModal';

import {
  Warehouse as WarehouseIcon,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  FileSpreadsheet,
  Scale,
  Building,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
} from 'lucide-react';

interface InventoryModuleProps {
  currentUser: UserProfile;
  projects: Project[];
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  currentUser,
  projects,
}) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<InventorySubTab>('dashboard');

  // Core State
  const postFinancialEvent = usePostFinancialEvent();
  const [warehouses, setWarehouses] = useStoreSlice('warehouses');
  const [materials, setMaterials] = useStoreSlice('materials');
  const [receipts, setReceipts] = useStoreSlice('goodsReceipts');
  const [issues, setIssues] = useStoreSlice('storeIssues');
  const [transfers, setTransfers] = useState<InterWarehouseTransfer[]>(mockInterTransfers);
  const [stocktakes, setStocktakes] = useState<StocktakeAudit[]>(mockStocktakeAudits);
  const [kardexRecords, setKardexRecords] = useState<KardexEntry[]>(mockKardexRecords);

  // Selected Material for Kardex
  const [selectedKardexMaterialId, setSelectedKardexMaterialId] = useState<string | undefined>(undefined);

  // Modals
  const [isNewReceiptOpen, setIsNewReceiptOpen] = useState(false);
  const [isNewIssueOpen, setIsNewIssueOpen] = useState(false);
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
  const [isNewMaterialOpen, setIsNewMaterialOpen] = useState(false);

  // Document View Modal
  const [activeReceiptDoc, setActiveReceiptDoc] = useState<GoodsReceiptNote | null>(null);
  const [activeIssueDoc, setActiveIssueDoc] = useState<StoreIssueVoucher | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Handler: Add new Goods Receipt Note (GRN)
  // Stock enters at purchase price and the moving weighted-average cost is updated. The accounting
  // effect is Dr inventory / Cr goods-received-not-invoiced; project cost is untouched until issue.
  const handleAddReceipt = (newReceipt: GoodsReceiptNote) => {
    const receivedValue = newReceipt.items.reduce((sum, item) => sum + item.acceptedQty * item.unitPrice, 0);
    const posting = postFinancialEvent(
      { ...goodsReceiptEvent(newReceipt), amount: receivedValue },
      { submitter: currentUser.name }
    );
    if (!posting.ok) {
      showToast(`ثبت رسید انبار ${newReceipt.receiptNumber} انجام نشد: ${posting.error}`);
      return;
    }

    setReceipts((prev) => [{ ...newReceipt, accountingJournalEntryId: posting.event?.docNumber }, ...prev]);

    newReceipt.items.forEach((item) => {
      const before = materials.find((m) => m.id === item.materialId);
      const balanceQty = (before?.currentStock || 0) + item.acceptedQty;

      setMaterials((prev) =>
        prev.map((m) => (m.id === item.materialId ? receiveIntoStock(m, item.acceptedQty, item.unitPrice) : m))
      );

      const newKardex: KardexEntry = {
        id: `kdx-${Date.now()}-${Math.random()}`,
        materialId: item.materialId,
        date: newReceipt.date,
        docType: 'رسید ورود انبار',
        docNumber: newReceipt.receiptNumber,
        warehouseName: newReceipt.warehouseName,
        counterparty: newReceipt.supplierName,
        inQty: item.acceptedQty,
        outQty: 0,
        balanceQty,
        unitCost: item.unitPrice,
        balanceValuation: item.acceptedQty * item.unitPrice,
      };
      setKardexRecords((prev) => [newKardex, ...prev]);
    });

    setWarehouses((prev) =>
      prev.map((w) =>
        w.id === newReceipt.warehouseId ? { ...w, totalValuation: w.totalValuation + receivedValue } : w
      )
    );

    showToast(`رسید انبار ${newReceipt.receiptNumber} ثبت و سند ${posting.event?.docNumber} صادر شد.`);
  };

  // Handler: Add new Store Issue Voucher (SIV)
  // Issued quantities are costed at the material's current weighted-average price; this is the only
  // point where material cost is charged to the project (Dr project cost / Cr inventory).
  const handleAddIssue = (newIssue: StoreIssueVoucher) => {
    const costedItems = newIssue.items.map((item) => {
      const material = materials.find((m) => m.id === item.materialId);
      if (!material) return item;
      return { ...item, unitCost: material.averageUnitPrice, totalCost: issueFromStock(material, item.issuedQty).cost };
    });
    const issueCost = costedItems.reduce((sum, item) => sum + item.totalCost, 0);
    const costedIssue: StoreIssueVoucher = { ...newIssue, items: costedItems, totalCost: issueCost };

    const posting = postFinancialEvent(storeIssueEvent(costedIssue, issueCost), { submitter: currentUser.name });
    if (!posting.ok) {
      showToast(`ثبت حواله ${newIssue.issueNumber} انجام نشد: ${posting.error}`);
      return;
    }

    setIssues((prev) => [{ ...costedIssue, accountingJournalEntryId: posting.event?.docNumber }, ...prev]);

    costedItems.forEach((item) => {
      const targetMat = materials.find((m) => m.id === item.materialId);
      const newBal = targetMat ? Math.max(0, targetMat.currentStock - item.issuedQty) : 0;

      setMaterials((prev) =>
        prev.map((m) => (m.id === item.materialId ? issueFromStock(m, item.issuedQty).material : m))
      );

      const newKardex: KardexEntry = {
        id: `kdx-${Date.now()}-${Math.random()}`,
        materialId: item.materialId,
        date: newIssue.date,
        docType: 'حواله مصرف کارگاه',
        docNumber: newIssue.issueNumber,
        warehouseName: newIssue.warehouseName,
        counterparty: newIssue.subcontractorName || 'اکیپ اجرایی پروژه',
        inQty: 0,
        outQty: item.issuedQty,
        balanceQty: newBal,
        unitCost: item.unitCost,
        balanceValuation: newBal * item.unitCost,
      };
      setKardexRecords((prev) => [newKardex, ...prev]);
    });

    setWarehouses((prev) =>
      prev.map((w) =>
        w.id === newIssue.warehouseId ? { ...w, totalValuation: Math.max(0, w.totalValuation - issueCost) } : w
      )
    );

    const contraMsg = newIssue.isSubcontractorContra
      ? ' (مشمول تهاتر با صورت‌وضعیت پیمانکار جزء)'
      : '';
    showToast(`حواله خروج ${newIssue.issueNumber} ثبت و سند ${posting.event?.docNumber} صادر شد${contraMsg}.`);
  };

  // Handler: Add new Inter-site Transfer
  const handleAddTransfer = (newTrf: InterWarehouseTransfer) => {
    setTransfers((prev) => [newTrf, ...prev]);
    showToast(`مجوز انتقال ${newTrf.transferNumber} صادر و وضعیت به "در مسیر حمل" تغییر یافت.`);
  };

  // Handler: Update transfer status (e.g. mark delivered)
  const handleUpdateTransferStatus = (transferId: string, newStatus: InterWarehouseTransfer['status']) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? { ...t, status: newStatus } : t))
    );
    showToast(`وضعیت انتقال به "${newStatus}" به‌روزرسانی شد.`);
  };

  // Handler: Add new Material to catalog
  const handleAddMaterial = (newMat: MaterialItem) => {
    setMaterials((prev) => [newMat, ...prev]);
    showToast(`کدینگ متریال جدید "${newMat.name}" در کاتالوگ ثبت گردید.`);
  };

  // Handler: Apply Stocktake adjustment journal
  const handleApplyAdjustmentJournal = (stocktakeId: string) => {
    const audit = stocktakes.find((s) => s.id === stocktakeId);
    if (!audit || audit.status === 'تأیید نهایی و صدور سند تعدیل') return;

    let jvCode = '';
    if (audit.netVarianceAmount !== 0) {
      const warehouse = warehouses.find((w) => w.id === audit.warehouseId);
      const posting = postFinancialEvent(
        {
          type: 'STOCKTAKE_ADJUSTMENT',
          sourceModule: 'inventory',
          sourceId: audit.id,
          projectId: warehouse?.projectId || '',
          costCenterId: '',
          counterpartyId: '',
          amount: Math.abs(audit.netVarianceAmount),
          date: audit.date,
          details: {
            docNumber: audit.auditNumber,
            direction: audit.netVarianceAmount < 0 ? 'loss' : 'gain',
            warehouseId: audit.warehouseId,
            warehouseName: audit.warehouseName,
          },
        },
        { submitter: currentUser.name }
      );
      if (!posting.ok) {
        showToast(`صدور سند تعدیل انجام نشد: ${posting.error}`);
        return;
      }
      jvCode = posting.event?.docNumber || '';
    }

    setStocktakes((prev) =>
      prev.map((s) =>
        s.id === stocktakeId
          ? {
              ...s,
              status: 'تأیید نهایی و صدور سند تعدیل',
              accountingAdjustmentEntryId: jvCode,
            }
          : s
      )
    );

    // Apply adjustments to system stock of materials
    audit.items.forEach((item) => {
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === item.materialId
            ? {
                ...m,
                currentStock: item.physicalCount,
                totalStockValue: item.physicalCount * m.averageUnitPrice,
              }
            : m
        )
      );
    });

    showToast(jvCode ? `سند تعدیل انبارگردانی ${jvCode} با موفقیت در حسابداری ثبت شد.` : 'انبارگردانی بدون مغایرت ریالی تأیید شد.');
  };

  const navTabs: { id: InventorySubTab; label: string; icon: any; count?: number }[] = [
    { id: 'dashboard', label: 'پیشخوان انبار و باسکول', icon: WarehouseIcon },
    { id: 'items', label: 'کاتالوگ کالا و مصالح', icon: Package, count: materials.length },
    { id: 'receipts', label: 'رسید ورود و بارنامه (GRN)', icon: ArrowDownLeft, count: receipts.length },
    { id: 'issues', label: 'حواله خروج و مصرف (SIV)', icon: ArrowUpRight, count: issues.length },
    { id: 'transfers', label: 'انتقال بین کارگاه‌ها', icon: ArrowRightLeft, count: transfers.length },
    { id: 'kardex', label: 'کاردکس کالا (Kardex)', icon: FileSpreadsheet },
    { id: 'stocktake', label: 'انبارگردانی و مغایرت‌گیری', icon: Scale, count: stocktakes.length },
    { id: 'warehouses', label: 'انبارها و باراندازها', icon: Building, count: warehouses.length },
  ];

  return (
    <div className="space-y-5">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Sub Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none text-xs">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-indigo-500/50 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count.toLocaleString('fa-IR')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content */}
      {activeTab === 'dashboard' && (
        <InventoryDashboard
          warehouses={warehouses}
          materials={materials}
          receipts={receipts}
          issues={issues}
          transfers={transfers}
          stocktakes={stocktakes}
          projects={projects}
          currentUser={currentUser}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onOpenNewReceipt={() => setIsNewReceiptOpen(true)}
          onOpenNewIssue={() => setIsNewIssueOpen(true)}
          onOpenNewTransfer={() => setIsNewTransferOpen(true)}
          onOpenNewMaterial={() => setIsNewMaterialOpen(true)}
          onSelectReceipt={(receipt) => {
            setActiveReceiptDoc(receipt);
            setActiveIssueDoc(null);
          }}
          onSelectIssue={(issue) => {
            setActiveIssueDoc(issue);
            setActiveReceiptDoc(null);
          }}
        />
      )}

      {activeTab === 'items' && (
        <MaterialsCatalogView
          materials={materials}
          currentUser={currentUser}
          onOpenNewMaterial={() => setIsNewMaterialOpen(true)}
          onViewKardex={(matId) => {
            setSelectedKardexMaterialId(matId);
            setActiveTab('kardex');
          }}
        />
      )}

      {activeTab === 'receipts' && (
        <GoodsReceiptsListView
          receipts={receipts}
          warehouses={warehouses}
          projects={projects}
          currentUser={currentUser}
          onOpenNewReceipt={() => setIsNewReceiptOpen(true)}
          onSelectReceipt={(receipt) => {
            setActiveReceiptDoc(receipt);
            setActiveIssueDoc(null);
          }}
        />
      )}

      {activeTab === 'issues' && (
        <StoreIssuesListView
          issues={issues}
          warehouses={warehouses}
          projects={projects}
          currentUser={currentUser}
          onOpenNewIssue={() => setIsNewIssueOpen(true)}
          onSelectIssue={(issue) => {
            setActiveIssueDoc(issue);
            setActiveReceiptDoc(null);
          }}
        />
      )}

      {activeTab === 'transfers' && (
        <InterTransfersView
          transfers={transfers}
          warehouses={warehouses}
          projects={projects}
          currentUser={currentUser}
          onOpenNewTransfer={() => setIsNewTransferOpen(true)}
          onUpdateTransferStatus={handleUpdateTransferStatus}
        />
      )}

      {activeTab === 'kardex' && (
        <KardexView
          materials={materials}
          kardexRecords={kardexRecords}
          initialMaterialId={selectedKardexMaterialId}
          currentUser={currentUser}
        />
      )}

      {activeTab === 'stocktake' && (
        <StocktakeView
          stocktakes={stocktakes}
          warehouses={warehouses}
          currentUser={currentUser}
          onApplyAdjustmentJournal={handleApplyAdjustmentJournal}
        />
      )}

      {activeTab === 'warehouses' && (
        <WarehousesListView
          warehouses={warehouses}
          projects={projects}
          currentUser={currentUser}
        />
      )}

      {/* Interactive Modals */}
      <NewGoodsReceiptModal
        isOpen={isNewReceiptOpen}
        onClose={() => setIsNewReceiptOpen(false)}
        warehouses={warehouses}
        materials={materials}
        projects={projects}
        currentUser={currentUser}
        onSubmitReceipt={handleAddReceipt}
      />

      <NewStoreIssueModal
        isOpen={isNewIssueOpen}
        onClose={() => setIsNewIssueOpen(false)}
        warehouses={warehouses}
        materials={materials}
        projects={projects}
        currentUser={currentUser}
        onSubmitIssue={handleAddIssue}
      />

      <NewTransferModal
        isOpen={isNewTransferOpen}
        onClose={() => setIsNewTransferOpen(false)}
        warehouses={warehouses}
        materials={materials}
        currentUser={currentUser}
        onSubmitTransfer={handleAddTransfer}
      />

      <NewMaterialModal
        isOpen={isNewMaterialOpen}
        onClose={() => setIsNewMaterialOpen(false)}
        currentUser={currentUser}
        onSubmitMaterial={handleAddMaterial}
      />

      <InventoryDocumentModal
        receipt={activeReceiptDoc}
        issue={activeIssueDoc}
        onClose={() => {
          setActiveReceiptDoc(null);
          setActiveIssueDoc(null);
        }}
      />
    </div>
  );
};
