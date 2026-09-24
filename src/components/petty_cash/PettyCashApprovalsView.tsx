import React, { useState } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  FileText,
  AlertTriangle,
  Building2,
  User,
  Calendar,
  Layers,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { PettyCashExpense, User as AppUser } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface PettyCashApprovalsViewProps {
  expenses: PettyCashExpense[];
  currentUser: AppUser;
  onApproveExpense: (expenseId: string, comment?: string) => void;
  onRejectExpense: (expenseId: string, reason: string) => void;
  onReturnExpense: (expenseId: string, comment: string) => void;
}

export const PettyCashApprovalsView: React.FC<PettyCashApprovalsViewProps> = ({
  expenses,
  currentUser,
  onApproveExpense,
  onRejectExpense,
  onReturnExpense,
}) => {
  const [filterTab, setFilterTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

  // Rejection & Return Modal States
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [returnError, setReturnError] = useState(false);

  const pendingList = expenses.filter(
    (e) => e.status === 'pending_approval' || e.status === 'submitted'
  );
  const approvedList = expenses.filter(
    (e) => e.status === 'approved' || e.status === 'accounting_posted'
  );
  const rejectedList = expenses.filter(
    (e) => e.status === 'rejected' || e.status === 'returned_for_correction'
  );

  const displayedList =
    filterTab === 'pending'
      ? pendingList
      : filterTab === 'approved'
      ? approvedList
      : rejectedList;

  // Auto-select first item if none selected
  const activeExpense =
    expenses.find((e) => e.id === selectedExpenseId) || displayedList[0] || null;

  const handleApprove = () => {
    if (!activeExpense) return;
    onApproveExpense(activeExpense.id, 'تأیید نهایی بر اساس فاکتور و کنترل با سرفصل بودجه');
  };

  const handleConfirmReject = () => {
    if (!activeExpense || !rejectReason.trim()) {
      setRejectError(true);
      return;
    }
    setRejectError(false);
    onRejectExpense(activeExpense.id, rejectReason);
    setIsRejectModalOpen(false);
    setRejectReason('');
  };

  const handleConfirmReturn = () => {
    if (!activeExpense || !returnComment.trim()) {
      setReturnError(true);
      return;
    }
    setReturnError(false);
    onReturnExpense(activeExpense.id, returnComment);
    setIsReturnModalOpen(false);
    setReturnComment('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            کارتابل تأیید و کنترل چندمرحله‌ای هزینه‌های تنخواه
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            بررسی مدارک، فاکتورها، انطباق با پروژه و ثبت نهایی در هزینه‌های دفتری حسابداری
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setFilterTab('pending');
              if (pendingList.length > 0) setSelectedExpenseId(pendingList[0].id);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              filterTab === 'pending'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>در انتظار تأیید</span>
            {pendingList.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full tabular-nums">
                {pendingList.length.toLocaleString('fa-IR')}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setFilterTab('approved');
              if (approvedList.length > 0) setSelectedExpenseId(approvedList[0].id);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              filterTab === 'approved'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>تأیید شده / ثبتی</span>
            <span className="text-[10px] text-slate-500 tabular-nums">
              ({approvedList.length.toLocaleString('fa-IR')})
            </span>
          </button>

          <button
            onClick={() => {
              setFilterTab('rejected');
              if (rejectedList.length > 0) setSelectedExpenseId(rejectedList[0].id);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              filterTab === 'rejected'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>رد شده / اصلاحی</span>
            {rejectedList.length > 0 && (
              <span className="bg-slate-300 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full tabular-nums">
                {rejectedList.length.toLocaleString('fa-IR')}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Split Layout: List (Left) + Detail Dossier & In-place Invoice (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: List of items (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {displayedList.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              هیچ هزینه‌ای در این وضعیت وجود ندارد.
            </div>
          ) : (
            displayedList.map((exp) => {
              const isSelected = activeExpense?.id === exp.id;
              return (
                <div
                  key={exp.id}
                  onClick={() => setSelectedExpenseId(exp.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 relative ${
                    isSelected
                      ? 'bg-amber-50/50 border-amber-500 shadow-sm ring-1 ring-amber-400'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {exp.expenseNumber}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500">
                          {exp.category}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 line-clamp-1 mt-1">
                        {exp.description}
                      </h4>
                    </div>

                    <div className="text-left font-mono font-bold text-xs text-slate-900 tabular-nums shrink-0">
                      {formatCurrency(exp.amount)}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{exp.projectName}</span>
                    </div>
                    <span className="shrink-0">{exp.date}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="text-slate-600 font-medium">ثبت: {exp.submitterName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-semibold ${
                        exp.status === 'approved' || exp.status === 'accounting_posted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : exp.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {exp.status === 'approved' || exp.status === 'accounting_posted'
                        ? 'تأیید قطعی'
                        : exp.status === 'rejected'
                        ? 'رد شده'
                        : 'در انتظار تأیید'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Full Detail Dossier & In-place Invoice Preview (7 cols) */}
        <div className="lg:col-span-7">
          {activeExpense ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden sticky top-32">
              {/* Dossier Header */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                      {activeExpense.expenseNumber}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs font-medium text-slate-600">
                      تنخواه: {activeExpense.pettyCashTitle}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-900 mt-1">
                    {activeExpense.description}
                  </h3>
                </div>

                <div className="text-left">
                  <div className="text-xs text-slate-500">مبلغ نهایی فاکتور:</div>
                  <div className="text-lg font-black text-slate-900 font-mono tabular-nums">
                    {formatCurrency(activeExpense.amount)}
                  </div>
                </div>
              </div>

              {/* Dossier Body */}
              <div className="p-5 space-y-5">
                {/* Meta details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">پروژه / مرکز هزینه</span>
                    <span className="font-bold text-slate-800 mt-0.5 block truncate">
                      {activeExpense.projectName}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">سرفصل هزینه</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {activeExpense.category} ({activeExpense.subCategory})
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">فروشنده / طرف حساب</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {activeExpense.vendor}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">شماره و تاریخ فاکتور</span>
                    <span className="font-mono font-bold text-slate-800 mt-0.5 block">
                      {activeExpense.invoiceNumber} - {activeExpense.invoiceDate}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">روش پرداخت</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {activeExpense.paymentMethod}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">ثبت‌کننده سند</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {activeExpense.submitterName} ({activeExpense.submitterRole})
                    </span>
                  </div>
                </div>

                {/* Inventory Allocation Info (Section 20) */}
                {activeExpense.inventoryTarget === 'send_to_warehouse' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-blue-900">
                        تحویل به انبار کارگاه ({activeExpense.inventoryItemName || 'کالای انبار'})
                      </div>
                      <div className="text-[11px] text-blue-700 mt-0.5">
                        کد کالا: {activeExpense.inventoryItemCode || '-'} | تعداد:{' '}
                        {activeExpense.inventoryQuantity} {activeExpense.inventoryUnit}
                      </div>
                    </div>
                    <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-medium">
                      رسید انبار صادر شد
                    </span>
                  </div>
                )}

                {/* In-place Invoice Image Preview (Section 25) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-600" />
                      پیش‌نمایش تصویر فاکتور و مدارک پیوست:
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {activeExpense.attachments.length} پیوست
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col items-center justify-center min-h-[220px]">
                    {activeExpense.attachments[0]?.url ? (
                      <div className="relative group w-full flex justify-center">
                        <img
                          src={activeExpense.attachments[0].url}
                          alt="Invoice Scan"
                          className="max-h-56 rounded-lg object-contain border border-slate-200 shadow-2xs"
                        />
                        <a
                          href={activeExpense.attachments[0].url}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-2 bg-slate-900/80 text-white text-[10px] px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          مشاهده در ابعاد کامل
                        </a>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <span className="text-xs font-medium">
                          {activeExpense.attachments[0]?.name || 'فایل فاکتور بارگذاری شده'}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          ({activeExpense.attachments[0]?.size || '1.1 MB'})
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Multi-Level Approval Stages Stepper (Section 10) */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">گردش کار تایید چندمرحله‌ای:</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      سطح الزامی:{' '}
                      {activeExpense.approvalLevelRequired === 'ceo_full'
                        ? 'تایید مدیرعامل (> ۱۰۰ میلیون)'
                        : activeExpense.approvalLevelRequired === 'project_and_finance'
                        ? 'تایید مدیر پروژه و مالی (۲۰ تا ۱۰۰ میلیون)'
                        : 'سرپرست کارگاه و مالی (< ۲۰ میلیون)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-2">
                    <div className="flex-1 text-center">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-[10px] font-bold">
                        ✓
                      </div>
                      <span className="text-[10px] font-medium text-slate-700 block mt-1">
                        ثبت کارپرداز
                      </span>
                    </div>

                    <div className="h-0.5 flex-1 bg-emerald-500" />

                    <div className="flex-1 text-center">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-[10px] font-bold ${
                          activeExpense.status === 'approved' || activeExpense.status === 'accounting_posted'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-amber-500 text-slate-950 font-bold'
                        }`}
                      >
                        {activeExpense.status === 'approved' || activeExpense.status === 'accounting_posted' ? '✓' : '۲'}
                      </div>
                      <span className="text-[10px] font-medium text-slate-700 block mt-1">
                        مدیر مالی
                      </span>
                    </div>

                    {activeExpense.approvalLevelRequired === 'ceo_full' && (
                      <>
                        <div
                          className={`h-0.5 flex-1 ${
                            activeExpense.status === 'approved' || activeExpense.status === 'accounting_posted'
                              ? 'bg-emerald-500'
                              : 'bg-slate-200'
                          }`}
                        />
                        <div className="flex-1 text-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-[10px] font-bold ${
                              activeExpense.status === 'approved' || activeExpense.status === 'accounting_posted'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            ۳
                          </div>
                          <span className="text-[10px] font-medium text-slate-700 block mt-1">
                            مدیرعامل
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Rejection / Returned banner if applicable */}
                {activeExpense.rejectionReason && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                    <strong className="block mb-1">دلیل رد توسط مدیر مالی:</strong>
                    {activeExpense.rejectionReason}
                  </div>
                )}

                {/* Interactive Action Controls (Approve, Reject, Return) */}
                {activeExpense.status === 'pending_approval' && (
                  <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-500">
                      با تایید نهایی، سند دوبل حسابداری به صورت خودکار صادر می‌گردد.
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsReturnModalOpen(true)}
                        className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        بازگشت جهت اصلاح
                      </button>

                      <button
                        onClick={() => setIsRejectModalOpen(true)}
                        className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        رد فاکتور
                      </button>

                      <button
                        onClick={handleApprove}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        تأیید و ثبت در حسابداری
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              یک هزینه را برای بررسی انتخاب کنید.
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <XCircle className="w-5 h-5" />
              رد فاکتور تنخواه
            </div>
            <p className="text-xs text-slate-600">
              لطفاً علت رد هزینه را به صورت شفاف وارد نمایید (این پیام به تنخواه‌دار اعلام خواهد شد):
            </p>
            {rejectError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded border border-rose-200 font-bold">
                لطفاً دلیل رد فاکتور را وارد فرمایید.
              </p>
            )}
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (e.target.value.trim()) setRejectError(false);
              }}
              placeholder="مثال: عدم ارائه برگه باسکول، قیمت غیرمتعارف نسبت به استعلام، نقص مدارک فاکتور رسمی..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs rounded-lg hover:bg-slate-50"
              >
                انصراف
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg"
              >
                تأیید و ثبت رد فاکتور
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return for Correction Modal */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <RotateCcw className="w-5 h-5" />
              بازگشت هزینه به کاربر جهت اصلاح
            </div>
            <p className="text-xs text-slate-600">
              توضیحات و نواقص مدارک را شرح دهید تا کاربر فاکتور را ویرایش و مجدداً ارسال نماید:
            </p>
            {returnError && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 font-bold">
                لطفاً موارد نیازمند اصلاح را برای ثبت‌کننده تشریح کنید.
              </p>
            )}
            <textarea
              rows={3}
              value={returnComment}
              onChange={(e) => {
                setReturnComment(e.target.value);
                if (e.target.value.trim()) setReturnError(false);
              }}
              placeholder="مثال: کیفیت اسکن فاکتور ناخواناست، لطفاً عکس مجدد واضح‌تر از مهر فروشگاه پیوست کنید..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs rounded-lg hover:bg-slate-50"
              >
                انصراف
              </button>
              <button
                onClick={handleConfirmReturn}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg"
              >
                ارسال به تنخواه‌دار
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
