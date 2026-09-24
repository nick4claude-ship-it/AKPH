import React from 'react';
import { PendingApproval } from '../../types';
import { formatCurrencyCompact, formatNumber } from '../../utils/formatters';
import { X, FileText, CheckCircle2, ShieldCheck, Download, Printer } from 'lucide-react';

interface DocumentViewerModalProps {
  item: PendingApproval | null;
  onClose: () => void;
  onApprove: (id: string) => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  item,
  onClose,
  onApprove,
}) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-right">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white">مشاهده سند مالی و فاکتور پیوست</h3>
                <span className="font-mono text-[10px] bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded">
                  {item.docNumber}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{item.projectName} · {item.costCenter}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Voucher Sheet Presentation */}
        <div className="p-6 space-y-4 text-xs font-sans">
          {/* Top metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono">
            <div>
              <span className="text-[10px] text-slate-500 block font-sans">شماره سند</span>
              <span className="font-bold text-slate-900">{item.docNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-sans">تاریخ ثبت</span>
              <span className="font-bold text-slate-900">{item.date}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-sans">ثبت‌کننده</span>
              <span className="font-bold text-slate-900 font-sans text-[11px]">{item.submitter}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-sans">طرف حساب (فروشنده)</span>
              <span className="font-bold text-slate-900 font-sans text-[11px]">{item.counterparty}</span>
            </div>
          </div>

          {/* Core financial accounting card */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100/70 p-2.5 font-bold text-slate-800 border-b border-slate-200 flex justify-between items-center">
              <span>شرح ردیف‌های هزینه و تراز سند</span>
              <span className="text-[11px] font-normal text-slate-500">طبقه: {item.costClassification}</span>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-600">شرح هزینه / کالا:</span>
                <span className="font-medium text-slate-900">{item.notes || item.expenseType}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-600">سرفصل حسابداری:</span>
                <span className="font-medium text-slate-900">{item.category} ({item.expenseType})</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 font-mono">
                <span className="text-slate-600 font-sans">مبلغ کل بر اساس فاکتور رسمی:</span>
                <span className="font-bold text-slate-900 text-sm">{formatCurrencyCompact(item.amount)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 font-mono">
                <span className="text-slate-600 font-sans">مبلغ پرداخت‌شده (چک / نقد):</span>
                <span className="font-bold text-emerald-700">{formatCurrencyCompact(item.paymentAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-1 font-mono">
                <span className="text-slate-600 font-sans">مانده تعهد بدهی شرکت:</span>
                <span className="font-bold text-rose-600">{formatCurrencyCompact(item.pendingLiability)}</span>
              </div>
            </div>
          </div>

          {/* Attached Document Visual Simulation */}
          <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold font-mono text-xs">
                PDF
              </div>
              <div>
                <p className="font-bold text-slate-900">{item.attachmentName}</p>
                <p className="text-[10px] text-slate-500">حجم: ۱.۴ مگابایت · دارای امضای دیجیتال ناظر پروژه</p>
              </div>
            </div>
            <button
              onClick={() => {
                const blob = new Blob(
                  [`پیوست سند شرکت پیمانکاری\nنام فایل: ${item.attachmentName}\nشماره سند: ${item.docNumber}\nپروژه: ${item.projectName}`],
                  { type: 'application/pdf' }
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = item.attachmentName || 'document.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
          >
            بستن پنجره
          </button>
          <button
            onClick={() => {
              onApprove(item.id);
              onClose();
            }}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>تأیید فوری سند توسط مدیرعامل</span>
          </button>
        </div>
      </div>
    </div>
  );
};
