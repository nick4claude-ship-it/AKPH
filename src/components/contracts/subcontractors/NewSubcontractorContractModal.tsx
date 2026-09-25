/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SubcontractorTradeType, Project, UserProfile } from '../../../types';
import { X, Building, Hammer, Plus, DollarSign, Calendar } from 'lucide-react';
import { Dialog } from '../../../ui/Dialog';
import { formatMoneyCompact, moneyUnitLabel } from '../../../utils/money';
import { IntegerInput, MoneyInput } from '../../../ui/NumberInput';
import { getRelativePersianDate } from '../../../utils/date';
import { useSelector } from '../../../store/AppStore';
import { suggestSubcontractNumber } from '../../../store/views/contracts';
import type { NewSubcontractInput } from '../../../store/recordWorkflows';

interface NewSubcontractorContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  currentUser: UserProfile;
  /** Creates the subcontract through the workflow (cost center, ledger account and retention come from the store). */
  onSave: (input: NewSubcontractInput) => { ok: boolean; message: string };
}

export const NewSubcontractorContractModal: React.FC<NewSubcontractorContractModalProps> = ({
  isOpen,
  onClose,
  projects,
  currentUser,
  onSave,
}) => {
  const suggestedNumber = useSelector(suggestSubcontractNumber);
  const [projectId, setProjectId] = useState<string>(projects[0]?.id || '');
  const [formError, setFormError] = useState<string | null>(null);
  const [subcontractorName, setSubcontractorName] = useState('');
  const [subcontractorPhone, setSubcontractorPhone] = useState('');
  const [tradeType, setTradeType] = useState<SubcontractorTradeType>('جوشکاری و اسکلت فلزی');
  const [contractNumber, setContractNumber] = useState(suggestedNumber);
  const [title, setTitle] = useState('');
  const [contractValue, setContractValue] = useState<number>(0);
  const [unitRateDescription, setUnitRateDescription] = useState('نرخ واحد توافقی بر اساس فهرست مقادیر');
  const [startDate, setStartDate] = useState(() => getRelativePersianDate(0));
  const [endDate, setEndDate] = useState(() => getRelativePersianDate(180));
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [retentionDepositRate, setRetentionDepositRate] = useState<number>(5);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onSave({
      projectId: projectId || projects[0]?.id || '',
      subcontractorName,
      subcontractorPhone,
      tradeType,
      contractNumber,
      title,
      contractValue,
      unitRateDescription,
      startDate,
      endDate,
      advancePaid,
      retentionDepositRate,
      notes,
    });
    if (!result.ok) return setFormError(result.message);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="انعقاد قرارداد پیمانکار جزء جدید" overlayClassName="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto" className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
      
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
              <label htmlFor="new-subcontractor-contract-modal-1" className="text-xs font-bold text-slate-700 block mb-1.5">انتخاب کارگاه / پروژه:</label>
              <select id="new-subcontractor-contract-modal-1"
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
              <label htmlFor="new-subcontractor-contract-modal-2" className="text-xs font-bold text-slate-700 block mb-1.5">رشته تخصصی پیمانکاری:</label>
              <select id="new-subcontractor-contract-modal-2"
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
              <label htmlFor="new-subcontractor-contract-modal-3" className="text-xs font-bold text-slate-700 block mb-1.5">نام پیمانکار / سرپرست اکیپ:</label>
              <input id="new-subcontractor-contract-modal-3"
                type="text"
                required
                placeholder="مثال: صنایع جوش پیشگام (قادری)"
                value={subcontractorName}
                onChange={(e) => setSubcontractorName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label htmlFor="new-subcontractor-contract-modal-4" className="text-xs font-bold text-slate-700 block mb-1.5">شماره تماس / همراه:</label>
              <input id="new-subcontractor-contract-modal-4"
                type="text"
                placeholder="۰۹۱۲۰۰۰۰۰۰۰"
                value={subcontractorPhone}
                onChange={(e) => setSubcontractorPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-subcontractor-contract-modal-5" className="text-xs font-bold text-slate-700 block mb-1.5">شماره قرارداد سیستمی:</label>
              <input id="new-subcontractor-contract-modal-5"
                type="text"
                required
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label htmlFor="new-subcontractor-contract-modal-6" className="text-xs font-bold text-slate-700 block mb-1.5">سقف مبلغ کل قرارداد ({moneyUnitLabel()}):</label>
              <MoneyInput id="new-subcontractor-contract-modal-6"
                required
                value={contractValue}
                onValueChange={(v) => setContractValue(v)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                {formatMoneyCompact(contractValue)}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="new-subcontractor-contract-modal-7" className="text-xs font-bold text-slate-700 block mb-1.5">موضوع و شرح عملیات پیمان:</label>
            <input id="new-subcontractor-contract-modal-7"
              type="text"
              placeholder="مثال: عملیات جوشکاری و مونتاژ تیر و ستون‌های فلزی طبقات ۱ تا ۱۰"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <label htmlFor="new-subcontractor-contract-modal-8" className="text-xs font-bold text-slate-700 block mb-1.5">شرح نرخ پایه و بهای واحد توافقی:</label>
            <input id="new-subcontractor-contract-modal-8"
              type="text"
              placeholder="مثال: نرخ هر کیلو جوشکاری نفوذی یا هر متر قالب‌بندی طبق فهرست‌بها"
              value={unitRateDescription}
              onChange={(e) => setUnitRateDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-subcontractor-contract-modal-9" className="text-xs font-bold text-slate-700 block mb-1.5">تاریخ شروع کار:</label>
              <input id="new-subcontractor-contract-modal-9"
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label htmlFor="new-subcontractor-contract-modal-10" className="text-xs font-bold text-slate-700 block mb-1.5">تاریخ پایان کار:</label>
              <input id="new-subcontractor-contract-modal-10"
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-subcontractor-contract-modal-11" className="text-xs font-bold text-slate-700 block mb-1.5">پیش‌پرداخت اولیه ({moneyUnitLabel()}):</label>
              <MoneyInput id="new-subcontractor-contract-modal-11"
                value={advancePaid}
                onValueChange={(v) => setAdvancePaid(v)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label htmlFor="new-subcontractor-contract-modal-12" className="text-xs font-bold text-slate-700 block mb-1.5">درصد سپرده حسن انجام کار:</label>
              <div className="flex items-center gap-1">
                <MoneyInput id="new-subcontractor-contract-modal-12"
                  value={retentionDepositRate}
                  onValueChange={(v) => setRetentionDepositRate(v)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
                <span className="text-xs text-slate-400">٪</span>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="new-subcontractor-contract-modal-13" className="text-xs font-bold text-slate-700 block mb-1.5">توضیحات و شرایط ویژه کارگاهی:</label>
            <textarea id="new-subcontractor-contract-modal-13"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="نظیر تعهدات ابزار کار، انطباق با ضوابط HSE، نحوه استهلاک پیش‌پرداخت..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          {formError && (
            <p className="text-xs text-rose-700 font-bold" role="alert">
              {formError}
            </p>
          )}
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
      </Dialog>
  );
};
