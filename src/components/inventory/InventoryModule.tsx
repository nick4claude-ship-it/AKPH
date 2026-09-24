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
  mockWarehouses,
  mockMaterialItems,
  mockGoodsReceipts,
  mockStoreIssues,
  mockInterTransfers,
  mockStocktakeAudits,
  mockKardexRecords,
} from '../../data/inventoryMockData';

import { InventoryDashboard } from './InventoryDashboard';
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
  onUpdateProjectCost?: (projectId: string, amount: number) => void;
  onAddJournalEntry?: (entry: any) => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  currentUser,
  projects,
  onUpdateProjectCost,
  onAddJournalEntry,
}) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<InventorySubTab>('dashboard');

  // Core State
  const [warehouses, setWarehouses] = useState<Warehouse[]>(mockWarehouses);
  const [materials, setMaterials] = useState<MaterialItem[]>(mockMaterialItems);
  const [receipts, setReceipts] = useState<GoodsReceiptNote[]>(mockGoodsReceipts);
  const [issues, setIssues] = useState<StoreIssueVoucher[]>(mockStoreIssues);
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
  const handleAddReceipt = (newReceipt: GoodsReceiptNote) => {
    setReceipts((prev) => [newReceipt, ...prev]);

    // Update material quantities in catalog & kardex
    newReceipt.items.forEach((item) => {
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === item.materialId
            ? {
                ...m,
                currentStock: m.currentStock + item.acceptedQty,
                totalStockValue: (m.currentStock + item.acceptedQty) * m.averageUnitPrice,
              }
            : m
        )
      );

      // Add to Kardex
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
        balanceQty: (materials.find((m) => m.id === item.materialId)?.currentStock || 0) + item.acceptedQty,
        unitCost: item.unitPrice,
        balanceValuation: item.totalPrice,
      };
      setKardexRecords((prev) => [newKardex, ...prev]);
    });

    // Update warehouse total valuation
    setWarehouses((prev) =>
      prev.map((w) =>
        w.id === newReceipt.warehouseId
          ? { ...w, totalValuation: w.totalValuation + newReceipt.totalAmount }
          : w
      )
    );

    // Emit Accounting Journal Entry (ورود کالا به انبار)
    if (onAddJournalEntry) {
      onAddJournalEntry({
        date: newReceipt.date,
        description: `ثبت رسید انبار مصالح شماره ${newReceipt.receiptNumber} - ${newReceipt.supplierName}`,
        reference: newReceipt.receiptNumber,
        items: [
          {
            accountCode: '۱۱۱۰۱',
            accountName: 'موجودی کالا و مصالح انبار کارگاه',
            debit: newReceipt.totalAmount,
            credit: 0,
          },
          {
            accountCode: '۲۰۱۰۱',
            accountName: 'حساب‌های پرداختنی تجاری - تأمین‌کنندگان',
            debit: 0,
            credit: newReceipt.totalAmount,
          },
        ],
      });
    }

    showToast(`رسید انبار ${newReceipt.receiptNumber} با موفقیت ثبت و به موجودی اضافه شد.`);
  };

  // Handler: Add new Store Issue Voucher (SIV)
  const handleAddIssue = (newIssue: StoreIssueVoucher) => {
    setIssues((prev) => [newIssue, ...prev]);

    // Decrease material stock & update Kardex
    newIssue.items.forEach((item) => {
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === item.materialId
            ? {
                ...m,
                currentStock: Math.max(0, m.currentStock - item.issuedQty),
                totalStockValue: Math.max(0, m.currentStock - item.issuedQty) * m.averageUnitPrice,
              }
            : m
        )
      );

      const targetMat = materials.find((m) => m.id === item.materialId);
      const newBal = targetMat ? Math.max(0, targetMat.currentStock - item.issuedQty) : 0;

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

    // Decrease warehouse total valuation
    setWarehouses((prev) =>
      prev.map((w) =>
        w.id === newIssue.warehouseId
          ? { ...w, totalValuation: Math.max(0, w.totalValuation - newIssue.totalCost) }
          : w
      )
    );

    // Update project cost
    if (onUpdateProjectCost && newIssue.projectId) {
      onUpdateProjectCost(newIssue.projectId, newIssue.totalCost);
    }

    // Emit Accounting Journal Entry (بهای تمام‌شده مصالح مصرفی در پروژه)
    if (onAddJournalEntry) {
      onAddJournalEntry({
        date: newIssue.date,
        description: `حواله مصرف مصالح ${newIssue.issueNumber} - پروژه ${newIssue.projectName} (${newIssue.costCenter})`,
        reference: newIssue.issueNumber,
        items: [
          {
            accountCode: '۵۰۱۰۱',
            accountName: `هزینه‌های مستقیم پروژه - مصرف مصالح (${newIssue.projectName})`,
            debit: newIssue.totalCost,
            credit: 0,
          },
          {
            accountCode: '۱۱۱۰۱',
            accountName: 'موجودی کالا و مصالح انبار کارگاه',
            debit: 0,
            credit: newIssue.totalCost,
          },
        ],
      });
    }

    const contraMsg = newIssue.isSubcontractorContra
      ? ' (مشمول تهاتر با صورت‌وضعیت پیمانکار جزء)'
      : '';
    showToast(`حواله خروج ${newIssue.issueNumber} ثبت و از انبار کسر شد${contraMsg}.`);
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
    if (!audit) return;

    const jvCode = `JV-ADJ-STK-${Math.floor(100 + Math.random() * 900)}`;

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

    if (onAddJournalEntry) {
      const isLoss = audit.netVarianceAmount < 0;
      const absAmount = Math.abs(audit.netVarianceAmount);

      onAddJournalEntry({
        date: audit.date,
        description: `سند تعدیل انبارگردانی ${audit.auditNumber} - ${audit.warehouseName}`,
        reference: jvCode,
        items: isLoss
          ? [
              {
                accountCode: '۶۰۱۰۱',
                accountName: 'کسری و اضافات انبار (هزینه غیرعملیاتی)',
                debit: absAmount,
                credit: 0,
              },
              {
                accountCode: '۱۱۱۰۱',
                accountName: 'موجودی کالا و مصالح انبار',
                debit: 0,
                credit: absAmount,
              },
            ]
          : [
              {
                accountCode: '۱۱۱۰۱',
                accountName: 'موجودی کالا و مصالح انبار',
                debit: absAmount,
                credit: 0,
              },
              {
                accountCode: '۷۰۱۰۱',
                accountName: 'اضافات انبارگردانی (سایر درآمدهای عملیاتی)',
                debit: 0,
                credit: absAmount,
              },
            ],
      });
    }

    showToast(`سند تعدیل انبارگردانی ${jvCode} با موفقیت در حسابداری ثبت شد.`);
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
