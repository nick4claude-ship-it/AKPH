/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  InterWarehouseTransfer,
  Warehouse,
  MaterialItem,
  UserProfile,
} from '../../types';
import {
  X,
  ArrowRightLeft,
  Truck,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { generateUUID } from '../../utils/ids';
import { Dialog } from '../common/Dialog';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { IntegerInput } from '../common/NumberInput';
import { toPersianDate } from '../../utils/date';

interface NewTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  materials: MaterialItem[];
  currentUser: UserProfile;
  onSubmitTransfer: (transfer: InterWarehouseTransfer) => { ok: boolean; message: string };
}

export const NewTransferModal: React.FC<NewTransferModalProps> = ({
  isOpen,
  onClose,
  warehouses,
  materials,
  currentUser,
  onSubmitTransfer,
}) => {
  const [sourceWarehouseId, setSourceWarehouseId] = useState(warehouses[0]?.id || '');
  const [targetWarehouseId, setTargetWarehouseId] = useState(warehouses[1]?.id || '');
  const [waybillNumber, setWaybillNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [truckPlate, setTruckPlate] = useState('');

  const [items, setItems] = useState(() => [
    {
      rowKey: generateUUID(),
      materialId: materials[0]?.id || '',
      materialCode: materials[0]?.code || '',
      materialName: materials[0]?.name || '',
      unit: materials[0]?.unit || 'کیلوگرم',
      quantity: 0,
      unitCost: materials[0]?.averageUnitPrice || 0,
      totalCost: 0,
    },
  ]);

  const sourceWh = warehouses.find((w) => w.id === sourceWarehouseId);
  const targetWh = warehouses.find((w) => w.id === targetWarehouseId);

  const totalCost = items.reduce((s, i) => s + i.totalCost, 0);

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
              unitCost: mat.averageUnitPrice,
              totalCost: mat.averageUnitPrice * item.quantity,
            }
          : item
      )
    );
  };

  const handleQtyChange = (index: number, qty: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              quantity: qty,
              totalCost: qty * item.unitCost,
            }
          : item
      )
    );
  };

  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceWh || !targetWh) return setFormError('انبار مبدأ و مقصد را انتخاب کنید.');
    if (sourceWarehouseId === targetWarehouseId) return setFormError('انبار مبدأ و مقصد نمی‌توانند یکسان باشند.');
    if (items.some((i) => i.quantity <= 0)) return setFormError('مقدار هر ردیف باید بیش از صفر باشد.');
    if (!waybillNumber.trim()) return setFormError('شماره بارنامه را وارد کنید.');
    setFormError(null);

    const newTrf: InterWarehouseTransfer = {
      id: generateUUID(),
      transferNumber: '',
      date: toPersianDate(new Date()),
      sourceWarehouseId,
      sourceWarehouseName: sourceWh.name,
      sourceProjectId: sourceWh.projectId || '',
      targetWarehouseId,
      targetWarehouseName: targetWh.name,
      targetProjectId: targetWh.projectId || '',
      waybillNumber: waybillNumber.trim(),
      driverName: driverName.trim(),
      truckPlate: truckPlate.trim(),
      items: items.map(({ rowKey: _k, ...i }) => i),
      totalCost,
      status: 'در مسیر حمل',
      authorizedBy: `${currentUser.name} (${currentUser.role})`,
    };

    const result = onSubmitTransfer(newTrf);
    if (!result.ok) return setFormError(result.message);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="صدور مجوز انتقال مصالح بین کارگاه‌ها (Inter-Site Transfer)" overlayClassName="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto" className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
      
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                صدور مجوز انتقال مصالح بین کارگاه‌ها (Inter-Site Transfer)
              </h3>
              <p className="text-xs text-slate-500">
                انتقال موجودی مازاد یا ماشین‌آلات از یک سایت به سایت دیگر
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 font-bold rounded-xl flex items-center gap-2 animate-in fade-in duration-200 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}
          {/* Source and Target Warehouses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 block mb-1">انبار کارگاه مبدأ *</label>
              <select
                value={sourceWarehouseId}
                onChange={(e) => setSourceWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer font-medium"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.projectName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">انبار کارگاه مقصد *</label>
              <select
                value={targetWarehouseId}
                onChange={(e) => setTargetWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer font-medium"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.projectName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transport & Driver Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">شماره بارنامه داخلی</label>
              <input
                type="text"
                value={waybillNumber}
                onChange={(e) => setWaybillNumber(e.target.value)}
                placeholder="TRF-BL-99120"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">نام راننده</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="محمود علیزاده"
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">شماره پلاک خودرو</label>
              <input
                type="text"
                value={truckPlate}
                onChange={(e) => setTruckPlate(e.target.value)}
                placeholder="۳۲ ب ۴۵۶ ایران ۱۱"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-900">اقلام محموله انتقالی</h4>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-600 text-[11px]">
                  <tr>
                    <th className="p-2.5">عنوان مصالح</th>
                    <th className="p-2.5">واحد</th>
                    <th className="p-2.5">تعداد / مقدار جابجایی</th>
                    <th className="p-2.5">نرخ واحد ({moneyUnitLabel()})</th>
                    <th className="p-2.5 text-left">ارزش کل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.rowKey}>
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

                      <td className="p-2.5 text-slate-600 font-medium">{item.unit}</td>

                      <td className="p-2.5">
                        <IntegerInput
                          value={item.quantity}
                          onValueChange={(v) => handleQtyChange(idx, v)}
                          className="w-28 px-2 py-1 rounded-lg border border-slate-200 font-mono text-center"
                        />
                      </td>

                      <td className="p-2.5 font-mono text-slate-700">
                        {formatMoney(item.unitCost, false)}
                      </td>

                      <td className="p-2.5 text-left font-mono font-bold text-slate-900">
                        {formatMoney(item.totalCost, false)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
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
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <Truck className="w-4 h-4" />
              <span>صدور حواله انتقال و بارگیری</span>
            </button>
          </div>
        </form>
      </Dialog>
  );
};
