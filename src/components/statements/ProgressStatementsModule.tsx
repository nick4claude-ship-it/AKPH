/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  Eye,
  Plus,
  Building2,
  HardHat,
  ShieldCheck,
  ChevronRight,
  Layers,
  X,
  TrendingUp,
} from 'lucide-react';
import { Project, ProgressStatement, SubcontractorProgressStatement } from '../../types';
import { mockProgressStatements } from '../../data/mockData';
import { mockSubcontractorStatements } from '../../data/subcontractorsMockData';
import { formatNumber, formatCurrencyCompact } from '../../utils/formatters';

interface ProgressStatementsModuleProps {
  projects: Project[];
  onOpenNewClientStatement?: () => void;
  onOpenNewSubcontractorStatement?: () => void;
}

export const ProgressStatementsModule: React.FC<ProgressStatementsModuleProps> = ({
  projects,
  onOpenNewClientStatement,
  onOpenNewSubcontractorStatement,
}) => {
  const [activeTab, setActiveTab] = useState<'client_statements' | 'subcontractor_statements'>('client_statements');

  const [clientStatements, setClientStatements] = useState<ProgressStatement[]>(mockProgressStatements);
  const [subcontractorStatements, setSubcontractorStatements] = useState<SubcontractorProgressStatement[]>(mockSubcontractorStatements);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedClientStatementForDetail, setSelectedClientStatementForDetail] = useState<ProgressStatement | null>(null);
  const [selectedSubStatementForDetail, setSelectedSubStatementForDetail] = useState<SubcontractorProgressStatement | null>(null);

  // Client statements filtered
  const filteredClientStatements = clientStatements.filter((st) => {
    if (selectedProjectId !== 'all' && st.projectId !== selectedProjectId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return st.number.toLowerCase().includes(q) || st.projectName.toLowerCase().includes(q) || (st.client || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Subcontractor statements filtered
  const filteredSubStatements = subcontractorStatements.filter((st) => {
    if (selectedProjectId !== 'all' && st.projectId !== selectedProjectId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return st.statementNumber.toLowerCase().includes(q) || st.subcontractorName.toLowerCase().includes(q) || st.projectName.toLowerCase().includes(q);
    }
    return true;
  });

  // Aggregates
  const totalClientApprovedReceivable = clientStatements.reduce((acc, st) => acc + st.approvedAmount, 0);
  const totalSubcontractorPayable = subcontractorStatements.reduce((acc, st) => acc + st.netPayable, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded font-mono">
              ماژول تخصصی صورت‌وضعیت‌ها (Progress Statements Engine)
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              تفکیک کامل: درآمد کارفرما (Inbound) • هزینه پیمانکار جزء (Outbound)
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            مدیریت متره، برآورد، تصویب نظارت، کسورات قانونی و ثبت مطالبات و بدهی‌ها
          </h2>
          <p className="text-xs text-slate-500">
            گردش کار استاندارد: پیشرفت کار ← متره احجام ← تایید نظارت/کارگاه ← کارفرما/مدیرعامل ← ایجاد مطالبه یا بدهی قطعی
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('client_statements')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'client_statements'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
            <span>صورت‌وضعیت کارفرما (درآمد / مطالبه)</span>
          </button>

          <button
            onClick={() => setActiveTab('subcontractor_statements')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'subcontractor_statements'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
            <span>صورت‌وضعیت پیمانکار جزء (هزینه / بدهی)</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">جمع صورت‌وضعیت‌های مصوب کارفرما (Revenue)</span>
            <div className="text-lg font-bold text-blue-700 font-mono">
              {formatNumber(totalClientApprovedReceivable)} تومان
            </div>
            <span className="text-[11px] text-slate-400 font-medium">پولی که شرکت باید از کارفرمایان وصول کند</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">جمع خالص صورت‌وضعیت‌های پیمانکاران جزء (Payable)</span>
            <div className="text-lg font-bold text-amber-700 font-mono">
              {formatNumber(totalSubcontractorPayable)} تومان
            </div>
            <span className="text-[11px] text-slate-400 font-medium">پولی که شرکت باید به پیمانکاران پرداخت نماید</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <HardHat className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
            <input
              type="text"
              placeholder={
                activeTab === 'client_statements'
                  ? 'جستجوی شماره صورت‌وضعیت، کارفرما، پروژه...'
                  : 'جستجوی پیمانکار، شماره کارکرد، پروژه...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
          >
            <option value="all">همه پروژه‌ها</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-400 font-mono text-[11px]">
          تعداد ردیف‌ها: {activeTab === 'client_statements' ? filteredClientStatements.length : filteredSubStatements.length}
        </span>
      </div>

      {/* Section 1: Client Statements Table */}
      {activeTab === 'client_statements' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>صورت‌وضعیت‌های کارکرد ارسالی به کارفرمایان (Client Statements)</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">گردش کار: متره ← مشاور ← کارفرما ← وصول</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">شماره و دوره</th>
                  <th className="py-3 px-3">پروژه و کارفرما</th>
                  <th className="py-3 px-3 text-left">مبلغ ارسالی پیمانکار</th>
                  <th className="py-3 px-3 text-left">مبلغ مصوب کارفرما</th>
                  <th className="py-3 px-3 text-left">دریافتی نقدی</th>
                  <th className="py-3 px-3 text-left font-bold text-rose-700">مانده مطالبه</th>
                  <th className="py-3 px-3">وضعیت تصویب</th>
                  <th className="py-3 px-3 text-center">مشاهده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredClientStatements.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-sans">
                      <strong className="block text-slate-900">{st.number}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">{st.submissionDate}</span>
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span className="text-slate-900 font-medium block">{st.projectName}</span>
                      <span className="text-[10px] text-slate-400">{st.client}</span>
                    </td>
                    <td className="py-3 px-3 text-left">{formatCurrencyCompact(st.submittedAmount)}</td>
                    <td className="py-3 px-3 text-left text-blue-700 font-bold">{formatCurrencyCompact(st.approvedAmount)}</td>
                    <td className="py-3 px-3 text-left text-emerald-700 font-bold">{formatCurrencyCompact(st.receivedAmount)}</td>
                    <td className="py-3 px-3 text-left text-rose-700 font-bold">{formatCurrencyCompact(st.receivables)}</td>
                    <td className="py-3 px-3 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          st.status === 'تسویه شده'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : st.status === 'تأیید نهایی کارفرما'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {st.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setSelectedClientStatementForDetail(st)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 2: Subcontractor Statements Table */}
      {activeTab === 'subcontractor_statements' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <HardHat className="w-4 h-4 text-amber-600" />
              <span>صورت‌وضعیت‌های کارکرد پیمانکاران جزء (Subcontractor Statements)</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">گردش کار: کارگاه ← مدیر پروژه ← مالی ← مدیرعامل ← پرداخت</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">شماره و تاریخ</th>
                  <th className="py-3 px-3">پیمانکار جزء و رسته</th>
                  <th className="py-3 px-3">پروژه</th>
                  <th className="py-3 px-3 text-left">مبلغ ناخالص کارکرد</th>
                  <th className="py-3 px-3 text-left">کسورات (حسن انجام کار و بیمه)</th>
                  <th className="py-3 px-3 text-left font-bold text-amber-700">خالص پرداختنی</th>
                  <th className="py-3 px-3 text-left">پرداخت شده</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3 text-center">مشاهده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredSubStatements.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-sans">
                      <strong className="block text-slate-900">{sub.statementNumber}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">{sub.submissionDate}</span>
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span className="text-slate-900 font-bold block">{sub.subcontractorName}</span>
                      <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded font-mono">{sub.tradeType}</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-700">{sub.projectName}</td>
                    <td className="py-3 px-3 text-left">{formatCurrencyCompact(sub.siteVerifiedAmount || sub.grossAmount)}</td>
                    <td className="py-3 px-3 text-left text-slate-500">
                      {formatCurrencyCompact(sub.deductions.retention + (sub.deductions.insuranceDeduction || 0))}
                    </td>
                    <td className="py-3 px-3 text-left text-amber-800 font-bold">{formatCurrencyCompact(sub.netPayable)}</td>
                    <td className="py-3 px-3 text-left text-emerald-700 font-bold">{formatCurrencyCompact(sub.paidAmount)}</td>
                    <td className="py-3 px-3 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          sub.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {sub.status === 'paid' ? 'پرداخت شده' : sub.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setSelectedSubStatementForDetail(sub)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Client Statement Detail */}
      {selectedClientStatementForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 text-right animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedClientStatementForDetail.number}</h3>
                <span className="text-xs text-slate-500">{selectedClientStatementForDetail.projectName}</span>
              </div>
              <button
                onClick={() => setSelectedClientStatementForDetail(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">کارفرما:</span>
                  <strong className="text-slate-900">{selectedClientStatementForDetail.client}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مبلغ پیشنهادی شرکت:</span>
                  <span className="font-mono">{formatNumber(selectedClientStatementForDetail.submittedAmount)} تومان</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مبلغ مصوب کارفرما:</span>
                  <strong className="font-mono text-blue-700">{formatNumber(selectedClientStatementForDetail.approvedAmount)} تومان</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">دریافت نقدینگی تا کنون:</span>
                  <span className="font-mono text-emerald-700">{formatNumber(selectedClientStatementForDetail.receivedAmount)} تومان</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">مانده مطالبه دریافتنی:</span>
                  <strong className="font-mono text-rose-700 font-bold text-sm">
                    {formatNumber(selectedClientStatementForDetail.receivables)} تومان
                  </strong>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ فرم مالی صورت‌وضعیت</span>
              </button>
              <button
                onClick={() => setSelectedClientStatementForDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Subcontractor Statement Detail */}
      {selectedSubStatementForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 text-right animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedSubStatementForDetail.statementNumber}</h3>
                <span className="text-xs text-slate-500">{selectedSubStatementForDetail.subcontractorName} ({selectedSubStatementForDetail.tradeType})</span>
              </div>
              <button
                onClick={() => setSelectedSubStatementForDetail(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">پروژه:</span>
                  <strong className="text-slate-900">{selectedSubStatementForDetail.projectName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ناخالص کارکرد مصوب:</span>
                  <span className="font-mono">{formatNumber(selectedSubStatementForDetail.siteVerifiedAmount || selectedSubStatementForDetail.grossAmount)} تومان</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">کسر سپرده حسن انجام کار (۱۰٪):</span>
                  <span className="font-mono text-slate-600">{formatNumber(selectedSubStatementForDetail.deductions.retention)} تومان</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">کسر بیمه تأمین اجتماعی (۵٪):</span>
                  <span className="font-mono text-slate-600">{formatNumber(selectedSubStatementForDetail.deductions.insuranceDeduction || 0)} تومان</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">خالص بدهی پرداختنی به پیمانکار:</span>
                  <strong className="font-mono text-amber-800 font-bold text-sm">
                    {formatNumber(selectedSubStatementForDetail.netPayable)} تومان
                  </strong>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ تاییدیه مالی</span>
              </button>
              <button
                onClick={() => setSelectedSubStatementForDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
