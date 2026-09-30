/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MoneyInput, QuantityInput } from '../../ui/NumberInput';
import { useSelector } from '../../store/AppStore';
import { blankContractLine, contractLineAmount, contractLinesTotal, type ContractLineInput } from '../../store/views/contracts';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { Money } from '../common/Money';

interface ContractLinesEditorProps {
  lines: ContractLineInput[];
  onChange: (lines: ContractLineInput[]) => void;
  /** Prefix of the controls' ids (two editors may be on one page). */
  idPrefix: string;
}

/**
 * BOQ lines of a new contract (row, code, description, unit, quantity, rate). The contract amount is the
 * total of quantity × rate; with the official books the server computes it again and keeps its own figure.
 */
export const ContractLinesEditor: React.FC<ContractLinesEditorProps> = ({ lines, onChange, idPrefix }) => {
  const total = useSelector(() => contractLinesTotal(lines), [JSON.stringify(lines)]);
  const amountOf = useSelector(() => (l: ContractLineInput) => contractLineAmount(l), []);
  const update = (id: string, patch: Partial<ContractLineInput>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const cell = 'w-full p-2 rounded border border-slate-300 bg-white text-sm';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-slate-700 font-bold text-sm">فهرست بها و مقادیر قرارداد (BOQ):</span>
        <button type="button" onClick={() => onChange([...lines, blankContractLine()])} className="text-sm font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
          <span>افزودن ردیف</span>
        </button>
      </div>
      <div className="border border-slate-200 rounded-xl table-scroll">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <th className="p-2 w-20">کد</th>
              <th className="p-2">شرح عملیات</th>
              <th className="p-2 w-20 text-center">واحد</th>
              <th className="p-2 w-24 text-center">مقدار</th>
              <th className="p-2 w-28 text-left">نرخ واحد ({moneyUnitLabel()})</th>
              <th className="p-2 w-28 text-left">مبلغ</th>
              <th className="p-2 w-10 text-center">حذف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, i) => (
              <tr key={l.id}>
                <td className="p-2">
                  <input id={`${idPrefix}-code-${i}`} aria-label="کد ردیف" type="text" value={l.code} onChange={(e) => update(l.id, { code: e.target.value })} className={`${cell} tabular-nums`} />
                </td>
                <td className="p-2">
                  <input aria-label="شرح عملیات" type="text" value={l.description} onChange={(e) => update(l.id, { description: e.target.value })} className={cell} />
                </td>
                <td className="p-2">
                  <input aria-label="واحد" type="text" value={l.unit} onChange={(e) => update(l.id, { unit: e.target.value })} className={`${cell} text-center`} />
                </td>
                <td className="p-2">
                  <QuantityInput aria-label="مقدار" value={l.quantity} onValueChange={(v) => update(l.id, { quantity: v })} className={`${cell} text-center`} />
                </td>
                <td className="p-2">
                  <MoneyInput aria-label="نرخ واحد" value={l.rate} onValueChange={(v) => update(l.id, { rate: v })} className={`${cell} text-left`} />
                </td>
                <td className="p-2 text-left tabular-nums font-bold">{formatMoney(amountOf(l), false)}</td>
                <td className="p-2 text-center">
                  <button type="button" aria-label="حذف ردیف" onClick={() => onChange(lines.filter((x) => x.id !== l.id))} className="text-slate-500 hover:text-rose-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lines.length === 0 && <p className="py-4 text-center text-xs text-slate-500">ردیفی ثبت نشده است.</p>}
      </div>
      <p className="text-xs text-slate-600">
        جمع مبلغ ردیف‌ها (مبلغ قرارداد): <strong className="tabular-nums"><Money rial={total} /></strong>
      </p>
    </div>
  );
};
