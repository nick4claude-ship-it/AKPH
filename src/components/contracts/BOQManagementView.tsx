/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Contract, ContractBOQItem, UserProfile } from '../../types';
import {
  Layers,
  Search,
  AlertTriangle,
  Package,
  Plus,
  ArrowRight,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { formatDecimal, formatInt, formatText } from '../../utils/formatters';

interface BOQManagementViewProps {
  contracts: Contract[];
  boqItems: ContractBOQItem[];
  currentUser: UserProfile;
}

export const BOQManagementView: React.FC<BOQManagementViewProps> = ({
  contracts,
  boqItems,
  currentUser,
}) => {
  const [selectedContractId, setSelectedContractId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [surplusOnly, setSurplusOnly] = useState(false);

  const filteredItems = useMemo(() => {
    return boqItems.filter((item) => {
      const matchContract = selectedContractId === 'all' || item.contractId === selectedContractId;
      const matchSearch =
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.chapter.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSurplus = surplusOnly ? item.isSurplusQuantity : true;

      return matchContract && matchSearch && matchSurplus;
    });
  }, [boqItems, selectedContractId, searchTerm, surplusOnly]);

  const surplusCount = boqItems.filter((b) => b.isSurplusQuantity).length;

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            مدیریت فهرست‌بها، مقادیر کارکرد و انبار
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            پایش هوشمند انحراف احجام، هشدار عبور از سقف ۲۵٪ پیمان، و اتصال مصالح به انبار کارگاهی
          </p>
        </div>

        {surplusCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-700" />
            <span>{formatDecimal(surplusCount)} ردیف مازاد بر سقف پیمان نیازمند الحاقیه</span>
          </div>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
            <input aria-label="جستجو در شرح عملیات، کد آیتم یا فصل"
              type="text"
              placeholder="جستجو در شرح عملیات، کد آیتم یا فصل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:outline-amber-500"
            />
          </div>

          <select aria-label="فیلتر: قراردادها"
            value={selectedContractId}
            onChange={(e) => setSelectedContractId(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 bg-white"
          >
            <option value="all">همه قراردادها</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {formatText(c.code)} - {c.projectTitle.slice(0, 30)}...
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSurplusOnly(!surplusOnly)}
            className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              surplusOnly
                ? 'bg-rose-700 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>فقط اقلام مازاد بر پیمان ({formatInt(surplusCount)})</span>
          </button>
        </div>
      </div>

      {/* BOQ Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs table-scroll">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3">ردیف</th>
              <th className="p-3">پیمان</th>
              <th className="p-3">کد آیتم</th>
              <th className="p-3">شرح عملیات فهرست‌بها</th>
              <th className="p-3 text-center">واحد</th>
              <th className="p-3 text-left">مقدار اولیه مصوب</th>
              <th className="p-3 text-left">بهای واحد ({moneyUnitLabel()})</th>
              <th className="p-3 text-left">مقدار کارکرد اجراشده</th>
              <th className="p-3 text-left">مبلغ کل کارکرد</th>
              <th className="p-3 text-center">پیشرفت احجام</th>
              <th className="p-3 text-center">اتصال به انبار</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const contract = contracts.find((c) => c.id === item.contractId);
              return (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    item.isSurplusQuantity ? 'bg-rose-50/40' : ''
                  }`}
                >
                  <td className="p-3 tabular-nums text-slate-500">{formatText(item.rowNumber)}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-800">
                      {formatText(contract?.code)}
                    </span>
                  </td>
                  <td className="p-3 tabular-nums font-bold text-blue-700">{formatText(item.code)}</td>
                  <td className="p-3 max-w-sm">
                    <span className="font-bold text-slate-900 block">{formatText(item.description)}</span>
                    <span className="text-xs text-slate-500 block mt-1">{formatText(item.chapter)}</span>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-600">{formatText(item.unit)}</td>
                  <td className="p-3 text-left tabular-nums font-medium">
                    {formatDecimal(item.initialQuantity)}
                  </td>
                  <td className="p-3 text-left tabular-nums text-slate-600">
                    {formatMoney(item.unitRate, false)}
                  </td>
                  <td className="p-3 text-left tabular-nums">
                    <span
                      className={`font-bold ${
                        item.isSurplusQuantity ? 'text-rose-700 font-bold' : 'text-indigo-900'
                      }`}
                    >
                      {formatDecimal(item.cumulativeExecutedQuantity)}
                    </span>
                    {item.isSurplusQuantity && (
                      <span className="block text-sm font-bold text-rose-700">
                        مازاد: +{formatDecimal(item.surplusQuantity)}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-left tabular-nums font-bold text-slate-900">
                    {formatMoney(item.executedAmount, false)}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        item.progressPercentage > 100
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : item.progressPercentage >= 80
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {formatDecimal(item.progressPercentage, 1)}٪
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {item.inventoryMaterialCode ? (
                      <div className="inline-block text-right bg-slate-50 p-2 rounded border border-slate-200">
                        <div className="flex items-center gap-1">
                          <Package className="w-3 h-3 text-indigo-600" />
                          <span className="text-sm tabular-nums font-bold text-indigo-900">
                            {formatText(item.inventoryMaterialCode)}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 block">
                          مصرف انبار: {formatDecimal(item.inventoryConsumedQty)} {formatText(item.unit)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Inventory & Warehouse Integration Banner */}
      <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-sm text-indigo-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-600 shrink-0" />
          <div>
            <h4 className="font-bold">نقطه اتصال به ماژول انبار کارگاه</h4>
            <p className="text-sm text-indigo-800 mt-1">
              مقادیر مصالح مصرفی کارگاه (آهن‌آلات، بتن، سیمان و تجهیزات) به صورت بلادرنگ با مقادیر اجراشده در صورت‌وضعیت مطابقت داده می‌شود تا از پرت مصالح جلوگیری شود.
            </p>
          </div>
        </div>
        <span className="px-2 py-1 rounded bg-indigo-200/80 text-indigo-950 text-xs font-bold shrink-0">
          تطبیق کارکرد با حواله خروج انبار
        </span>
      </div>
    </div>
  );
};
