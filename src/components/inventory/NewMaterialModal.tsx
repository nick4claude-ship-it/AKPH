/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  MaterialItem,
  MaterialCategory,
  UserProfile,
} from '../../types';
import { X, Package, Plus } from 'lucide-react';
import { Dialog } from '../../ui/Dialog';
import { moneyUnitLabel } from '../../utils/money';
import { IntegerInput, MoneyInput } from '../../ui/NumberInput';
import type { NewMaterialInput } from '../../store/recordWorkflows';

interface NewMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  /** Adds the item through the workflow (code and zero stock are set there). */
  onSubmitMaterial: (input: NewMaterialInput) => { ok: boolean; message: string };
}

const CATEGORIES: MaterialCategory[] = [
  'آهن‌آلات و میلگرد',
  'سیمان، بتن و فرآورده‌های بتنی',
  'مصالح سفت‌کاری و بنایی',
  'تأسیسات مکانیکی و لوله‌کشی',
  'تأسیسات الکتریکی و کابل',
  'عایق، رنگ و شیمیایی ساختمان',
  'ابزارآلات و تجهیزات قالب‌بندی',
  'تجهیز کارگاه و HSE',
];

export const NewMaterialModal: React.FC<NewMaterialModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubmitMaterial,
}) => {
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [category, setCategory] = useState<MaterialCategory>('آهن‌آلات و میلگرد');
  const [unit, setUnit] = useState('کیلوگرم');
  const [specifications, setSpecifications] = useState('');
  const [standardGrade, setStandardGrade] = useState('');
  const [reorderLevel, setReorderLevel] = useState<number>(0);
  const [minSafetyStock, setMinSafetyStock] = useState<number>(0);
  const [maxCapacity, setMaxCapacity] = useState<number>(0);
  const [storageLocationBin, setStorageLocationBin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // The code is issued by the workflow; stock and its cost enter only through goods receipts.
    const result = onSubmitMaterial({ name, category, unit, specifications, standardGrade, reorderLevel, minSafetyStock, maxCapacity, storageLocationBin });
    if (!result.ok) return setFormError(result.message);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="تعریف کدینگ متریال و مصالح جدید در انبار" overlayClassName="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto" className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
      
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                تعریف کدینگ متریال و مصالح جدید در انبار
              </h3>
              <p className="text-xs text-slate-500">
                ثبت مشخصات فنی، تعیین نقطه سفارش و حداقل موجودی مجاز
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="new-material-modal-1" className="font-bold text-slate-700 block mb-1">نام کامل مصالح و برند کالا *</label>
              <input id="new-material-modal-1"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: میلگرد آجدار A3 نمره ۲۲ - فولاد خراسان"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="new-material-modal-2" className="font-bold text-slate-700 block mb-1">دسته‌بندی تخصصی *</label>
              <select id="new-material-modal-2"
                value={category}
                onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-material-modal-3" className="font-bold text-slate-700 block mb-1">واحد سنجش *</label>
              <input id="new-material-modal-3"
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="کیلوگرم، شاخه، کیسه، متر، تن..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="new-material-modal-4" className="font-bold text-slate-700 block mb-1">مشخصات فنی و کاربرد در WBS</label>
              <input id="new-material-modal-4"
                type="text"
                value={specifications}
                onChange={(e) => setSpecifications(e.target.value)}
                placeholder="ابعاد، استاندارد، مقاومت فشاری یا کششی..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label htmlFor="new-material-modal-5" className="font-bold text-slate-700 block mb-1">گرید استاندارد</label>
              <input id="new-material-modal-5"
                type="text"
                value={standardGrade}
                onChange={(e) => setStandardGrade(e.target.value)}
                placeholder="A3 - FeSt 400"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
              />
            </div>

            <div>
              <label htmlFor="new-material-modal-6" className="font-bold text-slate-700 block mb-1">محل استقرار / پالت (Bin)</label>
              <input id="new-material-modal-6"
                type="text"
                value={storageLocationBin}
                onChange={(e) => setStorageLocationBin(e.target.value)}
                placeholder="بارانداز میلگرد - ردیف B4"
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>
          </div>

          {/* Stock Levels */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <h4 className="font-bold text-slate-900">کنترل سطح موجودی و هشدارها</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="new-material-modal-7" className="text-[10px] text-slate-500 block mb-1">نقطه سفارش مجدد</label>
                <IntegerInput id="new-material-modal-7"
                  value={reorderLevel}
                  onValueChange={(v) => setReorderLevel(v)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-center"
                />
              </div>

              <div>
                <label htmlFor="new-material-modal-8" className="text-[10px] text-slate-500 block mb-1">حداقل موجودی ایمن</label>
                <IntegerInput id="new-material-modal-8"
                  value={minSafetyStock}
                  onValueChange={(v) => setMinSafetyStock(v)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-center text-rose-600"
                />
              </div>

              <p className="col-span-full text-[10px] text-slate-500">موجودی و بهای کالا فقط از طریق رسید انبار (از سفارش خرید) وارد می‌شود.</p>
            </div>
          </div>

          {formError && (
            <p className="text-xs text-rose-700 font-bold" role="alert">
              {formError}
            </p>
          )}

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
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت کالا در کاتالوگ انبار</span>
            </button>
          </div>
        </form>
      </Dialog>
  );
};
