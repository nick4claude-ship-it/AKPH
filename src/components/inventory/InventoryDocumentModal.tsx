/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GoodsReceiptNote, StoreIssueVoucher } from '../../types';
import {
  X,
  Printer,
  FileText,
  Scale,
  ShieldCheck,
  Building,
  Truck,
  User,
  CheckCircle2,
} from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { formatMoney, moneyUnitLabel } from '../../utils/money';

interface InventoryDocumentModalProps {
  receipt: GoodsReceiptNote | null;
  issue: StoreIssueVoucher | null;
  onClose: () => void;
  /** Warehouse operations on the document (reservation, confirmation, returns). */
  onConfirmIssue?: (issueId: string) => void;
  onReleaseIssue?: (issueId: string) => void;
  onReturnFromProject?: (issueId: string, materialId: string, qty: number, reason: string) => void;
  onReturnToSupplier?: (grnId: string, materialId: string, qty: number, reason: string) => void;
}

export const InventoryDocumentModal: React.FC<InventoryDocumentModalProps> = ({
  receipt,
  issue,
  onClose,
  onConfirmIssue,
  onReleaseIssue,
  onReturnFromProject,
  onReturnToSupplier,
}) => {
  const [returnMaterialId, setReturnMaterialId] = useState('');
  const [returnQty, setReturnQty] = useState('');
  const [returnReason, setReturnReason] = useState('');
  if (!receipt && !issue) return null;
  const lines = receipt ? receipt.items.map((i) => ({ id: i.materialId, name: i.materialName, qty: i.acceptedQty })) : issue!.items.map((i) => ({ id: i.materialId, name: i.materialName, qty: i.issuedQty }));
  const canReturn = receipt ? Boolean(onReturnToSupplier) : issue?.status === 'خروج قطعی از انبار' && Boolean(onReturnFromProject);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog onClose={onClose} label="جزئیات سند انبار" overlayClassName="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto" className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
      
        {/* Top Control Bar */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>پیش‌نمایش سند رسمی انبارداری سازه گستران پارس</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ فرم اداری</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Warehouse operations */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center gap-2 text-xs no-print">
          {issue && issue.status !== 'خروج قطعی از انبار' && (
            <>
              <span className="text-amber-700 font-bold">کالای این حواله رزرو شده است.</span>
              <button onClick={() => onConfirmIssue?.(issue.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer">
                تأیید خروج و ثبت هزینه پروژه
              </button>
              <button onClick={() => onReleaseIssue?.(issue.id)} className="px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer">
                لغو و آزادسازی رزرو
              </button>
            </>
          )}
          {canReturn && (
            <>
              <span className="font-bold text-slate-700">{receipt ? 'برگشت به تأمین‌کننده:' : 'برگشت کالا از پروژه به انبار:'}</span>
              <select value={returnMaterialId} onChange={(e) => setReturnMaterialId(e.target.value)} className="p-1.5 rounded border border-slate-300">
                <option value="">— کالا —</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.qty.toLocaleString('fa-IR')})
                  </option>
                ))}
              </select>
              <input value={returnQty} onChange={(e) => setReturnQty(e.target.value.replace(/[^\d.]/g, ''))} placeholder="مقدار" className="w-20 p-1.5 rounded border border-slate-300 font-mono" />
              <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="علت" className="w-40 p-1.5 rounded border border-slate-300" />
              <button
                disabled={!returnMaterialId || !Number(returnQty)}
                onClick={() => {
                  const why = returnReason || (receipt ? 'مغایرت کیفی' : 'مازاد مصرف');
                  if (receipt) onReturnToSupplier?.(receipt.id, returnMaterialId, Number(returnQty), why);
                  else onReturnFromProject?.(issue!.id, returnMaterialId, Number(returnQty), why);
                  setReturnQty('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold disabled:opacity-40 cursor-pointer"
              >
                ثبت برگشت
              </button>
            </>
          )}
        </div>

        {/* Printable Official Document Body */}
        <div className="p-8 overflow-y-auto space-y-6 text-xs text-slate-800 bg-white">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
            <div className="text-right">
              <h1 className="text-base font-black text-slate-900">
                شرکت سازه گستران پارس (سهامی خاص)
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                سامانه مکانیزه انبارداری، مدیریت مصالح و زنجیره تأمین پروژه‌ها
              </p>
            </div>

            <div className="text-center">
              <h2 className="text-sm font-black text-slate-900 px-4 py-1 border-2 border-slate-900 rounded-lg">
                {receipt ? 'قبض رسید ورود کالا و انبار (GRN)' : 'حواله خروج و مصرف کارگاهی کالا (SIV)'}
              </h2>
            </div>

            <div className="text-left space-y-1 font-mono text-[11px]">
              <div>
                <span className="text-slate-500">شماره سند: </span>
                <span className="font-bold">{receipt ? receipt.receiptNumber : issue?.issueNumber}</span>
              </div>
              <div>
                <span className="text-slate-500">تاریخ: </span>
                <span className="font-bold">{receipt ? receipt.date : issue?.date}</span>
              </div>
              <div>
                <span className="text-slate-500">سند مالی: </span>
                <span className="font-bold text-emerald-700">
                  {receipt ? receipt.accountingJournalEntryId : issue?.accountingJournalEntryId || 'ثبت شده'}
                </span>
              </div>
            </div>
          </div>

          {/* Receipt Details */}
          {receipt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">پروژه مقصد:</span>
                  <span className="font-bold">{receipt.projectName}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">انبار:</span>
                  <span className="font-bold">{receipt.warehouseName}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">تأمین‌کننده:</span>
                  <span className="font-bold">{receipt.supplierName}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">فاکتور / بارنامه:</span>
                  <span className="font-bold font-mono">{receipt.invoiceNumber} / {receipt.waybillNumber}</span>
                </div>
              </div>

              {/* Weighbridge & QC box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-slate-600" />
                    اطلاعات توزین و باسکول
                  </span>
                  <div className="flex justify-between text-[11px] text-slate-600 pt-1">
                    <span>وزن ناخالص: {receipt.grossWeightKg?.toLocaleString('fa-IR') || '—'} kg</span>
                    <span>وزن طاره: {receipt.tareWeightKg?.toLocaleString('fa-IR') || '—'} kg</span>
                    <span className="font-bold text-emerald-700">خالص: {receipt.netWeightKg?.toLocaleString('fa-IR') || '—'} kg</span>
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1">
                    راننده: {receipt.driverName} ({receipt.truckPlateNumber})
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    تأییدیه کیفی و بازرسی مهندسی
                  </span>
                  <div className="flex justify-between text-[11px] pt-1">
                    <span>وضعیت: <strong>{receipt.qcApprovalStatus}</strong></span>
                    <span>ناظر: {receipt.qcInspectorName}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 pt-1 leading-relaxed">
                    گزارش: {receipt.qcNotes}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="border border-slate-300 p-2">ردیف</th>
                    <th className="border border-slate-300 p-2 text-right">کد و شرح کالا</th>
                    <th className="border border-slate-300 p-2">واحد</th>
                    <th className="border border-slate-300 p-2">مقدار تحویلی</th>
                    <th className="border border-slate-300 p-2 text-left">نرخ واحد ({moneyUnitLabel()})</th>
                    <th className="border border-slate-300 p-2 text-left">مبلغ کل ({moneyUnitLabel()})</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item, i) => (
                    <tr key={`${item.materialId}-${i}`}>
                      <td className="border border-slate-300 p-2 text-center font-mono">{i + 1}</td>
                      <td className="border border-slate-300 p-2 font-bold">{item.materialName}</td>
                      <td className="border border-slate-300 p-2 text-center">{item.unit}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono font-bold">
                        {item.acceptedQty.toLocaleString('fa-IR')}
                      </td>
                      <td className="border border-slate-300 p-2 text-left font-mono">
                        {formatMoney(item.unitPrice, false)}
                      </td>
                      <td className="border border-slate-300 p-2 text-left font-mono font-bold">
                        {formatMoney(item.totalPrice, false)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={5} className="border border-slate-300 p-2 text-left">
                      جمع کل رسید انبار:
                    </td>
                    <td className="border border-slate-300 p-2 text-left font-mono font-black text-emerald-800">
                      {formatMoney(receipt.totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Issue Details */}
          {issue && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">پروژه:</span>
                  <span className="font-bold">{issue.projectName}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">انبار مبدأ:</span>
                  <span className="font-bold">{issue.warehouseName}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">مرکز هزینه (Cost Center):</span>
                  <span className="font-bold">{issue.costCenter}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">بخش WBS:</span>
                  <span className="font-bold">{issue.wbsSection}</span>
                </div>
              </div>

              {/* Subcontractor Assignment */}
              <div className="p-3 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">پیمانکار جزء / تحویل‌گیرنده:</span>
                  <span className="font-bold text-slate-900">
                    {issue.subcontractorName || 'پرسنل مستقیم شرکت'}
                  </span>
                  {issue.receivedByCrewLeaderName && (
                    <span className="text-[11px] text-slate-500 block">
                      تحویل به: {issue.receivedByCrewLeaderName}
                    </span>
                  )}
                </div>

                {issue.isSubcontractorContra && (
                  <div className="text-left bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                    <span className="text-amber-800 font-bold block text-[11px]">
                      مشمول تهاتر با صورت‌وضعیت پیمانکار جزء
                    </span>
                    <span className="text-[10px] text-amber-700 block">
                      {issue.subcontractorStatementDeductionRef}
                    </span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="border border-slate-300 p-2">ردیف</th>
                    <th className="border border-slate-300 p-2 text-right">کد و شرح مصالح</th>
                    <th className="border border-slate-300 p-2">واحد</th>
                    <th className="border border-slate-300 p-2">مقدار مصرف</th>
                    <th className="border border-slate-300 p-2 text-left">بهای واحد ({moneyUnitLabel()})</th>
                    <th className="border border-slate-300 p-2 text-left">هزینه کل ({moneyUnitLabel()})</th>
                  </tr>
                </thead>
                <tbody>
                  {issue.items.map((item, i) => (
                    <tr key={`${item.materialId}-${i}`}>
                      <td className="border border-slate-300 p-2 text-center font-mono">{i + 1}</td>
                      <td className="border border-slate-300 p-2 font-bold">{item.materialName}</td>
                      <td className="border border-slate-300 p-2 text-center">{item.unit}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono font-bold">
                        {item.issuedQty.toLocaleString('fa-IR')}
                      </td>
                      <td className="border border-slate-300 p-2 text-left font-mono">
                        {formatMoney(item.unitCost, false)}
                      </td>
                      <td className="border border-slate-300 p-2 text-left font-mono font-bold">
                        {formatMoney(item.totalCost, false)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={5} className="border border-slate-300 p-2 text-left">
                      جمع کل حواله مصرف کارگاه:
                    </td>
                    <td className="border border-slate-300 p-2 text-left font-mono font-black text-amber-800">
                      {formatMoney(issue.totalCost)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Signatures Footer */}
          <div className="pt-8 grid grid-cols-4 gap-4 text-center text-xs">
            <div className="space-y-8">
              <span className="font-bold text-slate-700 block">تحویل‌دهنده (انباردار)</span>
              <span className="text-slate-500 text-[11px] block">
                {receipt ? receipt.receiverName : issue?.dispatchedByKeeperName}
              </span>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-slate-700 block">
                {receipt ? 'کنترل کیفی و ناظر سازه' : 'تحویل‌گیرنده کارگاه'}
              </span>
              <span className="text-slate-500 text-[11px] block">
                {receipt ? receipt.qcInspectorName : issue?.receivedByCrewLeaderName}
              </span>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-slate-700 block">مدیر پروژه / کارگاه</span>
              <span className="text-slate-500 text-[11px] block">
                {issue?.approvedByManagerName || 'مهندس کیارش نادری'}
              </span>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-slate-700 block">تأیید حسابداری و مالی</span>
              <span className="text-slate-500 text-[11px] block">دکتر هادی صمدیان</span>
            </div>
          </div>
        </div>
      </Dialog>
  );
};
