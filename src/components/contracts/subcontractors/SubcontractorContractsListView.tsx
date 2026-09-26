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
import { formatMoneyCompact } from '../../../utils/money';
import { formatDecimal, barWidth, formatPercent, formatInt, formatText } from '../../../utils/formatters';
import { subcontractProgress, sumSubcontracts } from '../../../store/views/contracts';
import { Money } from '../../common/Money';

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

  const totals = useMemo(() => sumSubcontracts(filteredContracts), [filteredContracts]);
  const { contractValue: totalContractValue, executed: totalExecuted, approved: totalApproved, paid: totalPaid, debt: totalDebt } = totals;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">فهرست قراردادهای پیمانکاران جزء</h3>
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-bold">
              {formatInt(filteredContracts.length)} قرارداد فعال
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            قراردادهای منقعدشده با اکیپ‌های اجرایی کارگاه شامل موضوع، بهای واحد، سقف تعهدات، کارکرد و مانده تصفیه
          </p>
        </div>

        <button
          onClick={onOpenNewContract}
          className="btn btn-primary shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت قرارداد پیمانکار جزء جدید</span>
        </button>
      </div>

      {/* Aggregate KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">سقف کل قراردادهای جزء</span>
          <span className="text-base font-bold text-slate-900">
            <Money rial={totalContractValue} compact />
          </span>
                  </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">کارکرد اجراشده (متره)</span>
          <span className="text-base font-bold text-blue-700">
            <Money rial={totalExecuted} compact />
          </span>
          <span className="text-sm text-blue-700 block mt-1">
            {formatPercent(totals.executedPercent)} پیشرفت
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">صورت‌وضعیت‌های مصوب</span>
          <span className="text-base font-bold text-purple-700">
            <Money rial={totalApproved} compact />
          </span>
                  </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">پرداخت‌شده قطعی</span>
          <span className="text-base font-bold text-emerald-700">
            <Money rial={totalPaid} compact />
          </span>
          <span className="text-sm text-emerald-700 block mt-1">
            {formatPercent(totals.settledPercent)} وصولی
          </span>
        </div>

        <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-sm text-rose-800 font-bold block mb-1">مانده بدهی تاییدشده</span>
          <span className="text-base font-bold text-rose-700">
            <Money rial={totalDebt} compact />
          </span>
          <span className="text-sm text-rose-700 block mt-1 font-bold">بدهی فوری شرکت</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
            <input aria-label="جستجو در قرارداد، عنوان، پیمانکار"
              type="text"
              placeholder="جستجو در قرارداد، عنوان، پیمانکار..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
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
        </div>
      </div>

      {/* Contract Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredContracts.map((contract) => {
          const progress = subcontractProgress(contract);
          const execPct = progress.executedPercent;

          return (
            <div
              key={contract.id}
              className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-xs transition-all space-y-4"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="tabular-nums text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200/80">
                      {formatText(contract.contractNumber)}
                    </span>
                    <span className="text-xs font-bold bg-slate-100 text-slate-800 px-2 py-1 rounded">
                      {formatText(contract.tradeType)}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                      {formatText(contract.status)}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 leading-snug">{formatText(contract.title)}</h4>
                </div>

                <button
                  onClick={() => onSelectContract(contract)}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 transition-all cursor-pointer shrink-0"
                  title="تحلیل تفصیلی"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              {/* Subcontractor details */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">پیمانکار جزء:</span>
                  <span className="font-bold text-slate-900">{formatText(contract.subcontractorName)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">پروژه:</span>
                  <span className="text-slate-800 font-bold">{formatText(contract.projectName)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">نرخ پایه توافقی:</span>
                  <span className="text-amber-800 font-bold">{formatText(contract.unitRateDescription)}</span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500 block">مبلغ قرارداد</span>
                  <span className="font-bold text-slate-900">
                    <Money rial={contract.contractValue} compact />
                  </span>
                                  </div>

                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500 block">کارکرد متره</span>
                  <span className="font-bold text-blue-700">
                    <Money rial={contract.executedValue} compact />
                  </span>
                  <span className="text-sm text-blue-600 block">{formatPercent(execPct, 0)} پیشرفت</span>
                </div>

                <div className="bg-rose-50/60 p-2 rounded-lg border border-rose-200">
                  <span className="text-sm text-rose-700 block font-bold">مانده بدهی</span>
                  <span className="font-bold text-rose-700">
                    <Money rial={contract.remainingPayableValue} compact />
                  </span>
                                  </div>
              </div>

              {/* Multi-step progress bar */}
              <div className="space-y-1">
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: barWidth(progress.paidOfContractPercent) }}
                    title="پرداخت‌شده"
                  />
                  <div
                    className="bg-rose-500 h-full"
                    style={{ width: barWidth(progress.unpaidApprovedPercent) }}
                    title="مانده بدهی تاییدشده"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="text-emerald-700 font-bold">
                    پرداختی: {formatMoneyCompact(contract.paidValue)}
                  </span>
                  <span className="text-slate-500">
                    ظرفیت مانده: {formatMoneyCompact(contract.remainingContractValue)}
                  </span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {formatText(contract.startDate)} الی {formatText(contract.endDate)}
                  </span>
                </div>

                <button
                  onClick={() => onOpenNewStatement(contract)}
                  className="btn btn-primary"
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
