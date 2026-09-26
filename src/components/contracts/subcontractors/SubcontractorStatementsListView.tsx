/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  SubcontractorProgressStatement,
  SubcontractorStatementWorkflowStatus,
  Project,
  UserProfile,
} from '../../../types';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  ChevronLeft,
  DollarSign,
  Printer,
  Building,
  Hammer,
  ArrowRight,
  ShieldCheck,
  CheckSquare,
} from 'lucide-react';
import { formatMoneyCompact } from '../../../utils/money';
import { formatPercent, formatInt, formatText } from '../../../utils/formatters';
import { sumSubcontractorStatements } from '../../../store/views/contracts';
import { Money } from '../../common/Money';

interface SubcontractorStatementsListViewProps {
  statements: SubcontractorProgressStatement[];
  projects: Project[];
  currentUser: UserProfile;
  onSelectStatement: (statement: SubcontractorProgressStatement) => void;
  onOpenNewStatement: () => void;
  onPayStatement?: (statement: SubcontractorProgressStatement) => void;
}

export const SubcontractorStatementsListView: React.FC<SubcontractorStatementsListViewProps> = ({
  statements,
  projects,
  currentUser,
  onSelectStatement,
  onOpenNewStatement,
  onPayStatement,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tradeFilter, setTradeFilter] = useState<string>('all');

  // Trade list
  const tradeTypes = useMemo(() => {
    const set = new Set<string>();
    statements.forEach((s) => set.add(s.tradeType));
    return Array.from(set);
  }, [statements]);

  const filteredStatements = useMemo(() => {
    return statements.filter((s) => {
      const matchSearch =
        s.statementNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.subcontractorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.subcontractorContractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.projectName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchProject = selectedProjectId === 'all' || s.projectId === selectedProjectId;
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchTrade = tradeFilter === 'all' || s.tradeType === tradeFilter;

      return matchSearch && matchProject && matchStatus && matchTrade;
    });
  }, [statements, searchTerm, selectedProjectId, statusFilter, tradeFilter]);

  // Totals
  const totals = useMemo(() => sumSubcontractorStatements(filteredStatements), [filteredStatements]);
  const { gross: totalGross, siteVerified: totalSiteVerified, deductions: totalDeductions, net: totalNet, paid: totalPaid, remaining: totalRemaining } = totals;

  // Status badge helper
  const renderStatusBadge = (status: SubcontractorStatementWorkflowStatus) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <Clock className="w-3 h-3 text-slate-600" />
            ثبت اولیه پیمانکار
          </span>
        );
      case 'measured':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-900 border border-sky-300">
            <Clock className="w-3 h-3 text-sky-700" />
            اندازه‌گیری شد
          </span>
        );
      case 'finance_approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-900 border border-teal-300">
            <CheckSquare className="w-3 h-3 text-teal-700" />
            تأیید مالی (منتظر مدیر ارشد)
          </span>
        );
      case 'site_review':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-700" />
            تأیید کارگاه
          </span>
        );
      case 'pm_approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
            <CheckSquare className="w-3 h-3 text-indigo-700" />
            تأیید مدیر پروژه
          </span>
        );
      case 'management_approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
            <ShieldCheck className="w-3 h-3 text-purple-700" />
            تأیید مدیر ارشد (بدهی ثبت شد)
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            پرداخت‌شده و ثبت هزینه
          </span>
        );
      case 'returned_for_revision':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300">
            <AlertTriangle className="w-3 h-3 text-orange-700" />
            برگشت جهت اصلاح
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
            <AlertTriangle className="w-3 h-3 text-rose-700" />
            رد شده
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">صورت‌وضعیت‌های پیمانکاران جزء</h3>
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-bold">
              {formatInt(filteredStatements.length)} دوره
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            کارکرد اعلامی پیمانکاران، کنترل متره کارگاهی، چرخه تاییدات ۶ مرحله‌ای و دستور پرداخت با ثبت اتوماتیک هزینه پروژه
          </p>
        </div>

        <button
          onClick={onOpenNewStatement}
          className="btn btn-primary shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت صورت‌وضعیت جدید پیمانکار جزء</span>
        </button>
      </div>

      {/* Financial Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">ناخالص کارکرد اعلامی</span>
          <span className="text-base font-bold text-slate-900">
            <Money rial={totalGross} compact />
          </span>
                  </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">تأییدشده متره کارگاه</span>
          <span className="text-base font-bold text-blue-700">
            <Money rial={totalSiteVerified} compact />
          </span>
          <span className="text-sm text-blue-600 block mt-1">
            {formatPercent(totals.acceptedPercent)} پذیرش
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">کسورات (سپرده/پیش‌پرداخت)</span>
          <span className="text-base font-bold text-amber-700">
            <Money rial={totalDeductions} compact />
          </span>
                  </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">خالص مصوب قابل پرداخت</span>
          <span className="text-base font-bold text-purple-700">
            <Money rial={totalNet} compact />
          </span>
                  </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">مبالغ پرداخت‌شده قطعی</span>
          <span className="text-base font-bold text-emerald-700">
            <Money rial={totalPaid} compact />
          </span>
          <span className="text-sm text-emerald-700 block mt-1 font-bold">
            {formatPercent(totals.settledPercent)} تسویه
          </span>
        </div>

        <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-sm text-rose-800 font-bold block mb-1">مانده بدهی پرداختنی</span>
          <span className="text-base font-bold text-rose-700">
            <Money rial={totalRemaining} compact />
          </span>
          <span className="text-sm text-rose-700 block mt-1 font-bold">تعهد فوری شرکت</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
            <input aria-label="جستجو در شماره، پیمانکار، پروژه"
              type="text"
              placeholder="جستجو در شماره، پیمانکار، پروژه..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <select aria-label="فیلتر: پروژه‌ها"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium cursor-pointer"
            >
              <option value="all">همه پروژه‌ها</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatText(p.name)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select aria-label="فیلتر: رشته‌های پیمانکاری"
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium cursor-pointer"
            >
              <option value="all">همه رشته‌های پیمانکاری</option>
              {tradeTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select aria-label="فیلتر: وضعیت‌ها"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium cursor-pointer"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="submitted">ثبت اولیه پیمانکار</option>
              <option value="site_review">در حال بررسی کارگاه</option>
              <option value="pm_approved">تأیید مدیر پروژه</option>
              <option value="management_approved">تأیید مدیریت (آماده پرداخت)</option>
              <option value="paid">پرداخت‌شده و ثبت هزینه</option>
              <option value="returned_for_revision">برگشت جهت اصلاح</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statements Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3">مشخصات صورت‌وضعیت</th>
                <th className="p-3">پیمانکار جزء و رشته</th>
                <th className="p-3">پروژه و قرارداد</th>
                <th className="p-3">دوره کارکرد</th>
                <th className="p-3 text-left">ناخالص اعلامی</th>
                <th className="p-3 text-left">تأیید کارگاه</th>
                <th className="p-3 text-left">خالص پرداختنی</th>
                <th className="p-3 text-left">پرداخت‌شده</th>
                <th className="p-3 text-center">وضعیت گردش کار</th>
                <th className="p-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStatements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    موردی با شرایط فیلتر انتخاب‌شده یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredStatements.map((stmt) => (
                  <tr key={stmt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-700" />
                        <span>{formatText(stmt.statementNumber)}</span>
                      </div>
                      <span className="text-xs text-slate-500 block font-normal mt-1">
                        ثبت: {formatText(stmt.submissionDate)}
                      </span>
                    </td>

                    <td className="p-3 font-medium text-slate-800">
                      <div>{formatText(stmt.subcontractorName)}</div>
                      <span className="inline-block mt-1 text-xs bg-amber-50 text-amber-800 px-2 py-1 rounded font-bold border border-amber-200/60">
                        {formatText(stmt.tradeType)}
                      </span>
                    </td>

                    <td className="p-3 text-slate-600">
                      <div className="font-bold text-slate-800 text-sm">{formatText(stmt.projectName)}</div>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {formatText(stmt.subcontractorContractNumber)}
                      </span>
                    </td>

                    <td className="p-3 text-slate-600 text-sm">
                      <div>از {formatText(stmt.periodStartDate)}</div>
                      <div>تا {formatText(stmt.periodEndDate)}</div>
                    </td>

                    <td className="p-3 text-left font-bold text-slate-800">
                      <Money rial={stmt.grossAmount} compact />
                    </td>

                    <td className="p-3 text-left font-bold text-blue-700">
                      <Money rial={stmt.siteVerifiedAmount} compact />
                      <span className="text-sm text-blue-700 block font-normal">
                        کسورات: {formatMoneyCompact(stmt.totalDeductions)}
                      </span>
                    </td>

                    <td className="p-3 text-left font-bold text-purple-700">
                      <Money rial={stmt.netPayable} compact />
                      {stmt.remainingPayable > 0 && (
                        <span className="text-sm text-rose-700 block font-bold">
                          مانده: {formatMoneyCompact(stmt.remainingPayable)}
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-left font-bold text-emerald-700">
                      <Money rial={stmt.paidAmount} compact />
                      {stmt.paymentMethod && (
                        <span className="text-xs text-slate-500 block font-normal">
                          {formatText(stmt.paymentMethod)}
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      {renderStatusBadge(stmt.status)}
                      {stmt.projectExpenseRecordId && (
                        <span className="block text-sm text-emerald-700 font-bold mt-1">
                          سند هزینه: {formatText(stmt.projectExpenseRecordId)}
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onSelectStatement(stmt)}
                          className="p-2 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 transition-all cursor-pointer"
                          title="مشاهده جزئیات و چرخه تاییدات"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {stmt.status === 'management_approved' && onPayStatement && (
                          <button
                            onClick={() => onPayStatement(stmt)}
                            className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="دستور پرداخت و ثبت سند هزینه پروژه"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>پرداخت</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
