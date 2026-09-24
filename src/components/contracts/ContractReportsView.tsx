/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Contract,
  DetailedProgressStatement,
  ContractBOQItem,
  UserProfile,
} from '../../types';
import {
  FileSpreadsheet,
  Download,
  Printer,
  TrendingUp,
  FileText,
  DollarSign,
  PieChart,
} from 'lucide-react';

interface ContractReportsViewProps {
  contracts: Contract[];
  statements: DetailedProgressStatement[];
  boqItems: ContractBOQItem[];
  currentUser: UserProfile;
}

export const ContractReportsView: React.FC<ContractReportsViewProps> = ({
  contracts,
  statements,
  boqItems,
  currentUser,
}) => {
  const [activeReport, setActiveReport] = useState<'progress' | 'statements' | 'receivables' | 'variance'>(
    'progress'
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let fileName = 'report.csv';

    if (activeReport === 'progress') {
      fileName = 'گزارش_کارکرد_پیمان‌ها.csv';
      headers = ['کد پیمان', 'عنوان پروژه', 'کارفرما', 'مبلغ پیمان', 'کارکرد متره شده', 'درصد پیشرفت', 'صورت‌وضعیت ارسالی', 'وصولی'];
      rows = contracts.map((c) => [
        c.code,
        `"${c.projectTitle}"`,
        `"${c.employer}"`,
        c.currentValue,
        c.executedValue,
        ((c.executedValue / c.currentValue) * 100).toFixed(1) + '%',
        c.billedValue,
        c.receivedValue,
      ]);
    } else if (activeReport === 'statements') {
      fileName = 'گزارش_جامع_صورت‌وضعیت‌ها.csv';
      headers = ['شماره', 'پیمان', 'پروژه', 'دوره', 'ناخالص', 'کسورات', 'خالص', 'دریافتی', 'مانده طلب', 'وضعیت'];
      rows = statements.map((s) => [
        s.statementNumber,
        s.contractCode,
        `"${s.projectName}"`,
        `${s.periodStartDate} تا ${s.periodEndDate}`,
        s.grossAmount,
        s.totalDeductions,
        s.netPayable,
        s.receivedAmount,
        s.remainingPayable,
        s.status,
      ]);
    } else {
      fileName = 'گزارش_مطالبات_کارفرمایان.csv';
      headers = ['پیمان', 'پروژه', 'کارفرما', 'مانده طلب معوق', 'سررسید گذشته'];
      rows = contracts.map((c) => [
        c.code,
        `"${c.projectTitle}"`,
        `"${c.employer}"`,
        c.receivableValue,
        c.receivableValue > 0 ? 'بله' : 'خیر',
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs no-print">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            گزارش‌های تحلیلی و مدیریتی پیمان‌ها و صورت‌وضعیت‌ها
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            استخراج گزارش‌های مقایسه‌ای کارکرد، تراز صورت‌وضعیت‌ها، انحرافات ریالی و کهنگی مطالبات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی اکسل (CSV)</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>چاپ گزارش رسمی</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl no-print text-xs font-medium">
        <button
          onClick={() => setActiveReport('progress')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            activeReport === 'progress' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          <span>گزارش پیشرفت ریالی و کارکرد پیمان‌ها</span>
        </button>

        <button
          onClick={() => setActiveReport('statements')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            activeReport === 'statements' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-600" />
          <span>گزارش جامع صورت‌وضعیت‌ها و کسورات</span>
        </button>

        <button
          onClick={() => setActiveReport('receivables')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            activeReport === 'receivables' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
          }`}
        >
          <DollarSign className="w-4 h-4 text-rose-600" />
          <span>گزارش مطالبات معوق از دستگاه‌های اجرایی</span>
        </button>
      </div>

      {/* Report 1: Progress & Quad-Variable Balance */}
      {activeReport === 'progress' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">گزارش کارکرد متره شده در برابر سقف قراردادها</h3>
              <span className="text-[11px] text-slate-500">تاریخ گزارش: مهر ماه ۱۴۰۳ · شرکت سازه گستران پارس</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">کد پیمان</th>
                  <th className="p-3">عنوان پروژه</th>
                  <th className="p-3">کارفرما</th>
                  <th className="p-3 text-left">مبلغ کل پیمان</th>
                  <th className="p-3 text-left">کارکرد واقعی متره</th>
                  <th className="p-3 text-center">پیشرفت ریالی</th>
                  <th className="p-3 text-left">صورت‌وضعیت ارسالی</th>
                  <th className="p-3 text-left">دریافتی نقد</th>
                  <th className="p-3 text-left">مانده پیمان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((c) => {
                  const execPct = (c.executedValue / c.currentValue) * 100;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-amber-900">{c.code}</td>
                      <td className="p-3 font-bold text-slate-900">{c.projectTitle}</td>
                      <td className="p-3 text-slate-600">{c.employer}</td>
                      <td className="p-3 text-left font-mono font-bold">
                        {(c.currentValue / 1_000_000_000).toFixed(2)} م.ت
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-indigo-700">
                        {(c.executedValue / 1_000_000_000).toFixed(2)} م.ت
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800">
                          {execPct.toFixed(1)}٪
                        </span>
                      </td>
                      <td className="p-3 text-left font-mono text-purple-700">
                        {(c.billedValue / 1_000_000_000).toFixed(2)} م.ت
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-emerald-700">
                        {(c.receivedValue / 1_000_000_000).toFixed(2)} م.ت
                      </td>
                      <td className="p-3 text-left font-mono text-slate-500">
                        {(c.remainingValue / 1_000_000_000).toFixed(2)} م.ت
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 2: Statements Summary */}
      {activeReport === 'statements' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">گزارش مالی صورت‌وضعیت‌ها و خالص دریافتی</h3>
              <span className="text-[11px] text-slate-500">تفکیک ناخالص، کسورات قانونی و مطالبات</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">شماره صورت‌وضعیت</th>
                  <th className="p-3">پروژه و کارفرما</th>
                  <th className="p-3">دوره کارکرد</th>
                  <th className="p-3 text-left">مبلغ ناخالص (تومان)</th>
                  <th className="p-3 text-left">کسورات (تومان)</th>
                  <th className="p-3 text-left">خالص مصوب (تومان)</th>
                  <th className="p-3 text-left">وصول‌شده</th>
                  <th className="p-3 text-left">مانده طلب</th>
                  <th className="p-3 text-center">وضعیت تسویه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{s.statementNumber}</td>
                    <td className="p-3 font-medium text-slate-800">{s.projectName}</td>
                    <td className="p-3 text-slate-600 font-mono text-[11px]">
                      {s.periodStartDate} تا {s.periodEndDate}
                    </td>
                    <td className="p-3 text-left font-mono font-bold text-slate-800">
                      {s.grossAmount.toLocaleString('fa-IR')}
                    </td>
                    <td className="p-3 text-left font-mono text-rose-700">
                      {s.totalDeductions.toLocaleString('fa-IR')}
                    </td>
                    <td className="p-3 text-left font-mono font-bold text-indigo-900">
                      {s.netPayable.toLocaleString('fa-IR')}
                    </td>
                    <td className="p-3 text-left font-mono font-bold text-emerald-700">
                      {s.receivedAmount.toLocaleString('fa-IR')}
                    </td>
                    <td className="p-3 text-left font-mono font-bold text-rose-600">
                      {s.remainingPayable.toLocaleString('fa-IR')}
                    </td>
                    <td className="p-3 text-center font-bold text-[10px]">
                      {s.paymentStatus === 'Paid' ? (
                        <span className="text-emerald-700">تسویه کامل</span>
                      ) : s.paymentStatus === 'Partially Paid' ? (
                        <span className="text-blue-700">پرداخت ناقص</span>
                      ) : (
                        <span className="text-amber-800">بدون وصول</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 3: Receivables */}
      {activeReport === 'receivables' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">گزارش مطالبات معوق به تفکیک دستگاه‌های اجرایی</h3>
              <span className="text-[11px] text-slate-500">پایش طلب‌های کارکرد تاییدشده جهت پیگیری واحد حقوقی و مالی</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">دستگاه اجرایی / کارفرما</th>
                  <th className="p-3">پروژه و پیمان</th>
                  <th className="p-3 text-left">مجموع صورت‌وضعیت مصوب</th>
                  <th className="p-3 text-left">مجموع دریافتی</th>
                  <th className="p-3 text-left">مانده مطالبات معوق</th>
                  <th className="p-3 text-center">وضعیت ریسک وصولی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{c.employer}</td>
                    <td className="p-3 font-medium text-slate-800">{c.projectTitle}</td>
                    <td className="p-3 text-left font-mono font-bold text-purple-900">
                      {(c.approvedBilledValue / 1_000_000_000).toFixed(2)} م.ت
                    </td>
                    <td className="p-3 text-left font-mono font-bold text-emerald-700">
                      {(c.receivedValue / 1_000_000_000).toFixed(2)} م.ت
                    </td>
                    <td className="p-3 text-left font-mono font-black text-rose-700">
                      {(c.receivableValue / 1_000_000_000).toFixed(2)} م.ت
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.receivableValue > 1_000_000_000
                            ? 'bg-rose-100 text-rose-900'
                            : c.receivableValue > 0
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {c.receivableValue > 1_000_000_000
                          ? 'ریسک متوسط تاخیر'
                          : c.receivableValue > 0
                          ? 'پیگیری عادی'
                          : 'بدون معوقه'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
