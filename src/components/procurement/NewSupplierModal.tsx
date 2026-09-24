import React, { useState } from 'react';
import { X, Building2, Check, ShieldCheck } from 'lucide-react';
import { Supplier, ProcurementCategory, VendorGrade } from '../../types';
import { Dialog } from '../common/Dialog';
import { generateUUID, nextDocNumber } from '../../utils/ids';
import { useAppState } from '../../store/AppStore';

interface NewSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSupplier: (supplier: Supplier) => void;
}

const CATEGORIES: ProcurementCategory[] = [
  'آهن‌آلات و مقاطع فولادی',
  'سیمان، بتن و فرآورده‌های بتنی',
  'تأسیسات مکانیکی و پایپینگ',
  'تأسیسات الکتریکی و تابلو برق',
  'تجهیزات قالب‌بندی و ماشین‌آلات',
  'عایق، رنگ و شیمی ساختمان',
  'نازک‌کاری و متریال دکوراتیو',
  'ایمنی کارگاه و HSE',
  'خدمات مهندسی و پیمانکاران دست‌دوم',
];

export const NewSupplierModal: React.FC<NewSupplierModalProps> = ({
  isOpen,
  onClose,
  onAddSupplier,
}) => {
  const existingCodes = useAppState().suppliers.map((s) => s.code);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProcurementCategory>('آهن‌آلات و مقاطع فولادی');
  const [grade, setGrade] = useState<VendorGrade>('A');
  const [nationalId, setNationalId] = useState('');
  const [economicCode, setEconomicCode] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('تهران');
  const [address, setAddress] = useState('');
  const [bankName, setBankName] = useState('بانک ملت');
  const [shebaNumber, setShebaNumber] = useState('IR');
  const [accountNumber, setAccountNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [hasVatCertificate, setHasVatCertificate] = useState(true);
  const [paymentTerms, setPaymentTerms] = useState<Supplier['paymentTerms']>('چک صیادی ۴۵ روزه');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = nextDocNumber(existingCodes, 'VEN');

    const newSupplier: Supplier = {
      id: generateUUID(),
      code,
      name: name.trim(),
      category,
      grade,
      nationalId,
      economicCode,
      contactPerson,
      phone,
      mobile,
      email,
      city,
      address,
      bankAccount: {
        bankName,
        shebaNumber,
        accountNumber,
        cardHolder: cardHolder || name,
      },
      hasVatCertificate,
      paymentTerms,
      // No history yet: scores start empty and are built from orders and receipts.
      performance: {
        qualityScore: 0,
        deliveryScore: 0,
        priceCompetitiveness: 0,
        paymentFlexibility: 0,
        overallRating: 0,
        totalOrdersCount: 0,
        onTimeDeliveryRate: 0,
        rejectionRate: 0,
      },
      financials: {
        totalPurchasesAmount: 0,
        currentPayableBalance: 0,
        unclearedChecksAmount: 0,
        lastTransactionDate: '—',
      },
      status: 'فعال در وندورلیست',
      notes,
    };

    onAddSupplier(newSupplier);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="تعریف تأمین‌کننده در وندورلیست رسمی (AVL)" overlayClassName="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
      
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">تعریف تأمین‌کننده در وندورلیست رسمی (AVL)</h3>
              <p className="text-xs text-slate-500">ثبت مشخصات حقوقی، بانکی، رسته تأمین و شرایط اعتباری تسویه</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">نام رسمی شرکت / فروشگاه:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً شرکت فولاد خوزستان"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">رسته فعالیت و مصالح:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProcurementCategory)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">گرید ارزیابی کیفی:</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as VendorGrade)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
              >
                <option value="A+">گرید A+ (تولیدکننده مادر / استراتژیک)</option>
                <option value="A">گرید A (تأمین‌کننده معتبر و منظم)</option>
                <option value="B">گرید B (متوسط / قابل ارزیابی)</option>
                <option value="C">گرید C (مشروط)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">شناسه ملی / کد ملی:</label>
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="10100000000"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">کد اقتصادی:</label>
              <input
                type="text"
                value={economicCode}
                onChange={(e) => setEconomicCode(e.target.value)}
                placeholder="411000000000"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">نام مسئول فروش / رابط:</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="مهندس احمدی"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">تلفن ثابت دفتر:</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="۰۲۱-۸۸۰۰۰۰۰۰"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">شماره همراه مستقیم:</label>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="۰۹۱۲۰۰۰۰۰۰۰"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">آدرس کارخانه / انبار / دفتر مرکزی:</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="تهران، شهرک صنعتی..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              required
            />
          </div>

          {/* Banking Details */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-3">
            <span className="font-bold text-slate-800 block text-xs">اطلاعات بانکی جهت واریز حواله و صدور چک صیادی:</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">نام بانک و شعبه:</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] text-slate-600 mb-1">شماره شبا (IBAN):</label>
                <input
                  type="text"
                  value={shebaNumber}
                  onChange={(e) => setShebaNumber(e.target.value)}
                  placeholder="IR89012..."
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">شرایط پرداخت توافق‌شده:</label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value as Supplier['paymentTerms'])}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              >
                <option value="نقدی پیش از تحویل">نقدی پیش از تحویل</option>
                <option value="نقدی پای کار">نقدی پای کار</option>
                <option value="چک صیادی ۴۵ روزه">چک صیادی ۴۵ روزه</option>
                <option value="چک صیادی ۶۰ روزه">چک صیادی ۶۰ روزه</option>
                <option value="اعتباری ماهانه">اعتباری ماهانه</option>
                <option value="تهاتر ملکی">تهاتر ملکی / واحد تجاری</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="hasVat"
                checked={hasVatCertificate}
                onChange={(e) => setHasVatCertificate(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="hasVat" className="font-bold text-slate-700 cursor-pointer">
                دارای گواهی معتبر مالیات بر ارزش افزوده (سامانه مودیان)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>افزودن به وندورلیست رسمی</span>
            </button>
          </div>
        </form>
      </Dialog>
  );
};
