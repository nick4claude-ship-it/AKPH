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
import { useAppState } from '../../store/AppStore';
import { documentCount } from '../../store/domainSelectors';
import { formatCurrency, formatNumber, formatPercent } from '../../utils/formatters';
import { toPersianDate } from '../../utils/date';
import { Dialog } from '../common/Dialog';
import { formatInt, moneyUnitLabel } from '../../utils/money';

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
  const appState = useAppState();
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

  const missingDocsExpenses = expenses.filter(
    (e) => !e.invoiceNumber || !documentCount(appState, 'petty_cash_expense', e.id)
  );

  const rejectedExpenses = expenses.filter((e) => e.status === 'rejected');

  // Spend per category from approved expenses.
  const approvedExpenses = expenses.filter((e) => e.status === 'approved' || e.status === 'accounting_posted');
  const approvedTotal = approvedExpenses.reduce((a, e) => a + e.amount, 0);
  const categoryRows = [...new Set(approvedExpenses.map((e) => e.category))]
    .map((cat) => {
      const rows = approvedExpenses.filter((e) => e.category === cat);
      const total = rows.reduce((a, e) => a + e.amount, 0);
      return {
        cat,
        count: rows.length,
        total,
        projects: [...new Set(rows.map((e) => e.projectName))].join('، '),
        pct: approvedTotal ? (total * 100) / approvedTotal : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
  const lastReconciliation = reconciliations.find((r) => r.pettyCashId === selectedAccount?.id);

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
          <p className="text-xs text-slate-500 mt-0.5">
            صورت‌حساب گردش تنخواه، گزارش تفکیکی پروژه‌ها، اسناد دارای نقص مدرک و صورتجلسه رسمی چاپی
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
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
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            selectedReportType === 'statement'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          صورت‌حساب جامع گردش تنخواه
        </button>

        <button
          onClick={() => setSelectedReportType('project_category')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            selectedReportType === 'project_category'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          هزینه‌ها به تفکیک پروژه و سرفصل
        </button>

        <button
          onClick={() => setSelectedReportType('missing_docs')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            selectedReportType === 'missing_docs'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          اسناد ناقص / بدون مدارک ({missingDocsExpenses.length.toLocaleString('fa-IR')})
        </button>

        <button
          onClick={() => setSelectedReportType('rejected')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            selectedReportType === 'rejected'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          فاکتورهای ردشده و دلایل آن ({rejectedExpenses.length.toLocaleString('fa-IR')})
        </button>

        <button
          onClick={() => setSelectedReportType('reconciliation_sheet')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
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
          <label className="text-xs font-bold text-slate-700">انتخاب تنخواه‌گردان مورد گزارش:</label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white font-medium w-80"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.projectName})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* REPORT CONTENT AREA */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* REPORT 1: STATEMENT OF ACCOUNT */}
        {selectedReportType === 'statement' && (
          <div>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  صورت گردش حساب تنخواه: {selectedAccount.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  مسئول: {selectedAccount.holderName} | پروژه: {selectedAccount.projectName} | سقف:{' '}
                  {formatCurrency(selectedAccount.ceilingLimit)}
                </p>
              </div>
              <div className="text-left">
                <span className="text-xs text-slate-500 block">مانده قابل مصرف نهایی:</span>
                <span className="text-sm font-mono font-black text-emerald-700 tabular-nums">
                  {formatCurrency(selectedAccount.usableBalance)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">نوع</th>
                    <th className="py-2.5 px-4">تاریخ</th>
                    <th className="py-2.5 px-4">شماره مدرک</th>
                    <th className="py-2.5 px-4">شرح سند</th>
                    <th className="py-2.5 px-4">طرف حساب / فروشنده</th>
                    <th className="py-2.5 px-4 text-left">واریز (شارژ)</th>
                    <th className="py-2.5 px-4 text-left">برداشت (هزینه)</th>
                    <th className="py-2.5 px-4 text-center">وضعیت تایید</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accountReplenishments.map((r) => (
                    <tr key={r.id} className="bg-emerald-50/20 hover:bg-emerald-50/40">
                      <td className="py-3 px-4 font-bold text-emerald-800">شارژ تنخواه</td>
                      <td className="py-3 px-4 text-slate-600">{r.date}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{r.docNumber}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{r.description}</td>
                      <td className="py-3 px-4 text-slate-600">{r.sourceBankAccountName}</td>
                      <td className="py-3 px-4 text-left font-mono font-bold text-emerald-700 tabular-nums">
                        +{formatCurrency(r.amount)}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-slate-400">-</td>
                      <td className="py-3 px-4 text-center text-emerald-700 font-semibold text-[10px]">
                        واریز قطعی
                      </td>
                    </tr>
                  ))}

                  {accountExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-700">هزینه ({e.category})</td>
                      <td className="py-3 px-4 text-slate-600">{e.date}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{e.invoiceNumber}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{e.description}</td>
                      <td className="py-3 px-4 text-slate-600">{e.vendor}</td>
                      <td className="py-3 px-4 text-left font-mono text-slate-400">-</td>
                      <td className="py-3 px-4 text-left font-mono font-bold text-slate-900 tabular-nums">
                        -{formatCurrency(e.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
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
              <h3 className="text-sm font-bold text-slate-900">
                گزارش جامع هزینه‌های تنخواه‌گردان به تفکیک سرفصل
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                توزیع کل مبالغ مصرفی پروژه‌ها در دسته‌بندی‌های استاندارد عمرانی
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
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
                      <td className="py-3 px-4 font-bold text-slate-900">{row.cat}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{formatInt(row.count)}</td>
                      <td className="py-3 px-4 text-left font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(row.total)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{row.projects}</td>
                      <td className="py-3 px-4 text-left font-mono font-semibold text-amber-700">
                        {formatPercent(row.pct)}
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
              <h3 className="text-sm font-bold text-slate-900">
                گزارش اسناد و فاکتورهای دارای نقص مدرک
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                فاکتورهایی که فاقد شماره پیگیری یا تصویر باکیفیت پیوست هستند
              </p>
            </div>

            {missingDocsExpenses.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                تمامی هزینه‌ها دارای مدارک، شماره رسمی و فایل پیوست معتبر می‌باشند.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
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
                        <td className="py-3 px-4 font-mono font-bold">{exp.expenseNumber}</td>
                        <td className="py-3 px-4">{exp.pettyCashTitle}</td>
                        <td className="py-3 px-4">{exp.description}</td>
                        <td className="py-3 px-4 font-mono font-bold">{formatCurrency(exp.amount)}</td>
                        <td className="py-3 px-4 text-rose-600 font-medium">فاقد شماره یا تصویر فاکتور</td>
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
              <h3 className="text-sm font-bold text-slate-900">
                سیاهه فاکتورهای ردشده کارگاه‌ها و علل رد
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                مواردی که در کارتابل تأیید، تأیید نگردیده‌اند
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
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
                      <td className="py-3 px-4 font-mono font-bold text-rose-800">
                        {exp.expenseNumber}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{exp.pettyCashTitle}</td>
                      <td className="py-3 px-4 text-slate-600">{exp.date}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{exp.vendor}</td>
                      <td className="py-3 px-4 text-rose-700 font-medium">
                        {exp.rejectionReason || 'عدم رعایت آیین‌نامه معاملات و سرفصل بودجه'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 5: RECONCILIATION SHEET (صورتجلسه تسویه) */}
        {selectedReportType === 'reconciliation_sheet' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  صورتجلسه تسویه و کنترل مانده نقدینگی تنخواه‌گردان
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  جهت اخذ امضاهای قانونی تنخواه‌دار، مدیر پروژه، مدیر مالی و مدیرعامل
                </p>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                پیش‌نمایش چاپ
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-500 block text-[11px]">عنوان تنخواه:</span>
                  <span className="font-bold text-slate-900">{selectedAccount.title}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">پروژه مربوطه:</span>
                  <span className="font-bold text-slate-900">{selectedAccount.projectName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">مسئول تنخواه:</span>
                  <span className="font-bold text-slate-900">{selectedAccount.holderName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">سقف مصوب تنخواه:</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {formatCurrency(selectedAccount.ceilingLimit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Reconciliation Signature Matrix Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
              <div className="border border-slate-200 rounded-xl p-3 text-center space-y-8 bg-white">
                <span className="text-xs font-bold text-slate-700 block">تنخواه‌دار / کارپرداز</span>
                <span className="text-[11px] text-slate-500 block">{selectedAccount.holderName}</span>
              </div>
              <div className="border border-slate-200 rounded-xl p-3 text-center space-y-8 bg-white">
                <span className="text-xs font-bold text-slate-700 block">سرپرست / مدیر پروژه</span>
                <span className="text-[11px] text-slate-500 block">مهندس ناظر پروژه</span>
              </div>
              <div className="border border-slate-200 rounded-xl p-3 text-center space-y-8 bg-white">
                <span className="text-xs font-bold text-slate-700 block">مدیر امور مالی</span>
                <span className="text-[11px] text-slate-500 block">دکتر صمدیان</span>
              </div>
              <div className="border border-slate-200 rounded-xl p-3 text-center space-y-8 bg-white">
                <span className="text-xs font-bold text-slate-700 block">مدیرعامل</span>
                <span className="text-[11px] text-slate-500 block">مهندس رادمنش</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Official Print/PDF Modal (Prompt Section 25 & 16) */}
      {isPrintModalOpen && (
        <Dialog onClose={() => setIsPrintModalOpen(false)} label="پیش‌نمایش چاپ گزارش تنخواه" overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-slate-200 print:shadow-none print:border-none print:m-0 print:p-0">
          
            {/* Modal Print Toolbar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl flex items-center justify-between print:hidden">
              <div className="text-xs font-bold text-slate-800">
                پیش‌نمایش فرم چاپی و خروجی رسمی صورتجلسه تنخواه
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  چاپ یا ذخیره PDF
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official Formal Document Layout */}
            <div className="p-8 space-y-6 text-slate-900 bg-white" id="printable-reconciliation">
              {/* Header Letterhead */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-lg font-black text-slate-950">
                    شرکت مهندسی و پیمانکاری سازه گستر پیشرو
                  </h1>
                  <h2 className="text-xs font-bold text-slate-600 mt-1">
                    سامانه جامع مدیریت مالی و پروژه‌های عمرانی
                  </h2>
                </div>

                <div className="text-center font-bold text-sm bg-slate-100 px-4 py-2 rounded-lg border border-slate-300">
                  صورتجلسه تسویه دوره‌ای و تطبیق تنخواه‌گردان
                </div>

                <div className="text-left text-xs space-y-1 font-mono">
                  <div>شماره مدرک: {lastReconciliation?.reconNumber ?? '—'}</div>
                  <div>تاریخ تنظیم: {toPersianDate(new Date())}</div>
                  <div>پیوست: دارد</div>
                </div>
              </div>

              {/* Account Profile Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-50 font-bold p-2.5 border-b border-slate-300">
                  <div>عنوان تنخواه: {selectedAccount.title}</div>
                  <div>کد تنخواه: {selectedAccount.code}</div>
                  <div>پروژه: {selectedAccount.projectName}</div>
                  <div>مسئول: {selectedAccount.holderName}</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 p-2.5">
                  <div>سقف مصوب: {formatCurrency(selectedAccount.ceilingLimit)}</div>
                  <div>موجودی واقعی: {formatCurrency(selectedAccount.actualBalance)}</div>
                  <div>تعهدات در انتظار: {formatCurrency(selectedAccount.pendingExpenses)}</div>
                  <div>مانده آزاد قابل مصرف: {formatCurrency(selectedAccount.usableBalance)}</div>
                </div>
              </div>

              {/* Expenses breakdown table in Print */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-2">
                  سیاهه هزینه‌های مصوب تنخواه در دوره مالی شهریور ۱۴۰۳:
                </h4>
                <table className="w-full text-right text-xs border border-slate-300">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="p-2 border-l border-slate-300">ردیف</th>
                      <th className="p-2 border-l border-slate-300">شماره هزینه</th>
                      <th className="p-2 border-l border-slate-300">تاریخ</th>
                      <th className="p-2 border-l border-slate-300">سرفصل</th>
                      <th className="p-2 border-l border-slate-300">فروشنده</th>
                      <th className="p-2 border-l border-slate-300">شرح خرید</th>
                      <th className="p-2 text-left">مبلغ ({moneyUnitLabel()})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {accountExpenses.slice(0, 6).map((exp, idx) => (
                      <tr key={exp.id}>
                        <td className="p-2 border-l border-slate-200 text-center font-mono">
                          {(idx + 1).toLocaleString('fa-IR')}
                        </td>
                        <td className="p-2 border-l border-slate-200 font-mono text-[11px]">
                          {exp.expenseNumber}
                        </td>
                        <td className="p-2 border-l border-slate-200">{exp.date}</td>
                        <td className="p-2 border-l border-slate-200">{exp.category}</td>
                        <td className="p-2 border-l border-slate-200">{exp.vendor}</td>
                        <td className="p-2 border-l border-slate-200">{exp.description}</td>
                        <td className="p-2 text-left font-mono font-bold tabular-nums">
                          {formatCurrency(exp.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Settlement Signatures */}
              <div className="pt-8">
                <div className="grid grid-cols-4 gap-4 text-center text-xs">
                  <div className="border border-slate-300 rounded-lg p-3 h-28 flex flex-col justify-between">
                    <span className="font-bold text-slate-800">امضای تنخواه‌دار</span>
                    <span className="text-[11px] text-slate-500">{selectedAccount.holderName}</span>
                  </div>
                  <div className="border border-slate-300 rounded-lg p-3 h-28 flex flex-col justify-between">
                    <span className="font-bold text-slate-800">امضای مدیر پروژه</span>
                    <span className="text-[11px] text-slate-500">مهندس ناظر کارگاه</span>
                  </div>
                  <div className="border border-slate-300 rounded-lg p-3 h-28 flex flex-col justify-between">
                    <span className="font-bold text-slate-800">امضای مدیر امور مالی</span>
                    <span className="text-[11px] text-slate-500">دکتر صمدیان</span>
                  </div>
                  <div className="border border-slate-300 rounded-lg p-3 h-28 flex flex-col justify-between">
                    <span className="font-bold text-slate-800">امضای مدیرعامل</span>
                    <span className="text-[11px] text-slate-500">مهندس رادمنش</span>
                  </div>
                </div>
              </div>
            </div>
          </Dialog>
      )}
    </div>
  );
};
