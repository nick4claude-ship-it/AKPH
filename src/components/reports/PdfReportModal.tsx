import React from 'react';
import { Project, KpiItem, PettyCashAccount, DetailedProgressStatement } from '../../types';
import { formatCurrencyCompact, formatPercent, formatNumber } from '../../utils/formatters';
import { toPersianDate, getCurrentFiscalYear } from '../../utils/date';
import { X, Printer, Download, Building2, CheckCircle2 } from 'lucide-react';

interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  kpis: KpiItem[];
  pettyFunds: PettyCashAccount[];
  statements: DetailedProgressStatement[];
  targetProject?: Project | null;
}

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  isOpen,
  onClose,
  projects,
  kpis,
  pettyFunds: _pettyFunds,
  statements: _statements,
  targetProject,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const selectedProjects = targetProject ? [targetProject] : projects;
  const totalRevenue = selectedProjects.reduce((sum, p) => sum + p.recordedRevenue, 0);
  const totalCost = selectedProjects.reduce((sum, p) => sum + p.cost, 0);
  const totalProfit = selectedProjects.reduce((sum, p) => sum + p.profit, 0);
  const totalReceivables = selectedProjects.reduce((sum, p) => sum + p.receivables, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-auto overflow-hidden animate-in fade-in duration-200">
        {/* Modal Top Bar (Hidden during print) */}
        <div className="no-print bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white">
              پیش‌نمایش سند رسمی گزارش مدیریتی (PDF Report)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ / ذخیره PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper Document (A4 Styled container) */}
        <div className="p-8 sm:p-10 max-h-[82vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 text-right bg-white text-slate-900 font-sans">
          {/* Header Block: Logo, Company Name, Report Title, Date */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg border border-slate-300 p-1 flex items-center justify-center overflow-hidden">
                <img
                  src="/src/assets/images/company_logo_emblem_1790176049355.jpg"
                  alt="لوگوی شرکت"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-slate-900">
                  شرکت مهندسی و پیمانکاری سازه گستران پارس
                </h1>
                <p className="text-xs text-slate-600">
                  سهامی خاص · شماره ثبت: ۴۹۲۱۸۴ · سامانه یکپارچه مدیریت مالی پروژه‌ها
                </p>
                <p className="text-[11px] text-amber-700 font-bold mt-0.5">
                  گزارش رسمی پایش عملکرد مالی و سودآوری پروژه‌های EPC
                </p>
              </div>
            </div>

            <div className="text-left font-mono text-[11px] text-slate-600 space-y-1">
              <div>
                شماره گزارش: <strong className="text-slate-900">{`REP-${getCurrentFiscalYear()}-${toPersianDate(new Date()).replace(/\//g, '-')}`}</strong>
              </div>
              <div>
                تاریخ صدور: <strong className="text-slate-900">{toPersianDate(new Date())}</strong>
              </div>
              <div>
                بازه گزارش: <span className="text-slate-800">{`سال مالی جاری (${getCurrentFiscalYear()})`}</span>
              </div>
              <div>
                طبقه‌بندی: <span className="bg-slate-100 px-1.5 py-0.5 rounded font-sans text-[10px] text-red-700 font-bold">محرمانه - مدیران ارشد</span>
              </div>
            </div>
          </div>

          {/* Applied Filters Strip */}
          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg mb-6 text-xs text-slate-700 flex flex-wrap items-center justify-between">
            <div>
              <strong>فیلترهای اعمال‌شده:</strong>{' '}
              {targetProject ? `پروژه اختصاصی: ${targetProject.name} (${targetProject.code})` : 'تمام پروژه‌های عمرانی فعال (۵ پروژه)'} · مبنای محاسبات: تعهدی و جریان نقد
            </div>
            <div className="font-mono text-slate-500">واحد مبالغ: میلیون و میلیارد تومان</div>
          </div>

          {/* KPI Summary Block */}
          {!targetProject && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-900 mb-2 border-r-2 border-amber-500 pr-2">
                خلاصه شاخص‌های کلیدی مالی شرکت (Executive KPIs)
              </h3>
              <div className="grid grid-cols-4 gap-2.5 text-center font-mono">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[10px] text-slate-500 block">درآمد کل کارکرد</span>
                  <span className="font-extrabold text-sm text-emerald-800">{formatCurrencyCompact(410_500_000_000)}</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[10px] text-slate-500 block">هزینه کل تمام‌شده</span>
                  <span className="font-bold text-sm text-slate-800">{formatCurrencyCompact(340_300_000_000)}</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[10px] text-slate-500 block">سود ناخالص عملیاتی</span>
                  <span className="font-extrabold text-sm text-amber-700">{formatCurrencyCompact(70_200_000_000)}</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[10px] text-slate-500 block">مطالبات از کارفرمایان</span>
                  <span className="font-bold text-sm text-rose-700">{formatCurrencyCompact(97_600_000_000)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Main Financial Table */}
          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate-900 mb-2 border-r-2 border-amber-500 pr-2">
              جدول تفصیلی وضعیت مالی و پیشرفت پروژه‌ها
            </h3>
            <table className="w-full text-right text-xs border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2 border-l border-slate-200">کد</th>
                  <th className="p-2 border-l border-slate-200">پروژه و کارفرما</th>
                  <th className="p-2 border-l border-slate-200 text-left">مبلغ قرارداد</th>
                  <th className="p-2 border-l border-slate-200 text-left">کارکرد (درآمد)</th>
                  <th className="p-2 border-l border-slate-200 text-left">هزینه</th>
                  <th className="p-2 border-l border-slate-200 text-left">سود</th>
                  <th className="p-2 border-l border-slate-200 text-center">حاشیه سود</th>
                  <th className="p-2 border-l border-slate-200 text-left">مطالبات</th>
                  <th className="p-2 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {selectedProjects.map((p) => (
                  <tr key={p.id}>
                    <td className="p-2 border-l border-slate-200 font-bold">{p.code}</td>
                    <td className="p-2 border-l border-slate-200 font-sans">
                      <div className="font-bold">{p.name}</div>
                      <div className="text-[10px] text-slate-500">{p.client}</div>
                    </td>
                    <td className="p-2 border-l border-slate-200 text-left">{formatCurrencyCompact(p.contractAmount)}</td>
                    <td className="p-2 border-l border-slate-200 text-left font-bold text-emerald-800">{formatCurrencyCompact(p.recordedRevenue)}</td>
                    <td className="p-2 border-l border-slate-200 text-left">{formatCurrencyCompact(p.cost)}</td>
                    <td className="p-2 border-l border-slate-200 text-left font-bold text-amber-700">{formatCurrencyCompact(p.profit)}</td>
                    <td className="p-2 border-l border-slate-200 text-center">{formatPercent(p.profitMargin)}</td>
                    <td className="p-2 border-l border-slate-200 text-left text-rose-700">{formatCurrencyCompact(p.receivables)}</td>
                    <td className="p-2 text-center font-sans text-[11px]">{p.status}</td>
                  </tr>
                ))}
                {/* Total Summary Row */}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td colSpan={2} className="p-2 border-l border-slate-200 font-sans text-right">جمع کل:</td>
                  <td className="p-2 border-l border-slate-200 text-left">{formatCurrencyCompact(selectedProjects.reduce((a, b) => a + b.contractAmount, 0))}</td>
                  <td className="p-2 border-l border-slate-200 text-left text-emerald-800">{formatCurrencyCompact(totalRevenue)}</td>
                  <td className="p-2 border-l border-slate-200 text-left">{formatCurrencyCompact(totalCost)}</td>
                  <td className="p-2 border-l border-slate-200 text-left text-amber-700">{formatCurrencyCompact(totalProfit)}</td>
                  <td className="p-2 border-l border-slate-200 text-center font-sans">
                    {formatPercent((totalProfit / totalRevenue) * 100)}
                  </td>
                  <td className="p-2 border-l border-slate-200 text-left text-rose-700">{formatCurrencyCompact(totalReceivables)}</td>
                  <td className="p-2 text-center font-sans">-</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures & Approvals Block */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs print-break-inside-avoid">
            <div className="space-y-6">
              <span className="font-bold text-slate-800">تنظیم‌کننده (کارشناس کنترل پروژه)</span>
              <div className="h-12 flex items-center justify-center text-slate-400 font-mono text-[11px]">
                [مهندس کیارش نادری]
              </div>
              <span className="text-[10px] text-slate-500">امضا و تاریخ</span>
            </div>

            <div className="space-y-6">
              <span className="font-bold text-slate-800">تأییدکننده (مدیر مالی و اداری)</span>
              <div className="h-12 flex items-center justify-center text-slate-400 font-mono text-[11px]">
                [دکتر هادی صمدیان]
              </div>
              <span className="text-[10px] text-slate-500">امضا و تاریخ</span>
            </div>

            <div className="space-y-6">
              <span className="font-bold text-slate-800">تصویب نهایی (مدیرعامل شرکت)</span>
              <div className="h-12 flex items-center justify-center text-amber-700 font-mono text-[11px] font-bold">
                [مهندس محمدرضا رادمنش]
              </div>
              <span className="text-[10px] text-slate-500">امضا و مهر رسمی شرکت</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
