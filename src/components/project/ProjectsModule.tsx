/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  Layers,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  CreditCard,
  HardHat,
  Truck,
  Wallet,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Clock,
  ChevronRight,
  DollarSign,
  PieChart,
  Users,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { Project, PettyCash, ProgressStatement } from '../../types';
import { formatNumber, formatCurrencyCompact } from '../../utils/formatters';
import { useAppState } from '../../store/AppStore';
import { selectPettyCashSummaries } from '../../store/selectors';

interface ProjectsModuleProps {
  projects: Project[];
  onSelectProject?: (projectId: string) => void;
  onNavigateToTab?: (tab: any) => void;
}

export const ProjectsModule: React.FC<ProjectsModuleProps> = ({
  projects,
  onSelectProject,
  onNavigateToTab,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeProjectSubTab, setActiveProjectSubTab] = useState<'overview' | 'contract' | 'cost_centers' | 'subcontracts' | 'petty_cash' | 'statements'>('overview');

  const appState = useAppState();
  const activeProject = projects.find((p) => p.id === selectedProjectId);

  const filteredProjects = projects.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.client.toLowerCase().includes(q);
    }
    return true;
  });

  // Project linked subcontracts
  const projectSubcontracts = appState.subcontractorContracts.filter(
    (s) => s.projectId === selectedProjectId
  );

  // Project linked petty cash accounts
  const projectPettyCash = selectPettyCashSummaries(appState).filter(
    (pc) => pc.projectId === selectedProjectId
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded font-mono">
              هسته مدیریت پروژه‌ها (Project Management Hub)
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              Company → Project → Cost Center → Activity
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            مرکز اتصال یکپارچه قراردادها، بودجه، پیمانکاران، انبار، تنخواه و صورت‌وضعیت‌ها
          </h2>
          <p className="text-xs text-slate-500">
            بررسی جامع عملکرد مالی، پیشرفت فیزیکی، مطالبات کارفرما و بدهی‌های اجرایی به تفکیک کارگاه
          </p>
        </div>

        {selectedProjectId && (
          <button
            onClick={() => setSelectedProjectId(null)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition-colors cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>بازگشت به لیست پروژه‌ها</span>
          </button>
        )}
      </div>

      {!selectedProjectId ? (
        /* Project Cards Grid */
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="جستجوی نام پروژه، کد یا کارفرما..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="در حال اجرا">در حال اجرا</option>
                <option value="تحویل موقت">تحویل موقت</option>
                <option value="پایان یافته">پایان یافته</option>
              </select>
            </div>

            <span className="text-slate-400 font-mono text-[11px]">
              تعداد پروژه‌ها: {filteredProjects.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Image / Header Banner */}
                  <div className="relative h-36 bg-slate-800 overflow-hidden">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover opacity-80"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-600">
                        <Building2 className="w-10 h-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                    <div className="absolute bottom-3 right-3 left-3 flex items-end justify-between">
                      <div>
                        <span className="text-[10px] font-mono bg-amber-500/90 text-slate-950 px-2 py-0.5 rounded font-bold">
                          {p.code}
                        </span>
                        <h3 className="text-white font-bold text-sm mt-1 leading-snug">{p.name}</h3>
                      </div>
                      <span className="text-[10px] bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded">
                        {p.status}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span className="text-slate-400">کارفرما:</span>
                      <strong className="text-slate-800 text-right truncate max-w-[180px]">{p.client}</strong>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span className="text-slate-400">مدیر پروژه:</span>
                      <span className="text-slate-700">{p.manager}</span>
                    </div>

                    {/* Progress Bars */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">پیشرفت فیزیکی:</span>
                        <span className="font-mono font-bold text-blue-700">{p.physicalProgress}٪</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${p.physicalProgress}%` }} />
                      </div>

                      <div className="flex justify-between text-[11px] pt-1">
                        <span className="text-slate-500">پیشرفت مالی:</span>
                        <span className="font-mono font-bold text-emerald-700">{p.financialProgress}٪</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${p.financialProgress}%` }} />
                      </div>
                    </div>

                    {/* Financial Snapshot */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 font-mono">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-sans block">مبلغ پیمان:</span>
                        <strong className="text-slate-900">{formatCurrencyCompact(p.contractAmount)}</strong>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-sans block">کارکرد مصوب:</span>
                        <strong className="text-blue-700">{formatCurrencyCompact(p.recordedRevenue)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 pt-0">
                  <button
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      if (onSelectProject) onSelectProject(p.id);
                    }}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>مشاهده پرونده کامل پروژه</span>
                    <ChevronRight className="w-3.5 h-3.5 rotate-180 text-amber-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Detailed Single Project Dossier Hub */
        activeProject && (
          <div className="space-y-6">
            {/* Dossier Header */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded">
                      {activeProject.code}
                    </span>
                    <span className="text-xs bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded">
                      {activeProject.status}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {activeProject.startDate} الی {activeProject.expectedEndDate}
                    </span>
                  </div>
                  <h1 className="text-lg font-bold text-slate-900">{activeProject.name}</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    کارفرما: <strong className="text-slate-700">{activeProject.client}</strong> • مدیر پروژه:{' '}
                    <strong className="text-slate-700">{activeProject.manager}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-left font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-sans block">سود ناخالص پروژه:</span>
                    <strong className="text-base font-bold text-emerald-700">
                      {formatNumber(activeProject.profit)} تومان
                    </strong>
                    <span className="text-[11px] text-slate-500 font-sans block">
                      حاشیه سود: {activeProject.profitMargin}٪
                    </span>
                  </div>
                </div>
              </div>

              {/* Dossier Sub-tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-5 mt-5 border-t border-slate-100 scrollbar-none">
                <button
                  onClick={() => setActiveProjectSubTab('overview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeProjectSubTab === 'overview'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  شناسنامه و نفرات کلیدی
                </button>
                <button
                  onClick={() => setActiveProjectSubTab('contract')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeProjectSubTab === 'contract'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  قرارداد اصلی کارفرما
                </button>
                <button
                  onClick={() => setActiveProjectSubTab('subcontracts')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeProjectSubTab === 'subcontracts'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  پیمانکاران جزء ({projectSubcontracts.length})
                </button>
                <button
                  onClick={() => setActiveProjectSubTab('petty_cash')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeProjectSubTab === 'petty_cash'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  تنخواه‌های کارگاه ({projectPettyCash.length})
                </button>
              </div>
            </div>

            {/* Sub-view Content */}
            {activeProjectSubTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3 text-xs">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>ارکان اجرایی و مدیریتی</span>
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400">کارفرما:</span>
                      <strong className="text-slate-900">{activeProject.client}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400">دستگاه نظارت (مشاور):</span>
                      <span className="text-slate-800">مهندسین مشاور سازه پایدار</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400">مدیر پروژه:</span>
                      <span className="text-slate-800">{activeProject.manager}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400">سرپرست کارگاه:</span>
                      <span className="text-slate-800">مهندس وحید اکبری</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3 text-xs">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <span>شاخص‌های مالی کلیدی</span>
                  </h3>
                  <div className="space-y-2 font-mono">
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400 font-sans">بودجه مصوب:</span>
                      <strong className="text-slate-900">{formatCurrencyCompact(activeProject.budget)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400 font-sans">هزینه قطعی (Actual Cost):</span>
                      <strong className="text-slate-800">{formatCurrencyCompact(activeProject.actualCost)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400 font-sans">مطالبات از کارفرما:</span>
                      <strong className="text-rose-700">{formatCurrencyCompact(activeProject.receivables)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400 font-sans">بدهی به پیمانکاران/وندورها:</span>
                      <strong className="text-amber-700">{formatCurrencyCompact(activeProject.liabilities)}</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3 text-xs">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-purple-600" />
                    <span>تفکیک هزینه‌های پروژه</span>
                  </h3>
                  <div className="space-y-2 font-mono">
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400 font-sans">مصالح و آهن‌آلات:</span>
                      <span>{formatCurrencyCompact(activeProject.expenseBreakdown?.materials || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400 font-sans">پیمانکاران دستمزدی:</span>
                      <span>{formatCurrencyCompact(activeProject.expenseBreakdown?.subcontractors || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400 font-sans">دستمزد مستقیم پرسنل:</span>
                      <span>{formatCurrencyCompact(activeProject.expenseBreakdown?.labor || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400 font-sans">ماشین‌آلات و ترابری:</span>
                      <span>{formatCurrencyCompact(activeProject.expenseBreakdown?.machinery || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeProjectSubTab === 'subcontracts' && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-800">
                    پیمانکاران جزء فعال در این کارگاه (Outbound Subcontracts)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">شماره قرارداد</th>
                        <th className="py-2.5 px-3">پیمانکار</th>
                        <th className="py-2.5 px-3">رسته تخصصی</th>
                        <th className="py-2.5 px-3 text-left">مبلغ پیمان</th>
                        <th className="py-2.5 px-3 text-left">کارکرد مصوب</th>
                        <th className="py-2.5 px-3 text-left">پرداختی تا کنون</th>
                        <th className="py-2.5 px-3 text-left">مانده بدهی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {projectSubcontracts.map((sc) => (
                        <tr key={sc.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{sc.contractNumber}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-800">{sc.subcontractorName}</td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                              {sc.tradeType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-left">{formatCurrencyCompact(sc.contractValue)}</td>
                          <td className="py-2.5 px-3 text-left text-blue-700">{formatCurrencyCompact(sc.approvedStatementsValue)}</td>
                          <td className="py-2.5 px-3 text-left text-emerald-700">{formatCurrencyCompact(sc.paidValue)}</td>
                          <td className="py-2.5 px-3 text-left text-amber-700 font-bold">{formatCurrencyCompact(sc.remainingPayableValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeProjectSubTab === 'petty_cash' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectPettyCash.map((pc) => (
                  <div key={pc.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900 text-sm">تنخواه {pc.holderName}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded">
                        {pc.code}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600 mb-4 font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">مسئول تنخواه:</span>
                        <span className="font-sans font-medium text-slate-900">{pc.holderName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">سقف تنخواه:</span>
                        <span>{formatNumber(pc.ceilingLimit)} تومان</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">مانده موجودی نقد:</span>
                        <strong className="text-emerald-700 font-bold">{formatNumber(pc.actualBalance)} تومان</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};
