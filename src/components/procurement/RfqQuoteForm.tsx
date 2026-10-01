/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { RequestForQuotation } from '../../types';
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { MoneyInput, IntegerInput } from '../../ui/NumberInput';
import { formatDecimal, formatText } from '../../utils/formatters';

interface RfqQuoteFormProps {
  rfq: RequestForQuotation;
  onToast?: (msg: string) => void;
}

/**
 * A supplier's quote for an open RFQ (akph/v1): a rate for every line of the requisition, VAT, freight and
 * delivery. The server computes the amounts and keeps the quote; the winner is chosen in the comparison table.
 */
export const RfqQuoteForm: React.FC<RfqQuoteFormProps> = ({ rfq, onToast }) => {
  const wf = useWorkflows();
  const { purchaseRequisitions, counterparties } = useAppState();
  const lines = purchaseRequisitions.find((r) => r.id === rfq.requisitionId)?.items || [];
  const suppliers = counterparties.filter((c) => c.kind === 'supplier');
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [rates, setRates] = useState<Record<string, number>>({});
  const [vatIncluded, setVatIncluded] = useState(true);
  const [freight, setFreight] = useState(0);
  const [deliveryDays, setDeliveryDays] = useState(7);
  const [paymentTerms, setPaymentTerms] = useState('');
  if (rfq.server?.status !== 'open') return null;
  const ready = supplierId && lines.every((l) => (rates[l.id] || 0) > 0);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-2 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-sm font-bold cursor-pointer">
        <Plus className="w-4 h-4" /> ثبت پیشنهاد فروشنده
      </button>
    );
  }
  return (
    <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-sm">
      <label className="block text-xs text-slate-600">
        فروشنده
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white">
          <option value="">— انتخاب تأمین‌کننده —</option>
          {suppliers.map((c) => (
            <option key={c.id} value={c.id}>
              {formatText(c.name)}
            </option>
          ))}
        </select>
      </label>
      {lines.map((l) => (
        <label key={l.id} className="block text-xs text-slate-600">
          نرخ {formatText(l.materialName)} ({formatDecimal(l.requestedQty)} {formatText(l.unit)})
          <MoneyInput value={rates[l.id] || 0} onValueChange={(v) => setRates((prev) => ({ ...prev, [l.id]: v }))} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white" />
        </label>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-slate-600">
          کرایه حمل
          <MoneyInput value={freight} onValueChange={setFreight} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white" />
        </label>
        <label className="block text-xs text-slate-600">
          مهلت تحویل (روز)
          <IntegerInput value={deliveryDays} onValueChange={setDeliveryDays} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white" />
        </label>
        <label className="block text-xs text-slate-600">
          شماره پیش‌فاکتور
          <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white" />
        </label>
        <label className="block text-xs text-slate-600">
          شرایط پرداخت
          <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input type="checkbox" checked={vatIncluded} onChange={(e) => setVatIncluded(e.target.checked)} />
        مشمول ارزش افزوده (نرخ تنظیمات)
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          انصراف
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            onToast?.(wf.addRfqQuote(rfq.id, { supplierId, reference, rates, vatIncluded, freight, deliveryDays, paymentTerms }).message);
            setOpen(false);
          }}
          className="btn btn-primary disabled:opacity-40"
        >
          ثبت پیشنهاد
        </button>
      </div>
    </div>
  );
};
