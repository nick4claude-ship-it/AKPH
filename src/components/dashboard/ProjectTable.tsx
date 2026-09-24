import React, { useState } from 'react';
import { Project } from '../../types';
import { formatNumber, formatCurrencyCompact, formatPercent } from '../../utils/formatters';
import { ArrowUpRight, Search, Building2, ChevronLeft } from 'lucide-react';

interface ProjectTableProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
}

export const ProjectTable: React.FC<ProjectTableProps> = ({ projects, onSelectProject }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.includes(searchTerm) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'در حال اجرا':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            در حال اجرا
          </span>
        );
      case 'تحویل موقت':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            تحویل موقت
          </span>
        );
      case 'تجهیز کارگاه':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            تجهیز کارگاه
          </span>
        );
      case 'تعلیق':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            تعلیق
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">وضعیت مالی پروژه‌ها</h3>
            <p className="text-[11px] text-slate-500">
              نمای تحلیلی سودآوری، کارکرد، مطالبات و پیشرفت پروژه‌ها (کلیک روی ردیف برای داشبورد پروژه)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="جستجوی پروژه..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-200 text-xs rounded-lg pr-8 pl-3 py-1.5 w-44 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-amber-500"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="در حال اجرا">در حال اجرا</option>
            <option value="تحویل موقت">تحویل موقت</option>
            <option value="تجهیز کارگاه">تجهیز کارگاه</option>
            <option value="تعلیق">تعلیق</option>
          </select>
        </div>
      </div>

      {/* Main Modern Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold select-none">
              <th className="py-3 px-3.5">کد</th>
              <th className="py-3 px-3.5">نام پروژه و کارفرما</th>
              <th className="py-3 px-3.5 text-left">مبلغ قرارداد</th>
              <th className="py-3 px-3.5 text-left">درآمد (کارکرد)</th>
              <th className="py-3 px-3.5 text-left">هزینه کل</th>
              <th className="py-3 px-3.5 text-left">سود خالص</th>
              <th className="py-3 px-3 text-center">حاشیه سود</th>
              <th className="py-3 px-3 text-center min-w-28">پیشرفت فیزیکی / مالی</th>
              <th className="py-3 px-3.5 text-left">مطالبات</th>
              <th className="py-3 px-3 text-center">وضعیت</th>
              <th className="py-3 px-2 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-400 text-xs">
                  هیچ پروژه‌ای مطابق فیلترهای انتخابی یافت نشد.
                </td>
              </tr>
            ) : (
              filteredProjects.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => onSelectProject(project)}
                  className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                >
                  {/* Code */}
                  <td className="py-3 px-3.5 font-mono font-semibold text-slate-700 whitespace-nowrap">
                    {project.code}
                  </td>

                  {/* Name and Client */}
                  <td className="py-3 px-3.5">
                    <div className="font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                      {project.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-48">
                      {project.client}
                    </div>
                  </td>

                  {/* Contract Amount */}
                  <td className="py-3 px-3.5 font-mono tabular-nums text-left text-slate-800 font-medium">
                    {formatCurrencyCompact(project.contractAmount)}
                  </td>

                  {/* Recorded Revenue */}
                  <td className="py-3 px-3.5 font-mono tabular-nums text-left text-emerald-700 font-bold">
                    {formatCurrencyCompact(project.recordedRevenue)}
                  </td>

                  {/* Cost */}
                  <td className="py-3 px-3.5 font-mono tabular-nums text-left text-slate-700">
                    {formatCurrencyCompact(project.cost)}
                  </td>

                  {/* Profit */}
                  <td className="py-3 px-3.5 font-mono tabular-nums text-left font-bold text-amber-600">
                    {formatCurrencyCompact(project.profit)}
                  </td>

                  {/* Profit Margin */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                        project.profitMargin >= 18
                          ? 'bg-emerald-50 text-emerald-700'
                          : project.profitMargin >= 12
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {formatPercent(project.profitMargin)}
                    </span>
                  </td>

                  {/* Physical & Financial Progress */}
                  <td className="py-3 px-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>فیزیکی: {project.physicalProgress}٪</span>
                        <span>مالی: {project.financialProgress}٪</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${project.physicalProgress}%` }}
                          title={`پیشرفت فیزیکی: ${project.physicalProgress}٪`}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Receivables */}
                  <td className="py-3 px-3.5 font-mono tabular-nums text-left text-rose-600 font-semibold">
                    {formatCurrencyCompact(project.receivables)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {getStatusBadge(project.status)}
                  </td>

                  {/* Action Link */}
                  <td className="py-3 px-2 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 group-hover:text-amber-600 group-hover:bg-amber-100/50 transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Totals */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600">
        <div>
          مجموع پروژه‌های نمایش داده شده: <span className="font-bold text-slate-900">{filteredProjects.length}</span> مورد
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span>
            مجموع کارکرد: <strong className="text-emerald-700">{formatCurrencyCompact(projects.reduce((a, b) => a + b.recordedRevenue, 0))}</strong>
          </span>
          <span>·</span>
          <span>
            مجموع مطالبات: <strong className="text-rose-600">{formatCurrencyCompact(projects.reduce((a, b) => a + b.receivables, 0))}</strong>
          </span>
        </div>
      </div>
    </section>
  );
};
