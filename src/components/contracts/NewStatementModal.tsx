/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Contract, StatementBOQItem, StatementType, UserProfile } from '../../types';
import {
  X,
  Plus,
  AlertTriangle,
  Building,
  Calendar,
  CheckCircle2,
  Layers,
  FileSpreadsheet,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';
import { Dialog } from '../../ui/Dialog';
import { formatMoney, moneyUnitLabel, formatInt } from '../../utils/money';
import { IntegerInput, MoneyInput, PercentInput } from '../../ui/NumberInput';
import { toPersianDigits, formatText } from '../../utils/formatters';
import { useSelector } from '../../store/AppStore';
import { clientStatementFormDefaults, computeClientStatementDraft, type ClientStatementFormInput } from '../../store/views/contracts';
import { Money } from '../common/Money';

interface NewStatementModalProps {
  contracts: Contract[];
  preselectedContract?: Contract | null;
  currentUser: UserProfile;
  onClose: () => void;
  /** Saves through the workflow, which recomputes every amount from these inputs. */
  onSaveStatement: (form: ClientStatementFormInput, target: 'draft' | 'submitted_to_consultant') => { ok: boolean; message: string };
}

export const NewStatementModal: React.FC<NewStatementModalProps> = ({
  contracts,
  preselectedContract,
  currentUser,
  onClose,
  onSaveStatement,
}) => {
  const initialContractId = preselectedContract?.id || contracts[0]?.id || '';
  const defaults = useSelector((s) => clientStatementFormDefaults(s, initialContractId), [initialContractId]);
  const [selectedContractId, setSelectedContractId] = useState<string>(initialContractId);

  // Form metadata (the number follows the statements already issued on this contract)
  const [statementNumber, setStatementNumber] = useState(defaults.statementNumber);
  const [statementType, setStatementType] = useState<StatementType>(defaults.statementType);
  const [periodStartDate, setPeriodStartDate] = useState(defaults.periodStartDate);
  const [periodEndDate, setPeriodEndDate] = useState(defaults.periodEndDate);
  const [preparationDate, setPreparationDate] = useState(defaults.preparationDate);
  const preparerName = currentUser.name;
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Quantities of this period start at zero; nothing is pre-filled.
  const [currentQuantities, setCurrentQuantities] = useState<Record<string, number>>({});
  const [overrunClassifications, setOverrunClassifications] = useState<Record<string, StatementBOQItem['exceededClassification']>>({});

  // Additional allowances & adjustments (Rials)
  const [otherAllowables, setOtherAllowables] = useState<number>(0);
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [includeVAT, setIncludeVAT] = useState<boolean>(defaults.includeVAT);

  // Deductions (percentages are whole numbers)
  const [advanceRate, setAdvanceRate] = useState<number>(defaults.advanceRate);
  const [retentionRate, setRetentionRate] = useState<number>(defaults.retentionRate);
  const [insuranceRate, setInsuranceRate] = useState<number>(defaults.insuranceRate);
  const [withholdingTaxRate, setWithholdingTaxRate] = useState<number>(defaults.withholdingTaxRate);
  const [materialDeduction, setMaterialDeduction] = useState<number>(0);

  const form: ClientStatementFormInput = {
    contractId: selectedContractId,
    statementNumber,
    statementType,
    periodStartDate,
    periodEndDate,
    preparationDate,
    description,
    quantities: currentQuantities,
    overrunClassifications,
    otherAllowables,
    adjustmentAmount,
    includeVAT,
    advanceRate,
    retentionRate,
    insuranceRate,
    withholdingTaxRate,
    materialDeduction,
  };
  // Live preview; the workflow recomputes the same numbers on save.
  const draft = useSelector((s) => computeClientStatementDraft(s, form), [JSON.stringify(form)]);
  const selectedContract = draft.contract;

  const handleSubmit = (targetStatus: 'draft' | 'submitted_to_consultant') => {
    if (draft.error) return setFormError(draft.error);
    const result = onSaveStatement(form, targetStatus);
    if (!result.ok) return setFormError(result.message);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="فرم تهیه و صدور صورت‌وضعیت پیمانکاری" overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
      
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">فرم تهیه و صدور صورت‌وضعیت پیمانکاری</h2>
              <p className="text-xs text-slate-500 mt-1">
                اتصال مستقیم به فهرست‌بهای پیمان، کنترل خودکار مقادیر و موتور محاسبه کسورات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Section 1: Contract & Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-sm">
            <div>
              <label htmlFor="new-statement-modal-1" className="block text-slate-600 font-bold mb-1">انتخاب پیمان / قرارداد:</label>
              <select id="new-statement-modal-1"
                value={selectedContractId}
                onChange={(e) => setSelectedContractId(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium focus:outline-amber-500"
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatText(c.code)} · {c.projectTitle.slice(0, 35)}...
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-statement-modal-2" className="block text-slate-600 font-bold mb-1">شماره صورت‌وضعیت:</label>
              <input id="new-statement-modal-2"
                type="text"
                value={statementNumber}
                onChange={(e) => setStatementNumber(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
              />
            </div>

            <div>
              <label htmlFor="new-statement-modal-3" className="block text-slate-600 font-bold mb-1">نوع صورت‌وضعیت:</label>
              <select id="new-statement-modal-3"
                value={statementType}
                onChange={(e) => setStatementType(e.target.value as StatementType)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
              >
                <option value="موقت">موقت</option>
                <option value="قطعی">قطعی</option>
                <option value="علی‌الحساب">علی‌الحساب</option>
                <option value="تعدیل">تعدیل آحادبها</option>
                <option value="مابه‌التفاوت مصالح">مابه‌التفاوت مصالح</option>
              </select>
            </div>

            <div>
              <span className="block text-slate-600 font-bold mb-1">تهیه‌کننده:</span>
              <span className="block p-2 rounded-lg bg-slate-200/60 font-medium">{preparerName}</span>
            </div>

            <div>
              <label htmlFor="new-statement-modal-4" className="block text-slate-600 font-bold mb-1">از تاریخ دوره کارکرد:</label>
              <input id="new-statement-modal-4"
                type="text"
                value={periodStartDate}
                onChange={(e) => setPeriodStartDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="new-statement-modal-5" className="block text-slate-600 font-bold mb-1">تا تاریخ دوره کارکرد:</label>
              <input id="new-statement-modal-5"
                type="text"
                value={periodEndDate}
                onChange={(e) => setPeriodEndDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="new-statement-modal-6" className="block text-slate-600 font-bold mb-1">تاریخ تنظیم سند:</label>
              <input id="new-statement-modal-6"
                type="text"
                value={preparationDate}
                onChange={(e) => setPreparationDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white tabular-nums"
              />
            </div>

            <div>
              <span className="block text-slate-600 font-bold mb-1">دستگاه اجرایی / مشاور:</span>
              <span className="block p-2 text-slate-700 bg-slate-200/60 rounded-lg truncate">
                {formatText(selectedContract?.employer)} · {formatText(selectedContract?.consultant)}
              </span>
            </div>
          </div>

          <label className="block text-xs text-slate-600 font-bold">
            شرح عملیات دوره:
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
            />
          </label>

          {/* Section 2: Interactive BOQ Item Quantities with Overrun Warning */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  اقلام کارکرد این دوره و کنترل احجام (Previous + Current = Cumulative):
                </h3>
                <p className="text-xs text-slate-500">
                  مقدار اجرا شده در این دوره را وارد فرمایید؛ مبالغ و تطابق با سقف قرارداد به صورت خودکار محاسبه می‌شود.
                </p>
              </div>

              {draft.hasAnyExceeded && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-rose-100 text-rose-900 text-sm font-bold border border-rose-300 animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-rose-700" />
                  <span>هشدار: عبور مقدار اجرا از سقف پیمان</span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 table-scroll">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2">ردیف</th>
                    <th className="p-2">کد</th>
                    <th className="p-2">شرح عملیات</th>
                    <th className="p-2 text-center">واحد</th>
                    <th className="p-2 text-left">سقف پیمان</th>
                    <th className="p-2 text-left">کارکرد قبلی</th>
                    <th className="p-2 text-center w-28">مقدار این دوره</th>
                    <th className="p-2 text-left">کارکرد تجمعی</th>
                    <th className="p-2 text-left">نرخ واحد</th>
                    <th className="p-2 text-left">مبلغ دوره ({moneyUnitLabel()})</th>
                    <th className="p-2 text-center">وضعیت مازاد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {draft.items.map((item) => (
                    <tr
                      key={item.boqItemId}
                      className={`hover:bg-slate-50/80 ${item.isExceeded ? 'bg-rose-50/40' : ''}`}
                    >
                      <td className="p-2 tabular-nums text-slate-500">{formatText(item.rowNumber)}</td>
                      <td className="p-2 tabular-nums font-bold text-blue-700">{formatText(item.code)}</td>
                      <td className="p-2 max-w-xs font-medium text-slate-900">{formatText(item.description)}</td>
                      <td className="p-2 text-center font-bold text-slate-600">{formatText(item.unit)}</td>
                      <td className="p-2 text-left tabular-nums">{formatInt(item.contractQuantity)}</td>
                      <td className="p-2 text-left tabular-nums">{formatInt(item.previousQuantity)}</td>
                      <td className="p-2 text-center">
                        <IntegerInput
                          aria-label={`مقدار این دوره ${item.code}`}
                          value={currentQuantities[item.boqItemId] || 0}
                          onValueChange={(v) => setCurrentQuantities((prev) => ({ ...prev, [item.boqItemId]: v }))}
                          className="w-24 p-2 rounded-lg border border-slate-300 text-center tabular-nums font-bold bg-white focus:outline-amber-500"
                        />
                      </td>
                      <td className="p-2 text-left tabular-nums font-bold">
                        <span className={item.isExceeded ? 'text-rose-700 font-bold' : 'text-indigo-900'}>
                          {formatInt(item.cumulativeQuantity)}
                        </span>
                      </td>
                      <td className="p-2 text-left tabular-nums text-slate-600">{formatMoney(item.unitRate, false)}</td>
                      <td className="p-2 text-left tabular-nums font-bold text-slate-900">
                        {formatMoney(item.currentAmount, false)}
                      </td>
                      <td className="p-2 text-center">
                        {item.isExceeded ? (
                          <div className="space-y-1">
                            <span className="px-2 py-1 rounded text-xs font-bold bg-rose-200 text-rose-900 block">
                              +{formatInt(item.exceededQuantity)} مازاد
                            </span>
                            <select aria-label="نوع تعدیل"
                              value={overrunClassifications[item.boqItemId] || 'تغییر مقادیر'}
                              onChange={(e) =>
                                setOverrunClassifications((prev) => ({
                                  ...prev,
                                  [item.boqItemId]: e.target.value as StatementBOQItem['exceededClassification'],
                                }))
                              }
                              className="text-sm p-1 rounded border border-rose-300 bg-white"
                            >
                              <option value="تغییر مقادیر">تغییر مقادیر ۲۵٪</option>
                              <option value="مقدار مازاد">مقدار مازاد</option>
                              <option value="آیتم جدید (ستاره‌دار)">آیتم جدید ستاره‌دار</option>
                              <option value="الحاقیه">الحاقیه جدید</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-emerald-700 text-sm font-medium">مجاز در پیمان</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Additional Items, Adjustments, VAT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
            <div>
              <label htmlFor="new-statement-modal-7" className="block text-slate-700 font-bold mb-1">سایر اقلام مجاز / تجهیز کارگاه و مصالح پای‌کار:</label>
              <MoneyInput id="new-statement-modal-7" value={otherAllowables} onValueChange={setOtherAllowables} showUnit className="w-full p-2 rounded-lg border border-slate-300 bg-white tabular-nums" />
              <span className="text-xs text-slate-500 mt-1 block">
                <Money rial={otherAllowables} />
              </span>
            </div>

            <div>
              <label htmlFor="new-statement-modal-8" className="block text-slate-700 font-bold mb-1">مبلغ تعدیل آحادبها این دوره:</label>
              <MoneyInput id="new-statement-modal-8" value={adjustmentAmount} onValueChange={setAdjustmentAmount} showUnit className="w-full p-2 rounded-lg border border-slate-300 bg-white tabular-nums" />
              <span className="text-xs text-slate-500 mt-1 block">
                <Money rial={adjustmentAmount} />
              </span>
            </div>

            <div>
              <span className="block text-slate-700 font-bold mb-1">مالیات بر ارزش افزوده ({toPersianDigits(draft.vatRate)}٪ طبق تنظیمات):</span>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="vat-check"
                  checked={includeVAT}
                  onChange={(e) => setIncludeVAT(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-700"
                />
                <label htmlFor="vat-check" className="text-slate-800 font-medium">
                  اعمال ارزش افزوده (+{toPersianDigits(draft.vatRate)}٪ روی مبلغ پیش از مالیات)
                </label>
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                مبلغ محاسبه‌شده: {formatMoney(draft.vatAmount)}
              </span>
            </div>
          </div>

          {/* Section 4: Deduction Engine Rules */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-rose-700" />
              موتور محاسبات کسورات قانونی (مبنا: مبلغ پیش از ارزش افزوده <Money rial={draft.baseBeforeVat} />)
            </h4>
            <p className="text-sm text-slate-600">
              مانده پیش‌پرداخت قابل استهلاک این قرارداد: <strong className="tabular-nums"><Money rial={draft.remainingAdvance} /></strong>
              {draft.advanceCapped && <span className="text-amber-700 font-bold"> — استهلاک به همین مانده محدود شد.</span>}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="new-statement-modal-9" className="block text-slate-600 mb-1">درصد استرداد پیش‌پرداخت:</label>
                <div className="flex items-center gap-1">
                  <PercentInput id="new-statement-modal-9"
                    value={advanceRate}
                    onValueChange={setAdvanceRate}
                    className="w-20 p-2 rounded border border-slate-300 bg-white text-center font-bold"
                  />
                  <span>٪</span>
                </div>
              </div>

              <div>
                <label htmlFor="new-statement-modal-10" className="block text-slate-600 mb-1">درصد سپرده حسن انجام کار:</label>
                <div className="flex items-center gap-1">
                  <PercentInput id="new-statement-modal-10"
                    value={retentionRate}
                    onValueChange={setRetentionRate}
                    className="w-20 p-2 rounded border border-slate-300 bg-white text-center font-bold"
                  />
                  <span>٪</span>
                </div>
              </div>

              <div>
                <label htmlFor="new-statement-modal-11" className="block text-slate-600 mb-1">درصد بیمه تأمین اجتماعی (ماده ۳۸):</label>
                <div className="flex items-center gap-1">
                  <PercentInput id="new-statement-modal-11"
                    value={insuranceRate}
                    onValueChange={setInsuranceRate}
                    className="w-20 p-2 rounded border border-slate-300 bg-white text-center font-bold"
                  />
                  <span>٪</span>
                </div>
              </div>

              <div>
                <label htmlFor="new-statement-modal-12" className="block text-slate-600 mb-1">درصد مالیات تکلیفی (کسر کارفرما):</label>
                <div className="flex items-center gap-1">
                  <PercentInput id="new-statement-modal-12"
                    value={withholdingTaxRate}
                    onValueChange={setWithholdingTaxRate}
                    className="w-20 p-2 rounded border border-slate-300 bg-white text-center font-bold"
                  />
                  <span>٪</span>
                </div>
              </div>

              <div>
                <label htmlFor="new-statement-modal-13" className="block text-slate-600 mb-1">کسورات مصالح کارفرما (مقطوع):</label>
                <MoneyInput id="new-statement-modal-13" value={materialDeduction} onValueChange={setMaterialDeduction} showUnit className="w-full p-2 rounded border border-slate-300 bg-white tabular-nums" />
              </div>
            </div>
          </div>

          {formError && (
            <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 font-bold" role="alert">
              {formError}
            </p>
          )}

          {/* Section 5: Final Calculated Totals Banner */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="grid grid-cols-3 gap-6 text-center sm:text-right">
              <div>
                <span className="text-xs text-slate-500 block">کارکرد ناخالص:</span>
                <span className="text-base font-bold text-amber-400 tabular-nums">
                  <Money rial={draft.grossAmount} />
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">مجموع کسورات:</span>
                <span className="text-base font-bold text-rose-400 tabular-nums">
                  -<Money rial={draft.totalDeductions} />
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">مبلغ خالص قابل پرداخت:</span>
                <span className="text-lg font-bold text-emerald-400 tabular-nums">
                  <Money rial={draft.netPayable} />
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSubmit('draft')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm border border-slate-700 cursor-pointer"
              >
                ذخیره به عنوان پیش‌نویس
              </button>
              <button
                onClick={() => handleSubmit('submitted_to_consultant')}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md cursor-pointer"
              >
                تکمیل و ارسال به مهندس مشاور
              </button>
            </div>
          </div>
        </div>
      </Dialog>
  );
};
