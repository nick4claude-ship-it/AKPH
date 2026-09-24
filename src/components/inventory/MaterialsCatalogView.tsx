/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  MaterialItem,
  MaterialCategory,
  UserProfile,
} from '../../types';
import {
  Package,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { formatMoney, formatMoneyCompact, moneyUnitLabel } from '../../utils/money';

interface MaterialsCatalogViewProps {
  materials: MaterialItem[];
  currentUser: UserProfile;
  onOpenNewMaterial: () => void;
  onViewKardex: (materialId: string) => void;
}

const CATEGORIES: { id: MaterialCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'همه دسته‌ها' },
  { id: 'آهن‌آلات و میلگرد', label: 'آهن‌آلات و میلگرد' },
  { id: 'سیمان، بتن و فرآورده‌های بتنی', label: 'سیمان و بتن' },
  { id: 'مصالح سفت‌کاری و بنایی', label: 'سفت‌کاری و بنایی' },
  { id: 'تأسیسات مکانیکی و لوله‌کشی', label: 'تأسیسات مکانیکی' },
  { id: 'تأسیسات الکتریکی و کابل', label: 'تأسیسات برقی' },
  { id: 'عایق، رنگ و شیمیایی ساختمان', label: 'عایق و مواد شیمیایی' },
  { id: 'ابزارآلات و تجهیزات قالب‌بندی', label: 'قالب‌بندی و ابزار' },
  { id: 'تجهیز کارگاه و HSE', label: 'ایمنی و HSE' },
];

export const MaterialsCatalogView: React.FC<MaterialsCatalogViewProps> = ({
  materials,
  currentUser,
  onOpenNewMaterial,
  onViewKardex,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'all'>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'critical' | 'normal'>('all');

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.specifications.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = selectedCategory === 'all' || m.category === selectedCategory;

      const isCritical = m.currentStock <= m.reorderLevel;
      const matchStockStatus =
        stockStatusFilter === 'all' ||
        (stockStatusFilter === 'critical' && isCritical) ||
        (stockStatusFilter === 'normal' && !isCritical);

      return matchSearch && matchCategory && matchStockStatus;
    });
  }, [materials, searchQuery, selectedCategory, stockStatusFilter]);

  const totalCatalogValue = useMemo(() => {
    return filteredMaterials.reduce((s, m) => s + m.totalStockValue, 0);
  }, [filteredMaterials]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header and Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600" />
              کاتالوگ جامع کالا، مصالح و متریال ساختمانی
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              مدیریت کدینگ کالا، کنترل حداقل موجودی و نقطه سفارش، و ارزیابی ریالی دپوی کارگاه‌ها
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={onOpenNewMaterial}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف متریال جدید</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو بر اساس نام مصالح، کد کالا یا مشخصات..."
              className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50/50"
            />
          </div>

          {/* Stock Level Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStockStatusFilter('all')}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                stockStatusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه موجودی‌ها
            </button>
            <button
              onClick={() => setStockStatusFilter('critical')}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                stockStatusFilter === 'critical'
                  ? 'bg-rose-500 text-white shadow-2xs font-bold'
                  : 'text-rose-600 hover:text-rose-700'
              }`}
            >
              نقطه سفارش و کسری
            </button>
            <button
              onClick={() => setStockStatusFilter('normal')}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                stockStatusFilter === 'normal'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              موجودی ایمن
            </button>
          </div>

          {/* Summary Metric */}
          <div className="flex items-center justify-end px-3 py-1 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
            <div className="text-left">
              <span className="text-[10px] text-slate-400 block">ارزش فیلترشده</span>
              <span className="font-bold text-slate-900 font-mono">
                {formatMoneyCompact(totalCatalogValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white font-bold shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Materials List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px]">
                <th className="p-3.5 font-bold">کد و عنوان مصالح</th>
                <th className="p-3.5 font-bold">دسته‌بندی</th>
                <th className="p-3.5 font-bold">واحد سنجش</th>
                <th className="p-3.5 font-bold">موجودی فعلی / نقطه سفارش</th>
                <th className="p-3.5 font-bold">وضعیت موجودی</th>
                <th className="p-3.5 font-bold text-left">نرخ میانگین ({moneyUnitLabel()})</th>
                <th className="p-3.5 font-bold text-left">ارزش کل موجودی</th>
                <th className="p-3.5 font-bold text-center">عملیات کاردکس</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMaterials.map((mat) => {
                const isUnderSafety = mat.currentStock <= mat.minSafetyStock;
                const isUnderReorder = mat.currentStock <= mat.reorderLevel;
                const stockPercentOfMax = Math.min(100, Math.round((mat.currentStock / mat.maxCapacity) * 100));

                return (
                  <tr key={mat.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5">
                      <span className="text-[10px] font-mono text-slate-400 block">{mat.code}</span>
                      <span className="font-bold text-slate-900 block">{mat.name}</span>
                      <span className="text-[10px] text-slate-500 block truncate max-w-xs">{mat.specifications}</span>
                    </td>

                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                        {mat.category}
                      </span>
                      {mat.standardGrade && (
                        <span className="text-[9px] text-indigo-600 block mt-0.5 font-mono">{mat.standardGrade}</span>
                      )}
                    </td>

                    <td className="p-3.5 font-medium text-slate-700">
                      {mat.unit}
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-slate-900 font-mono text-sm">
                          {mat.currentStock.toLocaleString('fa-IR')}
                        </span>
                        <span className="text-[10px] text-slate-400">/ سفارش: {mat.reorderLevel.toLocaleString('fa-IR')}</span>
                      </div>
                      {/* Mini Bar */}
                      <div className="w-28 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full ${
                            isUnderSafety ? 'bg-rose-500' : isUnderReorder ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${stockPercentOfMax}%` }}
                        />
                      </div>
                    </td>

                    <td className="p-3.5">
                      {isUnderSafety ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3" />
                          کسری بحرانی
                        </span>
                      ) : isUnderReorder ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" />
                          رسیده به نقطه سفارش
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          مطلوب و کافی
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-left font-mono font-medium text-slate-700">
                      {formatMoney(mat.averageUnitPrice, false)}
                    </td>

                    <td className="p-3.5 text-left font-mono font-bold text-slate-900">
                      {formatMoney(mat.totalStockValue, false)}
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => onViewKardex(mat.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-colors cursor-pointer"
                      >
                        کاردکس کالا
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
