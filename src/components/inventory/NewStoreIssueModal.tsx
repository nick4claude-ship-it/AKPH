/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  StoreIssueVoucher,
  StoreIssueItem,
  Warehouse,
  MaterialItem,
  Project,
  UserProfile,
} from '../../types';
import {
  X,
  ArrowUpRight,
  Plus,
  Trash2,
  FileSpreadsheet,
  Building,
  User,
  AlertTriangle,
} from 'lucide-react';
import { Dialog } from '../../ui/Dialog';
import { formatInt, formatMoney, moneyUnitLabel } from '../../utils/money';
import { IntegerInput } from '../../ui/NumberInput';
import { useSelector } from '../../store/AppStore';
import { formatDecimal, toPersianDigits, formatText } from '../../utils/formatters';
import {
  MATERIALS_COST_ACCOUNT,
  computeStoreIssueDraft,
  newIssueLine,
  type IssueLineInput,
  type StoreIssueFormInput,
} from '../../store/views/inventory';
import { Money } from '../common/Money';

interface NewStoreIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  materials: MaterialItem[];
  projects: Project[];
  currentUser: UserProfile;
  /** Issues (or reserves) through the workflow, which prices the lines and checks free stock. */
  onSubmitIssue: (form: StoreIssueFormInput) => { ok: boolean; message: string };
}

export const NewStoreIssueModal: React.FC<NewStoreIssueModalProps> = ({
  isOpen,
  onClose,
  warehouses,
  materials,
  projects,
  currentUser,
  onSubmitIssue,
}) => {
  const [warehouseId, setWarehouseId] = useState(warehouses[1]?.id || warehouses[0]?.id || '');
  const [costCenter, setCostCenter] = useState('سازه بتنی و اسکلت');
  const [wbsSection, setWbsSection] = useState('');
  const [subcontractorName, setSubcontractorName] = useState('');
  const [tradeType, setTradeType] = useState('آرماتوربندی و قالب‌بندی');
  const [isSubcontractorContra, setIsSubcontractorContra] = useState(true);
  const [subcontractorDeductionRef, setSubcontractorDeductionRef] = useState('کسر مصالح تحویلی در صورت‌وضعیت دوره جاری');
  const [receivedByCrewLeaderName, setReceivedByCrewLeaderName] = useState('');
  // Request mode reserves the stock; the issue is confirmed later from the voucher.
  const [reserveOnly, setReserveOnly] = useState(false);
  const [rows, setRows] = useState<IssueLineInput[]>(() => [newIssueLine(materials)]);
  const [formError, setFormError] = useState<string | null>(null);

  const form: StoreIssueFormInput = {
    warehouseId,
    costCenter,
    wbsSection,
    subcontractorName,
    tradeType,
    isSubcontractorContra,
    subcontractorDeductionRef,
    receivedByCrewLeaderName,
    reserveOnly,
    lines: rows,
  };
  // Lines priced at the weighted average, the free stock of each material and the first problem.
  const draft = useSelector((s) => computeStoreIssueDraft(s, form), [JSON.stringify(form)]);
  const items = draft.lines;
  const totalCost = draft.totalCost;
  const selectedWarehouse = draft.warehouse;

  const updateRow = (index: number, patch: Partial<IssueLineInput>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const handleMaterialChange = (index: number, matId: string) => updateRow(index, { materialId: matId });
  const handleQuantityChange = (index: number, qty: number) => updateRow(index, { qty });
  const addItemRow = () => {
    if (materials.length) setRows((prev) => [...prev, newIssueLine(materials)]);
  };
  const removeItemRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.error) return setFormError(draft.error);
    setFormError(null);
    const result = onSubmitIssue(form);
    if (!result.ok) return setFormError(result.message);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="صدور حواله خروج مصالح و مصرف کارگاهی (SIV)" overlayClassName="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto" className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
      
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                صدور حواله خروج مصالح و مصرف کارگاهی
              </h3>
              <p className="text-xs text-slate-500">
                تخصیص به WBS، تهاتر با صورت‌وضعیت پیمانکار جزء و ثبت در بهای تمام‌شده پروژه
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
          {/* Location & Cost Center */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="new-store-issue-modal-1" className="font-bold text-slate-700 block mb-1">انبار و کارگاه مبدأ *</label>
              <select id="new-store-issue-modal-1"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-slate-50 cursor-pointer"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatText(w.name)} ({w.projectName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-store-issue-modal-2" className="font-bold text-slate-700 block mb-1">مرکز هزینه پروژه *</label>
              <select id="new-store-issue-modal-2"
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-slate-50 cursor-pointer"
              >
                <option value="سازه بتنی و اسکلت">سازه بتنی و اسکلت فلزی</option>
                <option value="فونداسیون و پایدارسازی">فونداسیون، گودبرداری و نیلینگ</option>
                <option value="سفت‌کاری و دیوارچینی">سفت‌کاری و دیوارچینی</option>
                <option value="تأسیسات مکانیکی و پایپینگ">تأسیسات مکانیکی و پایپینگ</option>
                <option value="تأسیسات الکتریکی و روشنایی">تأسیسات الکتریکی و تابلوها</option>
                <option value="نازک‌کاری و نما">نازک‌کاری و نمای خارجی</option>
                <option value="تجهیز کارگاه و ایمنی HSE">تجهیز کارگاه و ایمنی HSE</option>
              </select>
            </div>

            <div>
              <label htmlFor="new-store-issue-modal-3" className="font-bold text-slate-700 block mb-1">محل دقیق مصرف در کارگاه *</label>
              <input id="new-store-issue-modal-3"
                type="text"
                required
                value={wbsSection}
                onChange={(e) => setWbsSection(e.target.value)}
                placeholder="مثلاً: طبقه ۸ - زون غربی، تیرهای اصلی"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Subcontractor Assignment & Contra */}
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-3">
            <h4 className="font-bold text-amber-950 flex items-center gap-2">
              <User className="w-4 h-4 text-amber-700" />
              تخصیص به پیمانکار جزء و تهاتر مصالح
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="new-store-issue-modal-4" className="text-xs text-slate-600 block mb-1">نام اکیپ پیمانکار جزء (اختیاری)</label>
                <input id="new-store-issue-modal-4"
                  type="text"
                  value={subcontractorName}
                  onChange={(e) => setSubcontractorName(e.target.value)}
                  placeholder="مثلاً: اکیپ آرماتوربندی کریم صفری"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label htmlFor="new-store-issue-modal-5" className="text-xs text-slate-600 block mb-1">رشته کاری پیمانکار</label>
                <input id="new-store-issue-modal-5"
                  type="text"
                  value={tradeType}
                  onChange={(e) => setTradeType(e.target.value)}
                  placeholder="آرماتوربندی، لوله‌کشی، جوشکاری..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label htmlFor="new-store-issue-modal-6" className="text-xs text-slate-600 block mb-1">نام سرپرست تحویل‌گیرنده</label>
                <input id="new-store-issue-modal-6"
                  type="text"
                  value={receivedByCrewLeaderName}
                  onChange={(e) => setReceivedByCrewLeaderName(e.target.value)}
                  placeholder="نام استادکار یا فورمن"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                />
              </div>
            </div>

            {/* Contra Checkbox */}
            {subcontractorName.trim() && (
              <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSubcontractorContra}
                    onChange={(e) => setIsSubcontractorContra(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-700 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="font-bold text-amber-950 text-sm">
                    تهاتر و کسر مبلغ این مصالح از صورت‌وضعیت پیمانکار جزء
                  </span>
                </label>

                {isSubcontractorContra && (
                  <div className="pr-6">
                    <input
                      type="text"
                      value={subcontractorDeductionRef}
                      onChange={(e) => setSubcontractorDeductionRef(e.target.value)}
                      placeholder="عنوان ردیف کسورات در صورت‌وضعیت پیمانکار"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-900">اقلام مصالح جهت خروج و مصرف</h4>
              <button
                type="button"
                onClick={addItemRow}
                className="btn btn-primary btn-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن ردیف کالا</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl table-scroll">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100 text-slate-600 text-sm">
                  <tr>
                    <th className="p-2">عنوان مصالح</th>
                    <th className="p-2">واحد</th>
                    <th className="p-2">مقدار حواله</th>
                    <th className="p-2">بهای تمام‌شده واحد ({moneyUnitLabel()})</th>
                    <th className="p-2 text-left">هزینه کل مصرف</th>
                    <th className="p-2 text-center">حذف</th>
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
                              {formatText(m.name)} (موجودی: {formatDecimal(m.currentStock)})
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2 font-medium text-slate-600">{formatText(item.unit)}</td>

                      <td className="p-2">
                        <IntegerInput
                          aria-label={`مقدار ${item.materialName}`}
                          value={item.qty}
                          onValueChange={(v) => handleQuantityChange(idx, v)}
                          className="w-24 px-2 py-1 rounded-lg border border-slate-200 tabular-nums text-center"
                        />
                        <span className="block text-xs text-slate-500 mt-1">آزاد: {formatInt(item.freeQty)}</span>
                      </td>

                      <td className="p-2 tabular-nums text-slate-700">
                        {formatMoney(item.unitCost, false)}
                      </td>

                      <td className="p-2 text-left tabular-nums font-bold text-slate-900">
                        {formatMoney(item.totalCost, false)}
                      </td>

                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length <= 1}
                          className="p-1 text-slate-500 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
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

          {/* Total Cost Bar */}
          <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
            <div>
              <span className="font-bold text-sm block">مجموع بهای تمام‌شده مصالح مصرفی حواله:</span>
              <span className="text-xs text-slate-500">سند اتوماتیک هزینه مستقیم پروژه (کد {toPersianDigits(MATERIALS_COST_ACCOUNT)})</span>
            </div>
            <span className="font-bold text-amber-400 tabular-nums text-base">
              <Money rial={totalCost} />
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

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={reserveOnly} onChange={(e) => setReserveOnly(e.target.checked)} />
              فقط رزرو کالا (خروج پس از تأیید)
            </label>
            <button
              type="submit"
              className="btn btn-primary"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{reserveOnly ? 'ثبت درخواست و رزرو کالا' : 'تأیید حواله و ثبت خروج از انبار'}</span>
            </button>
          </div>
        </form>
      </Dialog>
  );
};
