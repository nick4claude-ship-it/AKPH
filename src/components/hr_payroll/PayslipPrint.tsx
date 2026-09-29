/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Printer, X } from 'lucide-react';
import type { PayrollSlip } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { formatMoney } from '../../utils/money';
import { formatText } from '../../utils/formatters';
import { OfficialPrint, moneyHeader } from '../common/OfficialPrint';

/** «فیش حقوق» in the official print layout (letterhead and signatories from «تنظیمات گزارش و چاپ»). */
export const PayslipPrint: React.FC<{ slip: PayrollSlip; onClose: () => void }> = ({ slip, onClose }) => {
  const earnings: [string, number][] = [
    ['حقوق پایه', slip.baseSalaryGross],
    ['حق مسکن', slip.housingAllowance],
    ['بن خواربار', slip.foodAllowance],
    ['حق اولاد', slip.childAllowance],
    ['حق تخصص', slip.specialSkillAllowance],
    ['اضافه‌کار', slip.overtimePay],
  ];
  const deductions: [string, number][] = [
    ['بیمه سهم کارگر', slip.workerInsuranceDeduction],
    ['مالیات حقوق', slip.incomeTaxDeduction],
    ['مساعده / اقساط وام', slip.loanDeduction],
  ];
  return (
    <Dialog onClose={onClose} label={`چاپ فیش حقوق ${slip.employeeName}`} overlayClassName="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto" className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between no-print">
        <span className="text-sm font-bold text-slate-800">پیش‌نمایش چاپ رسمی فیش حقوق</span>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="btn btn-primary">
            <Printer className="w-4 h-4" />
            <span>چاپ / ذخیره PDF</span>
          </button>
          <button onClick={onClose} aria-label="بستن" className="p-2 rounded-lg text-slate-500 hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-4 sm:p-6 overflow-y-auto">
        <OfficialPrint
          reportType="payroll"
          title="فیش حقوق و دستمزد"
          number={slip.slipNumber}
          money
          filters={[
            { label: 'دوره', value: slip.monthYear },
            { label: 'نام', value: slip.employeeName },
            { label: 'کد پرسنلی', value: slip.personnelCode },
            { label: 'سمت', value: slip.role },
            { label: 'پروژه', value: slip.projectName },
            { label: 'کارکرد', value: `${slip.actualWorkDays} روز` },
            { label: 'اضافه‌کار', value: `${slip.overtimeHours} ساعت` },
          ]}
        >
          <table className="mb-4">
            <thead>
              <tr>
                <th>مزایا</th>
                <th>{moneyHeader('مبلغ')}</th>
                <th>کسورات</th>
                <th>{moneyHeader('مبلغ')}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {earnings.map(([label, amount], i) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{formatMoney(amount, false)}</td>
                  <td>{deductions[i]?.[0] || ''}</td>
                  <td>{deductions[i] ? formatMoney(deductions[i][1], false) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td>جمع مزایا</td>
                <td>{formatMoney(slip.grossTotalSalary, false)}</td>
                <td>جمع کسورات</td>
                <td>{formatMoney(slip.totalDeductions, false)}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={3}>خالص پرداختی</td>
                <td>{formatMoney(slip.netPayableSalary, false)}</td>
              </tr>
            </tfoot>
          </table>
        </OfficialPrint>
      </div>
    </Dialog>
  );
};
