import React, { useState } from 'react';
import { X, Plus, Trash2, FileCheck, Check, Truck } from 'lucide-react';
import { Project, Supplier, PurchaseOrder, PurchaseOrderItem } from '../../types';

interface NewPurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  suppliers: Supplier[];
  onAddOrder: (order: PurchaseOrder) => void;
}

export const NewPurchaseOrderModal: React.FC<NewPurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  projects,
  suppliers,
  onAddOrder,
}) => {
  const [projectId, setProjectId] = useState(projects[0]?.id || 'prj-101');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || 'sup-101');
  const [destinationWarehouse, setDestinationWarehouse] = useState('انبار کارگاه رونیکا');
  const [deliveryDueDate, setDeliveryDueDate] = useState('۱۴۰۳/۰۷/۲۰');
  const [paymentTerms, setPaymentTerms] = useState('چک صیادی ۶۰ روزه');
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState(0);

  const [items, setItems] = useState<Array<{
    id: string;
    materialCode: string;
    materialName: string;
    specifications: string;
    orderedQty: number;
    unit: string;
    unitPrice: number;
    vatRate: number;
    freightAndUnloadingCost: number;
  }>>([
    {
      id: 'poi-1',
      materialCode: 'MAT-STEEL-001',
      materialName: 'میلگرد آجدار A3 سایز ۲۰ شاخه ۱۲ متری',
      specifications: 'تولید ذوب‌آهن اصفهان دارای شناسنامه آنالیز متالورژی',
      orderedQty: 30000,
      unit: 'کیلوگرم',
      unitPrice: 28200,
      vatRate: 0.1,
      freightAndUnloadingCost: 15_000_000,
    },
  ]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `poi-${Date.now()}`,
        materialCode: 'MAT-GEN-01',
        materialName: '',
        specifications: '',
        orderedQty: 100,
        unit: 'شاخه',
        unitPrice: 1000000,
        vatRate: 0.1,
        freightAndUnloadingCost: 5_000_000,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, field: string, value: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const subtotal = items.reduce(
    (acc, it) => acc + (it.orderedQty || 0) * (it.unitPrice || 0),
    0
  );

  const totalVat = items.reduce(
    (acc, it) => acc + (it.orderedQty || 0) * (it.unitPrice || 0) * (it.vatRate || 0),
    0
  );

  const totalFreight = items.reduce(
    (acc, it) => acc + (it.freightAndUnloadingCost || 0),
    0
  );

  const grandTotal = subtotal + totalVat + totalFreight;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProj = projects.find((p) => p.id === projectId);
    const selectedSup = suppliers.find((s) => s.id === supplierId);
    const poNumber = `PO-1403-0${Math.floor(Math.random() * 40) + 95}`;

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber,
      issueDate: '۱۴۰۳/۰۷/۰۳',
      deliveryDueDate,
      projectId,
      projectName: selectedProj ? selectedProj.name : 'پروژه عمومی',
      destinationWarehouse,
      supplierId,
      supplierName: selectedSup ? selectedSup.name : 'تأمین‌کننده طرف حساب',
      supplierPhone: selectedSup ? selectedSup.phone : '۰۲۱-۸۸۰۰۰۰۰۰',
      supplierAddress: selectedSup ? selectedSup.address : 'تهران',
      items: items.map((it) => {
        const net = (it.orderedQty || 0) * (it.unitPrice || 0);
        const vat = net * (it.vatRate || 0);
        return {
          id: it.id,
          materialCode: it.materialCode,
          materialName: it.materialName,
          specifications: it.specifications,
          orderedQty: Number(it.orderedQty) || 0,
          receivedQty: 0,
          unit: it.unit,
          unitPrice: Number(it.unitPrice) || 0,
          totalNetPrice: net,
          vatRate: it.vatRate,
          vatAmount: vat,
          freightAndUnloadingCost: Number(it.freightAndUnloadingCost) || 0,
          totalGrossAmount: net + vat + (Number(it.freightAndUnloadingCost) || 0),
        };
      }),
      subtotalAmount: subtotal,
      totalVatAmount: totalVat,
      totalFreightCost: totalFreight,
      totalOrderAmount: grandTotal,
      paymentTerms,
      advancePaymentAmount: Number(advancePaymentAmount) || 0,
      advancePaymentPaid: Number(advancePaymentAmount) > 0,
      status: 'صادر شده و ابلاغ به فروشنده',
      deliveryProgressPercentage: 0,
      termsAndConditions: [
        'توزین نهایی ملاک تسویه، باسکول دیجیتال ۶۰ تنی پای کارگاه می‌باشد.',
        'فروشنده متعهد به صدور فاکتور رسمی در سامانه مودیان مالیاتی کشور است.',
        'هرگونه مغایرت فنی در آزمایشگاه موجب عودت کل بار به هزینه فروشنده است.',
      ],
      issuedBy: 'مهندس آریافر (مدیر تدارکات)',
      approvedBy: 'مهندس شایان فرهمند (مدیرعامل)',
    };

    onAddOrder(newPO);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
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
                      <input
                        type="number"
                        value={item.orderedQty}
                        onChange={(e) => handleUpdateItem(item.id, 'orderedQty', Number(e.target.value))}
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
                      <label className="block text-[11px] text-slate-600 mb-1">نرخ توافقی فی (تومان):</label>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(item.id, 'unitPrice', Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">کرایه حمل و تخلیه:</label>
                      <input
                        type="number"
                        value={item.freightAndUnloadingCost}
                        onChange={(e) => handleUpdateItem(item.id, 'freightAndUnloadingCost', Number(e.target.value))}
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
              <span className="font-mono font-bold">{subtotal.toLocaleString('fa-IR')} تومان</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>مالیات بر ارزش افزوده (۱۰٪):</span>
              <span className="font-mono font-bold">{totalVat.toLocaleString('fa-IR')} تومان</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>مجموع هزینه حمل:</span>
              <span className="font-mono font-bold">{totalFreight.toLocaleString('fa-IR')} تومان</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between items-center font-black text-slate-900 text-sm">
              <span>مبلغ نهایی سفارش (ناخالص):</span>
              <span className="font-mono text-amber-600 text-base">{grandTotal.toLocaleString('fa-IR')} تومان</span>
            </div>
          </div>

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
      </div>
    </div>
  );
};
