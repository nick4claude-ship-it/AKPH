import React from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, Building, Truck, FileText } from 'lucide-react';
import { PurchaseOrder } from '../../types';

interface PurchaseOrderPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
}

export const PurchaseOrderPrintModal: React.FC<PurchaseOrderPrintModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header - Not Printed */}
        <div className="no-print flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">پیش‌نمایش و چاپ برگ سفارش رسمی خرید (PO)</h3>
              <p className="text-xs text-slate-500 font-mono">{order.poNumber} - شرکت بین‌المللی سازه گستران پارس</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فرم اداری</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Document Body */}
        <div className="p-8 overflow-y-auto flex-1 font-sans text-slate-800 printable-order-page bg-white">
          {/* Header Band */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-sm">
                  SGP
                </div>
                <div>
                  <h1 className="text-lg font-black text-slate-900">شرکت مهندسی و ساختمانی سازه گستران پارس</h1>
                  <p className="text-xs text-slate-500 font-medium">معاونت اجرایی و مدیریت تدارکات و تأمین کالا (EPC)</p>
                </div>
              </div>
              <div className="text-left space-y-1">
                <div className="inline-block bg-slate-900 text-amber-400 px-3 py-1 rounded text-sm font-black font-mono">
                  برگ سفارش قطعی خرید (PO)
                </div>
                <div className="text-xs text-slate-600">
                  <span className="text-slate-400 ml-1">شماره سند:</span>
                  <span className="font-bold font-mono text-slate-900">{order.poNumber}</span>
                </div>
                <div className="text-xs text-slate-600">
                  <span className="text-slate-400 ml-1">تاریخ صدور:</span>
                  <span className="font-bold text-slate-900">{order.issueDate}</span>
                </div>
                <div className="text-xs text-slate-600">
                  <span className="text-slate-400 ml-1">مهلت تحویل:</span>
                  <span className="font-bold text-rose-600">{order.deliveryDueDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Parties Meta Information Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
            {/* Buyer Side */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 border-b border-slate-200 pb-1.5 mb-1.5">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>مشخصات خریدار / کارفرما</span>
              </div>
              <div><span className="text-slate-400">نام شرکت:</span> <span className="font-bold">سازه گستران پارس (سهامی خاص)</span></div>
              <div><span className="text-slate-400">شناسه ملی:</span> <span className="font-mono">10103892015</span></div>
              <div><span className="text-slate-400">پروژه مقصد:</span> <span className="font-bold text-indigo-700">{order.projectName}</span></div>
              <div><span className="text-slate-400">محل دقیق تخلیه:</span> <span>{order.destinationWarehouse}</span></div>
            </div>

            {/* Supplier Side */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 border-b border-slate-200 pb-1.5 mb-1.5">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>مشخصات فروشنده / تأمین‌کننده</span>
              </div>
              <div><span className="text-slate-400">نام طرف حساب:</span> <span className="font-bold text-slate-900">{order.supplierName}</span></div>
              <div><span className="text-slate-400">تلفن و تماس:</span> <span className="font-mono">{order.supplierPhone}</span></div>
              <div><span className="text-slate-400">آدرس / کارخانه:</span> <span>{order.supplierAddress}</span></div>
              <div><span className="text-slate-400">شرایط تسویه:</span> <span className="font-bold text-slate-800">{order.paymentTerms}</span></div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>مشخصات فنی و فهرست اقلام سفارش داده شده</span>
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">ردیف</th>
                    <th className="py-2.5 px-3">کد کالا</th>
                    <th className="py-2.5 px-3">شرح کالا و مشخصات فنی</th>
                    <th className="py-2.5 px-3 text-center">مقدار سفارش</th>
                    <th className="py-2.5 px-3 text-center">واحد</th>
                    <th className="py-2.5 px-3 text-left">مبلغ واحد (تومان)</th>
                    <th className="py-2.5 px-3 text-left">مبلغ خالص (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {order.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-600 text-[11px]">{item.materialCode}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.materialName}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.specifications}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold font-mono text-slate-800">
                        {item.orderedQty.toLocaleString('fa-IR')}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500">{item.unit}</td>
                      <td className="py-3 px-3 text-left font-mono font-medium text-slate-700">
                        {item.unitPrice.toLocaleString('fa-IR')}
                      </td>
                      <td className="py-3 px-3 text-left font-mono font-bold text-slate-900">
                        {item.totalNetPrice.toLocaleString('fa-IR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end mb-6">
            <div className="w-80 border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/50 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>جمع بهای خالص کالا:</span>
                <span className="font-mono font-bold text-slate-800">{order.subtotalAmount.toLocaleString('fa-IR')} تومان</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>مالیات بر ارزش افزوده (۱۰٪):</span>
                <span className="font-mono font-bold text-slate-800">{order.totalVatAmount.toLocaleString('fa-IR')} تومان</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>کرایه حمل و تخلیه پای کار:</span>
                <span className="font-mono font-bold text-slate-800">{order.totalFreightCost.toLocaleString('fa-IR')} تومان</span>
              </div>
              <div className="border-t-2 border-slate-300 pt-2 flex justify-between items-center font-black text-slate-900 text-sm">
                <span>مبلغ کل سفارش (ناخالص):</span>
                <span className="font-mono text-indigo-700">{order.totalOrderAmount.toLocaleString('fa-IR')} تومان</span>
              </div>
              {order.advancePaymentAmount > 0 && (
                <div className="border-t border-dashed border-slate-200 pt-1.5 flex justify-between items-center text-emerald-700 font-bold text-[11px]">
                  <span>پیش‌پرداخت تعهد شده:</span>
                  <span className="font-mono">{order.advancePaymentAmount.toLocaleString('fa-IR')} تومان ({order.advancePaymentPaid ? 'واریز شده' : 'در نوبت پرداخت'})</span>
                </div>
              )}
            </div>
          </div>

          {/* Legal Terms & Conditions */}
          <div className="mb-8 border border-slate-200 rounded-xl p-4 bg-slate-50/40 text-[11px] text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>شرایط عمومی و الزامات حقوقی قرارداد خرید:</span>
            </div>
            {order.termsAndConditions.map((term, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-amber-500 font-black">•</span>
                <span>{term}</span>
              </div>
            ))}
          </div>

          {/* Authorized Signatures & Seals */}
          <div className="border-t border-slate-300 pt-4 grid grid-cols-4 gap-4 text-center text-xs">
            <div className="space-y-12">
              <div className="text-slate-500 font-bold">صادرکننده (مدیر تدارکات)</div>
              <div className="text-[11px] font-bold text-slate-800">{order.issuedBy}</div>
              <div className="text-[10px] text-slate-400">امضا و تاریخ</div>
            </div>
            <div className="space-y-12">
              <div className="text-slate-500 font-bold">تأیید فنی و کنترل پروژه</div>
              <div className="text-[11px] font-bold text-slate-800">معاونت مهندسی و اجرا</div>
              <div className="text-[10px] text-slate-400">امضا و تاریخ</div>
            </div>
            <div className="space-y-12">
              <div className="text-slate-500 font-bold">تأیید بودجه و امور مالی</div>
              <div className="text-[11px] font-bold text-slate-800">مدیریت مالی و اعتبارات</div>
              <div className="text-[10px] text-slate-400">امضا و تاریخ</div>
            </div>
            <div className="space-y-12">
              <div className="text-slate-500 font-bold">تأیید نهایی و مدیرعامل</div>
              <div className="text-[11px] font-bold text-slate-800">{order.approvedBy}</div>
              <div className="text-[10px] text-slate-400">مهر شرکت و امضا</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
