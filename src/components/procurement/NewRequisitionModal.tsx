import React, { useState } from 'react';
import { X, Plus, Trash2, AlertCircle, ShoppingCart, Check } from 'lucide-react';
import { Project, ProcurementCategory, RequisitionPriority, PurchaseRequisition } from '../../types';
import { Dialog } from '../common/Dialog';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { IntegerInput, MoneyInput } from '../common/NumberInput';
import { generateUUID, nextDocNumber } from '../../utils/ids';
import { getRelativePersianDate, toPersianDate } from '../../utils/date';
import { useAppState } from '../../store/AppStore';
import { useCurrentUser } from '../../store/session';

interface NewRequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onAddRequisition: (req: PurchaseRequisition) => void;
}

const CATEGORIES: ProcurementCategory[] = [
  'آهن‌آلات و مقاطع فولادی',
  'سیمان، بتن و فرآورده‌های بتنی',
  'تأسیسات مکانیکی و پایپینگ',
  'تأسیسات الکتریکی و تابلو برق',
  'تجهیزات قالب‌بندی و ماشین‌آلات',
  'عایق، رنگ و شیمی ساختمان',
  'نازک‌کاری و متریال دکوراتیو',
  'ایمنی کارگاه و HSE',
  'خدمات مهندسی و پیمانکاران دست‌دوم',
];

type DraftItem = {
  id: string;
  materialCode: string;
  materialName: string;
  specification: string;
  category: ProcurementCategory;
  requestedQty: number;
  unit: string;
  estimatedUnitPrice: number;
  requiredDeliveryDate: string;
  suggestedVendors?: string;
};

const emptyItem = (): DraftItem => ({
  id: generateUUID(),
  materialCode: '',
  materialName: '',
  specification: '',
  category: 'آهن‌آلات و مقاطع فولادی',
  requestedQty: 0,
  unit: 'کیلوگرم',
  estimatedUnitPrice: 0,
  requiredDeliveryDate: getRelativePersianDate(14),
  suggestedVendors: '',
});

export const NewRequisitionModal: React.FC<NewRequisitionModalProps> = ({
  isOpen,
  onClose,
  projects,
  onAddRequisition,
}) => {
  const currentUser = useCurrentUser();
  const existingNumbers = useAppState().purchaseRequisitions.map((r) => r.requisitionNumber);
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [priority, setPriority] = useState<RequisitionPriority>('عادی');
  const [costCenter, setCostCenter] = useState('');
  const [justification, setJustification] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>(() => [emptyItem()]);

  if (!isOpen) return null;

  const handleAddItem = () => setItems((prev) => [...prev, emptyItem()]);

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = <K extends keyof DraftItem>(id: string, field: K, value: DraftItem[K]) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };

  const totalAmount = items.reduce((acc, it) => acc + it.requestedQty * it.estimatedUnitPrice, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProj = projects.find((p) => p.id === projectId);
    if (!selectedProj) return setFormError('پروژه را انتخاب کنید.');
    if (items.some((it) => !it.materialName.trim())) return setFormError('نام کالای هر ردیف را وارد کنید.');
    if (items.some((it) => it.requestedQty <= 0)) return setFormError('مقدار هر ردیف باید بیش از صفر باشد.');
    setFormError(null);

    // The requester is the signed-in user; no approval is pre-filled (nobody approves their own request).
    const newReq: PurchaseRequisition = {
      id: generateUUID(),
      requisitionNumber: nextDocNumber(existingNumbers, 'PR'),
      date: toPersianDate(new Date()),
      projectId,
      projectName: selectedProj.name,
      wbsCode: costCenter.trim(),
      costCenter: costCenter.trim(),
      priority,
      status: 'پیش‌نویس کارگاه',
      requesterName: currentUser.name,
      requesterId: currentUser.id,
      requesterRole: currentUser.role,
      justification: justification.trim(),
      totalEstimatedAmount: totalAmount,
      approvals: {},
      items: items.map((it) => ({
        id: it.id,
        materialCode: it.materialCode,
        materialName: it.materialName.trim(),
        specification: it.specification,
        category: it.category,
        requestedQty: it.requestedQty,
        approvedQty: it.requestedQty,
        unit: it.unit,
        estimatedUnitPrice: it.estimatedUnitPrice,
        estimatedTotalPrice: it.requestedQty * it.estimatedUnitPrice,
        requiredDeliveryDate: it.requiredDeliveryDate,
        suggestedVendors: it.suggestedVendors ? [it.suggestedVendors] : [],
      })),
    };

    onAddRequisition(newReq);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="ثبت تقاضای خرید مصالح و تجهیزات (PR)" overlayClassName="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
      
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">ثبت تقاضای خرید مصالح و تجهیزات (PR)</h3>
              <p className="text-xs text-slate-500">ارسال مستقیم از کارگاه به واحد تدارکات و دفتر فنی مرکزی</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* Project & Priority Meta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">پروژه متقاضی:</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">سطح فوریت سفارش:</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequisitionPriority)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
              >
                <option value="فوری کارگاهی (حیاتی)">🚨 فوری کارگاهی (حیاتی - توقف کارگاه)</option>
                <option value="بالا">⚡ بالا (اولویت اول تدارکات)</option>
                <option value="عادی">🟢 عادی</option>
                <option value="دوره‌ای برنامه‌ریزی‌شده">📅 دوره‌ای برنامه‌ریزی‌شده</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">کد ساختار شکست (WBS) / مرکز هزینه:</label>
              <input
                type="text"
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                placeholder="مثلاً سازه و بتن‌ریزی فاز ۲"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">نام درخواست‌کننده:</label>
              <input
                type="text"
                value={currentUser.name}
                readOnly
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">سمت در کارگاه:</label>
              <input
                type="text"
                value={currentUser.role}
                readOnly
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-sm">اقلام درخواستی ({items.length} ردیف):</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن ردیف کالا</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-bold">ردیف #{index + 1}</span>
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] text-slate-600 mb-1">نام دقیق کالا / متریال:</label>
                      <input
                        type="text"
                        value={item.materialName}
                        onChange={(e) => handleUpdateItem(item.id, 'materialName', e.target.value)}
                        placeholder="مثلاً لوله مانیسمان رده ۴۰ سایز ۴ اینچ"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">رسته کالا:</label>
                      <select
                        value={item.category}
                        onChange={(e) => handleUpdateItem(item.id, 'category', e.target.value as ProcurementCategory)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">مقدار درخواستی:</label>
                      <IntegerInput
                        value={item.requestedQty}
                        onValueChange={(v) => handleUpdateItem(item.id, 'requestedQty', v)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">واحد سنجش:</label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                        placeholder="کیلوگرم، شاخه، متر"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">برآورد نرخ فی ({moneyUnitLabel()}):</label>
                      <MoneyInput
                        value={item.estimatedUnitPrice}
                        onValueChange={(v) => handleUpdateItem(item.id, 'estimatedUnitPrice', v)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">تاریخ نیاز پای کار:</label>
                      <input
                        type="text"
                        value={item.requiredDeliveryDate}
                        onChange={(e) => handleUpdateItem(item.id, 'requiredDeliveryDate', e.target.value)}
                        placeholder="۱۴۰۳/۰۷/۱۵"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">مشخصات فنی و استاندارد مورد نیاز:</label>
                    <input
                      type="text"
                      value={item.specification}
                      onChange={(e) => handleUpdateItem(item.id, 'specification', e.target.value)}
                      placeholder="برند، آلیاژ، رده ضخامت، تاییدیه مهندس ناظر"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Justification Note */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">دلیل و توجیه نیاز به خرید:</label>
            <textarea
              rows={2}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="توضیح دهید چرا این اقلام در این مقطع زمانی ضروری است و پیامد عدم خرید آن چیست..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          {formError && (
            <p className="text-xs text-rose-700 font-bold" role="alert">
              {formError}
            </p>
          )}

          {/* Total Bar */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
            <span className="font-bold text-indigo-900">مجموع برآورد تقریبی تقاضای خرید:</span>
            <span className="font-black text-indigo-800 text-sm font-mono">
              {formatMoney(totalAmount)}
            </span>
          </div>

          {/* Actions */}
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
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>ثبت و ارسال به واحد تدارکات</span>
            </button>
          </div>
        </form>
      </Dialog>
  );
};
