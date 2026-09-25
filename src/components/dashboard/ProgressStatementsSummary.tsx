import React from 'react';
import { DetailedProgressStatement } from '../../types';
import type { ClientStatementPhase } from '../../store/statementPhase';
import { formatCurrencyCompact, formatNumber, formatInt } from '../../utils/formatters';
import { FileText, Clock, AlertTriangle, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { statementsSummary } from '../../store/views/dashboard';

interface ProgressStatementsSummaryProps {
  statements: DetailedProgressStatement[];
  onOpenStatementsModule: () => void;
  onSelectStatement: (statement: DetailedProgressStatement) => void;
}

export const ProgressStatementsSummary: React.FC<ProgressStatementsSummaryProps> = ({
  statements,
  onOpenStatementsModule,
  onSelectStatement,
}) => {
  const summary = statementsSummary(statements);
  const { pendingCount, unapprovedAmount, totalReceivables, totalReceived, totalOverdue } = summary;

  const getStatusBadge = (status: ClientStatementPhase) => {
    switch (status) {
      case 'overdue':
        return (
          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            معوق و سررسیدگذشته
          </span>
        );
      case 'in_review':
      case 'returned':
        return (
          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            در انتظار بررسی
          </span>
        );
      case 'approved':
        return (
          <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            تأیید شده / در صف وصول
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            تسویه شده
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">خلاصه وضعیت صورت‌وضعیت‌ها (کارکرد کارفرمایی)</h3>
            <p className="text-[11px] text-slate-500">
              تجمیع صورت‌وضعیت‌های موقت و قطعی پروژه‌ها · ماژول مستقل صورت‌وضعیت
            </p>
          </div>
        </div>

        <button
          onClick={onOpenStatementsModule}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5 cursor-pointer"
        >
          <span>مشاهده ماژول کامل</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Aggregate Metric Strip (5 Key indicators required by user) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 my-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 font-mono text-center">
        <div>
          <span className="text-[10px] text-slate-500 block mb-0.5">در انتظار تأیید</span>
          <span className="text-base font-extrabold text-amber-700 tabular-nums">
            {formatInt(pendingCount)} مورد
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block mb-0.5">مبلغ تأییدنشده</span>
          <span className="text-sm font-bold text-slate-800 tabular-nums">
            {formatCurrencyCompact(unapprovedAmount)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block mb-0.5">مطالبات کارفرما</span>
          <span className="text-sm font-bold text-rose-600 tabular-nums">
            {formatCurrencyCompact(totalReceivables)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block mb-0.5">مبلغ وصول‌شده نقد</span>
          <span className="text-sm font-bold text-emerald-700 tabular-nums">
            {formatCurrencyCompact(totalReceived)}
          </span>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="text-[10px] text-rose-500 block mb-0.5">مبلغ معوق سررسید</span>
          <span className="text-sm font-black text-rose-700 tabular-nums">
            {formatCurrencyCompact(totalOverdue)}
          </span>
        </div>
      </div>

      {/* Recent Statements Mini Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold select-none">
              <th className="py-2 px-3">عنوان صورت‌وضعیت</th>
              <th className="py-2 px-3">پروژه و کارفرما</th>
              <th className="py-2 px-3 text-left">مبلغ ارسالی</th>
              <th className="py-2 px-3 text-left">تأییدشده</th>
              <th className="py-2 px-3 text-left">وصول‌شده</th>
              <th className="py-2 px-3 text-left">مانده مطالبات</th>
              <th className="py-2 px-3 text-center">وضعیت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {summary.rows.map(({ statement: st, phase, approvedAmount, receivable }) => (
              <tr
                key={st.id}
                onClick={() => onSelectStatement(st)}
                className="hover:bg-blue-50/30 transition-colors cursor-pointer"
              >
                <td className="py-2.5 px-3 font-semibold text-slate-900">
                  {st.statementNumber}
                </td>
                <td className="py-2.5 px-3">
                  <div className="text-slate-800 font-medium">{st.projectName}</div>
                  <div className="text-[10px] text-slate-500">{st.client}</div>
                </td>
                <td className="py-2.5 px-3 font-mono tabular-nums text-left text-slate-700">
                  {formatCurrencyCompact(st.netPayable)}
                </td>
                <td className="py-2.5 px-3 font-mono tabular-nums text-left text-emerald-700 font-bold">
                  {formatCurrencyCompact(approvedAmount)}
                </td>
                <td className="py-2.5 px-3 font-mono tabular-nums text-left text-slate-600">
                  {formatCurrencyCompact(st.receivedAmount)}
                </td>
                <td className="py-2.5 px-3 font-mono tabular-nums text-left text-rose-600 font-semibold">
                  {formatCurrencyCompact(receivable)}
                </td>
                <td className="py-2.5 px-3 text-center">
                  {getStatusBadge(phase)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial Core Principle Note */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
        <span>اصل تفکیک درآمد و وصول: کارکرد تاییدشده (Revenue) در سود شناسایی شده و مانده به عنوان مطالبات (Receivables) منظور گردیده است.</span>
      </div>
    </div>
  );
};
