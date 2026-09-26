/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  StocktakeAudit,
  Warehouse,
  UserProfile,
} from '../../types';
import {
  Scale,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Printer,
  Calendar,
  UserCheck,
} from 'lucide-react';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { formatDecimal, formatText } from '../../utils/formatters';
import { Money } from '../common/Money';

interface StocktakeViewProps {
  stocktakes: StocktakeAudit[];
  warehouses: Warehouse[];
  currentUser: UserProfile;
  onApplyAdjustmentJournal: (stocktakeId: string) => void;
}

export const StocktakeView: React.FC<StocktakeViewProps> = ({
  stocktakes,
  warehouses,
  currentUser,
  onApplyAdjustmentJournal,
}) => {
  const [selectedAuditId, setSelectedAuditId] = useState<string>(
    stocktakes.length > 0 ? stocktakes[0].id : ''
  );

  const selectedAudit = stocktakes.find((s) => s.id === selectedAuditId);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-600" />
              انبارگردانی، شمارش عینی و مغایرت‌گیری
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              تطبیق موجودی سیستمی با شمارش فیزیکی کارگاه‌ها، ثبت علل پرت و کسری و صدور سند تعدیل
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              دوره انبارگردانی: پایان تابستان و شش‌ماهه اول
            </span>
          </div>
        </div>

        {/* Audit Select Tab Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
          {stocktakes.map((audit) => (
            <button
              key={audit.id}
              onClick={() => setSelectedAuditId(audit.id)}
              className={`px-3 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                selectedAuditId === audit.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>{formatText(audit.auditNumber)}</span>
              <span className="text-sm opacity-80">({audit.warehouseName})</span>
            </button>
          ))}
        </div>
      </div>

      {selectedAudit && (
        <div className="space-y-4">
          {/* Audit Metadata Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                    {formatText(selectedAudit.warehouseName)}
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">تاریخ شمارش: {formatText(selectedAudit.date)}</span>
                </div>
                <h4 className="font-bold text-base text-slate-900">{formatText(selectedAudit.auditNumber)}</h4>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>سرپرست هیئت شمارش: <strong className="text-slate-700">{formatText(selectedAudit.leadAuditor)}</strong></span>
                  <span>·</span>
                  <span>اعضا: {selectedAudit.teamMembers.join('، ')}</span>
                </p>
              </div>

              {/* Status and Action */}
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <span className="text-xs text-slate-500 block">خالص مغایرت ریالی</span>
                  <span
                    className={`font-bold tabular-nums text-sm ${
                      selectedAudit.netVarianceAmount < 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    <Money rial={selectedAudit.netVarianceAmount} />
                  </span>
                </div>

                {selectedAudit.accountingAdjustmentEntryId ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    سند تعدیل صادر شد ({selectedAudit.accountingAdjustmentEntryId})
                  </span>
                ) : (
                  <button
                    onClick={() => onApplyAdjustmentJournal(selectedAudit.id)}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-xs transition-all cursor-pointer"
                  >
                    صدور خودکار سند تعدیل انبار
                  </button>
                )}
              </div>
            </div>

            {/* Audit Items Table */}
            <div className="mt-4 table-scroll">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                    <th className="p-3 font-bold">شرح کالا</th>
                    <th className="p-3 font-bold">واحد</th>
                    <th className="p-3 font-bold text-center">موجودی دفاتر (سیستمی)</th>
                    <th className="p-3 font-bold text-center">شمارش عینی (واقعی)</th>
                    <th className="p-3 font-bold text-center">مغایرت مقداری</th>
                    <th className="p-3 font-bold text-left">نرخ واحد ({moneyUnitLabel()})</th>
                    <th className="p-3 font-bold text-left">مبلغ مغایرت ({moneyUnitLabel()})</th>
                    <th className="p-3 font-bold">علت مغایرت و گزارش فنی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedAudit.items.map((item, idx) => (
                    <tr key={`${item.materialId}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-bold text-slate-800">
                        {formatText(item.materialName)}
                        <span className="text-xs text-slate-500 block tabular-nums font-normal">
                          {formatText(item.materialCode)}
                        </span>
                      </td>

                      <td className="p-3 font-medium text-slate-600">{formatText(item.unit)}</td>

                      <td className="p-3 text-center tabular-nums font-bold text-slate-700 bg-slate-50/50">
                        {formatDecimal(item.systemStock)}
                      </td>

                      <td className="p-3 text-center tabular-nums font-bold text-slate-900 bg-slate-100/50">
                        {formatDecimal(item.physicalCount)}
                      </td>

                      <td className="p-3 text-center tabular-nums font-bold">
                        <span
                          className={`inline-block px-2 py-1 rounded-md ${
                            item.varianceQty < 0
                              ? 'text-rose-700 bg-rose-50'
                              : item.varianceQty > 0
                              ? 'text-emerald-700 bg-emerald-50'
                              : 'text-slate-500'
                          }`}
                        >
                          {item.varianceQty > 0 ? `+${formatDecimal(item.varianceQty)}` : formatDecimal(item.varianceQty)}
                        </span>
                      </td>

                      <td className="p-3 text-left tabular-nums text-slate-700">
                        {formatMoney(item.unitPrice, false)}
                      </td>

                      <td
                        className={`p-3 text-left tabular-nums font-bold ${
                          item.varianceAmount < 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatMoney(item.varianceAmount, false)}
                      </td>

                      <td className="p-3 text-slate-600 text-sm max-w-xs leading-relaxed">
                        {formatText(item.notes || '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
