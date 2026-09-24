import React, { useState } from 'react';
import { X, CheckCircle2, Building2, Coins, Receipt, FileText, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Project, PettyCash } from '../../types';

interface QuickActionModalProps {
  actionKey: string | null;
  actionTitle: string | null;
  onClose: () => void;
  projects: Project[];
  pettyCashList: PettyCash[];
  onSuccess: (message: string) => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  actionKey,
  actionTitle,
  onClose,
  projects,
  pettyCashList,
  onSuccess,
}) => {
  if (!actionKey) return null;

  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [category, setCategory] = useState('مصالح');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSuccess(`درخواست «${actionTitle}» با موفقیت در سیستم ثبت گردید و به کارتابل ناظر ارجاع شد.`);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-right">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{actionTitle}</h3>
              <p className="text-[11px] text-slate-400">میانبر سریع ثبت عملیات در هسته مالی</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Project select */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">انتخاب پروژه مربوطه:</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">مبلغ عملیات (تومان):</label>
            <input
              type="text"
              required
              placeholder="مثال: ۲۵,۰۰۰,۰۰۰"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-amber-500 text-left"
            />
          </div>

          {/* Counterparty / Vendor */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">طرف حساب / کارفرما / پیمانکار:</label>
            <input
              type="text"
              placeholder="نام شخص یا شرکت..."
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Category */}
          {(actionKey === 'record_expense' || actionKey === 'record_invoice') && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">سرفصل و ساختار هزینه:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
              >
                <option value="مصالح">مصالح پایه و ساختمانی</option>
                <option value="نیروی انسانی">دستمزد و نیروی انسانی</option>
                <option value="ماشین‌آلات">ماشین‌آلات و تجهیزات سنگین</option>
                <option value="حمل‌ونقل">حمل‌ونقل و باربری</option>
                <option value="پیمانکاران جزء">پیمانکاران جزء و تخصصی</option>
                <option value="خرید">خرید تجهیزات خاص</option>
                <option value="اداری">اداری و ستادی دفتر مرکزی</option>
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">شرح و توضیحات تکمیلی سند:</label>
            <textarea
              rows={2}
              placeholder="توضیحات فنی، شماره حواله یا قرارداد..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'در حال ثبت...' : 'ثبت قطعی در سامانه'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
