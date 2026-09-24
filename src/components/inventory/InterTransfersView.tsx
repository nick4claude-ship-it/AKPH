/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  InterWarehouseTransfer,
  Warehouse,
  Project,
  UserProfile,
} from '../../types';
import {
  ArrowRightLeft,
  Search,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  Building,
} from 'lucide-react';
import { formatMoney, moneyUnitLabel } from '../../utils/money';

interface InterTransfersViewProps {
  transfers: InterWarehouseTransfer[];
  warehouses: Warehouse[];
  projects: Project[];
  currentUser: UserProfile;
  onOpenNewTransfer: () => void;
  onUpdateTransferStatus: (transferId: string, newStatus: InterWarehouseTransfer['status']) => void;
}

export const InterTransfersView: React.FC<InterTransfersViewProps> = ({
  transfers,
  warehouses,
  projects,
  currentUser,
  onOpenNewTransfer,
  onUpdateTransferStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransfers = transfers.filter((t) => {
    return (
      t.transferNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.waybillNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sourceWarehouseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.targetWarehouseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.driverName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header and Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              انتقال بین کارگاهی مصالح و ماشین‌آلات (Inter-Site Transfers)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              جابجایی اقلام مازاد و مصالح مشترک میان انبار مرکزی و ۵ کارگاه اجرایی فعال شرکت
            </p>
          </div>

          <button
            onClick={onOpenNewTransfer}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>صدور حواله انتقال جدید</span>
          </button>
        </div>

        {/* Search */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو با شماره انتقال، بارنامه، انبار مبدأ یا مقصد..."
              className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50/50"
            />
          </div>

          <span className="text-xs text-slate-500 font-medium">
            تعداد حواله‌های ثبت‌شده: {filteredTransfers.length.toLocaleString('fa-IR')} مورد
          </span>
        </div>
      </div>

      {/* Transfers Cards Grid */}
      <div className="space-y-3.5">
        {filteredTransfers.map((t) => (
          <div
            key={t.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-indigo-200 transition-all"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-900">{t.transferNumber}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">({t.date})</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                      بارنامه: {t.waybillNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    مجوز صادرکننده: <span className="text-slate-800 font-medium">{t.authorizedBy}</span>
                  </p>
                </div>
              </div>

              {/* Status Badge and Workflow Action */}
              <div className="flex items-center gap-2 self-end md:self-center">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    t.status === 'تخلیه و تحویل قطعی مقصد'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : t.status === 'در مسیر حمل'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {t.status === 'تخلیه و تحویل قطعی مقصد' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  {t.status}
                </span>

                {t.status === 'در مسیر حمل' && (
                  <button
                    onClick={() => onUpdateTransferStatus(t.id, 'تخلیه و تحویل قطعی مقصد')}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    تأیید وصول در مقصد
                  </button>
                )}
              </div>
            </div>

            {/* Source to Target Route Bar */}
            <div className="my-4 p-3 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-center">
              <div>
                <span className="text-[10px] text-slate-400 block">انبار مبدأ</span>
                <span className="font-bold text-slate-800 block">{t.sourceWarehouseName}</span>
                <span className="text-[11px] text-slate-500">{t.sourceProjectId}</span>
              </div>

              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-indigo-600 font-bold mb-1">
                  ناوگان حمل: {t.driverName} ({t.truckPlate})
                </span>
                <div className="w-full flex items-center gap-2">
                  <div className="h-0.5 flex-1 bg-indigo-200" />
                  <Truck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div className="h-0.5 flex-1 bg-indigo-200" />
                </div>
              </div>

              <div className="text-left">
                <span className="text-[10px] text-slate-400 block">انبار مقصد</span>
                <span className="font-bold text-slate-800 block">{t.targetWarehouseName}</span>
                <span className="text-[11px] text-slate-500">{t.targetProjectId}</span>
              </div>
            </div>

            {/* Items Included */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[11px]">
                    <th className="pb-1.5 font-medium">کد و نام متریال</th>
                    <th className="pb-1.5 font-medium">مقدار جابجایی</th>
                    <th className="pb-1.5 font-medium text-left">نرخ واحد ({moneyUnitLabel()})</th>
                    <th className="pb-1.5 font-medium text-left">ارزش محموله ({moneyUnitLabel()})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {t.items.map((item, idx) => (
                    <tr key={`${item.materialId}-${idx}`}>
                      <td className="py-2">
                        <span className="font-bold text-slate-800 block">{item.materialName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{item.materialCode}</span>
                      </td>
                      <td className="py-2 font-mono font-bold text-slate-800">
                        {item.quantity.toLocaleString('fa-IR')} {item.unit}
                      </td>
                      <td className="py-2 text-left font-mono text-slate-600">
                        {formatMoney(item.unitCost, false)}
                      </td>
                      <td className="py-2 text-left font-mono font-bold text-slate-900">
                        {formatMoney(item.totalCost, false)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">انتقال طبق استاندارد انبارداری دوطرفه بدون ایجاد سود/زیان</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">ارزش کل انتقال:</span>
                <span className="font-black text-indigo-700 font-mono text-sm">
                  {formatMoney(t.totalCost)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
