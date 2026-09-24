/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  Building2,
  HardHat,
  Truck,
  Search,
  Filter,
  Star,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Plus,
  DollarSign,
  Briefcase,
  FileText,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Project, Supplier } from '../../types';
import { ClientPartner, mockClients } from '../../data/partnersMockData';
import { useStoreSlice } from '../../store/AppStore';
import { mockSuppliers } from '../../data/procurementMockData';
import { formatNumber, formatCurrencyCompact } from '../../utils/formatters';

interface PartnersModuleProps {
  projects: Project[];
  onOpenClientContract?: (contractId: string) => void;
  onOpenSubcontractorContract?: (contractId: string) => void;
}

export const PartnersModule: React.FC<PartnersModuleProps> = ({
  projects,
  onOpenClientContract,
  onOpenSubcontractorContract,
}) => {
  const [activeTab, setActiveTab] = useState<'clients' | 'subcontractors' | 'suppliers'>('clients');

  const [clients, setClients] = useState<ClientPartner[]>(mockClients);
  const [subcontracts] = useStoreSlice('subcontractorContracts');
  const [suppliers] = useState<Supplier[]>(mockSuppliers);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientForModal, setSelectedClientForModal] = useState<ClientPartner | null>(null);

  // Group subcontracts by subcontractor name to create subcontractor profiles
  const subcontractorProfiles = React.useMemo(() => {
    const map = new Map<string, any>();
    subcontracts.forEach((sc) => {
      const existing = map.get(sc.subcontractorName) || {
        id: sc.id,
        name: sc.subcontractorName,
        trade: sc.tradeType,
        contracts: [],
        totalContractValue: 0,
        totalExecutedAmount: 0,
        totalPaidAmount: 0,
        totalRemainingBalance: 0,
        totalRetentionHeld: 0,
        projects: new Set<string>(),
        rating: 4.5,
      };

      existing.contracts.push(sc);
      existing.totalContractValue += sc.contractValue || 0;
      existing.totalExecutedAmount += sc.approvedStatementsValue || 0;
      existing.totalPaidAmount += sc.paidValue || 0;
      existing.totalRemainingBalance += sc.remainingPayableValue || 0;
      existing.totalRetentionHeld += sc.retentionDeposit || 0;
      existing.projects.add(sc.projectName);

      map.set(sc.subcontractorName, existing);
    });

    return Array.from(map.values()).map((p) => ({
      ...p,
      projectsList: Array.from(p.projects),
    }));
  }, [subcontracts]);

  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.representative.toLowerCase().includes(q);
  });

  const filteredSubcontractors = subcontractorProfiles.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.trade.toLowerCase().includes(q);
  });

  const filteredSuppliers = suppliers.filter((sup) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return sup.name.toLowerCase().includes(q) || sup.category.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">
              سامانه جامع مدیریت شرکا و ذینفعان (Stakeholders Directory)
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              تفکیک ۳ لایه: کارفرمایان • پیمانکاران جزء • تأمین‌کنندگان
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            شناسنامه، سوابق قراردادی، عملکرد و وضعیت حساب شرکای تجاری شرکت
          </h2>
          <p className="text-xs text-slate-500">
            مشاهده تعهدات مالی، مطالبات از کارفرما، تضامین حسن انجام کار و سوابق کیفی به تفکیک پروژه
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('clients')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'clients' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>کارفرمایان (Clients)</span>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-mono">
              {clients.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('subcontractors')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'subcontractors'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardHat className="w-3.5 h-3.5 text-amber-600" />
            <span>پیمانکاران جزء (Subcontractors)</span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-mono">
              {subcontractorProfiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'suppliers' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            <span>تأمین‌کنندگان (Suppliers)</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-mono">
              {suppliers.length}
            </span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
          <input
            type="text"
            placeholder={
              activeTab === 'clients'
                ? 'جستجوی کارفرما، نماینده، شماره ملی...'
                : activeTab === 'subcontractors'
                ? 'جستجوی پیمانکار جزء، رسته تخصصی، پروژه...'
                : 'جستجوی تأمین‌کننده، رسته کالا...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>

        <span className="text-slate-400 font-mono text-[11px]">
          نتایج: {activeTab === 'clients' ? filteredClients.length : activeTab === 'subcontractors' ? filteredSubcontractors.length : filteredSuppliers.length} طرف‌حساب
        </span>
      </div>

      {/* View 1: Clients */}
      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.map((cli) => (
            <div
              key={cli.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                        {cli.code}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {cli.type}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{cli.name}</h3>
                  </div>

                  <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold text-slate-800 font-mono">{cli.rating}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 mb-4 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400">نماینده تام‌الاختیار:</span>
                    <span className="font-medium text-slate-800">{cli.representative}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">تلفن و مکاتبات:</span>
                    <span className="font-mono text-slate-700">{cli.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">انضباط پرداخت:</span>
                    <span
                      className={`font-semibold ${
                        cli.paymentPunctuality === 'عالی'
                          ? 'text-emerald-700'
                          : cli.paymentPunctuality === 'با تأخیر مداوم'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {cli.paymentPunctuality}
                    </span>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3 font-mono">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-sans block">کل ارزش قرارداد:</span>
                    <strong className="text-slate-900">{formatCurrencyCompact(cli.totalContractValue)}</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-sans block">کارکرد تأیید شده:</span>
                    <strong className="text-blue-700">{formatCurrencyCompact(cli.totalApprovedRevenue)}</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-sans block">وصول شده نقدی:</span>
                    <strong className="text-emerald-700">{formatCurrencyCompact(cli.totalCollected)}</strong>
                  </div>
                  <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-[10px] text-rose-500 font-sans block">مانده مطالبات شرکت:</span>
                    <strong className="text-rose-700">{formatCurrencyCompact(cli.currentReceivables)}</strong>
                  </div>
                </div>

                {/* Projects Assigned */}
                <div className="text-xs">
                  <span className="text-slate-400 text-[11px] block mb-1">پروژه‌های در حال اجرا با این کارفرما:</span>
                  <div className="space-y-1">
                    {cli.projects.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-[11px]"
                      >
                        <span className="font-medium text-slate-800">{p.name}</span>
                        <span className="text-slate-500 font-mono">مطالبه: {formatCurrencyCompact(p.receivables)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">شناسه اقتصادی: {cli.economicCode}</span>
                <button
                  onClick={() => setSelectedClientForModal(cli)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>پرونده کامل کارفرما</span>
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View 2: Subcontractors */}
      {activeTab === 'subcontractors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSubcontractors.map((sub) => (
            <div
              key={sub.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[10px] font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold inline-block mb-1">
                      {sub.trade}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{sub.name}</h3>
                  </div>

                  <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold text-slate-800 font-mono">{sub.rating}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 mb-3">
                  <span className="text-slate-400 text-[11px]">پروژه‌های همکاری: </span>
                  <span className="font-medium text-slate-800">{sub.projectsList.join('، ')}</span>
                </div>

                {/* Subcontractor Financials */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3 font-mono">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-sans block">مبلغ کل قراردادها:</span>
                    <strong className="text-slate-900">{formatCurrencyCompact(sub.totalContractValue)}</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-sans block">صورت‌وضعیت کارکرد:</span>
                    <strong className="text-blue-700">{formatCurrencyCompact(sub.totalExecutedAmount)}</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-sans block">پرداخت شده به پیمانکار:</span>
                    <strong className="text-emerald-700">{formatCurrencyCompact(sub.totalPaidAmount)}</strong>
                  </div>
                  <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-[10px] text-amber-600 font-sans block">بدهی مانده به پیمانکار:</span>
                    <strong className="text-amber-800">{formatCurrencyCompact(sub.totalRemainingBalance)}</strong>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl text-xs flex justify-between items-center text-slate-600">
                  <span>سپرده حسن انجام کار مکسوره (نزد شرکت):</span>
                  <strong className="font-mono text-slate-900 font-bold">
                    {formatNumber(sub.totalRetentionHeld)} تومان
                  </strong>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono">{sub.contracts.length} فقره قرارداد جزء</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>تضامین معتبر است</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View 3: Suppliers */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSuppliers.map((sup) => (
            <div
              key={sup.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold inline-block mb-1">
                      {sup.category}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{sup.name}</h3>
                  </div>

                  <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-1 rounded-lg">
                    رتبه: {sup.grade}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-600 mb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">طرف تماس:</span>
                    <span>{sup.contactPerson} ({sup.phone})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">شرایط پرداخت:</span>
                    <span className="font-medium text-slate-800">{sup.paymentTerms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">شهر / استان:</span>
                    <span>{sup.city}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3 font-mono">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-sans block">سفارشات خرید (PO):</span>
                    <strong className="text-slate-900">{sup.performance?.totalOrdersCount ?? 0} سفارش</strong>
                  </div>
                  <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-[10px] text-amber-600 font-sans block">بدهی مانده به تأمین‌کننده:</span>
                    <strong className="text-amber-800">{formatCurrencyCompact(sup.financials?.currentPayableBalance ?? 0)}</strong>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono text-[11px] truncate max-w-[200px]">{sup.address}</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>وندور تایید شده</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Client Dossier */}
      {selectedClientForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 text-right animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedClientForModal.name}</h3>
                <span className="text-xs text-slate-500 font-mono">کد سیستم: {selectedClientForModal.code}</span>
              </div>
              <button
                onClick={() => setSelectedClientForModal(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">شناسه ملی:</span>
                  <span className="font-mono text-slate-800 font-bold">{selectedClientForModal.nationalId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">کد اقتصادی:</span>
                  <span className="font-mono text-slate-800 font-bold">{selectedClientForModal.economicCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">نماینده مجری:</span>
                  <span className="text-slate-800">{selectedClientForModal.representative}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">تلفن تماس:</span>
                  <span className="font-mono text-slate-800">{selectedClientForModal.phone}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[11px]">نشانی قانونی:</span>
                  <span className="text-slate-800">{selectedClientForModal.address}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">قراردادها و صورت‌وضعیت‌ها با این کارفرما</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">پروژه</th>
                        <th className="py-2.5 px-3">شماره قرارداد</th>
                        <th className="py-2.5 px-3 text-left">مبلغ پیمان</th>
                        <th className="py-2.5 px-3 text-left">کارکرد مصوب</th>
                        <th className="py-2.5 px-3 text-left">مانده مطالبات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedClientForModal.projects.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{p.name}</td>
                          <td className="py-2.5 px-3 font-mono">{p.contractNumber}</td>
                          <td className="py-2.5 px-3 text-left font-mono">{formatCurrencyCompact(p.contractAmount)}</td>
                          <td className="py-2.5 px-3 text-left font-mono text-blue-700">{formatCurrencyCompact(p.approvedRevenue)}</td>
                          <td className="py-2.5 px-3 text-left font-mono text-rose-700 font-bold">{formatCurrencyCompact(p.receivables)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 flex justify-end">
              <button
                onClick={() => setSelectedClientForModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs cursor-pointer font-medium"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
