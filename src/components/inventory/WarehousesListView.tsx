/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Warehouse, Project, UserProfile } from '../../types';
import {
  Warehouse as WarehouseIcon,
  MapPin,
  Phone,
  User,
  Package,
  Layers,
  Building,
  CheckCircle2,
} from 'lucide-react';

interface WarehousesListViewProps {
  warehouses: Warehouse[];
  projects: Project[];
  currentUser: UserProfile;
}

export const WarehousesListView: React.FC<WarehousesListViewProps> = ({
  warehouses,
  projects,
  currentUser,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <WarehouseIcon className="w-4 h-4 text-indigo-600" />
              شبکه انبارهای مرکزی و کارگاهی سازه گستران پارس
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              مدیریت فیزیکی انبارها، باراندازهای تخلیه، سرپرستان انبار و کنترل ظرفیت دپوی مصالح
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>تعداد کل انبارها: <strong className="text-slate-800">{warehouses.length.toLocaleString('fa-IR')} انبار</strong></span>
          </div>
        </div>
      </div>

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map((wh) => (
          <div
            key={wh.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between"
          >
            <div>
              {/* Header Badge */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <WarehouseIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                      {wh.code} · انبار {wh.type}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 mt-0.5">{wh.name}</h4>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {wh.status}
                </span>
              </div>

              {/* Project Reference */}
              <div className="mb-3 text-xs">
                <span className="text-slate-400 text-[11px] block">پروژه تحت پوشش:</span>
                <span className="font-bold text-slate-800">{wh.projectName}</span>
              </div>

              {/* Location & Details */}
              <div className="space-y-2 text-xs text-slate-600 mb-4">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-relaxed">{wh.location}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[11px]">سرپرست انبار: <strong className="text-slate-800">{wh.keeperName}</strong></span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[11px] font-mono">{wh.phone}</span>
                </div>
              </div>
            </div>

            {/* Bottom Stats */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl text-center">
                <span className="text-[10px] text-slate-400 block">مساحت بارانداز</span>
                <span className="font-bold text-slate-800 font-mono">{wh.areaM2.toLocaleString('fa-IR')} مترمربع</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl text-center">
                <span className="text-[10px] text-slate-400 block">ارزش کل موجودی</span>
                <span className="font-bold text-indigo-700 font-mono">
                  {(wh.totalValuation / 1_000_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} م.ت
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
