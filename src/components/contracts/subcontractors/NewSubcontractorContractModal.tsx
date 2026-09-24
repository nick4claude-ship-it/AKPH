/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  SubcontractorContract,
  SubcontractorTradeType,
  Project,
  UserProfile,
} from '../../../types';
import { X, Building, Hammer, Plus, DollarSign, Calendar } from 'lucide-react';

interface NewSubcontractorContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  currentUser: UserProfile;
  onSave: (contract: SubcontractorContract) => void;
}

export const NewSubcontractorContractModal: React.FC<NewSubcontractorContractModalProps> = ({
  isOpen,
  onClose,
  projects,
  currentUser,
  onSave,
}) => {
  const [projectId, setProjectId] = useState<string>(projects[0]?.id || 'prj-01');
  const [subcontractorName, setSubcontractorName] = useState('');
  const [subcontractorPhone, setSubcontractorPhone] = useState('');
  const [tradeType, setTradeType] = useState<SubcontractorTradeType>('جوشکاری و اسکلت فلزی');
  const [contractNumber, setContractNumber] = useState(`SUB-PRJ-${Date.now().toString().slice(-4)}`);
  const [title, setTitle] = useState('');
  const [contractValue, setContractValue] = useState<number>(1_000_000_000);
  const [unitRateDescription, setUnitRateDescription] = useState('نرخ واحد توافقی بر اساس فهرست مقادیر');
  const [startDate, setStartDate] = useState('۱۴۰۳/۰۷/۰۱');
  const [endDate, setEndDate] = useState('۱۴۰۴/۰۱/۳۱');
  const [advancePaid, setAdvancePaid] = useState<number>(100_000_000);
  const [retentionDepositRate, setRetentionDepositRate] = useState<number>(5);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const selectedProject = projects.find((p) => p.id === projectId) || projects[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newContract: SubcontractorContract = {
      id: `sub-cnt-${Date.now()}`,
      contractNumber,
      title: title || `عملیات ${tradeType} پروژه ${selectedProject.name}`,
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      subcontractorName,
      subcontractorPhone,
      tradeType,
      contractValue,
      executedValue: 0,
      approvedStatementsValue: 0,
      paidValue: 0,
      remainingPayableValue: 0,
      remainingContractValue: contractValue,
      startDate,
      endDate,
      status: 'فعال',
      unitRateDescription,
      advancePaid,
      retentionDeposit: Math.round(contractValue * (retentionDepositRate / 100)),
      penaltyOrDeductions: 0,
      notes,
    };

    onSave(newContract);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-500/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">انعقاد قرارداد پیمانکار جزء جدید</h3>
              <p className="text-xs text-slate-500">
                ثبت مشخصات پیمانکاری فرعی (جوشکار، آرماتوربند، بنّا، تأسیسات و...)
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">انتخاب کارگاه / پروژه:</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">رشته تخصصی پیمانکاری:</label>
              <select
                value={tradeType}
                onChange={(e) => setTradeType(e.target.value as SubcontractorTradeType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                <option value="جوشکاری و اسکلت فلزی">جوشکاری و اسکلت فلزی</option>
                <option value="آرماتوربندی و قالب‌بندی">آرماتوربندی و قالب‌بندی</option>
                <option value="بتن‌ریزی و پمپاژ">بتن‌ریزی و پمپاژ</option>
                <option value="بنّایی و تیغه‌چینی">بنّایی و تیغه‌چینی</option>
                <option value="تأسیسات مکانیکی">تأسیسات مکانیکی</option>
                <option value="تأسیسات الکتریکی">تأسیسات الکتریکی</option>
                <option value="گچ‌کاری و کناف">گچ‌کاری و کناف</option>
                <option value="کاشی‌کاری و سرامیک">کاشی‌کاری و سرامیک</option>
                <option value="رنگ‌آمیزی و نقاشی">رنگ‌آمیزی و نقاشی</option>
                <option value="عایق‌کاری و ایزوگام">عایق‌کاری و ایزوگام</option>
                <option value="خاک‌برداری و نیلینگ">خاک‌برداری و نیلینگ</option>
                <option value="محوطه‌سازی و جدول‌کاری">محوطه‌سازی و جدول‌کاری</option>
                <option value="سایر پیمانکاری جزء">سایر پیمانکاری جزء</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">نام پیمانکار / سرپرست اکیپ:</label>
              <input
                type="text"
                required
                placeholder="مثال: صنایع جوش پیشگام (قادری)"
                value={subcontractorName}
                onChange={(e) => setSubcontractorName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">شماره تماس / همراه:</label>
              <input
                type="text"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                value={subcontractorPhone}
                onChange={(e) => setSubcontractorPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">شماره قرارداد سیستمی:</label>
              <input
                type="text"
                required
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">سقف مبلغ کل قرارداد (تومان):</label>
              <input
                type="number"
                required
                value={contractValue}
                onChange={(e) => setContractValue(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                {(contractValue / 1_000_000).toLocaleString('fa-IR')} میلیون تومان
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">موضوع و شرح عملیات پیمان:</label>
            <input
              type="text"
              placeholder="مثال: عملیات جوشکاری و مونتاژ تیر و ستون‌های فلزی طبقات ۱ تا ۱۰"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">شرح نرخ پایه و بهای واحد توافقی:</label>
            <input
              type="text"
              placeholder="مثال: کیلویی ۱۹,۰۰۰ تومان جوشکاری نفوذی یا متری ۴۵,۰۰۰ تومان قالب‌بندی"
              value={unitRateDescription}
              onChange={(e) => setUnitRateDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">تاریخ شروع کار:</label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">تاریخ پایان کار:</label>
              <input
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">پیش‌پرداخت اولیه (تومان):</label>
              <input
                type="number"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">درصد سپرده حسن انجام کار:</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={retentionDepositRate}
                  onChange={(e) => setRetentionDepositRate(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
                <span className="text-xs text-slate-400">٪</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">توضیحات و شرایط ویژه کارگاهی:</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="نظیر تعهدات ابزار کار، انطباق با ضوابط HSE، نحوه استهلاک پیش‌پرداخت..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

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
              ثبت قرارداد پیمانکار جزء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
