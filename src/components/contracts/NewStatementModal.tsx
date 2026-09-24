/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Contract,
  ContractBOQItem,
  DetailedProgressStatement,
  StatementBOQItem,
  DeductionItem,
  StatementType,
  UserProfile,
} from '../../types';
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
import { Dialog } from '../common/Dialog';
import { formatMoney, moneyUnitLabel, formatInt, roundRial } from '../../utils/money';
import { IntegerInput, MoneyInput } from '../common/NumberInput';
import { generateUUID } from '../../utils/ids';
import { toPersianDate, toPersianTime, getRelativePersianDate } from '../../utils/date';
import { toPersianDigits } from '../../utils/formatters';
import { useAppState } from '../../store/AppStore';

interface NewStatementModalProps {
  contracts: Contract[];
  allBOQItems: ContractBOQItem[];
  preselectedContract?: Contract | null;
  currentUser: UserProfile;
  onClose: () => void;
  onSaveStatement: (statement: DetailedProgressStatement) => { ok: boolean; message: string };
}

export const NewStatementModal: React.FC<NewStatementModalProps> = ({
  contracts,
  allBOQItems,
  preselectedContract,
  currentUser,
  onClose,
  onSaveStatement,
}) => {
  const [selectedContractId, setSelectedContractId] = useState<string>(
    preselectedContract?.id || contracts[0]?.id || ''
  );

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === selectedContractId) || contracts[0],
    [contracts, selectedContractId]
  );

  const contractBOQ = useMemo(
    () => allBOQItems.filter((b) => b.contractId === selectedContract?.id),
    [allBOQItems, selectedContract]
  );

  const store = useAppState();
  const vatRate = store.financeSettings.vatRatePercent;
  const contractStatements = store.clientStatements.filter((st) => st.contractId === selectedContract?.id);
  // Advance still to be recovered: advances paid on the contract minus advance deductions already
  // taken in its statements (rejected or returned statements do not count).
  const remainingAdvance = useMemo(() => {
    if (!selectedContract) return 0;
    const paid = store.advancePayments.filter((a) => a.contractId === selectedContract.id).reduce((a, r) => a + r.totalAdvanceAmount, 0);
    const recovered = contractStatements
      .filter((st) => st.status !== 'rejected' && st.status !== 'returned_for_correction')
      .flatMap((st) => st.deductions)
      .filter((d) => d.type === 'advance_payment')
      .reduce((a, d) => a + d.calculatedAmount, 0);
    return Math.max(0, paid - recovered);
  }, [store.advancePayments, contractStatements, selectedContract]);

  // Form metadata (the number follows the statements already issued on this contract)
  const [statementNumber, setStatementNumber] = useState(() => `صورت‌وضعیت موقت شماره ${toPersianDigits(contractStatements.length + 1)}`);
  const [statementType, setStatementType] = useState<StatementType>('موقت');
  const [periodStartDate, setPeriodStartDate] = useState(() => getRelativePersianDate(-30));
  const [periodEndDate, setPeriodEndDate] = useState(() => getRelativePersianDate(0));
  const [preparationDate, setPreparationDate] = useState(() => getRelativePersianDate(0));
  const preparerName = currentUser.name;
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Quantities of this period start at zero; nothing is pre-filled.
  const [currentQuantities, setCurrentQuantities] = useState<Record<string, number>>({});

  // Overrun classifications
  const [overrunClassifications, setOverrunClassifications] = useState<Record<string, StatementBOQItem['exceededClassification']>>({});

  // Additional allowances & Adjustments (Rials)
  const [otherAllowables, setOtherAllowables] = useState<number>(0);
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [includeVAT, setIncludeVAT] = useState<boolean>(true);

  // Deductions (percentages are whole numbers)
  const [advanceRate, setAdvanceRate] = useState<number>(selectedContract?.advancePaymentPercentage || 0);
  const [retentionRate, setRetentionRate] = useState<number>(selectedContract?.retentionPercentage || 0);
  const [insuranceRate, setInsuranceRate] = useState<number>(5);
  const [materialDeduction, setMaterialDeduction] = useState<number>(0);

  // Calculations (ids are assigned only when the statement is saved)
  const calculatedItems: Omit<StatementBOQItem, 'id'>[] = useMemo(() => {
    return contractBOQ.map((b) => {
      const currentQty = currentQuantities[b.id] || 0;
      const prevQty = b.cumulativeExecutedQuantity;
      const cumulativeQty = prevQty + currentQty;
      const isExceeded = cumulativeQty > b.initialQuantity;
      const exceededQty = isExceeded ? cumulativeQty - b.initialQuantity : 0;
      const currentAmount = roundRial(currentQty * b.unitRate);
      const cumulativeAmount = roundRial(cumulativeQty * b.unitRate);

      return {
        boqItemId: b.id,
        rowNumber: b.rowNumber,
        code: b.code,
        description: b.description,
        unit: b.unit,
        contractQuantity: b.initialQuantity,
        previousQuantity: prevQty,
        currentQuantity: currentQty,
        cumulativeQuantity: cumulativeQty,
        unitRate: b.unitRate,
        currentAmount,
        cumulativeAmount,
        isExceeded,
        exceededQuantity: exceededQty,
        exceededClassification: isExceeded ? overrunClassifications[b.id] || 'تغییر مقادیر' : undefined,
        inventoryMaterialCode: b.inventoryMaterialCode,
      };
    });
  }, [contractBOQ, currentQuantities, overrunClassifications]);

  const workAmountCurrent = useMemo(() => {
    return calculatedItems.reduce((sum, item) => sum + item.currentAmount, 0);
  }, [calculatedItems]);

  // Deductions are computed on the work amount before VAT (VAT is paid in full by the employer).
  const baseBeforeVat = workAmountCurrent + otherAllowables + adjustmentAmount;

  const vatAmount = useMemo(() => (includeVAT ? roundRial((baseBeforeVat * vatRate) / 100) : 0), [includeVAT, baseBeforeVat, vatRate]);

  const grossAmount = baseBeforeVat + vatAmount;

  const advanceByRate = roundRial((baseBeforeVat * advanceRate) / 100);
  const advanceCapped = advanceByRate > remainingAdvance;

  const deductionsList: DeductionItem[] = useMemo(() => {
    // Advance recovery never exceeds what is still unrecovered on the contract.
    const adv = Math.min(roundRial((baseBeforeVat * advanceRate) / 100), remainingAdvance);
    const ret = roundRial((baseBeforeVat * retentionRate) / 100);
    const ins = roundRial((baseBeforeVat * insuranceRate) / 100);

    return [
      {
        id: 'ded-adv',
        title: `استرداد پیش‌پرداخت (${advanceRate}٪)`,
        type: 'advance_payment',
        mode: 'percentage',
        rate: advanceRate,
        baseAmount: baseBeforeVat,
        calculatedAmount: adv,
      },
      {
        id: 'ded-ret',
        title: `سپرده حسن انجام کار (${retentionRate}٪)`,
        type: 'retention',
        mode: 'percentage',
        rate: retentionRate,
        baseAmount: baseBeforeVat,
        calculatedAmount: ret,
      },
      {
        id: 'ded-ins',
        title: `حق بیمه تأمین اجتماعی (${insuranceRate}٪)`,
        type: 'insurance',
        mode: 'percentage',
        rate: insuranceRate,
        baseAmount: baseBeforeVat,
        calculatedAmount: ins,
      },
      {
        id: 'ded-mat',
        title: 'کسورات مصالح و آب و برق کارگاهی کارفرما',
        type: 'materials',
        mode: 'fixed',
        rate: 0,
        baseAmount: baseBeforeVat,
        calculatedAmount: materialDeduction,
      },
    ].filter((d) => d.calculatedAmount > 0) as DeductionItem[];
  }, [baseBeforeVat, advanceRate, retentionRate, insuranceRate, materialDeduction, remainingAdvance]);

  const totalDeductions = useMemo(() => {
    return deductionsList.reduce((sum, d) => sum + d.calculatedAmount, 0);
  }, [deductionsList]);

  const netPayable = useMemo(() => {
    return Math.max(0, grossAmount - totalDeductions);
  }, [grossAmount, totalDeductions]);

  const hasAnyExceeded = calculatedItems.some((i) => i.isExceeded);

  const handleSubmit = (targetStatus: 'draft' | 'submitted_to_consultant') => {
    if (!selectedContract) return setFormError('قرارداد را انتخاب کنید.');
    if (!selectedContract.costCenterId || !selectedContract.counterpartyId) {
      return setFormError('مرکز هزینه یا کارفرمای این قرارداد تعریف نشده است؛ ابتدا قرارداد را تکمیل کنید.');
    }
    if (baseBeforeVat <= 0) return setFormError('کارکرد این دوره صفر است؛ مقدار حداقل یک ردیف را وارد کنید.');
    if ([advanceRate, retentionRate, insuranceRate].some((r) => r > 100)) return setFormError('درصد کسورات نمی‌تواند بیش از ۱۰۰ باشد.');
    if (totalDeductions > grossAmount) return setFormError('جمع کسورات از مبلغ ناخالص بیشتر است.');

    const now = new Date();
    const newStatement: DetailedProgressStatement = {
      id: generateUUID(),
      statementNumber,
      contractId: selectedContract.id,
      contractCode: selectedContract.code,
      contractNumber: selectedContract.number,
      projectId: selectedContract.projectId,
      projectName: selectedContract.projectName,
      costCenterId: selectedContract.costCenterId,
      counterpartyId: selectedContract.counterpartyId,
      client: selectedContract.employer,
      consultant: selectedContract.consultant || 'مهندسین مشاور پروژه',
      type: statementType,
      periodStartDate,
      periodEndDate,
      preparationDate,
      preparerName,
      description,
      status: targetStatus,
      items: calculatedItems.filter((i) => i.currentQuantity > 0).map((i) => ({ ...i, id: generateUUID() })),
      workAmountCurrent,
      otherAllowableItemsAmount: otherAllowables,
      adjustmentAmount,
      vatAmount,
      grossAmount,
      deductions: deductionsList,
      totalDeductions,
      netPayable,
      approvedNetPayable: 0,
      receivedAmount: 0,
      remainingPayable: netPayable,
      dueDate: getRelativePersianDate(30),
      paymentStatus: 'Unpaid',
      overdueDays: 0,
      workflowHistory: [
        {
          date: toPersianDate(now),
          time: toPersianTime(now),
          user: currentUser.name,
          role: currentUser.role,
          fromStatus: 'draft',
          toStatus: targetStatus,
          action: targetStatus === 'draft' ? 'ایجاد پیش‌نویس صورت‌وضعیت کارگاه' : 'ارسال مستقیم به مهندس مشاور',
        },
      ],
    };

    const result = onSaveStatement(newStatement);
    if (!result.ok) return setFormError(result.message);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="فرم تهیه و صدور صورت‌وضعیت پیمانکاری" overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
      
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">فرم تهیه و صدور صورت‌وضعیت پیمانکاری</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                اتصال مستقیم به فهرست‌بهای پیمان (BOQ)، کنترل خودکار مقادیر و موتور محاسبه کسورات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Section 1: Contract & Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
            <div>
              <label className="block text-slate-600 font-bold mb-1">انتخاب پیمان / قرارداد:</label>
              <select
                value={selectedContractId}
                onChange={(e) => setSelectedContractId(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium focus:outline-amber-500"
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.projectTitle.slice(0, 35)}...
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">شماره صورت‌وضعیت:</label>
              <input
                type="text"
                value={statementNumber}
                onChange={(e) => setStatementNumber(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">نوع صورت‌وضعیت:</label>
              <select
                value={statementType}
                onChange={(e) => setStatementType(e.target.value as StatementType)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
              >
                <option value="موقت">موقت</option>
                <option value="قطعی">قطعی (Final Statement)</option>
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
              <label className="block text-slate-600 font-bold mb-1">از تاریخ دوره کارکرد:</label>
              <input
                type="text"
                value={periodStartDate}
                onChange={(e) => setPeriodStartDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">تا تاریخ دوره کارکرد:</label>
              <input
                type="text"
                value={periodEndDate}
                onChange={(e) => setPeriodEndDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">تاریخ تنظیم سند:</label>
              <input
                type="text"
                value={preparationDate}
                onChange={(e) => setPreparationDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">دستگاه اجرایی / مشاور:</label>
              <span className="block p-2 text-slate-700 bg-slate-200/60 rounded-lg truncate">
                {selectedContract?.employer} · {selectedContract?.consultant}
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
                <h3 className="text-xs font-bold text-slate-900">
                  اقلام کارکرد این دوره و کنترل احجام (Previous + Current = Cumulative):
                </h3>
                <p className="text-[11px] text-slate-500">
                  مقدار اجرا شده در این دوره را وارد فرمایید؛ مبالغ و تطابق با سقف قرارداد به صورت خودکار محاسبه می‌شود.
                </p>
              </div>

              {hasAnyExceeded && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-100 text-rose-900 text-xs font-bold border border-rose-300 animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>هشدار: عبور مقدار اجرا از سقف پیمان (Quantity exceeds Contract BOQ)</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">ردیف</th>
                    <th className="p-2.5">کد</th>
                    <th className="p-2.5">شرح عملیات</th>
                    <th className="p-2.5 text-center">واحد</th>
                    <th className="p-2.5 text-left">سقف پیمان</th>
                    <th className="p-2.5 text-left">کارکرد قبلی</th>
                    <th className="p-2.5 text-center w-28">مقدار این دوره</th>
                    <th className="p-2.5 text-left">کارکرد تجمعی</th>
                    <th className="p-2.5 text-left">نرخ واحد</th>
                    <th className="p-2.5 text-left">مبلغ دوره ({moneyUnitLabel()})</th>
                    <th className="p-2.5 text-center">وضعیت مازاد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculatedItems.map((item) => (
                    <tr
                      key={item.boqItemId}
                      className={`hover:bg-slate-50/80 ${item.isExceeded ? 'bg-rose-50/40' : ''}`}
                    >
                      <td className="p-2.5 font-mono text-slate-500">{item.rowNumber}</td>
                      <td className="p-2.5 font-mono font-bold text-blue-700">{item.code}</td>
                      <td className="p-2.5 max-w-xs font-medium text-slate-900">{item.description}</td>
                      <td className="p-2.5 text-center font-bold text-slate-600">{item.unit}</td>
                      <td className="p-2.5 text-left font-mono">{formatInt(item.contractQuantity)}</td>
                      <td className="p-2.5 text-left font-mono">{formatInt(item.previousQuantity)}</td>
                      <td className="p-2.5 text-center">
                        <IntegerInput
                          aria-label={`مقدار این دوره ${item.code}`}
                          value={currentQuantities[item.boqItemId] || 0}
                          onValueChange={(v) => setCurrentQuantities((prev) => ({ ...prev, [item.boqItemId]: v }))}
                          className="w-24 p-1.5 rounded-lg border border-slate-300 text-center font-mono font-bold bg-white focus:outline-amber-500"
                        />
                      </td>
                      <td className="p-2.5 text-left font-mono font-bold">
                        <span className={item.isExceeded ? 'text-rose-700 font-black' : 'text-indigo-900'}>
                          {formatInt(item.cumulativeQuantity)}
                        </span>
                      </td>
                      <td className="p-2.5 text-left font-mono text-slate-600">{formatMoney(item.unitRate, false)}</td>
                      <td className="p-2.5 text-left font-mono font-bold text-slate-900">
                        {formatMoney(item.currentAmount, false)}
                      </td>
                      <td className="p-2.5 text-center">
                        {item.isExceeded ? (
                          <div className="space-y-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900 block">
                              +{formatInt(item.exceededQuantity)} مازاد
                            </span>
                            <select
                              value={overrunClassifications[item.boqItemId] || 'تغییر مقادیر'}
                              onChange={(e) =>
                                setOverrunClassifications((prev) => ({
                                  ...prev,
                                  [item.boqItemId]: e.target.value as StatementBOQItem['exceededClassification'],
                                }))
                              }
                              className="text-[10px] p-1 rounded border border-rose-300 bg-white"
                            >
                              <option value="تغییر مقادیر">تغییر مقادیر ۲۵٪</option>
                              <option value="مقدار مازاد">مقدار مازاد</option>
                              <option value="آیتم جدید (ستاره‌دار)">آیتم جدید ستاره‌دار</option>
                              <option value="الحاقیه">الحاقیه جدید</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-emerald-600 text-[11px] font-medium">مجاز در پیمان</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Additional Items, Adjustments, VAT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">سایر اقلام مجاز / تجهیز کارگاه و مصالح پای‌کار:</label>
              <MoneyInput value={otherAllowables} onValueChange={setOtherAllowables} showUnit className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono" />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {formatMoney(otherAllowables)}
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">مبلغ تعدیل آحادبها این دوره:</label>
              <MoneyInput value={adjustmentAmount} onValueChange={setAdjustmentAmount} showUnit className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono" />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {formatMoney(adjustmentAmount)}
              </span>
            </div>

            <div>
              <span className="block text-slate-700 font-bold mb-1">مالیات بر ارزش افزوده ({toPersianDigits(vatRate)}٪ طبق تنظیمات):</span>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="vat-check"
                  checked={includeVAT}
                  onChange={(e) => setIncludeVAT(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600"
                />
                <label htmlFor="vat-check" className="text-slate-800 font-medium">
                  اعمال ارزش افزوده (+{toPersianDigits(vatRate)}٪ روی مبلغ پیش از مالیات)
                </label>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                مبلغ محاسبه‌شده: {formatMoney(vatAmount)}
              </span>
            </div>
          </div>

          {/* Section 4: Deduction Engine Rules */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-rose-600" />
              موتور محاسبات کسورات قانونی (مبنا: مبلغ پیش از ارزش افزوده {formatMoney(baseBeforeVat)})
            </h4>
            <p className="text-[11px] text-slate-600">
              مانده پیش‌پرداخت قابل استهلاک این قرارداد: <strong className="font-mono">{formatMoney(remainingAdvance)}</strong>
              {advanceCapped && <span className="text-amber-700 font-bold"> — استهلاک به همین مانده محدود شد.</span>}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">درصد استرداد پیش‌پرداخت:</label>
                <div className="flex items-center gap-1">
                  <IntegerInput
                    value={advanceRate}
                    onValueChange={(v) => setAdvanceRate(Math.min(100, v))}
                    className="w-20 p-1.5 rounded border border-slate-300 bg-white text-center font-bold"
                  />
                  <span>٪</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">درصد سپرده حسن انجام کار:</label>
                <div className="flex items-center gap-1">
                  <IntegerInput
                    value={retentionRate}
                    onValueChange={(v) => setRetentionRate(Math.min(100, v))}
                    className="w-20 p-1.5 rounded border border-slate-300 bg-white text-center font-bold"
                  />
                  <span>٪</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">درصد بیمه تأمین اجتماعی (ماده ۳۸):</label>
                <div className="flex items-center gap-1">
                  <IntegerInput
                    value={insuranceRate}
                    onValueChange={(v) => setInsuranceRate(Math.min(100, v))}
                    className="w-20 p-1.5 rounded border border-slate-300 bg-white text-center font-bold"
                  />
                  <span>٪</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">کسورات مصالح کارفرما (مقطوع):</label>
                <MoneyInput value={materialDeduction} onValueChange={setMaterialDeduction} showUnit className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono" />
              </div>
            </div>
          </div>

          {formError && (
            <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold" role="alert">
              {formError}
            </p>
          )}

          {/* Section 5: Final Calculated Totals Banner */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="grid grid-cols-3 gap-6 text-center sm:text-right">
              <div>
                <span className="text-[11px] text-slate-400 block">کارکرد ناخالص (Gross):</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {formatMoney(grossAmount)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">مجموع کسورات (Deductions):</span>
                <span className="text-base font-black text-rose-400 font-mono">
                  -{formatMoney(totalDeductions)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">مبلغ خالص قابل پرداخت (Net):</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {formatMoney(netPayable)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSubmit('draft')}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-700 cursor-pointer"
              >
                ذخیره به عنوان پیش‌نویس
              </button>
              <button
                onClick={() => handleSubmit('submitted_to_consultant')}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer"
              >
                تکمیل و ارسال به مهندس مشاور
              </button>
            </div>
          </div>
        </div>
      </Dialog>
  );
};
