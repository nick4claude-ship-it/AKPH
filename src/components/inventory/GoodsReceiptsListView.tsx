/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  GoodsReceiptNote,
  Warehouse,
  Project,
  UserProfile,
} from '../../types';
import {
  ArrowDownLeft,
  Search,
  Filter,
  Plus,
  Scale,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  AlertTriangle,
  Building,
  Truck,
} from 'lucide-react';
import { formatMoney, formatMoneyCompact, moneyUnitLabel } from '../../utils/money';
import { formatDecimal } from '../../utils/formatters';
import { sumGoodsReceipts } from '../../store/views/inventory';

interface GoodsReceiptsListViewProps {
  receipts: GoodsReceiptNote[];
  warehouses: Warehouse[];
  projects: Project[];
  currentUser: UserProfile;
  onOpenNewReceipt: () => void;
  onSelectReceipt: (receipt: GoodsReceiptNote) => void;
}

export const GoodsReceiptsListView: React.FC<GoodsReceiptsListViewProps> = ({
  receipts,
  warehouses,
  projects,
  currentUser,
  onOpenNewReceipt,
  onSelectReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      const matchSearch =
        r.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.waybillNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.projectName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchWarehouse = selectedWarehouseId === 'all' || r.warehouseId === selectedWarehouseId;
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;

      return matchSearch && matchWarehouse && matchStatus;
    });
  }, [receipts, searchQuery, selectedWarehouseId, statusFilter]);

  const totalValue = sumGoodsReceipts(filteredReceipts).totalValue;

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header & Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              قبوض ورود و رسیدهای انبارداری کارگاهی (Goods Receipt Notes - GRN)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ثبت ورود مصالح پای کار، تطبیق بارنامه و باسکول، کنترل کیفیت آزمایشگاهی و صدور سند انبار
            </p>
          </div>

          <button
            onClick={onOpenNewReceipt}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت رسید ورود جدید (GRN)</span>
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
              placeholder="جستجو با شماره رسید، فروشنده، بارنامه..."
              className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50/50"
            />
          </div>

          {/* Warehouse Dropdown */}
          <div>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50/50 cursor-pointer"
            >
              <option value="all">همه انبارها و پروژه‌ها</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50/50 cursor-pointer"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="تأیید نهایی انبارداری">تأیید نهایی انبارداری</option>
              <option value="کنترل کیفیت">کنترل کیفیت (QC)</option>
              <option value="پیش‌نویس">پیش‌نویس</option>
            </select>
          </div>

          {/* Total Filtered Metrics */}
          <div className="flex items-center justify-end px-3 py-1 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
            <div className="text-left">
              <span className="text-[10px] text-slate-400 block">جمع ارزش رسیدها</span>
              <span className="font-bold text-slate-900 font-mono">
                {formatMoneyCompact(totalValue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px]">
                <th className="p-3.5 font-bold">شماره و تاریخ رسید</th>
                <th className="p-3.5 font-bold">پروژه و انبار مقصد</th>
                <th className="p-3.5 font-bold">تأمین‌کننده و شماره فاکتور</th>
                <th className="p-3.5 font-bold">بارنامه و اطلاعات حمل</th>
                <th className="p-3.5 font-bold">باسکول و وزن خالص</th>
                <th className="p-3.5 font-bold">کنترل کیفی QC</th>
                <th className="p-3.5 font-bold">وضعیت گردش‌کار</th>
                <th className="p-3.5 font-bold text-left">مبلغ کل ({moneyUnitLabel()})</th>
                <th className="p-3.5 font-bold text-center">جزئیات / چاپ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5">
                    <span className="font-bold text-slate-900 block">{receipt.receiptNumber}</span>
                    <span className="text-[10px] text-slate-400 block">{receipt.date}</span>
                    <span className="text-[10px] text-slate-500 block">ثبت: {receipt.receiverName}</span>
                  </td>

                  <td className="p-3.5">
                    <span className="font-bold text-slate-800 block">{receipt.projectName}</span>
                    <span className="text-[10px] text-slate-500 block">{receipt.warehouseName}</span>
                  </td>

                  <td className="p-3.5">
                    <span className="font-bold text-slate-800 block">{receipt.supplierName}</span>
                    <span className="text-[10px] text-slate-500 block font-mono">فاکتور: {receipt.invoiceNumber}</span>
                  </td>

                  <td className="p-3.5">
                    <div className="flex items-center gap-1 text-[11px] text-slate-700">
                      <Truck className="w-3 h-3 text-slate-400" />
                      <span>{receipt.driverName}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block font-mono">{receipt.truckPlateNumber}</span>
                    <span className="text-[10px] text-indigo-600 block font-mono">بارنامه: {receipt.waybillNumber}</span>
                  </td>

                  <td className="p-3.5">
                    {receipt.netWeightKg ? (
                      <div>
                        <span className="font-bold text-slate-900 font-mono flex items-center gap-1">
                          <Scale className="w-3.5 h-3.5 text-slate-400" />
                          {formatDecimal(receipt.netWeightKg)} kg
                        </span>
                        <span className="text-[10px] text-slate-400 block">قبض: {receipt.weighbridgeSlipNumber}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">تحویل تعدادی/بسته‌ای</span>
                    )}
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        receipt.qcApprovalStatus === 'تأیید کامل'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : receipt.qcApprovalStatus === 'تأیید مشروط'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      {receipt.qcApprovalStatus}
                    </span>
                    {receipt.qualityCertificateNumber && (
                      <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                        {receipt.qualityCertificateNumber}
                      </span>
                    )}
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        receipt.status === 'تأیید نهایی انبارداری'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {receipt.status}
                    </span>
                    {receipt.accountingJournalEntryId && (
                      <span className="text-[9px] text-emerald-600 block mt-0.5 font-bold">
                        سند مالی: {receipt.accountingJournalEntryId}
                      </span>
                    )}
                  </td>

                  <td className="p-3.5 text-left font-mono font-bold text-slate-900">
                    {formatMoney(receipt.totalAmount, false)}
                  </td>

                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => onSelectReceipt(receipt)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-colors cursor-pointer"
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
