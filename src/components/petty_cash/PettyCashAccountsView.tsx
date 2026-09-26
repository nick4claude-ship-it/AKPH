import React, { useState } from 'react';
import {
  Wallet,
  PlusCircle,
  Building2,
  Phone,
  User,
  AlertTriangle,
  ArrowDownLeft,
  ChevronLeft,
  X,
  CreditCard,
  FileText,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingDown,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  PettyCashAccount,
  PettyCashExpense,
  PettyCashReplenishment,
  Project,
  BankAccount,
} from '../../types';
import { PettyCashFundType } from '../../types';
import { useAppState } from '../../store/AppStore';
import { barWidth, formatCurrency, formatNumber, formatPercent, formatText } from '../../utils/formatters';
import { fundCeilingPercent, fundLimitsForHolderRole, isLowBalance } from '../../store/views/pettyCash';
import type { NewPettyFundInput } from '../../store/recordWorkflows';
import { toPersianDate } from '../../utils/date';
import { Dialog } from '../../ui/Dialog';
import { moneyUnitLabel } from '../../utils/money';
import { MoneyInput } from '../../ui/NumberInput';
import { Money } from '../common/Money';

interface PettyCashAccountsViewProps {
  accounts: PettyCashAccount[];
  expenses: PettyCashExpense[];
  replenishments: PettyCashReplenishment[];
  projects: Project[];
  bankAccounts: BankAccount[];
  selectedAccount: PettyCashAccount | null;
  onSelectAccount: (acc: PettyCashAccount | null) => void;
  /** Creates the fund through the workflow (type, limits and code are set there). */
  onSaveNewAccount: (input: NewPettyFundInput) => { ok: boolean; message: string };
  onOpenNewExpense: (accountId: string) => void;
  onOpenReplenish: (accountId: string) => void;
  onOpenReplenishRequest: (accountId: string) => void;
}

export const PettyCashAccountsView: React.FC<PettyCashAccountsViewProps> = ({
  accounts,
  expenses,
  replenishments,
  projects,
  bankAccounts,
  selectedAccount,
  onSelectAccount,
  onSaveNewAccount,
  onOpenNewExpense,
  onOpenReplenish,
  onOpenReplenishRequest,
}) => {
  const { pettyCashSettings } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);

  // New Account Form state
  const [formData, setFormData] = useState({
    title: '',
    holderName: '',
    holderRole: 'سرپرست کارگاه',
    holderPhone: '',
    projectId: projects[0]?.id || '',
    sourceBankAccountId: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // One project can hold several funds; the holder role decides the fund type and its stored limits.
  const fundLimits = fundLimitsForHolderRole(pettyCashSettings, formData.holderRole);

  const filteredAccounts = accounts.filter(
    (a) =>
      a.title.includes(searchTerm) ||
      a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.holderName.includes(searchTerm) ||
      a.projectName.includes(searchTerm)
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Fund type, limits, code and cost center are set by the workflow.
    const result = onSaveNewAccount(formData);
    if (!result.ok) return setFormError(result.message);
    setFormError(null);
    setIsNewAccountModalOpen(false);
  };

  // If an account is selected for detail view (داشبورد اختصاصی هر تنخواه)
  const accountExpenses = selectedAccount
    ? expenses.filter((e) => e.pettyCashId === selectedAccount.id)
    : [];
  const accountReplenishments = selectedAccount
    ? replenishments.filter((r) => r.pettyCashId === selectedAccount.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">مدیریت حساب‌های تنخواه‌گردان</h2>
          <p className="text-xs text-slate-500 mt-1">
            ایجاد، پایش گردش مالی و مشاهده کارنامه تفکیکی تنخواه‌داران کارگاه‌ها و پروژه‌ها
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input aria-label="جستجوی تنخواه، مسئول یا پروژه"
            type="text"
            placeholder="جستجوی تنخواه، مسئول یا پروژه..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 w-64 bg-white"
          />
          <button
            onClick={() => setIsNewAccountModalOpen(true)}
            className="btn btn-primary shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            تعریف تنخواه جدید
          </button>
        </div>
      </div>

      {/* Accounts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAccounts.map((acc) => {
          const isLow = isLowBalance(acc);
          const ceilingPercent = fundCeilingPercent(acc);

          return (
            <div
              key={acc.id}
              className={`bg-white rounded-xl border transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden ${
                isLow ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'
              }`}
            >
              <div>
                {/* Card Header */}
                <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-2 bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                        {formatText(acc.code)}
                      </span>
                      {isLow && (
                        <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2 py-1 rounded-sm flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          کسری موجودی
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-base text-slate-900 leading-snug">{formatText(acc.title)}</h3>
                  </div>

                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      acc.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {acc.status === 'active' ? 'فعال' : 'معلق'}
                  </span>
                </div>

                {/* Project & Holder info */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>مسئول: {formatText(acc.holderName)}</span>
                    </span>
                    <span className="text-xs text-slate-500">({acc.holderRole})</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{formatText(acc.projectName)}</span>
                  </div>

                  {/* 3 Core Balances Box */}
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">سقف مصوب:</span>
                      <span className=" text-slate-700 font-medium tabular-nums">
                        <Money rial={acc.ceilingLimit} />
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">موجودی واقعی:</span>
                      <span className=" text-slate-900 font-bold tabular-nums">
                        <Money rial={acc.actualBalance} />
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-amber-700">در انتظار تأیید:</span>
                      <span className=" text-amber-700 font-medium tabular-nums">
                        {acc.pendingExpenses > 0 ? formatCurrency(acc.pendingExpenses) : '۰'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-900">قابل مصرف:</span>
                      <span
                        className={` font-bold tabular-nums text-sm ${
                          isLow ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        <Money rial={acc.usableBalance} />
                      </span>
                    </div>
                  </div>

                  {/* Progress bar of usage */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>مصرف نسبت به سقف:</span>
                      <span className="tabular-nums">{formatPercent(ceilingPercent, 0)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isLow ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: barWidth(ceilingPercent) }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-1">
                <button
                  onClick={() => onSelectAccount(acc)}
                  className="px-2 py-2 text-xs text-slate-700 hover:text-slate-950 hover:bg-slate-200 rounded-md transition-colors font-medium flex items-center gap-1"
                >
                  کارنامه تفصیلی
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onOpenNewExpense(acc.id)}
                    className="btn btn-primary btn-sm"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    هزینه
                  </button>
                  <button
                    onClick={() => onOpenReplenish(acc.id)}
                    className="px-2 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-md transition-colors shadow-xs flex items-center gap-1"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    شارژ
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal / Drawer for Selected Account (بخش ۱۸: داشبورد هر تنخواه) */}
      {selectedAccount && (
        <Dialog onClose={() => onSelectAccount(null)} label="جزئیات حساب تنخواه" overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
          
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50 rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-xs font-bold bg-amber-100 text-amber-900 px-2 py-1 rounded">
                    {formatText(selectedAccount.code)}
                  </span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-medium">
                    {selectedAccount.status === 'active' ? 'فعال' : 'معلق'}
                  </span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-sm text-slate-600 font-medium">{formatText(selectedAccount.projectName)}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{formatText(selectedAccount.title)}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  مسئول تنخواه: {formatText(selectedAccount.holderName)} ({selectedAccount.holderRole}) | تلفن: {formatText(selectedAccount.holderPhone || '-')}
                </p>
              </div>

              <button
                onClick={() => onSelectAccount(null)}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Account Balance KPI Tiles (Prompt Section 18) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">سقف مجاز</span>
                  <div className="text-sm font-bold text-slate-800 mt-1 tabular-nums">
                    <Money rial={selectedAccount.ceilingLimit} />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">موجودی واقعی</span>
                  <div className="text-sm font-bold text-slate-900 mt-1 tabular-nums">
                    <Money rial={selectedAccount.actualBalance} />
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-sm text-amber-800 font-medium">در انتظار</span>
                  <div className="text-sm font-bold text-amber-700 mt-1 tabular-nums">
                    <Money rial={selectedAccount.pendingExpenses} />
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300">
                  <span className="text-sm text-emerald-800 font-bold">قابل مصرف</span>
                  <div className="text-sm font-bold text-emerald-800 mt-1 tabular-nums">
                    <Money rial={selectedAccount.usableBalance} />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-sm text-blue-800 font-medium">مخارج ماهانه</span>
                  <div className="text-sm font-bold text-blue-900 mt-1 tabular-nums">
                    <Money rial={selectedAccount.monthlySpent} />
                  </div>
                </div>
              </div>

              {/* Action Buttons for this Account */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-sm text-slate-600">
                  حساب بانکی مبدا:{' '}
                  <span className="font-medium text-slate-900">
                    {formatText(selectedAccount.sourceBankAccountTitle)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSelectAccount(null);
                      onOpenNewExpense(selectedAccount.id);
                    }}
                    className="btn btn-primary"
                  >
                    <PlusCircle className="w-4 h-4" />
                    ثبت هزینه در این تنخواه
                  </button>
                  <button
                    onClick={() => {
                      onSelectAccount(null);
                      onOpenReplenish(selectedAccount.id);
                    }}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-lg transition-colors shadow-xs flex items-center gap-2"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    شارژ این تنخواه
                  </button>
                  <button
                    onClick={() => {
                      onSelectAccount(null);
                      onOpenReplenishRequest(selectedAccount.id);
                    }}
                    className="px-3 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-sm rounded-lg transition-colors"
                  >
                    درخواست شارژ
                  </button>
                </div>
              </div>

              {/* Account History Table (Expenses & Replenishments) */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">
                  گردش عملیات و تراکنش‌های تنخواه ({selectedAccount.title})
                </h4>

                <div className="border border-slate-200 rounded-xl table-scroll">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">نوع</th>
                        <th className="py-2 px-3">تاریخ</th>
                        <th className="py-2 px-3">شرح تراکنش</th>
                        <th className="py-2 px-3">طرف حساب / فروشنده</th>
                        <th className="py-2 px-3 text-left">مبلغ ({moneyUnitLabel()})</th>
                        <th className="py-2 px-3 text-center">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Replenishments for this account */}
                      {accountReplenishments.map((rep) => (
                        <tr key={rep.id} className="bg-emerald-50/20 hover:bg-emerald-50/40">
                          <td className="py-2 px-3">
                            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold">
                              شارژ واریزی
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">{formatText(rep.date)}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">{formatText(rep.description)}</td>
                          <td className="py-2 px-3 text-slate-600">{formatText(rep.sourceBankAccountName)}</td>
                          <td className="py-2 px-3 text-left font-bold text-emerald-700 tabular-nums">
                            +<Money rial={rep.amount} />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-sm text-emerald-700 font-medium">
                              {formatText(rep.status)}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {/* Expenses for this account */}
                      {accountExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                              هزینه ({exp.category})
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">{formatText(exp.date)}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">{formatText(exp.description)}</td>
                          <td className="py-2 px-3 text-slate-600">{formatText(exp.vendor)}</td>
                          <td className="py-2 px-3 text-left font-bold text-slate-900 tabular-nums">
                            -<Money rial={exp.amount} />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${
                                exp.status === 'approved' || exp.status === 'accounting_posted'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : exp.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {exp.status === 'approved' || exp.status === 'accounting_posted'
                                ? 'تأیید شده'
                                : exp.status === 'rejected'
                                ? 'رد شده'
                                : 'در انتظار تأیید'}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {accountReplenishments.length === 0 && accountExpenses.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            هیچ تراکنشی برای این تنخواه‌گردان ثبت نشده است.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Dialog>
      )}

      {/* Modal: Create New Petty Cash Account */}
      {isNewAccountModalOpen && (
        <Dialog onClose={() => setIsNewAccountModalOpen(false)} label="تعریف حساب تنخواه‌گردان جدید" overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
          
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-base font-bold text-slate-900">تعریف حساب تنخواه‌گردان جدید</h3>
                <p className="text-xs text-slate-500 mt-1">ثبت تنخواه کارگاهی یا اداری به همراه سقف و مسئول</p>
              </div>
              <button
                onClick={() => setIsNewAccountModalOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 font-bold rounded-lg flex items-center gap-2 animate-in fade-in duration-200 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="petty-cash-accounts-view-1" className="block text-xs font-bold text-slate-700 mb-1">
                    عنوان تنخواه <span className="text-rose-700">*</span>
                  </label>
                  <input id="petty-cash-accounts-view-1"
                    type="text"
                    required
                    placeholder="مثال: تنخواه کارگاه فاز ۲ نیلوفر"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor="petty-cash-accounts-view-2" className="block text-xs font-bold text-slate-700 mb-1">
                    کد سیستمی تنخواه
                  </label>
                  <input id="petty-cash-accounts-view-2"
                    type="text"
                    value="خودکار پس از ثبت"
                    readOnly
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg tabular-nums bg-slate-50 text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="petty-cash-accounts-view-3" className="block text-xs font-bold text-slate-700 mb-1">
                    مسئول تنخواه <span className="text-rose-700">*</span>
                  </label>
                  <input id="petty-cash-accounts-view-3"
                    type="text"
                    required
                    placeholder="نام و نام خانوادگی مسئول"
                    value={formData.holderName}
                    onChange={(e) => setFormData({ ...formData, holderName: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor="petty-cash-accounts-view-4" className="block text-xs font-bold text-slate-700 mb-1">
                    سمت سازمانی مسئول
                  </label>
                  <select id="petty-cash-accounts-view-4"
                    value={formData.holderRole}
                    onChange={(e) => setFormData({ ...formData, holderRole: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="سرپرست کارگاه">سرپرست کارگاه</option>
                    <option value="مدیر پروژه">مدیر پروژه</option>
                    <option value="مسئول خرید و کارپرداز">مسئول خرید و کارپرداز</option>
                    <option value="انباردار کارگاه">انباردار کارگاه</option>
                    <option value="واحد اداری و ستادی">واحد اداری و ستادی</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="petty-cash-accounts-view-5" className="block text-xs font-bold text-slate-700 mb-1">
                    پروژه مرتبط
                  </label>
                  <select id="petty-cash-accounts-view-5"
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatText(p.name)}
                      </option>
                    ))}
                    <option value="all">دفتر مرکزی تهران</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="petty-cash-accounts-view-6" className="block text-xs font-bold text-slate-700 mb-1">
                    شماره تماس مسئول
                  </label>
                  <input id="petty-cash-accounts-view-6"
                    type="text"
                    placeholder="0912-..."
                    value={formData.holderPhone}
                    onChange={(e) => setFormData({ ...formData, holderPhone: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-sm font-bold text-slate-700 mb-1">
                    سقف مجاز تنخواه ({moneyUnitLabel()})
                  </span>
                  <div className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg tabular-nums bg-slate-50">
                    <Money rial={fundLimits.ceiling} />
                  </div>
                  <span className="text-xs text-slate-500">از تنظیمات سامانه برای این نوع تنخواه</span>
                </div>

                <div>
                  <span className="block text-sm font-bold text-slate-700 mb-1">
                    حداقل موجودی هشدار ({moneyUnitLabel()})
                  </span>
                  <div className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg tabular-nums bg-slate-50">
                    <Money rial={fundLimits.minBalanceWarning} />
                  </div>
                  <span className="text-xs text-slate-500">از تنظیمات سامانه برای این نوع تنخواه</span>
                </div>
              </div>

              <div>
                <label htmlFor="petty-cash-accounts-view-7" className="block text-xs font-bold text-slate-700 mb-1">
                  حساب بانکی مبدا شارژ
                </label>
                <select id="petty-cash-accounts-view-7"
                  value={formData.sourceBankAccountId}
                  onChange={(e) => setFormData({ ...formData, sourceBankAccountId: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {formatText(b.bankName)} - {formatText(b.accountNumber)} ({formatCurrency(b.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="petty-cash-accounts-view-8" className="block text-xs font-bold text-slate-700 mb-1">
                  توضیحات و شماره کارت تنخواه
                </label>
                <textarea id="petty-cash-accounts-view-8"
                  rows={2}
                  placeholder="شماره کارت ۱۶ رقمی بانکی یا نکات کنترلی..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewAccountModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  ثبت و فعال‌سازی تنخواه
                </button>
              </div>
            </form>
          </Dialog>
      )}
    </div>
  );
};
