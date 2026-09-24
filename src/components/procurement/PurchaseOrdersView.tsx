import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Printer,
  Truck,
  CheckCircle2,
  Clock,
  Building,
  Warehouse,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { PurchaseOrder, Project, POStatus } from '../../types';

interface PurchaseOrdersViewProps {
  orders: PurchaseOrder[];
  projects: Project[];
  onOpenNewOrderModal: () => void;
  onSelectOrderForPrint: (order: PurchaseOrder) => void;
  onUpdateOrderStatus: (orderId: string, status: POStatus) => void;
  onNavigateToInventory?: () => void;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({
  orders,
  projects,
  onOpenNewOrderModal,
  onSelectOrderForPrint,
  onUpdateOrderStatus,
  onNavigateToInventory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const filteredOrders = orders.filter((o) => {
    if (selectedProjectId !== 'all' && o.projectId !== selectedProjectId) return false;
    if (selectedStatus !== 'all' && o.status !== selectedStatus) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPo = o.poNumber.toLowerCase().includes(q);
      const matchSupplier = o.supplierName.toLowerCase().includes(q);
      const matchProject = o.projectName.toLowerCase().includes(q);
      const matchItem = o.items.some((it) => it.materialName.toLowerCase().includes(q));
      return matchPo || matchSupplier || matchProject || matchItem;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">سفارشات رسمی خرید و قراردادهای تأمین (PO)</h3>
              <p className="text-xs text-slate-500">
                {filteredOrders.length} سفارش رسمی صادرشده با قابلیت رهگیری تحویل بار، باسکول پای کار و چاپ سربرگ‌دار
              </p>
            </div>
          </div>

          <button
            onClick={onOpenNewOrderModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>صدور سفارش خرید جدید</span>
          </button>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در شماره PO، تأمین‌کننده، کالا..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
            />
          </div>

          <div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
            >
              <option value="all">تمام پروژه‌ها</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
            >
              <option value="all">تمام وضعیت‌های تحویل و اجرا</option>
              <option value="صادر شده و ابلاغ به فروشنده">صادر شده و ابلاغ به فروشنده</option>
              <option value="در حال ساخت/بارگیری">در حال ساخت/بارگیری</option>
              <option value="در مسیر حمل به کارگاه">در مسیر حمل به کارگاه</option>
              <option value="تحویل جزئی در انبار">تحویل جزئی در انبار</option>
              <option value="تحویل کامل">تحویل کامل</option>
              <option value="تسویه حساب نهایی و مختومه">تسویه حساب نهایی و مختومه</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">شماره سفارش (PO)</th>
                <th className="py-3 px-4">تأمین‌کننده طرف حساب</th>
                <th className="py-3 px-4">پروژه و انبار مقصد</th>
                <th className="py-3 px-4">اقلام کلیدی</th>
                <th className="py-3 px-4 text-center">پیشرفت تحویل بار</th>
                <th className="py-3 px-4 text-left">مبلغ کل سفارش</th>
                <th className="py-3 px-4 text-center">وضعیت</th>
                <th className="py-3 px-4 text-center">عملیات و چاپ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-mono font-black text-slate-900">{order.poNumber}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{order.issueDate}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-800">{order.supplierName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{order.paymentTerms}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{order.projectName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[200px]">{order.destinationWarehouse}</div>
                  </td>

                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="font-bold text-slate-800 truncate">{order.items[0]?.materialName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {order.items[0]?.orderedQty.toLocaleString('fa-IR')} {order.items[0]?.unit}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-center min-w-[140px]">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">تحویل:</span>
                        <span className="font-mono font-bold text-slate-800">{order.deliveryProgressPercentage}٪</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
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
                  </td>

                  <td className="py-3.5 px-4 text-left font-mono font-black text-slate-900">
                    {order.totalOrderAmount.toLocaleString('fa-IR')} تومان
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        order.status === 'تحویل کامل'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.status === 'تحویل جزئی در انبار'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'در مسیر حمل به کارگاه'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onSelectOrderForPrint(order)}
                        title="پیش‌نمایش و چاپ فرم اداری PO"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>چاپ فرم</span>
                      </button>

                      {order.linkedGrnNumbers && order.linkedGrnNumbers.length > 0 ? (
                        <span
                          title={`رسید انبار: ${order.linkedGrnNumbers.join(', ')}`}
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-mono font-bold"
                        >
                          GRN ثبت شد
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            if (onNavigateToInventory) onNavigateToInventory();
                          }}
                          title="ثبت ورود مصالح و قبض انبار بر اساس این سفارش"
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                        >
                          رسید انبار
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
