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
} from 'lucide-react';

interface NewStoreIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  materials: MaterialItem[];
  projects: Project[];
  currentUser: UserProfile;
  onSubmitIssue: (issue: StoreIssueVoucher) => void;
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
  if (!isOpen) return null;

  const [warehouseId, setWarehouseId] = useState(warehouses[1]?.id || warehouses[0]?.id || '');
  const [costCenter, setCostCenter] = useState('سازه بتنی و اسکلت');
  const [wbsSection, setWbsSection] = useState('');
  const [subcontractorName, setSubcontractorName] = useState('');
  const [tradeType, setTradeType] = useState('آرماتوربندی و قالب‌بندی');
  const [isSubcontractorContra, setIsSubcontractorContra] = useState(true);
  const [subcontractorDeductionRef, setSubcontractorDeductionRef] = useState('کسر مصالح تحویلی در صورت‌وضعیت دوره جاری');
  const [receivedByCrewLeaderName, setReceivedByCrewLeaderName] = useState('');

  // Items
  const [items, setItems] = useState<StoreIssueItem[]>([
    {
      materialId: materials[0]?.id || '',
      materialCode: materials[0]?.code || '',
      materialName: materials[0]?.name || '',
      unit: materials[0]?.unit || 'کیلوگرم',
      requestedQty: 500,
      issuedQty: 500,
      unitCost: materials[0]?.averageUnitPrice || 30000,
      totalCost: (materials[0]?.averageUnitPrice || 30000) * 500,
      remarks: '',
    },
  ]);

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);

  const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);

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
              totalCost: mat.averageUnitPrice * item.issuedQty,
            }
          : item
      )
    );
  };

  const handleQuantityChange = (index: number, qty: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              requestedQty: qty,
              issuedQty: qty,
              totalCost: qty * item.unitCost,
            }
          : item
      )
    );
  };

  const addItemRow = () => {
    const defaultMat = materials[0];
    if (!defaultMat) return;
    setItems((prev) => [
      ...prev,
      {
        materialId: defaultMat.id,
        materialCode: defaultMat.code,
        materialName: defaultMat.name,
        unit: defaultMat.unit,
        requestedQty: 50,
        issuedQty: 50,
        unitCost: defaultMat.averageUnitPrice,
        totalCost: defaultMat.averageUnitPrice * 50,
        remarks: '',
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wbsSection.trim()) {
      alert('لطفاً محل مصرف و فاز WBS را مشخص فرمایید.');
      return;
    }

    const randomNum = Math.floor(100 + Math.random() * 900);
    const newIssue: StoreIssueVoucher = {
      id: `siv-1403-${randomNum}`,
      issueNumber: `حواله خروج ۱۴۰۳/${randomNum}`,
      date: '۱۴۰۳/۰۷/۰۴',
      warehouseId,
      warehouseName: selectedWarehouse ? selectedWarehouse.name : 'انبار کارگاهی',
      projectId: selectedWarehouse?.projectId || 'prj-101',
      projectName: selectedWarehouse ? selectedWarehouse.projectName : 'پروژه جاری',
      costCenter,
      wbsSection: wbsSection.trim(),
      subcontractorId: subcontractorName ? `sub-${randomNum}` : undefined,
      subcontractorName: subcontractorName.trim() || undefined,
      tradeType: subcontractorName ? tradeType : undefined,
      isSubcontractorContra: subcontractorName ? isSubcontractorContra : false,
      subcontractorStatementDeductionRef: subcontractorName && isSubcontractorContra ? subcontractorDeductionRef : undefined,
      applicantName: currentUser.name,
      approvedByManagerName: 'مهندس محمدرضا رادمنش (مدیرعامل)',
      dispatchedByKeeperName: selectedWarehouse ? selectedWarehouse.keeperName : 'انباردار کارگاه',
      receivedByCrewLeaderName: receivedByCrewLeaderName.trim() || 'سرپرست اکیپ اجرایی',
      items,
      totalCost,
      status: 'خروج قطعی از انبار',
      accountingJournalEntryId: `JV-ISSUE-1403-${randomNum}`,
    };

    onSubmitIssue(newIssue);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                صدور حواله خروج مصالح و مصرف کارگاهی (SIV)
              </h3>
              <p className="text-xs text-slate-500">
                تخصیص به WBS، تهاتر با صورت‌وضعیت پیمانکار جزء و ثبت در بهای تمام‌شده پروژه
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
          {/* Location & Cost Center */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">انبار و کارگاه مبدأ *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-slate-50 cursor-pointer"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.projectName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">مرکز هزینه پروژه *</label>
              <select
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
              <label className="font-bold text-slate-700 block mb-1">محل دقیق مصرف در کارگاه (WBS) *</label>
              <input
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
            <h4 className="font-bold text-amber-950 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-600" />
              تخصیص به پیمانکار جزء و تهاتر مصالح
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">نام اکیپ پیمانکار جزء (اختیاری)</label>
                <input
                  type="text"
                  value={subcontractorName}
                  onChange={(e) => setSubcontractorName(e.target.value)}
                  placeholder="مثلاً: اکیپ آرماتوربندی کریم صفری"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 block mb-1">رشته کاری پیمانکار</label>
                <input
                  type="text"
                  value={tradeType}
                  onChange={(e) => setTradeType(e.target.value)}
                  placeholder="آرماتوربندی، لوله‌کشی، جوشکاری..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 block mb-1">نام سرپرست تحویل‌گیرنده</label>
                <input
                  type="text"
                  value={receivedByCrewLeaderName}
                  onChange={(e) => setReceivedByCrewLeaderName(e.target.value)}
                  placeholder="نام استادکار یا فورمن"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
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
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="font-bold text-amber-950 text-xs">
                    تهاتر و کسر مبلغ این مصالح از صورت‌وضعیت پیمانکار جزء (Contra Deductions)
                  </span>
                </label>

                {isSubcontractorContra && (
                  <div className="pr-6">
                    <input
                      type="text"
                      value={subcontractorDeductionRef}
                      onChange={(e) => setSubcontractorDeductionRef(e.target.value)}
                      placeholder="عنوان ردیف کسورات در صورت‌وضعیت پیمانکار"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px]"
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
                className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن ردیف کالا</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-600 text-[11px]">
                  <tr>
                    <th className="p-2.5">عنوان مصالح</th>
                    <th className="p-2.5">واحد</th>
                    <th className="p-2.5">مقدار حواله</th>
                    <th className="p-2.5">بهای تمام‌شده واحد (تومان)</th>
                    <th className="p-2.5 text-left">هزینه کل مصرف</th>
                    <th className="p-2.5 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5">
                        <select
                          value={item.materialId}
                          onChange={(e) => handleMaterialChange(idx, e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                        >
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} (موجودی: {m.currentStock.toLocaleString('fa-IR')})
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2.5 font-medium text-slate-600">{item.unit}</td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          min={1}
                          value={item.issuedQty}
                          onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                          className="w-24 px-2 py-1 rounded-lg border border-slate-200 font-mono text-center"
                        />
                      </td>

                      <td className="p-2.5 font-mono text-slate-700">
                        {item.unitCost.toLocaleString('fa-IR')}
                      </td>

                      <td className="p-2.5 text-left font-mono font-bold text-slate-900">
                        {item.totalCost.toLocaleString('fa-IR')}
                      </td>

                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
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
          <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
            <div>
              <span className="font-bold text-xs block">مجموع بهای تمام‌شده مصالح مصرفی حواله:</span>
              <span className="text-[10px] text-slate-400">سند اتوماتیک هزینه مستقیم پروژه (کد ۵۰۱۰۱)</span>
            </div>
            <span className="font-black text-amber-400 font-mono text-base">
              {totalCost.toLocaleString('fa-IR')} تومان
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

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>تأیید حواله و ثبت خروج از انبار</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
