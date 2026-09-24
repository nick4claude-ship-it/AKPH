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
import {
  mockSuppliers,
  mockRequisitions,
  mockRfqs,
  mockPurchaseOrders,
  mockVendorInvoices,
} from '../../data/procurementMockData';

interface ProcurementModuleProps {
  projects: Project[];
  currentUser: UserProfile;
  onAddJournalEntry?: (entry: any) => void;
  onAddPaymentRequest?: (request: any) => void;
}

export const ProcurementModule: React.FC<ProcurementModuleProps> = ({
  projects,
  currentUser,
  onAddJournalEntry,
  onAddPaymentRequest,
}) => {
  const [activeTab, setActiveTab] = useState<ProcurementSubTab>('dashboard');

  // Procurement Core State
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers);
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>(mockRequisitions);
  const [rfqs, setRfqs] = useState<RequestForQuotation[]>(mockRfqs);
  const [orders, setOrders] = useState<PurchaseOrder[]>(mockPurchaseOrders);
  const [invoices, setInvoices] = useState<VendorInvoice[]>(mockVendorInvoices);

  // Modals state
  const [isNewRequisitionOpen, setIsNewRequisitionOpen] = useState(false);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [orderForPrint, setOrderForPrint] = useState<PurchaseOrder | null>(null);

  // Handlers
  const handleApproveRequisition = (
    reqId: string,
    level: 'site' | 'project' | 'procurement' | 'finance'
  ) => {
    setRequisitions((prev) =>
      prev.map((r) => {
        if (r.id !== reqId) return r;
        const newApprovals = { ...r.approvals };
        if (level === 'site') {
          newApprovals.siteSupervisor = {
            approved: true,
            date: '۱۴۰۳/۰۷/۰۱',
            signedBy: currentUser.name,
          };
        } else if (level === 'project') {
          newApprovals.projectManager = {
            approved: true,
            date: '۱۴۰۳/۰۷/۰۲',
            signedBy: currentUser.name,
          };
        } else if (level === 'procurement') {
          newApprovals.procurementManager = {
            approved: true,
            date: '۱۴۰۳/۰۷/۰۳',
            signedBy: currentUser.name,
          };
        } else if (level === 'finance') {
          newApprovals.financialDirector = {
            approved: true,
            date: '۱۴۰۳/۰۷/۰۴',
            signedBy: currentUser.name,
          };
        }
        return {
          ...r,
          approvals: newApprovals,
          status: level === 'finance' ? 'تأیید نهایی مالی/مدیرعامل' : r.status,
        };
      })
    );
  };

  const handleConvertToRfq = (req: PurchaseRequisition) => {
    const newRfq: RequestForQuotation = {
      id: `rfq-${Date.now()}`,
      rfqNumber: `RFQ-1403-${rfqs.length + 101}`,
      title: `استعلام بهای اقلام درخواست ${req.requisitionNumber}`,
      dateCreated: '۱۴۰۳/۰۷/۰۲',
      submissionDeadline: '۱۴۰۳/۰۷/۱۰',
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

    const newPo: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: `PO-1403-${orders.length + 101}`,
      issueDate: '۱۴۰۳/۰۷/۰۳',
      deliveryDueDate: '۱۴۰۳/۰۷/۱۵',
      requisitionId: rfq.requisitionId,
      rfqId: rfq.id,
      projectId: rfq.projectId,
      projectName: rfq.projectName,
      destinationWarehouse: 'انبار کارگاه پروژه',
      supplierId: winning.supplierId,
      supplierName: winning.supplierName,
      supplierPhone: '۰۲۱-۸۸۰۰۹۹۰۰',
      supplierAddress: 'تهران، خیابان آزادی',
      items: [
        {
          id: `item-${Date.now()}`,
          materialCode: 'MAT-GEN-01',
          materialName: rfq.materialName,
          specifications: rfq.specification,
          orderedQty: rfq.requiredQty,
          receivedQty: 0,
          unit: rfq.unit,
          unitPrice: winning.unitPrice,
          totalNetPrice: winning.unitPrice * rfq.requiredQty,
          vatRate: winning.vatIncluded ? 10 : 0,
          vatAmount: winning.vatAmount,
          freightAndUnloadingCost: winning.freightCostPerUnit * rfq.requiredQty,
          totalGrossAmount: winning.totalQuoteAmount,
        },
      ],
      subtotalAmount: winning.unitPrice * rfq.requiredQty,
      totalVatAmount: winning.vatAmount,
      totalFreightCost: winning.freightCostPerUnit * rfq.requiredQty,
      totalOrderAmount: winning.totalQuoteAmount,
      paymentTerms: winning.paymentTerms,
      advancePaymentAmount: Math.round(winning.totalQuoteAmount * 0.2),
      advancePaymentPaid: false,
      status: 'صادر شده و ابلاغ به فروشنده',
      deliveryProgressPercentage: 0,
      termsAndConditions: ['تحویل با بارنامه رسمی', 'ارائه سرتیفیکیت متالورژی'],
      issuedBy: currentUser.name,
      approvedBy: 'مهندس محمدرضا رادمنش (مدیرعامل)',
    };

    setOrders((prev) => [newPo, ...prev]);
    setActiveTab('purchase_orders');
  };

  const handleUpdateOrderStatus = (orderId: string, status: POStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
  };

  const handleApproveInvoice = (invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              status: 'تأیید تطبیق سه‌جانبه',
              threeWayMatching: {
                ...inv.threeWayMatching,
                status: 'تأیید نهایی مالی',
              },
            }
          : inv
      )
    );

    const targetInvoice = invoices.find((inv) => inv.id === invoiceId);
    if (targetInvoice && onAddPaymentRequest) {
      onAddPaymentRequest({
        sourceType: 'فاکتور خرید تأمین‌کننده',
        sourceRefId: targetInvoice.id,
        sourceRefNumber: targetInvoice.invoiceNumber,
        projectId: targetInvoice.projectId,
        projectName: targetInvoice.projectName,
        beneficiaryName: targetInvoice.supplierName,
        totalAmount: targetInvoice.totalAmount,
      });
    }
  };

  const handleRecordPayment = (invoiceId: string, amount: number) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        const newPaid = inv.paidAmount + amount;
        const newRemaining = Math.max(0, inv.totalAmount - newPaid);
        return {
          ...inv,
          paidAmount: newPaid,
          remainingBalance: newRemaining,
          status: newRemaining === 0 ? 'پرداخت شده' : 'پرداخت ناقص',
        };
      })
    );
  };

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
            setOrders((prev) => [newOrder, ...prev]);
            setIsNewOrderOpen(false);
          }}
        />
      )}

      {isNewSupplierOpen && (
        <NewSupplierModal
          isOpen={isNewSupplierOpen}
          onClose={() => setIsNewSupplierOpen(false)}
          onAddSupplier={(newSup) => {
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
