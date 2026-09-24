import React, { useState } from 'react';
import {
  ArrowDownLeft,
  PlusCircle,
  Building2,
  Wallet,
  Clock,
  CheckCircle2,
  FileText,
  AlertTriangle,
  CreditCard,
  X,
  Layers,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import {
  PettyCashAccount,
  PettyCashReplenishment,
  PettyCashReplenishmentRequest,
  BankAccount,
  User,
} from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { generateUUID, getNextSequentialDocNumber } from '../../utils/ids';
import { getCurrentPersianYear } from '../../utils/date';

interface ReplenishmentViewProps {
  accounts: PettyCashAccount[];
  bankAccounts: BankAccount[];
  replenishments: PettyCashReplenishment[];
  requests: PettyCashReplenishmentRequest[];
  currentUser: User;
  onExecuteReplenish: (replenish: PettyCashReplenishment) => void;
  onApproveRequest: (requestId: string) => void;
}

export const ReplenishmentView: React.FC<ReplenishmentViewProps> = ({
  accounts,
  bankAccounts,
  replenishments,
  requests,
  currentUser,
  onExecuteReplenish,
  onApproveRequest,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [amount, setAmount] = useState<number>(50_000_000);
  const [sourceBankId, setSourceBankId] = useState(bankAccounts[0]?.id || '');
  const [date, setDate] = useState('۱۴۰۳/۰۷/۰۲');
  const [transferMethod, setTransferMethod] = useState<
    'حواله ساتنا/پایا' | 'کارت به کارت' | 'چک بانکی' | 'نقدی'
  >('حواله ساتنا/پایا');
  const [trackingNumber, setTrackingNumber] = useState(
    `PAYA-${Math.floor(10000000 + Math.random() * 90000000)}`
  );
  const [description, setDescription] = useState('شارژ نوبتی تنخواه کارگاه بر اساس مخارج مصوب دوره');
  const [formError, setFormError] = useState<string | null>(null);

  const targetAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const sourceBank = bankAccounts.find((b) => b.id === sourceBankId) || bankAccounts[0];

  const handleOpenForRequest = (req: PettyCashReplenishmentRequest) => {
    setSelectedAccountId(req.pettyCashId);
    setAmount(req.suggestedAmount);
    setDescription(`شارژ تنخواه پیرو درخواست شماره ${req.requestNumber} (${req.reason})`);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setFormError('مبلغ شارژ باید بیشتر از صفر باشد.');
      return;
    }

    if (sourceBank && amount > sourceBank.balance) {
      setFormError('خطا: موجودی حساب بانکی مبدا برای انجام این حواله کافی نمی‌باشد.');
      return;
    }
    setFormError(null);

    const docNum = getNextSequentialDocNumber(
      replenishments.map((r) => r.docNumber),
      'RPL',
      4,
      getCurrentPersianYear()
    );

    const newReplenish: PettyCashReplenishment = {
      id: generateUUID(),
      docNumber: docNum,
      pettyCashId: targetAccount.id,
      pettyCashTitle: targetAccount.title,
      amount,
      sourceBankAccountId: sourceBank.id,
      sourceBankAccountName: `${sourceBank.bankName} - ${sourceBank.accountNumber}`,
      date,
      transferMethod,
      trackingNumber,
      description,
      approvedBy: `${currentUser.name} (${currentUser.role})`,
      journalEntryId: `ACC-1403-0${Math.floor(830 + Math.random() * 50)}`,
      status: 'تأیید و واریز شد',
    };

    onExecuteReplenish(newReplenish);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            عملیات شارژ و انتقال نقدینگی به تنخواه‌گردان‌ها
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تغذیه نقدی حساب‌های تنخواه از محل حساب‌های بانکی شرکت و صدور مکانیزه سند دوبل حسابداری
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
        >
          <ArrowDownLeft className="w-4 h-4" />
          ثبت حواله شارژ تنخواه
        </button>
      </div>

      {/* Pending Requests Section (درخواست‌های شارژ معلق کارگاه‌ها) */}
      {requests.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-300 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-700" />
              <h3 className="text-sm font-bold text-amber-950">
                درخواست‌های شارژ مجدد در انتظار بررسی ({requests.length.toLocaleString('fa-IR')})
              </h3>
            </div>
            <span className="text-xs text-amber-800 font-medium">ارسال شده از کارگاه‌ها</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-xl p-4 border border-amber-200 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {req.requestNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{req.pettyCashTitle}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      درخواست‌کننده: {req.requesterName} ({req.requesterRole}) - {req.date}
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] text-slate-500 block">مبلغ پیشنهادی:</span>
                    <span className="font-mono font-bold text-sm text-amber-700 tabular-nums">
                      {formatCurrency(req.suggestedAmount)}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-1 text-slate-700 border border-slate-100">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">موجودی فعلی واقعی:</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-800">
                      {formatCurrency(req.currentActualBalance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">مانده قابل مصرف آزاد:</span>
                    <span className="font-mono font-bold tabular-nums text-rose-600">
                      {formatCurrency(req.currentUsableBalance)}
                    </span>
                  </div>
                  <div className="pt-1 text-[11px] text-slate-600 border-t border-slate-200">
                    <strong>علت نیاز:</strong> {req.reason}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleOpenForRequest(req)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-2xs flex items-center gap-1"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    تأیید و صدور حواله شارژ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History of Past Replenishments */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">سوابق شارژهای واریزی به تنخواه‌ها</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              لیست حواله‌های بانکی، چک‌ها و اسناد انتقال وجه با شناسه رهگیری
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">شماره حواله</th>
                <th className="py-3 px-4">تاریخ</th>
                <th className="py-3 px-4">تنخواه‌گردان مقصد</th>
                <th className="py-3 px-4">حساب بانکی مبدا</th>
                <th className="py-3 px-4">روش انتقال</th>
                <th className="py-3 px-4">شماره پیگیری بانکی</th>
                <th className="py-3 px-4 text-left">مبلغ شارژ (تومان)</th>
                <th className="py-3 px-4">تأییدکننده مالی</th>
                <th className="py-3 px-4 text-center">سند حسابداری</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {replenishments.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                    {rep.docNumber}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{rep.date}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{rep.pettyCashTitle}</td>
                  <td className="py-3.5 px-4 text-slate-600">{rep.sourceBankAccountName}</td>
                  <td className="py-3.5 px-4">
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                      {rep.transferMethod}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                    {rep.trackingNumber}
                  </td>
                  <td className="py-3.5 px-4 text-left font-mono font-bold text-emerald-700 tabular-nums text-xs">
                    +{formatCurrency(rep.amount)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-[11px]">{rep.approvedBy}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="font-mono text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                      {rep.journalEntryId || 'ثبت دوبل'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Replenish Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-base font-bold text-slate-900">ثبت حواله شارژ تنخواه‌گردان</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  انتقال وجه از حساب بانکی شرکت به کارت تنخواه کارگاه
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 font-bold rounded-lg flex items-center gap-2 animate-in fade-in duration-200 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}
              {/* Target Petty Cash */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تنخواه‌گردان مقصد <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white font-medium"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.projectName}) - مانده فعلی: {formatCurrency(a.actualBalance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Bank */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  حساب بانکی مبدا شرکت (برداشت وجه) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={sourceBankId}
                  onChange={(e) => setSourceBankId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white font-medium"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber} (موجودی موجود:{' '}
                      {formatCurrency(b.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    مبلغ شارژ (تومان) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1000000"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {formatCurrency(amount)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تاریخ واریز حواله <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Transfer Method & Tracking Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    روش انتقال وجه
                  </label>
                  <select
                    value={transferMethod}
                    onChange={(e) => setTransferMethod(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="حواله ساتنا/پایا">حواله پایا / ساتنا</option>
                    <option value="کارت به کارت">انتقال کارت به کارت</option>
                    <option value="چک بانکی">صدور چک بانکی</option>
                    <option value="نقدی">تحویل نقدی به کارپرداز</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره پیگیری / حواله
                  </label>
                  <input
                    type="text"
                    required
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  شرح سند شارژ تنخواه
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Financial Effect Preview (Prompt Section 4 & 11) */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-1.5 text-emerald-900">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  اثر خودکار در تراز حسابداری و نقدینگی:
                </div>
                <div className="text-[11px] leading-relaxed">
                  • بدهکار: تنخواه‌گردان {targetAccount?.title} ({formatCurrency(amount)})
                  <br />• بستانکار: حساب جاری {sourceBank?.bankName} ({formatCurrency(amount)})
                  <br />• موجودی قابل مصرف تنخواه به {formatCurrency(targetAccount ? targetAccount.usableBalance + amount : amount)} افزایش می‌یابد.
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                >
                  تأیید حواله و ثبت در دفاتر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
