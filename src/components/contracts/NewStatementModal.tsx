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

interface NewStatementModalProps {
  contracts: Contract[];
  allBOQItems: ContractBOQItem[];
  preselectedContract?: Contract | null;
  currentUser: UserProfile;
  onClose: () => void;
  onSaveStatement: (statement: DetailedProgressStatement) => void;
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

  // Form Metadata
  const [statementNumber, setStatementNumber] = useState('صورت‌وضعیت موقت شماره ۰۵');
  const [statementType, setStatementType] = useState<StatementType>('موقت');
  const [periodStartDate, setPeriodStartDate] = useState('۱۴۰۳/۰۶/۰۱');
  const [periodEndDate, setPeriodEndDate] = useState('۱۴۰۳/۰۶/۳۱');
  const [preparationDate, setPreparationDate] = useState('۱۴۰۳/۰۷/۰۲');
  const [preparerName, setPreparerName] = useState(currentUser.name);
  const [description, setDescription] = useState('عملیات اجرایی و کارکرد عمرانی دوره منتهی به شهریور ۱۴۰۳');

  // Interactive current period quantities for BOQ items
  const [currentQuantities, setCurrentQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    contractBOQ.forEach((item) => {
      // default sample quantity to demonstrate calculations
      init[item.id] = Math.round(item.initialQuantity * 0.05);
    });
    return init;
  });

  // Overrun classifications
  const [overrunClassifications, setOverrunClassifications] = useState<Record<string, string>>({});

  // Additional allowances & Adjustments
  const [otherAllowables, setOtherAllowables] = useState<number>(50_000_000);
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(75_000_000);
  const [includeVAT, setIncludeVAT] = useState<boolean>(true);

  // Deductions percentages
  const [advanceRate, setAdvanceRate] = useState<number>(10);
  const [retentionRate, setRetentionRate] = useState<number>(10);
  const [insuranceRate, setInsuranceRate] = useState<number>(5);
  const [materialDeduction, setMaterialDeduction] = useState<number>(20_000_000);

  // Calculations
  const calculatedItems: StatementBOQItem[] = useMemo(() => {
    return contractBOQ.map((b) => {
      const currentQty = Number(currentQuantities[b.id] || 0);
      const prevQty = b.cumulativeExecutedQuantity;
      const cumulativeQty = prevQty + currentQty;
      const isExceeded = cumulativeQty > b.initialQuantity;
      const exceededQty = isExceeded ? cumulativeQty - b.initialQuantity : 0;
      const currentAmount = currentQty * b.unitRate;
      const cumulativeAmount = cumulativeQty * b.unitRate;

      return {
        id: `s-item-${b.id}-${Date.now()}`,
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
        exceededClassification: isExceeded
          ? (overrunClassifications[b.id] as any) || 'تغییر مقادیر'
          : undefined,
        inventoryMaterialCode: b.inventoryMaterialCode,
      };
    });
  }, [contractBOQ, currentQuantities, overrunClassifications]);

  const workAmountCurrent = useMemo(() => {
    return calculatedItems.reduce((sum, item) => sum + item.currentAmount, 0);
  }, [calculatedItems]);

  const vatAmount = useMemo(() => {
    return includeVAT ? Math.round((workAmountCurrent + otherAllowables + adjustmentAmount) * 0.1) : 0;
  }, [includeVAT, workAmountCurrent, otherAllowables, adjustmentAmount]);

  const grossAmount = useMemo(() => {
    return workAmountCurrent + otherAllowables + adjustmentAmount + vatAmount;
  }, [workAmountCurrent, otherAllowables, adjustmentAmount, vatAmount]);

  // Deductions
  const deductionsList: DeductionItem[] = useMemo(() => {
    const adv = Math.round(grossAmount * (advanceRate / 100));
    const ret = Math.round(grossAmount * (retentionRate / 100));
    const ins = Math.round(grossAmount * (insuranceRate / 100));

    return [
      {
        id: 'ded-adv',
        title: `استرداد پیش‌پرداخت (${advanceRate}٪)`,
        type: 'advance_payment',
        mode: 'percentage',
        rate: advanceRate,
        baseAmount: grossAmount,
        calculatedAmount: adv,
      },
      {
        id: 'ded-ret',
        title: `سپرده حسن انجام کار (${retentionRate}٪)`,
        type: 'retention',
        mode: 'percentage',
        rate: retentionRate,
        baseAmount: grossAmount,
        calculatedAmount: ret,
      },
      {
        id: 'ded-ins',
        title: `حق بیمه تأمین اجتماعی (${insuranceRate}٪)`,
        type: 'insurance',
        mode: 'percentage',
        rate: insuranceRate,
        baseAmount: grossAmount,
        calculatedAmount: ins,
      },
      {
        id: 'ded-mat',
        title: 'کسورات مصالح و آب و برق کارگاهی کارفرما',
        type: 'materials',
        mode: 'fixed',
        rate: 0,
        baseAmount: grossAmount,
        calculatedAmount: materialDeduction,
      },
    ];
  }, [grossAmount, advanceRate, retentionRate, insuranceRate, materialDeduction]);

  const totalDeductions = useMemo(() => {
    return deductionsList.reduce((sum, d) => sum + d.calculatedAmount, 0);
  }, [deductionsList]);

  const netPayable = useMemo(() => {
    return Math.max(0, grossAmount - totalDeductions);
  }, [grossAmount, totalDeductions]);

  const hasAnyExceeded = calculatedItems.some((i) => i.isExceeded);

  const handleSubmit = (targetStatus: 'draft' | 'submitted_to_consultant') => {
    if (!selectedContract) return;

    const newStatement: DetailedProgressStatement = {
      id: `stm-${Date.now()}`,
      statementNumber,
      contractId: selectedContract.id,
      contractCode: selectedContract.code,
      contractNumber: selectedContract.number,
      projectId: selectedContract.projectId,
      projectName: selectedContract.projectName,
      client: selectedContract.employer,
      consultant: selectedContract.consultant,
      type: statementType,
      periodStartDate,
      periodEndDate,
      preparationDate,
      preparerName,
      description,
      status: targetStatus,
      items: calculatedItems,
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
      dueDate: '۱۴۰۳/۰۷/۳۰',
      paymentStatus: 'Unpaid',
      overdueDays: 0,
      workflowHistory: [
        {
          date: preparationDate,
          time: '۱۱:۰۰',
          user: currentUser.name,
          role: currentUser.role,
          fromStatus: 'draft',
          toStatus: targetStatus,
          action: targetStatus === 'draft' ? 'ایجاد پیش‌نویس صورت‌وضعیت کارگاه' : 'ارسال مستقیم به مهندس مشاور',
        },
      ],
      attachments: [],
    };

    onSaveStatement(newStatement);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
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
                onChange={(e) => setStatementType(e.target.value as any)}
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
              <label className="block text-slate-600 font-bold mb-1">تهیه‌کننده (سرپرست کارگاه):</label>
              <input
                type="text"
                value={preparerName}
                onChange={(e) => setPreparerName(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
              />
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
                    <th className="p-2.5 text-left">مبلغ دوره (تومان)</th>
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
                      <td className="p-2.5 text-left font-mono">{item.contractQuantity.toLocaleString('fa-IR')}</td>
                      <td className="p-2.5 text-left font-mono">{item.previousQuantity.toLocaleString('fa-IR')}</td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          value={currentQuantities[item.boqItemId] || 0}
                          onChange={(e) =>
                            setCurrentQuantities({
                              ...currentQuantities,
                              [item.boqItemId]: Number(e.target.value),
                            })
                          }
                          className="w-24 p-1.5 rounded-lg border border-slate-300 text-center font-mono font-bold bg-white focus:outline-amber-500"
                        />
                      </td>
                      <td className="p-2.5 text-left font-mono font-bold">
                        <span className={item.isExceeded ? 'text-rose-700 font-black' : 'text-indigo-900'}>
                          {item.cumulativeQuantity.toLocaleString('fa-IR')}
                        </span>
                      </td>
                      <td className="p-2.5 text-left font-mono text-slate-600">{item.unitRate.toLocaleString('fa-IR')}</td>
                      <td className="p-2.5 text-left font-mono font-bold text-slate-900">
                        {item.currentAmount.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-2.5 text-center">
                        {item.isExceeded ? (
                          <div className="space-y-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900 block">
                              +{item.exceededQuantity.toLocaleString('fa-IR')} مازاد
                            </span>
                            <select
                              value={overrunClassifications[item.boqItemId] || 'تغییر مقادیر'}
                              onChange={(e) =>
                                setOverrunClassifications({
                                  ...overrunClassifications,
                                  [item.boqItemId]: e.target.value,
                                })
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
              <input
                type="number"
                value={otherAllowables}
                onChange={(e) => setOtherAllowables(Number(e.target.value))}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {otherAllowables.toLocaleString('fa-IR')} تومان
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">مبلغ تعدیل آحادبها این دوره:</label>
              <input
                type="number"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {adjustmentAmount.toLocaleString('fa-IR')} تومان
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">مالیات بر ارزش افزوده (۱۰٪):</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="vat-check"
                  checked={includeVAT}
                  onChange={(e) => setIncludeVAT(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600"
                />
                <label htmlFor="vat-check" className="text-slate-800 font-medium">
                  اعمال ارزش افزوده (+۱۰٪ به ناخالص)
                </label>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                مبلغ محاسبه‌شده: {vatAmount.toLocaleString('fa-IR')} تومان
              </span>
            </div>
          </div>

          {/* Section 4: Deduction Engine Rules */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-rose-600" />
              موتور محاسبات کسورات قانونی (Deduction Engine)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">درصد استرداد پیش‌پرداخت:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={advanceRate}
                    onChange={(e) => setAdvanceRate(Number(e.target.value))}
                    className="w-20 p-1.5 rounded border border-slate-300 bg-white text-center font-bold"
                  />
                  <span>٪</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">درصد سپرده حسن انجام کار:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={retentionRate}
                    onChange={(e) => setRetentionRate(Number(e.target.value))}
                    className="w-20 p-1.5 rounded border border-slate-300 bg-white text-center font-bold"
                  />
                  <span>٪</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">درصد بیمه تأمین اجتماعی (ماده ۳۸):</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={insuranceRate}
                    onChange={(e) => setInsuranceRate(Number(e.target.value))}
                    className="w-20 p-1.5 rounded border border-slate-300 bg-white text-center font-bold"
                  />
                  <span>٪</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">کسورات مصالح کارفرما (مقطوع):</label>
                <input
                  type="number"
                  value={materialDeduction}
                  onChange={(e) => setMaterialDeduction(Number(e.target.value))}
                  className="w-full p-1.5 rounded border border-slate-300 bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Final Calculated Totals Banner */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="grid grid-cols-3 gap-6 text-center sm:text-right">
              <div>
                <span className="text-[11px] text-slate-400 block">کارکرد ناخالص (Gross):</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {grossAmount.toLocaleString('fa-IR')} تومان
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">مجموع کسورات (Deductions):</span>
                <span className="text-base font-black text-rose-400 font-mono">
                  -{totalDeductions.toLocaleString('fa-IR')} تومان
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">مبلغ خالص قابل پرداخت (Net):</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {netPayable.toLocaleString('fa-IR')} تومان
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
      </div>
    </div>
  );
};
