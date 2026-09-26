/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { Project, UserProfile, PaymentRequest } from '../../types';
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { usePermission } from '../../store/session';
import { selectPaymentSchedule } from '../../store/domainSelectors';
import { toPersianDate } from '../../utils/date';
import { usePagination } from '../../store/pagination';
import { TablePager } from '../common/TablePager';
import { MoneyInput } from '../../ui/NumberInput';
import { TreasuryReceiptsTab } from './TreasuryReceiptsTab';
import { PaymentScheduleTab } from './PaymentScheduleTab';

export type TreasuryTab = 'payment_requests' | 'receipts' | 'bank_accounts' | 'checks' | 'cash_desks' | 'liquidity_calendar';
const TAB_PATHS: Partial<Record<TreasuryTab, string>> = {
  payment_requests: '/finance/payments',
  receipts: '/finance/receipts',
  bank_accounts: '/finance/banks',
  cash_desks: '/finance/cash',
};
import { formatCurrencyCompact, formatInt, formatText } from '../../utils/formatters';
import { Dialog } from '../../ui/Dialog';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { paymentRequestActions, selectTreasuryKpis } from '../../store/views/treasury';
import { Money } from '../common/Money';

interface PaymentsTreasuryModuleProps {
  /** Initial tab from the route (payments, receipts, banks, cash). */
  tab: TreasuryTab;
  projects: Project[];
  currentUser: UserProfile;
  onToast: (msg: string) => void;
}

export const PaymentsTreasuryModule: React.FC<PaymentsTreasuryModuleProps> = ({
  tab,
  projects,
  currentUser,
  onToast,
}) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sourceFilter = params.get('source');
  const wf = useWorkflows();
  const { can } = usePermission();
  const appState = useAppState();
  const schedule = useMemo(() => selectPaymentSchedule(appState), [appState]);
  const [innerTab, setInnerTab] = useState<TreasuryTab>(tab);
  const activeTab = innerTab;
  // Routed tabs change the URL (so links and Back work); checks and schedule are in-page tabs.
  const setActiveTab = (t: TreasuryTab) => (TAB_PATHS[t] && t !== tab ? navigate(TAB_PATHS[t]!) : setInnerTab(t));

  const { paymentRequests, treasuryChecks: checks, cashDesks, bankAccounts } = appState;

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  // Modal state for paying a request
  const [selectedRequestForPay, setSelectedRequestForPay] = useState<PaymentRequest | null>(null);
  // No default account: the payer account (bank or cash desk) must be chosen explicitly.
  const [paymentSourceId, setPaymentSourceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [payError, setPayError] = useState<string | null>(null);
  const [paymentTrackingNo, setPaymentTrackingNo] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Modal for new payment request
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [newRequestBeneficiary, setNewRequestBeneficiary] = useState('');
  const [newRequestAmount, setNewRequestAmount] = useState(0);
  const [newRequestError, setNewRequestError] = useState<string | null>(null);
  // Requests for statements, invoices, payroll and petty cash are created by their modules; only
  // payments without a source document can be entered manually here.
  const [newRequestSource, setNewRequestSource] = useState<PaymentRequest['sourceType']>('سایر هزینه‌های عمومی');
  const [newRequestLiability, setNewRequestLiability] = useState<'insurance' | 'vat' | 'payroll' | 'withholding'>('insurance');
  const [newRequestProject, setNewRequestProject] = useState(projects[0]?.id || '');
  const [newRequestDueDate, setNewRequestDueDate] = useState(() => toPersianDate(new Date()));

  // KPIs (store view model).
  const { totalPendingPayments, totalPaidThisMonth, totalLiquidCash, upcomingChecksDue } = useMemo(() => selectTreasuryKpis(appState), [appState]);

  const handleApproveRequest = (reqId: string) => onToast(wf.approvePaymentRequest(reqId).message);
  const handleRejectRequest = (reqId: string) => onToast(wf.rejectPaymentRequest(reqId, 'رد توسط خزانه‌داری').message);

  const openPayment = (req: PaymentRequest) => {
    setSelectedRequestForPay(req);
    setPaymentSourceId('');
    setPaymentAmount(req.remainingAmount);
    setPayError(null);
  };

  // Execute payment: posting (with balance control) and source-document update happen in the workflow.
  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestForPay) return;
    const result = wf.payRequestForm({
      requestId: selectedRequestForPay.id,
      sourceId: paymentSourceId,
      amount: paymentAmount,
      trackingNumber: paymentTrackingNo,
    });
    if (!result.ok) return setPayError(result.message);
    onToast(result.message);
    setPayError(null);
    setSelectedRequestForPay(null);
    setPaymentTrackingNo('');
    setPaymentNotes('');
  };

  // Manual request (no source document): created through the workflow with a sequential number.
  const handleCreateNewRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const result = wf.createManualPaymentRequest({
      sourceType: newRequestSource,
      liability: newRequestLiability,
      projectId: newRequestProject,
      beneficiaryName: newRequestBeneficiary,
      amount: newRequestAmount,
      dueDate: newRequestDueDate,
    });
    if (!result.ok) return setNewRequestError(result.message);
    onToast(result.message);
    setIsNewRequestModalOpen(false);
    setNewRequestBeneficiary('');
    setNewRequestAmount(0);
    setNewRequestError(null);
  };

  const filteredRequests = paymentRequests.filter((r) => {
    if (sourceFilter && r.sourceRefId !== sourceFilter) return false;
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
  const requestsPage = usePagination(filteredRequests, filteredRequests.length);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded">
              لایه مستقل مالی و خزانه‌داری
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded tabular-nums">
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
          {can('payment_request.create') && (
          <button
            onClick={() => setIsNewRequestModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ثبت درخواست پرداخت جدید</span>
          </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">نقدینگی در دسترس (بانک‌ها و صندوق)</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 tabular-nums">
            {formatMoney(totalLiquidCash, false)} <span className="text-xs text-slate-500 font-sans">{moneyUnitLabel()}</span>
          </div>
          <span className="text-sm text-emerald-700 font-medium">موجودی تجمیعی ۳ حساب بانکی و ۳ صندوق</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">درخواست‌های پرداخت در صف</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-amber-700 tabular-nums">
            <Money rial={totalPendingPayments} />
          </div>
          <span className="text-sm text-amber-700 font-medium">
            {formatInt(paymentRequests.filter((p) => p.status !== 'پرداخت شده').length)} فقره دستور پرداخت آماده تسویه
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">چک‌های سررسید جاری (۳۰ روز آینده)</span>
            <div className="p-2 bg-rose-50 text-rose-700 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-rose-700 tabular-nums">
            <Money rial={upcomingChecksDue} />
          </div>
          <span className="text-sm text-rose-700 font-medium">تعهد چک‌های صیادی صادره به فروشندگان</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">کل پرداخت‌های قطعی دوره</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-blue-700 tabular-nums">
            {formatMoney(totalPaidThisMonth, false)} <span className="text-xs text-slate-500 font-sans">{moneyUnitLabel()}</span>
          </div>
          <span className="text-xs text-slate-500 font-medium">همراه با ثبت اتوماتیک در اسناد حسابداری</span>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        <button
          onClick={() => setActiveTab('payment_requests')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'payment_requests'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-amber-400" />
          <span>کارتابل درخواست‌های پرداخت</span>
          <span className="text-xs px-2 py-1 rounded-full tabular-nums bg-slate-800 text-amber-300">
            {formatInt(paymentRequests.length)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('liquidity_calendar')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'liquidity_calendar'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-rose-400" />
          <span>برنامه پرداخت</span>
          <span className="text-xs px-2 py-1 rounded-full tabular-nums bg-slate-100 text-slate-600">
            {formatInt(schedule.rows.length)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'receipts'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
          <span>دریافت‌ها</span>
          <span className="text-xs px-2 py-1 rounded-full tabular-nums bg-slate-100 text-slate-600">
            {formatInt(appState.receipts.length)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('bank_accounts')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'bank_accounts'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Landmark className="w-3.5 h-3.5 text-emerald-400" />
          <span>حساب‌های بانکی و مغایرت</span>
          <span className="text-xs px-2 py-1 rounded-full tabular-nums bg-slate-100 text-slate-600">
            {formatInt(bankAccounts.length)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('checks')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'checks'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-blue-400" />
          <span>مدیریت چک‌های صیادی (وارده/صادره)</span>
          <span className="text-xs px-2 py-1 rounded-full tabular-nums bg-slate-100 text-slate-600">
            {formatInt(checks.length)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('cash_desks')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'cash_desks'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 text-purple-400" />
          <span>صندوق‌های نقد کارگاهی</span>
          <span className="text-xs px-2 py-1 rounded-full tabular-nums bg-slate-100 text-slate-600">
            {formatInt(cashDesks.length)}
          </span>
        </button>
      </div>

      {/* Tab 1: Payment Requests Workflow */}
      {activeTab === 'payment_requests' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
                <input aria-label="جستجوی شماره دستور، ذینفع، پروژه"
                  type="text"
                  placeholder="جستجوی شماره دستور، ذینفع، پروژه..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <select aria-label="فیلتر: وضعیت‌ها"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="py-2 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="در انتظار تأیید مالی">در انتظار تأیید مالی</option>
                <option value="تأیید مدیر ارشد">تأیید مدیر ارشد</option>
                <option value="در صف پرداخت خزانه">در صف پرداخت خزانه</option>
                <option value="پرداخت شده">پرداخت شده</option>
                <option value="رد شده">رد شده</option>
              </select>

              <select aria-label="فیلتر: پروژه‌ها"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="py-2 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
              >
                <option value="all">همه پروژه‌ها</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatText(p.name)}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-500 tabular-nums text-xs">
              تعداد موارد یافته شده: {formatInt(filteredRequests.length)}
            </span>
          </div>

          {/* Payment Requests Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="table-scroll">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">شماره و تاریخ</th>
                    <th className="py-3 px-3">منبع و ارجاع</th>
                    <th className="py-3 px-3">پروژه و مرکز هزینه</th>
                    <th className="py-3 px-3">ذینفع و حساب بانکی</th>
                    <th className="py-3 px-3 text-left">مبلغ کل ({moneyUnitLabel()})</th>
                    <th className="py-3 px-3 text-left">مانده پرداختنی</th>
                    <th className="py-3 px-3">سررسید</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requestsPage.rows.map((req) => {
                    const isFullyPaid = req.status === 'پرداخت شده';
                    return (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          <strong className="block text-slate-900 tabular-nums">{formatText(req.requestNumber)}</strong>
                          <span className="text-xs text-slate-500">{formatText(req.date)}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                            {formatText(req.sourceType)}
                          </span>
                          <span className="block text-xs text-slate-500 tabular-nums mt-1">
                            {formatText(req.sourceRefNumber)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-800 block truncate max-w-[160px]">
                            {formatText(req.projectName)}
                          </span>
                          <span className="text-xs text-slate-500 tabular-nums">{formatText(req.costCenterId)}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{formatText(req.beneficiaryName)}</span>
                          <span className="text-xs text-slate-500 tabular-nums">
                            {formatText(req.beneficiaryAccount.bankName)} - {formatText(req.beneficiaryAccount.accountNumber)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-left tabular-nums font-bold text-slate-900">
                          {formatMoney(req.totalAmount, false)}
                        </td>
                        <td className="py-3 px-3 text-left tabular-nums font-bold text-amber-700">
                          {formatMoney(req.remainingAmount, false)}
                        </td>
                        <td className="py-3 px-3 tabular-nums text-slate-600">
                          {formatText(req.dueDate)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              req.status === 'پرداخت شده'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : req.status === 'تأیید مدیر ارشد'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : req.status === 'در صف پرداخت خزانه'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : req.status === 'رد شده'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {formatText(req.status)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {paymentRequestActions(currentUser, req).canApprove && (
                              <>
                                <button
                                  onClick={() => handleApproveRequest(req.id)}
                                  className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold cursor-pointer"
                                >
                                  تأیید
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(req.id)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded text-xs cursor-pointer"
                                >
                                  رد
                                </button>
                              </>
                            )}

                            {paymentRequestActions(currentUser, req).canPay && (
                              <button
                                onClick={() => openPayment(req)}
                                className="btn btn-primary btn-sm"
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>ثبت پرداخت وجه</span>
                              </button>
                            )}

                            {isFullyPaid && (
                              <span className="text-sm text-emerald-700 tabular-nums flex items-center gap-1 justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{formatText(req.trackingNumber || 'تسویه شد')}</span>
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
            <TablePager pager={requestsPage} label="صفحه‌بندی درخواست‌های پرداخت" />
          </div>
        </div>
      )}

      {activeTab === 'receipts' && <TreasuryReceiptsTab onToast={onToast} />}

      {activeTab === 'liquidity_calendar' && <PaymentScheduleTab schedule={schedule} onPay={(req) => {
        setInnerTab('payment_requests');
        openPayment(req);
      }} />}

      {/* Tab 2: Bank Accounts & Reconciliation */}
      {activeTab === 'bank_accounts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bankAccounts.map((b) => (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-900 text-sm">{formatText(b.bankName)}</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 tabular-nums px-2 py-1 rounded">
                    {formatText(b.status)}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-slate-600 mb-4 tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">شماره حساب:</span>
                    <span>{formatText(b.accountNumber)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">شماره شبا:</span>
                    <span className="text-sm">{formatText(b.shebaNumber)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">شعبه:</span>
                    <span className="font-sans">{formatText(b.branch)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">صاحب حساب:</span>
                    <span className="font-sans font-medium text-slate-900">{formatText(b.holderName)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">موجودی فعلی:</span>
                  <strong className="text-base font-bold text-slate-900 tabular-nums">
                    {formatMoney(b.balance, false)}{' '}
                    <span className="text-xs font-sans font-normal text-slate-500">{moneyUnitLabel()}</span>
                  </strong>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-700" />
              <span>وضعیت تطبیق و مغایرت‌گیری بانکی</span>
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
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>دفتر مدیریت چک‌های صیادی بنفش (سامانه صیاد بانک مرکزی)</span>
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              تعداد چک‌های ثبتی: {formatInt(checks.length)}
            </span>
          </div>

          <div className="table-scroll">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-3 px-3">نوع چک</th>
                  <th className="py-3 px-3">شناسه ۱۶ رقمی صیاد</th>
                  <th className="py-3 px-3">بانک و شماره چک</th>
                  <th className="py-3 px-3">صادرکننده / در وجه</th>
                  <th className="py-3 px-3">پروژه مرتبط</th>
                  <th className="py-3 px-3 text-left">مبلغ ({moneyUnitLabel()})</th>
                  <th className="py-3 px-3">سررسید</th>
                  <th className="py-3 px-3">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checks.map((chk) => (
                  <tr key={chk.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          chk.checkType === 'صادره (پرداختی)'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {formatText(chk.checkType)}
                      </span>
                    </td>
                    <td className="py-3 px-3 tabular-nums font-bold text-slate-900">
                      {formatText(chk.sayadNumber)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-slate-800">{formatText(chk.bankName)}</span>
                      <span className="block text-xs text-slate-500 tabular-nums">چک #{formatText(chk.checkNumber)}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-slate-900 block font-medium">{formatText(chk.payee)}</span>
                      <span className="text-xs text-slate-500">صادرکننده: {formatText(chk.drawer)}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {formatText(chk.projectName || '---')}
                    </td>
                    <td className="py-3 px-3 text-left tabular-nums font-bold text-slate-900">
                      {formatMoney(chk.amount, false)}
                    </td>
                    <td className="py-3 px-3 tabular-nums text-slate-700 font-medium">
                      {formatText(chk.dueDate)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          chk.status === 'پاس شده و تسویه'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {formatText(chk.status)}
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
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900 text-sm">{formatText(c.title)}</span>
                <span className="text-xs bg-purple-50 text-purple-700 tabular-nums px-2 py-1 rounded">
                  {formatText(c.code)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">{formatText(c.location)}</p>

              <div className="space-y-2 text-sm text-slate-600 mb-4 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">مسئول صندوق:</span>
                  <span className="font-sans font-medium text-slate-900">{formatText(c.keeperName)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">پروژه:</span>
                  <span className="font-sans">{formatText(c.projectName)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">سقف مجاز:</span>
                  <span><Money rial={c.ceilingLimit} /></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">آخرین شمارش فیزیکی:</span>
                  <span>{formatText(c.lastAuditDate)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">موجودی نقدی:</span>
                <strong className="text-base font-bold text-purple-900 tabular-nums">
                  {formatMoney(c.balance, false)} <span className="text-xs font-sans font-normal text-slate-500">{moneyUnitLabel()}</span>
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Execute Payment to Beneficiary */}
      {selectedRequestForPay && (
        <Dialog onClose={() => setSelectedRequestForPay(null)} label="دستور پرداخت و خروج نقدینگی از حساب" overlayClassName="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 text-right animate-in fade-in zoom-in-95 duration-150">
          
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">دستور پرداخت و خروج نقدینگی از حساب</h3>
                  <span className="text-xs text-slate-500 tabular-nums">{formatText(selectedRequestForPay.requestNumber)}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequestForPay(null)}
                className="p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">دریافت‌کننده وجه (ذینفع):</span>
                <strong className="text-slate-900">{formatText(selectedRequestForPay.beneficiaryName)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">بابت:</span>
                <span>{formatText(selectedRequestForPay.sourceType)} ({selectedRequestForPay.sourceRefNumber})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">پروژه:</span>
                <span>{formatText(selectedRequestForPay.projectName)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-700">مانده قابل پرداخت:</span>
                <strong className="text-amber-800 tabular-nums font-bold">
                  <Money rial={selectedRequestForPay.remainingAmount} />
                </strong>
              </div>
            </div>

            <form onSubmit={handleExecutePayment} className="space-y-4 text-sm">
              <div>
                <label htmlFor="payments-treasury-module-1" className="block font-medium text-slate-700 mb-1">حساب بانکی یا صندوق پرداخت‌کننده:</label>
                <select id="payments-treasury-module-1"
                  value={paymentSourceId}
                  onChange={(e) => setPaymentSourceId(e.target.value)}
                  required
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">— انتخاب حساب پرداخت —</option>
                  <optgroup label="حساب‌های بانکی">
                    {bankAccounts.filter((b) => b.status === 'فعال').map((b) => (
                      <option key={b.id} value={`bank:${b.id}`}>
                        {formatText(b.bankName)} - {formatText(b.accountNumber)} (موجودی: {formatCurrencyCompact(b.balance)})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="صندوق‌ها">
                    {cashDesks.map((c) => (
                      <option key={c.id} value={`cash:${c.id}`}>
                        {formatText(c.title)} (موجودی: {formatCurrencyCompact(c.balance)})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  مبلغ پرداخت ({moneyUnitLabel()}؛ حداکثر مانده، پرداخت جزئی مجاز است):
                  <MoneyInput
                    value={paymentAmount}
                    onValueChange={(v) => {
                      setPaymentAmount(v);
                      setPayError(null);
                    }}
                    aria-invalid={paymentAmount <= 0 || paymentAmount > selectedRequestForPay.remainingAmount}
                    className="mt-1 w-full p-2 rounded-lg border border-slate-300 bg-white text-sm tabular-nums focus:outline-none focus:border-amber-500"
                  />
                </label>
                {payError && (
                  <p className="mt-1 text-rose-700 font-bold" role="alert">
                    {payError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="payments-treasury-module-2" className="block font-medium text-slate-700 mb-1">شماره پیگیری / ارجاع ساتنا / پایا:</label>
                <input id="payments-treasury-module-2"
                  type="text"
                  placeholder="مثال: SATNA-9182049182"
                  value={paymentTrackingNo}
                  onChange={(e) => setPaymentTrackingNo(e.target.value)}
                  required
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm tabular-nums focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label htmlFor="payments-treasury-module-3" className="block font-medium text-slate-700 mb-1">توضیحات واریز:</label>
                <input id="payments-treasury-module-3"
                  type="text"
                  placeholder="تسویه قطعی صورت‌وضعیت / پیش‌پرداخت خرید..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-amber-500"
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
                  className="btn btn-primary"
                >
                  تأیید پرداخت و کسر از حساب بانک
                </button>
              </div>
            </form>
          </Dialog>
      )}

      {/* Modal: New Payment Request */}
      {isNewRequestModalOpen && (
        <Dialog onClose={() => setIsNewRequestModalOpen(false)} label="ایجاد دستور پرداخت جدید در خزانه‌داری" overlayClassName="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 text-right">
          
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">ایجاد دستور پرداخت جدید در خزانه‌داری</h3>
              <button
                onClick={() => setIsNewRequestModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewRequest} className="space-y-3 text-sm">
              <div>
                <label htmlFor="payments-treasury-module-4" className="block font-medium text-slate-700 mb-1">منبع ایجاد تعهد:</label>
                <select id="payments-treasury-module-4"
                  value={newRequestSource}
                  onChange={(e) => setNewRequestSource(e.target.value as PaymentRequest['sourceType'])}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm"
                >
                  <option value="سایر هزینه‌های عمومی">سایر هزینه‌های عمومی</option>
                  <option value="پیش‌پرداخت خرید">پیش‌پرداخت خرید</option>
                  <option value="پیش‌پرداخت پیمانکار جزء">پیش‌پرداخت پیمانکار جزء</option>
                  <option value="حق بیمه و مالیات">حق بیمه و مالیات</option>
                </select>
              </div>

              {newRequestSource === 'حق بیمه و مالیات' && (
                <div>
                  <label htmlFor="payments-treasury-module-5" className="block font-medium text-slate-700 mb-1">نوع بدهی:</label>
                  <select id="payments-treasury-module-5"
                    value={newRequestLiability}
                    onChange={(e) => setNewRequestLiability(e.target.value as typeof newRequestLiability)}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm"
                  >
                    <option value="insurance">حق بیمه (تأمین اجتماعی)</option>
                    <option value="vat">ارزش افزوده فروش</option>
                    <option value="payroll">مالیات حقوق</option>
                    <option value="withholding">مالیات تکلیفی پیمانکاران</option>
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="payments-treasury-module-6" className="block font-medium text-slate-700 mb-1">نام طرف حساب / ذینفع دریافت وجه:</label>
                <input id="payments-treasury-module-6"
                  type="text"
                  placeholder="مثال: شرکت آرمان بتن سازه / مهندس اکبری..."
                  value={newRequestBeneficiary}
                  onChange={(e) => setNewRequestBeneficiary(e.target.value)}
                  required
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>

              <div>
                <label htmlFor="payments-treasury-module-7" className="block font-medium text-slate-700 mb-1">پروژه منتسب:</label>
                <select id="payments-treasury-module-7"
                  value={newRequestProject}
                  onChange={(e) => setNewRequestProject(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatText(p.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  مبلغ درخواستی ({moneyUnitLabel()}):
                  <MoneyInput
                    value={newRequestAmount}
                    onValueChange={(v) => {
                      setNewRequestAmount(v);
                      setNewRequestError(null);
                    }}
                    className="mt-1 w-full p-2 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                  />
                </label>
                {newRequestError && (
                  <p className="mt-1 text-rose-700 font-bold" role="alert">
                    {newRequestError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="payments-treasury-module-8" className="block font-medium text-slate-700 mb-1">تاریخ سررسید موردنظر:</label>
                <input id="payments-treasury-module-8"
                  type="text"
                  value={newRequestDueDate}
                  onChange={(e) => setNewRequestDueDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
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
                  className="btn btn-primary"
                >
                  ثبت در کارتابل پرداخت
                </button>
              </div>
            </form>
          </Dialog>
      )}
    </div>
  );
};
