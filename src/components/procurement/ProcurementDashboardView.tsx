import React, { useMemo } from 'react';
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  Building2,
  FileSpreadsheet,
  Award,
  Layers,
  ArrowUpRight,
  Printer,
  ChevronRight,
  ShieldCheck,
  Truck,
  Eye,
} from 'lucide-react';
import {
  PurchaseOrder,
  PurchaseRequisition,
  RequestForQuotation,
  VendorInvoice,
  Supplier,
  Project,
  ProcurementSubTab,
} from '../../types';
import { formatInt, formatMoney, formatMoneyCompact } from '../../utils/money';
import { barWidth, formatDecimal, formatPercent, formatText } from '../../utils/formatters';
import { selectProcurementDashboard } from '../../store/views/procurement';
import { Money } from '../common/Money';

interface ProcurementDashboardViewProps {
  orders: PurchaseOrder[];
  requisitions: PurchaseRequisition[];
  rfqs: RequestForQuotation[];
  invoices: VendorInvoice[];
  suppliers: Supplier[];
  projects: Project[];
  onNavigateToTab: (tab: ProcurementSubTab) => void;
  onSelectOrderForPrint: (order: PurchaseOrder) => void;
  onOpenNewRequisition: () => void;
  onOpenNewOrder: () => void;
}

export const ProcurementDashboardView: React.FC<ProcurementDashboardViewProps> = ({
  orders,
  requisitions,
  rfqs,
  invoices,
  suppliers,
  projects,
  onNavigateToTab,
  onSelectOrderForPrint,
  onOpenNewRequisition,
  onOpenNewOrder,
}) => {
  const dash = useMemo(
    () => selectProcurementDashboard(orders, requisitions, rfqs, invoices, suppliers),
    [orders, requisitions, rfqs, invoices, suppliers]
  );
  const { totalOrdersAmount, activeOrdersCount, urgentRequisitions, urgentProjects, pendingApprovalsCount, activeRfqsCount, totalSavings, pendingInvoices, totalAccountsPayable } = dash;

  return (
    <div className="space-y-6">
      {/* KPI Cards Row (6 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Active PO Volume */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-bold">کل سفارشات فعال</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              <Money rial={totalOrdersAmount} compact />
            </span>
                      </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>تعداد سفارشات در جریان:</span>
            <span className="font-bold text-indigo-700 tabular-nums">{formatInt(activeOrdersCount)} سفارش</span>
          </div>
        </div>

        {/* Card 2: Open Requisitions (PR) */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-bold">تقاضاهای باز کارگاه</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              {formatDecimal(requisitions.length)}
            </span>
            <span className="text-xs text-slate-500">درخواست خرید</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">در انتظار تاییدیه:</span>
            <span className="font-bold text-amber-700 tabular-nums">{formatInt(pendingApprovalsCount)} فقره</span>
          </div>
        </div>

        {/* Card 3: Urgent PRs */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-bold">اقلام حیاتی کارگاه</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-rose-700">
              {formatDecimal(urgentRequisitions.length)}
            </span>
            <span className="text-sm text-rose-700 font-medium">نیاز فوری توقف‌زا</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">پروژه‌های درگیر:</span>
            <span className="font-bold text-rose-700">{urgentProjects}</span>
          </div>
        </div>

        {/* Card 4: Active RFQ & Savings */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-bold">استعلام‌های در جریان</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              {formatDecimal(activeRfqsCount)}
            </span>
            <span className="text-xs text-slate-500">استعلام بها</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">صرفه‌جویی کمیسیون:</span>
            <span className="font-bold text-emerald-700 tabular-nums"><Money rial={totalSavings} compact /></span>
          </div>
        </div>

        {/* Card 5: Invoices & Accounts Payable */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-bold">مانده بدهی به تأمین‌کننده</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              <Money rial={totalAccountsPayable} compact />
            </span>
                      </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">فاکتورهای در تطبیق:</span>
            <span className="font-bold text-blue-700 tabular-nums">{formatInt(pendingInvoices.length)} فاکتور</span>
          </div>
        </div>

        {/* Card 6: Approved Vendors (AVL) */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-bold">وندورلیست رسمی</span>
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              {formatDecimal(suppliers.length)}
            </span>
            <span className="text-xs text-slate-500">شرکت تأییدشده</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">میانگین امتیاز کیفی:</span>
            <span className="font-bold text-teal-700 tabular-nums">۴.۵ از ۵ ⭐</span>
          </div>
        </div>
      </div>

      {/* Main Operational Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Urgent Requests Pipeline & Recent POs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Urgent Requisition Pipeline Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-700 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">صف تقاضاهای فوری و در آستانه توقف کارگاه</h3>
                  <p className="text-xs text-slate-500">درخواست‌های ارسالی سرپرستان پروژه‌ها نیازمند استعلام و خرید فوری</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateToTab('requisitions')}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>مشاهده تمام تقاضاها</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {requisitions.slice(0, 3).map((req) => (
                <div
                  key={req.id}
                  className="border border-slate-200 hover:border-indigo-300 rounded-xl p-3 transition-all bg-slate-50/50 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs tabular-nums font-bold">
                        {formatText(req.requisitionNumber)}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{formatText(req.projectName)}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-bold ${
                          req.priority === 'فوری کارگاهی (حیاتی)'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {formatText(req.priority)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">{formatText(req.date)}</span>
                  </div>

                  <div className="text-sm text-slate-700 space-y-1 mb-3">
                    {req.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-slate-600">
                        <span>• {formatText(it.materialName)} ({formatDecimal(it.requestedQty)} {formatText(it.unit)})</span>
                        <span className="tabular-nums text-slate-800 font-bold">
                          <Money rial={it.estimatedTotalPrice} />
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-sm">
                    <span className="text-slate-500">
                      ثبت توسط: <span className="font-bold text-slate-700">{formatText(req.requesterName)}</span> ({req.requesterRole})
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">
                        وضعیت: {formatText(req.status)}
                      </span>
                      <button
                        onClick={() => onNavigateToTab('rfq')}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
                      >
                        برگزاری استعلام بها
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Purchase Orders & Delivery Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">سفارشات قطعی خرید و وضعیت تحویل پای کارگاه</h3>
                  <p className="text-xs text-slate-500">رهگیری درصد بارگیری و تحویل در انبارهای پروژه‌ها</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateToTab('purchase_orders')}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>مشاهده تمام سفارشات</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {orders.slice(0, 4).map((order) => (
                <div key={order.id} className="border border-slate-200 rounded-xl p-3 hover:shadow-xs transition-all">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-bold text-slate-900 text-sm">{formatText(order.poNumber)}</span>
                      <span className="text-slate-500">|</span>
                      <span className="font-bold text-slate-800 text-sm">{formatText(order.supplierName)}</span>
                      <span className="text-xs text-slate-500">({order.projectName})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-bold ${
                          order.status === 'تحویل کامل'
                            ? 'bg-emerald-100 text-emerald-800'
                            : order.status === 'تحویل جزئی در انبار'
                            ? 'bg-blue-100 text-blue-800'
                            : order.status === 'در مسیر حمل به کارگاه'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatText(order.status)}
                      </span>
                      <button
                        onClick={() => onSelectOrderForPrint(order)}
                        title="پیش‌نمایش و چاپ فرم اداری"
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Delivery Progress Bar */}
                  <div className="space-y-1 mb-2">
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>پیشرفت تحویل فیزیکی:</span>
                      <span className="tabular-nums font-bold text-slate-800">{formatText(order.deliveryProgressPercentage)}٪</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          order.deliveryProgressPercentage === 100
                            ? 'bg-emerald-500'
                            : order.deliveryProgressPercentage > 0
                            ? 'bg-blue-500'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${order.deliveryProgressPercentage}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>محل تخلیه: {formatText(order.destinationWarehouse)}</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      <Money rial={order.totalOrderAmount} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Category Spend Breakdown & Top Vendors */}
        <div className="space-y-6">
          {/* Category Spend Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>توزیع خریدهای دوره بر اساس رسته</span>
              </h3>
            </div>

            <div className="space-y-3">
              {dash.categorySpend.map(({ category: catName, amount, percent: pct }) => {
                return (
                  <div key={catName} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-700 font-medium">{catName}</span>
                      <span className="tabular-nums text-slate-900 font-bold">{formatPercent(pct, 0)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full"
                        style={{ width: barWidth(pct) }}
                      ></div>
                    </div>
                    <div className="text-xs text-left text-slate-500 tabular-nums">
                      <Money rial={amount} compact />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Approved Vendors Snapshot */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>تأمین‌کنندگان برتر وندورلیست</span>
              </h3>
              <button
                onClick={() => onNavigateToTab('suppliers')}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                مشاهده همه
              </button>
            </div>

            <div className="space-y-3">
              {suppliers.slice(0, 4).map((sup) => (
                <div key={sup.id} className="p-3 border border-slate-100 bg-slate-50/70 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{formatText(sup.name)}</span>
                    <span className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800">
                      گرید {formatText(sup.grade)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{formatText(sup.category)}</div>
                  <div className="flex items-center justify-between text-sm pt-1 text-slate-600 border-t border-slate-200/60">
                    <span>تحویل به‌موقع: {formatPercent(sup.performance.onTimeDeliveryRate, 0)}</span>
                    <span>امتیاز: {formatDecimal(sup.performance.overallRating, 1)} از ۵</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
