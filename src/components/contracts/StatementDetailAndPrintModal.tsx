/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  DetailedProgressStatement,
  UserProfile,
} from '../../types';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Building,
  FileText,
  Calendar,
  DollarSign,
  ShieldCheck,
  Send,
  BookOpen,
} from 'lucide-react';
import { Dialog } from '../../ui/Dialog';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { downloadTable } from '../../utils/export';
import { clientStatementItemsCsv } from '../../store/views/exports';
import { formatPercent, formatDecimal } from '../../utils/formatters';
import { useCompany } from '../../store/session';
import { clientStatementActions, statementVatPercent } from '../../store/views/contracts';

interface StatementDetailAndPrintModalProps {
  statement: DetailedProgressStatement;
  currentUser: UserProfile;
  onClose: () => void;
  /** Next approval step, or return to the site with a reason (runs the store workflow). */
  onDecide: (statementId: string, decision: 'approve' | 'return', reason?: string) => void;
  onIssueAccountingEntry?: (statement: DetailedProgressStatement) => void;
}

export const StatementDetailAndPrintModal: React.FC<StatementDetailAndPrintModalProps> = ({
  statement,
  currentUser,
  onClose,
  onDecide,
  onIssueAccountingEntry,
}) => {
  const company = useCompany();
  const [activeView, setActiveView] = useState<'detail' | 'print_preview'>('detail');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectError, setRejectError] = useState(false);
  const [accountingIssued, setAccountingIssued] = useState(!!statement.accountingJournalEntryId);
  const actions = clientStatementActions(currentUser, statement);

  // Status mapping
  const statusMeta: Record<string, { label: string; color: string }> = {
    draft: { label: 'پیش‌نویس کارگاه', color: 'bg-slate-100 text-slate-800' },
    prepared: { label: 'تهیه شده', color: 'bg-blue-100 text-blue-800' },
    internal_review: { label: 'بررسی دفتر فنی', color: 'bg-indigo-100 text-indigo-800' },
    submitted_to_consultant: { label: 'ارسال به مشاور', color: 'bg-amber-100 text-amber-800' },
    under_consultant_review: { label: 'در حال بررسی مشاور', color: 'bg-amber-100 text-amber-900' },
    approved_by_consultant: { label: 'تأیید شده مشاور', color: 'bg-teal-100 text-teal-800' },
    submitted_to_employer: { label: 'ارسال به کارفرما', color: 'bg-blue-100 text-blue-900' },
    approved_by_employer: { label: 'تأیید نهایی کارفرما', color: 'bg-emerald-100 text-emerald-800 font-bold' },
    claimed: { label: 'اعلام بدهی و مطالبه', color: 'bg-purple-100 text-purple-800' },
    partially_paid: { label: 'پرداخت بخشی از وجه', color: 'bg-cyan-100 text-cyan-800' },
    paid: { label: 'تسویه کامل', color: 'bg-emerald-200 text-emerald-950 font-bold' },
    rejected: { label: 'رد شده', color: 'bg-rose-100 text-rose-800' },
    returned_for_correction: { label: 'بازگشت جهت اصلاح', color: 'bg-orange-100 text-orange-900' },
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => downloadTable(clientStatementItemsCsv(statement));

  const handleCreateAccountingEntry = () => {
    if (onIssueAccountingEntry) {
      onIssueAccountingEntry(statement);
      setAccountingIssued(true);
    }
  };

  return (
    <Dialog onClose={onClose} label="صورت‌وضعیت موقت / کارکرد پیمان" overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
      
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold text-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{statement.statementNumber}</h2>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${statusMeta[statement.status]?.color || 'bg-slate-100'}`}>
                  {statusMeta[statement.status]?.label || statement.status}
                </span>
                <span className="text-xs text-slate-500 font-mono">پیمان: {statement.contractCode}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                پروژه: {statement.projectName} · کارفرما: {statement.client}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setActiveView('detail')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeView === 'detail' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                کارتابل و جزئیات
              </button>
              <button
                onClick={() => setActiveView('print_preview')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeView === 'print_preview' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                فرم چاپی رسمی پیمان
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              title="چاپ یا ذخیره PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportExcel}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              title="خروجی اکسل اقلام"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {activeView === 'detail' ? (
            /* DETAIL & WORKFLOW VIEW */
            <div className="space-y-6">
              {/* Executive Financial Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500 block">کارکرد ناخالص این دوره:</span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {formatMoney(statement.grossAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">مجموع کسورات قانونی:</span>
                  <span className="text-base font-black text-rose-700 font-mono">
                    {formatMoney(statement.totalDeductions)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">مبلغ خالص قابل پرداخت:</span>
                  <span className="text-base font-black text-indigo-900 font-mono">
                    {formatMoney(statement.netPayable)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">دریافت شده / مانده طلب:</span>
                  <span className="text-sm font-bold text-emerald-700 font-mono block">
                    دریافتی: {formatMoney(statement.receivedAmount, false)}
                  </span>
                  <span className="text-xs font-bold text-rose-600 font-mono block">
                    مانده: {formatMoney(statement.remainingPayable)}
                  </span>
                </div>
              </div>

              {/* Workflow Actions Section */}
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    گردش تأییدات و عملیات صورت‌وضعیت
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    مرحله فعلی: <strong>{statusMeta[statement.status]?.label}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {actions.advance && (
                    <button
                      onClick={() => onDecide(statement.id, 'approve')}
                      disabled={!actions.advance.allowed}
                      title={actions.advance.reason}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer"
                    >
                      {actions.advance.label}
                    </button>
                  )}

                  {actions.canReturn && (
                    <button
                      onClick={() => setShowRejectBox(true)}
                      className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold cursor-pointer"
                    >
                      بازگشت جهت اصلاح کارگاهی
                    </button>
                  )}

                  {actions.employerApproved && !accountingIssued && (
                    <button
                      onClick={handleCreateAccountingEntry}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>ثبت سند شناسایی درآمد و مطالبات در حسابداری</span>
                    </button>
                  )}

                  {accountingIssued && (
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                      سند حسابداری صادر شده است
                    </span>
                  )}
                </div>
              </div>

              {/* Reject / Return with Reason Box */}
              {showRejectBox && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-2 animate-in fade-in">
                  <h5 className="text-xs font-bold text-rose-900">علت بازگشت یا رد صورت‌وضعیت (اجباری):</h5>
                  {rejectError && (
                    <p className="text-[11px] font-bold text-rose-700 bg-rose-100 p-1.5 rounded">
                      لطفاً دلیل بازگشت یا اصلاح صورت‌وضعیت را بنویسید.
                    </p>
                  )}
                  <textarea
                    value={rejectReason}
                    onChange={(e) => {
                      setRejectReason(e.target.value);
                      if (e.target.value.trim()) setRejectError(false);
                    }}
                    placeholder="مغایرت در احجام بتن‌ریزی، عدم ارائه صورتجلسه کارگاهی، اشتباه در ضرایب تعدیل..."
                    className="w-full text-xs p-2.5 rounded-lg border border-rose-300 bg-white focus:outline-rose-500"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowRejectBox(false);
                        setRejectError(false);
                      }}
                      className="px-3 py-1 rounded text-xs text-slate-600 hover:bg-slate-200 cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      onClick={() => {
                        if (!rejectReason.trim()) {
                          setRejectError(true);
                          return;
                        }
                        onDecide(statement.id, 'return', rejectReason);
                        setShowRejectBox(false);
                        setRejectError(false);
                      }}
                      className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                    >
                      ثبت بازگشت به کارگاه
                    </button>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">ریز اقلام کارکرد این دوره (BOQ Items):</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">ردیف</th>
                        <th className="p-2.5">کد</th>
                        <th className="p-2.5">شرح عملیات</th>
                        <th className="p-2.5 text-center">واحد</th>
                        <th className="p-2.5 text-left">مقدار پیمان</th>
                        <th className="p-2.5 text-left">کارکرد قبلی</th>
                        <th className="p-2.5 text-left">این دوره</th>
                        <th className="p-2.5 text-left">تجمعی</th>
                        <th className="p-2.5 text-left">بهای واحد</th>
                        <th className="p-2.5 text-left">مبلغ این دوره</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statement.items.map((i) => (
                        <tr key={i.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-500">{i.rowNumber}</td>
                          <td className="p-2.5 font-mono font-bold text-blue-700">{i.code}</td>
                          <td className="p-2.5 max-w-xs font-medium text-slate-900">{i.description}</td>
                          <td className="p-2.5 text-center font-bold text-slate-600">{i.unit}</td>
                          <td className="p-2.5 text-left font-mono">{formatDecimal(i.contractQuantity)}</td>
                          <td className="p-2.5 text-left font-mono">{formatDecimal(i.previousQuantity)}</td>
                          <td className="p-2.5 text-left font-mono font-bold text-amber-700">
                            {formatDecimal(i.currentQuantity)}
                          </td>
                          <td className="p-2.5 text-left font-mono font-bold text-indigo-900">
                            {formatDecimal(i.cumulativeQuantity)}
                            {i.isExceeded && (
                              <span className="block text-[9px] text-rose-600 font-bold">
                                مازاد بر پیمان (+{formatDecimal(i.exceededQuantity)})
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-left font-mono">{formatMoney(i.unitRate, false)}</td>
                          <td className="p-2.5 text-left font-mono font-bold text-slate-900">
                            {formatMoney(i.currentAmount, false)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deductions Breakdown Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">جدول تفکیک کسورات قانونی و قراردادی:</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">عنوان کسری</th>
                        <th className="p-2.5">نوع محاسبه</th>
                        <th className="p-2.5 text-center">درصد / ضریب</th>
                        <th className="p-2.5 text-left">مبلغ مبنا ({moneyUnitLabel()})</th>
                        <th className="p-2.5 text-left">مبلغ کسور ({moneyUnitLabel()})</th>
                        <th className="p-2.5">توضیحات و مستندات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statement.deductions.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">{d.title}</td>
                          <td className="p-2.5 text-slate-600">{d.mode === 'percentage' ? 'درصدی' : 'مبلغ مقطوع'}</td>
                          <td className="p-2.5 text-center font-bold text-slate-700">{d.rate > 0 ? `${d.rate}٪` : '-'}</td>
                          <td className="p-2.5 text-left font-mono">{formatMoney(d.baseAmount, false)}</td>
                          <td className="p-2.5 text-left font-mono font-bold text-rose-700">
                            {formatMoney(d.calculatedAmount, false)}
                          </td>
                          <td className="p-2.5 text-slate-500 text-[11px]">{d.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={4} className="p-2.5 text-left font-black">
                          مجموع کل کسورات دوره:
                        </td>
                        <td className="p-2.5 text-left font-mono font-black text-rose-800">
                          {formatMoney(statement.totalDeductions)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* OFFICIAL PRINT PREVIEW (FORMAL IRANIAN CONTRACT PROGRESS STATEMENT) */
            <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-300 shadow-xs max-w-4xl mx-auto space-y-6 font-sans text-xs">
              {/* Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Building className="w-6 h-6 text-slate-900" />
                    <span className="text-base font-black text-slate-900 tracking-tight">
                      {company.legalName}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-600 block mt-1">
                    دفتر فنی و امور قراردادهای پروژه‌های عمرانی
                  </span>
                </div>

                <div className="text-center">
                  <h3 className="text-sm font-black text-slate-900 border-2 border-slate-900 px-4 py-1 rounded">
                    صورت‌وضعیت موقت / کارکرد پیمان
                  </h3>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    منطبق بر نشریه ۴۳۱۱ سازمان برنامه و بودجه
                  </span>
                </div>

                <div className="text-left text-[11px] text-slate-600 space-y-0.5 font-mono">
                  <div>شماره سند: <strong>{statement.statementNumber}</strong></div>
                  <div>تاریخ تهیه: <strong>{statement.preparationDate}</strong></div>
                  <div>صفحه: <strong>۱ از ۳</strong></div>
                </div>
              </div>

              {/* Contract Information Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 block">پروژه:</span>
                  <span className="font-bold">{statement.projectName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">شماره و تاریخ پیمان:</span>
                  <span className="font-mono">{statement.contractNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">دستگاه اجرایی / کارفرما:</span>
                  <span className="font-bold">{statement.client}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">مهندسین مشاور:</span>
                  <span className="font-bold">{statement.consultant}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">دوره کارکرد:</span>
                  <span className="font-mono">از {statement.periodStartDate} تا {statement.periodEndDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">پیمانکار:</span>
                  <span className="font-bold">{company.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">تعدیل آحادبها:</span>
                  <span className="font-mono font-bold">{formatMoney(statement.adjustmentAmount)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">مالیات بر ارزش افزوده:</span>
                  <span className="font-mono font-bold">{formatMoney(statement.vatAmount)}</span>
                </div>
              </div>

              {/* Items Condensed Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[11px] border border-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 border-b border-slate-300 font-bold">
                      <th className="p-1.5 border border-slate-300">ردیف</th>
                      <th className="p-1.5 border border-slate-300">کد</th>
                      <th className="p-1.5 border border-slate-300">شرح مختصر عملیات</th>
                      <th className="p-1.5 border border-slate-300 text-center">واحد</th>
                      <th className="p-1.5 border border-slate-300 text-left">کارکرد این دوره</th>
                      <th className="p-1.5 border border-slate-300 text-left">بهای واحد</th>
                      <th className="p-1.5 border border-slate-300 text-left">مبلغ دوره ({moneyUnitLabel()})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.items.map((i) => (
                      <tr key={i.id} className="border-b border-slate-200">
                        <td className="p-1.5 border border-slate-300 font-mono text-center">{i.rowNumber}</td>
                        <td className="p-1.5 border border-slate-300 font-mono text-center">{i.code}</td>
                        <td className="p-1.5 border border-slate-300">{i.description}</td>
                        <td className="p-1.5 border border-slate-300 text-center">{i.unit}</td>
                        <td className="p-1.5 border border-slate-300 text-left font-mono">{formatDecimal(i.currentQuantity)}</td>
                        <td className="p-1.5 border border-slate-300 text-left font-mono">{formatMoney(i.unitRate, false)}</td>
                        <td className="p-1.5 border border-slate-300 text-left font-mono font-bold">{formatMoney(i.currentAmount, false)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Statement */}
              <div className="bg-slate-50 p-4 rounded border border-slate-300 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span>۱. کارکرد عملیات این دوره:</span>
                  <span className="font-mono font-bold">{formatMoney(statement.workAmountCurrent)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span>۲. تعدیل آحادبها و مابه‌التفاوت مصالح:</span>
                  <span className="font-mono font-bold">+{formatMoney(statement.adjustmentAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span>۳. مصالح پای‌کار و سایر اقلام مجاز:</span>
                  <span className="font-mono font-bold">+{formatMoney(statement.otherAllowableItemsAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span>۴. مالیات بر ارزش افزوده ({formatPercent(statementVatPercent(statement))}):</span>
                  <span className="font-mono font-bold">+{formatMoney(statement.vatAmount)}</span>
                </div>
                <div className="flex justify-between py-1.5 bg-slate-200 px-2 rounded font-black text-slate-900">
                  <span>مجموع ناخالص کارکرد دوره (Gross Amount):</span>
                  <span className="font-mono">{formatMoney(statement.grossAmount)}</span>
                </div>
                <div className="flex justify-between py-1 text-rose-700">
                  <span>کسورات قانونی و قراردادی (استرداد پیش‌پرداخت، حسن انجام کار، بیمه و...):</span>
                  <span className="font-mono font-bold">-{formatMoney(statement.totalDeductions)}</span>
                </div>
                <div className="flex justify-between py-2 bg-amber-100 text-amber-950 px-2 rounded font-black text-sm">
                  <span>مبلغ خالص قابل پرداخت به پیمانکار (Net Payable):</span>
                  <span className="font-mono">{formatMoney(statement.netPayable)}</span>
                </div>
              </div>

              {/* Matrix of 4 Legal Signatures */}
              <div className="pt-6 border-t-2 border-slate-400 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-[10px]">
                <div className="space-y-12">
                  <div>
                    <span className="font-bold text-slate-800 block">پیمانکار - {company.name}</span>
                    <span className="text-slate-500 block">سرپرست کارگاه و مدیر پروژه</span>
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400">
                    امضا و مهر
                  </div>
                </div>

                <div className="space-y-12">
                  <div>
                    <span className="font-bold text-slate-800 block">مهندسین مشاور سازه‌اندیش</span>
                    <span className="text-slate-500 block">سرناظر مقیم و مدیر فنی</span>
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400">
                    امضا و مهر
                  </div>
                </div>

                <div className="space-y-12">
                  <div>
                    <span className="font-bold text-slate-800 block">دستگاه اجرایی / کارفرما</span>
                    <span className="text-slate-500 block">نماینده فنی و مدیر طرح</span>
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400">
                    امضا و مهر
                  </div>
                </div>

                <div className="space-y-12">
                  <div>
                    <span className="font-bold text-slate-800 block">مدیریت امور مالی شرکت</span>
                    <span className="text-slate-500 block">کنترل و تطبیق حسابداری</span>
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-400">
                    امضا و مهر
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Dialog>
  );
};
