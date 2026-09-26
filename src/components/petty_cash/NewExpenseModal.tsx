import React, { useState } from 'react';
import {
  X,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Eye,
  Building2,
  Package,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import {
  PettyCashAccount,
  PettyCashExpense,
  PettyCashAttachment,
  PettyCashCategoryItem,
  Project,
  User,
  AppDocument,
} from '../../types';
import { formatCurrency, formatNumber, formatText } from '../../utils/formatters';
import { toPersianDate } from '../../utils/date';
import { useSelector } from '../../store/AppStore';
import { attachmentFromFile, checkPettyExpenseForm, type PettyExpenseFormInput } from '../../store/views/pettyCash';
import { Dialog } from '../../ui/Dialog';
import { IntegerInput, MoneyInput } from '../../ui/NumberInput';
import { moneyUnitLabel } from '../../utils/money';
import { Money } from '../common/Money';

interface NewExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: PettyCashAccount[];
  categories: PettyCashCategoryItem[];
  projects: Project[];
  existingExpenses: PettyCashExpense[];
  currentUser: User;
  preselectedAccountId?: string;
  /** Validation (fund limits, balance) and approval level are decided by the workflow service. */
  /** Records the expense through the workflow (number, approval chain and attachments are handled there). */
  onSaveExpense: (form: PettyExpenseFormInput) => { ok: boolean; message: string };
}

export const NewExpenseModal: React.FC<NewExpenseModalProps> = ({
  isOpen,
  onClose,
  accounts,
  categories,
  projects,
  existingExpenses,
  currentUser,
  preselectedAccountId,
  onSaveExpense,
}) => {
  const defaultAccount =
    accounts.find((a) => a.id === preselectedAccountId) || accounts[0];

  const [selectedAccountId, setSelectedAccountId] = useState(defaultAccount?.id || '');
  const targetAccount = accounts.find((a) => a.id === selectedAccountId) || defaultAccount;

  const [date, setDate] = useState(() => toPersianDate(new Date()));
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.name || 'مصالح ساختمانی');
  const currentCategoryObj = categories.find((c) => c.name === selectedCategory) || categories[0];
  const [selectedSubCategory, setSelectedSubCategory] = useState(
    currentCategoryObj?.subcategories[0] || 'سیمان و گروت ساختمانی'
  );

  const [amount, setAmount] = useState<number>(0);
  const [vendor, setVendor] = useState('');
  const [vendorNationalId, setVendorNationalId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => toPersianDate(new Date()));
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'کارت تنخواه' | 'نقد' | 'حواله/انتقال' | 'سایر'>(
    'کارت تنخواه'
  );

  // Inventory Integration
  const [inventoryTarget, setInventoryTarget] = useState<'direct_consumption' | 'send_to_warehouse'>(
    'direct_consumption'
  );
  const [inventoryItemCode, setInventoryItemCode] = useState('');
  const [inventoryItemName, setInventoryItemName] = useState('');
  const [inventoryQuantity, setInventoryQuantity] = useState(1);
  const [inventoryUnit, setInventoryUnit] = useState('عدد');

  // Attachments State
  const [attachments, setAttachments] = useState<PettyCashAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<PettyCashAttachment | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const form: PettyExpenseFormInput = {
    accountId: targetAccount?.id || '',
    date,
    category: selectedCategory,
    subCategory: selectedSubCategory,
    amount,
    vendor,
    vendorNationalId,
    invoiceNumber,
    invoiceDate,
    description,
    paymentMethod,
    inventoryTarget,
    inventoryItemCode,
    inventoryItemName,
    inventoryQuantity,
    inventoryUnit,
    attachments,
  };
  // Over the usable balance, possible duplicate invoice (same vendor, number and amount), first problem.
  const check = useSelector((s) => checkPettyExpenseForm(s, accounts, form), [accounts, JSON.stringify(form)]);
  const isOverUsable = check.isOverUsable;
  const duplicateExpense = check.duplicate;

  const handleCategoryChange = (catName: string) => {
    setSelectedCategory(catName);
    const cat = categories.find((c) => c.name === catName);
    if (cat && cat.subcategories.length > 0) {
      setSelectedSubCategory(cat.subcategories[0]);
    }
  };

  const handleAddSimulatedFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachments((prev) => [...prev, attachmentFromFile(file)]);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (check.error) return setFormError(check.error);
    setFormError(null);
    // Number, approval level and first approver come from the stored policy in the workflow.
    const result = onSaveExpense(form);
    if (!result.ok) return setFormError(result.message);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
    <Dialog
      onClose={onClose}
      label="ثبت هزینه جدید از محل تنخواه‌گردان"
      overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      className="bg-white rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200"
    >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-amber-100 text-amber-900 px-2 py-1 rounded font-bold">
                فرم استاندارد هزینه کارگاهی
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-sm text-slate-600">چرخه ثبت، الصاق فاکتور و تایید چندمرحله‌ای</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              ثبت هزینه جدید از محل تنخواه‌گردان
            </h3>
          </div>

          <button
            onClick={onClose}
            aria-label="بستن"
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 font-bold rounded-lg flex items-center gap-2 animate-in fade-in duration-200 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
              <span>{formError}</span>
            </div>
          )}
          {/* Target Petty Cash Account Selector & Live Balance Display */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-expense-modal-1" className="block text-xs font-bold text-slate-700 mb-1">
                  انتخاب حساب تنخواه‌گردان پرداختی <span className="text-rose-700">*</span>
                </label>
                <select id="new-expense-modal-1"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white font-medium"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {formatText(acc.title)} ({acc.code}) - {formatText(acc.projectName)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-sm font-bold text-slate-700 mb-1">
                  پروژه و مرکز هزینه منظورشده
                </span>
                <div className="w-full text-sm px-3 py-2 bg-slate-200/70 border border-slate-300 rounded-lg text-slate-700 font-medium">
                  {formatText(targetAccount?.projectName)} ({targetAccount?.costCenterName})
                </div>
              </div>
            </div>

            {/* Live Balances Banner */}
            {targetAccount && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 text-sm">
                <div>
                  <span className="text-slate-500">موجودی واقعی: </span>
                  <span className=" font-bold text-slate-800 tabular-nums">
                    <Money rial={targetAccount.actualBalance} />
                  </span>
                </div>
                <div>
                  <span className="text-amber-700">در انتظار تأیید قبلی: </span>
                  <span className=" font-bold text-amber-700 tabular-nums">
                    <Money rial={targetAccount.pendingExpenses} />
                  </span>
                </div>
                <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="font-bold text-emerald-800">مانده قابل مصرف: </span>
                  <span className=" font-bold text-emerald-700 tabular-nums text-sm">
                    <Money rial={targetAccount.usableBalance} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="new-expense-modal-2" className="block text-xs font-bold text-slate-700 mb-1">
                مبلغ فاکتور / هزینه ({moneyUnitLabel()}) <span className="text-rose-700">*</span>
              </label>
              <MoneyInput id="new-expense-modal-2"
                required
                value={amount}
                onValueChange={(v) => setAmount(v)}
                placeholder={`مبلغ به ${moneyUnitLabel()}`}
                className={`w-full text-sm px-3 py-2 border rounded-lg focus:ring-2 font-bold tabular-nums ${
                  isOverUsable
                    ? 'border-rose-500 bg-rose-50 text-rose-800 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-amber-500'
                }`}
              />
              <span className="text-xs text-slate-500 mt-1 block">
                <Money rial={amount} />
              </span>
            </div>

            <div>
              <label htmlFor="new-expense-modal-3" className="block text-xs font-bold text-slate-700 mb-1">
                تاریخ هزینه <span className="text-rose-700">*</span>
              </label>
              <input id="new-expense-modal-3"
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="۱۴۰۳/۰۷/۰۲"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label htmlFor="new-expense-modal-4" className="block text-xs font-bold text-slate-700 mb-1">
                روش پرداخت از تنخواه <span className="text-rose-700">*</span>
              </label>
              <select id="new-expense-modal-4"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
              >
                <option value="کارت تنخواه">کارت بانکی تنخواه</option>
                <option value="نقد">پرداخت نقدی کارگاه</option>
                <option value="حواله/انتقال">انتقال کارت به کارت کارپرداز</option>
                <option value="سایر">سایر روش‌ها</option>
              </select>
            </div>
          </div>

          {/* Validation Warnings (Over-budget or Duplicate) */}
          {isOverUsable && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-center gap-2 text-sm text-rose-800">
              <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0" />
              <div>
                <strong>کسری موجودی قابل مصرف:</strong> مبلغ وارد شده ({formatCurrency(amount)}) از
                مانده قابل مصرف این تنخواه ({formatCurrency(targetAccount?.usableBalance || 0)}) بیشتر
                است. لطفاً مبلغ را اصلاح یا ابتدا تنخواه را شارژ نمایید.
              </div>
            </div>
          )}

          {duplicateExpense && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <strong>هشدار احتمال فاکتور تکراری:</strong> فاکتوری با همین فروشنده ({vendor})، همین شماره ({invoiceNumber}) و مبلغ در سیستم قبلاً با کد {formatText(duplicateExpense.expenseNumber)} ثبت شده است.
              </div>
            </div>
          )}

          {/* Category & Subcategory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-expense-modal-5" className="block text-xs font-bold text-slate-700 mb-1">
                دسته‌بندی اصلی هزینه <span className="text-rose-700">*</span>
              </label>
              <select id="new-expense-modal-5"
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white font-medium"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {formatText(c.name)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-expense-modal-6" className="block text-xs font-bold text-slate-700 mb-1">
                زیردسته تفکیکی <span className="text-rose-700">*</span>
              </label>
              <select id="new-expense-modal-6"
                value={selectedSubCategory}
                onChange={(e) => setSelectedSubCategory(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
              >
                {currentCategoryObj.subcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vendor & Invoice Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="new-expense-modal-7" className="block text-xs font-bold text-slate-700 mb-1">
                فروشنده / طرف‌حساب <span className="text-rose-700">*</span>
              </label>
              <input id="new-expense-modal-7"
                type="text"
                required
                placeholder="نام فروشگاه، راننده، یا شخص"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label htmlFor="new-expense-modal-8" className="block text-xs font-bold text-slate-700 mb-1">
                شماره فاکتور / رسید <span className="text-rose-700">*</span>
              </label>
              <input id="new-expense-modal-8"
                type="text"
                required
                placeholder="INV-..."
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label htmlFor="new-expense-modal-9" className="block text-xs font-bold text-slate-700 mb-1">
                تاریخ صدور فاکتور
              </label>
              <input id="new-expense-modal-9"
                type="text"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="new-expense-modal-10" className="block text-xs font-bold text-slate-700 mb-1">
              شرح دقیق هزینه و محل مصرف <span className="text-rose-700">*</span>
            </label>
            <textarea id="new-expense-modal-10"
              rows={2}
              required
              placeholder="شرح دقیق اقلام خریداری شده و دلیل خرید اضطراری از محل تنخواه..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Inventory Integration (بخش ۲۰: ارتباط با انبار) */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-600" />
                نحوه تخصیص و ورود کالا (ارتباط با ماژول انبارداری):
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label
                className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  inventoryTarget === 'direct_consumption'
                    ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="inventoryTarget"
                  checked={inventoryTarget === 'direct_consumption'}
                  onChange={() => setInventoryTarget('direct_consumption')}
                  className="mt-1 text-amber-700"
                />
                <div>
                  <div>مصرف مستقیم در کارگاه</div>
                  <div className="text-xs font-normal text-slate-500 mt-1">
                    مستقیماً در پروژه مصرف شده و نیازی به ورود به انبار ندارد (مثل سوخت یا بتن)
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  inventoryTarget === 'send_to_warehouse'
                    ? 'bg-blue-50 border-blue-400 text-blue-950 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="inventoryTarget"
                  checked={inventoryTarget === 'send_to_warehouse'}
                  onChange={() => setInventoryTarget('send_to_warehouse')}
                  className="mt-1 text-blue-700"
                />
                <div>
                  <div>تحویل به انبار کارگاه (صدور رسید انبار)</div>
                  <div className="text-xs font-normal text-slate-500 mt-1">
                    اقلام دوام‌دار یا مصالح انبارشدنی (ابزارآلات، تجهیزات ایمنی، اتصالات)
                  </div>
                </div>
              </label>
            </div>

            {/* If send to warehouse, show warehouse item detail fields */}
            {inventoryTarget === 'send_to_warehouse' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                <div>
                  <label htmlFor="new-expense-modal-11" className="block text-xs font-medium text-slate-600 mb-1">
                    کد کالا در انبار
                  </label>
                  <input id="new-expense-modal-11"
                    type="text"
                    placeholder="TOOL-..."
                    value={inventoryItemCode}
                    onChange={(e) => setInventoryItemCode(e.target.value)}
                    className="w-full text-xs px-2 py-2 border border-slate-300 rounded tabular-nums"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="new-expense-modal-12" className="block text-xs font-medium text-slate-600 mb-1">
                    نام قلم در انبار
                  </label>
                  <input id="new-expense-modal-12"
                    type="text"
                    placeholder="عنوان دقیق کالا"
                    value={inventoryItemName}
                    onChange={(e) => setInventoryItemName(e.target.value)}
                    className="w-full text-xs px-2 py-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label htmlFor="new-expense-modal-13" className="block text-xs font-medium text-slate-600 mb-1">
                    مقدار / تعداد
                  </label>
                  <IntegerInput id="new-expense-modal-13"
                    value={inventoryQuantity}
                    onValueChange={(v) => setInventoryQuantity(v)}
                    className="w-full text-xs px-2 py-2 border border-slate-300 rounded tabular-nums"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Invoice Upload & Attachments (بخش ۲۵ پرامپت: آپلود فاکتور، Drag & Drop، پیش‌نمایش و زوم) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="new-expense-modal-14" className="block text-xs font-bold text-slate-700">
                پیوست تصویر فاکتور یا رسید رسمی <span className="text-rose-700">*</span>
              </label>
              <span className="text-xs text-slate-500">
                فرمت‌های مجاز: JPG, PNG, PDF (حداکثر ۱۰ مگابایت)
              </span>
            </div>

            {/* Drag & drop upload area */}
            <div className="border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-xl p-4 text-center transition-colors bg-slate-50/60 relative">
              <input id="new-expense-modal-14"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleAddSimulatedFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 bg-white rounded-full border border-slate-200 text-slate-600 shadow-2xs">
                  <Upload className="w-5 h-5 text-amber-700" />
                </div>
                <div className="text-sm font-medium text-slate-800">
                  فایل فاکتور را اینجا بکشید یا برای انتخاب کلیک کنید
                </div>
                <div className="text-xs text-slate-500">
                  جهت تسریع تایید فاکتور توسط حسابدار، تصویر باکیفیت و خوانا ضمیمه شود.
                </div>
              </div>
            </div>

            {/* List of Attachments with Thumbnail & Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate font-medium text-slate-800">{formatText(att.name)}</span>
                    <span className="text-xs text-slate-500 shrink-0 tabular-nums">({att.size})</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {att.url && (
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment(att)}
                        title="پیش‌نمایش تصویر فاکتور"
                        className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      title="حذف پیوست"
                      className="p-1 text-rose-700 hover:text-rose-700 hover:bg-rose-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Submit Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              ثبت‌کننده سند:{' '}
              <span className="font-medium text-slate-800">{formatText(currentUser.name)}</span> ({currentUser.role})
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isOverUsable}
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors shadow-xs ${
                  isOverUsable
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                }`}
              >
                ثبت و ارجاع جهت تأیید
              </button>
            </div>
          </div>
        </form>
    </Dialog>

      {/* Invoice Zoom/Preview Modal */}
      {previewAttachment && (
        <Dialog
          onClose={() => setPreviewAttachment(null)}
          label={previewAttachment.name}
          overlayClassName="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
          className="bg-white rounded-xl max-w-2xl w-full p-4 space-y-3"
        >
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-bold text-slate-900">{formatText(previewAttachment.name)}</span>
              <button
                onClick={() => setPreviewAttachment(null)}
                aria-label="بستن"
                className="text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-100 rounded-lg p-2">
              {previewAttachment.url && (
                <img
                  src={previewAttachment.url}
                  alt="پیش‌نمایش فاکتور"
                  className="max-h-[60vh] object-contain rounded shadow"
                />
              )}
            </div>
        </Dialog>
      )}
    </>
  );
};
