/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  SubcontractorProgressStatement,
  SubcontractorStatementWorkflowStatus,
  UserProfile,
} from '../../../types';
import {
  X,
  Printer,
  FileCheck2,
  HardHat,
  UserCheck,
  ShieldCheck,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  Building,
  Hammer,
} from 'lucide-react';
import { Dialog } from '../../../ui/Dialog';
import { formatMoney, formatMoneyCompact, moneyUnitLabel } from '../../../utils/money';
import { useCompany } from '../../../store/session';
import {
  SUBCONTRACTOR_STATEMENT_STEPS,
  subcontractorActiveStepTitle,
  subcontractorStatementActions,
  subcontractorStatementStep,
} from '../../../store/views/contracts';
import { formatDecimal, formatText } from '../../../utils/formatters';
import { Money } from '../../common/Money';

interface SubcontractorStatementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  statement: SubcontractorProgressStatement | null;
  currentUser: UserProfile;
  /** Next approval step, or return for revision (runs the store workflow). */
  onDecide?: (statementId: string, decision: 'approve' | 'return' | 'reject', comment?: string) => void;
  onOpenPaymentModal?: (statement: SubcontractorProgressStatement) => void;
}

export const SubcontractorStatementDetailModal: React.FC<SubcontractorStatementDetailModalProps> = ({
  isOpen,
  onClose,
  statement,
  currentUser,
  onDecide,
  onOpenPaymentModal,
}) => {
  const company = useCompany();
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'print'>('details');

  if (!isOpen || !statement) return null;

  // Position on the 7-step approval bar.
  const currentStep = subcontractorStatementStep(statement.status);
  const steps = SUBCONTRACTOR_STATEMENT_STEPS;
  const activeStepTitle = subcontractorActiveStepTitle(statement.status);
  const actions = subcontractorStatementActions(currentUser, statement);

  return (
    <Dialog onClose={onClose} label="جزئیات صورت‌وضعیت پیمانکار جزء" overlayClassName="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto" className="bg-white rounded-xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
      
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{formatText(statement.statementNumber)}</h3>
                <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-1 rounded border border-amber-300">
                  {formatText(statement.tradeType)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                پیمانکار: <strong className="text-slate-800">{formatText(statement.subcontractorName)}</strong> | پروژه:{' '}
                <strong>{formatText(statement.projectName)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === 'print' ? 'details' : 'print')}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="فرم رسمی چاپ"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 6-Stage Stepper View */}
        <div className="bg-slate-50 p-4 border-b border-slate-200">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-bold text-slate-700">گردش کار ۶ مرحله‌ای صورت‌وضعیت پیمانکار جزء:</span>
            <span className="text-sm text-amber-800 font-bold">
              مرحله فعال: {activeStepTitle}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {steps.map((st, i) => {
              const isPast = i < currentStep;
              const isCurrent = i === currentStep;
              return (
                <div
                  key={st.title}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    isCurrent
                      ? 'bg-amber-400 text-slate-950 font-bold border-amber-500 shadow-xs'
                      : isPast
                      ? 'bg-emerald-50 text-emerald-900 font-bold border-emerald-300'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 text-sm mb-1">
                    {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                    <span>{formatText(st.title)}</span>
                  </div>
                  <span className="text-sm block opacity-80">{formatText(st.desc)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-100 text-sm font-bold">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2 border-b-2 cursor-pointer ${
              activeTab === 'details'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ریز مقادیر و مالی
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 border-b-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            سوابق تاییدات و لاگ
          </button>
          <button
            onClick={() => setActiveTab('print')}
            className={`pb-2 border-b-2 cursor-pointer ${
              activeTab === 'print'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            پیش‌نمایش چاپ رسمی
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          {activeTab === 'details' && (
            <>
              {/* Financial Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-xs">مبلغ ناخالص کارکرد:</span>
                  <span className="text-base font-bold text-slate-900">
                    <Money rial={statement.grossAmount} compact />
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-xs">مجموع کسورات:</span>
                  <span className="text-base font-bold text-rose-700">
                    <Money rial={statement.totalDeductions} compact />
                  </span>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <span className="text-amber-800 block text-sm font-bold">خالص قابل پرداخت:</span>
                  <span className="text-base font-bold text-amber-950">
                    <Money rial={statement.netPayable} compact />
                  </span>
                </div>

                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <span className="text-emerald-800 block text-sm font-bold">مبلغ پرداخت‌شده:</span>
                  <span className="text-base font-bold text-emerald-950">
                    <Money rial={statement.paidAmount} compact />
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <span className="text-sm font-bold text-slate-800 block">
                  جدول ریز مقادیر و احجام کارکرد این دوره:
                </span>
                <div className="border border-slate-200 rounded-xl table-scroll">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2">شرح عملیات</th>
                        <th className="p-2 text-center">واحد</th>
                        <th className="p-2 text-center">قرارداد</th>
                        <th className="p-2 text-center">قبلی</th>
                        <th className="p-2 text-center">این دوره</th>
                        <th className="p-2 text-center">تجمعی</th>
                        <th className="p-2 text-left">نرخ واحد</th>
                        <th className="p-2 text-left">مبلغ دوره</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statement.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-2 text-slate-800 font-medium">
                            {formatText(item.description)}
                            {item.notes && (
                              <span className="block text-xs text-slate-500 mt-1">{formatText(item.notes)}</span>
                            )}
                          </td>
                          <td className="p-2 text-center text-slate-600">{formatText(item.unit)}</td>
                          <td className="p-2 text-center text-slate-600">
                            {formatDecimal(item.contractQuantity)}
                          </td>
                          <td className="p-2 text-center text-slate-600">
                            {formatDecimal(item.previousQuantity)}
                          </td>
                          <td className="p-2 text-center font-bold text-slate-900">
                            {formatDecimal(item.currentQuantity)}
                          </td>
                          <td className="p-2 text-center font-bold text-blue-700">
                            {formatDecimal(item.cumulativeQuantity)}
                          </td>
                          <td className="p-2 text-left text-slate-600">
                            {formatMoney(item.unitRate, false)}
                          </td>
                          <td className="p-2 text-left font-bold text-slate-900">
                            <Money rial={item.currentAmount} compact />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
                <span className="font-bold text-slate-800 block">جدول ریز کسورات قانونی و کارگاهی:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-500 text-xs block">سپرده حسن انجام کار:</span>
                    <strong className="text-slate-800">
                      <Money rial={statement.deductions.retention} compact />
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs block">استهلاک پیش‌پرداخت:</span>
                    <strong className="text-slate-800">
                      <Money rial={statement.deductions.advancePaymentDeduction} compact />
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs block">جریمه ایمنی یا پرت مصالح:</span>
                    <strong className="text-slate-800">
                      <Money rial={statement.deductions.safetyOrWastePenalty} compact />
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs block">سایر کسورات:</span>
                    <strong className="text-slate-800">
                      <Money rial={statement.deductions.otherDeductions} compact />
                    </strong>
                  </div>
                </div>
                {statement.deductions.description && (
                  <p className="text-xs text-slate-500 pt-1 border-t border-slate-200">
                    {formatText(statement.deductions.description)}
                  </p>
                )}
              </div>

              {/* Approval Notes */}
              {(statement.siteReviewNote || statement.pmApprovalNote || statement.managementApprovalNote) && (
                <div className="space-y-2 text-sm">
                  <span className="font-bold text-slate-800 block">نظرات و تأییدیه‌های مدیران:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {statement.siteReviewNote && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                        <strong className="block mb-1">سرپرست کارگاه ({statement.siteReviewerName}):</strong>
                        <p className="text-sm">{formatText(statement.siteReviewNote)}</p>
                      </div>
                    )}
                    {statement.pmApprovalNote && (
                      <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900">
                        <strong className="block mb-1">مدیر پروژه ({statement.pmApproverName}):</strong>
                        <p className="text-sm">{formatText(statement.pmApprovalNote)}</p>
                      </div>
                    )}
                    {statement.managementApprovalNote && (
                      <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900">
                        <strong className="block mb-1">مدیریت شرکت ({statement.managementApproverName}):</strong>
                        <p className="text-sm">{formatText(statement.managementApprovalNote)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <span className="text-sm font-bold text-slate-800 block">لاگ گردش کار و تغییرات وضعیت:</span>
              <div className="space-y-2">
                {statement.workflowHistory.map((log, index) => (
                  <div
                    key={`${log.date}-${log.time}-${log.toStatus}-${index}`}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900">{formatText(log.action)}</strong>
                        <span className="text-xs text-slate-500">
                          {formatText(log.date)} — {formatText(log.time)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        توسط: <strong className="text-slate-800">{formatText(log.user)}</strong> ({log.role})
                      </div>
                      {log.comment && (
                        <p className="text-xs text-slate-500 bg-white p-2 rounded border border-slate-100">
                          {formatText(log.comment)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'print' && (
            <div className="border border-slate-300 p-8 rounded-xl bg-white text-slate-900 space-y-6 shadow-sm">
              <div className="text-center border-b border-slate-300 pb-4">
                <h2 className="text-lg font-bold">{formatText(company.legalName)}</h2>
                <h3 className="text-base font-bold text-slate-700 mt-1">
                  برگه تأییدیه کارکرد و صورت‌وضعیت پیمانکار جزء
                </h3>
                <span className="text-xs text-slate-500 block mt-1">
                  شماره: {formatText(statement.statementNumber)} | تاریخ: {formatText(statement.submissionDate)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm border border-slate-200 p-4 rounded-lg bg-slate-50">
                <div>
                  <span className="text-slate-500">پروژه:</span> <strong>{formatText(statement.projectName)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">شماره پیمان:</span>{' '}
                  <strong>{formatText(statement.subcontractorContractNumber)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">پیمانکار جزء:</span>{' '}
                  <strong>{formatText(statement.subcontractorName)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">رشته کاری:</span> <strong>{formatText(statement.tradeType)}</strong>
                </div>
              </div>

              {/* Table */}
              <div className="table-scroll">
                <table className="w-full text-right text-sm border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="p-2 border-l border-slate-300">ردیف</th>
                    <th className="p-2 border-l border-slate-300">شرح عملیات</th>
                    <th className="p-2 border-l border-slate-300 text-center">واحد</th>
                    <th className="p-2 border-l border-slate-300 text-center">مقدار</th>
                    <th className="p-2 border-l border-slate-300 text-left">نرخ واحد ({moneyUnitLabel()})</th>
                    <th className="p-2 text-left">مبلغ کل ({moneyUnitLabel()})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {statement.items.map((item, i) => (
                    <tr key={item.id}>
                      <td className="p-2 border-l border-slate-200 text-center">{i + 1}</td>
                      <td className="p-2 border-l border-slate-200">{formatText(item.description)}</td>
                      <td className="p-2 border-l border-slate-200 text-center">{formatText(item.unit)}</td>
                      <td className="p-2 border-l border-slate-200 text-center font-bold">
                        {formatDecimal(item.currentQuantity)}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-left">
                        {formatMoney(item.unitRate, false)}
                      </td>
                      <td className="p-2 text-left font-bold">{formatMoney(item.currentAmount, false)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold border-t border-slate-300">
                    <td colSpan={5} className="p-2 text-left border-l border-slate-300">
                      مبلغ ناخالص صورت‌وضعیت:
                    </td>
                    <td className="p-2 text-left">{formatMoney(statement.grossAmount, false)}</td>
                  </tr>
                  <tr className="bg-slate-50 border-t border-slate-200 text-rose-700">
                    <td colSpan={5} className="p-2 text-left border-l border-slate-300">
                      کسورات (حسن انجام کار، پیش‌پرداخت، جریمه):
                    </td>
                    <td className="p-2 text-left">{formatMoney(statement.totalDeductions, false)}</td>
                  </tr>
                  <tr className="bg-amber-100 font-bold border-t border-slate-300 text-amber-950">
                    <td colSpan={5} className="p-2 text-left border-l border-slate-300">
                      خالص قابل پرداخت به پیمانکار:
                    </td>
                    <td className="p-2 text-left"><Money rial={statement.netPayable} /></td>
                  </tr>
                </tbody>
              </table>
              </div>

              {/* 4 Signatures row */}
              <div className="grid grid-cols-4 gap-2 pt-8 text-center text-sm">
                <div className="border-t border-slate-400 pt-2">
                  <span className="font-bold block text-slate-800">پیمانکار جزء</span>
                  <span className="text-xs text-slate-500 mt-1 block">مهر و امضا</span>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <span className="font-bold block text-slate-800">سرپرست کارگاه</span>
                  <span className="text-xs text-slate-500 mt-1 block">تأیید متره میدانی</span>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <span className="font-bold block text-slate-800">مدیر پروژه</span>
                  <span className="text-xs text-slate-500 mt-1 block">تأیید فنی و زمانی</span>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <span className="font-bold block text-slate-800">مدیرعامل / امور مالی</span>
                  <span className="text-xs text-slate-500 mt-1 block">دستور پرداخت</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50">
          <div className="text-xs text-slate-500 font-medium">
            وضعیت جاری: <strong className="text-slate-800">{formatText(statement.status)}</strong>
          </div>

          <div className="flex items-center gap-2">
            {actions.awaitingPayment && onOpenPaymentModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPaymentModal(statement);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
              >
                <DollarSign className="w-4 h-4" />
                <span>دستور پرداخت و ثبت هزینه پروژه</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              بستن
            </button>
          </div>
        </div>
      </Dialog>
  );
};
