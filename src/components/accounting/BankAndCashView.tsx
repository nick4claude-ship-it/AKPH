import React, { useState } from 'react';
import {
  Landmark,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Plus,
  Search,
} from 'lucide-react';
import {
  BankAccount,
  CashDesk,
  BankReconciliationItem,
} from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { moneyUnitLabel } from '../../utils/money';
import { useCompany } from '../../store/session';

interface BankAndCashViewProps {
  bankAccounts: BankAccount[];
  cashDesks: CashDesk[];
  reconciliationItems: BankReconciliationItem[];
  onTriggerReconciliation: (id: string) => void;
}

export const BankAndCashView: React.FC<BankAndCashViewProps> = ({
  bankAccounts,
  cashDesks,
  reconciliationItems,
  onTriggerReconciliation,
}) => {
  const company = useCompany();
  const [activeTab, setActiveTab] = useState<'banks' | 'cash' | 'reconciliation'>('banks');
  const [selectedBankId, setSelectedBankId] = useState<string>(bankAccounts[0]?.id || '');

  const currentBank = bankAccounts.find((b) => b.id === selectedBankId) || bankAccounts[0];

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Tab Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('banks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'banks' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>حساب‌های بانکی ({bankAccounts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('cash')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'cash' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>صندوق‌های ریالی ({cashDesks.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'reconciliation' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>تطبیق و مغایرت‌گیری بانکی (Bank Reconciliation)</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
          خزانه‌داری متمرکز {company.name}
        </span>
      </div>

      {/* SECTION 1: BANK ACCOUNTS */}
      {activeTab === 'banks' && (
        <div className="space-y-4">
          {/* Bank Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bankAccounts.map((bank) => (
              <div
                key={bank.id}
                onClick={() => setSelectedBankId(bank.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer text-right ${
                  selectedBankId === bank.id
                    ? 'bg-blue-50/40 border-blue-500 shadow-xs ring-1 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{bank.bankName}</h4>
                      <span className="text-[10px] text-slate-400">شعبه {bank.branch}</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                    {bank.status}
                  </span>
                </div>

                <div className="mt-3 font-mono">
                  <span className="text-[10px] font-sans text-slate-500 block">مانده موجودی نقد:</span>
                  <div className="text-base font-extrabold text-slate-900 tabular-nums">
                    {formatCurrency(bank.balance)}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span className="font-sans">شماره حساب:</span>
                    <strong className="text-slate-700">{bank.accountNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans">شماره شبا:</span>
                    <span className="text-[10px] text-slate-600">{bank.shebaNumber}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Bank Ledger Reconciliation Formula (Requirement 13) */}
          {currentBank && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    گردش دفاتر مالی: {currentBank.bankName} (شعبه {currentBank.branch})
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    صاحب حساب: {currentBank.holderName}
                  </span>
                </div>
                <div className="font-mono text-xs text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                  فرمول استاندارد گردش حساب خزانه‌داری
                </div>
              </div>

              {/* Equation Display Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center font-mono">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-sans text-slate-500 block mb-1">
                    مانده اول دوره (Opening)
                  </span>
                  <strong className="text-sm text-slate-800">{formatCurrency(currentBank.openingBalance)}</strong>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                  <span className="text-[10px] font-sans text-emerald-700 block mb-1">
                    + کل واریزها (Receipts)
                  </span>
                  <strong className="text-sm text-emerald-800">{formatCurrency(currentBank.totalReceipts)}</strong>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                  <span className="text-[10px] font-sans text-rose-700 block mb-1">
                    - کل برداشت‌ها (Payments)
                  </span>
                  <strong className="text-sm text-rose-800">{formatCurrency(currentBank.totalPayments)}</strong>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
                  <span className="text-[10px] font-sans text-blue-700 block mb-1">
                    = مانده پایان دوره (Closing)
                  </span>
                  <strong className="text-sm text-blue-900 font-extrabold">{formatCurrency(currentBank.closingBalance)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: CASH DESKS (صندوق‌های ریالی) */}
      {activeTab === 'cash' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cashDesks.map((cash) => (
            <div key={cash.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs text-right">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{cash.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">کد: {cash.code}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                  شمارش: {cash.lastCountDate}
                </span>
              </div>

              <div className="mt-4 font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-sans text-slate-500 block">مانده فیزیکی در صندوق:</span>
                  <span className="text-base font-extrabold text-slate-900">{formatCurrency(cash.balance)}</span>
                </div>
                <button className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg cursor-pointer">
                  شمارش و صورت‌جلسه
                </button>
              </div>

              <div className="mt-3 text-xs text-slate-600 space-y-1">
                <div>مسئول و خزانه‌دار: <strong>{cash.keeperName}</strong></div>
                <div>محل استقرار فیزیکی: <span className="text-slate-500">{cash.location}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 3: BANK RECONCILIATION (تطبیق بانکی) */}
      {activeTab === 'reconciliation' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>مغایرت‌گیری و تطبیق صورت‌حساب بانک با دفاتر مالی (Bank Statement vs Books)</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                شناسایی اقلام باز بانکی، تراکنش‌های فاقد سند دفتری و چک‌های صادره وصول‌نشده
              </p>
            </div>

            <button
              disabled
              title="اتصال به وب‌سرویس صورت‌حساب الکترونیکی بانک مرکزی"
              className="flex items-center gap-1.5 bg-slate-100 text-slate-400 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold cursor-not-allowed opacity-75"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>تطبیق خودکار برخط (به‌زودی)</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-mono">تاریخ</th>
                  <th className="py-2.5 px-4">شرح تراکنش بانکی</th>
                  <th className="py-2.5 px-3">نوع</th>
                  <th className="py-2.5 px-3 font-mono text-left">مبلغ ({moneyUnitLabel()})</th>
                  <th className="py-2.5 px-3">وضعیت تطبیق</th>
                  <th className="py-2.5 px-4">نوع مغایرت</th>
                  <th className="py-2.5 px-4 text-center">اقدام اصلاحی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {reconciliationItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-600 text-[11px]">{item.date}</td>
                    <td className="py-3 px-4 font-sans text-slate-800 font-medium">{item.description}</td>
                    <td className="py-3 px-3 font-sans">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.type === 'واریز' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-left tabular-nums font-bold text-slate-900">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      {item.matched ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>تطبیق کامل با {item.matchedDocNumber}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-bold">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>دارای مغایرت</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans text-[11px] text-slate-600">
                      {item.discrepancyType}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      {!item.matched && (
                        <button
                          onClick={() => onTriggerReconciliation(item.id)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded text-xs font-semibold cursor-pointer"
                        >
                          صدور سند تسویه
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
