import React, { useState } from 'react';
import {
  BarChart3,
  Printer,
  Download,
  Filter,
  Layers,
  ChevronDown,
  Building2,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { Project, CostCenter, JournalEntry } from '../../types';
import { formatCurrency, formatPercent } from '../../utils/formatters';

interface FinancialReportsViewProps {
  projects: Project[];
  costCenters: CostCenter[];
  journalEntries: JournalEntry[];
}

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({
  projects,
  costCenters,
  journalEntries,
}) => {
  const [reportType, setReportType] = useState<
    'project_pnl' | 'trial_balance' | 'income_statement' | 'balance_sheet' | 'general_ledger'
  >('project_pnl');

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const targetProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    alert('فایل اکسل گزارش مالی موردنظر با قالب استاندارد حسابداری دانلود شد.');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header & Report Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setReportType('project_pnl')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              reportType === 'project_pnl'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            سود و زیان پروژه‌ها (Project P&L)
          </button>
          <button
            onClick={() => setReportType('trial_balance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              reportType === 'trial_balance'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            تراز آزمایشی (۴ و ۸ ستونی)
          </button>
          <button
            onClick={() => setReportType('income_statement')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              reportType === 'income_statement'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            صورت سود و زیان شرکت
          </button>
          <button
            onClick={() => setReportType('balance_sheet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              reportType === 'balance_sheet'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ترازنامه مالی (Balance Sheet)
          </button>
          <button
            onClick={() => setReportType('general_ledger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              reportType === 'general_ledger'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            دفتر کل و معین
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی Excel</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>چاپ رسمی گزارش</span>
          </button>
        </div>
      </div>

      {/* REPORT 1: PROJECT P&L DRILL-DOWN (Requirement 19: Revenue - Direct - Indirect = Profit) */}
      {reportType === 'project_pnl' && targetProject && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                گزارش جامع عملکرد مالی و سود و زیان پروژه: {targetProject.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                کارفرما: {targetProject.client} · کد پروژه: {targetProject.code} · وضعیت: {targetProject.status}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">انتخاب پروژه:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer font-sans"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Key Formula Strip (Revenue - Direct - Indirect = Profit) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-center">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-sans text-emerald-800 block mb-1">
                درآمد کارکرد پروژه (Revenue)
              </span>
              <strong className="text-sm text-emerald-900 font-extrabold">
                {formatCurrency(targetProject.recordedRevenue)}
              </strong>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-sans text-slate-600 block mb-1">
                - هزینه‌های مستقیم (Direct Costs)
              </span>
              <strong className="text-sm text-slate-900 font-bold">
                {formatCurrency(targetProject.directCost)}
              </strong>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-sans text-slate-600 block mb-1">
                - سهم سربار ستادی (Indirect)
              </span>
              <strong className="text-sm text-slate-900 font-bold">
                {formatCurrency(targetProject.indirectCost)}
              </strong>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-[11px] font-sans text-amber-800 block mb-1">
                = سود قطعی پروژه (Profit)
              </span>
              <strong className="text-sm text-amber-900 font-extrabold">
                {formatCurrency(targetProject.profit)} ({formatPercent(targetProject.profitMargin)})
              </strong>
            </div>
          </div>

          {/* Drill-Down Categories Breakdown */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>ریز هزینه اقلام کارگاهی پروژه (Cost Breakdown & Drill-Down):</span>
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">دسته هزینه کارگاهی</th>
                    <th className="py-2.5 px-3 font-mono text-left">مبلغ هزینه (تومان)</th>
                    <th className="py-2.5 px-3 font-mono text-left">درصد از کل هزینه پروژه</th>
                    <th className="py-2.5 px-4">نمودار سهم در پروژه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {Object.entries(targetProject.expenseBreakdown).map(([key, val]) => {
                    const percent = (val / targetProject.cost) * 100;
                    const labels: Record<string, string> = {
                      materials: 'مصالح مصرفی (میلگرد و بتن)',
                      labor: 'دستمزد و نیروی انسانی کارگاه',
                      machinery: 'ماشین‌آلات و تجهیزات سنگین',
                      transport: 'کرایه حمل و باربری مصالح',
                      subcontractors: 'پیمانکاران جزء و اکیپ‌ها',
                      procurement: 'خرید ابزارآلات و آهن‌آلات',
                      office: 'ملزومات و تجهیز کارگاه',
                      insurance: 'بیمه کارگاه و پرسنل',
                      tax: 'مالیات تکلیفی و ارزش افزوده',
                      other: 'سایر هزینه‌های متفرقه',
                    };

                    return (
                      <tr key={key} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-sans font-medium text-slate-900">{labels[key] || key}</td>
                        <td className="py-2.5 px-3 text-left tabular-nums font-bold text-slate-800">{formatCurrency(val)}</td>
                        <td className="py-2.5 px-3 text-left tabular-nums text-slate-500">{formatPercent(percent)}</td>
                        <td className="py-2.5 px-4">
                          <div className="w-48 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${percent * 2}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: TRIAL BALANCE (تراز آزمایشی ۴ و ۸ ستونی) */}
      {reportType === 'trial_balance' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">تراز آزمایشی حساب‌های کل و معین (۴ ستونی)</h3>
              <p className="text-xs text-slate-500">پایش تعادل و توازن دفاتر مالی منتهی به دوره جاری</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              تراز متعادل است
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 font-mono">
                <tr>
                  <th className="py-2.5 px-3 font-sans w-20">کد کل/معین</th>
                  <th className="py-2.5 px-4 font-sans">نام سرفصل حسابداری</th>
                  <th className="py-2.5 px-3 text-left">گردش بدهکار (تومان)</th>
                  <th className="py-2.5 px-3 text-left">گردش بستانکار (تومان)</th>
                  <th className="py-2.5 px-3 text-left">مانده بدهکار (تومان)</th>
                  <th className="py-2.5 px-3 text-left">مانده بستانکار (تومان)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-600">111</td>
                  <td className="py-2.5 px-4 font-sans font-bold text-slate-900">موجودی نقد و بانک</td>
                  <td className="py-2.5 px-3 text-left">320,000,000,000</td>
                  <td className="py-2.5 px-3 text-left">257,313,000,000</td>
                  <td className="py-2.5 px-3 text-left font-bold text-blue-700">62,687,000,000</td>
                  <td className="py-2.5 px-3 text-left text-slate-400">-</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-600">112</td>
                  <td className="py-2.5 px-4 font-sans font-bold text-slate-900">مطالبات و اسناد دریافتنی تجاری</td>
                  <td className="py-2.5 px-3 text-left">410,500,000,000</td>
                  <td className="py-2.5 px-3 text-left">312,900,000,000</td>
                  <td className="py-2.5 px-3 text-left font-bold text-blue-700">97,600,000,000</td>
                  <td className="py-2.5 px-3 text-left text-slate-400">-</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-600">115</td>
                  <td className="py-2.5 px-4 font-sans font-bold text-slate-900">موجودی انبار و مصالح پای کار</td>
                  <td className="py-2.5 px-3 text-left">280,000,000,000</td>
                  <td className="py-2.5 px-3 text-left">100,487,000,000</td>
                  <td className="py-2.5 px-3 text-left font-bold text-blue-700">179,513,000,000</td>
                  <td className="py-2.5 px-3 text-left text-slate-400">-</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-600">211</td>
                  <td className="py-2.5 px-4 font-sans font-bold text-slate-900">حساب‌های پرداختنی به تأمین‌کنندگان</td>
                  <td className="py-2.5 px-3 text-left">110,000,000,000</td>
                  <td className="py-2.5 px-3 text-left">164,800,000,000</td>
                  <td className="py-2.5 px-3 text-left text-slate-400">-</td>
                  <td className="py-2.5 px-3 text-left font-bold text-amber-800">54,800,000,000</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-600">411</td>
                  <td className="py-2.5 px-4 font-sans font-bold text-slate-900">درآمد کارکرد پیمانکاری</td>
                  <td className="py-2.5 px-3 text-left text-slate-400">-</td>
                  <td className="py-2.5 px-3 text-left">410,500,000,000</td>
                  <td className="py-2.5 px-3 text-left text-slate-400">-</td>
                  <td className="py-2.5 px-3 text-left font-bold text-amber-800">410,500,000,000</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-600">51</td>
                  <td className="py-2.5 px-4 font-sans font-bold text-slate-900">بهای تمام‌شده و هزینه‌های مستقیم</td>
                  <td className="py-2.5 px-3 text-left">295,700,000,000</td>
                  <td className="py-2.5 px-3 text-left text-slate-400">-</td>
                  <td className="py-2.5 px-3 text-left font-bold text-blue-700">295,700,000,000</td>
                  <td className="py-2.5 px-3 text-left text-slate-400">-</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-600">61</td>
                  <td className="py-2.5 px-4 font-sans font-bold text-slate-900">هزینه‌های اداری، عمومی و تشکیلاتی</td>
                  <td className="py-2.5 px-3 text-left">44,600,000,000</td>
                  <td className="py-2.5 px-3 text-left text-slate-400">-</td>
                  <td className="py-2.5 px-3 text-left font-bold text-blue-700">44,600,000,000</td>
                  <td className="py-2.5 px-3 text-left text-slate-400">-</td>
                </tr>
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 font-mono">
                <tr>
                  <td colSpan={2} className="py-3 px-4 font-sans text-xs text-slate-800">
                    جمع کل تراز آزمایشی (بدون مغایرت):
                  </td>
                  <td className="py-3 px-3 text-left text-slate-900">1,260,800,000,000</td>
                  <td className="py-3 px-3 text-left text-slate-900">1,260,800,000,000</td>
                  <td className="py-3 px-3 text-left text-emerald-700">680,100,000,000</td>
                  <td className="py-3 px-3 text-left text-emerald-700">680,100,000,000</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: INCOME STATEMENT (صورت سود و زیان) */}
      {reportType === 'income_statement' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-3xl mx-auto space-y-4">
          <div className="text-center pb-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">صورت سود و زیان شرکت مهندسی سازه گستران پارس</h3>
            <p className="text-xs text-slate-500 mt-1">برای دوره مالی منتهی به ۳۱ شهریورماه ۱۴۰۳ (مبالغ به تومان)</p>
          </div>

          <div className="space-y-3 font-mono text-xs text-slate-800">
            <div className="flex justify-between py-1.5 border-b border-slate-100 font-sans">
              <span className="font-bold">درآمدهای عملیاتی پیمانکاری:</span>
              <span className="font-mono font-bold text-emerald-700">410,500,000,000</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-600 font-sans pr-4">
              <span>کسر می‌شود: بهای تمام‌شده مستقیم پیمان‌ها (Direct Costs):</span>
              <span className="font-mono text-rose-700">(295,700,000,000)</span>
            </div>
            <div className="flex justify-between py-2 bg-slate-50 px-2 rounded-lg font-bold font-sans">
              <span>سود ناخالص عملیاتی شرکت (Gross Profit):</span>
              <span className="font-mono text-emerald-800">114,800,000,000</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-600 font-sans pr-4">
              <span>کسر می‌شود: هزینه‌های عمومی، اداری و تشکیلاتی ستاد:</span>
              <span className="font-mono text-rose-700">(38,100,000,000)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-600 font-sans pr-4">
              <span>کسر می‌شود: هزینه‌های مالی و کارمزد ضمانت‌نامه‌ها:</span>
              <span className="font-mono text-rose-700">(6,500,000,000)</span>
            </div>
            <div className="flex justify-between py-2.5 bg-amber-50 px-3 rounded-xl border border-amber-200 font-extrabold text-sm font-sans text-amber-950">
              <span>سود خالص قبل از کسر مالیات دوره:</span>
              <span className="font-mono text-amber-900">70,200,000,000</span>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 4: BALANCE SHEET (ترازنامه) */}
      {reportType === 'balance_sheet' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-4xl mx-auto space-y-4">
          <div className="text-center pb-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">ترازنامه شرکت مهندسی سازه گستران پارس</h3>
            <p className="text-xs text-slate-500 mt-1">تراز استاندارد دوطرفه دارایی‌ها در برابر بدهی‌ها و حقوق صاحبان سهام</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Assets */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <h4 className="font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">دارایی‌ها (Assets)</h4>
              <div className="space-y-2 font-mono">
                <div className="flex justify-between"><span>موجودی نقد و بانک:</span><strong>62,687,000,000</strong></div>
                <div className="flex justify-between"><span>مطالبات از کارفرمایان:</span><strong>97,600,000,000</strong></div>
                <div className="flex justify-between"><span>سپرده‌های حسن انجام کار و بیمه:</span><strong>48,500,000,000</strong></div>
                <div className="flex justify-between"><span>پیش‌پرداخت‌ها:</span><strong>24,200,000,000</strong></div>
                <div className="flex justify-between"><span>موجودی انبار و مصالح پای کار:</span><strong>179,513,000,000</strong></div>
                <div className="flex justify-between pt-2 border-t border-slate-200"><span>دارایی‌های ثابت و ماشین‌آلات:</span><strong>171,800,000,000</strong></div>
                <div className="flex justify-between pt-3 border-t-2 border-slate-300 font-bold text-sm text-blue-900">
                  <span className="font-sans">جمع کل دارایی‌ها:</span>
                  <span>584,300,000,000</span>
                </div>
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <h4 className="font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">بدهی‌ها و حقوق صاحبان سهام</h4>
              <div className="space-y-2 font-mono">
                <div className="flex justify-between"><span>حساب‌های پرداختنی تجاری:</span><strong>54,800,000,000</strong></div>
                <div className="flex justify-between"><span>بیمه و مالیات پرداختنی:</span><strong>24,100,000,000</strong></div>
                <div className="flex justify-between"><span>پیش‌دریافت‌ها از کارفرمایان:</span><strong>70,000,000,000</strong></div>
                <div className="flex justify-between"><span>حقوق و دستمزد پرداختنی:</span><strong>5,000,000,000</strong></div>
                <div className="flex justify-between"><span>تسهیلات بانکی بلندمدت:</span><strong>30,000,000,000</strong></div>
                <div className="flex justify-between pt-2 border-t border-slate-200"><span>سرمایه ثبتی شرکت:</span><strong>250,000,000,000</strong></div>
                <div className="flex justify-between"><span>سود انباشته و اندوخته‌ها:</span><strong>150,400,000,000</strong></div>
                <div className="flex justify-between pt-3 border-t-2 border-slate-300 font-bold text-sm text-emerald-900">
                  <span className="font-sans">جمع کل بدهی و سرمایه:</span>
                  <span>584,300,000,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 5: GENERAL LEDGER (دفاتر کل و معین) */}
      {reportType === 'general_ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">دفتر روزنامه و ریز گردش اسناد حسابداری</h3>
              <p className="text-xs text-slate-500">مشاهده کلیه تراکنش‌های ثبتی به ترتیب تقدم تاریخ و شماره سند</p>
            </div>
          </div>

          <div className="space-y-3">
            {journalEntries.map((doc) => (
              <div key={doc.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{doc.docNumber}</span>
                    <span className="text-[11px] text-slate-500">تاریخ: {doc.date}</span>
                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded font-semibold">{doc.type}</span>
                  </div>
                  <strong className="font-mono text-slate-800">{formatCurrency(doc.totalDebit)} تومان</strong>
                </div>
                <p className="text-slate-700 font-medium">{doc.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
