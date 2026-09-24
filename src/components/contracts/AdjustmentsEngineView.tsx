/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Contract, PriceAdjustment, UserProfile } from '../../types';
import { TrendingUp, Plus, FileSpreadsheet, CheckCircle2, FileText, Download } from 'lucide-react';
import { formatMoney, formatMoneyCompact, moneyUnitLabel, formatInt } from '../../utils/money';
import { formatPercent } from '../../utils/formatters';

interface AdjustmentsEngineViewProps {
  contracts: Contract[];
  adjustments: PriceAdjustment[];
  currentUser: UserProfile;
}

export const AdjustmentsEngineView: React.FC<AdjustmentsEngineViewProps> = ({
  contracts,
  adjustments,
  currentUser,
}) => {
  const [selectedContractId, setSelectedContractId] = useState<string>('all');

  const filteredAdjustments = adjustments.filter(
    (a) => selectedContractId === 'all' || a.contractId === selectedContractId
  );

  const approvedCount = filteredAdjustments.filter((a) => a.status === 'تأیید کارفرما' || a.status === 'اعمال شده در صورت‌وضعیت').length;
  const totalAdjustments = filteredAdjustments.reduce(
    (sum, a) => sum + a.calculatedAdjustmentAmount,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            سامانه محاسبه و رسیدگی به تعدیل آحاد بها (Price Adjustment Engine)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            محاسبه تعدیل فصلی بر اساس شاخص‌های قطعی سازمان برنامه و بودجه کشور (بخشنامه ۱۷۳۰۷۳)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedContractId}
            onChange={(e) => setSelectedContractId(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 bg-white text-xs"
          >
            <option value="all">همه قراردادها</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.projectTitle.slice(0, 30)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">مجموع مبالغ تعدیل محاسبه‌شده</span>
          <span className="text-xl font-black text-amber-900 font-mono">
            {formatMoneyCompact(totalAdjustments)}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">تعداد دوره‌ها: {filteredAdjustments.length} فصل</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">مبنای استناد قانونی</span>
          <span className="text-sm font-bold text-slate-800 block">دستورالعمل نحوه تعدیل آحاد بها</span>
          <span className="text-[11px] text-slate-400 block mt-1">بخشنامه شماره ۱۷۳۰۷۳ سازمان برنامه</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">وضعیت تاییدات مشاور و کارفرما</span>
          <span className="text-sm font-bold text-emerald-700 block">
            {formatPercent(filteredAdjustments.length ? (approvedCount * 100) / filteredAdjustments.length : 0)} تأیید کارفرما یا اعمال‌شده
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">
            {formatInt(approvedCount)} از {formatInt(filteredAdjustments.length)} تعدیل
          </span>
        </div>
      </div>

      {/* Adjustments Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3">شماره تعدیل</th>
              <th className="p-3">پیمان مرتبط</th>
              <th className="p-3">دوره تعدیل</th>
              <th className="p-3 text-center">شاخص دوره مبنا (I₀)</th>
              <th className="p-3 text-center">شاخص دوره کارکرد (I)</th>
              <th className="p-3 text-center">ضریب تعدیل (P)</th>
              <th className="p-3 text-left">مبلغ مبنای کارکرد</th>
              <th className="p-3 text-left">مبلغ تعدیل ({moneyUnitLabel()})</th>
              <th className="p-3 text-center">وضعیت</th>
              <th className="p-3 text-center">کاربرگ محاسبات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAdjustments.map((adj) => {
              const contract = contracts.find((c) => c.id === adj.contractId);
              return (
                <tr key={adj.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-bold text-slate-900">{adj.adjustmentNumber}</td>
                  <td className="p-3">
                    <span className="font-medium text-slate-800 block">{contract?.projectTitle}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{contract?.code}</span>
                  </td>
                  <td className="p-3 font-medium text-slate-700">{adj.period}</td>
                  <td className="p-3 text-center font-mono font-medium">{adj.basePeriodIndex.toLocaleString('fa-IR')}</td>
                  <td className="p-3 text-center font-mono font-bold text-blue-700">
                    {adj.currentPeriodIndex.toLocaleString('fa-IR')}
                  </td>
                  <td className="p-3 text-center font-mono font-black text-amber-900">
                    +{adj.coefficient.toFixed(3)}
                  </td>
                  <td className="p-3 text-left font-mono text-slate-600">
                    {formatMoney(adj.baseAmount, false)}
                  </td>
                  <td className="p-3 text-left font-mono font-black text-emerald-800">
                    {formatMoney(adj.calculatedAdjustmentAmount, false)}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {adj.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {adj.attachedCalcSheetName ? (
                      <button disabled title="به‌زودی" className="px-2.5 py-1 rounded bg-slate-100 text-slate-400 text-[10px] font-bold inline-flex items-center gap-1 cursor-not-allowed">
                        <Download className="w-3 h-3" />
                        <span>اکسل محاسبات (به‌زودی)</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[10px]">-</span>
                    )}
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
