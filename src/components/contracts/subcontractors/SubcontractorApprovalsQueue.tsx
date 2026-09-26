/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SubcontractorProgressStatement, UserProfile } from '../../../types';
import {
  CheckSquare,
  Clock,
  HardHat,
  ShieldCheck,
  DollarSign,
  AlertCircle,
  Eye,
  CheckCircle2,
  XCircle,
  ArrowRight,
  FileCheck2,
  UserCheck,
  Building,
} from 'lucide-react';
import { formatMoney, formatMoneyCompact, moneyUnitLabel } from '../../../utils/money';
import { subcontractorQueues, subcontractorStatementActions } from '../../../store/views/contracts';
import { Dialog } from '../../../ui/Dialog';
import { formatDecimal, formatInt, formatText } from '../../../utils/formatters';
import { Money } from '../../common/Money';

interface SubcontractorApprovalsQueueProps {
  statements: SubcontractorProgressStatement[];
  currentUser: UserProfile;
  onSelectStatement: (statement: SubcontractorProgressStatement) => void;
  /** Next approval step, or return for revision (runs the store workflow). */
  onDecide: (statementId: string, decision: 'approve' | 'return' | 'reject', comment?: string) => void;
  onPayStatement: (statement: SubcontractorProgressStatement) => void;
}

export const SubcontractorApprovalsQueue: React.FC<SubcontractorApprovalsQueueProps> = ({
  statements,
  currentUser,
  onSelectStatement,
  onDecide,
  onPayStatement,
}) => {
  const [activeStage, setActiveStage] = useState<'site' | 'pm' | 'management' | 'payment'>('site');
  const [actionComment, setActionComment] = useState('');
  const [selectedStatementForAction, setSelectedStatementForAction] = useState<SubcontractorProgressStatement | null>(
    null
  );
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  // The workflow re-checks on submit; the buttons only reflect the same rules (role, project, no self-approval).
  const stepPermission = (s: SubcontractorProgressStatement) => {
    const step = subcontractorStatementActions(currentUser, s).advance;
    return step ? { ok: step.allowed, reason: step.reason } : { ok: false, reason: 'مرحله تأیید باز نیست.' };
  };
  const canReturn = (s: SubcontractorProgressStatement) => subcontractorStatementActions(currentUser, s).canReturn;

  // Statements by workflow stage: site (recorded, measured) → PM (site-approved) → management (finance, CEO) → payment.
  const queues = subcontractorQueues(statements);
  const siteReviewQueue = queues.site;
  const pmReviewQueue = queues.pm;
  const pmApprovedQueue = queues.management;
  const managementApprovedQueue = queues.payment;

  const handleExecuteAction = () => {
    if (!selectedStatementForAction || !actionType) return;

    if (actionType === 'approve') {
      onDecide(selectedStatementForAction.id, 'approve', actionComment || undefined);
    } else {
      if (!actionComment.trim()) return;
      onDecide(selectedStatementForAction.id, 'return', actionComment.trim());
    }

    setSelectedStatementForAction(null);
    setActionType(null);
    setActionComment('');
  };

  return (
    <div className="space-y-6">
      {/* Top Workflow Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">کارتابل گردش کار و تاییدات پیمانکاران جزء</h3>
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-bold">
              Workflow Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            پیمانکار جزء ← ثبت کار انجام‌شده ← صورت‌وضعیت ← بررسی کارگاه ← تأیید مدیر پروژه ← تأیید مدیریت ← پرداخت ← ثبت هزینه پروژه
          </p>
        </div>

        {/* Workflow Stage Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
          <button
            onClick={() => setActiveStage('site')}
            className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
              activeStage === 'site'
                ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-2 font-bold">
                <HardHat className="w-4 h-4" />
                ۱. بررسی کارگاه
              </span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-bold ${
                  activeStage === 'site' ? 'bg-slate-950 text-amber-400' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {formatInt(siteReviewQueue.length)}
              </span>
            </div>
            <p className={`text-xs ${activeStage === 'site' ? 'text-slate-900' : 'text-slate-500'}`}>
              کنترل متره و مقادیر کارگاهی
            </p>
          </button>

          <button
            onClick={() => setActiveStage('pm')}
            className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
              activeStage === 'pm'
                ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-2 font-bold">
                <UserCheck className="w-4 h-4" />
                ۲. تأیید مدیر پروژه
              </span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-bold ${
                  activeStage === 'pm' ? 'bg-slate-950 text-amber-400' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {formatInt(pmReviewQueue.length)}
              </span>
            </div>
            <p className={`text-xs ${activeStage === 'pm' ? 'text-slate-900' : 'text-slate-500'}`}>
              ارزیابی کیفیت و زمانبندی
            </p>
          </button>

          <button
            onClick={() => setActiveStage('management')}
            className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
              activeStage === 'management'
                ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-2 font-bold">
                <ShieldCheck className="w-4 h-4" />
                ۳. تأیید مدیریت / مالی
              </span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-bold ${
                  activeStage === 'management'
                    ? 'bg-slate-950 text-amber-400'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {formatInt(pmApprovedQueue.length)}
              </span>
            </div>
            <p className={`text-xs ${activeStage === 'management' ? 'text-slate-900' : 'text-slate-500'}`}>
              تأیید بودجه و دستور پرداخت
            </p>
          </button>

          <button
            onClick={() => setActiveStage('payment')}
            className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
              activeStage === 'payment'
                ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-2 font-bold">
                <DollarSign className="w-4 h-4" />
                ۴. پرداخت و ثبت هزینه
              </span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-bold ${
                  activeStage === 'payment' ? 'bg-slate-950 text-amber-400' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {formatInt(managementApprovedQueue.length)}
              </span>
            </div>
            <p className={`text-xs ${activeStage === 'payment' ? 'text-slate-900' : 'text-slate-500'}`}>
              تسویه نقدی و صدور سند حسابداری
            </p>
          </button>
        </div>
      </div>

      {/* Stage Content List */}
      <div className="space-y-4">
        {activeStage === 'site' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>صورت‌وضعیت‌های در انتظار متره و تأیید سرپرست کارگاه</span>
              <span>{formatInt(siteReviewQueue.length)} مورد</span>
            </div>

            {siteReviewQueue.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                موردی در انتظار بررسی کارگاه وجود ندارد.
              </div>
            ) : (
              siteReviewQueue.map((stmt) => (
                <div
                  key={stmt.id}
                  className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 hover:border-amber-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{formatText(stmt.statementNumber)}</span>
                        <span className="text-xs font-bold bg-amber-50 text-amber-800 px-2 py-1 rounded">
                          {formatText(stmt.tradeType)}
                        </span>
                        <span className="text-xs text-slate-500">تاریخ ثبت: {formatText(stmt.submissionDate)}</span>
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        پیمانکار: <strong className="text-slate-800">{formatText(stmt.subcontractorName)}</strong> | پروژه:{' '}
                        <strong>{formatText(stmt.projectName)}</strong>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs text-slate-500 block">ناخالص اعلامی:</span>
                      <span className="text-base font-bold text-slate-900">
                        <Money rial={stmt.grossAmount} compact />
                      </span>
                    </div>
                  </div>

                  {/* Table of items inside statement */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-sm font-bold text-slate-700 block mb-2">آیتم‌های کاری این دوره:</span>
                    <div className="table-scroll">
                      <table className="w-full text-right text-sm">
                        <thead>
                          <tr className="text-slate-500 font-bold border-b border-slate-200">
                            <th className="pb-2">شرح عملیات</th>
                            <th className="pb-2 text-center">واحد</th>
                            <th className="pb-2 text-center">مقدار دوره</th>
                            <th className="pb-2 text-left">نرخ واحد</th>
                            <th className="pb-2 text-left">مبلغ ({moneyUnitLabel()})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stmt.items.map((item) => (
                            <tr key={item.id}>
                              <td className="py-2 text-slate-800 font-medium">{formatText(item.description)}</td>
                              <td className="py-2 text-center text-slate-600">{formatText(item.unit)}</td>
                              <td className="py-2 text-center font-bold text-slate-900">
                                {formatDecimal(item.currentQuantity)}
                              </td>
                              <td className="py-2 text-left text-slate-600">
                                {formatMoney(item.unitRate, false)}
                              </td>
                              <td className="py-2 text-left font-bold text-slate-900">
                                <Money rial={item.currentAmount} compact />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Actions for Site Engineer */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => onSelectStatement(stmt)}
                      className="text-sm font-bold text-slate-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>مشاهده کامل و سوابق</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedStatementForAction(stmt);
                          setActionType('reject');
                        }}
                        disabled={!canReturn(stmt)}
                        className="disabled:opacity-40 px-3 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-sm font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>برگشت جهت اصلاح</span>
                      </button>

                      <button
                        disabled={!stepPermission(stmt).ok}
                        title={stepPermission(stmt).reason}
                        onClick={() => {
                          onDecide(stmt.id, 'approve', 'احجام و متره میدانی توسط سرپرست کارگاه کنترل و تایید شد.');
                        }}
                        className="btn btn-primary"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأیید متره کارگاه و ارجاع به مدیر پروژه</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeStage === 'pm' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>صورت‌وضعیت‌های تأییدشده در کارگاه — در انتظار تأیید مدیر پروژه</span>
              <span>{formatInt(pmReviewQueue.length)} مورد</span>
            </div>

            {pmReviewQueue.map((stmt) => (
              <div
                key={stmt.id}
                className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 hover:border-indigo-300 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{formatText(stmt.statementNumber)}</span>
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-800 px-2 py-1 rounded">
                        {formatText(stmt.tradeType)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      پیمانکار: <strong className="text-slate-800">{formatText(stmt.subcontractorName)}</strong> | پروژه:{' '}
                      <strong>{formatText(stmt.projectName)}</strong>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-xs text-slate-500 block">مبلغ مصوب کارگاه:</span>
                    <span className="text-base font-bold text-indigo-700">
                      <Money rial={stmt.siteVerifiedAmount} compact />
                    </span>
                  </div>
                </div>

                {stmt.siteReviewNote && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-sm text-amber-900">
                    <strong className="block mb-1">نظر سرپرست کارگاه ({stmt.siteReviewerName}):</strong>
                    {formatText(stmt.siteReviewNote)}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => onSelectStatement(stmt)}
                    className="text-sm font-bold text-slate-700 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>بررسی ریز متره</span>
                  </button>

                  <button
                    disabled={!stepPermission(stmt).ok}
                    title={stepPermission(stmt).reason}
                    onClick={() => {
                      onDecide(stmt.id, 'approve', 'انطباق با برنامه زمانبندی و کیفیت فنی کار مورد تأیید مدیر پروژه است.');
                    }}
                    className="disabled:opacity-40 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>تأیید مدیر پروژه و ارسال به مدیریت / مالی</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeStage === 'management' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>صورت‌وضعیت‌های تأییدشده توسط مدیر پروژه — در انتظار تأیید نهایی مدیریت و تخصیص بودجه</span>
              <span>{formatInt(pmApprovedQueue.length)} مورد</span>
            </div>

            {pmApprovedQueue.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                موردی در انتظار تأیید مدیریت وجود ندارد.
              </div>
            ) : (
              pmApprovedQueue.map((stmt) => (
                <div
                  key={stmt.id}
                  className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 hover:border-purple-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{formatText(stmt.statementNumber)}</span>
                        <span className="text-xs font-bold bg-purple-50 text-purple-800 px-2 py-1 rounded">
                          {formatText(stmt.tradeType)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        پیمانکار: <strong className="text-slate-800">{formatText(stmt.subcontractorName)}</strong> | پروژه:{' '}
                        <strong>{formatText(stmt.projectName)}</strong>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs text-slate-500 block">خالص پرداختنی:</span>
                      <span className="text-lg font-bold text-purple-700">
                        <Money rial={stmt.netPayable} compact />
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block mb-1">تفکیک کسورات:</span>
                      <div>سپرده حسن انجام کار: {formatMoneyCompact(stmt.deductions.retention)}</div>
                      <div>استهلاک پیش‌پرداخت: {formatMoneyCompact(stmt.deductions.advancePaymentDeduction)}</div>
                    </div>

                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 text-indigo-950">
                      <span className="font-bold block mb-1">تأییدیه مدیر پروژه ({stmt.pmApproverName}):</span>
                      <p className="text-sm">{formatText(stmt.pmApprovalNote || 'کیفیت و احجام مورد تایید است.')}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => onSelectStatement(stmt)}
                      className="text-sm font-bold text-slate-700 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>مشاهده جزئیات کامل</span>
                    </button>

                    <button
                      disabled={!stepPermission(stmt).ok}
                      title={stepPermission(stmt).reason}
                      onClick={() => {
                        onDecide(stmt.id, 'approve', 'تأیید مدیریت و صدور مجوز پرداخت توسط مدیریت شرکت صادر شد.');
                      }}
                      className="disabled:opacity-40 px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-sm font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>تأیید مدیریت و صدور مجوز پرداخت</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeStage === 'payment' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>صورت‌وضعیت‌های تأییدشده — آماده پرداخت و صدور سند ثبت هزینه پروژه</span>
              <span>{formatInt(managementApprovedQueue.length)} مورد</span>
            </div>

            {managementApprovedQueue.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                موردی در انتظار پرداخت وجود ندارد.
              </div>
            ) : (
              managementApprovedQueue.map((stmt) => (
                <div
                  key={stmt.id}
                  className="bg-white p-5 rounded-xl border border-rose-200 shadow-2xs space-y-4 hover:shadow-xs transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{formatText(stmt.statementNumber)}</span>
                        <span className="text-xs font-bold bg-rose-50 text-rose-800 px-2 py-1 rounded border border-rose-200">
                          بدهی فوری
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        پیمانکار: <strong className="text-slate-800">{formatText(stmt.subcontractorName)}</strong> | پروژه:{' '}
                        <strong>{formatText(stmt.projectName)}</strong>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs text-slate-500 block">مانده قابل پرداخت:</span>
                      <span className="text-xl font-bold text-rose-700">
                        <Money rial={stmt.remainingPayable} compact />
                      </span>
                    </div>
                  </div>

                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-sm text-emerald-950 flex items-center justify-between">
                    <div>
                      <strong className="block">مجوز پرداخت مدیریت صادر شده است:</strong>
                      <span className="text-sm text-emerald-800">{formatText(stmt.managementApprovalNote)}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-900 bg-white px-2 py-1 rounded border border-emerald-200">
                      {formatText(stmt.managementApprovalDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => onSelectStatement(stmt)}
                      className="text-sm font-bold text-slate-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>مشاهده جزئیات</span>
                    </button>

                    <button
                      onClick={() => onPayStatement(stmt)}
                      className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>ثبت پرداخت و صدور اتوماتیک سند هزینه پروژه</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Reject/Revision */}
      {selectedStatementForAction && actionType === 'reject' && (
        <Dialog
          onClose={() => {
            setSelectedStatementForAction(null);
            setActionType(null);
          }}
          label="برگشت صورت‌وضعیت جهت اصلاح"
          overlayClassName="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
        >
            <h4 className="text-base font-bold text-slate-900">برگشت صورت‌وضعیت جهت اصلاح</h4>
            <p className="text-xs text-slate-500">
              لطفاً علت عدم تأیید یا مغایرت‌های متره را جهت اطلاع پیمانکار جزء ثبت نمایید:
            </p>

            <textarea
              rows={3}
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              placeholder="مثال: مقادیر جوشکاری طبقه سوم با نقشه مغایرت دارد..."
              className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedStatementForAction(null);
                  setActionType(null);
                }}
                className="px-3 py-2 rounded-lg text-slate-600 text-sm font-medium cursor-pointer"
              >
                انصراف
              </button>

              <button
                onClick={handleExecuteAction}
                disabled={!actionComment.trim()}
                className="btn btn-danger"
              >
                ثبت و بازگشت به پیمانکار
              </button>
            </div>
        </Dialog>
      )}
    </div>
  );
};
