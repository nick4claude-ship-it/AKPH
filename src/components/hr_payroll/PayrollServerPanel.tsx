/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calculator, CheckCircle2, Plus, Save, Undo2, UserPlus } from 'lucide-react';
import type { Employee } from '../../types';
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import type { EmployeeInput, TimesheetInput } from '../../store/recordWorkflows';
import { MoneyInput, QuantityInput } from '../../ui/NumberInput';
import { useSession } from '../../store/session';
import { formatText } from '../../utils/formatters';
import {
  payrollPeriodDecidable,
  payrollPeriodEditable,
  payrollPeriodStatusLabel,
  payrollTimesheetRows,
} from '../../store/views/people';

const field = 'mt-1 w-full p-2 rounded border border-slate-300 bg-white';

interface PayrollServerPanelProps {
  monthYear: string;
  onSelectMonth: (monthYear: string) => void;
  onToast: (msg: string) => void;
}

/**
 * akph/v1 payroll month (0.8.0): open a period, enter the timesheets, calculate on the server, then the accountant's
 * and the senior manager's approvals (the final one posts the payroll entry and queues the payment requests).
 */
export const PayrollServerPanel: React.FC<PayrollServerPanelProps> = ({ monthYear, onSelectMonth, onToast }) => {
  const wf = useWorkflows();
  const state = useAppState();
  const fiscalYear = useSession().session.fiscalYear;
  const period = state.payrollPeriods.find((p) => p.monthYear === monthYear);
  const [year, setYear] = useState(fiscalYear);
  const [month, setMonth] = useState(1);
  const [edits, setEdits] = useState<Record<string, Partial<TimesheetInput>>>({});
  const [reason, setReason] = useState('');
  const rows = period ? payrollTimesheetRows(state, period) : [];
  const editable = Boolean(period && payrollPeriodEditable(period));
  const value = (employeeId: string, key: keyof Omit<TimesheetInput, 'employeeId'>, fallback: number) => edits[employeeId]?.[key] ?? fallback;
  const set = (employeeId: string, key: keyof Omit<TimesheetInput, 'employeeId'>, v: number) =>
    setEdits((prev) => ({ ...prev, [employeeId]: { ...prev[employeeId], [key]: v } }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block text-xs text-slate-600">
          سال
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={field}>
            {[fiscalYear - 1, fiscalYear, fiscalYear + 1].map((y) => (
              <option key={y} value={y}>
                {formatText(String(y))}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-600">
          ماه
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={field}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {formatText(String(m))}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => onToast(wf.createPayrollPeriod(year, month).message)} className="btn btn-secondary">
          <Plus className="w-4 h-4" />
          <span>گشودن دوره حقوق</span>
        </button>
        {period && (
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-bold mr-auto">
            {formatText(period.number)} · {payrollPeriodStatusLabel(period)}
          </span>
        )}
      </div>
      {!period && state.payrollPeriods.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {state.payrollPeriods.map((p) => (
            <button key={p.id} type="button" onClick={() => onSelectMonth(p.monthYear)} className="btn btn-secondary">
              {formatText(p.monthYear)}
            </button>
          ))}
        </div>
      )}
      {period?.rejectReason && <p className="text-xs text-rose-700">برگشت داده شد: {formatText(period.rejectReason)}</p>}

      {period && editable && (
        <div className="table-scroll">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="py-2 px-2">پرسنل</th>
                <th className="py-2 px-2">روز کارکرد</th>
                <th className="py-2 px-2">غیبت</th>
                <th className="py-2 px-2">اضافه‌کار (ساعت)</th>
                <th className="py-2 px-2">مأموریت (روز)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.employeeId}>
                  <td className="py-2 px-2 font-bold text-slate-800">{formatText(r.employeeName)}</td>
                  <td className="py-2 px-2">
                    <QuantityInput aria-label={`کارکرد ${r.employeeName}`} value={value(r.employeeId, 'workDays', r.workDays)} onValueChange={(v) => set(r.employeeId, 'workDays', v)} className="w-20 p-1 rounded border border-slate-300" />
                  </td>
                  <td className="py-2 px-2">
                    <QuantityInput aria-label={`غیبت ${r.employeeName}`} value={value(r.employeeId, 'absentDays', r.absentDays)} onValueChange={(v) => set(r.employeeId, 'absentDays', v)} className="w-20 p-1 rounded border border-slate-300" />
                  </td>
                  <td className="py-2 px-2">
                    <QuantityInput aria-label={`اضافه‌کار ${r.employeeName}`} value={value(r.employeeId, 'overtimeHours', r.overtimeHours)} onValueChange={(v) => set(r.employeeId, 'overtimeHours', v)} className="w-20 p-1 rounded border border-slate-300" />
                  </td>
                  <td className="py-2 px-2">
                    <QuantityInput aria-label={`مأموریت ${r.employeeName}`} value={value(r.employeeId, 'missionDays', r.missionDays)} onValueChange={(v) => set(r.employeeId, 'missionDays', v)} className="w-20 p-1 rounded border border-slate-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {period && (
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <>
              <button
                type="button"
                disabled={rows.length === 0}
                onClick={() => {
                  const sheets = rows.map((r) => ({
                    employeeId: r.employeeId,
                    workDays: value(r.employeeId, 'workDays', r.workDays),
                    absentDays: value(r.employeeId, 'absentDays', r.absentDays),
                    overtimeHours: value(r.employeeId, 'overtimeHours', r.overtimeHours),
                    missionDays: value(r.employeeId, 'missionDays', r.missionDays),
                  }));
                  onToast(wf.saveTimesheets(period.id, sheets).message);
                  setEdits({});
                }}
                className="btn btn-secondary disabled:opacity-40"
              >
                <Save className="w-4 h-4" />
                <span>ذخیره کارکرد</span>
              </button>
              <button type="button" onClick={() => onToast(wf.calculatePayroll(period.id).message)} className="btn btn-secondary">
                <Calculator className="w-4 h-4" />
                <span>محاسبه حقوق روی سرور</span>
              </button>
            </>
          )}
          {payrollPeriodDecidable(period) && (
            <>
              <button type="button" onClick={() => onToast(wf.decidePayrollPeriod(period.id, 'approve', '').message)} className="btn btn-primary">
                <CheckCircle2 className="w-4 h-4" />
                <span>تأیید {period.status === 'calculated' ? 'حسابدار' : 'مدیر ارشد و صدور سند'}</span>
              </button>
              <input aria-label="دلیل برگشت دوره حقوق" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل برگشت" className="p-2 rounded border border-slate-300 bg-white text-xs" />
              <button
                type="button"
                disabled={!reason.trim()}
                onClick={() => {
                  onToast(wf.decidePayrollPeriod(period.id, 'reject', reason).message);
                  setReason('');
                }}
                className="btn btn-secondary disabled:opacity-40"
              >
                <Undo2 className="w-4 h-4" />
                <span>برگشت به پیش‌نویس</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const CONTRACTS: Employee['contractType'][] = ['پیمانی تمام‌وقت', 'قراردادی موقت', 'ساعتی/مشاوره‌ای', 'کارگری روزمزد'];

const emptyEmployee = (): EmployeeInput => ({
  fullName: '',
  nationalId: '',
  insuranceNo: '',
  bankName: '',
  sheba: '',
  accountNumber: '',
  jobTitle: '',
  contractType: 'پیمانی تمام‌وقت',
  costCenterId: '',
  baseSalary: 0,
  housingAllowance: 0,
  foodAllowance: 0,
  childAllowance: 0,
  otherBenefits: 0,
  loanInstallment: 0,
  otherDeduction: 0,
  insured: true,
});

/** New employee (akph/v1): personal data stays with the accountant, senior manager and administrator. */
export const EmployeeCreateForm: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const wf = useWorkflows();
  const { costCenters } = useAppState();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<EmployeeInput>(emptyEmployee);
  const put = <K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) => setF((prev) => ({ ...prev, [k]: v }));
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        <UserPlus className="w-4 h-4" />
        <span>تعریف پرسنل جدید</span>
      </button>
    );
  }
  const text = (k: 'fullName' | 'nationalId' | 'insuranceNo' | 'bankName' | 'sheba' | 'accountNumber' | 'jobTitle', label: string) => (
    <label className="block text-xs text-slate-600">
      {label}
      <input value={f[k]} onChange={(e) => put(k, e.target.value)} className={field} />
    </label>
  );
  const money = (k: 'baseSalary' | 'housingAllowance' | 'foodAllowance' | 'childAllowance' | 'otherBenefits' | 'loanInstallment' | 'otherDeduction', label: string) => (
    <label className="block text-xs text-slate-600">
      {label}
      <MoneyInput value={f[k]} onValueChange={(v) => put(k, v)} className={field} />
    </label>
  );
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs text-sm space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {text('fullName', 'نام و نام خانوادگی')}
        {text('nationalId', 'کد ملی')}
        {text('jobTitle', 'سمت')}
        <label className="block text-xs text-slate-600">
          نوع قرارداد
          <select value={f.contractType} onChange={(e) => put('contractType', e.target.value as Employee['contractType'])} className={field}>
            {CONTRACTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-600">
          مرکز هزینه
          <select value={f.costCenterId} onChange={(e) => put('costCenterId', e.target.value)} className={field}>
            <option value="">— انتخاب مرکز هزینه —</option>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>
                {formatText(c.name)}
              </option>
            ))}
          </select>
        </label>
        {text('insuranceNo', 'شماره بیمه')}
        {text('bankName', 'بانک')}
        {text('sheba', 'شبا')}
        {text('accountNumber', 'شماره حساب')}
        {money('baseSalary', 'حقوق پایه ماهانه')}
        {money('housingAllowance', 'حق مسکن')}
        {money('foodAllowance', 'بن خواربار')}
        {money('childAllowance', 'حق اولاد')}
        {money('otherBenefits', 'سایر مزایا')}
        {money('loanInstallment', 'قسط وام')}
        {money('otherDeduction', 'سایر کسور')}
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input type="checkbox" checked={f.insured} onChange={(e) => put('insured', e.target.checked)} />
        مشمول بیمه تأمین اجتماعی
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          انصراف
        </button>
        <button
          type="button"
          disabled={!f.fullName.trim() || !f.costCenterId}
          onClick={() => {
            onToast(wf.createEmployee(f).message);
            setF(emptyEmployee());
            setOpen(false);
          }}
          className="btn btn-primary disabled:opacity-40"
        >
          ثبت پرسنل
        </button>
      </div>
    </div>
  );
};
