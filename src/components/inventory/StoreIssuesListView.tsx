/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  StoreIssueVoucher,
  Warehouse,
  Project,
  UserProfile,
} from '../../types';
import {
  ArrowUpRight,
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  User,
  Layers,
  AlertCircle,
} from 'lucide-react';

interface StoreIssuesListViewProps {
  issues: StoreIssueVoucher[];
  warehouses: Warehouse[];
  projects: Project[];
  currentUser: UserProfile;
  onOpenNewIssue: () => void;
  onSelectIssue: (issue: StoreIssueVoucher) => void;
}

export const StoreIssuesListView: React.FC<StoreIssuesListViewProps> = ({
  issues,
  warehouses,
  projects,
  currentUser,
  onOpenNewIssue,
  onSelectIssue,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [contraFilter, setContraFilter] = useState<'all' | 'contra_only' | 'direct_only'>('all');

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchSearch =
        issue.issueNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (issue.subcontractorName && issue.subcontractorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        issue.costCenter.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.wbsSection.toLowerCase().includes(searchQuery.toLowerCase());

      const matchWarehouse = selectedWarehouseId === 'all' || issue.warehouseId === selectedWarehouseId;

      const matchContra =
        contraFilter === 'all' ||
        (contraFilter === 'contra_only' && issue.isSubcontractorContra) ||
        (contraFilter === 'direct_only' && !issue.isSubcontractorContra);

      return matchSearch && matchWarehouse && matchContra;
    });
  }, [issues, searchQuery, selectedWarehouseId, contraFilter]);

  const totalCost = filteredIssues.reduce((s, i) => s + i.totalCost, 0);
  const totalContra = filteredIssues
    .filter((i) => i.isSubcontractorContra)
    .reduce((s, i) => s + i.totalCost, 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header & Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-amber-600" />
              حواله‌های مصرف کارگاهی و خروج مصالح (Store Issue Vouchers - SIV)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تخصیص مصالح به مراکز هزینه (WBS)، تحویل به اکیپ‌های پیمانکار جزء و ثبت تهاتر مصالح با صورت‌وضعیت
            </p>
          </div>

          <button
            onClick={onOpenNewIssue}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>صدور حواله خروج جدید (SIV)</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو با شماره حواله، پیمانکار، مرکز هزینه..."
              className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-slate-50/50"
            />
          </div>

          {/* Warehouse Dropdown */}
          <div>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-slate-50/50 cursor-pointer"
            >
              <option value="all">همه انبارها و کارگاه‌ها</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Contra Filter */}
          <div>
            <select
              value={contraFilter}
              onChange={(e) => setContraFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-slate-50/50 cursor-pointer"
            >
              <option value="all">همه حواله‌ها</option>
              <option value="contra_only">فقط تهاتر با صورت‌وضعیت پیمانکار جزء</option>
              <option value="direct_only">فقط مصرف مستقیم شرکت</option>
            </select>
          </div>

          {/* Metric Box */}
          <div className="flex items-center justify-between px-3 py-1 bg-amber-50/60 rounded-xl border border-amber-200 text-xs">
            <div>
              <span className="text-[10px] text-amber-800 block">جمع مصالح تهاتری</span>
              <span className="font-bold text-amber-900 font-mono">
                {(totalContra / 1_000_000).toLocaleString('fa-IR')} م.ت
              </span>
            </div>
            <div className="text-left">
              <span className="text-[10px] text-slate-500 block">کل مصرف دوره</span>
              <span className="font-bold text-slate-900 font-mono">
                {(totalCost / 1_000_000).toLocaleString('fa-IR')} م.ت
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px]">
                <th className="p-3.5 font-bold">شماره و تاریخ حواله</th>
                <th className="p-3.5 font-bold">پروژه و انبار مبدأ</th>
                <th className="p-3.5 font-bold">مرکز هزینه / بخش اجرایی WBS</th>
                <th className="p-3.5 font-bold">پیمانکار جزء / تحویل‌گیرنده</th>
                <th className="p-3.5 font-bold">نوع تهاتر مصالح</th>
                <th className="p-3.5 font-bold">وضعیت تأیید کارگاه</th>
                <th className="p-3.5 font-bold text-left">ارزش ریالی مصرف</th>
                <th className="p-3.5 font-bold text-center">جزئیات / چاپ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5">
                    <span className="font-bold text-slate-900 block">{issue.issueNumber}</span>
                    <span className="text-[10px] text-slate-400 block">{issue.date}</span>
                    <span className="text-[10px] text-slate-500 block">انباردار: {issue.dispatchedByKeeperName}</span>
                  </td>

                  <td className="p-3.5">
                    <span className="font-bold text-slate-800 block">{issue.projectName}</span>
                    <span className="text-[10px] text-slate-500 block">{issue.warehouseName}</span>
                  </td>

                  <td className="p-3.5">
                    <span className="font-bold text-slate-800 block">{issue.costCenter}</span>
                    <span className="text-[10px] text-slate-500 block max-w-xs truncate">{issue.wbsSection}</span>
                  </td>

                  <td className="p-3.5">
                    {issue.subcontractorName ? (
                      <div>
                        <span className="font-bold text-slate-800 block">{issue.subcontractorName}</span>
                        <span className="text-[10px] text-slate-500 block">رشته: {issue.tradeType}</span>
                        <span className="text-[10px] text-slate-600 block">تحویل به: {issue.receivedByCrewLeaderName}</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-slate-700 font-medium">پرسنل مستقیم شرکت</span>
                        <span className="text-[10px] text-slate-500 block">{issue.receivedByCrewLeaderName}</span>
                      </div>
                    )}
                  </td>

                  <td className="p-3.5">
                    {issue.isSubcontractorContra ? (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          <FileSpreadsheet className="w-3 h-3" />
                          تهاتر از صورت‌وضعیت
                        </span>
                        {issue.subcontractorStatementDeductionRef && (
                          <span className="text-[9px] text-amber-900 block max-w-xs truncate">
                            {issue.subcontractorStatementDeductionRef}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                        تأمین کارفرمایی / مستقیم
                      </span>
                    )}
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        issue.status === 'خروج قطعی از انبار'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {issue.status}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      تأیید: {issue.approvedByManagerName.split(' ')[0]} {issue.approvedByManagerName.split(' ')[1]}
                    </span>
                  </td>

                  <td className="p-3.5 text-left font-mono font-bold text-slate-900">
                    {issue.totalCost.toLocaleString('fa-IR')}
                  </td>

                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => onSelectIssue(issue)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 transition-colors cursor-pointer"
                    >
                      مشاهده سند
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
