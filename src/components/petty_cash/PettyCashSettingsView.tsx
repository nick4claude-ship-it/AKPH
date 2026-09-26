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
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { newPettyCategory } from '../../store/views/pettyCash';
import { formatCurrency, formatNumber, formatDecimal, formatText } from '../../utils/formatters';
import { IntegerInput, MoneyInput } from '../../ui/NumberInput';
import { moneyUnitLabel } from '../../utils/money';
import { Money } from '../common/Money';

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
  const policy = useAppState().pettyCashSettings;
  const wf = useWorkflows();
  const [saveError, setSaveError] = useState<string | null>(null);
  const chain = (level: keyof typeof policy.approvalChains) => policy.approvalChains[level].join(' + ');
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
    const updated = [...categoryList, newPettyCategory(newCategoryName)];
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
        <p className="text-xs text-slate-500 mt-1">
          مدیریت دسته‌بندی‌های سلسله‌مراتبی، سطوح مبالغ تاییدات چندمرحله‌ای و هشدارهای کاهش موجودی
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Category Hierarchy (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-700" />
              <h3 className="text-base font-bold text-slate-900">دسته‌بندی‌های هزینه و زیردسته‌ها</h3>
            </div>
            <span className="text-xs text-slate-500">
              {formatDecimal(categoryList.length)} دسته اصلی
            </span>
          </div>

          {/* Add Category Form */}
          <div className="flex items-center gap-2">
            <input aria-label="نام سرفصل هزینه جدید"
              type="text"
              placeholder="نام سرفصل هزینه جدید..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="text-sm px-3 py-2 border border-slate-300 rounded-lg flex-1 focus:ring-2 focus:ring-amber-500"
            />
            <button
              onClick={handleAddCategory}
              className="btn btn-primary shrink-0"
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
                  className={`w-full p-2 text-right text-sm font-medium flex items-center justify-between transition-colors ${
                    selectedCatId === cat.id
                      ? 'bg-amber-50 text-amber-900 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{formatText(cat.name)}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                    {formatDecimal(cat.subcategories.length)}
                  </span>
                </button>
              ))}
            </div>

            {/* Subcategories of selected category */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
              <div className="text-sm font-bold text-slate-800 flex items-center justify-between">
                <span>زیردسته‌های {formatText(selectedCategoryObj?.name)}:</span>
              </div>

              {/* Add subcategory */}
              <div className="flex items-center gap-2">
                <input aria-label="افزودن زیردسته"
                  type="text"
                  placeholder="افزودن زیردسته..."
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  className="text-xs px-2 py-2 border border-slate-300 rounded bg-white flex-1 focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={handleAddSubcategory}
                  className="btn btn-secondary"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Subcategories tags */}
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {selectedCategoryObj?.subcategories.map((sub) => (
                  <div
                    key={sub}
                    className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-sm"
                  >
                    <span className="text-slate-700">{sub}</span>
                    <button
                      onClick={() => handleRemoveSubcategory(selectedCategoryObj.id, sub)}
                      className="text-slate-500 hover:text-rose-600"
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <h3 className="text-base font-bold text-slate-900">
                سقف مبالغ تاییدات چندمرحله‌ای
              </h3>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label htmlFor="petty-cash-settings-view-1" className="block text-slate-700 font-medium mb-1">
                  سقف مرحله اول: تأیید {chain('site_manager_and_finance')} ({moneyUnitLabel()})
                </label>
                <MoneyInput id="petty-cash-settings-view-1"
                  value={thresholdLevel1}
                  onValueChange={(v) => setThresholdLevel1(v)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums font-bold"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  تا <Money rial={thresholdLevel1} />: تأیید {chain('site_manager_and_finance')}
                </span>
              </div>

              <div>
                <label htmlFor="petty-cash-settings-view-2" className="block text-slate-700 font-medium mb-1">
                  سقف مرحله دوم: تأیید {chain('project_and_finance')} ({moneyUnitLabel()})
                </label>
                <MoneyInput id="petty-cash-settings-view-2"
                  value={thresholdLevel2}
                  onValueChange={(v) => setThresholdLevel2(v)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums font-bold"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  بین <Money rial={thresholdLevel1} /> تا <Money rial={thresholdLevel2} />: تأیید {chain('project_and_finance')}
                </span>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 font-medium">
                مبالغ بیش از <Money rial={thresholdLevel2} />: تأیید {chain('ceo_full')}.
              </div>
            </div>
          </div>

          {/* Notification Alerts Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <Bell className="w-5 h-5 text-amber-700" />
              <h3 className="text-base font-bold text-slate-900">هشدارهای خودکار کسری تنخواه</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label htmlFor="petty-cash-settings-view-3" className="block text-slate-700 font-medium mb-1">
                  درصد هشدار حداقل موجودی قابل مصرف نسبت به سقف تنخواه
                </label>
                <div className="flex items-center gap-2">
                  <input id="petty-cash-settings-view-3"
                    type="range"
                    min="10"
                    max="50"
                    value={lowBalancePercent}
                    onChange={(e) => setLowBalancePercent(Number(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <span className=" font-bold w-12 text-left tabular-nums">
                    {formatDecimal(lowBalancePercent)}٪
                  </span>
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  هرگاه مانده آزاد تنخواه به زیر {formatDecimal(lowBalancePercent)}٪ سقف برسد، وضعیت هشدار شارژ فعال می‌گردد.
                </span>
              </div>

              <div className="pt-2 space-y-2">
                {saveError && (
                  <p className="text-sm text-rose-700 font-bold" role="alert">
                    {saveError}
                  </p>
                )}
                {isSaved && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 font-bold flex items-center justify-center gap-2 animate-in fade-in duration-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>تنظیمات و سقف‌های مجاز با موفقیت ذخیره شد.</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const result = wf.updatePettyCashSettings({
                      ...policy,
                      siteLevelMax: thresholdLevel1,
                      projectLevelMax: thresholdLevel2,
                      lowBalancePercent,
                    });
                    if (!result.ok) return setSaveError(result.message);
                    onUpdateCategories(categoryList);
                    setSaveError(null);
                    setIsSaved(true);
                    setTimeout(() => setIsSaved(false), 3500);
                  }}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
