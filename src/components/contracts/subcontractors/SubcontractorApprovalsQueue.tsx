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
import { usePermission } from '../../../store/session';
import { SUBCONTRACTOR_STATEMENT_FLOW, creatorOf } from '../../../store/workflows';
import { Dialog } from '../../common/Dialog';

interface SubcontractorApprovalsQueueProps {
  statements: SubcontractorProgressStatement[];
  currentUser: UserProfile;
  onSelectStatement: (statement: SubcontractorProgressStatement) => void;
  onUpdateStatus: (
    statementId: string,
    newStatus: SubcontractorStatementWorkflowStatus,
    comment?: string,
    verifiedAmount?: number
  ) => void;
  onPayStatement: (statement: SubcontractorProgressStatement) => void;
}

export const SubcontractorApprovalsQueue: React.FC<SubcontractorApprovalsQueueProps> = ({
  statements,
  currentUser,
  onSelectStatement,
  onUpdateStatus,
  onPayStatement,
}) => {
  const [activeStage, setActiveStage] = useState<'site' | 'pm' | 'management' | 'payment'>('site');
  const [actionComment, setActionComment] = useState('');
  const [selectedStatementForAction, setSelectedStatementForAction] = useState<SubcontractorProgressStatement | null>(
    null
  );
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const { check } = usePermission();
  // The workflow re-checks on submit; the buttons only reflect the same rules (role, project, no self-approval).
  const stepPermission = (s: SubcontractorProgressStatement) => {
    const step = SUBCONTRACTOR_STATEMENT_FLOW[s.status];
    return step ? check(step.action, { projectId: s.projectId, createdBy: creatorOf(s.workflowHistory) }) : { ok: false, reason: 'مرحله تأیید باز نیست.' };
  };
  const canReturn = (s: SubcontractorProgressStatement) => check('sub_statement.return', { projectId: s.projectId }).ok;

  // Categorize statements by workflow stage
  // Site stage: work recorded → measurement → site approval.
  const siteReviewQueue = statements.filter((s) => s.status === 'submitted' || s.status === 'measured');
  // PM stage: site-approved statements.
  const pmReviewQueue = statements.filter((s) => s.status === 'site_review');
  // Management stage: financial approval then CEO approval.
  const pmApprovedQueue = statements.filter((s) => s.status === 'pm_approved' || s.status === 'finance_approved');
  const managementApprovedQueue = statements.filter(
    (s) => s.status === 'management_approved' && s.remainingPayable > 0
  );
  const paidQueue = statements.filter((s) => s.status === 'paid');

  const handleExecuteAction = () => {
    if (!selectedStatementForAction || !actionType) return;

    if (actionType === 'approve') {
      if (activeStage === 'site') {
        onUpdateStatus(selectedStatementForAction.id, 'site_review', actionComment || 'احجام در کارگاه بررسی شد');
      } else if (activeStage === 'pm') {
        onUpdateStatus(selectedStatementForAction.id, 'pm_approved', actionComment || 'تایید مدیر پروژه صادر شد');
      } else if (activeStage === 'management') {
        onUpdateStatus(
          selectedStatementForAction.id,
          'management_approved',
          actionComment || 'تایید مدیریت و مجوز پرداخت صادر شد'
        );
      }
    } else {
      if (!actionComment.trim()) return;
      onUpdateStatus(selectedStatementForAction.id, 'returned_for_revision', actionComment.trim());
    }

    setSelectedStatementForAction(null);
    setActionType(null);
    setActionComment('');
  };

  return (
    <div className="space-y-6">
      {/* Top Workflow Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900">کارتابل گردش کار و تاییدات پیمانکاران جزء</h3>
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
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
                ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-bold">
                <HardHat className="w-4 h-4" />
                ۱. بررسی کارگاه
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeStage === 'site' ? 'bg-slate-950 text-amber-400' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {siteReviewQueue.length}
              </span>
            </div>
            <p className={`text-[10px] ${activeStage === 'site' ? 'text-slate-900' : 'text-slate-500'}`}>
              کنترل متره و مقادیر کارگاهی
            </p>
          </button>

          <button
            onClick={() => setActiveStage('pm')}
            className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
              activeStage === 'pm'
                ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-bold">
                <UserCheck className="w-4 h-4" />
                ۲. تأیید مدیر پروژه
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeStage === 'pm' ? 'bg-slate-950 text-amber-400' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {siteReviewQueue.length}
              </span>
            </div>
            <p className={`text-[10px] ${activeStage === 'pm' ? 'text-slate-900' : 'text-slate-500'}`}>
              ارزیابی کیفیت و زمانبندی
            </p>
          </button>

          <button
            onClick={() => setActiveStage('management')}
            className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
              activeStage === 'management'
                ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4" />
                ۳. تأیید مدیریت / مالی
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeStage === 'management'
                    ? 'bg-slate-950 text-amber-400'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {pmApprovedQueue.length}
              </span>
            </div>
            <p className={`text-[10px] ${activeStage === 'management' ? 'text-slate-900' : 'text-slate-500'}`}>
              تأیید بودجه و دستور پرداخت
            </p>
          </button>

          <button
            onClick={() => setActiveStage('payment')}
            className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
              activeStage === 'payment'
                ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-bold">
                <DollarSign className="w-4 h-4" />
                ۴. پرداخت و ثبت هزینه
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeStage === 'payment' ? 'bg-slate-950 text-amber-400' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {managementApprovedQueue.length}
              </span>
            </div>
            <p className={`text-[10px] ${activeStage === 'payment' ? 'text-slate-900' : 'text-slate-500'}`}>
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
              <span>{siteReviewQueue.length} مورد</span>
            </div>

            {siteReviewQueue.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                موردی در انتظار بررسی کارگاه وجود ندارد.
              </div>
            ) : (
              siteReviewQueue.map((stmt) => (
                <div
                  key={stmt.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 hover:border-amber-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{stmt.statementNumber}</span>
                        <span className="text-xs font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded">
                          {stmt.tradeType}
                        </span>
                        <span className="text-xs text-slate-400">تاریخ ثبت: {stmt.submissionDate}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        پیمانکار: <strong className="text-slate-800">{stmt.subcontractorName}</strong> | پروژه:{' '}
                        <strong>{stmt.projectName}</strong>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs text-slate-400 block">ناخالص اعلامی:</span>
                      <span className="text-base font-black text-slate-900">
                        {formatMoneyCompact(stmt.grossAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Table of items inside statement */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-xs font-bold text-slate-700 block mb-2">آیتم‌های کاری این دوره:</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="text-slate-500 font-bold border-b border-slate-200">
                            <th className="pb-1.5">شرح عملیات</th>
                            <th className="pb-1.5 text-center">واحد</th>
                            <th className="pb-1.5 text-center">مقدار دوره</th>
                            <th className="pb-1.5 text-left">نرخ واحد</th>
                            <th className="pb-1.5 text-left">مبلغ ({moneyUnitLabel()})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stmt.items.map((item) => (
                            <tr key={item.id}>
                              <td className="py-1.5 text-slate-800 font-medium">{item.description}</td>
                              <td className="py-1.5 text-center text-slate-600">{item.unit}</td>
                              <td className="py-1.5 text-center font-bold text-slate-900">
                                {item.currentQuantity.toLocaleString('fa-IR')}
                              </td>
                              <td className="py-1.5 text-left text-slate-600">
                                {formatMoney(item.unitRate, false)}
                              </td>
                              <td className="py-1.5 text-left font-black text-slate-900">
                                {formatMoneyCompact(item.currentAmount)}
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
                      className="text-xs font-bold text-slate-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
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
                        className="disabled:opacity-40 px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>برگشت جهت اصلاح</span>
                      </button>

                      <button
                        disabled={!stepPermission(stmt).ok}
                        title={stepPermission(stmt).reason}
                        onClick={() => {
                          onUpdateStatus(
                            stmt.id,
                            'site_review',
                            'احجام و متره میدانی توسط سرپرست کارگاه کنترل و تایید شد.'
                          );
                        }}
                        className="disabled:opacity-40 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
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
              <span>{siteReviewQueue.length} مورد</span>
            </div>

            {siteReviewQueue.map((stmt) => (
              <div
                key={stmt.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 hover:border-indigo-300 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{stmt.statementNumber}</span>
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded">
                        {stmt.tradeType}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      پیمانکار: <strong className="text-slate-800">{stmt.subcontractorName}</strong> | پروژه:{' '}
                      <strong>{stmt.projectName}</strong>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-xs text-slate-400 block">مبلغ مصوب کارگاه:</span>
                    <span className="text-base font-black text-indigo-700">
                      {formatMoneyCompact(stmt.siteVerifiedAmount)}
                    </span>
                  </div>
                </div>

                {stmt.siteReviewNote && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900">
                    <strong className="block mb-1">نظر سرپرست کارگاه ({stmt.siteReviewerName}):</strong>
                    {stmt.siteReviewNote}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => onSelectStatement(stmt)}
                    className="text-xs font-bold text-slate-700 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>بررسی ریز متره</span>
                  </button>

                  <button
                    disabled={!stepPermission(stmt).ok}
                    title={stepPermission(stmt).reason}
                    onClick={() => {
                      onUpdateStatus(
                        stmt.id,
                        'pm_approved',
                        'انطباق با برنامه زمانبندی و کیفیت فنی کار مورد تأیید مدیر پروژه است.'
                      );
                    }}
                    className="disabled:opacity-40 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
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
              <span>{pmApprovedQueue.length} مورد</span>
            </div>

            {pmApprovedQueue.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                موردی در انتظار تأیید مدیریت وجود ندارد.
              </div>
            ) : (
              pmApprovedQueue.map((stmt) => (
                <div
                  key={stmt.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 hover:border-purple-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{stmt.statementNumber}</span>
                        <span className="text-xs font-bold bg-purple-50 text-purple-800 px-2 py-0.5 rounded">
                          {stmt.tradeType}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        پیمانکار: <strong className="text-slate-800">{stmt.subcontractorName}</strong> | پروژه:{' '}
                        <strong>{stmt.projectName}</strong>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs text-slate-400 block">خالص پرداختنی:</span>
                      <span className="text-lg font-black text-purple-700">
                        {formatMoneyCompact(stmt.netPayable)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block mb-1">تفکیک کسورات:</span>
                      <div>سپرده حسن انجام کار: {formatMoneyCompact(stmt.deductions.retention)}</div>
                      <div>استهلاک پیش‌پرداخت: {formatMoneyCompact(stmt.deductions.advancePaymentDeduction)}</div>
                    </div>

                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 text-indigo-950">
                      <span className="font-bold block mb-1">تأییدیه مدیر پروژه ({stmt.pmApproverName}):</span>
                      <p className="text-[11px]">{stmt.pmApprovalNote || 'کیفیت و احجام مورد تایید است.'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => onSelectStatement(stmt)}
                      className="text-xs font-bold text-slate-700 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>مشاهده جزئیات کامل</span>
                    </button>

                    <button
                      disabled={!stepPermission(stmt).ok}
                      title={stepPermission(stmt).reason}
                      onClick={() => {
                        onUpdateStatus(
                          stmt.id,
                          'management_approved',
                          'تأیید مدیریت و صدور مجوز پرداخت توسط مدیریت شرکت صادر شد.'
                        );
                      }}
                      className="disabled:opacity-40 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
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
              <span>{managementApprovedQueue.length} مورد</span>
            </div>

            {managementApprovedQueue.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                موردی در انتظار پرداخت وجود ندارد.
              </div>
            ) : (
              managementApprovedQueue.map((stmt) => (
                <div
                  key={stmt.id}
                  className="bg-white p-5 rounded-2xl border border-rose-200 shadow-2xs space-y-4 hover:shadow-xs transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{stmt.statementNumber}</span>
                        <span className="text-xs font-bold bg-rose-50 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                          بدهی فوری
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        پیمانکار: <strong className="text-slate-800">{stmt.subcontractorName}</strong> | پروژه:{' '}
                        <strong>{stmt.projectName}</strong>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs text-slate-400 block">مانده قابل پرداخت:</span>
                      <span className="text-xl font-black text-rose-700">
                        {formatMoneyCompact(stmt.remainingPayable)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
                    <div>
                      <strong className="block">مجوز پرداخت مدیریت صادر شده است:</strong>
                      <span className="text-[11px] text-emerald-800">{stmt.managementApprovalNote}</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-900 bg-white px-2 py-1 rounded border border-emerald-200">
                      {stmt.managementApprovalDate}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => onSelectStatement(stmt)}
                      className="text-xs font-bold text-slate-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>مشاهده جزئیات</span>
                    </button>

                    <button
                      onClick={() => onPayStatement(stmt)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
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
          className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
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
              className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedStatementForAction(null);
                  setActionType(null);
                }}
                className="px-3 py-1.5 rounded-lg text-slate-600 text-xs font-medium cursor-pointer"
              >
                انصراف
              </button>

              <button
                onClick={handleExecuteAction}
                disabled={!actionComment.trim()}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer disabled:opacity-40"
              >
                ثبت و بازگشت به پیمانکار
              </button>
            </div>
        </Dialog>
      )}
    </div>
  );
};
