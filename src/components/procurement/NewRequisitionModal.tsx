import React, { useState } from 'react';
import { X, Plus, Trash2, AlertCircle, ShoppingCart, Check } from 'lucide-react';
import { Project, ProcurementCategory, RequisitionPriority } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { formatMoney, moneyUnitLabel, formatInt } from '../../utils/money';
import { IntegerInput, MoneyInput } from '../../ui/NumberInput';
import { useCurrentUser } from '../../store/session';
import { blankRequisitionLine, requisitionEstimate, type RequisitionFormInput, type RequisitionLineInput } from '../../store/views/procurement';
import { Money } from '../common/Money';
import { formatText } from '../../utils/formatters';

interface NewRequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onAddRequisition: (form: RequisitionFormInput) => { ok: boolean; message: string };
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

type DraftItem = RequisitionLineInput;

export const NewRequisitionModal: React.FC<NewRequisitionModalProps> = ({
  isOpen,
  onClose,
  projects,
  onAddRequisition,
}) => {
  const currentUser = useCurrentUser();
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [priority, setPriority] = useState<RequisitionPriority>('عادی');
  const [costCenter, setCostCenter] = useState('');
  const [justification, setJustification] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>(() => [blankRequisitionLine()]);

  if (!isOpen) return null;

  const handleAddItem = () => setItems((prev) => [...prev, blankRequisitionLine()]);

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = <K extends keyof DraftItem>(id: string, field: K, value: DraftItem[K]) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };

  const totalAmount = requisitionEstimate(items);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // The requester is the signed-in user; the workflow numbers the request and checks the lines.
    const result = onAddRequisition({ projectId, priority, costCenter, justification, items });
    if (!result.ok) return setFormError(result.message);
    setFormError(null);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="ثبت تقاضای خرید مصالح و تجهیزات (PR)" overlayClassName="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
      
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">ثبت تقاضای خرید مصالح و تجهیزات</h3>
              <p className="text-xs text-slate-500">ارسال مستقیم از کارگاه به واحد تدارکات و دفتر فنی مرکزی</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-sm">
          {/* Project & Priority Meta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="new-requisition-modal-1" className="block font-bold text-slate-700 mb-1">پروژه متقاضی:</label>
              <select id="new-requisition-modal-1"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{formatText(p.name)} ({p.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-requisition-modal-2" className="block font-bold text-slate-700 mb-1">سطح فوریت سفارش:</label>
              <select id="new-requisition-modal-2"
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequisitionPriority)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
              >
                <option value="فوری کارگاهی (حیاتی)">🚨 فوری کارگاهی (حیاتی - توقف کارگاه)</option>
                <option value="بالا">⚡ بالا (اولویت اول تدارکات)</option>
                <option value="عادی">🟢 عادی</option>
                <option value="دوره‌ای برنامه‌ریزی‌شده">📅 دوره‌ای برنامه‌ریزی‌شده</option>
              </select>
            </div>

            <div>
              <label htmlFor="new-requisition-modal-3" className="block font-bold text-slate-700 mb-1">کد ساختار شکست / مرکز هزینه:</label>
              <input id="new-requisition-modal-3"
                type="text"
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                placeholder="مثلاً سازه و بتن‌ریزی فاز ۲"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-requisition-modal-4" className="block font-bold text-slate-700 mb-1">نام درخواست‌کننده:</label>
              <input id="new-requisition-modal-4"
                type="text"
                value={currentUser.name}
                readOnly
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
            <div>
              <label htmlFor="new-requisition-modal-5" className="block font-bold text-slate-700 mb-1">سمت در کارگاه:</label>
              <input id="new-requisition-modal-5"
                type="text"
                value={currentUser.role}
                readOnly
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-sm">اقلام درخواستی ({formatInt(items.length)} ردیف):</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
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
                        className="text-rose-700 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-2">
                      <label htmlFor="new-requisition-modal-6" className="block text-xs text-slate-600 mb-1">نام دقیق کالا / متریال:</label>
                      <input id="new-requisition-modal-6"
                        type="text"
                        value={item.materialName}
                        onChange={(e) => handleUpdateItem(item.id, 'materialName', e.target.value)}
                        placeholder="مثلاً لوله مانیسمان رده ۴۰ سایز ۴ اینچ"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-requisition-modal-7" className="block text-xs text-slate-600 mb-1">رسته کالا:</label>
                      <select id="new-requisition-modal-7"
                        value={item.category}
                        onChange={(e) => handleUpdateItem(item.id, 'category', e.target.value as ProcurementCategory)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label htmlFor="new-requisition-modal-8" className="block text-xs text-slate-600 mb-1">مقدار درخواستی:</label>
                      <IntegerInput id="new-requisition-modal-8"
                        value={item.requestedQty}
                        onValueChange={(v) => handleUpdateItem(item.id, 'requestedQty', v)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm tabular-nums font-bold focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-requisition-modal-9" className="block text-xs text-slate-600 mb-1">واحد سنجش:</label>
                      <input id="new-requisition-modal-9"
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                        placeholder="کیلوگرم، شاخه، متر"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-requisition-modal-10" className="block text-xs text-slate-600 mb-1">برآورد نرخ فی ({moneyUnitLabel()}):</label>
                      <MoneyInput id="new-requisition-modal-10"
                        value={item.estimatedUnitPrice}
                        onValueChange={(v) => handleUpdateItem(item.id, 'estimatedUnitPrice', v)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm tabular-nums focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-requisition-modal-11" className="block text-xs text-slate-600 mb-1">تاریخ نیاز پای کار:</label>
                      <input id="new-requisition-modal-11"
                        type="text"
                        value={item.requiredDeliveryDate}
                        onChange={(e) => handleUpdateItem(item.id, 'requiredDeliveryDate', e.target.value)}
                        placeholder="۱۴۰۳/۰۷/۱۵"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="new-requisition-modal-12" className="block text-xs text-slate-600 mb-1">مشخصات فنی و استاندارد مورد نیاز:</label>
                    <input id="new-requisition-modal-12"
                      type="text"
                      value={item.specification}
                      onChange={(e) => handleUpdateItem(item.id, 'specification', e.target.value)}
                      placeholder="برند، آلیاژ، رده ضخامت، تاییدیه مهندس ناظر"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Justification Note */}
          <div>
            <label htmlFor="new-requisition-modal-13" className="block font-bold text-slate-700 mb-1">دلیل و توجیه نیاز به خرید:</label>
            <textarea id="new-requisition-modal-13"
              rows={2}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="توضیح دهید چرا این اقلام در این مقطع زمانی ضروری است و پیامد عدم خرید آن چیست..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          {formError && (
            <p className="text-sm text-rose-700 font-bold" role="alert">
              {formError}
            </p>
          )}

          {/* Total Bar */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
            <span className="font-bold text-indigo-900">مجموع برآورد تقریبی تقاضای خرید:</span>
            <span className="font-bold text-indigo-800 text-sm tabular-nums">
              <Money rial={totalAmount} />
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              <Check className="w-4 h-4" />
              <span>ثبت و ارسال به واحد تدارکات</span>
            </button>
          </div>
        </form>
      </Dialog>
  );
};
