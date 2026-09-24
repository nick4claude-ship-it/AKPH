/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SubcontractorContract, Project, UserProfile } from '../../../types';
import {
  Building,
  Plus,
  Search,
  Filter,
  Eye,
  Hammer,
  FileCheck2,
  DollarSign,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface SubcontractorContractsListViewProps {
  contracts: SubcontractorContract[];
  projects: Project[];
  currentUser: UserProfile;
  onSelectContract: (contract: SubcontractorContract) => void;
  onOpenNewContract: () => void;
  onOpenNewStatement: (contract: SubcontractorContract) => void;
}

export const SubcontractorContractsListView: React.FC<SubcontractorContractsListViewProps> = ({
  contracts,
  projects,
  currentUser,
  onSelectContract,
  onOpenNewContract,
  onOpenNewStatement,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [tradeFilter, setTradeFilter] = useState<string>('all');

  const tradeTypes = useMemo(() => {
    const set = new Set<string>();
    contracts.forEach((c) => set.add(c.tradeType));
    return Array.from(set);
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      const matchSearch =
        c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.subcontractorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.projectName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchProject = selectedProjectId === 'all' || c.projectId === selectedProjectId;
      const matchTrade = tradeFilter === 'all' || c.tradeType === tradeFilter;

      return matchSearch && matchProject && matchTrade;
    });
  }, [contracts, searchTerm, selectedProjectId, tradeFilter]);

  const totalContractValue = filteredContracts.reduce((sum, c) => sum + c.contractValue, 0);
  const totalExecuted = filteredContracts.reduce((sum, c) => sum + c.executedValue, 0);
  const totalApproved = filteredContracts.reduce((sum, c) => sum + c.approvedStatementsValue, 0);
  const totalPaid = filteredContracts.reduce((sum, c) => sum + c.paidValue, 0);
  const totalDebt = filteredContracts.reduce((sum, c) => sum + c.remainingPayableValue, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900">فهرست قراردادهای پیمانکاران جزء</h3>
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {filteredContracts.length} قرارداد فعال
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            قراردادهای منقعدشده با اکیپ‌های اجرایی کارگاه شامل موضوع، بهای واحد، سقف تعهدات، کارکرد و مانده تصفیه
          </p>
        </div>

        <button
          onClick={onOpenNewContract}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت قرارداد پیمانکار جزء جدید</span>
        </button>
      </div>

      {/* Aggregate KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">سقف کل قراردادهای جزء</span>
          <span className="text-base font-black text-slate-900">
            {(totalContractValue / 1_000_000).toLocaleString('fa-IR')}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">میلیون تومان</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">کارکرد اجراشده (متره)</span>
          <span className="text-base font-black text-blue-700">
            {(totalExecuted / 1_000_000).toLocaleString('fa-IR')}
          </span>
          <span className="text-[10px] text-blue-500 block mt-0.5">
            {totalContractValue > 0 ? Number(((totalExecuted / totalContractValue) * 100).toFixed(1)).toLocaleString('fa-IR') : '۰'}٪ پیشرفت
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">صورت‌وضعیت‌های مصوب</span>
          <span className="text-base font-black text-purple-700">
            {(totalApproved / 1_000_000).toLocaleString('fa-IR')}
          </span>
          <span className="text-[10px] text-purple-500 block mt-0.5">میلیون تومان</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] text-slate-500 block mb-1">پرداخت‌شده قطعی</span>
          <span className="text-base font-black text-emerald-700">
            {(totalPaid / 1_000_000).toLocaleString('fa-IR')}
          </span>
          <span className="text-[10px] text-emerald-500 block mt-0.5">
            {totalApproved > 0 ? Number(((totalPaid / totalApproved) * 100).toFixed(1)).toLocaleString('fa-IR') : '۰'}٪ وصولی
          </span>
        </div>

        <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-[11px] text-rose-800 font-bold block mb-1">مانده بدهی تاییدشده</span>
          <span className="text-base font-black text-rose-700">
            {(totalDebt / 1_000_000).toLocaleString('fa-IR')}
          </span>
          <span className="text-[10px] text-rose-600 block mt-0.5 font-bold">بدهی فوری AKPH</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو در قرارداد، عنوان، پیمانکار..."
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
        </div>
      </div>

      {/* Contract Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredContracts.map((contract) => {
          const execPct = (contract.executedValue / contract.contractValue) * 100;
          const payPct =
            contract.approvedStatementsValue > 0
              ? (contract.paidValue / contract.approvedStatementsValue) * 100
              : 0;

          return (
            <div
              key={contract.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-xs transition-all space-y-4"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80">
                      {contract.contractNumber}
                    </span>
                    <span className="text-[11px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                      {contract.tradeType}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {contract.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{contract.title}</h4>
                </div>

                <button
                  onClick={() => onSelectContract(contract)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 transition-all cursor-pointer shrink-0"
                  title="تحلیل تفصیلی"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              {/* Subcontractor details */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">پیمانکار جزء:</span>
                  <span className="font-bold text-slate-900">{contract.subcontractorName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">پروژه:</span>
                  <span className="text-slate-800 font-bold">{contract.projectName}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">نرخ پایه توافقی:</span>
                  <span className="text-amber-800 font-bold">{contract.unitRateDescription}</span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">مبلغ قرارداد</span>
                  <span className="font-black text-slate-900">
                    {(contract.contractValue / 1_000_000).toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[9px] text-slate-400 block">م.ت</span>
                </div>

                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">کارکرد متره</span>
                  <span className="font-bold text-blue-700">
                    {(contract.executedValue / 1_000_000).toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[9px] text-blue-600 block">{Math.round(execPct).toLocaleString('fa-IR')}٪ پیشرفت</span>
                </div>

                <div className="bg-rose-50/60 p-2 rounded-lg border border-rose-200">
                  <span className="text-[10px] text-rose-700 block font-bold">مانده بدهی</span>
                  <span className="font-black text-rose-700">
                    {(contract.remainingPayableValue / 1_000_000).toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[9px] text-rose-600 block">م.ت</span>
                </div>
              </div>

              {/* Multi-step progress bar */}
              <div className="space-y-1">
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{
                      width: `${Math.min(100, (contract.paidValue / contract.contractValue) * 100)}%`,
                    }}
                    title="پرداخت‌شده"
                  />
                  <div
                    className="bg-rose-500 h-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (contract.remainingPayableValue / contract.contractValue) * 100
                      )}%`,
                    }}
                    title="مانده بدهی تاییدشده"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="text-emerald-700 font-bold">
                    پرداختی: {(contract.paidValue / 1_000_000).toLocaleString('fa-IR')} م.ت
                  </span>
                  <span className="text-slate-400">
                    ظرفیت مانده: {(contract.remainingContractValue / 1_000_000).toLocaleString('fa-IR')} م.ت
                  </span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {contract.startDate} الی {contract.endDate}
                  </span>
                </div>

                <button
                  onClick={() => onOpenNewStatement(contract)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت صورت‌وضعیت</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
