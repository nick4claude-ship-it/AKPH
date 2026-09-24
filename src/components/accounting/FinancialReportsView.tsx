import React, { useMemo, useState } from 'react';
import { BarChart3, Printer, Download, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Project, CostCenter, JournalEntry } from '../../types';
import { formatPercent } from '../../utils/formatters';
import { formatMoney, moneyUnitLabel, toDisplayAmount } from '../../utils/money';
import { downloadCsv } from '../../utils/export';
import { useAppState } from '../../store/AppStore';
import { selectProjectCostBreakdown, selectProjectFinancials } from '../../store/selectors';

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

const isFinal = (j: JournalEntry) => j.status === 'ثبت قطعی' || j.status === 'تأیید شده' || j.status === 'برگشت خورده';

/**
 * All reports are computed from final journal entries of this system. Manual project summaries
 * (budget, forecast) are never added to these figures and are not shown as accounting reports.
 */
export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({ projects, journalEntries }) => {
  const state = useAppState();
  const unit = moneyUnitLabel();
  const [reportType, setReportType] = useState<ReportType>('project_pnl');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const targetProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const finals = useMemo(() => journalEntries.filter(isFinal), [journalEntries]);

  const trial = useMemo(() => {
    const map = new Map<string, { name: string; debit: number; credit: number }>();
    for (const j of finals) {
      for (const r of j.rows) {
        const cur = map.get(r.accountCode) || { name: r.accountName, debit: 0, credit: 0 };
        map.set(r.accountCode, { name: cur.name, debit: cur.debit + r.debit, credit: cur.credit + r.credit });
      }
    }
    return [...map]
      .map(([code, v]) => ({ code, ...v, balance: v.debit - v.credit }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [finals]);

  const sumBy = (prefix: RegExp) => trial.filter((t) => prefix.test(t.code)).reduce((a, t) => a + t.balance, 0);
  const revenue = -sumBy(/^4/);
  const directCost = sumBy(/^5/);
  const financialCost = sumBy(/^62/);
  const overhead = sumBy(/^6/) - financialCost;
  const netProfit = revenue - directCost - overhead - financialCost;
  const assets = sumBy(/^1/);
  const liabilities = -sumBy(/^2/);
  const equity = -sumBy(/^3/);
  const totalDebit = trial.reduce((a, t) => a + t.debit, 0);
  const totalCredit = trial.reduce((a, t) => a + t.credit, 0);

  const projectFinancials = targetProject ? selectProjectFinancials(state, targetProject.id) : null;
  const breakdown = useMemo(() => (targetProject ? selectProjectCostBreakdown(state, targetProject.id) : []), [state, targetProject]);
  const breakdownTotal = breakdown.reduce((a, b) => a + b.amount, 0);

  const exportCsv = () => {
    const d = (n: number) => toDisplayAmount(n);
    switch (reportType) {
      case 'project_pnl':
        return downloadCsv(`project-pnl-${targetProject?.code || ''}`, ['کد حساب', 'حساب', `مبلغ (${unit})`], breakdown.map((b) => [b.accountCode, b.accountName, d(b.amount)]));
      case 'trial_balance':
        return downloadCsv('trial-balance', ['کد حساب', 'حساب', `گردش بدهکار (${unit})`, `گردش بستانکار (${unit})`, `مانده بدهکار (${unit})`, `مانده بستانکار (${unit})`], trial.map((t) => [t.code, t.name, d(t.debit), d(t.credit), d(Math.max(0, t.balance)), d(Math.max(0, -t.balance))]));
      case 'income_statement':
        return downloadCsv('income-statement', ['شرح', `مبلغ (${unit})`], [
          ['درآمدهای عملیاتی', d(revenue)],
          ['بهای تمام‌شده مستقیم', d(-directCost)],
          ['هزینه‌های عمومی و اداری', d(-overhead)],
          ['هزینه‌های مالی', d(-financialCost)],
          ['سود (زیان) خالص', d(netProfit)],
        ]);
      case 'balance_sheet':
        return downloadCsv('balance-sheet', ['شرح', `مبلغ (${unit})`], [
          ['جمع دارایی‌ها', d(assets)],
          ['جمع بدهی‌ها', d(liabilities)],
          ['حقوق صاحبان سهام', d(equity)],
          ['سود (زیان) دوره بسته‌نشده', d(netProfit)],
        ]);
      case 'general_ledger':
        return downloadCsv('journal', ['شماره سند', 'تاریخ', 'نوع', 'شرح', 'کد حساب', 'حساب', `بدهکار (${unit})`, `بستانکار (${unit})`], finals.flatMap((j) => j.rows.map((r) => [j.docNumber, j.date, j.type, j.title, r.accountCode, r.accountName, d(r.debit), d(r.credit)])));
    }
  };

  const row = (label: string, amount: number, className = '') => (
    <div className={`flex justify-between py-1.5 border-b border-slate-100 font-sans ${className}`}>
      <span>{label}</span>
      <span className="font-mono">{amount < 0 ? `(${formatMoney(-amount, false)})` : formatMoney(amount, false)}</span>
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist">
          {REPORTS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={reportType === key}
              onClick={() => setReportType(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${reportType === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-emerald-100">
            <Download className="w-3.5 h-3.5" />
            <span>خروجی Excel (CSV)</span>
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium cursor-pointer">
            <Printer className="w-3.5 h-3.5" />
            <span>چاپ</span>
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" />
        همه گزارش‌ها از اسناد قطعی ثبت‌شده در این سامانه ساخته می‌شوند (مبالغ به {unit}).
      </p>

      {reportType === 'project_pnl' && targetProject && projectFinancials && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">سود و زیان پروژه: {targetProject.name}</h3>
              <p className="text-xs text-slate-500 mt-1">
                کارفرما: {targetProject.client} · کد پروژه: {targetProject.code}
              </p>
            </div>
            <label className="text-xs text-slate-500 flex items-center gap-2">
              پروژه:
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer font-sans">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-center">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-sans text-emerald-800 block mb-1">درآمد شناسایی‌شده</span>
              <strong className="text-sm text-emerald-900 font-extrabold">{formatMoney(projectFinancials.recordedRevenue)}</strong>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-sans text-slate-600 block mb-1">− بهای تمام‌شده مستقیم (گروه ۵)</span>
              <strong className="text-sm text-slate-900 font-bold">{formatMoney(projectFinancials.actualCost)}</strong>
            </div>
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-[11px] font-sans text-amber-800 block mb-1">= سود ناخالص پروژه</span>
              <strong className="text-sm text-amber-900 font-extrabold">
                {formatMoney(projectFinancials.profit)} ({formatPercent(projectFinancials.profitMargin)})
              </strong>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">سربار دفتر مرکزی (گروه ۶) در دفاتر به پروژه‌ها تسهیم نمی‌شود و در سود و زیان شرکت دیده می‌شود.</p>

          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>ریز بهای تمام‌شده پروژه بر اساس حساب:</span>
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">حساب</th>
                    <th className="py-2.5 px-3 font-mono text-left">مبلغ ({unit})</th>
                    <th className="py-2.5 px-3 font-mono text-left">سهم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {breakdown.map((b) => (
                    <tr key={b.accountCode} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-sans font-medium text-slate-900">
                        <span className="font-mono text-[10px] text-slate-400 ml-1">{b.accountCode}</span>
                        {b.accountName}
                      </td>
                      <td className="py-2.5 px-3 text-left tabular-nums font-bold text-slate-800">{formatMoney(b.amount, false)}</td>
                      <td className="py-2.5 px-3 text-left tabular-nums text-slate-500">{formatPercent(breakdownTotal ? (b.amount / breakdownTotal) * 100 : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {breakdown.length === 0 && <p className="py-8 text-center text-xs text-slate-400">هزینه‌ای برای این پروژه ثبت نشده است.</p>}
            </div>
          </div>
        </div>
      )}

      {reportType === 'trial_balance' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">تراز آزمایشی چهارستونی</h3>
            {totalDebit === totalCredit ? (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> تراز متعادل است
              </span>
            ) : (
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200 inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> تراز نامتعادل
              </span>
            )}
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-20">کد</th>
                  <th className="py-2.5 px-4">حساب</th>
                  <th className="py-2.5 px-3 text-left">گردش بدهکار</th>
                  <th className="py-2.5 px-3 text-left">گردش بستانکار</th>
                  <th className="py-2.5 px-3 text-left">مانده بدهکار</th>
                  <th className="py-2.5 px-3 text-left">مانده بستانکار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {trial.map((t) => (
                  <tr key={t.code} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-600">{t.code}</td>
                    <td className="py-2 px-4 font-sans text-slate-900">{t.name}</td>
                    <td className="py-2 px-3 text-left">{formatMoney(t.debit, false)}</td>
                    <td className="py-2 px-3 text-left">{formatMoney(t.credit, false)}</td>
                    <td className="py-2 px-3 text-left font-bold text-blue-700">{t.balance > 0 ? formatMoney(t.balance, false) : '-'}</td>
                    <td className="py-2 px-3 text-left font-bold text-amber-800">{t.balance < 0 ? formatMoney(-t.balance, false) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 font-mono">
                <tr>
                  <td colSpan={2} className="py-3 px-4 font-sans text-xs text-slate-800">
                    جمع
                  </td>
                  <td className="py-3 px-3 text-left">{formatMoney(totalDebit, false)}</td>
                  <td className="py-3 px-3 text-left">{formatMoney(totalCredit, false)}</td>
                  <td className="py-3 px-3 text-left text-emerald-700">{formatMoney(trial.reduce((a, t) => a + Math.max(0, t.balance), 0), false)}</td>
                  <td className="py-3 px-3 text-left text-emerald-700">{formatMoney(trial.reduce((a, t) => a + Math.max(0, -t.balance), 0), false)}</td>
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
          <div className="space-y-1 text-xs text-slate-800">
            {row('درآمدهای عملیاتی', revenue, 'font-bold text-emerald-700')}
            {row('کسر می‌شود: بهای تمام‌شده مستقیم پیمان‌ها', -directCost, 'text-slate-600 pr-4')}
            {row('سود ناخالص', revenue - directCost, 'bg-slate-50 px-2 rounded-lg font-bold')}
            {row('کسر می‌شود: هزینه‌های عمومی و اداری', -overhead, 'text-slate-600 pr-4')}
            {row('کسر می‌شود: هزینه‌های مالی', -financialCost, 'text-slate-600 pr-4')}
            {row('سود (زیان) خالص دوره', netProfit, 'bg-amber-50 px-3 rounded-xl border border-amber-200 font-extrabold text-sm text-amber-950')}
          </div>
        </div>
      )}

      {reportType === 'balance_sheet' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-4xl mx-auto space-y-4">
          <div className="text-center pb-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">ترازنامه</h3>
            <p className="text-xs text-slate-500 mt-1">مانده حساب‌های دائمی از اسناد قطعی؛ سود دوره تا بستن سال جداگانه نشان داده می‌شود.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <h4 className="font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">دارایی‌ها</h4>
              <div className="space-y-1 font-mono">
                {trial
                  .filter((t) => t.code.startsWith('1') && t.balance !== 0)
                  .map((t) => (
                    <div key={t.code} className="flex justify-between">
                      <span className="font-sans">{t.name}</span>
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
              <div className="space-y-1 font-mono">
                {trial
                  .filter((t) => /^[23]/.test(t.code) && t.balance !== 0)
                  .map((t) => (
                    <div key={t.code} className="flex justify-between">
                      <span className="font-sans">{t.name}</span>
                      <strong>{formatMoney(-t.balance, false)}</strong>
                    </div>
                  ))}
                <div className="flex justify-between">
                  <span className="font-sans">سود (زیان) دوره بسته‌نشده</span>
                  <strong>{formatMoney(netProfit, false)}</strong>
                </div>
                <div className="flex justify-between pt-3 border-t-2 border-slate-300 font-bold text-sm text-emerald-900">
                  <span className="font-sans">جمع بدهی و حقوق صاحبان سهام</span>
                  <span>{formatMoney(liabilities + equity + netProfit, false)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'general_ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-200">دفتر روزنامه (اسناد قطعی)</h3>
          {finals.map((doc) => (
            <div key={doc.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">{doc.docNumber}</span>
                  <span className="text-[11px] text-slate-500">تاریخ: {doc.date}</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 rounded font-semibold">{doc.type}</span>
                </div>
                <strong className="font-mono text-slate-800">{formatMoney(doc.totalDebit)}</strong>
              </div>
              <p className="text-slate-700 font-medium">{doc.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
