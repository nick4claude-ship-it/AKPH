/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Contract, ContractStatus, UserProfile } from '../../types';
import {
  Building,
  Search,
  Filter,
  Plus,
  Eye,
  FileText,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { formatMoneyCompact } from '../../utils/money';
import { formatPercent, formatText } from '../../utils/formatters';
import { contractProgress } from '../../store/views/contracts';
import { Money } from '../common/Money';

interface ContractsListViewProps {
  contracts: Contract[];
  currentUser: UserProfile;
  onSelectContract: (contract: Contract) => void;
  onOpenNewContract: () => void;
}

export const ContractsListView: React.FC<ContractsListViewProps> = ({
  contracts,
  currentUser,
  onSelectContract,
  onOpenNewContract,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      const matchSearch =
        c.projectTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.employer.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchType = typeFilter === 'all' || c.contractType === typeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [contracts, searchTerm, statusFilter, typeFilter]);

  return (
    <div className="space-y-4">
      {/* Header and Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">دفتر قراردادهای پیمانکاری عمرانی</h2>
          <p className="text-xs text-slate-500 mt-1">
            مدیریت کامل موافقت‌نامه‌ها، احجام، شرایط عمومی و خصوصی، کارفرمایان و مهندسین مشاور
          </p>
        </div>

        <button
          onClick={onOpenNewContract}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت قرارداد جدید</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
          <input aria-label="جستجو در کد، شماره، عنوان پروژه، کارفرما"
            type="text"
            placeholder="جستجو در کد، شماره، عنوان پروژه، کارفرما..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 focus:outline-amber-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select aria-label="فیلتر: وضعیت‌ها"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 bg-white"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="فعال">فعال</option>
            <option value="تحویل موقت">تحویل موقت</option>
            <option value="تحویل قطعی">تحویل قطعی</option>
            <option value="تعلیق">تعلیق شده</option>
            <option value="خاتمه یافته">خاتمه یافته</option>
          </select>

          <select aria-label="فیلتر: انواع پیمان"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 bg-white"
          >
            <option value="all">همه انواع پیمان</option>
            <option value="فهرست‌بهایی">فهرست‌بهایی</option>
            <option value="سرجمع (مقطوع)">سرجمع (مقطوع)</option>
            <option value="طراحی و ساخت (EPC)">طراحی و ساخت</option>
          </select>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs table-scroll">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3">کد پیمان</th>
              <th className="p-3">عنوان پروژه و موضوع</th>
              <th className="p-3">کارفرما و مشاور</th>
              <th className="p-3 text-left">مبلغ اولیه</th>
              <th className="p-3 text-left">تغییرات / الحاقیه</th>
              <th className="p-3 text-left">مبلغ فعلی پیمان</th>
              <th className="p-3 text-left">کارکرد اجراشده</th>
              <th className="p-3 text-left">دریافتی نقد</th>
              <th className="p-3 text-left">مانده طلب</th>
              <th className="p-3 text-center">وضعیت</th>
              <th className="p-3 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredContracts.map((c) => {
              const execPct = contractProgress(c).executedPercent;
              return (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => onSelectContract(c)}
                >
                  <td className="p-3 tabular-nums font-bold text-amber-900">{formatText(c.code)}</td>
                  <td className="p-3 max-w-xs">
                    <span className="font-bold text-slate-900 block hover:text-blue-700">
                      {formatText(c.projectTitle)}
                    </span>
                    <span className="text-xs text-slate-500 block mt-1">
                      شماره: {formatText(c.number)} · نوع: {formatText(c.contractType)}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-slate-800 block">{formatText(c.employer)}</span>
                    <span className="text-xs text-slate-500 block mt-1">مشاور: {formatText(c.consultant)}</span>
                  </td>
                  <td className="p-3 text-left tabular-nums">
                    <Money rial={c.initialValue} compact />
                  </td>
                  <td className="p-3 text-left tabular-nums text-emerald-700 font-medium">
                    {c.approvedChangesValue > 0
                      ? `+${formatMoneyCompact(c.approvedChangesValue)}`
                      : '-'}
                  </td>
                  <td className="p-3 text-left tabular-nums font-bold text-amber-950">
                    <Money rial={c.currentValue} compact />
                  </td>
                  <td className="p-3 text-left tabular-nums">
                    <span className="font-bold text-indigo-700">
                      <Money rial={c.executedValue} compact />
                    </span>
                    <span className="block text-sm text-indigo-700 font-bold">
                      {formatPercent(execPct)}
                    </span>
                  </td>
                  <td className="p-3 text-left tabular-nums font-bold text-emerald-700">
                    <Money rial={c.receivedValue} compact />
                  </td>
                  <td className="p-3 text-left tabular-nums font-bold text-rose-700">
                    <Money rial={c.receivableValue} compact />
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        c.status === 'فعال'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'تحویل موقت'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {formatText(c.status)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectContract(c);
                      }}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                    >
                      مشاهده جزئیات
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
