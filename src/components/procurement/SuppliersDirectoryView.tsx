import React, { useState } from 'react';
import {
  Building2,
  Search,
  Filter,
  Plus,
  Star,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  ShieldCheck,
  Award,
  Layers,
  FileText,
  X,
  ExternalLink,
} from 'lucide-react';
import { Supplier, ProcurementCategory, VendorGrade } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { formatMoney, formatMoneyCompact } from '../../utils/money';

interface SuppliersDirectoryViewProps {
  suppliers: Supplier[];
  onOpenNewSupplierModal: () => void;
}

export const SuppliersDirectoryView: React.FC<SuppliersDirectoryViewProps> = ({
  suppliers,
  onOpenNewSupplierModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [activeSupplierProfile, setActiveSupplierProfile] = useState<Supplier | null>(null);

  const filteredSuppliers = suppliers.filter((sup) => {
    if (selectedCategory !== 'all' && sup.category !== selectedCategory) return false;
    if (selectedGrade !== 'all' && sup.grade !== selectedGrade) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = sup.name.toLowerCase().includes(q);
      const matchContact = sup.contactPerson.toLowerCase().includes(q);
      const matchCity = sup.city.toLowerCase().includes(q);
      const matchCode = sup.code.toLowerCase().includes(q);
      return matchName || matchContact || matchCity || matchCode;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Filter and Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                وندورلیست رسمی شرکت و ارزیابی تأمین‌کنندگان (AVL)
              </h3>
              <p className="text-xs text-slate-500">
                فهرست تأمین‌کنندگان معتبر مقاطع فولادی، بتن، تأسیسات و مصالح با رتبه‌بندی کیفی و کارنامه مالی
              </p>
            </div>
          </div>

          <button
            onClick={onOpenNewSupplierModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف تأمین‌کننده در وندورلیست</span>
          </button>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در نام شرکت، مدیر فروش، شهر، کد وندور..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 outline-hidden"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 outline-hidden"
            >
              <option value="all">تمام رسته‌ها و گروه‌های کالا</option>
              <option value="آهن‌آلات و مقاطع فولادی">آهن‌آلات و مقاطع فولادی</option>
              <option value="سیمان، بتن و فرآورده‌های بتنی">سیمان، بتن و فرآورده‌های بتنی</option>
              <option value="تأسیسات مکانیکی و پایپینگ">تأسیسات مکانیکی و پایپینگ</option>
              <option value="تأسیسات الکتریکی و تابلو برق">تأسیسات الکتریکی و تابلو برق</option>
              <option value="تجهیزات قالب‌بندی و ماشین‌آلات">تجهیزات قالب‌بندی و ماشین‌آلات</option>
              <option value="عایق، رنگ و شیمی ساختمان">عایق، رنگ و شیمی ساختمان</option>
            </select>
          </div>

          <div>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 outline-hidden font-bold"
            >
              <option value="all">تمام گریدها</option>
              <option value="A+">گرید A+ (استراتژیک و ممتاز)</option>
              <option value="A">گرید A (معتبر و مورد تأیید)</option>
              <option value="B">گرید B (متوسط)</option>
              <option value="C">گرید C (مشروط)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Suppliers Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSuppliers.map((supplier) => (
          <div
            key={supplier.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
                    {supplier.code}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                      supplier.grade === 'A+'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : supplier.grade === 'A'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    گرید {supplier.grade}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{supplier.performance.overallRating}</span>
                </span>
              </div>

              <h4 className="font-black text-slate-900 text-sm mb-1">{supplier.name}</h4>
              <p className="text-xs text-indigo-600 font-medium mb-3">{supplier.category}</p>

              {/* Financial Snapshot */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs mb-3">
                <div className="flex justify-between text-slate-600">
                  <span>حجم کل معاملات:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatMoneyCompact(supplier.financials.totalPurchasesAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>مانده بستانکاری طرف حساب:</span>
                  <span className="font-mono font-bold text-rose-600">
                    {formatMoneyCompact(supplier.financials.currentPayableBalance)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>شرایط پرداخت:</span>
                  <span className="font-bold text-slate-900">{supplier.paymentTerms}</span>
                </div>
              </div>

              {/* 4 Pillars Mini Scores */}
              <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                <div className="bg-slate-100/60 p-1.5 rounded-lg">
                  <span className="text-slate-400 block">کیفیت</span>
                  <span className="font-mono font-bold text-slate-800">{supplier.performance.qualityScore}٪</span>
                </div>
                <div className="bg-slate-100/60 p-1.5 rounded-lg">
                  <span className="text-slate-400 block">تحویل</span>
                  <span className="font-mono font-bold text-slate-800">{supplier.performance.deliveryScore}٪</span>
                </div>
                <div className="bg-slate-100/60 p-1.5 rounded-lg">
                  <span className="text-slate-400 block">قیمت</span>
                  <span className="font-mono font-bold text-slate-800">{supplier.performance.priceCompetitiveness}٪</span>
                </div>
                <div className="bg-slate-100/60 p-1.5 rounded-lg">
                  <span className="text-slate-400 block">اعتبار</span>
                  <span className="font-mono font-bold text-slate-800">{supplier.performance.paymentFlexibility}٪</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">{supplier.city}</span>
              <button
                onClick={() => setActiveSupplierProfile(supplier)}
                className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                پرونده کامل و مالی
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Supplier Profile Modal */}
      {activeSupplierProfile && (
        <Dialog onClose={() => setActiveSupplierProfile(null)} label="پرونده جامع تأمین‌کننده" overlayClassName="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    پرونده جامع تأمین‌کننده {activeSupplierProfile.name}
                  </h3>
                  <p className="text-xs text-slate-500">کد وندور: {activeSupplierProfile.code} · رسته: {activeSupplierProfile.category}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveSupplierProfile(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
              {/* Top Banner Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 block">گرید وندورلیست</span>
                  <span className="text-lg font-black text-amber-600 font-mono">گرید {activeSupplierProfile.grade}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 block">امتیاز ارزیابی کیفی</span>
                  <span className="text-lg font-black text-emerald-600 font-mono">{activeSupplierProfile.performance.overallRating} / ۵</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 block">تحویل به‌موقع</span>
                  <span className="text-lg font-black text-indigo-600 font-mono">{activeSupplierProfile.performance.onTimeDeliveryRate}٪</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 block">نرخ ضایعات / عودت</span>
                  <span className="text-lg font-black text-slate-700 font-mono">{activeSupplierProfile.performance.rejectionRate}٪</span>
                </div>
              </div>

              {/* Corporate Legal & Banking Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-2">
                  <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-teal-600" />
                    <span>مشخصات هویتی و ثبتی</span>
                  </h4>
                  <div className="flex justify-between"><span className="text-slate-500">شناسه ملی:</span> <span className="font-mono font-bold">{activeSupplierProfile.nationalId}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">کد اقتصادی:</span> <span className="font-mono font-bold">{activeSupplierProfile.economicCode}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">مسئول فروش:</span> <span className="font-bold">{activeSupplierProfile.contactPerson}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">تلفن و موبایل:</span> <span className="font-mono">{activeSupplierProfile.phone} / {activeSupplierProfile.mobile}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">آدرس کارخانه:</span> <span>{activeSupplierProfile.address}</span></div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-2">
                  <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <span>حساب‌های بانکی و تسویه</span>
                  </h4>
                  <div className="flex justify-between"><span className="text-slate-500">بانک عامل:</span> <span className="font-bold">{activeSupplierProfile.bankAccount.bankName}</span></div>
                  <div><span className="text-slate-500 block mb-0.5">شماره شبا:</span> <span className="font-mono font-bold text-slate-900">{activeSupplierProfile.bankAccount.shebaNumber}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">صاحب حساب:</span> <span className="font-bold">{activeSupplierProfile.bankAccount.cardHolder}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">گواهی ارزش افزوده:</span> <span className="font-bold text-emerald-700">✓ معتبر و فعال در سامانه مودیان</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">شرایط پرداخت:</span> <span className="font-bold text-slate-800">{activeSupplierProfile.paymentTerms}</span></div>
                </div>
              </div>

              {/* Financial Status Summary */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                  خلاصه تراز حساب و تعهدات مالی
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <span className="text-slate-500 block text-[11px]">مجموع خریدهای انجام شده:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {formatMoney(activeSupplierProfile.financials.totalPurchasesAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">مانده بدهی شرکت به فروشنده:</span>
                    <span className="font-mono font-bold text-rose-600 text-sm">
                      {formatMoney(activeSupplierProfile.financials.currentPayableBalance)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">چک‌های صیادی در جریان:</span>
                    <span className="font-mono font-bold text-indigo-700 text-sm">
                      {formatMoney(activeSupplierProfile.financials.unclearedChecksAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {activeSupplierProfile.notes && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-slate-600 leading-relaxed">
                  <span className="font-bold text-slate-800 block mb-0.5">یادداشت‌های ارزیابی فنی:</span>
                  {activeSupplierProfile.notes}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setActiveSupplierProfile(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors cursor-pointer"
              >
                بستن پرونده
              </button>
            </div>
          </Dialog>
      )}
    </div>
  );
};
