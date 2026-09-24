/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Contract,
  ContractBOQItem,
  DetailedProgressStatement,
  ContractAmendment,
  StatementPayment,
  ContractDocument,
  ContractAuditLog,
  UserProfile,
} from '../../types';
import {
  Building2,
  Calendar,
  Clock,
  FileText,
  TrendingUp,
  DollarSign,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Paperclip,
  Download,
  Share2,
  ExternalLink,
  ChevronLeft,
  ShieldCheck,
  FileCheck,
  History,
  FileSpreadsheet,
  Settings,
} from 'lucide-react';

interface ContractDetailViewProps {
  contract: Contract;
  boqItems: ContractBOQItem[];
  statements: DetailedProgressStatement[];
  amendments: ContractAmendment[];
  payments: StatementPayment[];
  documents: ContractDocument[];
  auditLogs: ContractAuditLog[];
  currentUser: UserProfile;
  onBack: () => void;
  onOpenNewStatement: (contract: Contract) => void;
  onOpenNewAmendment: (contract: Contract) => void;
  onSelectStatement: (statement: DetailedProgressStatement) => void;
}

export const ContractDetailView: React.FC<ContractDetailViewProps> = ({
  contract,
  boqItems,
  statements,
  amendments,
  payments,
  documents,
  auditLogs,
  currentUser,
  onBack,
  onOpenNewStatement,
  onOpenNewAmendment,
  onSelectStatement,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'boq'
    | 'statements'
    | 'payments'
    | 'deductions'
    | 'amendments'
    | 'documents'
    | 'correspondence'
    | 'financial_summary'
    | 'audit_log'
  >('overview');

  // Filter items for this contract
  const contractBOQ = boqItems.filter((b) => b.contractId === contract.id);
  const contractStatements = statements.filter((s) => s.contractId === contract.id);
  const contractAmendments = amendments.filter((a) => a.contractId === contract.id);
  const contractPayments = payments.filter((p) => p.contractId === contract.id);
  const contractDocs = documents.filter((d) => d.contractId === contract.id);
  const contractLogs = auditLogs.filter((l) => l.contractId === contract.id);

  // Financial calculations
  const execPct = (contract.executedValue / contract.currentValue) * 100;
  const billedPct = (contract.billedValue / contract.currentValue) * 100;
  const receivedPct = (contract.receivedValue / contract.currentValue) * 100;

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="بازگشت به لیست قراردادها"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                {contract.code}
              </span>
              <span className="text-xs text-slate-500 font-mono">شماره کارفرما: {contract.number}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {contract.status}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                {contract.contractType}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
              {contract.projectTitle}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenNewAmendment(contract)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ثبت الحاقیه / متمم</span>
          </button>
          <button
            onClick={() => onOpenNewStatement(contract)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>صورت‌وضعیت جدید</span>
          </button>
        </div>
      </div>

      {/* Top Banner: 6 Essential Contract Values (Section 24 Requirement) */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-800">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-800">
          <div className="px-2 pt-2 sm:pt-0">
            <span className="text-[11px] text-slate-400 block mb-1">مبلغ کل پیمان (فعلی)</span>
            <span className="text-lg font-black text-amber-400">
              {Number((contract.currentValue / 1_000_000_000).toFixed(2)).toLocaleString('fa-IR')}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              اولیه: {(contract.initialValue / 1_000_000_000).toFixed(1)} + تغییرات {(contract.approvedChangesValue / 1_000_000_000).toFixed(1)}
            </span>
          </div>

          <div className="px-2 pt-2 sm:pt-0">
            <span className="text-[11px] text-slate-400 block mb-1">کارکرد اجراشده (متره)</span>
            <span className="text-lg font-black text-indigo-300">
              {Number((contract.executedValue / 1_000_000_000).toFixed(2)).toLocaleString('fa-IR')}
            </span>
            <span className="text-[10px] text-indigo-400 block mt-0.5 font-bold">
              {Number(execPct.toFixed(1)).toLocaleString('fa-IR')}٪ پیشرفت فیزیکی
            </span>
          </div>

          <div className="px-2 pt-2 sm:pt-0">
            <span className="text-[11px] text-slate-400 block mb-1">صورت‌وضعیت ارسالی (Billed)</span>
            <span className="text-lg font-black text-purple-300">
              {Number((contract.billedValue / 1_000_000_000).toFixed(2)).toLocaleString('fa-IR')}
            </span>
            <span className="text-[10px] text-purple-400 block mt-0.5">
              {Number(billedPct.toFixed(1)).toLocaleString('fa-IR')}٪ از کل پیمان
            </span>
          </div>

          <div className="px-2 pt-2 sm:pt-0">
            <span className="text-[11px] text-slate-400 block mb-1">دریافتی نقد و اسناد (Received)</span>
            <span className="text-lg font-black text-emerald-400">
              {Number((contract.receivedValue / 1_000_000_000).toFixed(2)).toLocaleString('fa-IR')}
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">
              {Number(receivedPct.toFixed(1)).toLocaleString('fa-IR')}٪ وصولی
            </span>
          </div>

          <div className="px-2 pt-2 sm:pt-0">
            <span className="text-[11px] text-slate-400 block mb-1">مانده مطالبات (Receivable)</span>
            <span className="text-lg font-black text-rose-400">
              {Number((contract.receivableValue / 1_000_000_000).toFixed(2)).toLocaleString('fa-IR')}
            </span>
            <span className="text-[10px] text-rose-300 block mt-0.5">
              تاییدشده وصول‌نشده
            </span>
          </div>

          <div className="px-2 pt-2 sm:pt-0">
            <span className="text-[11px] text-slate-400 block mb-1">ظرفیت کار باقیمانده (Remaining)</span>
            <span className="text-lg font-black text-teal-300">
              {Number((contract.remainingValue / 1_000_000_000).toFixed(2)).toLocaleString('fa-IR')}
            </span>
            <span className="text-[10px] text-teal-400 block mt-0.5 font-bold">
              {Number((100 - execPct).toFixed(1)).toLocaleString('fa-IR')}٪ حجم مانده
            </span>
          </div>
        </div>

        {/* Integrated Progress Visualizer */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, receivedPct)}%` }}></div>
            <div className="bg-purple-500 h-full" style={{ width: `${Math.max(0, Math.min(100, billedPct - receivedPct))}%` }}></div>
            <div className="bg-indigo-400 h-full" style={{ width: `${Math.max(0, Math.min(100, execPct - billedPct))}%` }}></div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
            <span>دریافت: {receivedPct.toFixed(1)}٪</span>
            <span>ارسال صورت‌وضعیت: {billedPct.toFixed(1)}٪</span>
            <span>کارکرد واقعی: {execPct.toFixed(1)}٪</span>
            <span>سقف پیمان: ۱۰۰٪</span>
          </div>
        </div>
      </div>

      {/* 10 Detailed Tabs (Section 4 Requirement) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="flex items-center overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-4 scrollbar-none text-xs font-medium">
          {[
            { id: 'overview', label: '۱. مشخصات کلی و حقوقی', count: undefined },
            { id: 'boq', label: '۲. فهرست‌بها و اقلام پیمان (BOQ)', count: contractBOQ.length },
            { id: 'statements', label: '۳. صورت‌وضعیت‌ها', count: contractStatements.length },
            { id: 'payments', label: '۴. دریافت‌ها و وصولی‌ها', count: contractPayments.length },
            { id: 'deductions', label: '۵. سیستم کسورات', count: undefined },
            { id: 'amendments', label: '۶. الحاقیه‌ها و تغییرات', count: contractAmendments.length },
            { id: 'documents', label: '۷. اسناد و نقشه‌ها', count: contractDocs.length },
            { id: 'correspondence', label: '۸. مکاتبات و صورت‌جلسات', count: 3 },
            { id: 'financial_summary', label: '۹. تراز و خلاصه مالی', count: undefined },
            { id: 'audit_log', label: '۱۰. ردپای حسابرسی (Audit)', count: contractLogs.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 px-3.5 shrink-0 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-950 font-bold bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === tab.id ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count.toLocaleString('fa-IR')}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Section A: Legal & Parties */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 pb-2 border-b border-slate-200 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    ارکان و طرفین قرارداد
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">کارفرما:</span>
                      <span className="font-bold text-slate-900">{contract.employer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">دستگاه اجرایی:</span>
                      <span className="font-medium text-slate-800">{contract.executiveBody}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">مهندس مشاور / نظارت:</span>
                      <span className="font-bold text-slate-900">{contract.consultant}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">پیمانکار مجری:</span>
                      <span className="font-bold text-emerald-800">{contract.contractor}</span>
                    </div>
                  </div>
                </div>

                {/* Section B: Dates and Timelines */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 pb-2 border-b border-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    تاریخ‌ها و دوره اجرای پیمان
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">تاریخ انعقاد پیمان:</span>
                      <span className="font-medium text-slate-800">{contract.contractDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">تاریخ ابلاغ و شروع:</span>
                      <span className="font-bold text-slate-900">{contract.startDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">تاریخ خاتمه اولیه:</span>
                      <span className="font-medium text-slate-800">{contract.endDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">مدت پیمان:</span>
                      <span className="font-bold text-slate-900">
                        {contract.durationMonths} ماه (+ {contract.durationExtensionMonths} ماه تمدید)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section C: Financial Guarantees & Deductions */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 pb-2 border-b border-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    شرایط مالی و تضامین قراردادی
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">درصد پیش‌پرداخت مجاز:</span>
                      <span className="font-bold text-slate-900">{contract.advancePaymentPercentage}٪ مبلغ اولیه</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">سپرده حسن انجام کار:</span>
                      <span className="font-bold text-slate-900">{contract.retentionPercentage}٪ از هر صورت‌وضعیت</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">حق بیمه تأمین اجتماعی:</span>
                      <span className="font-medium text-slate-800">۵٪ ماده ۳۸ قانون تأمین اجتماعی</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">مالیات بر ارزش افزوده:</span>
                      <span className="font-medium text-slate-800">۱۰٪ به مبلغ ناخالص اضافه می‌شود</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scope & Description */}
              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <h3 className="text-xs font-bold text-slate-800 mb-2">موضوع و شرح مختصر پیمان:</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {contract.description || 'احداث ابنیه، عملیات خاکی، تأسیسات مکانیکی و برقی طبق مشخصات فنی و دفترچه فهرست‌بهای منضم به پیمان.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: CONTRACT BOQ */}
          {activeTab === 'boq' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">فهرست‌بهای منضم به پیمان (Contract BOQ)</h3>
                  <p className="text-xs text-slate-500">
                    کنترل لحظه‌ای مقادیر اجراشده در برابر مقادیر مصوب پیمان و مانیتورینگ مصرف مصالح در انبار
                  </p>
                </div>
                <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                  مجموع اقلام: <strong>{contractBOQ.length} ردیف</strong>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">ردیف</th>
                      <th className="p-3">کد آیتم</th>
                      <th className="p-3">شرح عملیات</th>
                      <th className="p-3 text-center">واحد</th>
                      <th className="p-3 text-left">مقدار اولیه</th>
                      <th className="p-3 text-left">بهای واحد (تومان)</th>
                      <th className="p-3 text-left">مبلغ اولیه</th>
                      <th className="p-3 text-left">کارکرد اجراشده</th>
                      <th className="p-3 text-left">مبلغ کارکرد</th>
                      <th className="p-3 text-center">پیشرفت</th>
                      <th className="p-3 text-center">اتصال به انبار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contractBOQ.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono text-slate-500">{item.rowNumber}</td>
                        <td className="p-3 font-mono font-bold text-blue-700">{item.code}</td>
                        <td className="p-3 max-w-xs">
                          <span className="font-medium text-slate-900 block">{item.description}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{item.chapter}</span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-600">{item.unit}</td>
                        <td className="p-3 text-left font-mono font-medium">{item.initialQuantity.toLocaleString('fa-IR')}</td>
                        <td className="p-3 text-left font-mono">{item.unitRate.toLocaleString('fa-IR')}</td>
                        <td className="p-3 text-left font-mono font-bold text-slate-800">
                          {item.initialAmount.toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3 text-left font-mono">
                          <span className="font-bold text-indigo-700">
                            {item.cumulativeExecutedQuantity.toLocaleString('fa-IR')}
                          </span>
                          {item.isSurplusQuantity && (
                            <span className="block text-[10px] font-bold text-rose-600">
                              مازاد: +{item.surplusQuantity?.toLocaleString('fa-IR')}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-indigo-900">
                          {item.executedAmount.toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.progressPercentage > 100
                                ? 'bg-rose-100 text-rose-800'
                                : item.progressPercentage >= 80
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {Number(item.progressPercentage.toFixed(1)).toLocaleString('fa-IR')}٪
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {item.inventoryMaterialCode ? (
                            <div className="inline-block text-right">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-700 block">
                                {item.inventoryMaterialCode}
                              </span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                مصرف: {item.inventoryConsumedQty?.toLocaleString('fa-IR')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: STATEMENTS */}
          {activeTab === 'statements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">صورت‌وضعیت‌های صادره این پیمان</h3>
                  <p className="text-xs text-slate-500">لیست صورت‌وضعیت‌های موقت، تعدیل و قطعی همراه با گردش تأییدات</p>
                </div>
                <button
                  onClick={() => onOpenNewStatement(contract)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت صورت‌وضعیت جدید</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">شماره صورت‌وضعیت</th>
                      <th className="p-3">نوع</th>
                      <th className="p-3">دوره کارکرد</th>
                      <th className="p-3 text-left">مبلغ ناخالص (تومان)</th>
                      <th className="p-3 text-left">کسورات قانونی</th>
                      <th className="p-3 text-left">مبلغ خالص (تومان)</th>
                      <th className="p-3 text-left">دریافتی</th>
                      <th className="p-3 text-left">مانده طلب</th>
                      <th className="p-3 text-center">وضعیت گردش</th>
                      <th className="p-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contractStatements.map((stm) => (
                      <tr key={stm.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-bold text-slate-900">{stm.statementNumber}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                            {stm.type}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">
                          {stm.periodStartDate} تا {stm.periodEndDate}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-slate-800">
                          {stm.grossAmount.toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3 text-left font-mono text-rose-700">
                          {stm.totalDeductions.toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-indigo-900">
                          {stm.netPayable.toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3 text-left font-mono text-emerald-700 font-bold">
                          {stm.receivedAmount.toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-rose-600">
                          {stm.remainingPayable.toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {stm.status === 'approved_by_employer'
                              ? 'تأیید کارفرما'
                              : stm.status === 'under_consultant_review'
                              ? 'بررسی مشاور'
                              : stm.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => onSelectStatement(stm)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
                          >
                            مشاهده و چاپ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PAYMENTS */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">دریافتی‌ها و وصولی‌های قرارداد (Receipts)</h3>
                  <p className="text-xs text-slate-500">واریزی‌های نقدی، اسناد خزانه (اخزا)، چک‌های بانکی و تهاترها</p>
                </div>
                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  مجموع وصولی: {Number((contract.receivedValue / 1_000_000_000).toFixed(2)).toLocaleString('fa-IR')} میلیارد تومان
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">تاریخ</th>
                      <th className="p-3">بابت صورت‌وضعیت</th>
                      <th className="p-3">روش پرداخت</th>
                      <th className="p-3">شماره پیگیری / حواله</th>
                      <th className="p-3">حساب مبدا (کارفرما)</th>
                      <th className="p-3">بانک مقصد شرکت</th>
                      <th className="p-3 text-left">مبلغ واریزی (تومان)</th>
                      <th className="p-3 text-center">سند حسابداری</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contractPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono">{p.date}</td>
                        <td className="p-3 font-medium text-slate-900">{p.statementNumber}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 font-bold">
                            {p.method}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-600">{p.referenceNumber}</td>
                        <td className="p-3 text-slate-600">{p.payerAccount}</td>
                        <td className="p-3 font-medium text-slate-800">{p.destinationBank}</td>
                        <td className="p-3 text-left font-mono font-bold text-emerald-700">
                          {p.amount.toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-mono">
                            {p.journalEntryId || 'ACC-REC'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: DEDUCTIONS */}
          {activeTab === 'deductions' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">موتور کسورات قانونی و قراردادی (Deduction Engine)</h3>
                <p className="text-xs text-slate-500">قواعد حاکم بر کسر مبالغ از صورت‌وضعیت‌های کارکرد طبق شرایط عمومی پیمان</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">استرداد پیش‌پرداخت</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">۱۰٪</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    مستهلک‌سازی متناسب با درصد پیش‌پرداخت دریافتی اولیه تا اتمام کامل مانده پیش‌پرداخت.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">سپرده حسن انجام کار</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900">۱۰٪</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    کسر ۱۰ درصد تضمین کیفیت؛ ۵۰٪ پس از تحویل موقت و ۵۰٪ باقیمانده پس از تحویل قطعی آزاد می‌گردد.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">بیمه تأمین اجتماعی (ماده ۳۸)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900">۵٪</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    کسر ۵ درصد طبق قانون تأمین اجتماعی؛ پرداخت آن منوط به ارائه مفاصاحساب قطعی شعبه بیمه است.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">مالیات بر ارزش افزوده (VAT)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900">+۱۰٪</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    ۱۰ درصد ارزش افزوده به مبالغ ناخالص کارکرد اضافه شده و کارفرما موظف به پرداخت همزمان آن است.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">کسورات مصالح کارفرما</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">متغیر</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    کسر بهای آهن‌آلات یا سیمان تحویلی کارفرما پای کار طبق حواله‌های انبار مرکزی.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">جرائم تأخیرات غیرمجاز</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-900">صفر فعلی</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    در صورت تاخیر غیرمجاز از برنامه زمان‌بندی مصوب، بر اساس فرمول ماده ۵۰ شرایط عمومی پیمان اعمال می‌شود.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AMENDMENTS */}
          {activeTab === 'amendments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">الحاقیه‌ها، دستورکارها و تغییرات پیمان</h3>
                  <p className="text-xs text-slate-500">
                    ثبت تغییرات ۲۵ درصدی، تمدید مدت و تغییرات نرخ به همراه به‌روزرسانی خودکار سقف پیمان
                  </p>
                </div>
                <button
                  onClick={() => onOpenNewAmendment(contract)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت الحاقیه جدید</span>
                </button>
              </div>

              <div className="space-y-3">
                {contractAmendments.map((amd) => (
                  <div key={amd.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{amd.number}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          {amd.type}
                        </span>
                        <span className="text-xs text-slate-500">تاریخ ابلاغ: {amd.date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-600">
                          مبلغ اثر:{' '}
                          <strong className="text-emerald-700">
                            {amd.amount > 0 ? `+${(amd.amount / 1_000_000_000).toFixed(2)}` : (amd.amount / 1_000_000_000).toFixed(2)}{' '}
                            میلیارد تومان
                          </strong>
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {amd.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600">{amd.description}</p>
                    {amd.extendedDays && amd.extendedDays > 0 && (
                      <span className="inline-block text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        تمدید مجاز مدت: {amd.extendedDays} روز
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">اسناد فنی و مدارک قرارداد</h3>
                  <p className="text-xs text-slate-500">آرشیو نقشه‌ها، پیمان‌های اولیه، صورتجلسات و اکسل‌های متره</p>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium cursor-pointer">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>بارگذاری سند جدید</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {contractDocs.map((doc) => (
                  <div key={doc.id} className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block truncate max-w-[180px]">
                          {doc.fileName}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {doc.fileType} · نسخه {doc.version} · {doc.fileSize}
                        </span>
                      </div>
                    </div>
                    <button className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer" title="دانلود فایل">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: CORRESPONDENCE */}
          {activeTab === 'correspondence' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">مکاتبات کارگاهی و صورت‌جلسات نظارتی</h3>
                <p className="text-xs text-slate-500">سوابق نامه‌نگاری‌ها با مهندس مشاور و کارفرما</p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 bg-white flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900 block">نامه شماره ۳۴۲/ص: اعلام آمادگی جهت بتن‌ریزی سقف منفی ۲</span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">گیرنده: مهندسین مشاور سازه‌اندیش شرق · تاریخ: ۱۴۰۳/۰۵/۲۲</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">پاسخ مثبت دریافت شد</span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-white flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900 block">صورت‌جلسه کارگاهی شماره ۱۲: تطبیق احجام عملیات خاکی نهایی گود</span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">امضاکنندگان: سرپرست کارگاه + ناظر مقیم مشاور · تاریخ: ۱۴۰۳/۰۵/۱۸</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-bold">مصوب و منضم به صورت‌وضعیت</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: FINANCIAL SUMMARY */}
          {activeTab === 'financial_summary' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">تراز جامع مالی پیمان (Financial Summary)</h3>
                <p className="text-xs text-slate-500">گزارش مقایسه‌ای منابع، مصارف، مطالبات و ارزش‌های چهارگانه قرارداد</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                  <h4 className="font-bold text-slate-900 border-b pb-2">صورت تطبیق مالی پیمان</h4>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">مبلغ اولیه قرارداد:</span>
                    <span className="font-bold font-mono text-slate-900">{(contract.initialValue / 1_000_000_000).toFixed(2)} م.ت</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">الحاقیه‌های مصوب (افزایش سقف):</span>
                    <span className="font-bold font-mono text-emerald-700">+{(contract.approvedChangesValue / 1_000_000_000).toFixed(2)} م.ت</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 bg-amber-50/50 px-1 rounded">
                    <span className="font-bold text-amber-950">مبلغ نهایی فعلی پیمان:</span>
                    <span className="font-black font-mono text-amber-900">{(contract.currentValue / 1_000_000_000).toFixed(2)} م.ت</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">ارزش کل کارکرد متره شده:</span>
                    <span className="font-bold font-mono text-indigo-700">{(contract.executedValue / 1_000_000_000).toFixed(2)} م.ت</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">کل صورت‌وضعیت‌های ارسال‌شده:</span>
                    <span className="font-bold font-mono text-purple-700">{(contract.billedValue / 1_000_000_000).toFixed(2)} م.ت</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">کل دریافتی‌های قطعی نقد و اسناد:</span>
                    <span className="font-bold font-mono text-emerald-700">{(contract.receivedValue / 1_000_000_000).toFixed(2)} م.ت</span>
                  </div>
                  <div className="flex justify-between py-1 bg-rose-50 px-1 rounded">
                    <span className="font-bold text-rose-900">مانده مطالبات معوق از کارفرما:</span>
                    <span className="font-black font-mono text-rose-700">{(contract.receivableValue / 1_000_000_000).toFixed(2)} م.ت</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 text-xs flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 border-b pb-2">شاخص‌های بازدهی و نقدشوندگی</h4>
                    <div className="space-y-3 mt-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-500">نرخ تحقق وصولی از صورت‌وضعیت:</span>
                          <span className="font-bold text-slate-900">
                            {((contract.receivedValue / contract.billedValue) * 100).toFixed(1)}٪
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: `${(contract.receivedValue / contract.billedValue) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-500">پیشرفت ریالی کارکرد پیمان:</span>
                          <span className="font-bold text-indigo-700">
                            {((contract.executedValue / contract.currentValue) * 100).toFixed(1)}٪
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full"
                            style={{ width: `${(contract.executedValue / contract.currentValue) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-600 leading-relaxed border border-slate-200">
                    قرارداد دارای توازن مالی مثبت بوده و کسورات قانونی به درستی در دفاتر حسابداری شرکت اعمال گردیده است.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: AUDIT LOG */}
          {activeTab === 'audit_log' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">ردپای حسابرسی و تاریخچه تغییرات حساس (Audit Trail)</h3>
                <p className="text-xs text-slate-500">
                  ثبت تمامی تغییرات سقف قرارداد، احجام BOQ، تغییرات نرخ، تأییدات و رد اسناد مالی با ذکر علت
                </p>
              </div>

              <div className="space-y-2.5">
                {contractLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.user}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {log.role}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                          {log.action}
                        </span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {log.date} · {log.time}
                      </span>
                    </div>
                    <div className="text-slate-700 flex items-center gap-2">
                      <span className="text-slate-500">فیلد هدف: {log.targetField}</span>
                      <span>·</span>
                      <span>مقدار قبلی: <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-700">{log.oldValue}</code></span>
                      <span>➔</span>
                      <span>مقدار جدید: <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">{log.newValue}</code></span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">دلیل ثبت: {log.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
