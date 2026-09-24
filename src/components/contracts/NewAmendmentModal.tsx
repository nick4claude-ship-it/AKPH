/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Contract, ContractAmendment, AmendmentType, UserProfile } from '../../types';
import { X, Plus, FileText, Calendar, DollarSign } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { formatMoneyCompact, moneyUnitLabel } from '../../utils/money';
import { IntegerInput, MoneyInput } from '../common/NumberInput';
import { generateUUID } from '../../utils/ids';
import { getRelativePersianDate } from '../../utils/date';

interface NewAmendmentModalProps {
  contract: Contract;
  currentUser: UserProfile;
  onClose: () => void;
  onSaveAmendment: (amendment: ContractAmendment, updatedContract: Contract) => void;
}

export const NewAmendmentModal: React.FC<NewAmendmentModalProps> = ({
  contract,
  currentUser,
  onClose,
  onSaveAmendment,
}) => {
  const [number, setNumber] = useState('');
  const [type, setType] = useState<AmendmentType>('افزایش مبلغ');
  const [date, setDate] = useState(() => getRelativePersianDate(0));
  const [amount, setAmount] = useState<number>(0);
  const [extendedDays, setExtendedDays] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ContractAmendment['status']>('تأیید شده');
  const [formError, setFormError] = useState<string | null>(null);

  const changePercentage = contract.initialValue > 0 ? (amount / contract.initialValue) * 100 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!number.trim()) return setFormError('شماره الحاقیه را وارد کنید.');
    if (amount <= 0 && extendedDays <= 0) return setFormError('مبلغ یا مدت تمدید الحاقیه را وارد کنید.');

    const newAmd: ContractAmendment = {
      id: generateUUID(),
      contractId: contract.id,
      number,
      type,
      date,
      amount,
      changePercentage: Number(changePercentage.toFixed(2)),
      extendedDays,
      description,
      status,
      approvedBy: status === 'تأیید شده' ? contract.employer : undefined,
      approvalDate: status === 'تأیید شده' ? date : undefined,
    };

    // If approved, update contract current value and duration
    let updatedContract = { ...contract };
    if (status === 'تأیید شده') {
      const newApprovedChanges = contract.approvedChangesValue + amount;
      const newCurrentValue = contract.initialValue + newApprovedChanges;
      const newRemainingValue = Math.max(0, newCurrentValue - contract.executedValue);
      const newExtensionMonths = contract.durationExtensionMonths + Math.round(extendedDays / 30);

      updatedContract = {
        ...contract,
        approvedChangesValue: newApprovedChanges,
        currentValue: newCurrentValue,
        remainingValue: newRemainingValue,
        durationExtensionMonths: newExtensionMonths,
      };
    }

    onSaveAmendment(newAmd, updatedContract);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="ثبت الحاقیه، متمم یا تغییر مقادیر پیمان" overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in duration-150">
      
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">ثبت الحاقیه، متمم یا تغییر مقادیر پیمان</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                پیمان: <strong>{contract.code}</strong> · {contract.projectTitle.slice(0, 30)}...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">شماره یا عنوان الحاقیه:</label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">نوع تغییر:</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AmendmentType)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="افزایش مبلغ">افزایش مبلغ (تا سقف ۲۵٪)</option>
                <option value="کاهش مبلغ">کاهش مبلغ (تا سقف ۲۵٪)</option>
                <option value="تمدید مدت">تمدید مدت و تاخیرات مجاز</option>
                <option value="تغییر مقادیر">تغییر مقادیر احجام منضم به پیمان</option>
                <option value="تغییر نرخ و تعدیل">تغییر نرخ و فرمول‌های تعدیل</option>
                <option value="تغییر شرح کار">تغییر مشخصات فنی یا شرح کار</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">مبلغ اثر مالی ({moneyUnitLabel()}):</label>
              <MoneyInput
                value={amount}
                onValueChange={(v) => setAmount(v)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {changePercentage.toFixed(2)}٪ از مبلغ اولیه
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">تمدید مدت (روز):</label>
              <IntegerInput
                value={extendedDays}
                onValueChange={(v) => setExtendedDays(v)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">تاریخ ابلاغ رسمی:</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">وضعیت ابلاغ و تصویب:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContractAmendment['status'])}
              className="w-full p-2 rounded-lg border border-slate-300 bg-white"
            >
              <option value="تأیید شده">تأیید و ابلاغ شده کارفرما (به‌روزرسانی سقف پیمان)</option>
              <option value="در حال بررسی مشاور">در حال بررسی مهندس مشاور</option>
              <option value="پیش‌نویس پیمانکار">پیش‌نویس پیمانکار</option>
              <option value="رد شده">رد شده</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">توضیحات و مستندات قانونی:</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full p-2 rounded-lg border border-slate-300"
              placeholder="دلایل فنی، صورتجلسه کارگاهی، تطابق با ماده ۲۹ شرایط عمومی پیمان..."
              required
            />
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-950">
            <strong>اثر سیستمی:</strong> در صورت انتخاب «تأیید شده»، مبلغ سقف پیمان از{' '}
            <span className="font-mono font-bold">{formatMoneyCompact(contract.currentValue)}</span> به{' '}
            <span className="font-mono font-bold text-emerald-800">
              {formatMoneyCompact((contract.currentValue + amount))}
            </span>{' '}
            افزایش خواهد یافت.
          </div>

          {formError && (
            <p className="text-xs text-rose-700 font-bold" role="alert">
              {formError}
            </p>
          )}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-xs cursor-pointer"
            >
              ثبت و اعمال تغییرات
            </button>
          </div>
        </form>
      </Dialog>
  );
};
