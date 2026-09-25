/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ContractType, ContractStatus, Project, UserProfile } from '../../types';
import { X, Building, Calendar, DollarSign, Plus, AlertTriangle } from 'lucide-react';
import { getRelativePersianDate } from '../../utils/date';
import { useSelector } from '../../store/AppStore';
import { suggestContractCode } from '../../store/views/contracts';
import type { NewClientContractInput } from '../../store/recordWorkflows';
import { Dialog } from '../../ui/Dialog';
import { formatMoneyCompact, moneyUnitLabel } from '../../utils/money';
import { IntegerInput, MoneyInput } from '../../ui/NumberInput';
import { useCompany } from '../../store/session';

interface NewContractModalProps {
  projects: Project[];
  currentUser: UserProfile;
  onClose: () => void;
  /** Creates the contract through the workflow (client, cost center and audit row come from the store). */
  onSaveContract: (input: NewClientContractInput) => { ok: boolean; message: string };
}

export const NewContractModal: React.FC<NewContractModalProps> = ({
  projects,
  currentUser,
  onClose,
  onSaveContract,
}) => {
  const company = useCompany();
  const suggestedCode = useSelector(suggestContractCode);
  const [code, setCode] = useState(suggestedCode);
  const [number, setNumber] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [employer, setEmployer] = useState('');
  const [executiveBody, setExecutiveBody] = useState('');
  const [consultant, setConsultant] = useState('');
  const [contractor, setContractor] = useState(company.legalName);
  const [initialValue, setInitialValue] = useState<number>(0);
  const [contractDate, setContractDate] = useState(() => getRelativePersianDate(0));
  const [startDate, setStartDate] = useState(() => getRelativePersianDate(0));
  const [endDate, setEndDate] = useState(() => getRelativePersianDate(365));
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [contractType, setContractType] = useState<ContractType>('فهرست‌بهایی');
  const [status, setStatus] = useState<ContractStatus>('فعال');
  const [advancePaymentPercentage, setAdvancePaymentPercentage] = useState<number>(0);
  const [retentionPercentage, setRetentionPercentage] = useState<number>(10);
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onSaveContract({
      code,
      number,
      projectTitle,
      projectId,
      employer,
      executiveBody,
      consultant,
      contractor,
      initialValue,
      contractDate,
      startDate,
      endDate,
      durationMonths,
      contractType,
      status,
      advancePaymentPercentage,
      retentionPercentage,
      description,
    });
    if (!result.ok) return setFormError(result.message);
    setFormError(null);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="ثبت قرارداد پیمانکاری جدید" overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
      
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">ثبت قرارداد پیمانکاری جدید</h2>
              <p className="text-xs text-slate-500 mt-0.5">ثبت مشخصات حقوقی، کارفرما، مبالغ و شرایط مالی پیمان</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 font-bold rounded-lg flex items-center gap-2 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-contract-modal-1" className="block text-slate-700 font-bold mb-1">کد سیستمی قرارداد:</label>
              <input id="new-contract-modal-1"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                required
              />
            </div>
            <div>
              <label htmlFor="new-contract-modal-2" className="block text-slate-700 font-bold mb-1">شماره ثبت کارفرما / دبیرخانه:</label>
              <input id="new-contract-modal-2"
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-contract-modal-3" className="block text-slate-700 font-bold mb-1">عنوان کامل پروژه و موضوع پیمان:</label>
            <input id="new-contract-modal-3"
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="مثال: عملیات احداث اسکلت بتنی و سفت‌کاری برج مسکونی نیلوفر"
              className="w-full p-2 rounded-lg border border-slate-300"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-contract-modal-4" className="block text-slate-700 font-bold mb-1">پروژه مرتبط در سامانه:</label>
              <select id="new-contract-modal-4"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-contract-modal-5" className="block text-slate-700 font-bold mb-1">نوع و روش انعقاد پیمان:</label>
              <select id="new-contract-modal-5"
                value={contractType}
                onChange={(e) => setContractType(e.target.value as ContractType)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="فهرست‌بهایی">فهرست‌بهایی (Unit Price)</option>
                <option value="سرجمع (مقطوع)">سرجمع و مقطوع (Lump Sum)</option>
                <option value="طراحی و ساخت (EPC)">طراحی و ساخت (EPC / Turnkey)</option>
                <option value="مدیریت پیمان (MC)">مدیریت پیمان (Cost Plus / MC)</option>
                <option value="BOT / مشارکتی">BOT و سرمایه‌گذاری مشارکتی</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="new-contract-modal-6" className="block text-slate-700 font-bold mb-1">کارفرما:</label>
              <input id="new-contract-modal-6"
                type="text"
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                placeholder="مثال: شرکت سرمایه‌گذاری مسکن"
                className="w-full p-2 rounded-lg border border-slate-300"
                required
              />
            </div>
            <div>
              <label htmlFor="new-contract-modal-7" className="block text-slate-700 font-bold mb-1">دستگاه اجرایی:</label>
              <input id="new-contract-modal-7"
                type="text"
                value={executiveBody}
                onChange={(e) => setExecutiveBody(e.target.value)}
                placeholder="مثال: شهرداری منطقه ۱"
                className="w-full p-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label htmlFor="new-contract-modal-8" className="block text-slate-700 font-bold mb-1">مهندسین مشاور / نظارت:</label>
              <input id="new-contract-modal-8"
                type="text"
                value={consultant}
                onChange={(e) => setConsultant(e.target.value)}
                placeholder="مثال: مهندسین مشاور سازه‌اندیش"
                className="w-full p-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="new-contract-modal-9" className="block text-slate-700 font-bold mb-1">مبلغ اولیه پیمان ({moneyUnitLabel()}):</label>
              <MoneyInput id="new-contract-modal-9"
                value={initialValue}
                onValueChange={(v) => setInitialValue(v)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {formatMoneyCompact(initialValue)}
              </span>
            </div>
            <div>
              <label htmlFor="new-contract-modal-10" className="block text-slate-700 font-bold mb-1">درصد پیش‌پرداخت:</label>
              <IntegerInput id="new-contract-modal-10"
                value={advancePaymentPercentage}
                onValueChange={(v) => setAdvancePaymentPercentage(v)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label htmlFor="new-contract-modal-11" className="block text-slate-700 font-bold mb-1">سپرده حسن انجام کار (٪):</label>
              <IntegerInput id="new-contract-modal-11"
                value={retentionPercentage}
                onValueChange={(v) => setRetentionPercentage(v)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label htmlFor="new-contract-modal-12" className="block text-slate-700 font-bold mb-1">تاریخ انعقاد:</label>
              <input id="new-contract-modal-12"
                type="text"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label htmlFor="new-contract-modal-13" className="block text-slate-700 font-bold mb-1">تاریخ شروع:</label>
              <input id="new-contract-modal-13"
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label htmlFor="new-contract-modal-14" className="block text-slate-700 font-bold mb-1">تاریخ پایان:</label>
              <input id="new-contract-modal-14"
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label htmlFor="new-contract-modal-15" className="block text-slate-700 font-bold mb-1">مدت پیمان (ماه):</label>
              <IntegerInput id="new-contract-modal-15"
                value={durationMonths}
                onValueChange={(v) => setDurationMonths(v)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-contract-modal-16" className="block text-slate-700 font-bold mb-1">توضیحات و شرایط اختصاصی:</label>
            <textarea id="new-contract-modal-16"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full p-2 rounded-lg border border-slate-300"
              placeholder="نکات مندرج در شرایط خصوصی، مصالح پای‌کار، نحوه پرداخت و شاخص‌های تعدیل..."
            />
          </div>

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
              ثبت و ایجاد قرارداد
            </button>
          </div>
        </form>
      </Dialog>
  );
};
