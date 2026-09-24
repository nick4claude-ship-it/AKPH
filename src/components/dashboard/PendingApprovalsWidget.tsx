import React, { useState } from 'react';
import { ApprovalItem } from '../../types';
import { formatCurrencyCompact, formatNumber } from '../../utils/formatters';
import { CheckCircle2, XCircle, FileText, AlertCircle, Clock, Eye, Check, X } from 'lucide-react';

interface PendingApprovalsWidgetProps {
  approvals: ApprovalItem[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onViewDoc: (item: ApprovalItem) => void;
}

export const PendingApprovalsWidget: React.FC<PendingApprovalsWidgetProps> = ({
  approvals,
  onApprove,
  onReject,
  onViewDoc,
}) => {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const pendingList = approvals;

  const handleConfirmReject = (id: string) => {
    onReject(id, rejectReason || 'عدم تطابق با مستندات پیوست');
    setRejectingId(null);
    setRejectReason('');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>کارتابل هزینه‌های در انتظار تأیید</span>
              <span className="text-[11px] font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
                {pendingList.length} سند جدید
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              بررسی و تأیید/رد فاکتورهای تنخواه، خریدهای مستقیم، ماشین‌آلات و اسناد مالی توسط مدیرعامل
            </p>
          </div>
        </div>
      </div>

      {/* Approvals Table / Card Stack */}
      <div className="overflow-x-auto mt-3">
        {pendingList.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            تمام اسناد و هزینه‌ها بررسی و تعیین تکلیف شده‌اند.
          </div>
        ) : (
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                <th className="py-2.5 px-3">شماره سند</th>
                <th className="py-2.5 px-3">پروژه و مرکز هزینه</th>
                <th className="py-2.5 px-3">ثبت‌کننده و طرف حساب</th>
                <th className="py-2.5 px-3">نوع رکورد / مرحله</th>
                <th className="py-2.5 px-3 text-left">مبلغ کل هزینه</th>
                <th className="py-2.5 px-3 text-left">مرحله / پیوست</th>
                <th className="py-2.5 px-3 text-center">تاریخ</th>
                <th className="py-2.5 px-3 text-center">مستند</th>
                <th className="py-2.5 px-3 text-center">دستور مدیرعامل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Doc Number */}
                  <td className="py-3 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                    {item.docNumber}
                  </td>

                  {/* Project & Cost Center */}
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{item.projectName}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-44">
                      {item.costCenterName || '-'}
                    </div>
                  </td>

                  {/* Submitter & Counterparty */}
                  <td className="py-3 px-3">
                    <div className="text-slate-800 font-medium">{item.requester}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-36">
                      طرف حساب: {item.counterpartyName || '-'}
                    </div>
                  </td>

                  {/* Expense Type & Classification */}
                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-800">{item.moduleLabel}</span>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <span className="text-amber-700 font-semibold">{item.stage}</span>
                      <span>·</span>
                      <span>{item.classification}</span>
                    </div>
                  </td>

                  {/* Total Amount */}
                  <td className="py-3 px-3 font-mono tabular-nums text-left font-bold text-slate-900">
                    {formatCurrencyCompact(item.amount)}
                  </td>

                  {/* Payment vs Debt (Expense != Payment principle) */}
                  <td className="py-3 px-3 font-mono tabular-nums text-left text-[11px]">
                    <div className="text-slate-500">تأییدکننده: {item.approverRole}</div>
                    <div className={item.documentCount ? 'text-emerald-700' : 'text-rose-600 font-medium'}>
                      {item.documentCount ? `${item.documentCount.toLocaleString('fa-IR')} سند پیوست` : 'بدون سند پیوست'}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3 px-3 text-center text-slate-600 font-mono text-[11px] whitespace-nowrap">
                    {item.date}
                  </td>

                  {/* View Doc Button */}
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => onViewDoc(item)}
                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                      title="مشاهده فاکتور و ضمائم"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">سند</span>
                    </button>
                  </td>

                  {/* Approve / Reject Actions */}
                  <td className="py-3 px-3 text-center">
                    {rejectingId === item.id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <input
                          type="text"
                          placeholder="علت رد..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="text-[11px] border border-rose-300 rounded px-1.5 py-0.5 w-24 focus:outline-none"
                        />
                        <button
                          onClick={() => handleConfirmReject(item.id)}
                          className="bg-rose-600 text-white p-1 rounded hover:bg-rose-700 cursor-pointer"
                          title="تأیید رد سند"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setRejectingId(null)}
                          className="bg-slate-200 text-slate-700 p-1 rounded hover:bg-slate-300 cursor-pointer"
                          title="انصراف"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 justify-center">
                        <button
                          onClick={() => onApprove(item.id)}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                        >
                          <Check className="w-3 h-3" />
                          <span>تأیید</span>
                        </button>
                        <button
                          onClick={() => setRejectingId(item.id)}
                          className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          <span>رد</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
