/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Contract, ContractAmendment, AmendmentType, UserProfile } from '../../types';
import { amendableLines, amendmentChangePercent, amendmentDeltaPreview, blankAmendmentLine, type AmendmentLineInput } from '../../store/views/contracts';
import { useSelector } from '../../store/AppStore';
import { Trash2 } from 'lucide-react';
import type { NewAmendmentInput } from '../../store/recordWorkflows';
import { X, Plus, FileText, Calendar, DollarSign } from 'lucide-react';
import { Dialog } from '../../ui/Dialog';
import { formatMoneyCompact, moneyUnitLabel } from '../../utils/money';
import { formatPercent, formatText } from '../../utils/formatters';
import { IntegerInput, MoneyInput, QuantityInput } from '../../ui/NumberInput';
import { formatMoney } from '../../utils/money';
import { getRelativePersianDate } from '../../utils/date';
import { Money } from '../common/Money';

interface NewAmendmentModalProps {
  /** A client contract, or a subcontract shown with the same fields. */
  contract: Pick<Contract, 'id' | 'code' | 'projectTitle' | 'initialValue' | 'currentValue' | 'server'>;
  currentUser: UserProfile;
  onClose: () => void;
  /** Records the amendment through the workflow; an approved one updates the contract value there. */
  onSaveAmendment: (input: NewAmendmentInput) => { ok: boolean; message: string };
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
  // akph/v1: the amendment is a set of line changes priced by the server and approved by the senior manager.
  const server = contract.server;
  const contractLines = amendableLines(contract);
  const [lines, setLines] = useState<AmendmentLineInput[]>([]);
  const delta = useSelector(() => amendmentDeltaPreview(contract, lines), [JSON.stringify(lines), contract.id]);
  const effect = server ? delta : amount;
  const changePercentage = amendmentChangePercent(contract, effect);
  const updateLine = (id: string, patch: Partial<AmendmentLineInput>) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onSaveAmendment({ number, type, date, amount: effect, extendedDays, description, status: server ? 'در انتظار تأیید' : status, lines: server ? lines : undefined });
    if (!result.ok) return setFormError(result.message);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="ثبت الحاقیه، متمم یا تغییر مقادیر پیمان" overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in duration-150">
      
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">ثبت الحاقیه، متمم یا تغییر مقادیر پیمان</h2>
              <p className="text-xs text-slate-500 mt-1">
                پیمان: <strong>{formatText(contract.code)}</strong> · {contract.projectTitle.slice(0, 30)}...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-amendment-modal-1" className="block text-slate-700 font-bold mb-1">شماره یا عنوان الحاقیه:</label>
              <input id="new-amendment-modal-1"
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-medium"
                required
              />
            </div>
            <div>
              <label htmlFor="new-amendment-modal-2" className="block text-slate-700 font-bold mb-1">نوع تغییر:</label>
              <select id="new-amendment-modal-2"
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

          {server && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">تغییر مقادیر ردیف‌ها و ردیف‌های جدید:</span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setLines((prev) => [...prev, blankAmendmentLine(contractLines[0]?.id || '')])} className="text-sm font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> تغییر مقدار ردیف
                  </button>
                  <button type="button" onClick={() => setLines((prev) => [...prev, blankAmendmentLine('')])} className="text-sm font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> ردیف جدید
                  </button>
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl table-scroll">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2">ردیف قرارداد / شرح</th>
                      <th className="p-2 w-20 text-center">واحد</th>
                      <th className="p-2 w-28 text-left">نرخ ({moneyUnitLabel()})</th>
                      <th className="p-2 w-24 text-center">تغییر مقدار</th>
                      <th className="p-2 w-10 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l) => (
                      <tr key={l.id}>
                        <td className="p-2">
                          {l.contractLineId ? (
                            <select aria-label="ردیف قرارداد" value={l.contractLineId} onChange={(e) => updateLine(l.id, { contractLineId: e.target.value })} className="w-full p-2 rounded border border-slate-300 bg-white">
                              {contractLines.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {formatText(c.description)} ({formatText(c.unit)})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input aria-label="شرح ردیف جدید" type="text" value={l.description} onChange={(e) => updateLine(l.id, { description: e.target.value })} className="w-full p-2 rounded border border-slate-300" />
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {l.contractLineId ? formatText(contractLines.find((c) => c.id === l.contractLineId)?.unit) : <input aria-label="واحد" type="text" value={l.unit} onChange={(e) => updateLine(l.id, { unit: e.target.value })} className="w-full p-2 rounded border border-slate-300 text-center" />}
                        </td>
                        <td className="p-2 text-left tabular-nums">
                          {l.contractLineId ? formatMoney(contractLines.find((c) => c.id === l.contractLineId)?.rate || 0, false) : <MoneyInput aria-label="نرخ" value={l.rate} onValueChange={(v) => updateLine(l.id, { rate: v })} className="w-full p-2 rounded border border-slate-300 text-left" />}
                        </td>
                        <td className="p-2">
                          <QuantityInput aria-label="تغییر مقدار" signed={!!l.contractLineId} value={l.quantityDelta} onValueChange={(v) => updateLine(l.id, { quantityDelta: v })} className="w-full p-2 rounded border border-slate-300 text-center" />
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" aria-label="حذف" onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))} className="text-slate-500 hover:text-rose-600 cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lines.length === 0 && <p className="py-4 text-center text-xs text-slate-500">فقط تمدید مدت؛ برای تغییر مبلغ ردیف اضافه کنید.</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="new-amendment-modal-3" className="block text-slate-700 font-bold mb-1">مبلغ اثر مالی ({moneyUnitLabel()}):</label>
              <MoneyInput id="new-amendment-modal-3"
                value={server ? delta : amount}
                disabled={!!server}
                onValueChange={(v) => setAmount(v)}
                className="w-full p-2 rounded-lg border border-slate-300 tabular-nums font-bold"
              />
              <span className="text-xs text-slate-500 mt-1 block">
                {formatPercent(changePercentage, 2)} از مبلغ اولیه
              </span>
            </div>

            <div>
              <label htmlFor="new-amendment-modal-4" className="block text-slate-700 font-bold mb-1">تمدید مدت (روز):</label>
              <IntegerInput id="new-amendment-modal-4"
                value={extendedDays}
                onValueChange={(v) => setExtendedDays(v)}
                className="w-full p-2 rounded-lg border border-slate-300 tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="new-amendment-modal-5" className="block text-slate-700 font-bold mb-1">تاریخ ابلاغ رسمی:</label>
              <input id="new-amendment-modal-5"
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 tabular-nums"
                required
              />
            </div>
          </div>

          {!server && (
          <div>
            <label htmlFor="new-amendment-modal-6" className="block text-slate-700 font-bold mb-1">وضعیت ابلاغ و تصویب:</label>
            <select id="new-amendment-modal-6"
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
          )}

          <div>
            <label htmlFor="new-amendment-modal-7" className="block text-slate-700 font-bold mb-1">توضیحات و مستندات قانونی:</label>
            <textarea id="new-amendment-modal-7"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full p-2 rounded-lg border border-slate-300"
              placeholder="دلایل فنی، صورتجلسه کارگاهی، تطابق با ماده ۲۹ شرایط عمومی پیمان..."
              required
            />
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-sm text-amber-950">
            <strong>اثر سیستمی:</strong> {server ? 'پس از تأیید مدیر ارشد' : 'در صورت انتخاب «تأیید شده»'}، مبلغ سقف پیمان از{' '}
            <span className="tabular-nums font-bold"><Money rial={contract.currentValue} compact /></span> به{' '}
            <span className="tabular-nums font-bold text-emerald-800">
              <Money rial={(contract.currentValue + effect)} compact />
            </span>{' '}
            تغییر خواهد کرد.
          </div>

          {formError && (
            <p className="text-sm text-rose-700 font-bold" role="alert">
              {formError}
            </p>
          )}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
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
              ثبت و اعمال تغییرات
            </button>
          </div>
        </form>
      </Dialog>
  );
};
