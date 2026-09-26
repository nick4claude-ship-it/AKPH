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
import { Dialog } from '../../ui/Dialog';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { IntegerInput } from '../../ui/NumberInput';
import { useSelector } from '../../store/AppStore';
import { computeTransferDraft, newTransferLine, type TransferFormInput, type TransferLineInput } from '../../store/views/inventory';
import { formatText } from '../../utils/formatters';

interface NewTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  materials: MaterialItem[];
  currentUser: UserProfile;
  /** Issues the transfer through the workflow (valued at the weighted average there). */
  onSubmitTransfer: (form: TransferFormInput) => { ok: boolean; message: string };
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

  const [rows, setRows] = useState<TransferLineInput[]>(() => [newTransferLine(materials)]);
  const [formError, setFormError] = useState<string | null>(null);

  const form: TransferFormInput = { sourceWarehouseId, targetWarehouseId, waybillNumber, driverName, truckPlate, lines: rows };
  // Lines valued at the weighted average cost, plus the first problem of the form.
  const draft = useSelector((s) => computeTransferDraft(s, form), [JSON.stringify(form)]);
  const items = draft.lines;
  const totalCost = draft.totalCost;
  const sourceWh = draft.source;
  const targetWh = draft.target;

  const updateRow = (index: number, patch: Partial<TransferLineInput>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const handleMaterialChange = (index: number, matId: string) => updateRow(index, { materialId: matId });
  const handleQtyChange = (index: number, qty: number) => updateRow(index, { quantity: qty });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.error) return setFormError(draft.error);
    setFormError(null);
    const result = onSubmitTransfer(form);
    if (!result.ok) return setFormError(result.message);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="صدور مجوز انتقال مصالح بین کارگاه‌ها (Inter-Site Transfer)" overlayClassName="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto" className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
      
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                صدور مجوز انتقال مصالح بین کارگاه‌ها
              </h3>
              <p className="text-xs text-slate-500">
                انتقال موجودی مازاد یا ماشین‌آلات از یک سایت به سایت دیگر
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 font-bold rounded-xl flex items-center gap-2 animate-in fade-in duration-200 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
              <span>{formError}</span>
            </div>
          )}
          {/* Source and Target Warehouses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label htmlFor="new-transfer-modal-1" className="font-bold text-slate-700 block mb-1">انبار کارگاه مبدأ *</label>
              <select id="new-transfer-modal-1"
                value={sourceWarehouseId}
                onChange={(e) => setSourceWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer font-medium"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatText(w.name)} ({w.projectName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-transfer-modal-2" className="font-bold text-slate-700 block mb-1">انبار کارگاه مقصد *</label>
              <select id="new-transfer-modal-2"
                value={targetWarehouseId}
                onChange={(e) => setTargetWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer font-medium"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatText(w.name)} ({w.projectName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transport & Driver Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="new-transfer-modal-3" className="font-bold text-slate-700 block mb-1">شماره بارنامه داخلی</label>
              <input id="new-transfer-modal-3"
                type="text"
                value={waybillNumber}
                onChange={(e) => setWaybillNumber(e.target.value)}
                placeholder="TRF-BL-99120"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="new-transfer-modal-4" className="font-bold text-slate-700 block mb-1">نام راننده</label>
              <input id="new-transfer-modal-4"
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="محمود علیزاده"
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label htmlFor="new-transfer-modal-5" className="font-bold text-slate-700 block mb-1">شماره پلاک خودرو</label>
              <input id="new-transfer-modal-5"
                type="text"
                value={truckPlate}
                onChange={(e) => setTruckPlate(e.target.value)}
                placeholder="۳۲ ب ۴۵۶ ایران ۱۱"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 tabular-nums"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-900">اقلام محموله انتقالی</h4>
            </div>

            <div className="border border-slate-200 rounded-xl table-scroll">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100 text-slate-600 text-sm">
                  <tr>
                    <th className="p-2">عنوان مصالح</th>
                    <th className="p-2">واحد</th>
                    <th className="p-2">تعداد / مقدار جابجایی</th>
                    <th className="p-2">نرخ واحد ({moneyUnitLabel()})</th>
                    <th className="p-2 text-left">ارزش کل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.rowKey}>
                      <td className="p-2">
                        <select
                          value={item.materialId}
                          onChange={(e) => handleMaterialChange(idx, e.target.value)}
                          className="w-full px-2 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                        >
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {formatText(m.name)}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2 text-slate-600 font-medium">{formatText(item.unit)}</td>

                      <td className="p-2">
                        <IntegerInput
                          value={item.quantity}
                          onValueChange={(v) => handleQtyChange(idx, v)}
                          className="w-28 px-2 py-1 rounded-lg border border-slate-200 tabular-nums text-center"
                        />
                      </td>

                      <td className="p-2 tabular-nums text-slate-700">
                        {formatMoney(item.unitCost, false)}
                      </td>

                      <td className="p-2 text-left tabular-nums font-bold text-slate-900">
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
              className="btn btn-primary"
            >
              <Truck className="w-4 h-4" />
              <span>صدور حواله انتقال و بارگیری</span>
            </button>
          </div>
        </form>
      </Dialog>
  );
};
