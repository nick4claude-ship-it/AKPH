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
import { formatPercent, formatDecimal, formatText } from '../../utils/formatters';
import { useCompany } from '../../store/session';
import { clientStatementActions, statementVatPercent } from '../../store/views/contracts';
import { Money } from '../common/Money';
import { AttachmentsPanel } from '../documents/AttachmentsPanel';
import { OfficialPrint, moneyHeader } from '../common/OfficialPrint';
import { clientStatementSignatures } from '../../store/views/print';

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
  const [activeView, setActiveView] = useState<'detail' | 'print_preview'>('detail');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectError, setRejectError] = useState(false);
  const [accountingIssued, setAccountingIssued] = useState(!!statement.accountingJournalEntryId);
  const actions = clientStatementActions(currentUser, statement);
  const signatures = clientStatementSignatures(statement);

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

  // The official layout must be on the page before printing.
  const handlePrint = () => {
    if (activeView !== 'print_preview') {
      setActiveView('print_preview');
      setTimeout(() => window.print(), 150);
    } else window.print();
  };

  const handleExportExcel = () => downloadTable(clientStatementItemsCsv(statement));

  const handleCreateAccountingEntry = () => {
    if (onIssueAccountingEntry) {
      onIssueAccountingEntry(statement);
      setAccountingIssued(true);
    }
  };

  return (
    <Dialog onClose={onClose} label="صورت‌وضعیت موقت / کارکرد پیمان" overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
      
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold text-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{formatText(statement.statementNumber)}</h2>
                <span className={`px-2 py-1 rounded text-xs font-bold ${statusMeta[statement.status]?.color || 'bg-slate-100'}`}>
                  {statusMeta[statement.status]?.label || statement.status}
                </span>
                <span className="text-xs text-slate-500 tabular-nums">پیمان: {formatText(statement.contractCode)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                پروژه: {formatText(statement.projectName)} · کارفرما: {formatText(statement.client)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-200/80 p-1 rounded-lg text-sm font-medium">
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
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
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
                  <span className="text-xs text-slate-500 block">کارکرد ناخالص این دوره:</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    <Money rial={statement.grossAmount} />
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">مجموع کسورات قانونی:</span>
                  <span className="text-base font-bold text-rose-700 tabular-nums">
                    <Money rial={statement.totalDeductions} />
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">مبلغ خالص قابل پرداخت:</span>
                  <span className="text-base font-bold text-indigo-900 tabular-nums">
                    <Money rial={statement.netPayable} />
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">دریافت شده / مانده طلب:</span>
                  <span className="text-sm font-bold text-emerald-700 tabular-nums block">
                    دریافتی: {formatMoney(statement.receivedAmount, false)}
                  </span>
                  <span className="text-sm font-bold text-rose-700 tabular-nums block">
                    مانده: {formatMoney(statement.remainingPayable)}
                  </span>
                </div>
              </div>

              {/* Workflow Actions Section */}
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    گردش تأییدات و عملیات صورت‌وضعیت
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    مرحله فعلی: <strong>{statusMeta[statement.status]?.label}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {actions.advance && (
                    <button
                      onClick={() => onDecide(statement.id, 'approve')}
                      disabled={!actions.advance.allowed}
                      title={actions.advance.reason}
                      className="px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold cursor-pointer"
                    >
                      {formatText(actions.advance.label)}
                    </button>
                  )}

                  {actions.canReturn && (
                    <button
                      onClick={() => setShowRejectBox(true)}
                      className="px-3 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-sm font-bold cursor-pointer"
                    >
                      بازگشت جهت اصلاح کارگاهی
                    </button>
                  )}

                  {actions.employerApproved && !accountingIssued && (
                    <button
                      onClick={handleCreateAccountingEntry}
                      className="btn btn-primary"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>ثبت سند شناسایی درآمد و مطالبات در حسابداری</span>
                    </button>
                  )}

                  {accountingIssued && (
                    <span className="px-2 py-1 rounded-lg bg-indigo-100 text-indigo-900 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                      سند حسابداری صادر شده است
                    </span>
                  )}
                </div>
              </div>

              {/* Reject / Return with Reason Box */}
              {showRejectBox && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-2 animate-in fade-in">
                  <h5 className="text-sm font-bold text-rose-900">علت بازگشت یا رد صورت‌وضعیت (اجباری):</h5>
                  {rejectError && (
                    <p className="text-sm font-bold text-rose-700 bg-rose-100 p-2 rounded">
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
                    className="w-full text-sm p-2 rounded-lg border border-rose-300 bg-white focus:outline-rose-500"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowRejectBox(false);
                        setRejectError(false);
                      }}
                      className="px-3 py-1 rounded text-sm text-slate-600 hover:bg-slate-200 cursor-pointer"
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
                      className="px-3 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white text-sm font-bold cursor-pointer"
                    >
                      ثبت بازگشت به کارگاه
                    </button>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">ریز اقلام کارکرد این دوره:</h4>
                <div className="rounded-xl border border-slate-200 table-scroll">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2">ردیف</th>
                        <th className="p-2">کد</th>
                        <th className="p-2">شرح عملیات</th>
                        <th className="p-2 text-center">واحد</th>
                        <th className="p-2 text-left">مقدار پیمان</th>
                        <th className="p-2 text-left">کارکرد قبلی</th>
                        <th className="p-2 text-left">این دوره</th>
                        <th className="p-2 text-left">تجمعی</th>
                        <th className="p-2 text-left">بهای واحد</th>
                        <th className="p-2 text-left">مبلغ این دوره</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statement.items.map((i) => (
                        <tr key={i.id} className="hover:bg-slate-50">
                          <td className="p-2 tabular-nums text-slate-500">{formatText(i.rowNumber)}</td>
                          <td className="p-2 tabular-nums font-bold text-blue-700">{formatText(i.code)}</td>
                          <td className="p-2 max-w-xs font-medium text-slate-900">{formatText(i.description)}</td>
                          <td className="p-2 text-center font-bold text-slate-600">{formatText(i.unit)}</td>
                          <td className="p-2 text-left tabular-nums">{formatDecimal(i.contractQuantity)}</td>
                          <td className="p-2 text-left tabular-nums">{formatDecimal(i.previousQuantity)}</td>
                          <td className="p-2 text-left tabular-nums font-bold text-amber-700">
                            {formatDecimal(i.currentQuantity)}
                          </td>
                          <td className="p-2 text-left tabular-nums font-bold text-indigo-900">
                            {formatDecimal(i.cumulativeQuantity)}
                            {i.isExceeded && (
                              <span className="block text-sm text-rose-700 font-bold">
                                مازاد بر پیمان (+{formatDecimal(i.exceededQuantity)})
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-left tabular-nums">{formatMoney(i.unitRate, false)}</td>
                          <td className="p-2 text-left tabular-nums font-bold text-slate-900">
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
                <h4 className="text-sm font-bold text-slate-800 mb-2">جدول تفکیک کسورات قانونی و قراردادی:</h4>
                <div className="rounded-xl border border-slate-200 table-scroll">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2">عنوان کسری</th>
                        <th className="p-2">نوع محاسبه</th>
                        <th className="p-2 text-center">درصد / ضریب</th>
                        <th className="p-2 text-left">مبلغ مبنا ({moneyUnitLabel()})</th>
                        <th className="p-2 text-left">مبلغ کسور ({moneyUnitLabel()})</th>
                        <th className="p-2">توضیحات و مستندات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statement.deductions.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900">{formatText(d.title)}</td>
                          <td className="p-2 text-slate-600">{d.mode === 'percentage' ? 'درصدی' : 'مبلغ مقطوع'}</td>
                          <td className="p-2 text-center font-bold text-slate-700">{d.rate > 0 ? `${d.rate}٪` : '-'}</td>
                          <td className="p-2 text-left tabular-nums">{formatMoney(d.baseAmount, false)}</td>
                          <td className="p-2 text-left tabular-nums font-bold text-rose-700">
                            {formatMoney(d.calculatedAmount, false)}
                          </td>
                          <td className="p-2 text-slate-500 text-xs">{formatText(d.description || '-')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={4} className="p-2 text-left font-bold">
                          مجموع کل کسورات دوره:
                        </td>
                        <td className="p-2 text-left tabular-nums font-bold text-rose-800">
                          <Money rial={statement.totalDeductions} />
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="no-print">
                <AttachmentsPanel entityType="client_statement" entityId={statement.id} projectId={statement.projectId} counterpartyId={statement.counterpartyId} />
              </div>
            </div>
          ) : (
            /* OFFICIAL PRINT (letterhead and signatories from «تنظیمات گزارش و چاپ») */
            <div className="max-w-4xl mx-auto">
              <OfficialPrint
                reportType="client_statement"
                title="صورت‌وضعیت موقت / کارکرد پیمان"
                number={statement.statementNumber}
                money
                localSignatures={signatures}
                entity={null}
                filters={[
                  { label: 'پروژه', value: statement.projectName },
                  { label: 'پیمان', value: `${statement.contractNumber} (${statement.contractCode})` },
                  { label: 'کارفرما', value: statement.client },
                  { label: 'مشاور', value: statement.consultant },
                  { label: 'دوره', value: `از ${statement.periodStartDate} تا ${statement.periodEndDate}` },
                ]}
              >
                <table className="mb-4">
                  <thead>
                    <tr>
                      <th>ردیف</th>
                      <th>کد</th>
                      <th>شرح عملیات</th>
                      <th>واحد</th>
                      <th>کارکرد این دوره</th>
                      <th>{moneyHeader('بهای واحد')}</th>
                      <th>{moneyHeader('مبلغ دوره')}</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {statement.items.map((i) => (
                      <tr key={i.id}>
                        <td>{formatText(i.rowNumber)}</td>
                        <td>{formatText(i.code)}</td>
                        <td>{formatText(i.description)}</td>
                        <td>{formatText(i.unit)}</td>
                        <td>{formatDecimal(i.currentQuantity)}</td>
                        <td>{formatMoney(i.unitRate, false)}</td>
                        <td>{formatMoney(i.currentAmount, false)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table>
                  <thead>
                    <tr>
                      <th>شرح</th>
                      <th>{moneyHeader('مبلغ')}</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    <tr><td>۱. کارکرد عملیات این دوره</td><td><Money rial={statement.workAmountCurrent} unit={false} /></td></tr>
                    <tr><td>۲. تعدیل آحادبها و مابه‌التفاوت مصالح</td><td><Money rial={statement.adjustmentAmount} unit={false} /></td></tr>
                    <tr><td>۳. مصالح پای‌کار و سایر اقلام مجاز</td><td><Money rial={statement.otherAllowableItemsAmount} unit={false} /></td></tr>
                    <tr><td>{`۴. مالیات بر ارزش افزوده (${formatPercent(statementVatPercent(statement))})`}</td><td><Money rial={statement.vatAmount} unit={false} /></td></tr>
                    <tr className="font-bold"><td>مجموع ناخالص کارکرد دوره</td><td><Money rial={statement.grossAmount} unit={false} /></td></tr>
                    <tr><td>کسورات قانونی و قراردادی</td><td><Money rial={statement.totalDeductions} unit={false} /></td></tr>
                  </tbody>
                  <tfoot>
                    <tr className="font-bold"><td>مبلغ خالص قابل پرداخت</td><td><Money rial={statement.netPayable} unit={false} /></td></tr>
                  </tfoot>
                </table>
              </OfficialPrint>
            </div>
          )}
        </div>
      </Dialog>
  );
};
