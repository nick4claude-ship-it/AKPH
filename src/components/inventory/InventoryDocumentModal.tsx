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
import { Dialog } from '../../ui/Dialog';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { useCompany } from '../../store/session';
import { formatDecimal, formatText } from '../../utils/formatters';
import { Money } from '../common/Money';

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
  const company = useCompany();
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
    <Dialog onClose={onClose} label="جزئیات سند انبار" overlayClassName="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto" className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
      
        {/* Top Control Bar */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>پیش‌نمایش سند رسمی انبارداری {formatText(company.name)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn btn-primary"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ فرم اداری</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Warehouse operations */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center gap-2 text-sm no-print">
          {issue && issue.status !== 'خروج قطعی از انبار' && (
            <>
              <span className="text-amber-700 font-bold">کالای این حواله رزرو شده است.</span>
              <button onClick={() => onConfirmIssue?.(issue.id)} className="px-3 py-2 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer">
                تأیید خروج و ثبت هزینه پروژه
              </button>
              <button onClick={() => onReleaseIssue?.(issue.id)} className="px-3 py-2 rounded-lg border border-slate-300 cursor-pointer">
                لغو و آزادسازی رزرو
              </button>
            </>
          )}
          {canReturn && (
            <>
              <span className="font-bold text-slate-700">{receipt ? 'برگشت به تأمین‌کننده:' : 'برگشت کالا از پروژه به انبار:'}</span>
              <select aria-label="کالا" value={returnMaterialId} onChange={(e) => setReturnMaterialId(e.target.value)} className="p-2 rounded border border-slate-300">
                <option value="">— کالا —</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {formatText(l.name)} ({formatDecimal(l.qty)})
                  </option>
                ))}
              </select>
              <input value={returnQty} onChange={(e) => setReturnQty(e.target.value.replace(/[^\d.]/g, ''))} placeholder="مقدار" className="w-20 p-2 rounded border border-slate-300 tabular-nums" />
              <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="علت" className="w-40 p-2 rounded border border-slate-300" />
              <button
                disabled={!returnMaterialId || !Number(returnQty)}
                onClick={() => {
                  const why = returnReason || (receipt ? 'مغایرت کیفی' : 'مازاد مصرف');
                  if (receipt) onReturnToSupplier?.(receipt.id, returnMaterialId, Number(returnQty), why);
                  else onReturnFromProject?.(issue!.id, returnMaterialId, Number(returnQty), why);
                  setReturnQty('');
                }}
                className="px-3 py-2 rounded-lg bg-slate-900 text-white font-bold disabled:opacity-40 cursor-pointer"
              >
                ثبت برگشت
              </button>
            </>
          )}
        </div>

        {/* Printable Official Document Body */}
        <div className="p-8 overflow-y-auto space-y-6 text-sm text-slate-800 bg-white">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
            <div className="text-right">
              <h1 className="text-base font-bold text-slate-900">
                {formatText(company.legalName)}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                سامانه مکانیزه انبارداری، مدیریت مصالح و زنجیره تأمین پروژه‌ها
              </p>
            </div>

            <div className="text-center">
              <h2 className="text-base font-bold text-slate-900 px-4 py-1 border-2 border-slate-900 rounded-lg">
                {receipt ? 'قبض رسید ورود کالا و انبار (GRN)' : 'حواله خروج و مصرف کارگاهی کالا (SIV)'}
              </h2>
            </div>

            <div className="text-left space-y-1 tabular-nums text-sm">
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                <div>
                  <span className="text-slate-500 text-xs block">پروژه مقصد:</span>
                  <span className="font-bold">{formatText(receipt.projectName)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">انبار:</span>
                  <span className="font-bold">{formatText(receipt.warehouseName)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">تأمین‌کننده:</span>
                  <span className="font-bold">{formatText(receipt.supplierName)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">فاکتور / بارنامه:</span>
                  <span className="font-bold tabular-nums">{formatText(receipt.invoiceNumber)} / {formatText(receipt.waybillNumber)}</span>
                </div>
              </div>

              {/* Weighbridge & QC box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-slate-600" />
                    اطلاعات توزین و باسکول
                  </span>
                  <div className="flex justify-between text-sm text-slate-600 pt-1">
                    <span>وزن ناخالص: {formatDecimal(receipt.grossWeightKg) || '—'} kg</span>
                    <span>وزن طاره: {formatDecimal(receipt.tareWeightKg) || '—'} kg</span>
                    <span className="font-bold text-emerald-700">خالص: {formatDecimal(receipt.netWeightKg) || '—'} kg</span>
                  </div>
                  <div className="text-xs text-slate-500 pt-1">
                    راننده: {formatText(receipt.driverName)} ({receipt.truckPlateNumber})
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    تأییدیه کیفی و بازرسی مهندسی
                  </span>
                  <div className="flex justify-between text-sm pt-1">
                    <span>وضعیت: <strong>{formatText(receipt.qcApprovalStatus)}</strong></span>
                    <span>ناظر: {formatText(receipt.qcInspectorName)}</span>
                  </div>
                  <p className="text-sm text-slate-600 pt-1 leading-relaxed">
                    گزارش: {formatText(receipt.qcNotes)}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="table-scroll">
                <table className="w-full border-collapse border border-slate-300 text-sm">
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
                      <td className="border border-slate-300 p-2 text-center tabular-nums">{i + 1}</td>
                      <td className="border border-slate-300 p-2 font-bold">{formatText(item.materialName)}</td>
                      <td className="border border-slate-300 p-2 text-center">{formatText(item.unit)}</td>
                      <td className="border border-slate-300 p-2 text-center tabular-nums font-bold">
                        {formatDecimal(item.acceptedQty)}
                      </td>
                      <td className="border border-slate-300 p-2 text-left tabular-nums">
                        {formatMoney(item.unitPrice, false)}
                      </td>
                      <td className="border border-slate-300 p-2 text-left tabular-nums font-bold">
                        {formatMoney(item.totalPrice, false)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={5} className="border border-slate-300 p-2 text-left">
                      جمع کل رسید انبار:
                    </td>
                    <td className="border border-slate-300 p-2 text-left tabular-nums font-bold text-emerald-800">
                      <Money rial={receipt.totalAmount} />
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Issue Details */}
          {issue && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                <div>
                  <span className="text-slate-500 text-xs block">پروژه:</span>
                  <span className="font-bold">{formatText(issue.projectName)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">انبار مبدأ:</span>
                  <span className="font-bold">{formatText(issue.warehouseName)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">مرکز هزینه:</span>
                  <span className="font-bold">{formatText(issue.costCenter)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">بخش WBS:</span>
                  <span className="font-bold">{formatText(issue.wbsSection)}</span>
                </div>
              </div>

              {/* Subcontractor Assignment */}
              <div className="p-3 border border-slate-200 rounded-xl flex items-center justify-between text-sm">
                <div>
                  <span className="text-slate-500 text-xs block">پیمانکار جزء / تحویل‌گیرنده:</span>
                  <span className="font-bold text-slate-900">
                    {formatText(issue.subcontractorName || 'پرسنل مستقیم شرکت')}
                  </span>
                  {issue.receivedByCrewLeaderName && (
                    <span className="text-xs text-slate-500 block">
                      تحویل به: {formatText(issue.receivedByCrewLeaderName)}
                    </span>
                  )}
                </div>

                {issue.isSubcontractorContra && (
                  <div className="text-left bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                    <span className="text-amber-800 font-bold block text-sm">
                      مشمول تهاتر با صورت‌وضعیت پیمانکار جزء
                    </span>
                    <span className="text-sm text-amber-700 block">
                      {formatText(issue.subcontractorStatementDeductionRef)}
                    </span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="table-scroll">
                <table className="w-full border-collapse border border-slate-300 text-sm">
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
                      <td className="border border-slate-300 p-2 text-center tabular-nums">{i + 1}</td>
                      <td className="border border-slate-300 p-2 font-bold">{formatText(item.materialName)}</td>
                      <td className="border border-slate-300 p-2 text-center">{formatText(item.unit)}</td>
                      <td className="border border-slate-300 p-2 text-center tabular-nums font-bold">
                        {formatDecimal(item.issuedQty)}
                      </td>
                      <td className="border border-slate-300 p-2 text-left tabular-nums">
                        {formatMoney(item.unitCost, false)}
                      </td>
                      <td className="border border-slate-300 p-2 text-left tabular-nums font-bold">
                        {formatMoney(item.totalCost, false)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={5} className="border border-slate-300 p-2 text-left">
                      جمع کل حواله مصرف کارگاه:
                    </td>
                    <td className="border border-slate-300 p-2 text-left tabular-nums font-bold text-amber-800">
                      <Money rial={issue.totalCost} />
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Signatures Footer */}
          <div className="pt-8 grid grid-cols-4 gap-4 text-center text-sm">
            <div className="space-y-8">
              <span className="font-bold text-slate-700 block">تحویل‌دهنده (انباردار)</span>
              <span className="text-slate-500 text-xs block">
                {receipt ? receipt.receiverName : issue?.dispatchedByKeeperName}
              </span>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-slate-700 block">
                {receipt ? 'کنترل کیفی و ناظر سازه' : 'تحویل‌گیرنده کارگاه'}
              </span>
              <span className="text-slate-500 text-xs block">
                {receipt ? receipt.qcInspectorName : issue?.receivedByCrewLeaderName}
              </span>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-slate-700 block">مدیر پروژه / کارگاه</span>
              <span className="text-slate-500 text-xs block">
                {formatText(issue?.approvedByManagerName || 'مهندس کیارش نادری')}
              </span>
            </div>

            <div className="space-y-8">
              <span className="font-bold text-slate-700 block">تأیید حسابداری و مالی</span>
              <span className="text-slate-500 text-xs block">دکتر هادی صمدیان</span>
            </div>
          </div>
        </div>
      </Dialog>
  );
};
