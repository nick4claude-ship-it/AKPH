import React, { useMemo, useState } from 'react';
import { BarChart3, Printer, Download, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Project, CostCenter, JournalEntry } from '../../types';
import { formatPercent, formatText } from '../../utils/formatters';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { downloadTable } from '../../utils/export';
import { useSelector } from '../../store/AppStore';
import { selectFinancialReports } from '../../store/views/accounting';
import { financialReportCsv } from '../../store/views/exports';
import { Money } from '../common/Money';

interface FinancialReportsViewProps {
  projects: Project[];
  costCenters: CostCenter[];
  journalEntries: JournalEntry[];
}

type ReportType = 'project_pnl' | 'trial_balance' | 'income_statement' | 'balance_sheet' | 'general_ledger';

const REPORTS: [ReportType, string][] = [
  ['project_pnl', 'سود و زیان پروژه'],
  ['trial_balance', 'تراز آزمایشی'],
  ['income_statement', 'صورت سود و زیان'],
  ['balance_sheet', 'ترازنامه'],
  ['general_ledger', 'دفتر روزنامه'],
];

/**
 * All reports are computed from final journal entries of this system. Manual project summaries
 * (budget, forecast) are never added to these figures and are not shown as accounting reports.
 */
export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({ projects, journalEntries }) => {
  const unit = moneyUnitLabel();
  const [reportType, setReportType] = useState<ReportType>('project_pnl');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const targetProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Every report is computed in the store from final entries.
  const reports = useSelector((s) => selectFinancialReports(s, journalEntries, targetProject?.id), [journalEntries, targetProject?.id]);
  const { finals, trial, trialTotals, incomeStatement, balanceSheet, projectFinancials, breakdown } = reports;
  const { revenue, directCost, overhead, financialCost } = incomeStatement;
  const incomeStatementProfit = incomeStatement.profit;
  const { assets, netProfit } = balanceSheet;
  const totalDebit = trialTotals.debit;
  const totalCredit = trialTotals.credit;

  const exportCsv = () => downloadTable(financialReportCsv(reportType, reports, targetProject));

  const row = (label: string, amount: number, className = '') => (
    <div className={`flex justify-between py-2 border-b border-slate-100 font-sans ${className}`}>
      <span>{label}</span>
      <span className="tabular-nums">{amount < 0 ? `(${formatMoney(-amount, false)})` : formatMoney(amount, false)}</span>
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2" role="tablist">
          {REPORTS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={reportType === key}
              onClick={() => setReportType(key)}
              className={`px-3 py-2 rounded-lg text-sm font-bold cursor-pointer ${reportType === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-sm font-medium cursor-pointer hover:bg-emerald-100">
            <Download className="w-3.5 h-3.5" />
            <span>خروجی Excel </span>
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium cursor-pointer">
            <Printer className="w-3.5 h-3.5" />
            <span>چاپ</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 flex items-center gap-2">
        <BarChart3 className="w-3.5 h-3.5" />
        همه گزارش‌ها از اسناد قطعی ثبت‌شده در این سامانه ساخته می‌شوند (مبالغ به {unit}).
      </p>

      {reportType === 'project_pnl' && targetProject && projectFinancials && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">سود و زیان پروژه: {formatText(targetProject.name)}</h3>
              <p className="text-xs text-slate-500 mt-1">
                کارفرما: {formatText(targetProject.client)} · کد پروژه: {formatText(targetProject.code)}
              </p>
            </div>
            <label className="text-xs text-slate-500 flex items-center gap-2">
              پروژه:
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer font-sans">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatText(p.name)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums text-center">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-sm font-sans text-emerald-800 block mb-1">درآمد شناسایی‌شده</span>
              <strong className="text-sm text-emerald-900 font-bold"><Money rial={projectFinancials.recordedRevenue} /></strong>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-sm font-sans text-slate-600 block mb-1">− بهای تمام‌شده مستقیم (گروه ۵)</span>
              <strong className="text-sm text-slate-900 font-bold"><Money rial={projectFinancials.actualCost} /></strong>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-sm font-sans text-amber-800 block mb-1">= سود ناخالص پروژه</span>
              <strong className="text-sm text-amber-900 font-bold">
                <Money rial={projectFinancials.profit} /> ({formatPercent(projectFinancials.profitMargin)})
              </strong>
            </div>
          </div>
          <p className="text-xs text-slate-500">سربار دفتر مرکزی (گروه ۶) در دفاتر به پروژه‌ها تسهیم نمی‌شود و در سود و زیان شرکت دیده می‌شود.</p>

          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-700" />
              <span>ریز بهای تمام‌شده پروژه بر اساس حساب:</span>
            </h4>
            <div className="border border-slate-200 rounded-xl table-scroll">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-4">حساب</th>
                    <th className="py-2 px-3 tabular-nums text-left">مبلغ ({unit})</th>
                    <th className="py-2 px-3 tabular-nums text-left">سهم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {breakdown.map((b) => (
                    <tr key={b.accountCode} className="hover:bg-slate-50">
                      <td className="py-2 px-4 font-sans font-medium text-slate-900">
                        <span className="tabular-nums text-xs text-slate-500 ml-1">{formatText(b.accountCode)}</span>
                        {formatText(b.accountName)}
                      </td>
                      <td className="py-2 px-3 text-left tabular-nums font-bold text-slate-800">{formatMoney(b.amount, false)}</td>
                      <td className="py-2 px-3 text-left tabular-nums text-slate-500">{formatPercent(b.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {breakdown.length === 0 && <p className="py-8 text-center text-xs text-slate-500">هزینه‌ای برای این پروژه ثبت نشده است.</p>}
            </div>
          </div>
        </div>
      )}

      {reportType === 'trial_balance' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">تراز آزمایشی چهارستونی</h3>
            {totalDebit === totalCredit ? (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> تراز متعادل است
              </span>
            ) : (
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-md border border-rose-200 inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> تراز نامتعادل
              </span>
            )}
          </div>
          <div className="border border-slate-200 rounded-xl table-scroll">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-700 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 w-20">کد</th>
                  <th className="py-2 px-4">حساب</th>
                  <th className="py-2 px-3 text-left">گردش بدهکار</th>
                  <th className="py-2 px-3 text-left">گردش بستانکار</th>
                  <th className="py-2 px-3 text-left">مانده بدهکار</th>
                  <th className="py-2 px-3 text-left">مانده بستانکار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {trial.map((t) => (
                  <tr key={t.code} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-600">{formatText(t.code)}</td>
                    <td className="py-2 px-4 font-sans text-slate-900">{formatText(t.name)}</td>
                    <td className="py-2 px-3 text-left">{formatMoney(t.debit, false)}</td>
                    <td className="py-2 px-3 text-left">{formatMoney(t.credit, false)}</td>
                    <td className="py-2 px-3 text-left font-bold text-blue-700">{t.debitBalance > 0 ? formatMoney(t.debitBalance, false) : '-'}</td>
                    <td className="py-2 px-3 text-left font-bold text-amber-800">{t.creditBalance > 0 ? formatMoney(t.creditBalance, false) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 tabular-nums">
                <tr>
                  <td colSpan={2} className="py-3 px-4 font-sans text-sm text-slate-800">
                    جمع
                  </td>
                  <td className="py-3 px-3 text-left">{formatMoney(totalDebit, false)}</td>
                  <td className="py-3 px-3 text-left">{formatMoney(totalCredit, false)}</td>
                  <td className="py-3 px-3 text-left text-emerald-700">{formatMoney(trialTotals.debitBalance, false)}</td>
                  <td className="py-3 px-3 text-left text-emerald-700">{formatMoney(trialTotals.creditBalance, false)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {reportType === 'income_statement' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-3xl mx-auto space-y-4">
          <div className="text-center pb-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">صورت سود و زیان</h3>
            <p className="text-xs text-slate-500 mt-1">از اسناد قطعی ثبت‌شده (مبالغ به {unit})</p>
          </div>
          <div className="space-y-1 text-sm text-slate-800">
            {row('درآمدهای عملیاتی', revenue, 'font-bold text-emerald-700')}
            {row('کسر می‌شود: بهای تمام‌شده مستقیم پیمان‌ها', -directCost, 'text-slate-600 pr-4')}
            {row('سود ناخالص', incomeStatement.grossProfit, 'bg-slate-50 px-2 rounded-lg font-bold')}
            {row('کسر می‌شود: هزینه‌های عمومی و اداری', -overhead, 'text-slate-600 pr-4')}
            {row('کسر می‌شود: هزینه‌های مالی', -financialCost, 'text-slate-600 pr-4')}
            {row('سود (زیان) خالص دوره', incomeStatementProfit, 'bg-amber-50 px-3 rounded-xl border border-amber-200 font-bold text-sm text-amber-950')}
          </div>
        </div>
      )}

      {reportType === 'balance_sheet' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-4xl mx-auto space-y-4">
          <div className="text-center pb-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">ترازنامه</h3>
            <p className="text-xs text-slate-500 mt-1">مانده حساب‌های دائمی از اسناد قطعی؛ سود دوره تا بستن سال جداگانه نشان داده می‌شود.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <h4 className="font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">دارایی‌ها</h4>
              <div className="space-y-1 tabular-nums">
                {balanceSheet.assetRows
                  .map((t) => (
                    <div key={t.code} className="flex justify-between">
                      <span className="font-sans">{formatText(t.name)}</span>
                      <strong>{formatMoney(t.balance, false)}</strong>
                    </div>
                  ))}
                <div className="flex justify-between pt-3 border-t-2 border-slate-300 font-bold text-sm text-blue-900">
                  <span className="font-sans">جمع دارایی‌ها</span>
                  <span>{formatMoney(assets, false)}</span>
                </div>
              </div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <h4 className="font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">بدهی‌ها و حقوق صاحبان سهام</h4>
              <div className="space-y-1 tabular-nums">
                {balanceSheet.claimRows
                  .map((t) => (
                    <div key={t.code} className="flex justify-between">
                      <span className="font-sans">{formatText(t.name)}</span>
                      <strong>{formatMoney(t.amount, false)}</strong>
                    </div>
                  ))}
                <div className="flex justify-between">
                  <span className="font-sans">سود (زیان) دوره بسته‌نشده</span>
                  <strong>{formatMoney(netProfit, false)}</strong>
                </div>
                <div className="flex justify-between pt-3 border-t-2 border-slate-300 font-bold text-sm text-emerald-900">
                  <span className="font-sans">جمع بدهی و حقوق صاحبان سهام</span>
                  <span>{formatMoney(balanceSheet.totalClaims, false)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'general_ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-200">دفتر روزنامه (اسناد قطعی)</h3>
          {finals.map((doc) => (
            <div key={doc.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-bold text-slate-900">{formatText(doc.docNumber)}</span>
                  <span className="text-xs text-slate-500">تاریخ: {formatText(doc.date)}</span>
                  <span className="text-xs bg-slate-200 px-2 rounded font-medium">{formatText(doc.type)}</span>
                </div>
                <strong className="tabular-nums text-slate-800"><Money rial={doc.totalDebit} /></strong>
              </div>
              <p className="text-slate-700 font-medium">{formatText(doc.title)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
