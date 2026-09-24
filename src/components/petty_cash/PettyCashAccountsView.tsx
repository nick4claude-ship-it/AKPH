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
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { generateUUID } from '../../utils/ids';

interface PettyCashAccountsViewProps {
  accounts: PettyCashAccount[];
  expenses: PettyCashExpense[];
  replenishments: PettyCashReplenishment[];
  projects: Project[];
  bankAccounts: BankAccount[];
  selectedAccount: PettyCashAccount | null;
  onSelectAccount: (acc: PettyCashAccount | null) => void;
  onSaveNewAccount: (newAcc: PettyCashAccount) => void;
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
  const { costCenters } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);

  // New Account Form state
  const [formData, setFormData] = useState({
    title: '',
    code: `TC-PRJ${Math.floor(100 + Math.random() * 900)}`,
    holderName: '',
    holderRole: 'سرپرست کارگاه',
    holderPhone: '',
    projectId: projects[0]?.id || '',
    ceilingLimit: 100_000_000,
    minBalanceWarning: 30_000_000,
    sourceBankAccountId: '',
    startDate: '۱۴۰۳/۰۷/۰۱',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const filteredAccounts = accounts.filter(
    (a) =>
      a.title.includes(searchTerm) ||
      a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.holderName.includes(searchTerm) ||
      a.projectName.includes(searchTerm)
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.holderName.trim()) {
      setFormError('لطفاً عنوان تنخواه و نام مسئول را وارد نمایید.');
      return;
    }
    setFormError(null);

    const linkedProject = projects.find((p) => p.id === formData.projectId);
    const linkedBank = bankAccounts.find((b) => b.id === formData.sourceBankAccountId);

    // One project can hold several funds; the holder role decides the fund type and its stored limits.
    const fundType: PettyCashFundType =
      formData.holderRole === 'مدیر پروژه'
        ? 'project_manager'
        : formData.holderRole === 'مسئول خرید و کارپرداز'
          ? 'procurement'
          : formData.holderRole === 'واحد اداری و ستادی'
            ? 'headquarters'
            : 'site_supervisor';
    const costCenter = costCenters.find((c) => c.projectId === formData.projectId && c.type === 'کارگاه پروژه');
    const newAccount: PettyCashAccount = {
      id: generateUUID(),
      fundType,
      code: formData.code,
      title: formData.title,
      holderName: formData.holderName,
      holderRole: formData.holderRole,
      holderPhone: formData.holderPhone,
      projectId: formData.projectId,
      projectName: linkedProject ? linkedProject.name : 'ستاد مرکزی',
      costCenterId: costCenter?.id || '',
      costCenterName: costCenter?.name || 'ستاد مرکزی',
      ceilingLimit: Number(formData.ceilingLimit),
      minBalanceWarning: Number(formData.minBalanceWarning),
      actualBalance: 0,
      pendingExpenses: 0,
      usableBalance: 0,
      sourceBankAccountId: formData.sourceBankAccountId,
      sourceBankAccountTitle: linkedBank ? `${linkedBank.bankName} - ${linkedBank.accountNumber}` : 'بانک شرکت',
      startDate: formData.startDate,
      status: 'active',
      monthlySpent: 0,
      lastReplenishmentDate: '-',
      lastReplenishmentAmount: 0,
      notes: formData.notes,
    };

    onSaveNewAccount(newAccount);
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
          <p className="text-xs text-slate-500 mt-0.5">
            ایجاد، پایش گردش مالی و مشاهده کارنامه تفکیکی تنخواه‌داران کارگاه‌ها و پروژه‌ها
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="جستجوی تنخواه، مسئول یا پروژه..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 w-64 bg-white"
          />
          <button
            onClick={() => setIsNewAccountModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-xs shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            تعریف تنخواه جدید
          </button>
        </div>
      </div>

      {/* Accounts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAccounts.map((acc) => {
          const isLow = acc.usableBalance <= acc.minBalanceWarning;
          const ceilingPercent = Math.min(100, (acc.actualBalance / (acc.ceilingLimit || 1)) * 100);

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
                      <span className="font-mono text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {acc.code}
                      </span>
                      {isLow && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-sm flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          کسری موجودی
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 leading-snug">{acc.title}</h3>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
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
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>مسئول: {acc.holderName}</span>
                    </span>
                    <span className="text-[11px] text-slate-400">({acc.holderRole})</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{acc.projectName}</span>
                  </div>

                  {/* 3 Core Balances Box */}
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">سقف مصوب:</span>
                      <span className="font-mono text-slate-700 font-semibold tabular-nums">
                        {formatCurrency(acc.ceilingLimit)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">موجودی واقعی:</span>
                      <span className="font-mono text-slate-900 font-bold tabular-nums">
                        {formatCurrency(acc.actualBalance)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-700">در انتظار تأیید:</span>
                      <span className="font-mono text-amber-700 font-semibold tabular-nums">
                        {acc.pendingExpenses > 0 ? formatCurrency(acc.pendingExpenses) : '۰'}
                      </span>
                    </div>

                    <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">قابل مصرف:</span>
                      <span
                        className={`font-mono font-black tabular-nums text-sm ${
                          isLow ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(acc.usableBalance)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar of usage */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>مصرف نسبت به سقف:</span>
                      <span className="tabular-nums font-mono">{ceilingPercent.toFixed(0)}٪</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isLow ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${ceilingPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-1">
                <button
                  onClick={() => onSelectAccount(acc)}
                  className="px-2.5 py-1.5 text-xs text-slate-700 hover:text-slate-950 hover:bg-slate-200 rounded-md transition-colors font-medium flex items-center gap-1"
                >
                  کارنامه تفصیلی
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onOpenNewExpense(acc.id)}
                    className="px-2 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-md transition-colors shadow-xs flex items-center gap-1"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50 rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                    {selectedAccount.code}
                  </span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                    {selectedAccount.status === 'active' ? 'فعال' : 'معلق'}
                  </span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs text-slate-600 font-medium">{selectedAccount.projectName}</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">{selectedAccount.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  مسئول تنخواه: {selectedAccount.holderName} ({selectedAccount.holderRole}) | تلفن: {selectedAccount.holderPhone || '-'}
                </p>
              </div>

              <button
                onClick={() => onSelectAccount(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Account Balance KPI Tiles (Prompt Section 18) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">سقف مجاز</span>
                  <div className="text-sm font-bold text-slate-800 font-mono mt-1 tabular-nums">
                    {formatCurrency(selectedAccount.ceilingLimit)}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">موجودی واقعی (Balance)</span>
                  <div className="text-sm font-bold text-slate-900 font-mono mt-1 tabular-nums">
                    {formatCurrency(selectedAccount.actualBalance)}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[11px] text-amber-800 font-medium">در انتظار (Pending)</span>
                  <div className="text-sm font-bold text-amber-700 font-mono mt-1 tabular-nums">
                    {formatCurrency(selectedAccount.pendingExpenses)}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300">
                  <span className="text-[11px] text-emerald-800 font-bold">قابل مصرف (Available)</span>
                  <div className="text-sm font-black text-emerald-800 font-mono mt-1 tabular-nums">
                    {formatCurrency(selectedAccount.usableBalance)}
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-[11px] text-blue-800 font-medium">مخارج ماهانه</span>
                  <div className="text-sm font-bold text-blue-900 font-mono mt-1 tabular-nums">
                    {formatCurrency(selectedAccount.monthlySpent)}
                  </div>
                </div>
              </div>

              {/* Action Buttons for this Account */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-600">
                  حساب بانکی مبدا:{' '}
                  <span className="font-semibold text-slate-900">
                    {selectedAccount.sourceBankAccountTitle}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSelectAccount(null);
                      onOpenNewExpense(selectedAccount.id);
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    ثبت هزینه در این تنخواه
                  </button>
                  <button
                    onClick={() => {
                      onSelectAccount(null);
                      onOpenReplenish(selectedAccount.id);
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    شارژ این تنخواه
                  </button>
                  <button
                    onClick={() => {
                      onSelectAccount(null);
                      onOpenReplenishRequest(selectedAccount.id);
                    }}
                    className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg transition-colors"
                  >
                    درخواست شارژ
                  </button>
                </div>
              </div>

              {/* Account History Table (Expenses & Replenishments) */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-3">
                  گردش عملیات و تراکنش‌های تنخواه ({selectedAccount.title})
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">نوع</th>
                        <th className="py-2.5 px-3">تاریخ</th>
                        <th className="py-2.5 px-3">شرح تراکنش</th>
                        <th className="py-2.5 px-3">طرف حساب / فروشنده</th>
                        <th className="py-2.5 px-3 text-left">مبلغ (تومان)</th>
                        <th className="py-2.5 px-3 text-center">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Replenishments for this account */}
                      {accountReplenishments.map((rep) => (
                        <tr key={rep.id} className="bg-emerald-50/20 hover:bg-emerald-50/40">
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                              شارژ واریزی
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{rep.date}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{rep.description}</td>
                          <td className="py-2.5 px-3 text-slate-600">{rep.sourceBankAccountName}</td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-700 tabular-nums">
                            +{formatCurrency(rep.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-[10px] text-emerald-700 font-semibold">
                              {rep.status}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {/* Expenses for this account */}
                      {accountExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                              هزینه ({exp.category})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{exp.date}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{exp.description}</td>
                          <td className="py-2.5 px-3 text-slate-600">{exp.vendor}</td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900 tabular-nums">
                            -{formatCurrency(exp.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
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
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            هیچ تراکنشی برای این تنخواه‌گردان ثبت نشده است.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Petty Cash Account */}
      {isNewAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-base font-bold text-slate-900">تعریف حساب تنخواه‌گردان جدید</h3>
                <p className="text-xs text-slate-500 mt-0.5">ثبت تنخواه کارگاهی یا اداری به همراه سقف و مسئول</p>
              </div>
              <button
                onClick={() => setIsNewAccountModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 font-bold rounded-lg flex items-center gap-2 animate-in fade-in duration-200 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عنوان تنخواه <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: تنخواه کارگاه فاز ۲ نیلوفر"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    کد سیستمی تنخواه
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    مسئول تنخواه <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="نام و نام خانوادگی مسئول"
                    value={formData.holderName}
                    onChange={(e) => setFormData({ ...formData, holderName: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سمت سازمانی مسئول
                  </label>
                  <select
                    value={formData.holderRole}
                    onChange={(e) => setFormData({ ...formData, holderRole: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    پروژه مرتبط
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value="all">دفتر مرکزی تهران</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره تماس مسئول
                  </label>
                  <input
                    type="text"
                    placeholder="0912-..."
                    value={formData.holderPhone}
                    onChange={(e) => setFormData({ ...formData, holderPhone: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سقف مجاز تنخواه (تومان)
                  </label>
                  <input
                    type="number"
                    step="1000000"
                    value={formData.ceilingLimit}
                    onChange={(e) => setFormData({ ...formData, ceilingLimit: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-500">
                    {formatCurrency(formData.ceilingLimit)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    حداقل موجودی هشدار (تومان)
                  </label>
                  <input
                    type="number"
                    step="1000000"
                    value={formData.minBalanceWarning}
                    onChange={(e) =>
                      setFormData({ ...formData, minBalanceWarning: Number(e.target.value) })
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-500">
                    {formatCurrency(formData.minBalanceWarning)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  حساب بانکی مبدا شارژ
                </label>
                <select
                  value={formData.sourceBankAccountId}
                  onChange={(e) => setFormData({ ...formData, sourceBankAccountId: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber} ({formatCurrency(b.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  توضیحات و شماره کارت تنخواه
                </label>
                <textarea
                  rows={2}
                  placeholder="شماره کارت ۱۶ رقمی بانکی یا نکات کنترلی..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewAccountModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-xs"
                >
                  ثبت و فعال‌سازی تنخواه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
