/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  GoodsReceiptNote,
  GoodsReceiptItem,
  Warehouse,
  MaterialItem,
  Project,
  UserProfile,
} from '../../types';
import {
  X,
  ArrowDownLeft,
  Scale,
  ShieldCheck,
  Plus,
  Trash2,
  Building,
  Truck,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { generateUUID } from '../../utils/ids';

interface NewGoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  materials: MaterialItem[];
  projects: Project[];
  currentUser: UserProfile;
  onSubmitReceipt: (receipt: GoodsReceiptNote) => void;
}

export const NewGoodsReceiptModal: React.FC<NewGoodsReceiptModalProps> = ({
  isOpen,
  onClose,
  warehouses,
  materials,
  projects,
  currentUser,
  onSubmitReceipt,
}) => {
  if (!isOpen) return null;

  const [warehouseId, setWarehouseId] = useState(warehouses[1]?.id || warehouses[0]?.id || '');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [waybillNumber, setWaybillNumber] = useState('');
  const [truckPlateNumber, setTruckPlateNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [weighbridgeSlipNumber, setWeighbridgeSlipNumber] = useState('');
  const [grossWeightKg, setGrossWeightKg] = useState<number | ''>('');
  const [tareWeightKg, setTareWeightKg] = useState<number | ''>('');
  const [qualityCertificateNumber, setQualityCertificateNumber] = useState('');
  const [qcApprovalStatus, setQcApprovalStatus] = useState<GoodsReceiptNote['qcApprovalStatus']>('تأیید کامل');
  const [qcNotes, setQcNotes] = useState('');

  // Items
  const [items, setItems] = useState<GoodsReceiptItem[]>([
    {
      materialId: materials[0]?.id || '',
      materialCode: materials[0]?.code || '',
      materialName: materials[0]?.name || '',
      unit: materials[0]?.unit || 'کیلوگرم',
      orderedQty: 1000,
      deliveredQty: 1000,
      rejectedQty: 0,
      acceptedQty: 1000,
      unitPrice: materials[0]?.averageUnitPrice || 30000,
      totalPrice: (materials[0]?.averageUnitPrice || 30000) * 1000,
      notes: '',
    },
  ]);

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const selectedProject = projects.find((p) => p.id === selectedWarehouse?.projectId);

  const netWeightKg =
    typeof grossWeightKg === 'number' && typeof tareWeightKg === 'number' && grossWeightKg > tareWeightKg
      ? grossWeightKg - tareWeightKg
      : undefined;

  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleMaterialChange = (index: number, matId: string) => {
    const mat = materials.find((m) => m.id === matId);
    if (!mat) return;

    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              materialId: mat.id,
              materialCode: mat.code,
              materialName: mat.name,
              unit: mat.unit,
              unitPrice: mat.averageUnitPrice,
              totalPrice: mat.averageUnitPrice * item.acceptedQty,
            }
          : item
      )
    );
  };

  const handleQuantityChange = (index: number, qty: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              deliveredQty: qty,
              acceptedQty: qty - item.rejectedQty,
              totalPrice: (qty - item.rejectedQty) * item.unitPrice,
            }
          : item
      )
    );
  };

  const handleUnitPriceChange = (index: number, price: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              unitPrice: price,
              totalPrice: item.acceptedQty * price,
            }
          : item
      )
    );
  };

  const addItemRow = () => {
    const defaultMat = materials[0];
    if (!defaultMat) return;
    setItems((prev) => [
      ...prev,
      {
        materialId: defaultMat.id,
        materialCode: defaultMat.code,
        materialName: defaultMat.name,
        unit: defaultMat.unit,
        orderedQty: 100,
        deliveredQty: 100,
        rejectedQty: 0,
        acceptedQty: 100,
        unitPrice: defaultMat.averageUnitPrice,
        totalPrice: defaultMat.averageUnitPrice * 100,
        notes: '',
      },
    ]);
  };

  const [formError, setFormError] = useState<string | null>(null);

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      setFormError('لطفاً نام فروشنده/تأمین‌کننده را وارد فرمایید.');
      return;
    }
    setFormError(null);

    const randomNum = Math.floor(100 + Math.random() * 900);
    const newReceipt: GoodsReceiptNote = {
      id: generateUUID(),
      receiptNumber: `رسید انبار ۱۴۰۳/${randomNum}`,
      date: '۱۴۰۳/۰۷/۰۴',
      warehouseId,
      warehouseName: selectedWarehouse ? selectedWarehouse.name : 'انبار کارگاهی',
      projectId: selectedWarehouse?.projectId || 'prj-101',
      projectName: selectedWarehouse ? selectedWarehouse.projectName : 'پروژه جاری',
      supplierName: supplierName.trim(),
      invoiceNumber: invoiceNumber.trim() || `INV-${randomNum}`,
      waybillNumber: waybillNumber.trim() || `BL-${randomNum}-IR`,
      truckPlateNumber: truckPlateNumber.trim() || '۴۲ ایران ۵۵',
      driverName: driverName.trim() || 'راننده باربری',
      driverPhone: driverPhone.trim() || '۰۹۱۲-۰۰۰۰۰۰۰',
      weighbridgeSlipNumber: weighbridgeSlipNumber.trim() || (netWeightKg ? `WB-${randomNum}` : undefined),
      grossWeightKg: typeof grossWeightKg === 'number' ? grossWeightKg : undefined,
      tareWeightKg: typeof tareWeightKg === 'number' ? tareWeightKg : undefined,
      netWeightKg: netWeightKg,
      qualityCertificateNumber: qualityCertificateNumber.trim() || undefined,
      qcApprovalStatus,
      qcInspectorName: currentUser.name,
      qcNotes: qcNotes.trim() || 'تأیید ظاهری و انطباق با برگه خرید',
      items,
      totalAmount,
      status: 'تأیید نهایی انبارداری',
      receiverName: currentUser.name,
      accountingJournalEntryId: `JV-WH-1403-${randomNum}`,
    };

    onSubmitReceipt(newReceipt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                ثبت قبض رسید ورود کالا و مصالح پای کار (GRN)
              </h3>
              <p className="text-xs text-slate-500">
                تطبیق بارنامه، باسکول، شیت آزمایشگاه و صدور سند انبارداری
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 font-bold rounded-xl flex items-center gap-2 animate-in fade-in duration-200 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}
          {/* Warehouse and Supplier Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">انبار و کارگاه مقصد *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50 cursor-pointer"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.projectName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">نام شرکت فروشنده / تأمین‌کننده *</label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="مثلاً: شرکت ذوب‌آهن اصفهان"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">شماره فاکتور / حواله فروش</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-99824"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Transport, Driver and Weighbridge */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-slate-600" />
              مشخصات بارنامه و توزین باسکول
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">شماره بارنامه راهداری</label>
                <input
                  type="text"
                  value={waybillNumber}
                  onChange={(e) => setWaybillNumber(e.target.value)}
                  placeholder="BL-778942"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 block mb-1">پلاک تریلی / کامیون</label>
                <input
                  type="text"
                  value={truckPlateNumber}
                  onChange={(e) => setTruckPlateNumber(e.target.value)}
                  placeholder="۲۴ ع ۵۶۷ ایران ۶۸"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 block mb-1">نام و تماس راننده</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="علی رمضانی"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 block mb-1">شماره قبض باسکول دیجیتال</label>
                <input
                  type="text"
                  value={weighbridgeSlipNumber}
                  onChange={(e) => setWeighbridgeSlipNumber(e.target.value)}
                  placeholder="WB-0921"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                />
              </div>
            </div>

            {/* Weighbridge Gross, Tare, Net */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/80">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">وزن ناخالص با تریلی (kg)</label>
                <input
                  type="number"
                  value={grossWeightKg}
                  onChange={(e) => setGrossWeightKg(e.target.value ? Number(e.target.value) : '')}
                  placeholder="مثلاً: 42000"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 block mb-1">وزن خالی کامیون - طاره (kg)</label>
                <input
                  type="number"
                  value={tareWeightKg}
                  onChange={(e) => setTareWeightKg(e.target.value ? Number(e.target.value) : '')}
                  placeholder="مثلاً: 16000"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-800 block">وزن خالص بار (باسکول)</span>
                  <span className="font-bold text-emerald-950 font-mono text-sm">
                    {netWeightKg ? `${netWeightKg.toLocaleString('fa-IR')} kg` : 'محاسبه خودکار'}
                  </span>
                </div>
                <Scale className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* QC Inspection Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              کنترل کیفیت و تأییدیه فنی آزمایشگاه
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">وضعیت تأییدیه کیفی</label>
                <select
                  value={qcApprovalStatus}
                  onChange={(e) => setQcApprovalStatus(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                >
                  <option value="تأیید کامل">تأیید کامل و بی‌قید و شرط</option>
                  <option value="تأیید مشروط">تأیید مشروط / قرنطینه تا جواب آزمایشگاه</option>
                  <option value="مردود">مردود و عودت کالا</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-600 block mb-1">شماره سرتیفیکیت کارخانه / شیت آزمون</label>
                <input
                  type="text"
                  value={qualityCertificateNumber}
                  onChange={(e) => setQualityCertificateNumber(e.target.value)}
                  placeholder="CERT-MET-1403"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 block mb-1">توضیحات و گزارش مهندس ناظر</label>
                <input
                  type="text"
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  placeholder="تست خمش و کشش انجام شد"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-900">اقلام مصالح مندرج در رسید انبار</h4>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن ردیف کالا</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-600 text-[11px]">
                  <tr>
                    <th className="p-2.5">عنوان مصالح</th>
                    <th className="p-2.5">واحد</th>
                    <th className="p-2.5">مقدار تحویلی</th>
                    <th className="p-2.5">نرخ واحد (تومان)</th>
                    <th className="p-2.5 text-left">مبلغ کل (تومان)</th>
                    <th className="p-2.5 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5">
                        <select
                          value={item.materialId}
                          onChange={(e) => handleMaterialChange(idx, e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                        >
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2.5 font-medium text-slate-600">{item.unit}</td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          min={1}
                          value={item.deliveredQty}
                          onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                          className="w-24 px-2 py-1 rounded-lg border border-slate-200 font-mono text-center"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          min={1}
                          value={item.unitPrice}
                          onChange={(e) => handleUnitPriceChange(idx, Number(e.target.value))}
                          className="w-32 px-2 py-1 rounded-lg border border-slate-200 font-mono text-left"
                        />
                      </td>

                      <td className="p-2.5 text-left font-mono font-bold text-slate-900">
                        {item.totalPrice.toLocaleString('fa-IR')}
                      </td>

                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Total Bar */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
            <span className="font-bold text-xs">مجموع ارزش ریالی رسید انبار:</span>
            <span className="font-black text-emerald-400 font-mono text-base">
              {totalAmount.toLocaleString('fa-IR')} تومان
            </span>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-all cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>تأیید نهایی و ورود به انبار کارگاه</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
