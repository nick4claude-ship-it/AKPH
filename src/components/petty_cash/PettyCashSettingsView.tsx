import React, { useState } from 'react';
import {
  Sliders,
  PlusCircle,
  Trash2,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Bell,
  Save,
  Tag,
} from 'lucide-react';
import { PettyCashCategoryItem } from '../../types';
import { useStoreSlice } from '../../store/AppStore';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface PettyCashSettingsViewProps {
  categories: PettyCashCategoryItem[];
  onUpdateCategories: (categories: PettyCashCategoryItem[]) => void;
  /** Fund ceilings and approval chains are edited on the system settings page. */
  onOpenPolicySettings?: () => void;
}

export const PettyCashSettingsView: React.FC<PettyCashSettingsViewProps> = ({
  categories,
  onUpdateCategories,
  onOpenPolicySettings,
}) => {
  // Approval thresholds and the low-balance alert are the stored petty cash policy.
  const [policy, setPolicy] = useStoreSlice('pettyCashSettings');
  const [categoryList, setCategoryList] = useState<PettyCashCategoryItem[]>(categories);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id || '');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');

  // Thresholds configuration state
  const [thresholdLevel1, setThresholdLevel1] = useState<number>(policy.siteLevelMax);
  const [thresholdLevel2, setThresholdLevel2] = useState<number>(policy.projectLevelMax);
  const [lowBalancePercent, setLowBalancePercent] = useState<number>(policy.lowBalancePercent);
  const [isSaved, setIsSaved] = useState(false);

  const selectedCategoryObj = categoryList.find((c) => c.id === selectedCatId);

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCat: PettyCashCategoryItem = {
      id: `cat-${Date.now()}`,
      name: newCategoryName.trim(),
      subcategories: [],
    };
    const updated = [...categoryList, newCat];
    setCategoryList(updated);
    onUpdateCategories(updated);
    setNewCategoryName('');
  };

  const handleAddSubcategory = () => {
    if (!newSubcategoryName.trim() || !selectedCategoryObj) return;
    const updated = categoryList.map((cat) => {
      if (cat.id === selectedCategoryObj.id) {
        return {
          ...cat,
          subcategories: [...cat.subcategories, newSubcategoryName.trim()],
        };
      }
      return cat;
    });
    setCategoryList(updated);
    onUpdateCategories(updated);
    setNewSubcategoryName('');
  };

  const handleRemoveSubcategory = (catId: string, subName: string) => {
    const updated = categoryList.map((cat) => {
      if (cat.id === catId) {
        return {
          ...cat,
          subcategories: cat.subcategories.filter((s) => s !== subName),
        };
      }
      return cat;
    });
    setCategoryList(updated);
    onUpdateCategories(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900">
          تنظیمات ساختار و قواعد کاری تنخواه‌گردان
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          مدیریت دسته‌بندی‌های سلسله‌مراتبی، سطوح مبالغ تاییدات چندمرحله‌ای و هشدارهای کاهش موجودی
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Category Hierarchy (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">دسته‌بندی‌های هزینه و زیردسته‌ها</h3>
            </div>
            <span className="text-[11px] text-slate-500">
              {categoryList.length.toLocaleString('fa-IR')} دسته اصلی
            </span>
          </div>

          {/* Add Category Form */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="نام سرفصل هزینه جدید..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="text-xs px-3 py-2 border border-slate-300 rounded-lg flex-1 focus:ring-2 focus:ring-amber-500"
            />
            <button
              onClick={handleAddCategory}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-2xs flex items-center gap-1 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              افزودن سرفصل
            </button>
          </div>

          {/* Categories Grid and Subcategories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Categories list */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {categoryList.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`w-full p-2.5 text-right text-xs font-semibold flex items-center justify-between transition-colors ${
                    selectedCatId === cat.id
                      ? 'bg-amber-50 text-amber-900 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                    {cat.subcategories.length.toLocaleString('fa-IR')}
                  </span>
                </button>
              ))}
            </div>

            {/* Subcategories of selected category */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>زیردسته‌های {selectedCategoryObj?.name}:</span>
              </div>

              {/* Add subcategory */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="افزودن زیردسته..."
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white flex-1 focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={handleAddSubcategory}
                  className="p-1.5 bg-slate-900 text-white rounded hover:bg-slate-800"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Subcategories tags */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {selectedCategoryObj?.subcategories.map((sub) => (
                  <div
                    key={sub}
                    className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-xs"
                  >
                    <span className="text-slate-700">{sub}</span>
                    <button
                      onClick={() => handleRemoveSubcategory(selectedCategoryObj.id, sub)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Approval Thresholds & Rules (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Approval Rules Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                سقف مبالغ تاییدات چندمرحله‌ای (Approval Thresholds)
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  سقف مرحله اول: تایید سرپرست کارگاه + امور مالی (تومان)
                </label>
                <input
                  type="number"
                  step="5000000"
                  value={thresholdLevel1}
                  onChange={(e) => setThresholdLevel1(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  کمتر از {formatCurrency(thresholdLevel1)}: نیاز به تایید مدیر مالی
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  سقف مرحله دوم: تایید مدیر پروژه + مدیر امور مالی (تومان)
                </label>
                <input
                  type="number"
                  step="10000000"
                  value={thresholdLevel2}
                  onChange={(e) => setThresholdLevel2(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  بین {formatCurrency(thresholdLevel1)} تا {formatCurrency(thresholdLevel2)}: تایید مدیر پروژه و مدیر مالی
                </span>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 font-medium">
                مبالغ بیش از {formatCurrency(thresholdLevel2)}: نیازمند امضای نهایی مدیرعامل شرکت است.
              </div>
            </div>
          </div>

          {/* Notification Alerts Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <Bell className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">هشدارهای خودکار کسری تنخواه</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  درصد هشدار حداقل موجودی قابل مصرف نسبت به سقف تنخواه
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={lowBalancePercent}
                    onChange={(e) => setLowBalancePercent(Number(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="font-mono font-bold w-12 text-left tabular-nums">
                    {lowBalancePercent}٪
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  هرگاه مانده آزاد تنخواه به زیر {lowBalancePercent}٪ سقف برسد، وضعیت هشدار شارژ فعال می‌گردد.
                </span>
              </div>

              <div className="pt-2 space-y-2">
                {isSaved && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-bold flex items-center justify-center gap-1.5 animate-in fade-in duration-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>تنظیمات و سقف‌های مجاز با موفقیت ذخیره شد.</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onUpdateCategories(categoryList);
                    if (thresholdLevel1 < thresholdLevel2) {
                      setPolicy((p) => ({ ...p, siteLevelMax: thresholdLevel1, projectLevelMax: thresholdLevel2, lowBalancePercent }));
                    }
                    setIsSaved(true);
                    setTimeout(() => setIsSaved(false), 3500);
                  }}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-emerald-400" />
                  <span>ذخیره تنظیمات</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
