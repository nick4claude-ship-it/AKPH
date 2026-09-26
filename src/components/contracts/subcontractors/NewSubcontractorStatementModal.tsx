/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { SubcontractorContract, UserProfile } from '../../../types';
import { X, Plus, Trash2, FileCheck2, Lock } from 'lucide-react';
import { Dialog } from '../../../ui/Dialog';
import { IntegerInput, MoneyInput, PercentInput } from '../../../ui/NumberInput';
import { formatMoney, formatMoneyCompact, formatInt, moneyUnitLabel } from '../../../utils/money';
import { getRelativePersianDate } from '../../../utils/date';
import { useSelector } from '../../../store/AppStore';
import {
  blankSubcontractorLine,
  capAdvanceDeduction,
  computeSubcontractorStatementDraft,
  subcontractorLineError,
  subcontractorStatementLines,
  suggestSubcontractorStatementNumber,
  type SubcontractorStatementFormInput,
  type SubcontractorStatementLineInput,
} from '../../../store/views/contracts';
import type { WorkflowResult } from '../../../store/workflowKit';
import { Money } from '../../common/Money';
import { formatText } from '../../../utils/formatters';

interface NewSubcontractorStatementModalProps {
  onClose: () => void;
  contracts: SubcontractorContract[];
  initialContract?: SubcontractorContract | null;
  currentUser: UserProfile;
  /** Saves through the workflow, which recomputes the amounts from the lines. */
  onSave: (form: SubcontractorStatementFormInput) => WorkflowResult;
}

export const NewSubcontractorStatementModal: React.FC<NewSubcontractorStatementModalProps> = ({ onClose, contracts, initialContract, currentUser, onSave }) => {
  const initialId = initialContract?.id || contracts[0]?.id || '';
  const initial = useSelector((s) => ({ lines: subcontractorStatementLines(s, initialId), number: suggestSubcontractorStatementNumber(s, initialId) }), [initialId]);
  const linesFor = useSelector((s) => (contractId: string) => subcontractorStatementLines(s, contractId));
  const numberFor = useSelector((s) => (contractId: string) => suggestSubcontractorStatementNumber(s, contractId));
  const [selectedContractId, setSelectedContractId] = useState<string>(initialId);
  const selectedContract = contracts.find((c) => c.id === selectedContractId) || contracts[0];

  const [statementNumber, setStatementNumber] = useState<string>(initial.number);
  const [periodStartDate, setPeriodStartDate] = useState<string>(() => getRelativePersianDate(-30));
  const [periodEndDate, setPeriodEndDate] = useState<string>(() => getRelativePersianDate(0));
  const [lines, setLines] = useState<SubcontractorStatementLineInput[]>(initial.lines);
  const [retentionRate, setRetentionRate] = useState<number>(5);
  const [advanceDeduction, setAdvanceDeduction] = useState<number>(0);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [otherDeduction, setOtherDeduction] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const form: SubcontractorStatementFormInput = {
    contractId: selectedContract?.id || '',
    statementNumber,
    periodStartDate,
    periodEndDate,
    lines,
    retentionRate,
    advanceDeduction,
    penaltyAmount,
    otherDeduction,
  };
  const draft = useSelector((s) => computeSubcontractorStatementDraft(s, form), [JSON.stringify(form)]);
  const { grossAmount, retentionAmount, totalDeductions, netPayable, remainingAdvance } = draft;

  if (!selectedContract) return null;

  const update = (id: string, patch: Partial<SubcontractorStatementLineInput>) => {
    setError(null);
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, blankSubcontractorLine()]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.error) return setError(draft.error);
    const result = onSave(form);
    if (!result.ok) return setError(result.message);
    onClose();
  };

  const input = 'w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm';

  return (
    <Dialog
      as="form"
      onSubmit={handleSubmit}
      onClose={onClose}
      label="ثبت صورت‌وضعیت جدید پیمانکار جزء"
      overlayClassName="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto"
      className="bg-white rounded-xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8"
    >
      <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-500/10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">ثبت صورت‌وضعیت جدید پیمانکار جزء</h3>
            <p className="text-xs text-slate-500">مقدار قبلی هر ردیف از صورت‌وضعیت‌های تأییدشده خوانده می‌شود و قابل ویرایش نیست.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="بستن" className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs font-bold text-slate-700 block">
            قرارداد پیمانکار جزء:
            <select
              value={selectedContractId}
              onChange={(e) => {
                setSelectedContractId(e.target.value);
                setLines(linesFor(e.target.value));
                setAdvanceDeduction(0);
                setStatementNumber(numberFor(e.target.value));
              }}
              className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
            >
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatText(c.projectName)} — {formatText(c.tradeType)} ({c.subcontractorName})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700 block">
            عنوان / شماره صورت‌وضعیت:
            <input type="text" required value={statementNumber} onChange={(e) => setStatementNumber(e.target.value)} className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
          </label>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-slate-500 block text-xs">پیمانکار:</span>
            <strong className="text-slate-900">{formatText(selectedContract.subcontractorName)}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-xs">مبلغ قرارداد:</span>
            <strong className="text-amber-800"><Money rial={selectedContract.contractValue} compact /></strong>
          </div>
          <div>
            <span className="text-slate-500 block text-xs">کارکرد تاکنون:</span>
            <strong className="text-blue-700"><Money rial={selectedContract.executedValue} compact /></strong>
          </div>
          <div>
            <span className="text-slate-500 block text-xs">مانده پیش‌پرداخت قابل استهلاک:</span>
            <strong className="text-slate-700"><Money rial={remainingAdvance} /></strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-xs font-bold text-slate-700 block">
            شروع دوره کارکرد:
            <input type="text" value={periodStartDate} onChange={(e) => setPeriodStartDate(e.target.value)} className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm tabular-nums" />
          </label>
          <label className="text-xs font-bold text-slate-700 block">
            پایان دوره کارکرد:
            <input type="text" value={periodEndDate} onChange={(e) => setPeriodEndDate(e.target.value)} className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm tabular-nums" />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">ردیف‌های کارکرد:</span>
            <button type="button" onClick={addLine} className="text-sm font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن ردیف جدید</span>
            </button>
          </div>
          <div className="border border-slate-200 rounded-xl table-scroll">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2">شرح عملیات</th>
                  <th className="p-2 w-20 text-center">واحد</th>
                  <th className="p-2 w-24 text-center">مقدار قرارداد</th>
                  <th className="p-2 w-24 text-center">قبلی (تأییدشده)</th>
                  <th className="p-2 w-24 text-center">مقدار این دوره</th>
                  <th className="p-2 w-28 text-left">نرخ واحد ({moneyUnitLabel()})</th>
                  <th className="p-2 w-28 text-left">مبلغ دوره</th>
                  <th className="p-2 w-10 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => {
                  const err = subcontractorLineError(l);
                  return (
                    <tr key={l.id} className={err ? 'bg-rose-50/60' : 'hover:bg-slate-50'}>
                      <td className="p-2">
                        {l.locked ? (
                          <span className="flex items-center gap-1 font-medium text-slate-800">
                            <Lock className="w-3 h-3 text-slate-500" aria-label="از تاریخچه تأییدشده" />
                            {formatText(l.description)}
                          </span>
                        ) : (
                          <input type="text" aria-label="شرح عملیات" value={l.description} onChange={(e) => update(l.id, { description: e.target.value })} className={input} />
                        )}
                        {err && <span className="block text-sm text-rose-700 font-bold mt-1">{err}</span>}
                        {l.pendingQuantity > 0 && <span className="block text-sm text-amber-700">در جریان تأیید: {formatInt(l.pendingQuantity)}</span>}
                      </td>
                      <td className="p-2 text-center">
                        {l.locked ? l.unit : <input type="text" aria-label="واحد" value={l.unit} onChange={(e) => update(l.id, { unit: e.target.value })} className={`${input} text-center`} />}
                      </td>
                      <td className="p-2 text-center tabular-nums">
                        {l.locked ? formatInt(l.contractQuantity) : <IntegerInput aria-label="مقدار قرارداد" value={l.contractQuantity} onValueChange={(v) => update(l.id, { contractQuantity: v })} className={`${input} text-center`} />}
                      </td>
                      <td className="p-2 text-center tabular-nums text-slate-600">{formatInt(l.previousQuantity)}</td>
                      <td className="p-2">
                        <IntegerInput aria-label="مقدار این دوره" value={l.currentQuantity} onValueChange={(v) => update(l.id, { currentQuantity: v })} aria-invalid={!!err} className={`${input} text-center font-bold`} />
                      </td>
                      <td className="p-2 text-left tabular-nums">
                        {l.locked ? formatMoney(l.unitRate, false) : <MoneyInput aria-label="نرخ واحد" value={l.unitRate} onValueChange={(v) => update(l.id, { unitRate: v })} className={`${input} text-left`} />}
                      </td>
                      <td className="p-2 text-left font-bold text-slate-900 tabular-nums">{formatMoney(draft.lineAmounts[l.id] || 0, false)}</td>
                      <td className="p-2 text-center">
                        {!l.locked && (
                          <button type="button" aria-label="حذف ردیف" onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))} className="text-slate-500 hover:text-rose-600 cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lines.length === 0 && <p className="py-6 text-center text-xs text-slate-500">این قرارداد هنوز ردیف تأییدشده‌ای ندارد؛ ردیف جدید اضافه کنید.</p>}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <span className="text-sm font-bold text-slate-800 block">کسورات پیمانکار جزء:</span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
            <label className="text-xs text-slate-500 block">
              درصد سپرده حسن انجام کار:
              <PercentInput value={retentionRate} onValueChange={setRetentionRate} className="mt-1 w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold" />
              <span className="text-xs text-slate-500 block mt-1"><Money rial={retentionAmount} /></span>
            </label>
            <label className="text-xs text-slate-500 block">
              استهلاک پیش‌پرداخت (حداکثر <Money rial={remainingAdvance} />):
              <MoneyInput
                value={advanceDeduction}
                onValueChange={(v) => {
                  setAdvanceDeduction(capAdvanceDeduction(v, remainingAdvance));
                  setError(null);
                }}
                className="mt-1 w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
              />
            </label>
            <label className="text-xs text-slate-500 block">
              جریمه ایمنی یا پرت مصالح:
              <MoneyInput value={penaltyAmount} onValueChange={setPenaltyAmount} className="mt-1 w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" />
            </label>
            <label className="text-xs text-slate-500 block">
              سایر کسورات کارگاهی:
              <MoneyInput value={otherDeduction} onValueChange={setOtherDeduction} className="mt-1 w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" />
            </label>
          </div>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-sm text-amber-900 block font-bold">مبلغ ناخالص کارکرد:</span>
            <span className="text-lg font-bold text-slate-900"><Money rial={grossAmount} /></span>
          </div>
          <div>
            <span className="text-sm text-amber-900 block font-bold">مجموع کسورات:</span>
            <span className="text-lg font-bold text-rose-700"><Money rial={totalDeductions} /></span>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-2xs">
            <span className="text-xs text-slate-500 block">خالص قابل مطالبه پیمانکار:</span>
            <span className="text-xl font-bold text-emerald-700"><Money rial={netPayable} /></span>
          </div>
        </div>

        {error && (
          <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 font-bold" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            انصراف
          </button>
          <button type="submit" className="btn btn-primary">
            ثبت صورت‌وضعیت و ارسال به اندازه‌گیری
          </button>
        </div>
      </div>
    </Dialog>
  );
};
