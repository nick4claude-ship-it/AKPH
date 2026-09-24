/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  FileCheck2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Layers,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building,
  RefreshCw,
  Wallet,
  Receipt,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import {
  BankAccount,
  Project,
  UserProfile,
} from '../../types';
import {
  PaymentRequest,
  TreasuryCheck,
  CashDesk,
  mockTreasuryChecks,
} from '../../data/paymentsTreasuryMockData';
import { useStoreSlice, usePostFinancialEvent } from '../../store/AppStore';
import { payableTypeForRequest } from '../../store/paymentRequests';
import { toPersianDate } from '../../utils/date';
import { formatCurrencyCompact, formatNumber } from '../../utils/formatters';

interface PaymentsTreasuryModuleProps {
  projects: Project[];
  currentUser: UserProfile;
  onPosted?: (docNumber: string) => void;
}

export const PaymentsTreasuryModule: React.FC<PaymentsTreasuryModuleProps> = ({
  projects,
  currentUser,
  onPosted,
}) => {
  const [activeTab, setActiveTab] = useState<'payment_requests' | 'receipts' | 'bank_accounts' | 'checks' | 'cash_desks' | 'liquidity_calendar'>('payment_requests');

  const postFinancialEvent = usePostFinancialEvent();
  const [paymentRequests, setPaymentRequests] = useStoreSlice('paymentRequests');
  const [checks, setChecks] = useState<TreasuryCheck[]>(mockTreasuryChecks);
  const [cashDesks] = useStoreSlice('cashDesks');
  const [bankAccounts] = useStoreSlice('bankAccounts');
  const [, setVendorInvoices] = useStoreSlice('vendorInvoices');
  const [, setSubcontractorStatements] = useStoreSlice('subcontractorStatements');
  const [, setSubcontractorContracts] = useStoreSlice('subcontractorContracts');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  // Modal state for paying a request
  const [selectedRequestForPay, setSelectedRequestForPay] = useState<PaymentRequest | null>(null);
  const [paymentBankId, setPaymentBankId] = useState(bankAccounts[0]?.id || '');
  const [paymentTrackingNo, setPaymentTrackingNo] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Modal for new payment request
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [newRequestBeneficiary, setNewRequestBeneficiary] = useState('');
  const [newRequestAmount, setNewRequestAmount] = useState('');
  const [newRequestSource, setNewRequestSource] = useState<any>('صورت‌وضعیت پیمانکار جزء');
  const [newRequestProject, setNewRequestProject] = useState(projects[0]?.id || '');
  const [newRequestDueDate, setNewRequestDueDate] = useState('۱۴۰۳/۰۷/۱۵');

  // KPI Calculations
  const totalPendingPayments = paymentRequests
    .filter((p) => p.status !== 'پرداخت شده' && p.status !== 'رد شده')
    .reduce((acc, p) => acc + p.remainingAmount, 0);

  const totalPaidThisMonth = paymentRequests
    .filter((p) => p.status === 'پرداخت شده')
    .reduce((acc, p) => acc + p.paidAmount, 0);

  const totalLiquidCash = bankAccounts.reduce((acc, b) => acc + b.balance, 0) + cashDesks.reduce((acc, c) => acc + c.balance, 0);

  const upcomingChecksDue = checks
    .filter((c) => c.status === 'در جریان وصول/سررسید' && c.checkType === 'صادره (پرداختی)')
    .reduce((acc, c) => acc + c.amount, 0);

  // Approve payment request handler
  const handleApproveRequest = (reqId: string) => {
    setPaymentRequests((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: 'تأیید مدیرعامل',
              approvedBy: `${currentUser.name} (${currentUser.role})`,
              approvedDate: '۱۴۰۳/۰۷/۰۳',
            }
          : r
      )
    );
  };

  // Reject payment request handler
  const handleRejectRequest = (reqId: string) => {
    setPaymentRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: 'رد شده' } : r))
    );
  };

  // Execute payment transaction
  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestForPay) return;

    const bank = bankAccounts.find((b) => b.id === paymentBankId) || bankAccounts[0];
    const req = selectedRequestForPay;
    const amount = req.remainingAmount;
    const paymentDate = toPersianDate(new Date());
    const trackingNumber = paymentTrackingNo || `TRK-${Date.now().toString().slice(-6)}`;

    // The bank balance and the settled payable change only through this posting (Dr payable / Cr bank).
    const posting = postFinancialEvent(
      {
        type: 'TREASURY_PAYMENT',
        sourceModule: 'treasury',
        sourceId: req.id,
        projectId: req.projectId,
        costCenterId: req.costCenterId,
        counterpartyId: req.counterpartyId || '',
        amount,
        date: paymentDate,
        details: {
          docNumber: req.requestNumber,
          payableType: payableTypeForRequest(req),
          bankAccountId: bank.id,
          bankName: bank.bankName,
          pettyCashId: req.sourceType === 'شارژ و تسویه تنخواه' ? req.sourceRefId : undefined,
          pettyCashTitle: req.sourceType === 'شارژ و تسویه تنخواه' ? req.beneficiaryName : undefined,
          trackingNumber,
        },
      },
      { submitter: currentUser.name }
    );
    if (!posting.ok) return;

    setPaymentRequests((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? {
              ...r,
              status: 'پرداخت شده',
              paidAmount: r.paidAmount + amount,
              remainingAmount: 0,
              payerBankAccountId: bank.id,
              payerBankAccountName: `${bank.bankName} - ${bank.accountNumber}`,
              paymentDate,
              trackingNumber,
              journalEntryId: posting.event?.docNumber,
              notes: paymentNotes || r.notes,
            }
          : r
      )
    );

    // Reflect the settlement on the operational source document.
    if (!posting.duplicate) {
      if (req.sourceType === 'فاکتور خرید تأمین‌کننده') {
        setVendorInvoices((prev) =>
          prev.map((inv) => {
            if (inv.id !== req.sourceRefId) return inv;
            const paidAmount = inv.paidAmount + amount;
            const remainingBalance = Math.max(0, inv.totalAmount - paidAmount);
            return { ...inv, paidAmount, remainingBalance, status: remainingBalance === 0 ? 'پرداخت شده' : 'پرداخت ناقص' };
          })
        );
      } else if (req.sourceType === 'صورت‌وضعیت پیمانکار جزء') {
        let contractId: string | undefined;
        setSubcontractorStatements((prev) =>
          prev.map((st) => {
            if (st.id !== req.sourceRefId) return st;
            contractId = st.subcontractorContractId;
            const remainingPayable = Math.max(0, st.remainingPayable - amount);
            return {
              ...st,
              paidAmount: st.paidAmount + amount,
              remainingPayable,
              status: remainingPayable === 0 ? 'paid' : st.status,
              paymentDate,
              paymentRefNumber: trackingNumber,
              payingBankId: bank.id,
              payingBankTitle: bank.bankName,
            };
          })
        );
        if (contractId) {
          setSubcontractorContracts((prev) =>
            prev.map((c) =>
              c.id === contractId
                ? { ...c, paidValue: c.paidValue + amount, remainingPayableValue: Math.max(0, c.remainingPayableValue - amount) }
                : c
            )
          );
        }
      }
      if (posting.event?.docNumber) onPosted?.(posting.event.docNumber);
    }

    setSelectedRequestForPay(null);
    setPaymentTrackingNo('');
    setPaymentNotes('');
  };

  // Create new payment request handler
  const handleCreateNewRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newRequestAmount.replace(/,/g, ''));
    if (!amt || !newRequestBeneficiary) return;

    const proj = projects.find((p) => p.id === newRequestProject) || projects[0];

    const newReq: PaymentRequest = {
      id: `pr-${Date.now()}`,
      requestNumber: `PR-1403-${paymentRequests.length + 701}`,
      sourceType: newRequestSource,
      sourceRefId: `REF-${Date.now().toString().slice(-4)}`,
      sourceRefNumber: `DOC-${Date.now().toString().slice(-4)}`,
      date: '۱۴۰۳/۰۷/۰۳',
      dueDate: newRequestDueDate,
      projectId: proj.id,
      projectName: proj.name,
      costCenterId: 'CC-GEN',
      beneficiaryName: newRequestBeneficiary,
      beneficiaryType: 'پیمانکار جزء',
      beneficiaryAccount: {
        bankName: 'بانک عامل طرف حساب',
        shebaNumber: 'IR000000000000000000000000',
        accountNumber: '---',
      },
      totalAmount: amt,
      approvedAmount: amt,
      paidAmount: 0,
      remainingAmount: amt,
      priority: 'عادی',
      status: 'در انتظار تأیید مالی',
    };

    setPaymentRequests((prev) => [newReq, ...prev]);
    setIsNewRequestModalOpen(false);
    setNewRequestBeneficiary('');
    setNewRequestAmount('');
  };

  const filteredRequests = paymentRequests.filter((r) => {
    if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
    if (selectedProjectId !== 'all' && r.projectId !== selectedProjectId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.requestNumber.toLowerCase().includes(q) ||
        r.beneficiaryName.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
              لایه مستقل مالی و خزانه‌داری (Treasury & Cash Management)
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              جریان نقدینگی و کنترل بانک‌ها
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            مدیریت دریافت و پرداخت‌ها، حساب‌های بانکی، صندوق و چک‌های صیادی
          </h2>
          <p className="text-xs text-slate-500">
            تأیید دستور پرداخت ← کنترل نقدینگی خزانه‌داری ← صدور حواله/چک ← صدور سند حسابداری
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewRequestModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ثبت درخواست پرداخت جدید</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">نقدینگی در دسترس (بانک‌ها و صندوق)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            {formatNumber(totalLiquidCash)} <span className="text-xs text-slate-500 font-sans">تومان</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">موجودی تجمیعی ۳ حساب بانکی و ۳ صندوق</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">درخواست‌های پرداخت در صف</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-amber-700 font-mono">
            {formatNumber(totalPendingPayments)} <span className="text-xs text-slate-500 font-sans">تومان</span>
          </div>
          <span className="text-[11px] text-amber-600 font-medium">
            {paymentRequests.filter((p) => p.status !== 'پرداخت شده').length} فقره دستور پرداخت آماده تسویه
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">چک‌های سررسید جاری (۳۰ روز آینده)</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-rose-700 font-mono">
            {formatNumber(upcomingChecksDue)} <span className="text-xs text-slate-500 font-sans">تومان</span>
          </div>
          <span className="text-[11px] text-rose-600 font-medium">تعهد چک‌های صیادی صادره به فروشندگان</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">کل پرداخت‌های قطعی دوره</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-blue-700 font-mono">
            {formatNumber(totalPaidThisMonth)} <span className="text-xs text-slate-500 font-sans">تومان</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">همراه با ثبت اتوماتیک در اسناد حسابداری</span>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        <button
          onClick={() => setActiveTab('payment_requests')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'payment_requests'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-amber-400" />
          <span>کارتابل درخواست‌های پرداخت (Payables)</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-slate-800 text-amber-300">
            {paymentRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('bank_accounts')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'bank_accounts'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Landmark className="w-3.5 h-3.5 text-emerald-400" />
          <span>حساب‌های بانکی و مغایرت</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-slate-100 text-slate-600">
            {bankAccounts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('checks')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'checks'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-blue-400" />
          <span>مدیریت چک‌های صیادی (وارده/صادره)</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-slate-100 text-slate-600">
            {checks.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('cash_desks')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'cash_desks'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 text-purple-400" />
          <span>صندوق‌های نقد کارگاهی</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-slate-100 text-slate-600">
            {cashDesks.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Payment Requests Workflow */}
      {activeTab === 'payment_requests' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="جستجوی شماره دستور، ذینفع، پروژه..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="در انتظار تأیید مالی">در انتظار تأیید مالی</option>
                <option value="تأیید مدیرعامل">تأیید مدیرعامل</option>
                <option value="در صف پرداخت خزانه">در صف پرداخت خزانه</option>
                <option value="پرداخت شده">پرداخت شده</option>
                <option value="رد شده">رد شده</option>
              </select>

              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
              >
                <option value="all">همه پروژه‌ها</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-400 font-mono text-[11px]">
              تعداد موارد یافته شده: {filteredRequests.length}
            </span>
          </div>

          {/* Payment Requests Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">شماره و تاریخ</th>
                    <th className="py-3 px-3">منبع و ارجاع</th>
                    <th className="py-3 px-3">پروژه و مرکز هزینه</th>
                    <th className="py-3 px-3">ذینفع و حساب بانکی</th>
                    <th className="py-3 px-3 text-left">مبلغ کل (تومان)</th>
                    <th className="py-3 px-3 text-left">مانده پرداختنی</th>
                    <th className="py-3 px-3">سررسید</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((req) => {
                    const isFullyPaid = req.status === 'پرداخت شده';
                    return (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          <strong className="block text-slate-900 font-mono">{req.requestNumber}</strong>
                          <span className="text-[10px] text-slate-400">{req.date}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                            {req.sourceType}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                            {req.sourceRefNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-800 block truncate max-w-[160px]">
                            {req.projectName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{req.costCenterId}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{req.beneficiaryName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {req.beneficiaryAccount.bankName} - {req.beneficiaryAccount.accountNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-left font-mono font-bold text-slate-900">
                          {formatNumber(req.totalAmount)}
                        </td>
                        <td className="py-3 px-3 text-left font-mono font-bold text-amber-700">
                          {formatNumber(req.remainingAmount)}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {req.dueDate}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              req.status === 'پرداخت شده'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : req.status === 'تأیید مدیرعامل'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : req.status === 'در صف پرداخت خزانه'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : req.status === 'رد شده'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {req.status === 'در انتظار تأیید مالی' && (
                              <>
                                <button
                                  onClick={() => handleApproveRequest(req.id)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  تأیید
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(req.id)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded text-[10px] cursor-pointer"
                                >
                                  رد
                                </button>
                              </>
                            )}

                            {(req.status === 'تأیید مدیرعامل' || req.status === 'در صف پرداخت خزانه') && (
                              <button
                                onClick={() => setSelectedRequestForPay(req)}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[11px] transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>ثبت پرداخت وجه</span>
                              </button>
                            )}

                            {isFullyPaid && (
                              <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-1 justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{req.trackingNumber || 'تسویه شد'}</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Bank Accounts & Reconciliation */}
      {activeTab === 'bank_accounts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bankAccounts.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-900 text-sm">{b.bankName}</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-mono px-2 py-0.5 rounded">
                    {b.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600 mb-4 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">شماره حساب:</span>
                    <span>{b.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">شماره شبا:</span>
                    <span className="text-[11px]">{b.shebaNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">شعبه:</span>
                    <span className="font-sans">{b.branch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">صاحب حساب:</span>
                    <span className="font-sans font-medium text-slate-900">{b.holderName}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">موجودی فعلی:</span>
                  <strong className="text-base font-bold text-slate-900 font-mono">
                    {formatNumber(b.balance)}{' '}
                    <span className="text-[11px] font-sans font-normal text-slate-500">تومان</span>
                  </strong>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              <span>وضعیت تطبیق و مغایرت‌گیری بانکی (Bank Reconciliation)</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              کلیه واریزی‌های صورت‌وضعیت‌ها و برداشت‌های حواله ساتنا با صورتحساب رسمی بانک مرکزی مطابقت داده شده‌اند. در حال حاضر هیچ تراکنش باز یا مغایرت شناسایی‌نشده در پایان دوره جاری وجود ندارد.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Treasury Sayad Checks */}
      {activeTab === 'checks' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>دفتر مدیریت چک‌های صیادی بنفش (سامانه صیاد بانک مرکزی)</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              تعداد چک‌های ثبتی: {checks.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-3">نوع چک</th>
                  <th className="py-3 px-3">شناسه ۱۶ رقمی صیاد</th>
                  <th className="py-3 px-3">بانک و شماره چک</th>
                  <th className="py-3 px-3">صادرکننده / در وجه</th>
                  <th className="py-3 px-3">پروژه مرتبط</th>
                  <th className="py-3 px-3 text-left">مبلغ (تومان)</th>
                  <th className="py-3 px-3">سررسید</th>
                  <th className="py-3 px-3">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checks.map((chk) => (
                  <tr key={chk.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          chk.checkType === 'صادره (پرداختی)'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {chk.checkType}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 tracking-wider">
                      {chk.sayadNumber}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-slate-800">{chk.bankName}</span>
                      <span className="block text-[10px] text-slate-400 font-mono">چک #{chk.checkNumber}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-slate-900 block font-medium">{chk.payee}</span>
                      <span className="text-[10px] text-slate-400">صادرکننده: {chk.drawer}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {chk.projectName || '---'}
                    </td>
                    <td className="py-3 px-3 text-left font-mono font-bold text-slate-900">
                      {formatNumber(chk.amount)}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 font-medium">
                      {chk.dueDate}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          chk.status === 'پاس شده و تسویه'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {chk.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Cash Desks */}
      {activeTab === 'cash_desks' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cashDesks.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900 text-sm">{c.title}</span>
                <span className="text-[10px] bg-purple-50 text-purple-700 font-mono px-2 py-0.5 rounded">
                  {c.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">{c.location}</p>

              <div className="space-y-1.5 text-xs text-slate-600 mb-4 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">مسئول صندوق:</span>
                  <span className="font-sans font-medium text-slate-900">{c.keeperName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">پروژه:</span>
                  <span className="font-sans">{c.projectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">سقف مجاز:</span>
                  <span>{formatNumber(c.ceilingLimit)} تومان</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">آخرین شمارش فیزیکی:</span>
                  <span>{c.lastAuditDate}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">موجودی نقدی:</span>
                <strong className="text-base font-bold text-purple-900 font-mono">
                  {formatNumber(c.balance)} <span className="text-[11px] font-sans font-normal text-slate-500">تومان</span>
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Execute Payment to Beneficiary */}
      {selectedRequestForPay && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 text-right animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">دستور پرداخت و خروج نقدینگی از حساب</h3>
                  <span className="text-xs text-slate-500 font-mono">{selectedRequestForPay.requestNumber}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequestForPay(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">دریافت‌کننده وجه (ذینفع):</span>
                <strong className="text-slate-900">{selectedRequestForPay.beneficiaryName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">بابت:</span>
                <span>{selectedRequestForPay.sourceType} ({selectedRequestForPay.sourceRefNumber})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">پروژه:</span>
                <span>{selectedRequestForPay.projectName}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-700">مبلغ پرداخت:</span>
                <strong className="text-amber-800 font-mono font-bold">
                  {formatNumber(selectedRequestForPay.remainingAmount)} تومان
                </strong>
              </div>
            </div>

            <form onSubmit={handleExecutePayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">حساب بانکی مبدأ (پرداخت‌کننده):</label>
                <select
                  value={paymentBankId}
                  onChange={(e) => setPaymentBankId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:border-amber-500"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber} (موجودی: {formatCurrencyCompact(b.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">شماره پیگیری / ارجاع ساتنا / پایا:</label>
                <input
                  type="text"
                  placeholder="مثال: SATNA-9182049182"
                  value={paymentTrackingNo}
                  onChange={(e) => setPaymentTrackingNo(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">توضیحات واریز:</label>
                <input
                  type="text"
                  placeholder="تسویه قطعی صورت‌وضعیت / پیش‌پرداخت خرید..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRequestForPay(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer shadow-xs"
                >
                  تأیید پرداخت و کسر از حساب بانک
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Payment Request */}
      {isNewRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">ایجاد دستور پرداخت جدید در خزانه‌داری</h3>
              <button
                onClick={() => setIsNewRequestModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewRequest} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">منبع ایجاد تعهد:</label>
                <select
                  value={newRequestSource}
                  onChange={(e) => setNewRequestSource(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  <option value="صورت‌وضعیت پیمانکار جزء">صورت‌وضعیت پیمانکار جزء</option>
                  <option value="فاکتور خرید تأمین‌کننده">فاکتور خرید تأمین‌کننده</option>
                  <option value="شارژ و تسویه تنخواه">شارژ و تسویه تنخواه</option>
                  <option value="حقوق و دستمزد ماهانه">حقوق و دستمزد ماهانه</option>
                  <option value="پیش‌پرداخت خرید">پیش‌پرداخت خرید</option>
                  <option value="سایر هزینه‌های عمومی">سایر هزینه‌های عمومی</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">نام طرف حساب / ذینفع دریافت وجه:</label>
                <input
                  type="text"
                  placeholder="مثال: شرکت آرمان بتن سازه / مهندس اکبری..."
                  value={newRequestBeneficiary}
                  onChange={(e) => setNewRequestBeneficiary(e.target.value)}
                  required
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">پروژه منتسب:</label>
                <select
                  value={newRequestProject}
                  onChange={(e) => setNewRequestProject(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">مبلغ درخواستی (تومان):</label>
                <input
                  type="number"
                  placeholder="مثال: 120000000"
                  value={newRequestAmount}
                  onChange={(e) => setNewRequestAmount(e.target.value)}
                  required
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">تاریخ سررسید موردنظر:</label>
                <input
                  type="text"
                  value={newRequestDueDate}
                  onChange={(e) => setNewRequestDueDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewRequestModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  ثبت در کارتابل پرداخت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
