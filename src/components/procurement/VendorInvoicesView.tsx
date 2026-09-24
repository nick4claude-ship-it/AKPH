import React, { useState } from 'react';
import {
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Search,
  Check,
  Building,
  DollarSign,
  ArrowRight,
  Eye,
  FileSpreadsheet,
  X,
  ShieldCheck,
  Calculator,
} from 'lucide-react';
import { VendorInvoice, Project } from '../../types';
import { Dialog } from '../common/Dialog';
import { formatMoney } from '../../utils/money';
import { formatPercent } from '../../utils/formatters';

interface VendorInvoicesViewProps {
  invoices: VendorInvoice[];
  projects: Project[];
  onApproveInvoice: (invoiceId: string) => void;
  onRecordPayment: (invoiceId: string, amount: number) => void;
}

export const VendorInvoicesView: React.FC<VendorInvoicesViewProps> = ({
  invoices,
  projects,
  onApproveInvoice,
  onRecordPayment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeInvoiceForDetail, setActiveInvoiceForDetail] = useState<VendorInvoice | null>(null);

  const filteredInvoices = invoices.filter((inv) => {
    if (selectedStatus !== 'all' && inv.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchInv = inv.invoiceNumber.toLowerCase().includes(q);
      const matchPo = inv.poNumber.toLowerCase().includes(q);
      const matchSup = inv.supplierName.toLowerCase().includes(q);
      const matchPrj = inv.projectName.toLowerCase().includes(q);
      return matchInv || matchPo || matchSup || matchPrj;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                فاکتورهای خرید و سیستم تطبیق سه‌جانبه (3-Way Matching)
              </h3>
              <p className="text-xs text-slate-500">
                تطبیق مکانیزه ۳ سند کلیدی: سفارش خرید (PO) + قبض انبار و باسکول (GRN) + فاکتور رسمی فروشنده
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در شماره فاکتور، تأمین‌کننده، سفارش PO..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
            >
              <option value="all">تمام وضعیت‌های تطبیق و پرداخت</option>
              <option value="در حال تطبیق">در حال تطبیق</option>
              <option value="تأیید تطبیق سه‌جانبه">تأیید تطبیق سه‌جانبه (آماده تسویه)</option>
              <option value="پرداخت شده">پرداخت شده و مختومه</option>
              <option value="دارای مغایرت و متوقف">دارای مغایرت و متوقف</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">شماره فاکتور و تاریخ</th>
                <th className="py-3 px-4">تأمین‌کننده و پروژه</th>
                <th className="py-3 px-4">اسناد مرجع (PO و GRN)</th>
                <th className="py-3 px-4 text-center">وضعیت تطبیق ۳‌جانبه</th>
                <th className="py-3 px-4 text-left">مبلغ کل فاکتور</th>
                <th className="py-3 px-4 text-left">مانده قابل پرداخت</th>
                <th className="py-3 px-4 text-center">وضعیت سند حسابداری</th>
                <th className="py-3 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      سررسید: <span className="font-mono font-bold text-slate-700">{inv.dueDate}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-800">{inv.supplierName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{inv.projectName}</div>
                  </td>

                  <td className="py-3.5 px-4 text-slate-600">
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <span className="text-slate-400">PO:</span>
                      <span className="font-bold text-indigo-700">{inv.poNumber}</span>
                    </div>
                    {inv.grnNumber ? (
                      <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-700">
                        <span className="text-slate-400">GRN:</span>
                        <span className="font-bold">{inv.grnNumber}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-rose-500 font-bold">بدون رسید انبار</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex flex-col items-center gap-1">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.threeWayMatching.status === 'تطبیق کامل و بدون مغایرت' || inv.threeWayMatching.status === 'تأیید نهایی مالی'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.threeWayMatching.status === 'مغایرت مقداری' || inv.threeWayMatching.status === 'مغایرت قیمتی'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {inv.threeWayMatching.status}
                      </span>
                      {inv.threeWayMatching.qtyVarianceAmount > 0 && (
                        <span className="text-[9px] text-rose-600 font-bold">
                          کسر {formatMoney(inv.threeWayMatching.qtyVarianceAmount)} مغایرت
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-left font-mono font-bold text-slate-900">
                    {formatMoney(inv.totalAmount)}
                  </td>

                  <td className="py-3.5 px-4 text-left font-mono font-bold">
                    <span className={inv.remainingBalance > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                      {formatMoney(inv.remainingBalance)}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    {inv.accountingEntryNumber ? (
                      <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-bold">
                        {inv.accountingEntryNumber}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-bold">در صف صدور سند</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => setActiveInvoiceForDetail(inv)}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      بررسی تطبیق
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3-Way Matching Interactive Inspection Modal */}
      {activeInvoiceForDetail && (
        <Dialog onClose={() => setActiveInvoiceForDetail(null)} label="پانل تطبیق سه‌جانبه فاکتور" overlayClassName="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    پانل تطبیق سه‌جانبه فاکتور {activeInvoiceForDetail.invoiceNumber}
                  </h3>
                  <p className="text-xs text-slate-500">{activeInvoiceForDetail.supplierName} - {activeInvoiceForDetail.projectName}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveInvoiceForDetail(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
              {/* The Three Pillars Diagram */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. PO Pillar */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700 font-bold border-b border-slate-200 pb-1.5">
                    <span>۱. سفارش خرید (PO)</span>
                    <span className="font-mono text-[11px] text-indigo-700">{activeInvoiceForDetail.poNumber}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">قیمت و شرایط تأیید شده توسط دفتر مرکزی</div>
                  <div className="flex items-center gap-1 text-emerald-700 font-bold text-[11px] pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>سفارش معتبر سیستمی</span>
                  </div>
                </div>

                {/* 2. GRN Pillar */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700 font-bold border-b border-slate-200 pb-1.5">
                    <span>۲. رسید انبار (GRN)</span>
                    <span className="font-mono text-[11px] text-emerald-700">
                      {activeInvoiceForDetail.grnNumber || 'فاقد قبض'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">قبض باسکول و تست آزمایشگاه QC کارگاه</div>
                  <div className="flex items-center gap-1 font-bold text-[11px] pt-1">
                    {activeInvoiceForDetail.threeWayMatching.grnMatched ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>وزن باسکول مطابقت دارد</span>
                      </span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>مغایرت مقدار تحویلی پای کار</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Vendor Invoice Pillar */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700 font-bold border-b border-slate-200 pb-1.5">
                    <span>۳. صورتحساب فروشنده</span>
                    <span className="font-mono text-[11px] text-slate-900">{activeInvoiceForDetail.invoiceNumber}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">شناسه مودیان: {activeInvoiceForDetail.taxRegistrationNumber}</div>
                  <div className="flex items-center gap-1 text-indigo-700 font-bold text-[11px] pt-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>گواهی ارزش افزوده فعال</span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span>بهای خالص کالا:</span>
                  <span className="font-mono font-bold text-slate-900">{formatMoney(activeInvoiceForDetail.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>مالیات بر ارزش افزوده ({formatPercent(activeInvoiceForDetail.subtotal ? (activeInvoiceForDetail.vatAmount * 100) / activeInvoiceForDetail.subtotal : 0)}):</span>
                  <span className="font-mono font-bold text-slate-900">{formatMoney(activeInvoiceForDetail.vatAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>هزینه حمل و تخلیه:</span>
                  <span className="font-mono font-bold text-slate-900">{formatMoney(activeInvoiceForDetail.shippingCost)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between items-center font-black text-slate-900 text-sm">
                  <span>مجموع ناخالص فاکتور:</span>
                  <span className="font-mono text-indigo-700 text-base">
                    {formatMoney(activeInvoiceForDetail.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-emerald-700 font-bold pt-1">
                  <span>مبلغ پرداخت‌شده قبلی (پیش‌پرداخت/حواله):</span>
                  <span className="font-mono">{formatMoney(activeInvoiceForDetail.paidAmount)}</span>
                </div>
                <div className="border-t-2 border-slate-300 pt-2 flex justify-between items-center font-black text-rose-700 text-sm">
                  <span>مانده قابل تسویه / صدور چک صیادی:</span>
                  <span className="font-mono">{formatMoney(activeInvoiceForDetail.remainingBalance)}</span>
                </div>
              </div>

              {/* Notes & Variance Analysis */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-1.5">
                <span className="font-bold text-slate-800 block text-xs">گزارش سیستم تطبیق و مغایرت:</span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  {activeInvoiceForDetail.threeWayMatching.notes}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-between items-center">
              {activeInvoiceForDetail.remainingBalance > 0 && (
                <button
                  onClick={() => {
                    onApproveInvoice(activeInvoiceForDetail.id);
                    onRecordPayment(activeInvoiceForDetail.id, activeInvoiceForDetail.remainingBalance);
                    setActiveInvoiceForDetail(null);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>تأیید تطبیق و صدور چک تسویه</span>
                </button>
              )}
              <button
                onClick={() => setActiveInvoiceForDetail(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer mr-auto"
              >
                بستن
              </button>
            </div>
          </Dialog>
      )}
    </div>
  );
};
