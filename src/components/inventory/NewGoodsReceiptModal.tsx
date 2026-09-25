/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { X, ArrowDownLeft, Truck, ShieldCheck } from 'lucide-react';
import { GoodsReceiptNote, MaterialItem, PurchaseOrder, Warehouse } from '../../types';
import type { ReceiveFromPOLine } from '../../store/workflows';
import { formatNumber } from '../../utils/formatters';
import { Dialog } from '../../ui/Dialog';
import { formatMoney } from '../../utils/money';

interface NewGoodsReceiptModalProps {
  onClose: () => void;
  purchaseOrders: PurchaseOrder[];
  warehouses: Warehouse[];
  materials: MaterialItem[];
  onSubmit: (input: {
    poId: string;
    warehouseId: string;
    waybillNumber: string;
    truckPlateNumber: string;
    driverName: string;
    driverPhone: string;
    qcApprovalStatus: GoodsReceiptNote['qcApprovalStatus'];
    lines: ReceiveFromPOLine[];
  }) => { ok: boolean; message: string };
}

const OPEN_PO_STATUSES = ['صادر شده و ابلاغ به فروشنده', 'در حال ساخت/بارگیری', 'در مسیر حمل به کارگاه', 'تحویل جزئی در انبار'];

/** Best catalog match for a purchase-order line: same code, otherwise the first name token in common. */
function matchMaterial(materials: MaterialItem[], code: string, name: string): string {
  const byCode = materials.find((m) => m.code === code);
  if (byCode) return byCode.id;
  const words = name.split(/\s+/).filter((w) => w.length > 2);
  return materials.find((m) => words.some((w) => m.name.includes(w)))?.id || '';
}

/** رسید انبار فقط از سفارش خرید ساخته می‌شود: اقلام، قیمت و تأمین‌کننده از سفارش خوانده می‌شود. */
export const NewGoodsReceiptModal: React.FC<NewGoodsReceiptModalProps> = ({ onClose, purchaseOrders, warehouses, materials, onSubmit }) => {
  const openOrders = purchaseOrders.filter((p) => OPEN_PO_STATUSES.includes(p.status) && p.items.some((i) => i.receivedQty < i.orderedQty));
  const [poId, setPoId] = useState(openOrders[0]?.id || '');
  const po = openOrders.find((p) => p.id === poId);
  const projectWarehouses = useMemo(
    () => (po ? warehouses.filter((w) => w.projectId === po.projectId || w.type === 'مرکزی') : warehouses),
    [po, warehouses]
  );
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState<Record<string, { materialId: string; delivered: string; rejected: string }>>({});
  const [waybillNumber, setWaybill] = useState('');
  const [truckPlateNumber, setPlate] = useState('');
  const [driverName, setDriver] = useState('');
  const [driverPhone, setPhone] = useState('');
  const [qc, setQc] = useState<GoodsReceiptNote['qcApprovalStatus']>('تأیید کامل');
  const [error, setError] = useState<string | null>(null);

  const line = (id: string, code: string, name: string, remaining: number) =>
    lines[id] || { materialId: matchMaterial(materials, code, name), delivered: String(remaining), rejected: '0' };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return setError('سفارش خرید باز انتخاب نشده است.');
    const payload = po.items
      .filter((i) => i.receivedQty < i.orderedQty)
      .map((i) => {
        const l = line(i.id, i.materialCode, i.materialName, i.orderedQty - i.receivedQty);
        return { poItemId: i.id, materialId: l.materialId, deliveredQty: Number(l.delivered) || 0, rejectedQty: Number(l.rejected) || 0 };
      })
      .filter((l) => l.deliveredQty > 0);
    if (payload.some((l) => !l.materialId)) return setError('برای هر ردیف، کالای متناظر در کاتالوگ انبار را انتخاب کنید.');
    const result = onSubmit({ poId: po.id, warehouseId, waybillNumber, truckPlateNumber, driverName, driverPhone, qcApprovalStatus: qc, lines: payload });
    if (!result.ok) return setError(result.message);
    onClose();
  };

  return (
    <Dialog as="form" onClose={onClose} label="رسید انبار از سفارش خرید (GRN)" overlayClassName="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto" className="bg-white rounded-2xl w-full max-w-4xl text-xs overflow-hidden my-auto" onSubmit={submit}>
      
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> رسید انبار از سفارش خرید (GRN)
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {openOrders.length === 0 ? (
            <p className="text-slate-500">سفارش خرید باز (صادرشده و تحویل‌نشده) وجود ندارد. ابتدا در ماژول خرید سفارش صادر کنید.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-600">سفارش خرید</span>
                  <select
                    value={poId}
                    onChange={(e) => {
                      setPoId(e.target.value);
                      setLines({});
                      setWarehouseId('');
                    }}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  >
                    {openOrders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.poNumber} · {p.supplierName} · {p.projectName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600">انبار مقصد</span>
                  <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className="w-full p-2 rounded-lg border border-slate-300">
                    <option value="">— انتخاب انبار —</option>
                    {projectWarehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.type})
                      </option>
                    ))}
                  </select>
                  {po && <span className="text-[10px] text-slate-400">مقصد در سفارش: {po.destinationWarehouse}</span>}
                </label>
              </div>

              {po && (
                <table className="w-full text-right border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 text-slate-500 text-[11px]">
                    <tr>
                      <th className="p-2">قلم سفارش</th>
                      <th className="p-2 text-left">مانده سفارش</th>
                      <th className="p-2">کالای کاتالوگ</th>
                      <th className="p-2">تحویلی</th>
                      <th className="p-2">مردودی</th>
                      <th className="p-2 text-left">فی (از سفارش)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {po.items
                      .filter((i) => i.receivedQty < i.orderedQty)
                      .map((i) => {
                        const remaining = i.orderedQty - i.receivedQty;
                        const l = line(i.id, i.materialCode, i.materialName, remaining);
                        const set = (patch: Partial<typeof l>) => setLines((prev) => ({ ...prev, [i.id]: { ...l, ...patch } }));
                        return (
                          <tr key={i.id}>
                            <td className="p-2">
                              <div className="font-bold">{i.materialName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{i.materialCode}</div>
                            </td>
                            <td className="p-2 text-left font-mono">
                              {formatNumber(remaining)} {i.unit}
                            </td>
                            <td className="p-2">
                              <select value={l.materialId} onChange={(e) => set({ materialId: e.target.value })} className="w-full p-1.5 rounded border border-slate-300">
                                <option value="">— انتخاب —</option>
                                {materials.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input value={l.delivered} onChange={(e) => set({ delivered: e.target.value.replace(/[^\d.]/g, '') })} className="w-24 p-1.5 rounded border border-slate-300 font-mono" />
                            </td>
                            <td className="p-2">
                              <input value={l.rejected} onChange={(e) => set({ rejected: e.target.value.replace(/[^\d.]/g, '') })} className="w-20 p-1.5 rounded border border-slate-300 font-mono" />
                            </td>
                            <td className="p-2 text-left font-mono">{formatMoney(i.unitPrice, false)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <label className="space-y-1 col-span-2 sm:col-span-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Truck className="w-3 h-3" /> بارنامه
                  </span>
                  <input value={waybillNumber} onChange={(e) => setWaybill(e.target.value)} required className="w-full p-2 rounded-lg border border-slate-300" />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600">پلاک</span>
                  <input value={truckPlateNumber} onChange={(e) => setPlate(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300" />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600">راننده</span>
                  <input value={driverName} onChange={(e) => setDriver(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300" />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600">تلفن راننده</span>
                  <input value={driverPhone} onChange={(e) => setPhone(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300" />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> کنترل کیفیت
                  </span>
                  <select value={qc} onChange={(e) => setQc(e.target.value as GoodsReceiptNote['qcApprovalStatus'])} className="w-full p-2 rounded-lg border border-slate-300">
                    <option value="تأیید کامل">تأیید کامل</option>
                    <option value="تأیید مشروط">تأیید مشروط</option>
                    <option value="مردود">مردود</option>
                  </select>
                </label>
              </div>
            </>
          )}
          {error && <p className="text-rose-600 font-bold">{error}</p>}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 cursor-pointer">
            انصراف
          </button>
          <button type="submit" disabled={!po} className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-40 cursor-pointer">
            ثبت رسید و ورود به انبار
          </button>
        </div>
      </Dialog>
  );
};
