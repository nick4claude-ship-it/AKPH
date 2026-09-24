/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  SubcontractorContract,
  SubcontractorProgressStatement,
  SubcontractorStatementItem,
  UserProfile,
} from '../../../types';
import {
  X,
  Plus,
  Trash2,
  FileCheck2,
  Building,
  Hammer,
  AlertCircle,
  Calculator,
} from 'lucide-react';

interface NewSubcontractorStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  contracts: SubcontractorContract[];
  initialContract?: SubcontractorContract | null;
  currentUser: UserProfile;
  onSave: (statement: SubcontractorProgressStatement) => void;
}

export const NewSubcontractorStatementModal: React.FC<NewSubcontractorStatementModalProps> = ({
  isOpen,
  onClose,
  contracts,
  initialContract,
  currentUser,
  onSave,
}) => {
  const [selectedContractId, setSelectedContractId] = useState<string>(
    initialContract?.id || contracts[0]?.id || ''
  );

  const selectedContract = contracts.find((c) => c.id === selectedContractId) || contracts[0];

  const [statementNumber, setStatementNumber] = useState<string>('صورت‌وضعیت شماره ۳');
  const [periodStartDate, setPeriodStartDate] = useState<string>('۱۴۰۳/۰۶/۰۱');
  const [periodEndDate, setPeriodEndDate] = useState<string>('۱۴۰۳/۰۶/۳۱');
  const [submissionDate] = useState<string>('۱۴۰۳/۰۷/۰۳');

  // Work items inside this statement
  const [items, setItems] = useState<SubcontractorStatementItem[]>([
    {
      id: `sub-item-${Date.now()}-1`,
      description: 'عملیات اجرایی مطابق شرح قرارداد و نقشه‌های ابلاغی',
      unit: 'کیلوگرم',
      contractQuantity: 10_000,
      previousQuantity: 3_000,
      currentQuantity: 2_500,
      cumulativeQuantity: 5_500,
      unitRate: 19_000,
      currentAmount: 47_500_000,
      cumulativeAmount: 104_500_000,
    },
  ]);

  // Deductions
  const [retentionRate, setRetentionRate] = useState<number>(5); // 5%
  const [advanceDeduction, setAdvanceDeduction] = useState<number>(10_000_000);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [otherDeduction, setOtherDeduction] = useState<number>(0);

  if (!isOpen || !selectedContract) return null;

  // Calculations
  const grossAmount = items.reduce((sum, item) => sum + item.currentAmount, 0);
  const retentionAmount = Math.round(grossAmount * (retentionRate / 100));
  const totalDeductions = retentionAmount + advanceDeduction + penaltyAmount + otherDeduction;
  const netPayable = Math.max(0, grossAmount - totalDeductions);

  const handleAddItem = () => {
    const newItem: SubcontractorStatementItem = {
      id: `sub-item-${Date.now()}-${items.length + 1}`,
      description: 'ردیف کاری جدید',
      unit: 'مترمربع',
      contractQuantity: 1_000,
      previousQuantity: 0,
      currentQuantity: 100,
      cumulativeQuantity: 100,
      unitRate: 100_000,
      currentAmount: 10_000_000,
      cumulativeAmount: 10_000_000,
    };
    setItems([...items, newItem]);
  };

  const handleItemChange = (index: number, field: keyof SubcontractorStatementItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === 'currentQuantity' || field === 'unitRate' || field === 'previousQuantity') {
      const curQty = field === 'currentQuantity' ? Number(value) : item.currentQuantity;
      const prevQty = field === 'previousQuantity' ? Number(value) : item.previousQuantity;
      const rate = field === 'unitRate' ? Number(value) : item.unitRate;

      item.cumulativeQuantity = prevQty + curQty;
      item.currentAmount = curQty * rate;
      item.cumulativeAmount = item.cumulativeQuantity * rate;
    }

    updated[index] = item;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newStatement: SubcontractorProgressStatement = {
      id: `sub-stm-${Date.now()}`,
      statementNumber,
      subcontractorContractId: selectedContract.id,
      subcontractorContractNumber: selectedContract.contractNumber,
      subcontractorName: selectedContract.subcontractorName,
      tradeType: selectedContract.tradeType,
      projectId: selectedContract.projectId,
      projectName: selectedContract.projectName,
      periodStartDate,
      periodEndDate,
      submissionDate,
      items,
      grossAmount,
      siteVerifiedAmount: grossAmount,
      deductions: {
        retention: retentionAmount,
        advancePaymentDeduction: advanceDeduction,
        safetyOrWastePenalty: penaltyAmount,
        otherDeductions: otherDeduction,
        description: `کسر ${retentionRate}٪ سپرده حسن انجام کار و استهلاک پیش‌پرداخت`,
      },
      totalDeductions,
      netPayable,
      paidAmount: 0,
      remainingPayable: netPayable,
      status: 'submitted', // Starts at stage 1
      workflowHistory: [
        {
          date: '۱۴۰۳/۰۷/۰۳',
          time: '۱۱:۰۰',
          user: currentUser.name,
          role: currentUser.role,
          fromStatus: 'submitted',
          toStatus: 'submitted',
          action: 'ثبت صورت‌وضعیت در سامانه',
          comment: `ثبت کارکرد دوره ${periodStartDate} الی ${periodEndDate}`,
        },
      ],
    };

    onSave(newStatement);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-500/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">ثبت صورت‌وضعیت جدید پیمانکار جزء</h3>
              <p className="text-xs text-slate-500">
                مرحله ۱ گردش کار: ثبت کار انجام‌شده جهت بررسی متره کارگاه
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Contract Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">انتخاب قرارداد پیمانکار جزء:</label>
              <select
                value={selectedContractId}
                onChange={(e) => setSelectedContractId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.projectName} — {c.tradeType} ({c.subcontractorName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">عنوان / شماره صورت‌وضعیت:</label>
              <input
                type="text"
                required
                value={statementNumber}
                onChange={(e) => setStatementNumber(e.target.value)}
                placeholder="مثال: صورت‌وضعیت شماره ۳ جوشکاری"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Selected contract info ribbon */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-slate-400 block text-[10px]">پیمانکار:</span>
              <strong className="text-slate-900">{selectedContract.subcontractorName}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">سقف قرارداد:</span>
              <strong className="text-amber-800">
                {(selectedContract.contractValue / 1_000_000).toLocaleString('fa-IR')} م.ت
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">کارکرد تاکنون:</span>
              <strong className="text-blue-700">
                {(selectedContract.executedValue / 1_000_000).toLocaleString('fa-IR')} م.ت
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">نرخ پایه توافقی:</span>
              <span className="text-slate-700 font-bold">{selectedContract.unitRateDescription}</span>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">شروع دوره کارکرد:</label>
              <input
                type="text"
                value={periodStartDate}
                onChange={(e) => setPeriodStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">پایان دوره کارکرد:</label>
              <input
                type="text"
                value={periodEndDate}
                onChange={(e) => setPeriodEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Work items list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900">آیتم‌های کارکرد انجام‌شده در این دوره:</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن ردیف کاری</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2.5">شرح عملیات</th>
                    <th className="p-2.5 w-20 text-center">واحد</th>
                    <th className="p-2.5 w-24 text-center">مقدار دوره</th>
                    <th className="p-2.5 w-32 text-left">نرخ واحد (تومان)</th>
                    <th className="p-2.5 w-32 text-left">مبلغ این دوره</th>
                    <th className="p-2.5 w-10 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-center"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.currentQuantity}
                          onChange={(e) => handleItemChange(index, 'currentQuantity', e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-center font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.unitRate}
                          onChange={(e) => handleItemChange(index, 'unitRate', e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-left"
                        />
                      </td>
                      <td className="p-2 text-left font-black text-slate-900">
                        {(item.currentAmount / 1_000_000).toLocaleString('fa-IR')} م.ت
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
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

          {/* Deductions Settings */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-800 block">کسورات قانونی و کارگاهی پیمانکار جزء:</span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">درصد حسن انجام کار (سپرده):</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={retentionRate}
                    onChange={(e) => setRetentionRate(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                  />
                  <span className="text-slate-400">٪</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {(retentionAmount / 1_000_000).toLocaleString('fa-IR')} م.ت
                </span>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">استهلاک پیش‌پرداخت (تومان):</label>
                <input
                  type="number"
                  value={advanceDeduction}
                  onChange={(e) => setAdvanceDeduction(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">جریمه ایمنی یا پرت مصالح:</label>
                <input
                  type="number"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">سایر کسورات کارگاهی:</label>
                <input
                  type="number"
                  value={otherDeduction}
                  onChange={(e) => setOtherDeduction(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* Final Financial Totals Ribbon */}
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-amber-900 block font-bold">مبلغ ناخالص کارکرد:</span>
              <span className="text-lg font-black text-slate-900">
                {(grossAmount / 1_000_000).toLocaleString('fa-IR')} میلیون تومان
              </span>
            </div>

            <div>
              <span className="text-xs text-amber-900 block font-bold">مجموع کسورات:</span>
              <span className="text-lg font-black text-rose-700">
                {(totalDeductions / 1_000_000).toLocaleString('fa-IR')} میلیون تومان
              </span>
            </div>

            <div className="bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-2xs">
              <span className="text-xs text-slate-500 block">خالص قابل مطالبه پیمانکار:</span>
              <span className="text-xl font-black text-emerald-700">
                {(netPayable / 1_000_000).toLocaleString('fa-IR')} میلیون تومان
              </span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-xs"
            >
              ثبت صورت‌وضعیت و ارسال به بررسی کارگاه
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
