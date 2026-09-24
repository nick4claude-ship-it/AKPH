import React, { useState } from 'react';
import { X, Plus, Trash2, FileCheck, Check, Truck } from 'lucide-react';
import { Project, Supplier, PurchaseOrder, PurchaseOrderItem } from '../../types';
import { Dialog } from '../common/Dialog';
import { formatMoney, moneyUnitLabel, roundRial } from '../../utils/money';
import { generateUUID, nextDocNumber } from '../../utils/ids';
import { toPersianDate, getRelativePersianDate } from '../../utils/date';
import { toPersianDigits } from '../../utils/formatters';
import { useAppState } from '../../store/AppStore';
import { useCurrentUser } from '../../store/session';
import { IntegerInput, MoneyInput } from '../common/NumberInput';

interface NewPurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  suppliers: Supplier[];
  onAddOrder: (order: PurchaseOrder) => { ok: boolean; message: string } | void;
}

export const NewPurchaseOrderModal: React.FC<NewPurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  projects,
  suppliers,
  onAddOrder,
}) => {
  const store = useAppState();
  const user = useCurrentUser();
  const vatRate = store.financeSettings.vatRatePercent / 100;
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [destinationWarehouse, setDestinationWarehouse] = useState('');
  const [deliveryDueDate, setDeliveryDueDate] = useState(() => getRelativePersianDate(14));
  const [paymentTerms, setPaymentTerms] = useState('');
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  type DraftItem = {
    id: string;
    materialCode: string;
    materialName: string;
    specifications: string;
    orderedQty: number;
    unit: string;
    unitPrice: number;
    freightAndUnloadingCost: number;
  };
  const emptyItem = (): DraftItem => ({
    id: generateUUID(),
    materialCode: '',
    materialName: '',
    specifications: '',
    orderedQty: 0,
    unit: '',
    unitPrice: 0,
    freightAndUnloadingCost: 0,
  });
  const [items, setItems] = useState<DraftItem[]>(() => [emptyItem()]);

  if (!isOpen) return null;

  const handleAddItem = () => setItems((prev) => [...prev, emptyItem()]);

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = <K extends keyof DraftItem>(id: string, field: K, value: DraftItem[K]) => {
    setFormError(null);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };

  // Every amount is a whole number of Rials; VAT uses the rate stored in the finance settings.
  const lines = items.map((it) => {
    const net = it.orderedQty * it.unitPrice;
    const vat = roundRial(net * vatRate);
    return { ...it, net, vat, gross: net + vat + it.freightAndUnloadingCost };
  });
  const subtotal = lines.reduce((acc, l) => acc + l.net, 0);
  const totalVat = lines.reduce((acc, l) => acc + l.vat, 0);
  const totalFreight = lines.reduce((acc, l) => acc + l.freightAndUnloadingCost, 0);
  const grandTotal = subtotal + totalVat + totalFreight;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProj = projects.find((p) => p.id === projectId);
    const selectedSup = suppliers.find((s) => s.id === supplierId);
    if (!selectedProj) return setFormError('پروژه را انتخاب کنید.');
    if (!selectedSup) return setFormError('تأمین‌کننده را انتخاب کنید.');
    if (lines.some((l) => !l.materialName.trim() || !l.unit.trim() || l.orderedQty <= 0 || l.unitPrice <= 0)) {
      return setFormError('برای هر ردیف نام کالا، واحد، مقدار و فی را وارد کنید.');
    }
    if (advancePaymentAmount > grandTotal) return setFormError('پیش‌پرداخت از جمع سفارش بیشتر است.');

    const newPO: PurchaseOrder = {
      id: generateUUID(),
      poNumber: nextDocNumber(store.purchaseOrders.map((o) => o.poNumber), 'PO'),
      issueDate: toPersianDate(new Date()),
      deliveryDueDate,
      projectId: selectedProj.id,
      projectName: selectedProj.name,
      costCenterId: selectedProj.costCenterIds?.[0],
      destinationWarehouse,
      supplierId: selectedSup.id,
      counterpartyId: store.counterparties.find((c) => c.kind === 'supplier' && c.name === selectedSup.name)?.id,
      supplierName: selectedSup.name,
      supplierPhone: selectedSup.phone,
      supplierAddress: selectedSup.address,
      items: lines.map((l) => ({
        id: l.id,
        materialCode: l.materialCode,
        materialName: l.materialName.trim(),
        specifications: l.specifications,
        orderedQty: l.orderedQty,
        receivedQty: 0,
        unit: l.unit.trim(),
        unitPrice: l.unitPrice,
        totalNetPrice: l.net,
        vatRate,
        vatAmount: l.vat,
        freightAndUnloadingCost: l.freightAndUnloadingCost,
        totalGrossAmount: l.gross,
      })),
      subtotalAmount: subtotal,
      totalVatAmount: totalVat,
      totalFreightCost: totalFreight,
      totalOrderAmount: grandTotal,
      paymentTerms,
      advancePaymentAmount,
      // Issuing the order does not pay the advance; treasury does.
      advancePaymentPaid: false,
      status: 'صادر شده و ابلاغ به فروشنده',
      deliveryProgressPercentage: 0,
      termsAndConditions: [
        'توزین نهایی ملاک تسویه، باسکول دیجیتال پای کارگاه می‌باشد.',
        'فروشنده متعهد به صدور فاکتور رسمی در سامانه مودیان مالیاتی کشور است.',
        'هرگونه مغایرت فنی در آزمایشگاه موجب عودت کل بار به هزینه فروشنده است.',
      ],
      issuedBy: `${user.name} (${user.role})`,
      approvedBy: '',
    };

    const result = onAddOrder(newPO);
    if (result && !result.ok) return setFormError(result.message);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="صدور برگ سفارش قطعی خرید (PO)" overlayClassName="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
      
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">صدور برگ سفارش قطعی خرید (PO)</h3>
              <p className="text-xs text-slate-500">انعقاد قرارداد رسمی تأمین کالا، شرایط تحویل و تسویه مالی</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* Supplier & Project */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">انتخاب تأمین‌کننده از وندورلیست (AVL):</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden font-bold text-slate-800"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} - رسته: {s.category} (گرید {s.grade})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">پروژه مقصد تحویل:</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">محل دقیق تخلیه بار / انبار:</label>
              <input
                type="text"
                value={destinationWarehouse}
                onChange={(e) => setDestinationWarehouse(e.target.value)}
                placeholder="انبار مرکزی یا پای کارگاه"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">مهلت تحویل پای کار:</label>
              <input
                type="text"
                value={deliveryDueDate}
                onChange={(e) => setDeliveryDueDate(e.target.value)}
                placeholder="۱۴۰۳/۰۷/۲۰"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">شرایط تسویه مالی:</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="مثلاً چک صیادی ۶۰ روزه"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                required
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-sm">اقلام سفارش رسمی ({items.length} قلم):</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-bold hover:bg-amber-100 transition-colors cursor-pointer"
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
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">شرح کالا:</label>
                      <input
                        type="text"
                        value={item.materialName}
                        onChange={(e) => handleUpdateItem(item.id, 'materialName', e.target.value)}
                        placeholder="نام رسمی کالا"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">مشخصات فنی و استاندارد کارخانه‌ای:</label>
                      <input
                        type="text"
                        value={item.specifications}
                        onChange={(e) => handleUpdateItem(item.id, 'specifications', e.target.value)}
                        placeholder="آلیاژ، تست کشش، ضخامت"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">تعداد/مقدار سفارش:</label>
                      <IntegerInput
                        value={item.orderedQty}
                        onValueChange={(v) => handleUpdateItem(item.id, 'orderedQty', v)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">واحد:</label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                        placeholder="کیلوگرم، شاخه"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">نرخ توافقی فی ({moneyUnitLabel()}):</label>
                      <MoneyInput
                        value={item.unitPrice}
                        onValueChange={(v) => handleUpdateItem(item.id, 'unitPrice', v)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">کرایه حمل و تخلیه:</label>
                      <MoneyInput
                        value={item.freightAndUnloadingCost}
                        onValueChange={(v) => handleUpdateItem(item.id, 'freightAndUnloadingCost', v)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-hidden"
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
              <span className="font-mono font-bold">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>مالیات بر ارزش افزوده ({toPersianDigits(store.financeSettings.vatRatePercent)}٪):</span>
              <span className="font-mono font-bold">{formatMoney(totalVat)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>مجموع هزینه حمل:</span>
              <span className="font-mono font-bold">{formatMoney(totalFreight)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between items-center font-black text-slate-900 text-sm">
              <span>مبلغ نهایی سفارش (ناخالص):</span>
              <span className="font-mono text-amber-600 text-base">{formatMoney(grandTotal)}</span>
            </div>
          </div>

          {formError && (
            <p className="text-xs text-rose-700 font-bold" role="alert">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>صدور سفارش رسمی و ابلاغ به فروشنده</span>
            </button>
          </div>
        </form>
      </Dialog>
  );
};
