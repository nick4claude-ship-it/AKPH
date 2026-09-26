/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  MaterialItem,
  KardexEntry,
  UserProfile,
} from '../../types';
import {
  FileSpreadsheet,
  Search,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  RefreshCw,
  Package,
  Layers,
  Scale,
} from 'lucide-react';
import { formatMoney, formatMoneyCompact, moneyUnitLabel } from '../../utils/money';
import { formatDecimal, formatText } from '../../utils/formatters';
import { kardexTotals } from '../../store/views/inventory';
import { Money } from '../common/Money';

interface KardexViewProps {
  materials: MaterialItem[];
  kardexRecords: KardexEntry[];
  initialMaterialId?: string;
  currentUser: UserProfile;
}

export const KardexView: React.FC<KardexViewProps> = ({
  materials,
  kardexRecords,
  initialMaterialId,
  currentUser,
}) => {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(
    initialMaterialId || (materials.length > 0 ? materials[0].id : '')
  );

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);

  const records = useMemo(() => {
    return kardexRecords.filter((k) => k.materialId === selectedMaterialId);
  }, [kardexRecords, selectedMaterialId]);

  const { totalIn, totalOut } = kardexTotals(records);
  const currentBalance = selectedMaterial ? selectedMaterial.currentStock : totalIn - totalOut;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header & Material Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              کاردکس مقداری و ریالی کالا
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              تاریخچه تحلیلی تمام گردش‌های وارده، صادره، حواله‌ها و مانده متحرک مصالح به روش میانگین موزون
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={handlePrint}
              className="btn btn-secondary"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فرم رسمی کاردکس</span>
            </button>
          </div>
        </div>

        {/* Material Picker Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="sm:col-span-2">
            <label htmlFor="kardex-view-1" className="text-xs font-bold text-slate-600 block mb-1">
              انتخاب کالا / مصالح جهت مشاهده کاردکس:
            </label>
            <select id="kardex-view-1"
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50/70 font-medium cursor-pointer"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatText(m.code)} - {formatText(m.name)} ({m.category})
                </option>
              ))}
            </select>
          </div>

          {selectedMaterial && (
            <div className="p-2 rounded-xl bg-indigo-50/60 border border-indigo-100 text-sm">
              <div className="flex items-center justify-between text-slate-700 mb-1">
                <span>واحد سنجش:</span>
                <span className="font-bold">{formatText(selectedMaterial.unit)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>نرخ میانگین:</span>
                <span className="font-bold tabular-nums text-indigo-700">
                  <Money rial={selectedMaterial.averageUnitPrice} />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Material KPI Cards */}
      {selectedMaterial && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 block mb-1">کل ورودی دوره</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold text-emerald-700 tabular-nums">
                {formatMoney(totalIn, false)}
              </span>
              <span className="text-xs text-slate-500">{formatText(selectedMaterial.unit)}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 block mb-1">کل مصرف کارگاه‌ها</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold text-amber-700 tabular-nums">
                {formatMoney(totalOut, false)}
              </span>
              <span className="text-xs text-slate-500">{formatText(selectedMaterial.unit)}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 block mb-1">مانده موجودی انبار</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                {formatMoney(currentBalance, false)}
              </span>
              <span className="text-xs text-slate-500">{formatText(selectedMaterial.unit)}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 block mb-1">ارزش کل موجودی</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold text-indigo-700 tabular-nums">
                <Money rial={selectedMaterial.totalStockValue} compact />
              </span>
                          </div>
          </div>
        </div>
      )}

      {/* Kardex Detailed Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden print:border-none print:shadow-none">
        <div className="table-scroll">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="bg-slate-900 text-white text-sm">
                <th className="p-3 font-medium">ردیف</th>
                <th className="p-3 font-medium">تاریخ سند</th>
                <th className="p-3 font-medium">نوع تراکنش</th>
                <th className="p-3 font-medium">شماره سند</th>
                <th className="p-3 font-medium">انبار و طرف حساب / پروژه</th>
                <th className="p-3 font-medium text-center bg-emerald-950/60">وارده (ورود به انبار)</th>
                <th className="p-3 font-medium text-center bg-amber-950/60">صادره (مصرف کارگاه)</th>
                <th className="p-3 font-medium text-center bg-indigo-950/60">مانده موجودی</th>
                <th className="p-3 font-medium text-left">نرخ واحد ({moneyUnitLabel()})</th>
                <th className="p-3 font-medium text-left">ارزش کل مانده ({moneyUnitLabel()})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 text-xs">
                    تراکنشی برای این متریال در دوره جاری ثبت نشده است.
                  </td>
                </tr>
              ) : (
                records.map((r, index) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 text-slate-500 tabular-nums text-center">{index + 1}</td>
                    <td className="p-3 font-medium text-slate-700 tabular-nums">{formatText(r.date)}</td>

                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                          r.docType === 'رسید ورود انبار'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.docType === 'حواله مصرف کارگاه'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {r.docType === 'رسید ورود انبار' ? (
                          <ArrowDownLeft className="w-3 h-3" />
                        ) : r.docType === 'حواله مصرف کارگاه' ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowRightLeft className="w-3 h-3" />
                        )}
                        {formatText(r.docType)}
                      </span>
                    </td>

                    <td className="p-3 tabular-nums font-bold text-slate-800">{formatText(r.docNumber)}</td>

                    <td className="p-3">
                      <span className="font-bold text-slate-800 block">{formatText(r.counterparty)}</span>
                      <span className="text-xs text-slate-500">{formatText(r.warehouseName)}</span>
                    </td>

                    {/* In Qty */}
                    <td className="p-3 text-center tabular-nums font-bold text-emerald-700 bg-emerald-50/20">
                      {r.inQty > 0 ? formatDecimal(r.inQty) : '—'}
                    </td>

                    {/* Out Qty */}
                    <td className="p-3 text-center tabular-nums font-bold text-amber-700 bg-amber-50/20">
                      {r.outQty > 0 ? formatDecimal(r.outQty) : '—'}
                    </td>

                    {/* Balance Qty */}
                    <td className="p-3 text-center tabular-nums font-bold text-slate-900 bg-indigo-50/20">
                      {formatDecimal(r.balanceQty)}
                    </td>

                    <td className="p-3 text-left tabular-nums text-slate-700">
                      {formatMoney(r.unitCost, false)}
                    </td>

                    <td className="p-3 text-left tabular-nums font-bold text-indigo-900">
                      {formatMoney(r.balanceValuation, false)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
