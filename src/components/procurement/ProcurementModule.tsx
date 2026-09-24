/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShoppingCart,
  FileSpreadsheet,
  Layers,
  Scale,
  FileCheck2,
  Building2,
  Plus,
  ArrowRight,
  Filter,
} from 'lucide-react';
import {
  PurchaseOrder,
  PurchaseRequisition,
  RequestForQuotation,
  VendorInvoice,
  Supplier,
  Project,
  UserProfile,
  ProcurementSubTab,
  POStatus,
} from '../../types';
import { ProcurementDashboardView } from './ProcurementDashboardView';
import { RequisitionsListView } from './RequisitionsListView';
import { PurchaseOrdersView } from './PurchaseOrdersView';
import { RfqComparisonView } from './RfqComparisonView';
import { VendorInvoicesView } from './VendorInvoicesView';
import { SuppliersDirectoryView } from './SuppliersDirectoryView';
import { NewRequisitionModal } from './NewRequisitionModal';
import { NewPurchaseOrderModal } from './NewPurchaseOrderModal';
import { NewSupplierModal } from './NewSupplierModal';
import { PurchaseOrderPrintModal } from './PurchaseOrderPrintModal';
import { useAppState, useStoreSlice } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { usePermission } from '../../store/session';
import { generateUUID, nextDocNumber } from '../../utils/ids';
import { getRelativePersianDate, toPersianDate } from '../../utils/date';
import { roundRial } from '../../utils/money';

interface ProcurementModuleProps {
  projects: Project[];
  currentUser: UserProfile;
  onToast: (msg: string) => void;
}

export const ProcurementModule: React.FC<ProcurementModuleProps> = ({
  projects,
  currentUser,
  onToast,
}) => {
  const wf = useWorkflows();
  const store = useAppState();
  const { can } = usePermission();
  const [activeTab, setActiveTab] = useState<ProcurementSubTab>('dashboard');

  // Procurement Core State
  const [suppliers, setSuppliers] = useStoreSlice('suppliers');
  const [requisitions, setRequisitions] = useStoreSlice('purchaseRequisitions');
  const [rfqs, setRfqs] = useStoreSlice('rfqs');
  const [orders, setOrders] = useStoreSlice('purchaseOrders');
  const [invoices, setInvoices] = useStoreSlice('vendorInvoices');

  // Modals state
  const [isNewRequisitionOpen, setIsNewRequisitionOpen] = useState(false);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [orderForPrint, setOrderForPrint] = useState<PurchaseOrder | null>(null);

  // Handlers
  // Approval chain (site → project → procurement → finance/CEO) is enforced by the workflow service.
  const handleApproveRequisition = (reqId: string, _level: 'site' | 'project' | 'procurement' | 'finance') => {
    onToast(wf.approveRequisition(reqId).message);
  };

  const handleConvertToRfq = (req: PurchaseRequisition) => {
    if (!can('purchase_order.create', { projectId: req.projectId })) return onToast('اجازه صدور استعلام بها را ندارید.');
    const newRfq: RequestForQuotation = {
      id: generateUUID(),
      rfqNumber: nextDocNumber(rfqs.map((r) => r.rfqNumber), 'RFQ'),
      title: `استعلام بهای اقلام درخواست ${req.requisitionNumber}`,
      dateCreated: toPersianDate(new Date()),
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
    setRfqs((prev) => [newRfq, ...prev]);
    setActiveTab('rfq');
  };

  const handleConvertToPo = (req: PurchaseRequisition) => {
    setIsNewOrderOpen(true);
  };

  const handleSelectWinningBid = (rfqId: string, quoteId: string) => {
    setRfqs((prev) =>
      prev.map((r) => {
        if (r.id !== rfqId) return r;
        const updatedQuotes = r.quotes.map((q) => ({
          ...q,
          isWinningBid: q.id === quoteId,
        }));
        const winning = updatedQuotes.find((q) => q.id === quoteId);
        return {
          ...r,
          quotes: updatedQuotes,
          status: 'برنده مشخص شد',
          selectedSupplierId: winning?.supplierId,
          selectedSupplierName: winning?.supplierName,
        };
      })
    );
  };

  const handleGeneratePoFromRfq = (rfq: RequestForQuotation) => {
    const winning = rfq.quotes.find((q) => q.isWinningBid);
    if (!winning) return;
    if (!can('purchase_order.create', { projectId: rfq.projectId })) return onToast('اجازه صدور سفارش خرید را ندارید.');

    const supplier = suppliers.find((s) => s.id === winning.supplierId);
    const project = projects.find((p) => p.id === rfq.projectId);
    const material = store.materials.find((m) => m.name === rfq.materialName);
    // The quote's VAT only applies when the supplier is VAT-registered; the rate comes from settings.
    const vatRate = winning.vatIncluded ? store.financeSettings.vatRatePercent / 100 : 0;
    const net = roundRial(winning.unitPrice * rfq.requiredQty);
    const vat = roundRial(net * vatRate);
    const freight = roundRial(winning.freightCostPerUnit * rfq.requiredQty);
    const total = net + vat + freight;

    const newPo: PurchaseOrder = {
      id: generateUUID(),
      poNumber: nextDocNumber(orders.map((o) => o.poNumber), 'PO'),
      issueDate: toPersianDate(new Date()),
      deliveryDueDate: getRelativePersianDate(winning.deliveryLeadTimeDays || 14),
      requisitionId: rfq.requisitionId,
      rfqId: rfq.id,
      projectId: rfq.projectId,
      projectName: rfq.projectName,
      costCenterId: project?.costCenterIds?.[0],
      counterpartyId: store.counterparties.find((c) => c.kind === 'supplier' && c.name === winning.supplierName)?.id,
      destinationWarehouse: store.warehouses.find((w) => w.projectId === rfq.projectId)?.name ?? 'انبار کارگاه پروژه',
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
      advancePaymentPaid: false,
      status: 'صادر شده و ابلاغ به فروشنده',
      deliveryProgressPercentage: 0,
      termsAndConditions: ['تحویل با بارنامه رسمی'],
      issuedBy: currentUser.name,
      approvedBy: '',
    };

    setOrders((prev) => [newPo, ...prev]);
    setActiveTab('purchase_orders');
  };

  const handleUpdateOrderStatus = (orderId: string, status: POStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!can('purchase_order.create', { projectId: order?.projectId })) return onToast('اجازه تغییر وضعیت سفارش را ندارید.');
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
  };

  // Invoice approval posts Dr GRNI + VAT / Cr supplier payable and queues a treasury payment request.
  // Project cost is not touched here: stocked materials reach the project only when issued.
  const handleApproveInvoice = (invoiceId: string) => onToast(wf.approveVendorInvoice(invoiceId).message);

  // Settlement happens in treasury; the request was queued on approval.
  const handleRecordPayment = (_invoiceId: string, _amount: number) => undefined;

  const tabs = [
    { id: 'dashboard', label: 'داشبورد زنجیره تأمین', icon: Layers },
    { id: 'requisitions', label: 'درخواست‌های خرید (PR)', count: requisitions.length, icon: FileSpreadsheet },
    { id: 'rfq', label: 'استعلام بها و کمیسیون (RFQ)', count: rfqs.length, icon: Scale },
    { id: 'purchase_orders', label: 'سفارش‌های خرید (PO)', count: orders.length, icon: ShoppingCart },
    { id: 'invoices', label: 'فاکتورها و تطبیق ۳جانبه', count: invoices.length, icon: FileCheck2 },
    { id: 'suppliers', label: 'وندورلیست تأمین‌کنندگان', count: suppliers.length, icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-cyan-100 text-cyan-800 font-bold px-2 py-0.5 rounded">
              ماژول زنجیره تأمین و بازرگانی (Procurement Engine)
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              چرخه استاندارد EPC
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            مدیریت تدارکات، استعلام بها، سفارش‌ها و وندورها
          </h2>
          <p className="text-xs text-slate-500">
            درخواست خرید ← استعلام بها و کمیسیون ← صدور سفارش (PO) ← رسید انبار ← فاکتور و تطبیق ۳‌جانبه ← پرداخت
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsNewRequisitionOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ثبت درخواست خرید (PR)</span>
          </button>
          <button
            onClick={() => setIsNewOrderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>صدور سفارش خرید (PO)</span>
          </button>
          <button
            onClick={() => setIsNewSupplierOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>تأمین‌کننده جدید</span>
          </button>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ProcurementSubTab)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isActive ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-view Content */}
      <div className="pt-1">
        {activeTab === 'dashboard' && (
          <ProcurementDashboardView
            orders={orders}
            requisitions={requisitions}
            rfqs={rfqs}
            invoices={invoices}
            suppliers={suppliers}
            projects={projects}
            onNavigateToTab={(t) => setActiveTab(t)}
            onSelectOrderForPrint={(o) => setOrderForPrint(o)}
            onOpenNewRequisition={() => setIsNewRequisitionOpen(true)}
            onOpenNewOrder={() => setIsNewOrderOpen(true)}
          />
        )}

        {activeTab === 'requisitions' && (
          <RequisitionsListView
            requisitions={requisitions}
            projects={projects}
            onOpenNewModal={() => setIsNewRequisitionOpen(true)}
            onApproveRequisition={handleApproveRequisition}
            onConvertToRfq={handleConvertToRfq}
            onConvertToPo={handleConvertToPo}
          />
        )}

        {activeTab === 'rfq' && (
          <RfqComparisonView
            rfqs={rfqs}
            onSelectWinningBid={handleSelectWinningBid}
            onGeneratePoFromRfq={handleGeneratePoFromRfq}
          />
        )}

        {activeTab === 'purchase_orders' && (
          <PurchaseOrdersView
            orders={orders}
            projects={projects}
            onOpenNewOrderModal={() => setIsNewOrderOpen(true)}
            onSelectOrderForPrint={(o) => setOrderForPrint(o)}
            onUpdateOrderStatus={handleUpdateOrderStatus}
          />
        )}

        {activeTab === 'invoices' && (
          <VendorInvoicesView
            invoices={invoices}
            projects={projects}
            onApproveInvoice={handleApproveInvoice}
            onRecordPayment={handleRecordPayment}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersDirectoryView
            suppliers={suppliers}
            onOpenNewSupplierModal={() => setIsNewSupplierOpen(true)}
          />
        )}
      </div>

      {/* Modals */}
      {isNewRequisitionOpen && (
        <NewRequisitionModal
          isOpen={isNewRequisitionOpen}
          onClose={() => setIsNewRequisitionOpen(false)}
          projects={projects}
          onAddRequisition={(newReq) => {
            if (!can('requisition.create', { projectId: newReq.projectId })) return onToast('اجازه ثبت درخواست خرید را ندارید.');
            setRequisitions((prev) => [newReq, ...prev]);
            setIsNewRequisitionOpen(false);
          }}
        />
      )}

      {isNewOrderOpen && (
        <NewPurchaseOrderModal
          isOpen={isNewOrderOpen}
          onClose={() => setIsNewOrderOpen(false)}
          projects={projects}
          suppliers={suppliers}
          onAddOrder={(newOrder) => {
            if (!can('purchase_order.create', { projectId: newOrder.projectId }))
              return { ok: false, message: 'اجازه صدور سفارش خرید را ندارید.' };
            setOrders((prev) => [newOrder, ...prev]);
            setIsNewOrderOpen(false);
            return { ok: true, message: `سفارش ${newOrder.poNumber} صادر شد.` };
          }}
        />
      )}

      {isNewSupplierOpen && (
        <NewSupplierModal
          isOpen={isNewSupplierOpen}
          onClose={() => setIsNewSupplierOpen(false)}
          onAddSupplier={(newSup) => {
            if (!can('supplier.manage')) return onToast('اجازه تعریف تأمین‌کننده را ندارید.');
            setSuppliers((prev) => [newSup, ...prev]);
            setIsNewSupplierOpen(false);
          }}
        />
      )}

      {orderForPrint && (
        <PurchaseOrderPrintModal
          order={orderForPrint}
          isOpen={Boolean(orderForPrint)}
          onClose={() => setOrderForPrint(null)}
        />
      )}
    </div>
  );
};
