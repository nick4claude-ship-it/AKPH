/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SubcontractorContract, Project } from '../../../types';
import {
  Layers,
  Search,
  Filter,
  Building,
  Hammer,
  Eye,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Download,
} from 'lucide-react';
import { formatMoneyCompact } from '../../../utils/money';

interface SubcontractorMatrixViewProps {
  contracts: SubcontractorContract[];
  projects: Project[];
  onSelectContract: (contract: SubcontractorContract) => void;
  onOpenNewStatement: (contract: SubcontractorContract) => void;
}

export const SubcontractorMatrixView: React.FC<SubcontractorMatrixViewProps> = ({
  contracts,
  projects,
  onSelectContract,
  onOpenNewStatement,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const tradeTypes = useMemo(() => {
    const set = new Set<string>();
    contracts.forEach((c) => set.add(c.tradeType));
    return Array.from(set);
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      const matchSearch =
        c.subcontractorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.tradeType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchProject = selectedProjectId === 'all' || c.projectId === selectedProjectId;
      const matchTrade = selectedTrade === 'all' || c.tradeType === selectedTrade;

      return matchSearch && matchProject && matchTrade;
    });
  }, [contracts, searchTerm, selectedProjectId, selectedTrade]);

  // Group by project
  const groupedByProject = useMemo(() => {
    const groups: { [projectId: string]: { projectId: string; projectName: string; contracts: SubcontractorContract[] } } = {};

    filteredContracts.forEach((c) => {
      if (!groups[c.projectId]) {
        groups[c.projectId] = { projectId: c.projectId, projectName: c.projectName, contracts: [] };
      }
      groups[c.projectId].contracts.push(c);
    });

    return Object.values(groups);
  }, [filteredContracts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              ماتریس جامع مالی: تفکیک بر اساس پروژه و پیمانکار جزء
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              ردیابی مستقیم: پروژه ← پیمانکار ← قرارداد ← کارکرد ← صورت‌وضعیت تأییدشده ← پرداخت‌شده ← مانده بدهی
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              {filteredContracts.length} پیمانکار در ماتریس
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو در پیمانکار یا رشته..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
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
              value={selectedTrade}
              onChange={(e) => setSelectedTrade(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
            >
              <option value="all">همه رشته‌های کاری</option>
              {tradeTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Project Grouped Cards */}
      <div className="space-y-6">
        {groupedByProject.map(({ projectId, projectName, contracts: projectContracts }) => {
          const prjContractTotal = projectContracts.reduce((s, c) => s + c.contractValue, 0);
          const prjExecutedTotal = projectContracts.reduce((s, c) => s + c.executedValue, 0);
          const prjApprovedTotal = projectContracts.reduce((s, c) => s + c.approvedStatementsValue, 0);
          const prjPaidTotal = projectContracts.reduce((s, c) => s + c.paidValue, 0);
          const prjDebtTotal = projectContracts.reduce((s, c) => s + c.remainingPayableValue, 0);

          return (
            <div
              key={projectId}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
            >
              {/* Project Header Bar */}
              <div className="bg-slate-900 text-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{projectName}</h4>
                    <span className="text-[11px] text-slate-300">
                      تعداد پیمانکاران جزء: {projectContracts.length.toLocaleString('fa-IR')} اکیپ
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">کل تعهدات پروژه:</span>
                    <strong className="text-amber-400">
                      {formatMoneyCompact(prjContractTotal)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">کارکرد متره:</span>
                    <strong className="text-blue-400">
                      {formatMoneyCompact(prjExecutedTotal)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">پرداخت‌شده:</span>
                    <strong className="text-emerald-400">
                      {formatMoneyCompact(prjPaidTotal)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">مانده بدهی تاییدشده:</span>
                    <strong className="text-rose-400 font-black">
                      {formatMoneyCompact(prjDebtTotal)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Table of Subcontractors for this Project */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                      <th className="p-3">رشته و پیمانکار جزء</th>
                      <th className="p-3 text-left">قرارداد (۱)</th>
                      <th className="p-3 text-left">کارکرد متره (۲)</th>
                      <th className="p-3 text-left">تأییدشده (۳)</th>
                      <th className="p-3 text-left">پرداخت‌شده (۴)</th>
                      <th className="p-3 text-left text-rose-700">مانده بدهی (۳ - ۴)</th>
                      <th className="p-3 text-left text-teal-700">مانده ظرفیت (۱ - ۲)</th>
                      <th className="p-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectContracts.map((c) => {
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{c.subcontractorName}</div>
                            <div className="text-[10px] text-amber-700 font-medium flex items-center gap-1 mt-0.5">
                              <Hammer className="w-3 h-3" />
                              <span>{c.tradeType}</span>
                              <span className="text-slate-400 font-mono">({c.contractNumber})</span>
                            </div>
                          </td>

                          <td className="p-3 text-left font-black text-slate-900">
                            {formatMoneyCompact(c.contractValue)}
                                                      </td>

                          <td className="p-3 text-left font-bold text-blue-700">
                            {formatMoneyCompact(c.executedValue)}
                            <span className="text-[10px] text-blue-500 block font-normal">
                              {Math.round((c.executedValue / c.contractValue) * 100).toLocaleString('fa-IR')}٪ پیشرفت
                            </span>
                          </td>

                          <td className="p-3 text-left font-bold text-purple-700">
                            {formatMoneyCompact(c.approvedStatementsValue)}
                            <span className="text-[10px] text-purple-500 block font-normal">
                              {Math.round((c.approvedStatementsValue / c.contractValue) * 100).toLocaleString('fa-IR')}٪ پیمان
                            </span>
                          </td>

                          <td className="p-3 text-left font-bold text-emerald-700">
                            {formatMoneyCompact(c.paidValue)}
                            <span className="text-[10px] text-emerald-600 block font-normal">
                              {c.approvedStatementsValue > 0
                                ? Math.round((c.paidValue / c.approvedStatementsValue) * 100).toLocaleString('fa-IR')
                                : '۰'}
                              ٪ تسویه
                            </span>
                          </td>

                          <td className="p-3 text-left font-black text-rose-700">
                            {formatMoneyCompact(c.remainingPayableValue)}
                            <span className="text-[10px] text-rose-500 block font-normal">بدهی فوری</span>
                          </td>

                          <td className="p-3 text-left font-bold text-teal-700">
                            {formatMoneyCompact(c.remainingContractValue)}
                            <span className="text-[10px] text-teal-600 block font-normal">ظرفیت کار</span>
                          </td>

                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => onSelectContract(c)}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 text-[11px] font-bold transition-all cursor-pointer"
                              >
                                جزئیات
                              </button>
                              <button
                                onClick={() => onOpenNewStatement(c)}
                                className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black transition-all cursor-pointer"
                              >
                                صورت‌وضعیت
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
