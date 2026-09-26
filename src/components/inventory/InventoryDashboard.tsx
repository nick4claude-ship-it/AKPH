/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Warehouse,
  MaterialItem,
  GoodsReceiptNote,
  StoreIssueVoucher,
  InterWarehouseTransfer,
  StocktakeAudit,
  Project,
  UserProfile,
  InventorySubTab,
} from '../../types';
import {
  Warehouse as WarehouseIcon,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  Plus,
  Scale,
  Truck,
  ArrowRightLeft,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Building,
  Layers,
  Search,
  PackageCheck,
} from 'lucide-react';
import { formatInt, formatMoney, formatMoneyCompact, moneyUnitLabel } from '../../utils/money';
import { formatPercent, formatDecimal, formatText } from '../../utils/formatters';
import { selectInventoryDashboard } from '../../store/views/inventory';
import { Money } from '../common/Money';
import { PageHeader } from '../common/PageHeader';

interface InventoryDashboardProps {
  warehouses: Warehouse[];
  materials: MaterialItem[];
  receipts: GoodsReceiptNote[];
  issues: StoreIssueVoucher[];
  transfers: InterWarehouseTransfer[];
  stocktakes: StocktakeAudit[];
  projects: Project[];
  currentUser: UserProfile;
  onNavigateTab: (tab: InventorySubTab) => void;
  onOpenNewReceipt: () => void;
  onOpenNewIssue: () => void;
  onOpenNewTransfer: () => void;
  onOpenNewMaterial: () => void;
  onSelectReceipt: (receipt: GoodsReceiptNote) => void;
  onSelectIssue: (issue: StoreIssueVoucher) => void;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({
  warehouses,
  materials,
  receipts,
  issues,
  transfers,
  stocktakes,
  projects,
  currentUser,
  onNavigateTab,
  onOpenNewReceipt,
  onOpenNewIssue,
  onOpenNewTransfer,
  onOpenNewMaterial,
  onSelectReceipt,
  onSelectIssue,
}) => {
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('all');

  // Figures of the dashboard (store view model).
  const dash = useMemo(
    () => selectInventoryDashboard(warehouses, materials, receipts, issues, transfers),
    [warehouses, materials, receipts, issues, transfers]
  );
  const { totalInventoryValuation, criticalItems, severelyLowItems, totalReceiptsValue, totalIssuesValue, subcontractorContraValue, inTransitTransfers } = dash;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <PageHeader
        icon={PackageCheck}
        title="انبارداری و کنترل مصالح"
        description="ورود مصالح، حواله‌های مصرف پیمانکاران جزء، باسکول و آزمایشگاه، و اتصال به بهای تمام‌شده پروژه‌ها."
        actions={
          <>
          <button
            onClick={onOpenNewReceipt}
            className="btn btn-primary"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>رسید ورود کالا</span>
          </button>

          <button
            onClick={onOpenNewIssue}
            className="btn btn-secondary"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>حواله خروج کارگاه</span>
          </button>

          <button
            onClick={onOpenNewTransfer}
            className="btn btn-secondary"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>انتقال بین کارگاه‌ها</span>
          </button>

          <button
            onClick={onOpenNewMaterial}
            className="btn btn-secondary"
            title="تعریف کدینگ متریال جدید"
          >
            <Plus className="w-4 h-4" />
          </button>
        </>
        }
      />

      {/* KPI Cards (8 Key Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Valuation */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">ارزش کل موجودی انبارها</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <WarehouseIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              <Money rial={totalInventoryValuation} compact />
            </span>
                      </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>تعداد اقلام کاتالوگ: {formatInt(materials.length)} قلم</span>
            <span className="text-blue-600 font-bold">ارزیابی بر مبنای میانگین</span>
          </div>
        </div>

        {/* KPI 2: Receipts this period */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">ورود مصالح و رسید انبار</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700">
              <Money rial={totalReceiptsValue} compact />
            </span>
                      </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{formatInt(receipts.length)} پارت بارنامه و باسکول</span>
            <span className="text-emerald-700 font-bold">{formatPercent(receipts.length ? (receipts.filter((r) => r.qcApprovalStatus === 'تأیید کامل').length / receipts.length) * 100 : 0)} تأیید کامل QC</span>
          </div>
        </div>

        {/* KPI 3: Issues & Consumptions */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">مصرف کارگاهی و حواله خروج</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              <Money rial={totalIssuesValue} compact />
            </span>
                      </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>تهاتر پیمانکاران جزء: {formatMoneyCompact(subcontractorContraValue)}</span>
            <span className="text-amber-700 font-bold">ثبت در بهای تمام‌شده</span>
          </div>
        </div>

        {/* KPI 4: Critical & Reorder Point Alerts */}
        <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-2xs bg-rose-50/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-rose-700">هشدار کسری و نقطه سفارش</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-700">
              {formatInt(criticalItems.length)}
            </span>
            <span className="text-sm text-rose-700 font-bold">قلم زیر حد مجاز</span>
          </div>
          <div className="mt-2 pt-2 border-t border-rose-200/60 flex items-center justify-between text-sm text-rose-700">
            <span>{formatInt(severelyLowItems.length)} قلم در وضعیت بحرانی فوری</span>
            <button
              onClick={() => onNavigateTab('items')}
              className="font-bold underline hover:text-rose-900 cursor-pointer"
            >
              مشاهده و استعلام خرید
            </button>
          </div>
        </div>
      </div>

      {/* Critical Stock Alert Banner if any items are under minimum */}
      {criticalItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-amber-950">
                اقلام نیازمند اقدام فوری تدارکات و خرید مصالح پایه‌ای
              </h4>
              <p className="text-sm text-amber-800 mt-1">
                موجودی {formatText(criticalItems.map((i) => i.name.split('-')[0]).join('، '))} به زیر حداقل مجاز کارگاه رسیده است.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={() => onNavigateTab('items')}
              className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-slate-950 text-sm font-bold transition-all cursor-pointer"
            >
              بررسی اقلام بحرانی و صدور PR
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Warehouses Status + Recent Movement Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Warehouses Snapshot */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <WarehouseIcon className="w-4 h-4 text-indigo-600" />
                  وضعیت انبارهای کارگاهی و باراندازها
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  ارزش ریالی، مسئولین انبار و سطح ظرفیت دپوی مصالح در سایت پروژه‌ها
                </p>
              </div>

              <button
                onClick={() => onNavigateTab('warehouses')}
                className="text-sm text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                مشاهده همه انبارها ←
              </button>
            </div>

            {/* Warehouse Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {warehouses.map((wh) => (
                <div
                  key={wh.id}
                  className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition-all bg-slate-50/50"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-200 text-slate-700">
                        {formatText(wh.code)} · {formatText(wh.type)}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 mt-2">{formatText(wh.name)}</h4>
                      <span className="text-xs text-slate-500 block truncate">{formatText(wh.projectName)}</span>
                    </div>

                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
                      {formatText(wh.status)}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-sm">
                    <div>
                      <span className="text-xs text-slate-500 block">ارزش موجودی</span>
                      <span className="font-bold text-slate-900">
                        <Money rial={wh.totalValuation} compact />
                      </span>
                    </div>

                    <div className="text-left">
                      <span className="text-xs text-slate-500 block">انباردار مسئول</span>
                      <span className="text-sm text-slate-700 font-medium">{formatText(wh.keeperName)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Goods Receipts Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
                  آخرین قبوض ورود و رسیدهای انبار
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  تطبیق بارنامه، وزن باسکول، آزمایشگاه و سرتیفیکیت کارخانه
                </p>
              </div>

              <button
                onClick={() => onNavigateTab('receipts')}
                className="text-sm text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                مشاهده همه رسیدها ←
              </button>
            </div>

            <div className="table-scroll">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs">
                    <th className="pb-2 font-medium">شماره رسید</th>
                    <th className="pb-2 font-medium">پروژه / انبار</th>
                    <th className="pb-2 font-medium">تأمین‌کننده / راننده</th>
                    <th className="pb-2 font-medium">وزن خالص باسکول</th>
                    <th className="pb-2 font-medium">تأییدیه کیفی QC</th>
                    <th className="pb-2 font-medium text-left">مبلغ کل ({moneyUnitLabel()})</th>
                    <th className="pb-2 font-medium text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipts.slice(0, 4).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 font-bold text-slate-900">
                        {formatText(r.receiptNumber)}
                        <span className="text-xs text-slate-500 block font-normal">{formatText(r.date)}</span>
                      </td>

                      <td className="py-3">
                        <span className="font-medium text-slate-800 block">{formatText(r.projectName)}</span>
                        <span className="text-xs text-slate-500">{formatText(r.warehouseName)}</span>
                      </td>

                      <td className="py-3">
                        <span className="font-bold text-slate-800 block">{formatText(r.supplierName)}</span>
                        <span className="text-xs text-slate-500">
                          {formatText(r.driverName)} ({r.truckPlateNumber})
                        </span>
                      </td>

                      <td className="py-3 font-medium text-slate-700">
                        {r.netWeightKg ? (
                          <span className="flex items-center gap-1 tabular-nums">
                            <Scale className="w-3 h-3 text-slate-500" />
                            {formatDecimal(r.netWeightKg)} kg
                          </span>
                        ) : (
                          <span className="text-slate-500">تعدادی/کیسه‌ای</span>
                        )}
                      </td>

                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                            r.qcApprovalStatus === 'تأیید کامل'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          {formatText(r.qcApprovalStatus)}
                        </span>
                      </td>

                      <td className="py-3 text-left font-bold text-slate-900 tabular-nums">
                        {formatMoney(r.totalAmount, false)}
                      </td>

                      <td className="py-3 text-center">
                        <button
                          onClick={() => onSelectReceipt(r)}
                          className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-colors cursor-pointer"
                        >
                          بررسی سند
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Store Issues, Subcontractor Contra & Transfers */}
        <div className="space-y-4">
          {/* Subcontractor Material Contra Widget (ویجت تهاتر مصالح پای کار) */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white rounded-xl border border-amber-300 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-amber-950">
                تهاتر مصالح مصرفی با صورت‌وضعیت‌ها
              </h4>
            </div>
            <p className="text-sm text-amber-800 leading-relaxed">
              مصالح تحویل‌شده به اکیپ‌های پیمانکار جزء که از صورت‌وضعیت بعدی آن‌ها کسر می‌شود:
            </p>
            <div className="mt-3 p-3 bg-white/80 rounded-xl border border-amber-200 flex items-center justify-between">
              <span className="text-sm text-slate-600 font-medium">مجموع مصالح تهاتری دوره:</span>
              <span className="text-sm font-bold text-amber-700 tabular-nums">
                <Money rial={subcontractorContraValue} compact />
              </span>
            </div>
            <div className="mt-2 text-sm text-amber-900 flex items-center justify-between">
              <span>تعداد حواله‌های امانی و تهاتری: {formatInt(issues.filter((i) => i.isSubcontractorContra).length)} سند</span>
              <button
                onClick={() => onNavigateTab('issues')}
                className="font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer"
              >
                مشاهده حواله‌ها
              </button>
            </div>
          </div>

          {/* In-Transit Transfers Widget */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                انتقالات در حال حمل بین کارگاه‌ها
              </h4>
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                {formatInt(inTransitTransfers.length)} محموله
              </span>
            </div>

            {inTransitTransfers.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">محموله فعالی در مسیر حمل وجود ندارد.</p>
            ) : (
              <div className="space-y-2.5">
                {inTransitTransfers.map((t) => (
                  <div key={t.id} className="p-2 rounded-xl border border-indigo-100 bg-indigo-50/30 text-sm">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>{formatText(t.transferNumber)}</span>
                      <span className="text-sm text-indigo-600 tabular-nums">{formatText(t.waybillNumber)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                      <span>از: {t.sourceWarehouseName.split(' ')[2] || 'مبدأ'}</span>
                      <span className="text-slate-500">←</span>
                      <span>به: {t.targetWarehouseName.split(' ')[2] || 'مقصد'}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
                      <span>راننده: {formatText(t.driverName)} ({t.truckPlate})</span>
                      <span className="font-bold text-indigo-700"><Money rial={t.totalCost} compact /></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4">
            <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              ابزارهای تحلیلی و مدیریتی انبارداری
            </h4>
            <div className="space-y-2 text-sm">
              <button
                onClick={() => onNavigateTab('kardex')}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer text-right"
              >
                <span>کاردکس مقداری و ریالی کالا</span>
                <span className="text-slate-500 text-xs">رهگیری تراکنش‌ها ←</span>
              </button>

              <button
                onClick={() => onNavigateTab('stocktake')}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer text-right"
              >
                <span>انبارگردانی و مغایرت‌گیری</span>
                <span className="text-slate-500 text-xs">تعدیل موجودی ←</span>
              </button>

              <button
                onClick={() => onNavigateTab('items')}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer text-right"
              >
                <span>کاتالوگ استاندارد مصالح و کالاها</span>
                <span className="text-slate-500 text-xs">{formatInt(materials.length)} قلم ←</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
