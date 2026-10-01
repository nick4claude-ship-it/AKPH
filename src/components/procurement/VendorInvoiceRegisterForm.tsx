/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { MoneyInput } from '../../ui/NumberInput';
import { formatText } from '../../utils/formatters';
import { Money } from '../common/Money';

interface VendorInvoiceRegisterFormProps {
  onToast: (msg: string) => void;
}

/**
 * Registers the supplier's invoice against a goods/service receipt that has none yet (akph/v1). The server runs the
 * three-way match (order rate × received quantity, tolerance, freight, VAT) and keeps a mismatched invoice stopped.
 */
export const VendorInvoiceRegisterForm: React.FC<VendorInvoiceRegisterFormProps> = ({ onToast }) => {
  const wf = useWorkflows();
  const { goodsReceipts } = useAppState();
  const open = goodsReceipts.filter((g) => g.server?.status === 'open');
  const [grnId, setGrnId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState(0);
  const [freight, setFreight] = useState(0);
  const [vatAmount, setVatAmount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  if (open.length === 0) return null;
  const grn = open.find((g) => g.id === grnId);

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="btn btn-primary">
        <Plus className="w-4 h-4" />
        <span>ثبت فاکتور فروشنده برای رسید</span>
      </button>
    );
  }
  return (
    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-sm space-y-2">
      <label className="block text-xs text-slate-600">
        رسید انبار / خدمات بدون فاکتور
        <select value={grnId} onChange={(e) => setGrnId(e.target.value)} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white">
          <option value="">— انتخاب رسید —</option>
          {open.map((g) => (
            <option key={g.id} value={g.id}>
              {formatText(g.receiptNumber)} — {formatText(g.supplierName)}
            </option>
          ))}
        </select>
      </label>
      {grn && (
        <div className="text-xs text-slate-600">
          ارزش رسید به نرخ سفارش: <span className="font-bold tabular-nums"><Money rial={grn.totalAmount} /></span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="block text-xs text-slate-600">
          شماره فاکتور
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white" />
        </label>
        <label className="block text-xs text-slate-600">
          تاریخ فاکتور
          <input value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} placeholder="۱۴۰۵/۰۶/۲۰" className="mt-1 w-full p-2 rounded border border-slate-300 bg-white" />
        </label>
        <label className="block text-xs text-slate-600">
          سررسید
          <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="۱۴۰۵/۰۷/۲۰" className="mt-1 w-full p-2 rounded border border-slate-300 bg-white" />
        </label>
        <label className="block text-xs text-slate-600">
          مبلغ کالا/خدمت (بدون مالیات)
          <MoneyInput value={subtotal} onValueChange={setSubtotal} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white" />
        </label>
        <label className="block text-xs text-slate-600">
          کرایه حمل
          <MoneyInput value={freight} onValueChange={setFreight} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white" />
        </label>
        <label className="block text-xs text-slate-600">
          ارزش افزوده فاکتور
          <MoneyInput value={vatAmount} onValueChange={setVatAmount} className="mt-1 w-full p-2 rounded border border-slate-300 bg-white" />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setExpanded(false)} className="btn btn-secondary">
          انصراف
        </button>
        <button
          type="button"
          disabled={!grnId || !invoiceNo.trim() || subtotal <= 0}
          onClick={() => {
            onToast(wf.registerVendorInvoice(grnId, { invoiceNo, invoiceDate, dueDate, subtotal, freight, vatAmount }).message);
            setExpanded(false);
            setGrnId('');
          }}
          className="btn btn-primary disabled:opacity-40"
        >
          ثبت و تطبیق سه‌جانبه
        </button>
      </div>
    </div>
  );
};
