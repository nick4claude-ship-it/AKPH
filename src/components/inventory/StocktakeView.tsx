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
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-600" />
              انبارگردانی، شمارش عینی و مغایرت‌گیری (Physical Stocktaking)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                selectedAuditId === audit.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>{audit.auditNumber}</span>
              <span className="text-[10px] opacity-80">({audit.warehouseName})</span>
            </button>
          ))}
        </div>
      </div>

      {selectedAudit && (
        <div className="space-y-4">
          {/* Audit Metadata Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    {selectedAudit.warehouseName}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">تاریخ شمارش: {selectedAudit.date}</span>
                </div>
                <h4 className="font-bold text-base text-slate-900">{selectedAudit.auditNumber}</h4>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>سرپرست هیئت شمارش: <strong className="text-slate-700">{selectedAudit.leadAuditor}</strong></span>
                  <span>·</span>
                  <span>اعضا: {selectedAudit.teamMembers.join('، ')}</span>
                </p>
              </div>

              {/* Status and Action */}
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <span className="text-[10px] text-slate-400 block">خالص مغایرت ریالی</span>
                  <span
                    className={`font-black font-mono text-sm ${
                      selectedAudit.netVarianceAmount < 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {selectedAudit.netVarianceAmount.toLocaleString('fa-IR')} تومان
                  </span>
                </div>

                {selectedAudit.accountingAdjustmentEntryId ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    سند تعدیل صادر شد ({selectedAudit.accountingAdjustmentEntryId})
                  </span>
                ) : (
                  <button
                    onClick={() => onApplyAdjustmentJournal(selectedAudit.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    صدور خودکار سند تعدیل انبار
                  </button>
                )}
              </div>
            </div>

            {/* Audit Items Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                    <th className="p-3 font-bold">شرح کالا</th>
                    <th className="p-3 font-bold">واحد</th>
                    <th className="p-3 font-bold text-center">موجودی دفاتر (سیستمی)</th>
                    <th className="p-3 font-bold text-center">شمارش عینی (واقعی)</th>
                    <th className="p-3 font-bold text-center">مغایرت مقداری</th>
                    <th className="p-3 font-bold text-left">نرخ واحد (تومان)</th>
                    <th className="p-3 font-bold text-left">مبلغ مغایرت (تومان)</th>
                    <th className="p-3 font-bold">علت مغایرت و گزارش فنی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedAudit.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-bold text-slate-800">
                        {item.materialName}
                        <span className="text-[10px] text-slate-400 block font-mono font-normal">
                          {item.materialCode}
                        </span>
                      </td>

                      <td className="p-3 font-medium text-slate-600">{item.unit}</td>

                      <td className="p-3 text-center font-mono font-bold text-slate-700 bg-slate-50/50">
                        {item.systemStock.toLocaleString('fa-IR')}
                      </td>

                      <td className="p-3 text-center font-mono font-bold text-slate-900 bg-slate-100/50">
                        {item.physicalCount.toLocaleString('fa-IR')}
                      </td>

                      <td className="p-3 text-center font-mono font-bold">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md ${
                            item.varianceQty < 0
                              ? 'text-rose-700 bg-rose-50'
                              : item.varianceQty > 0
                              ? 'text-emerald-700 bg-emerald-50'
                              : 'text-slate-500'
                          }`}
                        >
                          {item.varianceQty > 0 ? `+${item.varianceQty.toLocaleString('fa-IR')}` : item.varianceQty.toLocaleString('fa-IR')}
                        </span>
                      </td>

                      <td className="p-3 text-left font-mono text-slate-700">
                        {item.unitPrice.toLocaleString('fa-IR')}
                      </td>

                      <td
                        className={`p-3 text-left font-mono font-bold ${
                          item.varianceAmount < 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {item.varianceAmount.toLocaleString('fa-IR')}
                      </td>

                      <td className="p-3 text-slate-600 text-[11px] max-w-xs leading-relaxed">
                        {item.notes || '—'}
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
