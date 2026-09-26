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
import { formatMoney, formatMoneyCompact, moneyUnitLabel } from '../../utils/money';
import { formatPercent, formatText } from '../../utils/formatters';
import { downloadTable } from '../../utils/export';
import { contractProgress } from '../../store/views/contracts';
import { clientReceivablesCsv, clientStatementsCsv, contractProgressCsv } from '../../store/views/exports';
import { useCompany } from '../../store/session';
import { Money } from '../common/Money';

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
  const company = useCompany();
  const [activeReport, setActiveReport] = useState<'progress' | 'statements' | 'receivables' | 'variance'>(
    'progress'
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (activeReport === 'progress') downloadTable(contractProgressCsv(contracts));
    else if (activeReport === 'statements') downloadTable(clientStatementsCsv(statements));
    else downloadTable(clientReceivablesCsv(contracts));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs no-print">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            گزارش‌های تحلیلی و مدیریتی پیمان‌ها و صورت‌وضعیت‌ها
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            استخراج گزارش‌های مقایسه‌ای کارکرد، تراز صورت‌وضعیت‌ها، انحرافات ریالی و کهنگی مطالبات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="btn btn-secondary"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی اکسل</span>
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-secondary"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>چاپ گزارش رسمی</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl no-print text-sm font-medium">
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
          <FileText className="w-4 h-4 text-amber-700" />
          <span>گزارش جامع صورت‌وضعیت‌ها و کسورات</span>
        </button>

        <button
          onClick={() => setActiveReport('receivables')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            activeReport === 'receivables' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
          }`}
        >
          <DollarSign className="w-4 h-4 text-rose-700" />
          <span>گزارش مطالبات معوق از دستگاه‌های اجرایی</span>
        </button>
      </div>

      {/* Report 1: Progress & Quad-Variable Balance */}
      {activeReport === 'progress' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">گزارش کارکرد متره شده در برابر سقف قراردادها</h3>
              <span className="text-xs text-slate-500">تاریخ گزارش: مهر ماه ۱۴۰۳ · {formatText(company.name)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 table-scroll">
            <table className="w-full text-right text-sm">
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
                  const progress = contractProgress(c);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 tabular-nums font-bold text-amber-900">{formatText(c.code)}</td>
                      <td className="p-3 font-bold text-slate-900">{formatText(c.projectTitle)}</td>
                      <td className="p-3 text-slate-600">{formatText(c.employer)}</td>
                      <td className="p-3 text-left tabular-nums font-bold">
                        <Money rial={c.currentValue} compact />
                      </td>
                      <td className="p-3 text-left tabular-nums font-bold text-indigo-700">
                        <Money rial={c.executedValue} compact />
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-1 rounded text-xs font-bold bg-indigo-50 text-indigo-800">
                          {formatPercent(progress.executedPercent)}
                        </span>
                      </td>
                      <td className="p-3 text-left tabular-nums text-purple-700">
                        <Money rial={c.billedValue} compact />
                      </td>
                      <td className="p-3 text-left tabular-nums font-bold text-emerald-700">
                        <Money rial={c.receivedValue} compact />
                      </td>
                      <td className="p-3 text-left tabular-nums text-slate-500">
                        <Money rial={c.remainingValue} compact />
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
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">گزارش مالی صورت‌وضعیت‌ها و خالص دریافتی</h3>
              <span className="text-xs text-slate-500">تفکیک ناخالص، کسورات قانونی و مطالبات</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 table-scroll">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">شماره صورت‌وضعیت</th>
                  <th className="p-3">پروژه و کارفرما</th>
                  <th className="p-3">دوره کارکرد</th>
                  <th className="p-3 text-left">مبلغ ناخالص ({moneyUnitLabel()})</th>
                  <th className="p-3 text-left">کسورات ({moneyUnitLabel()})</th>
                  <th className="p-3 text-left">خالص مصوب ({moneyUnitLabel()})</th>
                  <th className="p-3 text-left">وصول‌شده</th>
                  <th className="p-3 text-left">مانده طلب</th>
                  <th className="p-3 text-center">وضعیت تسویه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{formatText(s.statementNumber)}</td>
                    <td className="p-3 font-medium text-slate-800">{formatText(s.projectName)}</td>
                    <td className="p-3 text-slate-600 tabular-nums text-sm">
                      {formatText(s.periodStartDate)} تا {formatText(s.periodEndDate)}
                    </td>
                    <td className="p-3 text-left tabular-nums font-bold text-slate-800">
                      {formatMoney(s.grossAmount, false)}
                    </td>
                    <td className="p-3 text-left tabular-nums text-rose-700">
                      {formatMoney(s.totalDeductions, false)}
                    </td>
                    <td className="p-3 text-left tabular-nums font-bold text-indigo-900">
                      {formatMoney(s.netPayable, false)}
                    </td>
                    <td className="p-3 text-left tabular-nums font-bold text-emerald-700">
                      {formatMoney(s.receivedAmount, false)}
                    </td>
                    <td className="p-3 text-left tabular-nums font-bold text-rose-700">
                      {formatMoney(s.remainingPayable, false)}
                    </td>
                    <td className="p-3 text-center font-bold text-sm">
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
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">گزارش مطالبات معوق به تفکیک دستگاه‌های اجرایی</h3>
              <span className="text-xs text-slate-500">پایش طلب‌های کارکرد تاییدشده جهت پیگیری واحد حقوقی و مالی</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 table-scroll">
            <table className="w-full text-right text-sm">
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
                    <td className="p-3 font-bold text-slate-900">{formatText(c.employer)}</td>
                    <td className="p-3 font-medium text-slate-800">{formatText(c.projectTitle)}</td>
                    <td className="p-3 text-left tabular-nums font-bold text-purple-900">
                      <Money rial={c.approvedBilledValue} compact />
                    </td>
                    <td className="p-3 text-left tabular-nums font-bold text-emerald-700">
                      <Money rial={c.receivedValue} compact />
                    </td>
                    <td className="p-3 text-left tabular-nums font-bold text-rose-700">
                      <Money rial={c.receivableValue} compact />
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          c.receivableValue > 10_000_000_000
                            ? 'bg-rose-100 text-rose-900'
                            : c.receivableValue > 0
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {c.receivableValue > 10_000_000_000
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
