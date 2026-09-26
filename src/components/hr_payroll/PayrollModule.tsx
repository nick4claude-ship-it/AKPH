/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  CreditCard,
  Calendar,
  FileSpreadsheet,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Layers,
  DollarSign,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building,
  UserCheck,
  Building2,
  X,
} from 'lucide-react';
import { Project, UserProfile, PayrollSlip } from '../../types';
import { useAppState } from '../../store/AppStore';
import { usePermission, useCompany } from '../../store/session';
import { Dialog } from '../../ui/Dialog';
import { useWorkflows } from '../../store/useWorkflows';
import { payrollTotals } from '../../store/views/people';
import { useNavigate } from 'react-router-dom';
import { formatNumber, formatCurrencyCompact, formatInt, formatText } from '../../utils/formatters';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { Money } from '../common/Money';

interface PayrollModuleProps {
  projects: Project[];
  currentUser: UserProfile;
  onToast: (msg: string) => void;
}

export const PayrollModule: React.FC<PayrollModuleProps> = ({
  projects,
  currentUser,
  onToast,
}) => {
  const company = useCompany();
  const wf = useWorkflows();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'payroll_slips' | 'employees' | 'timesheets'>('payroll_slips');

  const { can } = usePermission();
  const { employees, timesheets, payrollSlips } = useAppState();
  // Periods come from the slips; the latest one is shown first.
  const periods = [...new Set(payrollSlips.map((s) => s.monthYear))].sort();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => periods[periods.length - 1] ?? '');
  const slips = payrollSlips.filter((s) => s.monthYear === selectedMonth);
  const hasCalculated = slips.some((s) => s.status === 'محاسبه شده');
  const canApprove = can('payroll.approve');

  // Modal State for Slip View & Print
  const [selectedSlipForModal, setSelectedSlipForModal] = useState<PayrollSlip | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'info' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Totals for active month
  const totals = payrollTotals(slips);
  const {
    gross: totalGrossSalaries,
    net: totalNetPayable,
    workerInsurance: totalWorkerInsurance,
    employerInsurance: totalEmployerInsurance,
    incomeTax: totalIncomeTax,
    companyLaborCost: totalCompanyLaborCost,
  } = totals;

  // Financial approval of the month's calculated slips posts one payroll entry
  // (Dr salary cost per cost center / Cr salaries, insurance, tax, loans) and queues the net pay in treasury.
  const handleGenerateAccountingEntry = () => {
    const result = wf.approvePayrollPeriod(selectedMonth);
    showNotification(result.message, result.ok ? 'success' : 'info');
    onToast(result.message);
  };

  // Net pay is paid only in treasury, from the request created on approval.
  const handleGeneratePaymentBatch = () => navigate('/finance/payments');

  const filteredSlips = slips.filter((s) => {
    if (selectedProjectId !== 'all' && s.projectId !== selectedProjectId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.employeeName.toLowerCase().includes(q) ||
        s.personnelCode.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredEmployees = employees.filter((e) => {
    if (selectedProjectId !== 'all' && e.assignedProjectId !== selectedProjectId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.personnelCode.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 font-bold flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{formatText(notification.text)}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">✕</button>
        </div>
      )}
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2 py-1 rounded">
              سامانه مدیریت منابع انسانی، کارکرد و حقوق دستمزد
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded tabular-nums">
              قانون کار، بیمه تأمین اجتماعی و مالیات ماده ۸۴
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            محاسبه فیش‌های حقوق، کارکرد کارگاهی، لیست بیمه و صدور سند اتوماتیک حسابداری
          </h2>
          <p className="text-xs text-slate-500">
            کارکرد کارگاه ← محاسبه ناخالص و کسورات قانونی ← صدور فیش ← ثبت سند حسابداری هزینه پروژه ← ارسال فایل پایا به خزانه‌داری
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {periods.length > 1 && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="دوره حقوق"
              className="px-2 py-2 rounded-xl border border-slate-200 bg-white text-xs tabular-nums"
            >
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleGenerateAccountingEntry}
            disabled={!canApprove || !hasCalculated}
            title={!canApprove ? 'مجوز تأیید حقوق را ندارید.' : !hasCalculated ? 'فیش محاسبه‌شده‌ای در انتظار تأیید نیست.' : ''}
            className="btn btn-secondary"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>تأیید مالی حقوق و صدور سند</span>
          </button>
          <button
            onClick={handleGeneratePaymentBatch}
            className="btn btn-primary"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>مشاهده درخواست پرداخت در خزانه</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">بهای تمام‌شده نیروی انسانی دوره</span>
          <div className="text-lg font-bold text-slate-900 tabular-nums">
            {formatMoney(totalCompanyLaborCost, false)}{' '}
            <span className="text-xs text-slate-500 font-sans">{moneyUnitLabel()}</span>
          </div>
          <span className="text-xs text-slate-500 font-medium">ناخالص حقوق + ۲۳٪ سهم کارفرما</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">خالص پرداختی به پرسنل</span>
          <div className="text-lg font-bold text-emerald-700 tabular-nums">
            {formatMoney(totalNetPayable, false)}{' '}
            <span className="text-xs text-slate-500 font-sans">{moneyUnitLabel()}</span>
          </div>
          <span className="text-sm text-emerald-700 font-medium">واریز به حساب‌های بانکی</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">حق بیمه ۳۰٪ تأمین اجتماعی</span>
          <div className="text-lg font-bold text-blue-700 tabular-nums">
            {formatMoney(totalWorkerInsurance + totalEmployerInsurance, false)}{' '}
            <span className="text-xs text-slate-500 font-sans">{moneyUnitLabel()}</span>
          </div>
          <span className="text-sm text-blue-600 font-medium">سهم کارگر ۷٪ + سهم شرکت ۲۳٪</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">مالیات تکلیفی حقوق (ماده ۸۴)</span>
          <div className="text-lg font-bold text-rose-700 tabular-nums">
            {formatMoney(totalIncomeTax, false)}{' '}
            <span className="text-xs text-slate-500 font-sans">{moneyUnitLabel()}</span>
          </div>
          <span className="text-sm text-rose-700 font-medium">قابل واریز به دارایی تا پایان ماه بعد</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        <button
          onClick={() => setActiveTab('payroll_slips')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'payroll_slips'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-amber-400" />
          <span>لیست و فیش‌های حقوق ({selectedMonth})</span>
          <span className="text-xs px-2 py-1 rounded-full tabular-nums bg-slate-800 text-amber-300">
            {formatInt(slips.length)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'employees'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          <span>شناسنامه پرسنل و قراردادها</span>
          <span className="text-xs px-2 py-1 rounded-full tabular-nums bg-slate-100 text-slate-600">
            {formatInt(employees.length)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('timesheets')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'timesheets'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>کارکرد و تایم‌شیت کارگاه‌ها</span>
          <span className="text-xs px-2 py-1 rounded-full tabular-nums bg-slate-100 text-slate-600">
            {formatInt(timesheets.length)}
          </span>
        </button>
      </div>

      {/* View 1: Payroll Slips */}
      {activeTab === 'payroll_slips' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
                <input aria-label="جستجوی پرسنل، کد پرسنلی"
                  type="text"
                  placeholder="جستجوی پرسنل، کد پرسنلی..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <select aria-label="فیلتر: پروژه‌ها / دفتر مرکزی"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="py-2 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
              >
                <option value="all">همه پروژه‌ها / دفتر مرکزی</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatText(p.name)}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-500 tabular-nums text-xs">
              تعداد فیش‌های محاسبه شده: {formatInt(filteredSlips.length)}
            </span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="table-scroll">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">کد و نام پرسنل</th>
                    <th className="py-3 px-3">سمت و واحد سازمانی</th>
                    <th className="py-3 px-3">پروژه و مرکز هزینه</th>
                    <th className="py-3 px-3 text-left">ناخالص دریافتی</th>
                    <th className="py-3 px-3 text-left">بیمه سهم کارگر (۷٪)</th>
                    <th className="py-3 px-3 text-left">مالیات حقوق</th>
                    <th className="py-3 px-3 text-left font-bold text-slate-900">خالص پرداختی</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3 text-center">مشاهده فیش</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSlips.map((slip) => (
                    <tr key={slip.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <strong className="block text-slate-900 font-medium">{formatText(slip.employeeName)}</strong>
                        <span className="text-xs text-slate-500 tabular-nums">{formatText(slip.personnelCode)}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-slate-800 block">{formatText(slip.role)}</span>
                        <span className="text-xs text-slate-500">{formatText(slip.department)}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-slate-800 block truncate max-w-[150px]">{formatText(slip.projectName)}</span>
                        <span className="text-xs text-slate-500 tabular-nums">{formatText(slip.costCenterId)}</span>
                      </td>
                      <td className="py-3 px-3 text-left tabular-nums font-medium text-slate-700">
                        {formatMoney(slip.grossTotalSalary, false)}
                      </td>
                      <td className="py-3 px-3 text-left tabular-nums text-blue-700">
                        {formatMoney(slip.workerInsuranceDeduction, false)}
                      </td>
                      <td className="py-3 px-3 text-left tabular-nums text-rose-700">
                        {formatMoney(slip.incomeTaxDeduction, false)}
                      </td>
                      <td className="py-3 px-3 text-left tabular-nums font-bold text-emerald-800">
                        {formatMoney(slip.netPayableSalary, false)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            slip.status === 'پرداخت شده'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {formatText(slip.status)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setSelectedSlipForModal(slip)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium cursor-pointer inline-flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3 text-slate-500" />
                          <span>فیش حقوقی</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Employees Directory */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => (
            <div key={emp.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-xs tabular-nums bg-slate-100 text-slate-700 px-2 py-1 rounded font-bold inline-block mb-1">
                    {formatText(emp.personnelCode)}
                  </span>
                  <h3 className="text-base font-bold text-slate-900">{formatText(emp.fullName)}</h3>
                  <span className="text-xs text-slate-500">{formatText(emp.role)}</span>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-medium">
                  {formatText(emp.contractType)}
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">کد ملی:</span>
                  <span className="tabular-nums">{formatText(emp.nationalCode)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">واحد / کارگاه:</span>
                  <span className="font-medium text-slate-800">{formatText(emp.assignedProjectName)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">شماره بیمه:</span>
                  <span className="tabular-nums">{formatText(emp.insuranceNumber)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">تلفن:</span>
                  <span className="tabular-nums">{formatText(emp.phone)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-500">حقوق پایه حکمی:</span>
                <strong className="tabular-nums text-slate-900"><Money rial={emp.baseSalary} /></strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View 3: Timesheets */}
      {activeTab === 'timesheets' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>کارکرد ماهانه پرسنل کارگاه‌ها و تایید سرپرستان ({selectedMonth})</span>
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              تعداد تایم‌شیت‌ها: {formatInt(timesheets.length)}
            </span>
          </div>

          <div className="table-scroll">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-3 px-3">نام پرسنل</th>
                  <th className="py-3 px-3">دوره</th>
                  <th className="py-3 px-3 text-center">روزهای موظفی</th>
                  <th className="py-3 px-3 text-center">کارکرد واقعی</th>
                  <th className="py-3 px-3 text-center">ساعت اضافه‌کار</th>
                  <th className="py-3 px-3 text-center">شب‌کاری / تعطیل‌کاری</th>
                  <th className="py-3 px-3 text-center">ماموریت کارگاهی</th>
                  <th className="py-3 px-3">وضعیت تایید</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timesheets.map((ts) => (
                  <tr key={ts.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-medium text-slate-900">{formatText(ts.employeeName)}</td>
                    <td className="py-3 px-3 tabular-nums text-slate-500">{formatText(ts.monthYear)}</td>
                    <td className="py-3 px-3 text-center tabular-nums">{formatText(ts.standardWorkDays)}</td>
                    <td className="py-3 px-3 text-center tabular-nums font-bold text-slate-800">{formatText(ts.actualWorkDays)}</td>
                    <td className="py-3 px-3 text-center tabular-nums text-amber-700 font-bold">{formatText(ts.overtimeHours)} ساعت</td>
                    <td className="py-3 px-3 text-center tabular-nums">{ts.nightWorkHours + ts.holidayWorkHours} ساعت</td>
                    <td className="py-3 px-3 text-center tabular-nums">{formatText(ts.missionDays)} روز</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {formatText(ts.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Payroll Slip Detailed Print Preview */}
      {selectedSlipForModal && (
        <Dialog
          onClose={() => setSelectedSlipForModal(null)}
          label={`فیش حقوق ${selectedSlipForModal.employeeName}`}
          overlayClassName="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 text-right animate-in fade-in zoom-in-95 duration-150"
        >
            {/* Header of Slip */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900 mb-4">
              <div>
                <span className="text-xs text-slate-500 tabular-nums block">{formatText(company.legalName)}</span>
                <h3 className="text-base font-bold text-slate-900">فیش حقوق و دستمزد ماهانه پرسنل</h3>
                <span className="text-sm text-slate-600 tabular-nums">دوره: {formatText(selectedSlipForModal.monthYear)} • شماره فیش: {formatText(selectedSlipForModal.slipNumber)}</span>
              </div>
              <button
                onClick={() => setSelectedSlipForModal(null)}
                aria-label="بستن"
                className="text-slate-500 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Personnel Info */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-sm">
              <div>
                <span className="text-slate-500 block text-xs">نام و نام خانوادگی:</span>
                <strong className="text-slate-900">{formatText(selectedSlipForModal.employeeName)}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">کد پرسنلی:</span>
                <strong className="tabular-nums text-slate-900">{formatText(selectedSlipForModal.personnelCode)}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">سمت / واحد:</span>
                <span className="text-slate-800">{formatText(selectedSlipForModal.role)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">پروژه / مرکز هزینه:</span>
                <span className="text-slate-800">{formatText(selectedSlipForModal.projectName)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">روزهای کارکرد:</span>
                <span className="tabular-nums">{formatText(selectedSlipForModal.actualWorkDays)} روز</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">ساعت اضافه کاری:</span>
                <span className="tabular-nums">{formatText(selectedSlipForModal.overtimeHours)} ساعت</span>
              </div>
            </div>

            {/* Earnings & Deductions Tables Side-by-Side */}
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              {/* Earnings */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 font-bold text-emerald-900 flex justify-between">
                  <span>مزایا و درآمدها</span>
                  <span>مبلغ ({moneyUnitLabel()})</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">حقوق پایه ماهانه:</span>
                    <span className="tabular-nums">{formatMoney(selectedSlipForModal.baseSalaryGross, false)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">حق مسکن:</span>
                    <span className="tabular-nums">{formatMoney(selectedSlipForModal.housingAllowance, false)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">بن خواروبار:</span>
                    <span className="tabular-nums">{formatMoney(selectedSlipForModal.foodAllowance, false)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">حق اولاد:</span>
                    <span className="tabular-nums">{formatMoney(selectedSlipForModal.childAllowance, false)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">حق تخصص کارگاهی:</span>
                    <span className="tabular-nums">{formatMoney(selectedSlipForModal.specialSkillAllowance, false)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">اضافه کاری:</span>
                    <span className="tabular-nums">{formatMoney(selectedSlipForModal.overtimePay, false)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>جمع ناخالص مزایا:</span>
                    <span className="tabular-nums">{formatMoney(selectedSlipForModal.grossTotalSalary, false)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-rose-50 px-3 py-2 border-b border-rose-100 font-bold text-rose-900 flex justify-between">
                  <span>کسورات قانونی و وام</span>
                  <span>مبلغ ({moneyUnitLabel()})</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">بیمه سهم کارگر (۷٪):</span>
                    <span className="tabular-nums text-rose-700">{formatMoney(selectedSlipForModal.workerInsuranceDeduction, false)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">مالیات بر حقوق:</span>
                    <span className="tabular-nums text-rose-700">{formatMoney(selectedSlipForModal.incomeTaxDeduction, false)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">مساعده / اقساط وام:</span>
                    <span className="tabular-nums">{formatMoney(selectedSlipForModal.loanDeduction, false)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>جمع کسورات:</span>
                    <span className="tabular-nums text-rose-700">{formatMoney(selectedSlipForModal.totalDeductions, false)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Pay Bar */}
            <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between mb-4">
              <span className="text-sm font-bold">خالص پرداختی به حساب پرسنل:</span>
              <span className="text-base font-bold tabular-nums text-amber-400">
                <Money rial={selectedSlipForModal.netPayableSalary} />
              </span>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 tabular-nums">
                سند حسابداری: {formatText(selectedSlipForModal.journalEntryId || 'آماده صدور')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ رسمی فیش</span>
                </button>
                <button
                  onClick={() => setSelectedSlipForModal(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
        </Dialog>
      )}
    </div>
  );
};
