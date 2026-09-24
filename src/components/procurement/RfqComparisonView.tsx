import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Award,
  CheckCircle2,
  TrendingDown,
  Building,
  Check,
  X,
  Eye,
  Plus,
  Scale,
  DollarSign,
  Truck,
  ShieldCheck,
} from 'lucide-react';
import { RequestForQuotation, BidSupplierQuote } from '../../types';
import { Dialog } from '../common/Dialog';
import { formatMoney } from '../../utils/money';

interface RfqComparisonViewProps {
  rfqs: RequestForQuotation[];
  onSelectWinningBid: (rfqId: string, quoteId: string) => void;
  onGeneratePoFromRfq: (rfq: RequestForQuotation) => void;
}

export const RfqComparisonView: React.FC<RfqComparisonViewProps> = ({
  rfqs,
  onSelectWinningBid,
  onGeneratePoFromRfq,
}) => {
  const [activeRfqForMatrix, setActiveRfqForMatrix] = useState<RequestForQuotation | null>(null);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">استعلام بها، مناقصات محدود و جدول مقایسه فنی-مالی (RFQ)</h3>
            <p className="text-xs text-slate-500">
              ارزیابی همزمان قیمت، کرایه حمل، کیفیت، شرایط پرداخت اعتباری و انتخاب برنده در کمیسیون معاملات
            </p>
          </div>
        </div>
      </div>

      {/* RFQs Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rfqs.map((rfq) => {
          const winningQuote = rfq.quotes.find((q) => q.isWinningBid || q.supplierId === rfq.selectedSupplierId);
          return (
            <div
              key={rfq.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
                    {rfq.rfqNumber}
                  </span>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                      rfq.status === 'برنده مشخص شد' || rfq.status === 'تبدیل به سفارش (PO)'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {rfq.status}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 leading-snug mb-1">{rfq.title}</h4>
                <div className="text-xs text-slate-500 mb-3">پروژه: <span className="font-bold text-slate-700">{rfq.projectName}</span></div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-1.5 mb-3">
                  <div className="flex justify-between text-slate-600">
                    <span>کالای استعلام‌شده:</span>
                    <span className="font-bold text-slate-900">{rfq.materialName}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>مقدار مورد نیاز:</span>
                    <span className="font-mono font-bold text-indigo-700">
                      {rfq.requiredQty.toLocaleString('fa-IR')} {rfq.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>پیشنهادهای دریافتی:</span>
                    <span className="font-mono font-bold text-slate-800">{rfq.quotes.length} تأمین‌کننده</span>
                  </div>
                </div>

                {winningQuote && (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                      <Award className="w-4 h-4 text-emerald-600" />
                      <span>پیشنهاد برنده: {winningQuote.supplierName}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800 text-[11px] pt-1">
                      <span>مبلغ کل پیشنهادی:</span>
                      <span className="font-mono font-bold">{formatMoney(winningQuote.totalQuoteAmount)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800 text-[11px]">
                      <span>شرایط پرداخت:</span>
                      <span className="font-bold">{winningQuote.paymentTerms}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setActiveRfqForMatrix(rfq)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Scale className="w-4 h-4" />
                  <span>جدول مقایسه بها (Matrix)</span>
                </button>

                {rfq.status !== 'تبدیل به سفارش (PO)' && (
                  <button
                    onClick={() => onGeneratePoFromRfq(rfq)}
                    className="flex items-center gap-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>صدور PO</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bid Comparison Matrix Modal (کمیسیون معاملات) */}
      {activeRfqForMatrix && (
        <Dialog onClose={() => setActiveRfqForMatrix(null)} label="جدول مقایسه فنی و مالی پیش‌فاکتورها -" overlayClassName="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    جدول مقایسه فنی و مالی پیش‌فاکتورها - {activeRfqForMatrix.rfqNumber}
                  </h3>
                  <p className="text-xs text-slate-500">{activeRfqForMatrix.title} ({activeRfqForMatrix.projectName})</p>
                </div>
              </div>
              <button
                onClick={() => setActiveRfqForMatrix(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Matrix Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
              {/* Material Specs Bar */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-slate-500">کالای درخواستی:</span>
                  <span className="font-bold text-slate-900 mr-1.5">{activeRfqForMatrix.materialName}</span>
                </div>
                <div>
                  <span className="text-slate-500">حجم خرید:</span>
                  <span className="font-mono font-bold text-slate-900 mr-1.5">
                    {activeRfqForMatrix.requiredQty.toLocaleString('fa-IR')} {activeRfqForMatrix.unit}
                  </span>
                </div>
                {activeRfqForMatrix.savingsVsBudgetAmount && activeRfqForMatrix.savingsVsBudgetAmount > 0 && (
                  <div className="text-emerald-700 font-bold bg-emerald-100/60 px-2.5 py-1 rounded-lg">
                    صرفه‌جویی نسبت به برآورد اولیه: {formatMoney(activeRfqForMatrix.savingsVsBudgetAmount)}
                  </div>
                )}
              </div>

              {/* Multi-Column Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {activeRfqForMatrix.quotes.map((quote) => {
                  const isWinner = quote.isWinningBid || quote.supplierId === activeRfqForMatrix.selectedSupplierId;
                  return (
                    <div
                      key={quote.id}
                      className={`rounded-2xl border p-4 space-y-3 relative transition-all ${
                        isWinner
                          ? 'border-emerald-500 bg-emerald-50/20 shadow-md ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {isWinner && (
                        <div className="absolute -top-3 left-4 bg-emerald-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shadow-sm">
                          <Award className="w-3.5 h-3.5" />
                          <span>برنده منتخب کمیسیون</span>
                        </div>
                      )}

                      <div className="border-b border-slate-100 pb-2">
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-bold">
                          گرید {quote.supplierGrade}
                        </span>
                        <h4 className="font-black text-slate-900 text-sm mt-1">{quote.supplierName}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">پیش‌فاکتور: {quote.quoteReferenceNumber}</span>
                      </div>

                      {/* Financials & Rates */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-slate-600">
                          <span>نرخ واحد کالا:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatMoney(quote.unitPrice)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>کرایه حمل واحد:</span>
                          <span className="font-mono text-slate-800">
                            {formatMoney(quote.freightCostPerUnit)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>مالیات ارزش افزوده:</span>
                          <span className="font-mono text-slate-800">
                            {formatMoney(quote.vatAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1.5 font-black text-indigo-900">
                          <span>مبلغ کل پیش‌فاکتور:</span>
                          <span className="font-mono text-sm">
                            {formatMoney(quote.totalQuoteAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Technical & Terms */}
                      <div className="border-t border-slate-100 pt-2 space-y-1.5 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">انطباق فنی:</span>
                          <span className="font-bold text-emerald-700">{quote.technicalCompliance}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">زمان تحویل پای کار:</span>
                          <span className="font-bold font-mono text-slate-800">{quote.deliveryLeadTimeDays} روز کاری</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">شرایط پرداخت:</span>
                          <span className="font-bold text-slate-900 text-right">{quote.paymentTerms}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">گارانتی / وارانتی:</span>
                          <span className="font-bold text-slate-800">{quote.warrantyMonths} ماه</span>
                        </div>
                      </div>

                      {/* Composite Score */}
                      <div className="bg-slate-100/70 p-2 rounded-xl flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700">امتیاز نهایی کمیسیون:</span>
                        <span className="font-mono font-black text-indigo-700 text-sm">
                          {quote.compositeScore} از ۱۰۰
                        </span>
                      </div>

                      {!isWinner && (
                        <button
                          onClick={() => {
                            onSelectWinningBid(activeRfqForMatrix.id, quote.id);
                            setActiveRfqForMatrix((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    selectedSupplierId: quote.supplierId,
                                    selectedSupplierName: quote.supplierName,
                                    status: 'برنده مشخص شد',
                                    quotes: prev.quotes.map((q) => ({
                                      ...q,
                                      isWinningBid: q.id === quote.id,
                                    })),
                                  }
                                : null
                            );
                          }}
                          className="w-full py-2 border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold transition-all cursor-pointer"
                        >
                          انتخاب به عنوان برنده
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Commission Notes */}
              {activeRfqForMatrix.commissionCommitteeNotes && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-1">
                  <span className="font-bold text-slate-800 block">صورتجلسه و توجیه کمیسیون معاملات:</span>
                  <p className="text-slate-600 leading-relaxed">
                    {activeRfqForMatrix.commissionCommitteeNotes}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-between items-center">
              <button
                onClick={() => {
                  onGeneratePoFromRfq(activeRfqForMatrix);
                  setActiveRfqForMatrix(null);
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>صدور سفارش قطعی خرید (PO) برای تأمین‌کننده برنده</span>
              </button>
              <button
                onClick={() => setActiveRfqForMatrix(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>
          </Dialog>
      )}
    </div>
  );
};
