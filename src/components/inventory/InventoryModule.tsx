/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  InventorySubTab,
  Warehouse,
  MaterialItem,
  GoodsReceiptNote,
  StoreIssueVoucher,
  InterWarehouseTransfer,
  Project,
  UserProfile,
} from '../../types';

import { InventoryDashboard } from './InventoryDashboard';
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { selectActiveReservationCount, selectMaterials, selectWarehouses, selectStockByWarehouse } from '../../store/domainSelectors';
import type { StoreIssueFormInput, TransferFormInput } from '../../store/views/inventory';
import type { NewMaterialInput } from '../../store/recordWorkflows';
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
  type LucideIcon,
} from 'lucide-react';
import { formatMoney } from '../../utils/money';
import { formatDecimal } from '../../utils/formatters';

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
  // Stock lives only in per-warehouse balances; catalog and warehouse totals are derived from them.
  const appState = useAppState();
  const wf = useWorkflows();
  const warehouses = useMemo(() => selectWarehouses(appState), [appState]);
  const materials = useMemo(() => selectMaterials(appState), [appState]);
  const receipts = appState.goodsReceipts;
  const issues = appState.storeIssues;
  const [stockWarehouseId, setStockWarehouseId] = useState<string>('');
  // Transfers, stocktakes and the kardex are store records written by the inventory workflows.
  const transfers = appState.interTransfers;
  const stocktakes = appState.stocktakes;
  const kardexRecords = appState.kardex;

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

  // Goods receipt from a purchase order: stock ↑, weighted average, kardex row, Dr inventory / Cr GRNI.
  const handleReceiveFromPO = (input: Parameters<typeof wf.receiveGoodsFromPO>[0]) => {
    const result = wf.receiveGoodsFromPO(input);
    showToast(result.message);
    return result;
  };

  // Issue request reserves stock; confirming it charges the project at weighted average and writes the kardex.
  const handleAddIssue = (form: StoreIssueFormInput) => {
    const result = wf.submitStoreIssueForm(form);
    showToast(result.message);
    return result;
  };

  const handleConfirmIssue = (issueId: string) => {
    const result = wf.confirmStoreIssue(issueId);
    showToast(result.message);
    if (result.ok) setActiveIssueDoc(null);
  };

  const handleReleaseIssue = (issueId: string) => {
    showToast(wf.releaseStoreIssue(issueId).message);
    setActiveIssueDoc(null);
  };

  const handleAddTransfer = (form: TransferFormInput) => {
    const result = wf.submitTransferForm(form);
    showToast(result.message);
    return result;
  };

  // Delivery moves stock between the two warehouses and writes both kardex rows.
  const handleUpdateTransferStatus = (transferId: string, newStatus: InterWarehouseTransfer['status']) => {
    showToast(wf.advanceTransfer(transferId, newStatus).message);
  };

  const handleAddMaterial = (input: NewMaterialInput) => {
    const result = wf.createMaterial(input);
    showToast(result.message);
    return result;
  };

  // Stocktake: the workflow recomputes the variance from stored balances, posts it and writes kardex rows.
  const handleApplyAdjustmentJournal = (stocktakeId: string) => showToast(wf.applyStocktakeById(stocktakeId).message);

  const navTabs: { id: InventorySubTab; label: string; icon: LucideIcon; count?: number }[] = [
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
                  {formatDecimal(tab.count)}
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
        <div className="space-y-4">
          <WarehousesListView warehouses={warehouses} projects={projects} currentUser={currentUser} />
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">موجودی به تفکیک انبار (StockBalance)</h3>
              <select
                value={stockWarehouseId || warehouses[0]?.id || ''}
                onChange={(e) => setStockWarehouseId(e.target.value)}
                className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.type})
                  </option>
                ))}
              </select>
            </div>
            <table className="w-full text-xs text-right">
              <thead className="text-[11px] text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2">کالا</th>
                  <th className="py-2 text-left">موجودی</th>
                  <th className="py-2 text-left">رزرو</th>
                  <th className="py-2 text-left">آزاد</th>
                  <th className="py-2 text-left">ارزش (میانگین موزون)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {selectStockByWarehouse(appState, stockWarehouseId || warehouses[0]?.id || '').map((b) => (
                  <tr key={b.materialId}>
                    <td className="py-2">
                      {b.material.name} <span className="text-[10px] text-slate-400 font-mono">{b.material.code}</span>
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatDecimal(b.qty)} {b.material.unit}
                    </td>
                    <td className="py-2 text-left font-mono text-amber-700">{formatDecimal(b.reservedQty)}</td>
                    <td className="py-2 text-left font-mono text-emerald-700">{formatDecimal(b.freeQty)}</td>
                    <td className="py-2 text-left font-mono">{formatMoney(b.value, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[11px] text-slate-500">
              رزروهای فعال: {formatDecimal(selectActiveReservationCount(appState))} ·
              برگشت‌ها: {formatDecimal(appState.stockReturns.length)}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Modals (mounted only while open) */}
      {isNewReceiptOpen && (
        <NewGoodsReceiptModal
          onClose={() => setIsNewReceiptOpen(false)}
          purchaseOrders={appState.purchaseOrders}
          warehouses={warehouses}
          materials={materials}
          onSubmit={handleReceiveFromPO}
        />
      )}

      {isNewIssueOpen && (
        <NewStoreIssueModal
          isOpen={isNewIssueOpen}
          onClose={() => setIsNewIssueOpen(false)}
          warehouses={warehouses}
          materials={materials}
          projects={projects}
          currentUser={currentUser}
          onSubmitIssue={handleAddIssue}
        />
      )}

      {isNewTransferOpen && (
      <NewTransferModal
        isOpen={isNewTransferOpen}
        onClose={() => setIsNewTransferOpen(false)}
        warehouses={warehouses}
        materials={materials}
        currentUser={currentUser}
        onSubmitTransfer={handleAddTransfer}
      />
      )}

      {isNewMaterialOpen && (
      <NewMaterialModal
        isOpen={isNewMaterialOpen}
        onClose={() => setIsNewMaterialOpen(false)}
        currentUser={currentUser}
        onSubmitMaterial={handleAddMaterial}
      />
      )}

      <InventoryDocumentModal
        receipt={activeReceiptDoc}
        issue={activeIssueDoc}
        onConfirmIssue={handleConfirmIssue}
        onReleaseIssue={handleReleaseIssue}
        onReturnFromProject={(issueId, materialId, qty, reason) => showToast(wf.returnFromProject(issueId, materialId, qty, reason).message)}
        onReturnToSupplier={(grnId, materialId, qty, reason) => showToast(wf.returnToSupplier(grnId, materialId, qty, reason).message)}
        onClose={() => {
          setActiveReceiptDoc(null);
          setActiveIssueDoc(null);
        }}
      />
    </div>
  );
};
