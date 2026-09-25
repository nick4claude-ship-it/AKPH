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
import { PurchaseOrder, PurchaseRequisition, RequestForQuotation, Project, UserProfile, ProcurementSubTab, POStatus } from '../../types';
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
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import type { WorkflowResult } from '../../store/workflowKit';
import { formatInt } from '../../utils/formatters';

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
  const { suppliers, purchaseRequisitions: requisitions, rfqs, purchaseOrders: orders, vendorInvoices: invoices } = useAppState();
  const [activeTab, setActiveTab] = useState<ProcurementSubTab>('dashboard');

  // Modals state
  const [isNewRequisitionOpen, setIsNewRequisitionOpen] = useState(false);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [orderForPrint, setOrderForPrint] = useState<PurchaseOrder | null>(null);

  /** Shows the workflow's message; switches tab when it succeeded. */
  const run = (result: WorkflowResult, tabOnSuccess?: ProcurementSubTab) => {
    onToast(result.message);
    if (result.ok && tabOnSuccess) setActiveTab(tabOnSuccess);
    return result;
  };

  // Approval chain (site → project → procurement → finance/CEO) is enforced by the workflow service.
  const handleApproveRequisition = (reqId: string, _level: 'site' | 'project' | 'procurement' | 'finance') => run(wf.approveRequisition(reqId));
  const handleConvertToRfq = (req: PurchaseRequisition) => run(wf.createRfqFromRequisition(req.id), 'rfq');
  const handleConvertToPo = (_req: PurchaseRequisition) => setIsNewOrderOpen(true);
  const handleSelectWinningBid = (rfqId: string, quoteId: string) => run(wf.selectWinningBid(rfqId, quoteId));
  const handleGeneratePoFromRfq = (rfq: RequestForQuotation) => run(wf.createPurchaseOrderFromRfq(rfq.id), 'purchase_orders');
  const handleUpdateOrderStatus = (orderId: string, status: POStatus) => run(wf.updatePurchaseOrderStatus(orderId, status));

  // Invoice approval posts Dr GRNI + VAT / Cr supplier payable and queues a treasury payment request.
  // Project cost is not touched here: stocked materials reach the project only when issued.
  const handleApproveInvoice = (invoiceId: string) => run(wf.approveVendorInvoice(invoiceId));

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
                  {formatInt(tab.count)}
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
          onAddRequisition={(form) => run(wf.createRequisition(form))}
        />
      )}

      {isNewOrderOpen && (
        <NewPurchaseOrderModal
          isOpen={isNewOrderOpen}
          onClose={() => setIsNewOrderOpen(false)}
          projects={projects}
          suppliers={suppliers}
          onAddOrder={(form) => run(wf.createPurchaseOrder(form))}
        />
      )}

      {isNewSupplierOpen && (
        <NewSupplierModal
          isOpen={isNewSupplierOpen}
          onClose={() => setIsNewSupplierOpen(false)}
          onAddSupplier={(input) => run(wf.createSupplier(input))}
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
