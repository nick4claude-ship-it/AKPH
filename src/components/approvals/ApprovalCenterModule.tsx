/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Check,
  X,
  CreditCard,
  ShoppingCart,
  FileSpreadsheet,
  FileCheck2,
  Layers,
  Building,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Project, UserProfile } from '../../types';
import { formatNumber, formatCurrencyCompact } from '../../utils/formatters';

export interface ApprovalItem {
  id: string;
  sourceType: 'فاکتور خرید تأمین‌کننده' | 'هزینه و شارژ تنخواه' | 'صورت‌وضعیت پیمانکار جزء' | 'دستور پرداخت خزانه' | 'درخواست خرید کالا';
  title: string;
  docNumber: string;
  date: string;
  dueDate: string;
  projectId: string;
  projectName: string;
  submitter: string;
  beneficiaryName: string;
  amount: number;
  priority: 'بحرانی / فوری' | 'عادی' | 'پایین';
  status: 'در انتظار تأیید' | 'تأیید شده' | 'رد شده' | 'اصلاح مدارک';
  approvalStep: 'مدیرعامل' | 'مدیر مالی' | 'مدیر پروژه';
  notes?: string;
}

interface ApprovalCenterModuleProps {
  projects: Project[];
  currentUser: UserProfile;
  onItemApproved?: (item: ApprovalItem) => void;
  onItemRejected?: (item: ApprovalItem, reason: string) => void;
}

export const ApprovalCenterModule: React.FC<ApprovalCenterModuleProps> = ({
  projects,
  currentUser,
  onItemApproved,
  onItemRejected,
}) => {
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>([
    {
      id: 'app-01',
      sourceType: 'فاکتور خرید تأمین‌کننده',
      title: 'خرید ۳۵ تن میلگرد A3 سایز ۲۰ و ۲۲ کارخانه ذوب‌آهن',
      docNumber: 'INV-1403-091',
      date: '۱۴۰۳/۰۶/۲۸',
      dueDate: '۱۴۰۳/۰۷/۰۵',
      projectId: 'prj-101',
      projectName: 'برج تجاری-اداری رونیکا',
      submitter: 'مهندس تدارکات',
      beneficiaryName: 'شرکت سهامی ذوب‌آهن اصفهان',
      amount: 1_250_000_000,
      priority: 'بحرانی / فوری',
      status: 'در انتظار تأیید',
      approvalStep: 'مدیرعامل',
      notes: 'تطبیق ۳‌جانبه با رسید انبار #GRN-101 انجام شد و بدون مغایرت تایید گردید.',
    },
    {
      id: 'app-02',
      sourceType: 'صورت‌وضعیت پیمانکار جزء',
      title: 'صورت‌وضعیت شماره ۳ دستمزدی اسکلت بتنی رونیکا',
      docNumber: 'SUB-ST-RONIKA-03',
      date: '۱۴۰۳/۰۶/۲۵',
      dueDate: '۱۴۰۳/۰۷/۱۰',
      projectId: 'prj-101',
      projectName: 'برج تجاری-اداری رونیکا',
      submitter: 'دفتر فنی کارگاه',
      beneficiaryName: 'شرکت آرمان بتن سازه',
      amount: 480_000_000,
      priority: 'عادی',
      status: 'در انتظار تأیید',
      approvalStep: 'مدیرعامل',
      notes: 'احجام بتن‌ریزی سقف‌های ۲۲ الی ۲۴ توسط نظارت مشاور متره و کسر سپرده ۱۰٪ لحاظ شد.',
    },
    {
      id: 'app-03',
      sourceType: 'هزینه و شارژ تنخواه',
      title: 'درخواست شارژ فوری تنخواه نقدی کارگاه نیلوفر',
      docNumber: 'PC-REQ-NIL-04',
      date: '۱۴۰۳/۰۷/۰۱',
      dueDate: '۱۴۰۳/۰۷/۰۲',
      projectId: 'prj-103',
      projectName: 'مجتمع مسکونی نیلوفر (۱۲۰ واحدی)',
      submitter: 'مهندس مهران پورحسینی',
      beneficiaryName: 'تنخواه کارگاه نیلوفر',
      amount: 30_000_000,
      priority: 'بحرانی / فوری',
      status: 'در انتظار تأیید',
      approvalStep: 'مدیر مالی',
      notes: 'فاکتورهای دوره قبل تسویه شده و نقدینگی کارگاه به زیر حداقل سقف مجاز رسیده است.',
    },
    {
      id: 'app-04',
      sourceType: 'دستور پرداخت خزانه',
      title: 'دستور پرداخت کابل‌کشی و روشنایی پل اصلی تقاطع فجر',
      docNumber: 'PR-1403-0705',
      date: '۱۴۰۳/۰۷/۰۲',
      dueDate: '۱۴۰۳/۰۷/۱۵',
      projectId: 'prj-102',
      projectName: 'تقاطع غیرهمسطح بزرگراه فجر',
      submitter: 'امور مالی',
      beneficiaryName: 'پیمانکاری برق و تاسیسات نیروگستر',
      amount: 185_000_000,
      priority: 'عادی',
      status: 'در انتظار تأیید',
      approvalStep: 'مدیرعامل',
      notes: 'تایید سرپرست کارگاه اخذ شده و موعد قرارداد سررسید شده است.',
    },
    {
      id: 'app-05',
      sourceType: 'درخواست خرید کالا',
      title: 'خرید فوری ۵۰۰۰ لیتر گازوئیل برای ژنراتورهای پروژه تقاطع فجر',
      docNumber: 'PR-REQ-FAJR-84',
      date: '۱۴۰۳/۰۷/۰۲',
      dueDate: '۱۴۰۳/۰۷/۰۴',
      projectId: 'prj-102',
      projectName: 'تقاطع غیرهمسطح بزرگراه فجر',
      submitter: 'مهندس بهمن کاظمی',
      beneficiaryName: 'جایگاه سوخت‌رسانی شرکت ملی پخش',
      amount: 45_000_000,
      priority: 'بحرانی / فوری',
      status: 'در انتظار تأیید',
      approvalStep: 'مدیرعامل',
      notes: 'به منظور استمرار عملیات شبانه بتن‌ریزی تیرهای اصلی عرشه تقاطع فجر.',
    },
  ]);

  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('در انتظار تأیید');
  const [rejectReasonModalItem, setRejectReasonModalItem] = useState<ApprovalItem | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Approve single item
  const handleApprove = (item: ApprovalItem) => {
    setApprovalItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status: 'تأیید شده',
              notes: `${i.notes || ''} [تأیید شده توسط ${currentUser.name} در ${new Date().toLocaleDateString('fa-IR')}]`,
            }
          : i
      )
    );
    if (onItemApproved) onItemApproved(item);
  };

  // Reject single item
  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReasonModalItem) return;

    setApprovalItems((prev) =>
      prev.map((i) =>
        i.id === rejectReasonModalItem.id
          ? {
              ...i,
              status: 'رد شده',
              notes: `دلیل عدم تأیید: ${rejectReasonText}`,
            }
          : i
      )
    );

    if (onItemRejected) onItemRejected(rejectReasonModalItem, rejectReasonText);

    setRejectReasonModalItem(null);
    setRejectReasonText('');
  };

  // Batch approve all pending items
  const handleBatchApprovePending = () => {
    const pendingList = approvalItems.filter((i) => i.status === 'در انتظار تأیید');
    setApprovalItems((prev) =>
      prev.map((i) =>
        i.status === 'در انتظار تأیید'
          ? {
              ...i,
              status: 'تأیید شده',
              notes: `${i.notes || ''} [تأیید گروهی توسط ${currentUser.name}]`,
            }
          : i
      )
    );
    showNotification(`${pendingList.length} فقره درخواست با موفقیت به صورت گروهی تایید شدند.`);
  };

  const filteredItems = approvalItems.filter((i) => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (filterSource !== 'all' && i.sourceType !== filterSource) return false;
    if (filterPriority !== 'all' && i.priority !== filterPriority) return false;
    return true;
  });

  const pendingCount = approvalItems.filter((i) => i.status === 'در انتظار تأیید').length;
  const totalPendingAmount = approvalItems
    .filter((i) => i.status === 'در انتظار تأیید')
    .reduce((acc, i) => acc + i.amount, 0);

  return (
    <div className="space-y-6">
      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">✕</button>
        </div>
      )}
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded">
              مرکز مصوبات و کارتابل تاییدات مدیریت (Executive Approval Center)
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              پنجره واحد تایید اسناد مالی و عملیاتی
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            کارتابل تصمیم‌گیری، بررسی فنی-مالی و ابلاغ مصوبات مدیرعامل و هیئت مدیره
          </h2>
          <p className="text-xs text-slate-500">
            تجمیع فاکتورها، صورت‌وضعیت‌ها، هزینه‌های تنخواه، دستورهای پرداخت و درخواست‌های خرید
          </p>
        </div>

        {pendingCount > 0 && (
          <button
            onClick={handleBatchApprovePending}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>تأیید گروهی کلیه موارد در انتظار ({pendingCount})</span>
          </button>
        )}
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">تعداد موارد در انتظار مصوبه</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 font-mono">
            {pendingCount} <span className="text-xs text-slate-500 font-sans">مورد باز</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">جمع بار مالی در انتظار مصوبه</span>
            <CreditCard className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {formatNumber(totalPendingAmount)} <span className="text-xs text-slate-500 font-sans">تومان</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">سمت جاری کاربر در سیستم</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-sm font-bold text-slate-800">
            {currentUser.name} <span className="text-xs text-blue-600 font-normal">({currentUser.role})</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Selectors */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus('در انتظار تأیید')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              filterStatus === 'در انتظار تأیید'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            در انتظار مصوبه ({pendingCount})
          </button>
          <button
            onClick={() => setFilterStatus('تأیید شده')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              filterStatus === 'تأیید شده'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            تأیید شده‌ها
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            همه موارد
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
          >
            <option value="all">همه ماژول‌ها و منابع</option>
            <option value="فاکتور خرید تأمین‌کننده">فاکتورهای خرید تأمین‌کنندگان</option>
            <option value="صورت‌وضعیت پیمانکار جزء">صورت‌وضعیت‌های پیمانکاران جزء</option>
            <option value="هزینه و شارژ تنخواه">تنخواه کارگاهی</option>
            <option value="دستور پرداخت خزانه">دستورهای پرداخت خزانه</option>
            <option value="درخواست خرید کالا">درخواست‌های خرید کالا</option>
          </select>
        </div>

        <span className="text-slate-400 font-mono text-[11px]">
          تعداد: {filteredItems.length}
        </span>
      </div>

      {/* Approval Cards List */}
      <div className="space-y-3">
        {filteredItems.map((item) => {
          const isPending = item.status === 'در انتظار تأیید';
          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border p-4 shadow-2xs transition-all ${
                isPending
                  ? item.priority === 'بحرانی / فوری'
                    ? 'border-rose-200 hover:border-rose-300'
                    : 'border-slate-200 hover:border-slate-300'
                  : 'border-slate-100 bg-slate-50/50'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded">
                      {item.sourceType}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.docNumber}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        item.priority === 'بحرانی / فوری'
                          ? 'bg-rose-100 text-rose-800 font-bold animate-pulse'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.priority}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">• تاریخ ثبت: {item.date}</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-1">{item.title}</h3>

                  <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                    <div>
                      <span className="text-slate-400">پروژه: </span>
                      <strong className="text-slate-800">{item.projectName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">ذینفع / طرف‌حساب: </span>
                      <strong className="text-slate-800">{item.beneficiaryName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">ثبت‌کننده: </span>
                      <span>{item.submitter}</span>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="flex lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 gap-3">
                  <div className="text-left font-mono">
                    <span className="text-[10px] text-slate-400 font-sans block">مبلغ مصوبه:</span>
                    <strong className="text-base font-bold text-slate-900">
                      {formatNumber(item.amount)}{' '}
                      <span className="text-xs text-slate-500 font-sans">تومان</span>
                    </strong>
                  </div>

                  {isPending ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleApprove(item)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>تأیید و ابلاغ</span>
                      </button>
                      <button
                        onClick={() => setRejectReasonModalItem(item)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-lg text-xs cursor-pointer flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>عدم تأیید</span>
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-bold ${
                        item.status === 'تأیید شده'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reject Reason Modal */}
      {rejectReasonModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 text-right">
            <h3 className="text-sm font-bold text-slate-900 mb-1">عدم تأیید و ارجاع جهت اصلاح</h3>
            <p className="text-xs text-slate-500 mb-3 font-mono">{rejectReasonModalItem.docNumber}</p>

            <form onSubmit={handleConfirmReject} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">علت عدم تأیید و دستور اصلاح:</label>
                <textarea
                  rows={3}
                  placeholder="مثال: نقایص در صورتجلسه پیوست، مغایرت نرخ با قرارداد..."
                  value={rejectReasonText}
                  onChange={(e) => setRejectReasonText(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectReasonModalItem(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  ثبت عدم تأیید
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
