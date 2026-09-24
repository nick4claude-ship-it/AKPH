/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { SubcontractorContract, SubcontractorProgressStatement, SubcontractorStatementItem, UserProfile } from '../../../types';
import { X, Plus, Trash2, FileCheck2, Lock } from 'lucide-react';
import { Dialog } from '../../common/Dialog';
import { IntegerInput, MoneyInput } from '../../common/NumberInput';
import { formatMoney, formatMoneyCompact, formatInt, moneyUnitLabel, roundRial } from '../../../utils/money';
import { generateUUID } from '../../../utils/ids';
import { toPersianDate, toPersianTime, getRelativePersianDate } from '../../../utils/date';
import { toPersianDigits } from '../../../utils/formatters';
import { useAppState } from '../../../store/AppStore';
import { lineKey, selectSubcontractLines, subcontractRemainingAdvance, validateSubcontractorStatement } from '../../../store/subcontractLines';
import type { WorkflowResult } from '../../../store/workflows';

interface NewSubcontractorStatementModalProps {
  onClose: () => void;
  contracts: SubcontractorContract[];
  initialContract?: SubcontractorContract | null;
  currentUser: UserProfile;
  onSave: (statement: SubcontractorProgressStatement) => WorkflowResult;
}

interface DraftLine {
  id: string;
  /** Lines that already have approved history are locked: description, unit, contract qty, rate and previous qty. */
  locked: boolean;
  description: string;
  unit: string;
  contractQuantity: number;
  unitRate: number;
  previousQuantity: number;
  pendingQuantity: number;
  currentQuantity: number;
}

export const NewSubcontractorStatementModal: React.FC<NewSubcontractorStatementModalProps> = ({ onClose, contracts, initialContract, currentUser, onSave }) => {
  const state = useAppState();
  const [selectedContractId, setSelectedContractId] = useState<string>(initialContract?.id || contracts[0]?.id || '');
  const selectedContract = contracts.find((c) => c.id === selectedContractId) || contracts[0];

  const linesFor = (contractId: string): DraftLine[] =>
    selectSubcontractLines(state, contractId).map((l) => ({
      id: generateUUID(),
      locked: true,
      description: l.description,
      unit: l.unit,
      contractQuantity: l.contractQuantity,
      unitRate: l.unitRate,
      previousQuantity: l.approvedQuantity,
      pendingQuantity: l.pendingQuantity,
      currentQuantity: 0,
    }));

  const statementsOfContract = (contractId: string) => state.subcontractorStatements.filter((s) => s.subcontractorContractId === contractId).length;
  const [statementNumber, setStatementNumber] = useState<string>(() => `صورت‌وضعیت شماره ${toPersianDigits(statementsOfContract(selectedContract?.id || '') + 1)}`);
  const [periodStartDate, setPeriodStartDate] = useState<string>(() => getRelativePersianDate(-30));
  const [periodEndDate, setPeriodEndDate] = useState<string>(() => getRelativePersianDate(0));
  const [lines, setLines] = useState<DraftLine[]>(() => (selectedContract ? linesFor(selectedContract.id) : []));
  const [retentionRate, setRetentionRate] = useState<number>(5);
  const [advanceDeduction, setAdvanceDeduction] = useState<number>(0);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [otherDeduction, setOtherDeduction] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const remainingAdvance = useMemo(() => (selectedContract ? subcontractRemainingAdvance(state, selectedContract.id) : 0), [state, selectedContract]);

  if (!selectedContract) return null;

  const withAmounts = (l: DraftLine): SubcontractorStatementItem => {
    const cumulativeQuantity = l.previousQuantity + l.currentQuantity;
    return {
      id: l.id,
      description: l.description.trim(),
      unit: l.unit.trim(),
      contractQuantity: l.contractQuantity,
      previousQuantity: l.previousQuantity,
      currentQuantity: l.currentQuantity,
      cumulativeQuantity,
      unitRate: l.unitRate,
      currentAmount: roundRial(l.currentQuantity * l.unitRate),
      cumulativeAmount: roundRial(cumulativeQuantity * l.unitRate),
    };
  };

  const items = lines.filter((l) => l.currentQuantity > 0).map(withAmounts);
  const grossAmount = items.reduce((sum, item) => sum + item.currentAmount, 0);
  const retentionAmount = roundRial((grossAmount * retentionRate) / 100);
  const totalDeductions = retentionAmount + advanceDeduction + penaltyAmount + otherDeduction;
  const netPayable = Math.max(0, grossAmount - totalDeductions);

  const update = (id: string, patch: Partial<DraftLine>) => {
    setError(null);
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { id: generateUUID(), locked: false, description: '', unit: '', contractQuantity: 0, unitRate: 0, previousQuantity: 0, pendingQuantity: 0, currentQuantity: 0 },
    ]);

  const lineError = (l: DraftLine): string | null => {
    const committed = l.previousQuantity + l.pendingQuantity + l.currentQuantity;
    if (committed > l.contractQuantity) return `جمع مقدار (${formatInt(committed)}) از مقدار قرارداد بیشتر است`;
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.length) return setError('مقدار این دوره حداقل یک ردیف را وارد کنید.');
    if (lines.some((l) => l.currentQuantity > 0 && (!l.description.trim() || !l.unit.trim() || l.contractQuantity <= 0 || l.unitRate <= 0))) {
      return setError('برای ردیف‌های جدید شرح، واحد، مقدار قرارداد و نرخ الزامی است.');
    }
    const keys = items.map((i) => lineKey(i.description, i.unit));
    if (new Set(keys).size !== keys.length) return setError('ردیف تکراری وجود دارد.');
    const now = new Date();
    const statement: SubcontractorProgressStatement = {
      id: generateUUID(),
      statementNumber,
      subcontractorContractId: selectedContract.id,
      subcontractorContractNumber: selectedContract.contractNumber,
      costCenterId: selectedContract.costCenterId,
      counterpartyId: selectedContract.counterpartyId,
      subcontractorName: selectedContract.subcontractorName,
      tradeType: selectedContract.tradeType,
      projectId: selectedContract.projectId,
      projectName: selectedContract.projectName,
      periodStartDate,
      periodEndDate,
      submissionDate: toPersianDate(now),
      items,
      grossAmount,
      siteVerifiedAmount: grossAmount,
      deductions: {
        retention: retentionAmount,
        advancePaymentDeduction: advanceDeduction,
        safetyOrWastePenalty: penaltyAmount,
        otherDeductions: otherDeduction,
        description: `کسر ${toPersianDigits(retentionRate)}٪ سپرده حسن انجام کار و استهلاک پیش‌پرداخت`,
      },
      totalDeductions,
      netPayable,
      paidAmount: 0,
      remainingPayable: netPayable,
      status: 'submitted',
      workflowHistory: [
        {
          date: toPersianDate(now),
          time: toPersianTime(now),
          user: currentUser.name,
          role: currentUser.role,
          fromStatus: 'submitted',
          toStatus: 'submitted',
          action: 'ثبت صورت‌وضعیت در سامانه',
          comment: `کارکرد دوره ${periodStartDate} الی ${periodEndDate}`,
        },
      ],
    };
    const validation = validateSubcontractorStatement(state, statement);
    if (validation) return setError(validation);
    const result = onSave(statement);
    if (!result.ok) return setError(result.message);
    onClose();
  };

  const input = 'w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs';

  return (
    <Dialog
      as="form"
      onSubmit={handleSubmit}
      onClose={onClose}
      label="ثبت صورت‌وضعیت جدید پیمانکار جزء"
      overlayClassName="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto"
      className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8"
    >
      <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-500/10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">ثبت صورت‌وضعیت جدید پیمانکار جزء</h3>
            <p className="text-xs text-slate-500">مقدار قبلی هر ردیف از صورت‌وضعیت‌های تأییدشده خوانده می‌شود و قابل ویرایش نیست.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="بستن" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
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
                setStatementNumber(`صورت‌وضعیت شماره ${toPersianDigits(statementsOfContract(e.target.value) + 1)}`);
              }}
              className="mt-1.5 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
            >
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.projectName} — {c.tradeType} ({c.subcontractorName})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700 block">
            عنوان / شماره صورت‌وضعیت:
            <input type="text" required value={statementNumber} onChange={(e) => setStatementNumber(e.target.value)} className="mt-1.5 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
          </label>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-slate-400 block text-[10px]">پیمانکار:</span>
            <strong className="text-slate-900">{selectedContract.subcontractorName}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">مبلغ قرارداد:</span>
            <strong className="text-amber-800">{formatMoneyCompact(selectedContract.contractValue)}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">کارکرد تاکنون:</span>
            <strong className="text-blue-700">{formatMoneyCompact(selectedContract.executedValue)}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">مانده پیش‌پرداخت قابل استهلاک:</span>
            <strong className="text-slate-700">{formatMoney(remainingAdvance)}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-xs font-bold text-slate-700 block">
            شروع دوره کارکرد:
            <input type="text" value={periodStartDate} onChange={(e) => setPeriodStartDate(e.target.value)} className="mt-1.5 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono" />
          </label>
          <label className="text-xs font-bold text-slate-700 block">
            پایان دوره کارکرد:
            <input type="text" value={periodEndDate} onChange={(e) => setPeriodEndDate(e.target.value)} className="mt-1.5 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono" />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-900">ردیف‌های کارکرد:</span>
            <button type="button" onClick={addLine} className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن ردیف جدید</span>
            </button>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5">شرح عملیات</th>
                  <th className="p-2.5 w-20 text-center">واحد</th>
                  <th className="p-2.5 w-24 text-center">مقدار قرارداد</th>
                  <th className="p-2.5 w-24 text-center">قبلی (تأییدشده)</th>
                  <th className="p-2.5 w-24 text-center">مقدار این دوره</th>
                  <th className="p-2.5 w-28 text-left">نرخ واحد ({moneyUnitLabel()})</th>
                  <th className="p-2.5 w-28 text-left">مبلغ دوره</th>
                  <th className="p-2.5 w-10 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => {
                  const err = lineError(l);
                  return (
                    <tr key={l.id} className={err ? 'bg-rose-50/60' : 'hover:bg-slate-50'}>
                      <td className="p-2">
                        {l.locked ? (
                          <span className="flex items-center gap-1 font-medium text-slate-800">
                            <Lock className="w-3 h-3 text-slate-400" aria-label="از تاریخچه تأییدشده" />
                            {l.description}
                          </span>
                        ) : (
                          <input type="text" aria-label="شرح عملیات" value={l.description} onChange={(e) => update(l.id, { description: e.target.value })} className={input} />
                        )}
                        {err && <span className="block text-[10px] text-rose-700 font-bold mt-0.5">{err}</span>}
                        {l.pendingQuantity > 0 && <span className="block text-[10px] text-amber-700">در جریان تأیید: {formatInt(l.pendingQuantity)}</span>}
                      </td>
                      <td className="p-2 text-center">
                        {l.locked ? l.unit : <input type="text" aria-label="واحد" value={l.unit} onChange={(e) => update(l.id, { unit: e.target.value })} className={`${input} text-center`} />}
                      </td>
                      <td className="p-2 text-center font-mono">
                        {l.locked ? formatInt(l.contractQuantity) : <IntegerInput aria-label="مقدار قرارداد" value={l.contractQuantity} onValueChange={(v) => update(l.id, { contractQuantity: v })} className={`${input} text-center`} />}
                      </td>
                      <td className="p-2 text-center font-mono text-slate-600">{formatInt(l.previousQuantity)}</td>
                      <td className="p-2">
                        <IntegerInput aria-label="مقدار این دوره" value={l.currentQuantity} onValueChange={(v) => update(l.id, { currentQuantity: v })} aria-invalid={!!err} className={`${input} text-center font-bold`} />
                      </td>
                      <td className="p-2 text-left font-mono">
                        {l.locked ? formatMoney(l.unitRate, false) : <MoneyInput aria-label="نرخ واحد" value={l.unitRate} onValueChange={(v) => update(l.id, { unitRate: v })} className={`${input} text-left`} />}
                      </td>
                      <td className="p-2 text-left font-black text-slate-900 font-mono">{formatMoney(roundRial(l.currentQuantity * l.unitRate), false)}</td>
                      <td className="p-2 text-center">
                        {!l.locked && (
                          <button type="button" aria-label="حذف ردیف" onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lines.length === 0 && <p className="py-6 text-center text-xs text-slate-400">این قرارداد هنوز ردیف تأییدشده‌ای ندارد؛ ردیف جدید اضافه کنید.</p>}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <span className="text-xs font-bold text-slate-800 block">کسورات پیمانکار جزء:</span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <label className="text-[11px] text-slate-500 block">
              درصد سپرده حسن انجام کار:
              <IntegerInput value={retentionRate} onValueChange={(v) => setRetentionRate(Math.min(100, v))} className="mt-1 w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" />
              <span className="text-[10px] text-slate-400 block mt-0.5">{formatMoney(retentionAmount)}</span>
            </label>
            <label className="text-[11px] text-slate-500 block">
              استهلاک پیش‌پرداخت (حداکثر {formatMoney(remainingAdvance)}):
              <MoneyInput
                value={advanceDeduction}
                onValueChange={(v) => {
                  setAdvanceDeduction(Math.min(v, remainingAdvance));
                  setError(null);
                }}
                className="mt-1 w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </label>
            <label className="text-[11px] text-slate-500 block">
              جریمه ایمنی یا پرت مصالح:
              <MoneyInput value={penaltyAmount} onValueChange={setPenaltyAmount} className="mt-1 w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
            </label>
            <label className="text-[11px] text-slate-500 block">
              سایر کسورات کارگاهی:
              <MoneyInput value={otherDeduction} onValueChange={setOtherDeduction} className="mt-1 w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" />
            </label>
          </div>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs text-amber-900 block font-bold">مبلغ ناخالص کارکرد:</span>
            <span className="text-lg font-black text-slate-900">{formatMoney(grossAmount)}</span>
          </div>
          <div>
            <span className="text-xs text-amber-900 block font-bold">مجموع کسورات:</span>
            <span className="text-lg font-black text-rose-700">{formatMoney(totalDeductions)}</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-2xs">
            <span className="text-xs text-slate-500 block">خالص قابل مطالبه پیمانکار:</span>
            <span className="text-xl font-black text-emerald-700">{formatMoney(netPayable)}</span>
          </div>
        </div>

        {error && (
          <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer">
            انصراف
          </button>
          <button type="submit" className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-xs">
            ثبت صورت‌وضعیت و ارسال به اندازه‌گیری
          </button>
        </div>
      </div>
    </Dialog>
  );
};
