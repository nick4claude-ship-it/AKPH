import React, { useState } from 'react';
import { X, Plus, Trash2, AlertCircle, ShoppingCart, Check } from 'lucide-react';
import { Project, ProcurementCategory, RequisitionPriority, PurchaseRequisition } from '../../types';

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

export const NewRequisitionModal: React.FC<NewRequisitionModalProps> = ({
  isOpen,
  onClose,
  projects,
  onAddRequisition,
}) => {
  const [projectId, setProjectId] = useState(projects[0]?.id || 'prj-101');
  const [priority, setPriority] = useState<RequisitionPriority>('بالا');
  const [wbsCode, setWbsCode] = useState('WBS-1.2.4');
  const [costCenter, setCostCenter] = useState('اسکلت و سقف');
  const [requesterName, setRequesterName] = useState('مهندس ناظر کارگاه');
  const [requesterRole, setRequesterRole] = useState('سرپرست کارگاه');
  const [justification, setJustification] = useState('');

  // Item form states
  const [items, setItems] = useState<Array<{
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
  }>>([
    {
      id: 'item-1',
      materialCode: 'MAT-STEEL-001',
      materialName: 'میلگرد آجدار A3 سایز ۲۰ شاخه ۱۲ متری',
      specification: 'تولید استاندارد با سرتیفیکیت کشش و خمش',
      category: 'آهن‌آلات و مقاطع فولادی',
      requestedQty: 25000,
      unit: 'کیلوگرم',
      estimatedUnitPrice: 28500,
      requiredDeliveryDate: '۱۴۰۳/۰۷/۱۵',
      suggestedVendors: 'ذوب‌آهن اصفهان، فولاد کویر',
    },
  ]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        materialCode: 'MAT-NEW',
        materialName: '',
        specification: '',
        category: 'آهن‌آلات و مقاطع فولادی',
        requestedQty: 100,
        unit: 'شاخه',
        estimatedUnitPrice: 500000,
        requiredDeliveryDate: '۱۴۰۳/۰۷/۲۰',
        suggestedVendors: '',
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, field: string, value: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const totalAmount = items.reduce(
    (acc, it) => acc + (it.requestedQty || 0) * (it.estimatedUnitPrice || 0),
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProj = projects.find((p) => p.id === projectId);
    const prNumber = `PR-1403-0${Math.floor(Math.random() * 50) + 90}`;

    const newReq: PurchaseRequisition = {
      id: `pr-${Date.now()}`,
      requisitionNumber: prNumber,
      date: '۱۴۰۳/۰۷/۰۳',
      projectId,
      projectName: selectedProj ? selectedProj.name : 'پروژه عمومی',
      wbsCode,
      costCenter,
      priority,
      status: 'پیش‌نویس کارگاه',
      requesterName,
      requesterRole,
      justification: justification || 'تقاضای خرید مصالح بر اساس پیشرفت فیزیکی کارگاه و نیاز مبرم خط تولید.',
      totalEstimatedAmount: totalAmount,
      approvals: {
        siteSupervisor: { approved: true, date: '۱۴۰۳/۰۷/۰۳', signedBy: requesterName },
      },
      items: items.map((it) => ({
        id: it.id,
        materialCode: it.materialCode || 'MAT-GEN',
        materialName: it.materialName || 'مصالح ساختمانی',
        specification: it.specification,
        category: it.category,
        requestedQty: Number(it.requestedQty) || 0,
        approvedQty: Number(it.requestedQty) || 0,
        unit: it.unit,
        estimatedUnitPrice: Number(it.estimatedUnitPrice) || 0,
        estimatedTotalPrice: (Number(it.requestedQty) || 0) * (Number(it.estimatedUnitPrice) || 0),
        requiredDeliveryDate: it.requiredDeliveryDate,
        suggestedVendors: it.suggestedVendors ? [it.suggestedVendors] : [],
      })),
    };

    onAddRequisition(newReq);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
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
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">سمت در کارگاه:</label>
              <input
                type="text"
                value={requesterRole}
                onChange={(e) => setRequesterRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                required
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
                      <input
                        type="number"
                        value={item.requestedQty}
                        onChange={(e) => handleUpdateItem(item.id, 'requestedQty', Number(e.target.value))}
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
                      <label className="block text-[11px] text-slate-600 mb-1">برآورد نرخ فی (تومان):</label>
                      <input
                        type="number"
                        value={item.estimatedUnitPrice}
                        onChange={(e) => handleUpdateItem(item.id, 'estimatedUnitPrice', Number(e.target.value))}
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

          {/* Total Bar */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
            <span className="font-bold text-indigo-900">مجموع برآورد تقریبی تقاضای خرید:</span>
            <span className="font-black text-indigo-800 text-sm font-mono">
              {totalAmount.toLocaleString('fa-IR')} تومان
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
      </div>
    </div>
  );
};
