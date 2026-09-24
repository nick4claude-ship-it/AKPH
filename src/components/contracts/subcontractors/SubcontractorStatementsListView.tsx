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
  const totalGross = filteredStatements.reduce((sum, s) => sum + s.grossAmount, 0);
  const totalSiteVerified = filteredStatements.reduce((sum, s) => sum + s.siteVerifiedAmount, 0);
  const totalDeductions = filteredStatements.reduce((sum, s) => sum + s.totalDeductions, 0);
  const totalNet = filteredStatements.reduce((sum, s) => sum + s.netPayable, 0);
  const totalPaid = filteredStatements.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalRemaining = filteredStatements.reduce((sum, s) => sum + s.remainingPayable, 0);

  // Status badge helper
  const renderStatusBadge = (status: SubcontractorStatementWorkflowStatus) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <Clock className="w-3 h-3 text-slate-600" />
            ثبت اولیه پیمانکار
          </span>
        );
      case 'site_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-700" />
            در حال بررسی کارگاه
          </span>
        );
      case 'pm_approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
            <CheckSquare className="w-3 h-3 text-indigo-700" />
            تأیید مدیر پروژه
          </span>
        );
      case 'management_approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
            <ShieldCheck className="w-3 h-3 text-purple-700" />
            تأیید مدیریت (آماده پرداخت)
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            پرداخت‌شده و ثبت هزینه
          </span>
        );
      case 'returned_for_revision':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-900 border border-orange-300">
            <AlertTriangle className="w-3 h-3 text-orange-700" />
            برگشت جهت اصلاح
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900">صورت‌وضعیت‌های پیمانکاران جزء</h3>
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {filteredStatements.length} دوره
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            کارکرد اعلامی پیمانکاران، کنترل متره کارگاهی، چرخه تاییدات ۶ مرحله‌ای و دستور پرداخت با ثبت اتوماتیک هزینه پروژه
          </p>
        </div>

        <button
          onClick={onOpenNewStatement}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت صورت‌وضعیت جدید پیمانکار جزء</span>
        </button>
      </div>

      {/* Financial Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">ناخالص کارکرد اعلامی</span>
          <span className="text-base font-black text-slate-900">
            {(totalGross / 1_000_000).toLocaleString('fa-IR')}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">میلیون تومان</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">تأییدشده متره کارگاه</span>
          <span className="text-base font-black text-blue-700">
            {(totalSiteVerified / 1_000_000).toLocaleString('fa-IR')}
          </span>
          <span className="text-[10px] text-blue-600 block mt-0.5">
            {totalGross > 0 ? Number(((totalSiteVerified / totalGross) * 100).toFixed(1)).toLocaleString('fa-IR') : '۰'}٪ پذیرش
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">کسورات (سپرده/پیش‌پرداخت)</span>
          <span className="text-base font-black text-amber-700">
            {(totalDeductions / 1_000_000).toLocaleString('fa-IR')}
          </span>
          <span className="text-[10px] text-amber-600 block mt-0.5">میلیون تومان</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">خالص مصوب قابل پرداخت</span>
          <span className="text-base font-black text-purple-700">
            {(totalNet / 1_000_000).toLocaleString('fa-IR')}
          </span>
          <span className="text-[10px] text-purple-600 block mt-0.5">میلیون تومان</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">مبالغ پرداخت‌شده قطعی</span>
          <span className="text-base font-black text-emerald-700">
            {(totalPaid / 1_000_000).toLocaleString('fa-IR')}
          </span>
          <span className="text-[10px] text-emerald-600 block mt-0.5 font-bold">
            {totalNet > 0 ? Number(((totalPaid / totalNet) * 100).toFixed(1)).toLocaleString('fa-IR') : '۰'}٪ تسویه
          </span>
        </div>

        <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-[11px] text-rose-800 font-bold block mb-1">مانده بدهی پرداختنی</span>
          <span className="text-base font-black text-rose-700">
            {(totalRemaining / 1_000_000).toLocaleString('fa-IR')}
          </span>
          <span className="text-[10px] text-rose-600 block mt-0.5 font-bold">تعهد فوری AKPH</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو در شماره، پیمانکار، پروژه..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
            >
              <option value="all">همه پروژه‌ها</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
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
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3.5">مشخصات صورت‌وضعیت</th>
                <th className="p-3.5">پیمانکار جزء و رشته</th>
                <th className="p-3.5">پروژه و قرارداد</th>
                <th className="p-3.5">دوره کارکرد</th>
                <th className="p-3.5 text-left">ناخالص اعلامی</th>
                <th className="p-3.5 text-left">تأیید کارگاه</th>
                <th className="p-3.5 text-left">خالص پرداختنی</th>
                <th className="p-3.5 text-left">پرداخت‌شده</th>
                <th className="p-3.5 text-center">وضعیت گردش کار</th>
                <th className="p-3.5 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStatements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    موردی با شرایط فیلتر انتخاب‌شده یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredStatements.map((stmt) => (
                  <tr key={stmt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-600" />
                        <span>{stmt.statementNumber}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block font-normal mt-0.5">
                        ثبت: {stmt.submissionDate}
                      </span>
                    </td>

                    <td className="p-3.5 font-medium text-slate-800">
                      <div>{stmt.subcontractorName}</div>
                      <span className="inline-block mt-0.5 text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200/60">
                        {stmt.tradeType}
                      </span>
                    </td>

                    <td className="p-3.5 text-slate-600">
                      <div className="font-bold text-slate-800 text-[11px]">{stmt.projectName}</div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {stmt.subcontractorContractNumber}
                      </span>
                    </td>

                    <td className="p-3.5 text-slate-600 text-[11px]">
                      <div>از {stmt.periodStartDate}</div>
                      <div>تا {stmt.periodEndDate}</div>
                    </td>

                    <td className="p-3.5 text-left font-black text-slate-800">
                      {(stmt.grossAmount / 1_000_000).toLocaleString('fa-IR')}
                      <span className="text-[9px] text-slate-400 block font-normal">تومان</span>
                    </td>

                    <td className="p-3.5 text-left font-bold text-blue-700">
                      {(stmt.siteVerifiedAmount / 1_000_000).toLocaleString('fa-IR')}
                      <span className="text-[9px] text-blue-500 block font-normal">
                        کسورات: {(stmt.totalDeductions / 1_000_000).toLocaleString('fa-IR')}
                      </span>
                    </td>

                    <td className="p-3.5 text-left font-black text-purple-700">
                      {(stmt.netPayable / 1_000_000).toLocaleString('fa-IR')}
                      {stmt.remainingPayable > 0 && (
                        <span className="text-[9px] text-rose-600 block font-bold">
                          مانده: {(stmt.remainingPayable / 1_000_000).toLocaleString('fa-IR')}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-left font-bold text-emerald-700">
                      {(stmt.paidAmount / 1_000_000).toLocaleString('fa-IR')}
                      {stmt.paymentMethod && (
                        <span className="text-[9px] text-slate-400 block font-normal">
                          {stmt.paymentMethod}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-center">
                      {renderStatusBadge(stmt.status)}
                      {stmt.projectExpenseRecordId && (
                        <span className="block text-[9px] text-emerald-700 font-bold mt-1">
                          سند هزینه: {stmt.projectExpenseRecordId}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSelectStatement(stmt)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 transition-all cursor-pointer"
                          title="مشاهده جزئیات و چرخه تاییدات"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {stmt.status === 'management_approved' && onPayStatement && (
                          <button
                            onClick={() => onPayStatement(stmt)}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
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
