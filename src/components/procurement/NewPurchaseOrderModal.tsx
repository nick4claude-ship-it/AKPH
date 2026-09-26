import React, { useState } from 'react';
import { X, Plus, Trash2, FileCheck, Check, Truck } from 'lucide-react';
import { Project, Supplier } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { getRelativePersianDate } from '../../utils/date';
import { toPersianDigits, formatInt, formatText } from '../../utils/formatters';
import { useSelector } from '../../store/AppStore';
import {
  blankPurchaseOrderLine,
  computePurchaseOrderDraft,
  type PurchaseOrderFormInput,
  type PurchaseOrderLineInput,
} from '../../store/views/procurement';
import { IntegerInput, MoneyInput } from '../../ui/NumberInput';
import { Money } from '../common/Money';

interface NewPurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  suppliers: Supplier[];
  /** Issues the order through the workflow, which recomputes every amount. */
  onAddOrder: (form: PurchaseOrderFormInput) => { ok: boolean; message: string };
}

export const NewPurchaseOrderModal: React.FC<NewPurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  projects,
  suppliers,
  onAddOrder,
}) => {
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [destinationWarehouse, setDestinationWarehouse] = useState('');
  const [deliveryDueDate, setDeliveryDueDate] = useState(() => getRelativePersianDate(14));
  const [paymentTerms, setPaymentTerms] = useState('');
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  type DraftItem = PurchaseOrderLineInput;
  const [items, setItems] = useState<DraftItem[]>(() => [blankPurchaseOrderLine()]);

  const form: PurchaseOrderFormInput = { projectId, supplierId, destinationWarehouse, deliveryDueDate, paymentTerms, advancePaymentAmount, items };
  // Every amount is a whole number of Rials; VAT uses the rate stored in the finance settings.
  const draft = useSelector((s) => computePurchaseOrderDraft(s, form), [JSON.stringify(form)]);
  const { lines, subtotal, totalVat, totalFreight, grandTotal } = draft;

  if (!isOpen) return null;

  const handleAddItem = () => setItems((prev) => [...prev, blankPurchaseOrderLine()]);

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = <K extends keyof DraftItem>(id: string, field: K, value: DraftItem[K]) => {
    setFormError(null);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.error) return setFormError(draft.error);
    const result = onAddOrder(form);
    if (!result.ok) return setFormError(result.message);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="صدور برگ سفارش قطعی خرید (PO)" overlayClassName="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
      
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">صدور برگ سفارش قطعی خرید</h3>
              <p className="text-xs text-slate-500">انعقاد قرارداد رسمی تأمین کالا، شرایط تحویل و تسویه مالی</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-sm">
          {/* Supplier & Project */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-purchase-order-modal-1" className="block font-bold text-slate-700 mb-1">انتخاب تأمین‌کننده از وندورلیست:</label>
              <select id="new-purchase-order-modal-1"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-hidden font-bold text-slate-800"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatText(s.name)} - رسته: {formatText(s.category)} (گرید {formatText(s.grade)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-purchase-order-modal-2" className="block font-bold text-slate-700 mb-1">پروژه مقصد تحویل:</label>
              <select id="new-purchase-order-modal-2"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{formatText(p.name)} ({p.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="new-purchase-order-modal-3" className="block font-bold text-slate-700 mb-1">محل دقیق تخلیه بار / انبار:</label>
              <input id="new-purchase-order-modal-3"
                type="text"
                value={destinationWarehouse}
                onChange={(e) => setDestinationWarehouse(e.target.value)}
                placeholder="انبار مرکزی یا پای کارگاه"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
                required
              />
            </div>
            <div>
              <label htmlFor="new-purchase-order-modal-4" className="block font-bold text-slate-700 mb-1">مهلت تحویل پای کار:</label>
              <input id="new-purchase-order-modal-4"
                type="text"
                value={deliveryDueDate}
                onChange={(e) => setDeliveryDueDate(e.target.value)}
                placeholder="۱۴۰۳/۰۷/۲۰"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
                required
              />
            </div>
            <div>
              <label htmlFor="new-purchase-order-modal-5" className="block font-bold text-slate-700 mb-1">شرایط تسویه مالی:</label>
              <input id="new-purchase-order-modal-5"
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="مثلاً چک صیادی ۶۰ روزه"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
                required
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-sm">اقلام سفارش رسمی ({formatInt(items.length)} قلم):</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="btn btn-primary"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن قلم کالا</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-bold">قلم #{index + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-rose-700 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="new-purchase-order-modal-6" className="block text-xs text-slate-600 mb-1">شرح کالا:</label>
                      <input id="new-purchase-order-modal-6"
                        type="text"
                        value={item.materialName}
                        onChange={(e) => handleUpdateItem(item.id, 'materialName', e.target.value)}
                        placeholder="نام رسمی کالا"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-purchase-order-modal-7" className="block text-xs text-slate-600 mb-1">مشخصات فنی و استاندارد کارخانه‌ای:</label>
                      <input id="new-purchase-order-modal-7"
                        type="text"
                        value={item.specifications}
                        onChange={(e) => handleUpdateItem(item.id, 'specifications', e.target.value)}
                        placeholder="آلیاژ، تست کشش، ضخامت"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label htmlFor="new-purchase-order-modal-8" className="block text-xs text-slate-600 mb-1">تعداد/مقدار سفارش:</label>
                      <IntegerInput id="new-purchase-order-modal-8"
                        value={item.orderedQty}
                        onValueChange={(v) => handleUpdateItem(item.id, 'orderedQty', v)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm tabular-nums font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-purchase-order-modal-9" className="block text-xs text-slate-600 mb-1">واحد:</label>
                      <input id="new-purchase-order-modal-9"
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                        placeholder="کیلوگرم، شاخه"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-purchase-order-modal-10" className="block text-xs text-slate-600 mb-1">نرخ توافقی فی ({moneyUnitLabel()}):</label>
                      <MoneyInput id="new-purchase-order-modal-10"
                        value={item.unitPrice}
                        onValueChange={(v) => handleUpdateItem(item.id, 'unitPrice', v)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm tabular-nums font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-purchase-order-modal-11" className="block text-xs text-slate-600 mb-1">کرایه حمل و تخلیه:</label>
                      <MoneyInput id="new-purchase-order-modal-11"
                        value={item.freightAndUnloadingCost}
                        onValueChange={(v) => handleUpdateItem(item.id, 'freightAndUnloadingCost', v)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm tabular-nums focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
            <div className="flex justify-between items-center text-slate-600">
              <span>مبلغ خالص کالا:</span>
              <span className="tabular-nums font-bold"><Money rial={subtotal} /></span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>مالیات بر ارزش افزوده ({toPersianDigits(draft.vatRatePercent)}٪):</span>
              <span className="tabular-nums font-bold"><Money rial={totalVat} /></span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>مجموع هزینه حمل:</span>
              <span className="tabular-nums font-bold"><Money rial={totalFreight} /></span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between items-center font-bold text-slate-900 text-sm">
              <span>مبلغ نهایی سفارش (ناخالص):</span>
              <span className="tabular-nums text-amber-700 text-base"><Money rial={grandTotal} /></span>
            </div>
          </div>

          {formError && (
            <p className="text-sm text-rose-700 font-bold" role="alert">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              <Check className="w-4 h-4" />
              <span>صدور سفارش رسمی و ابلاغ به فروشنده</span>
            </button>
          </div>
        </form>
      </Dialog>
  );
};
