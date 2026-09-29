import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Filter,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  X,
  CreditCard,
  User,
} from 'lucide-react';
import {
  PettyCashAccount,
  PettyCashExpense,
  PettyCashReplenishment,
  PettyCashReconciliation,
  Project,
} from '../../types';
import { useSelector } from '../../store/AppStore';
import { pettyReportFigures, pettySettlementSheet } from '../../store/views/pettyCash';
import { OfficialPrint, moneyHeader } from '../common/OfficialPrint';
import { EmptyState } from '../common/EmptyState';
import { formatCurrency, formatNumber, formatPercent, formatDecimal, formatText } from '../../utils/formatters';
import { toPersianDate } from '../../utils/date';
import { Dialog } from '../../ui/Dialog';
import { formatInt, moneyUnitLabel } from '../../utils/money';
import { Money } from '../common/Money';

interface PettyCashReportsViewProps {
  accounts: PettyCashAccount[];
  expenses: PettyCashExpense[];
  replenishments: PettyCashReplenishment[];
  reconciliations: PettyCashReconciliation[];
  projects: Project[];
}

export const PettyCashReportsView: React.FC<PettyCashReportsViewProps> = ({
  accounts,
  expenses,
  replenishments,
  reconciliations,
  projects,
}) => {
  const [selectedReportType, setSelectedReportType] = useState<
    'statement' | 'project_category' | 'missing_docs' | 'rejected' | 'reconciliation_sheet'
  >('statement');

  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  // Data aggregations
  const accountExpenses = expenses.filter((e) => e.pettyCashId === selectedAccount?.id);
  const accountReplenishments = replenishments.filter(
    (r) => r.pettyCashId === selectedAccount?.id
  );

  // Report figures (store view model).
  const report = useSelector((s) => pettyReportFigures(s, expenses), [expenses]);
  const { missingDocsExpenses, rejectedExpenses, categoryRows } = report;
  const lastReconciliation = reconciliations.find((r) => r.pettyCashId === selectedAccount?.id);
  const sheet = pettySettlementSheet(expenses, selectedAccount?.id);
  const needsAccount = selectedReportType === 'statement' || selectedReportType === 'reconciliation_sheet';

  // Trigger print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            گزارش‌های تحلیلی و خروجی‌های رسمی تنخواه‌گردان
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            صورت‌حساب گردش تنخواه، گزارش تفکیکی پروژه‌ها، اسناد دارای نقص مدرک و صورتجلسه رسمی چاپی
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            disabled={!selectedAccount}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-lg transition-colors shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            نمایش نسخه چاپی و PDF رسمی
          </button>
        </div>
      </div>

      {/* Report Selection Pills */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedReportType('statement')}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedReportType === 'statement'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          صورت‌حساب جامع گردش تنخواه
        </button>

        <button
          onClick={() => setSelectedReportType('project_category')}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedReportType === 'project_category'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          هزینه‌ها به تفکیک پروژه و سرفصل
        </button>

        <button
          onClick={() => setSelectedReportType('missing_docs')}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedReportType === 'missing_docs'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          اسناد ناقص / بدون مدارک ({formatDecimal(missingDocsExpenses.length)})
        </button>

        <button
          onClick={() => setSelectedReportType('rejected')}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedReportType === 'rejected'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          فاکتورهای ردشده و دلایل آن ({formatDecimal(rejectedExpenses.length)})
        </button>

        <button
          onClick={() => setSelectedReportType('reconciliation_sheet')}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedReportType === 'reconciliation_sheet'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          صورتجلسه رسمی تسویه تنخواه (فرمت امضا)
        </button>
      </div>

      {/* Account Selector filter */}
      {(selectedReportType === 'statement' || selectedReportType === 'reconciliation_sheet') && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <label htmlFor="petty-cash-reports-view-1" className="text-xs font-bold text-slate-700">انتخاب تنخواه‌گردان مورد گزارش:</label>
          <select id="petty-cash-reports-view-1"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white font-medium w-80"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {formatText(a.title)} ({a.projectName})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* REPORT CONTENT AREA */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {needsAccount && !selectedAccount && (
          <EmptyState title="تنخواهی ثبت نشده است" description="پس از تعریف تنخواه‌گردان، صورت گردش و صورتجلسه تسویه آن از دفاتر ساخته می‌شود." />
        )}
        {/* REPORT 1: STATEMENT OF ACCOUNT */}
        {selectedReportType === 'statement' && selectedAccount && (
          <div>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  صورت گردش حساب تنخواه: {formatText(selectedAccount.title)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  مسئول: {formatText(selectedAccount.holderName)} | پروژه: {formatText(selectedAccount.projectName)} | سقف:{' '}
                  <Money rial={selectedAccount.ceilingLimit} />
                </p>
              </div>
              <div className="text-left">
                <span className="text-xs text-slate-500 block">مانده قابل مصرف نهایی:</span>
                <span className="text-sm font-bold text-emerald-700 tabular-nums">
                  <Money rial={selectedAccount.usableBalance} />
                </span>
              </div>
            </div>

            <div className="table-scroll">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-4">نوع</th>
                    <th className="py-2 px-4">تاریخ</th>
                    <th className="py-2 px-4">شماره مدرک</th>
                    <th className="py-2 px-4">شرح سند</th>
                    <th className="py-2 px-4">طرف حساب / فروشنده</th>
                    <th className="py-2 px-4 text-left">واریز (شارژ)</th>
                    <th className="py-2 px-4 text-left">برداشت (هزینه)</th>
                    <th className="py-2 px-4 text-center">وضعیت تایید</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accountReplenishments.map((r) => (
                    <tr key={r.id} className="bg-emerald-50/20 hover:bg-emerald-50/40">
                      <td className="py-3 px-4 font-bold text-emerald-800">شارژ تنخواه</td>
                      <td className="py-3 px-4 text-slate-600">{formatText(r.date)}</td>
                      <td className="py-3 px-4 tabular-nums text-sm text-slate-600">{formatText(r.docNumber)}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{formatText(r.description)}</td>
                      <td className="py-3 px-4 text-slate-600">{formatText(r.sourceBankAccountName)}</td>
                      <td className="py-3 px-4 text-left font-bold text-emerald-700 tabular-nums">
                        +<Money rial={r.amount} />
                      </td>
                      <td className="py-3 px-4 text-left tabular-nums text-slate-500">-</td>
                      <td className="py-3 px-4 text-center text-emerald-700 font-medium text-sm">
                        واریز قطعی
                      </td>
                    </tr>
                  ))}

                  {accountExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-700">هزینه ({e.category})</td>
                      <td className="py-3 px-4 text-slate-600">{formatText(e.date)}</td>
                      <td className="py-3 px-4 tabular-nums text-sm text-slate-600">{formatText(e.invoiceNumber)}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{formatText(e.description)}</td>
                      <td className="py-3 px-4 text-slate-600">{formatText(e.vendor)}</td>
                      <td className="py-3 px-4 text-left tabular-nums text-slate-500">-</td>
                      <td className="py-3 px-4 text-left font-bold text-slate-900 tabular-nums">
                        -<Money rial={e.amount} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            e.status === 'approved' || e.status === 'accounting_posted'
                              ? 'bg-emerald-100 text-emerald-800'
                              : e.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {e.status === 'approved' || e.status === 'accounting_posted'
                            ? 'تأیید شده'
                            : e.status === 'rejected'
                            ? 'رد شده'
                            : 'در انتظار تأیید'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 2: PROJECT & CATEGORY BREAKDOWN */}
        {selectedReportType === 'project_category' && (
          <div className="p-5 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                گزارش جامع هزینه‌های تنخواه‌گردان به تفکیک سرفصل
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                توزیع کل مبالغ مصرفی پروژه‌ها در دسته‌بندی‌های استاندارد عمرانی
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl table-scroll">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">سرفصل هزینه</th>
                    <th className="py-3 px-4">تعداد فاکتورها</th>
                    <th className="py-3 px-4 text-left">مجموع مبلغ ({moneyUnitLabel()})</th>
                    <th className="py-3 px-4">پروژه‌های درگیر</th>
                    <th className="py-3 px-4 text-left">سهم از کل مخارج</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoryRows.map((row) => (
                    <tr key={row.cat} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{formatText(row.cat)}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-700">{formatInt(row.count)}</td>
                      <td className="py-3 px-4 text-left font-bold text-slate-900 tabular-nums">
                        <Money rial={row.total} />
                      </td>
                      <td className="py-3 px-4 text-slate-600">{formatText(row.projects)}</td>
                      <td className="py-3 px-4 text-left tabular-nums font-medium text-amber-700">
                        {formatPercent(row.share)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 3: MISSING DOCUMENTS */}
        {selectedReportType === 'missing_docs' && (
          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                گزارش اسناد و فاکتورهای دارای نقص مدرک
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                فاکتورهایی که فاقد شماره پیگیری یا تصویر باکیفیت پیوست هستند
              </p>
            </div>

            {missingDocsExpenses.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto mb-2" />
                تمامی هزینه‌ها دارای مدارک، شماره رسمی و فایل پیوست معتبر می‌باشند.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl table-scroll">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">کد هزینه</th>
                      <th className="py-3 px-4">تنخواه</th>
                      <th className="py-3 px-4">شرح</th>
                      <th className="py-3 px-4">مبلغ</th>
                      <th className="py-3 px-4">نقص مدرک</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {missingDocsExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td className="py-3 px-4 tabular-nums font-bold">{formatText(exp.expenseNumber)}</td>
                        <td className="py-3 px-4">{formatText(exp.pettyCashTitle)}</td>
                        <td className="py-3 px-4">{formatText(exp.description)}</td>
                        <td className="py-3 px-4 tabular-nums font-bold"><Money rial={exp.amount} /></td>
                        <td className="py-3 px-4 text-rose-700 font-medium">فاقد شماره یا تصویر فاکتور</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* REPORT 4: REJECTED LOG */}
        {selectedReportType === 'rejected' && (
          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                سیاهه فاکتورهای ردشده کارگاه‌ها و علل رد
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                مواردی که در کارتابل تأیید، تأیید نگردیده‌اند
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl table-scroll">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">شماره هزینه</th>
                    <th className="py-3 px-4">تنخواه / کارگاه</th>
                    <th className="py-3 px-4">تاریخ</th>
                    <th className="py-3 px-4">مبلغ</th>
                    <th className="py-3 px-4">طرف حساب</th>
                    <th className="py-3 px-4">دلیل مستند رد فاکتور</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rejectedExpenses.map((exp) => (
                    <tr key={exp.id} className="bg-rose-50/20">
                      <td className="py-3 px-4 tabular-nums font-bold text-rose-800">
                        {formatText(exp.expenseNumber)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{formatText(exp.pettyCashTitle)}</td>
                      <td className="py-3 px-4 text-slate-600">{formatText(exp.date)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                        <Money rial={exp.amount} />
                      </td>
                      <td className="py-3 px-4 text-slate-700">{formatText(exp.vendor)}</td>
                      <td className="py-3 px-4 text-rose-700 font-medium">
                        {formatText(exp.rejectionReason || 'عدم رعایت آیین‌نامه معاملات و سرفصل بودجه')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 5: RECONCILIATION SHEET (صورتجلسه تسویه) */}
        {selectedReportType === 'reconciliation_sheet' && selectedAccount && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  صورتجلسه تسویه و کنترل مانده نقدینگی تنخواه‌گردان
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  جهت اخذ امضاهای قانونی تنخواه‌دار، مدیر پروژه، مدیر مالی و مدیرعامل
                </p>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold flex items-center gap-2"
              >
                <Printer className="w-3.5 h-3.5" />
                پیش‌نمایش چاپ
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-500 block text-xs">عنوان تنخواه:</span>
                  <span className="font-bold text-slate-900">{formatText(selectedAccount.title)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">پروژه مربوطه:</span>
                  <span className="font-bold text-slate-900">{formatText(selectedAccount.projectName)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">مسئول تنخواه:</span>
                  <span className="font-bold text-slate-900">{formatText(selectedAccount.holderName)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">سقف مصوب تنخواه:</span>
                  <span className=" font-bold text-slate-900 tabular-nums">
                    <Money rial={selectedAccount.ceilingLimit} />
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 border-t border-slate-200 pt-4">
              جایگاه‌های امضای صورتجلسه از «تنظیمات گزارش و چاپ» (مدیر سیستم) خوانده می‌شود؛ نام‌ها فقط وقتی چاپ می‌شوند که در آن‌جا انتخاب شده باشند.
            </p>
          </div>
        )}
      </div>

      {/* Official print: letterhead, signatories and footer from «تنظیمات گزارش و چاپ» */}
      {isPrintModalOpen && selectedAccount && (
        <Dialog onClose={() => setIsPrintModalOpen(false)} label="پیش‌نمایش چاپ صورتجلسه تنخواه" overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-slate-200">
          <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl flex items-center justify-between no-print">
            <div className="text-sm font-bold text-slate-800">پیش‌نمایش چاپ رسمی صورتجلسه تنخواه</div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="btn btn-secondary">
                <Printer className="w-4 h-4 text-amber-400" />
                چاپ یا ذخیره PDF
              </button>
              <button onClick={() => setIsPrintModalOpen(false)} aria-label="بستن" className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-8">
            <OfficialPrint
              reportType="petty_cash"
              title="صورتجلسه تسویه دوره‌ای و تطبیق تنخواه‌گردان"
              number={lastReconciliation?.reconNumber}
              money
              preview={sheet.rows.length === 0}
              filters={[
                { label: 'تنخواه', value: `${selectedAccount.title} (${selectedAccount.code})` },
                { label: 'پروژه', value: selectedAccount.projectName || 'ستاد' },
                { label: 'مسئول', value: selectedAccount.holderName },
              ]}
            >
              <table className="mb-4">
                <thead>
                  <tr>
                    <th>{moneyHeader('سقف مصوب')}</th>
                    <th>{moneyHeader('موجودی دفتری')}</th>
                    <th>{moneyHeader('در انتظار تأیید')}</th>
                    <th>{moneyHeader('مانده قابل مصرف')}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  <tr>
                    <td><Money rial={selectedAccount.ceilingLimit} unit={false} /></td>
                    <td><Money rial={selectedAccount.actualBalance} unit={false} /></td>
                    <td><Money rial={selectedAccount.pendingExpenses} unit={false} /></td>
                    <td><Money rial={selectedAccount.usableBalance} unit={false} /></td>
                  </tr>
                </tbody>
              </table>
              <table>
                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>شماره هزینه</th>
                    <th>تاریخ</th>
                    <th>سرفصل</th>
                    <th>فروشنده</th>
                    <th>شرح</th>
                    <th>{moneyHeader('مبلغ')}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {sheet.rows.map((exp, idx) => (
                    <tr key={exp.id}>
                      <td>{formatDecimal(idx + 1)}</td>
                      <td>{formatText(exp.expenseNumber)}</td>
                      <td>{formatText(exp.date)}</td>
                      <td>{formatText(exp.category)}</td>
                      <td>{formatText(exp.vendor)}</td>
                      <td>{formatText(exp.description)}</td>
                      <td><Money rial={exp.amount} unit={false} /></td>
                    </tr>
                  ))}
                  {sheet.rows.length === 0 && (
                    <tr>
                      <td colSpan={7}>هزینه تأییدشده‌ای برای این تنخواه ثبت نشده است.</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={6}>جمع هزینه‌های تأییدشده</td>
                    <td><Money rial={sheet.total} unit={false} /></td>
                  </tr>
                </tfoot>
              </table>
            </OfficialPrint>
          </div>
        </Dialog>
      )}
    </div>
  );
};
