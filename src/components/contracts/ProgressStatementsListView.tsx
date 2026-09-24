/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { DetailedProgressStatement, StatementWorkflowStatus, UserProfile } from '../../types';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  ChevronLeft,
} from 'lucide-react';

interface ProgressStatementsListViewProps {
  statements: DetailedProgressStatement[];
  currentUser: UserProfile;
  onSelectStatement: (statement: DetailedProgressStatement) => void;
  onOpenNewStatement: () => void;
}

export const ProgressStatementsListView: React.FC<ProgressStatementsListViewProps> = ({
  statements,
  currentUser,
  onSelectStatement,
  onOpenNewStatement,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredStatements = useMemo(() => {
    return statements.filter((s) => {
      const matchSearch =
        s.statementNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.contractCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.client.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchType = typeFilter === 'all' || s.type === typeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [statements, searchTerm, statusFilter, typeFilter]);

  // Aggregate metrics
  const totalGross = filteredStatements.reduce((sum, s) => sum + s.grossAmount, 0);
  const totalDeductions = filteredStatements.reduce((sum, s) => sum + s.totalDeductions, 0);
  const totalNet = filteredStatements.reduce((sum, s) => sum + s.netPayable, 0);
  const totalReceived = filteredStatements.reduce((sum, s) => sum + s.receivedAmount, 0);
  const totalRemaining = filteredStatements.reduce((sum, s) => sum + s.remainingPayable, 0);

  const statusMeta: Record<string, { label: string; color: string }> = {
    draft: { label: 'پیش‌نویس کارگاه', color: 'bg-slate-100 text-slate-800' },
    prepared: { label: 'تهیه شده', color: 'bg-blue-100 text-blue-800' },
    internal_review: { label: 'بررسی دفتر فنی', color: 'bg-indigo-100 text-indigo-800' },
    submitted_to_consultant: { label: 'ارسال به مشاور', color: 'bg-amber-100 text-amber-800' },
    under_consultant_review: { label: 'بررسی مشاور', color: 'bg-amber-100 text-amber-900' },
    approved_by_consultant: { label: 'تأیید مشاور', color: 'bg-teal-100 text-teal-800' },
    submitted_to_employer: { label: 'ارسال به کارفرما', color: 'bg-blue-100 text-blue-900' },
    approved_by_employer: { label: 'تأیید کارفرما', color: 'bg-emerald-100 text-emerald-800' },
    claimed: { label: 'اعلام بدهی و مطالبه', color: 'bg-purple-100 text-purple-800' },
    partially_paid: { label: 'پرداخت بخشی از وجه', color: 'bg-cyan-100 text-cyan-800' },
    paid: { label: 'تسویه کامل', color: 'bg-emerald-200 text-emerald-950 font-bold' },
    rejected: { label: 'رد شده', color: 'bg-rose-100 text-rose-800' },
    returned_for_correction: { label: 'بازگشت جهت اصلاح', color: 'bg-orange-100 text-orange-900' },
  };

  return (
    <div className="space-y-4">
      {/* Top Banner and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            دفتر ثبت و مدیریت صورت‌وضعیت‌های کارکرد و تعدیل (Statements Directory)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            گردش کار کارگاه، بررسی مشاور، تصویب کارفرما، استرداد کسورات و ثبت اسناد دریافتنی در حسابداری
          </p>
        </div>

        <button
          onClick={onOpenNewStatement}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>صورت‌وضعیت جدید</span>
        </button>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
        <div>
          <span className="text-slate-500 block text-[11px]">مجموع ناخالص کارکرد:</span>
          <span className="font-black text-slate-900 font-mono text-sm">
            {(totalGross / 1_000_000_000).toFixed(2)} م.ت
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">مجموع کسورات قانونی:</span>
          <span className="font-bold text-rose-700 font-mono text-sm">
            {(totalDeductions / 1_000_000_000).toFixed(2)} م.ت
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">خالص مصوب قابل پرداخت:</span>
          <span className="font-black text-indigo-900 font-mono text-sm">
            {(totalNet / 1_000_000_000).toFixed(2)} م.ت
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">کل دریافتی نقد و اسناد:</span>
          <span className="font-bold text-emerald-700 font-mono text-sm">
            {(totalReceived / 1_000_000_000).toFixed(2)} م.ت
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">مانده مطالبات وصول‌نشده:</span>
          <span className="font-black text-rose-600 font-mono text-sm">
            {(totalRemaining / 1_000_000_000).toFixed(2)} م.ت
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="جستجو در شماره صورت‌وضعیت، پیمان، پروژه یا کارفرما..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:outline-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 bg-white"
          >
            <option value="all">همه مراحل گردش کار</option>
            <option value="draft">پیش‌نویس کارگاه</option>
            <option value="submitted_to_consultant">ارسال به مشاور</option>
            <option value="under_consultant_review">در حال بررسی مشاور</option>
            <option value="approved_by_consultant">تأیید مشاور</option>
            <option value="approved_by_employer">تأیید کارفرما</option>
            <option value="claimed">اعلام بدهی و مطالبه</option>
            <option value="paid">تسویه شده</option>
            <option value="returned_for_correction">بازگشت جهت اصلاح</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 bg-white"
          >
            <option value="all">همه انواع صورت‌وضعیت</option>
            <option value="موقت">موقت</option>
            <option value="قطعی">قطعی</option>
            <option value="علی‌الحساب">علی‌الحساب</option>
            <option value="تعدیل">تعدیل آحادبها</option>
          </select>
        </div>
      </div>

      {/* Statements Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3">شماره سند</th>
              <th className="p-3">پیمان و پروژه</th>
              <th className="p-3">دوره کارکرد</th>
              <th className="p-3">نوع</th>
              <th className="p-3 text-left">مبلغ ناخالص</th>
              <th className="p-3 text-left">کسورات</th>
              <th className="p-3 text-left">خالص قابل پرداخت</th>
              <th className="p-3 text-left">دریافتی</th>
              <th className="p-3 text-left">مانده طلب</th>
              <th className="p-3 text-center">مرحله گردش کار</th>
              <th className="p-3 text-center">وضعیت تسویه</th>
              <th className="p-3 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStatements.map((stm) => {
              const meta = statusMeta[stm.status] || { label: stm.status, color: 'bg-slate-100' };
              return (
                <tr
                  key={stm.id}
                  onClick={() => onSelectStatement(stm)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <td className="p-3 font-bold text-slate-900">{stm.statementNumber}</td>
                  <td className="p-3 max-w-xs">
                    <span className="font-bold text-slate-800 block truncate">{stm.projectName}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {stm.contractCode} · {stm.client}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 font-mono text-[11px]">
                    {stm.periodStartDate} تا {stm.periodEndDate}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                      {stm.type}
                    </span>
                  </td>
                  <td className="p-3 text-left font-mono font-bold text-slate-800">
                    {stm.grossAmount.toLocaleString('fa-IR')}
                  </td>
                  <td className="p-3 text-left font-mono text-rose-700">
                    {stm.totalDeductions.toLocaleString('fa-IR')}
                  </td>
                  <td className="p-3 text-left font-mono font-bold text-indigo-900">
                    {stm.netPayable.toLocaleString('fa-IR')}
                  </td>
                  <td className="p-3 text-left font-mono font-bold text-emerald-700">
                    {stm.receivedAmount.toLocaleString('fa-IR')}
                  </td>
                  <td className="p-3 text-left font-mono font-bold text-rose-600">
                    {stm.remainingPayable.toLocaleString('fa-IR')}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${meta.color}`}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        stm.paymentStatus === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : stm.paymentStatus === 'Overdue'
                          ? 'bg-rose-100 text-rose-800 font-black'
                          : stm.paymentStatus === 'Partially Paid'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {stm.paymentStatus === 'Paid'
                        ? 'تسویه شده'
                        : stm.paymentStatus === 'Overdue'
                        ? `معوق (${stm.overdueDays} روز)`
                        : stm.paymentStatus === 'Partially Paid'
                        ? 'پرداخت ناقص'
                        : 'پرداخت‌نشده'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStatement(stm);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
                    >
                      مشاهده و چاپ
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
