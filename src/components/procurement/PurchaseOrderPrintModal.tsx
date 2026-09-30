import React from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, Building, Truck, FileText } from 'lucide-react';
import { PurchaseOrder } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { formatPercent, formatDecimal, formatText } from '../../utils/formatters';
import { useCompany } from '../../store/session';
import { Money } from '../common/Money';
import { OfficialPrint, moneyHeader } from '../common/OfficialPrint';

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
  const company = useCompany();
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog onClose={onClose} label="پیش‌نمایش و چاپ برگ سفارش رسمی خرید (PO)" overlayClassName="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
      
        {/* Header - Not Printed */}
        <div className="no-print flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-700 rounded-lg">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">پیش‌نمایش و چاپ برگ سفارش رسمی خرید</h3>
              <p className="text-xs text-slate-500 tabular-nums">{formatText(order.poNumber)} - {formatText(company.legalName)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn btn-primary"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فرم اداری</span>
            </button>
            <button
              onClick={onClose}
              aria-label="بستن"
              className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-8 overflow-y-auto flex-1">
          <OfficialPrint
            reportType="purchase_order"
            title="برگ سفارش قطعی خرید"
            number={order.poNumber}
            money
            localSignatures={[
              { title: 'صادرکننده', name: order.issuedBy || '', at: null, signed: false },
              { title: 'تأییدکننده', name: order.approvedBy || '', at: null, signed: false },
            ]}
            filters={[
              { label: 'تاریخ صدور', value: order.issueDate },
              { label: 'مهلت تحویل', value: order.deliveryDueDate },
              { label: 'پروژه مقصد', value: order.projectName },
              { label: 'محل تخلیه', value: order.destinationWarehouse },
              { label: 'تأمین‌کننده', value: order.supplierName },
              { label: 'شرایط تسویه', value: order.paymentTerms },
            ]}
          >
            <table className="mb-4">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>کد کالا</th>
                  <th>شرح کالا و مشخصات فنی</th>
                  <th>مقدار</th>
                  <th>واحد</th>
                  <th>{moneyHeader('مبلغ واحد')}</th>
                  <th>{moneyHeader('مبلغ خالص')}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {order.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td>{formatDecimal(idx + 1)}</td>
                    <td>{formatText(item.materialCode)}</td>
                    <td>
                      <div className="font-bold">{formatText(item.materialName)}</div>
                      <div className="text-xs text-slate-600">{formatText(item.specifications)}</div>
                    </td>
                    <td>{formatDecimal(item.orderedQty)}</td>
                    <td>{formatText(item.unit)}</td>
                    <td>{formatMoney(item.unitPrice, false)}</td>
                    <td>{formatMoney(item.totalNetPrice, false)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}>جمع بهای خالص کالا</td>
                  <td><Money rial={order.subtotalAmount} unit={false} /></td>
                </tr>
                <tr>
                  <td colSpan={6}>مالیات بر ارزش افزوده</td>
                  <td><Money rial={order.totalVatAmount} unit={false} /></td>
                </tr>
                <tr>
                  <td colSpan={6}>کرایه حمل و تخلیه</td>
                  <td><Money rial={order.totalFreightCost} unit={false} /></td>
                </tr>
                <tr className="font-bold">
                  <td colSpan={6}>مبلغ کل سفارش</td>
                  <td><Money rial={order.totalOrderAmount} unit={false} /></td>
                </tr>
              </tfoot>
            </table>
            {order.termsAndConditions.length > 0 && (
              <div className="text-xs text-slate-700 space-y-1">
                <div className="font-bold">شرایط عمومی و الزامات قرارداد خرید:</div>
                {order.termsAndConditions.map((term) => (
                  <div key={term}>• {formatText(term)}</div>
                ))}
              </div>
            )}
          </OfficialPrint>
        </div>
      </Dialog>
  );
};
