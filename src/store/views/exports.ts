/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CSV exports. Amounts are written in the display currency (named in each header) as plain integers,
 * so Excel keeps them numeric. Screens call downloadTable(buildX(...)).
 */

import type { Contract, DetailedProgressStatement, Project } from '../../types';
import type { selectFinancialReports } from './accounting';
import type { CsvTable } from '../../utils/export';
import { moneyUnitLabel, toDisplayAmount } from '../../utils/money';
import { contractProgress } from './contracts';

const m = (rial: number) => toDisplayAmount(rial);

export function contractProgressCsv(contracts: readonly Contract[]): CsvTable {
  const unit = moneyUnitLabel();
  return {
    filename: 'گزارش_کارکرد_پیمان‌ها.csv',
    headers: ['کد پیمان', 'عنوان پروژه', 'کارفرما', `مبلغ پیمان (${unit})`, `کارکرد متره شده (${unit})`, 'درصد پیشرفت', `صورت‌وضعیت ارسالی (${unit})`, `وصولی (${unit})`],
    rows: contracts.map((c) => [
      c.code,
      c.projectTitle,
      c.employer,
      m(c.currentValue),
      m(c.executedValue),
      contractProgress(c).executedPercent.toFixed(1),
      m(c.billedValue),
      m(c.receivedValue),
    ]),
  };
}

export function clientStatementsCsv(statements: readonly DetailedProgressStatement[]): CsvTable {
  const unit = moneyUnitLabel();
  return {
    filename: 'گزارش_جامع_صورت‌وضعیت‌ها.csv',
    headers: ['شماره', 'پیمان', 'پروژه', 'دوره', `ناخالص (${unit})`, `کسورات (${unit})`, `خالص (${unit})`, `دریافتی (${unit})`, `مانده طلب (${unit})`, 'وضعیت'],
    rows: statements.map((s) => [
      s.statementNumber,
      s.contractCode,
      s.projectName,
      `${s.periodStartDate} تا ${s.periodEndDate}`,
      m(s.grossAmount),
      m(s.totalDeductions),
      m(s.netPayable),
      m(s.receivedAmount),
      m(s.remainingPayable),
      s.status,
    ]),
  };
}

export function clientReceivablesCsv(contracts: readonly Contract[]): CsvTable {
  const unit = moneyUnitLabel();
  return {
    filename: 'گزارش_مطالبات_کارفرمایان.csv',
    headers: ['پیمان', 'پروژه', 'کارفرما', `مانده طلب (${unit})`],
    rows: contracts.map((c) => [c.code, c.projectTitle, c.employer, m(c.receivableValue)]),
  };
}

/** BOQ lines of one client statement. */
export function clientStatementItemsCsv(statement: DetailedProgressStatement): CsvTable {
  const unit = moneyUnitLabel();
  return {
    filename: `${statement.statementNumber}_${statement.contractCode}.csv`,
    headers: ['ردیف', 'کد آیتم', 'شرح عملیات', 'واحد', 'مقدار قرارداد', 'مقدار قبلی', 'این دوره', 'تجمعی', `بهای واحد (${unit})`, `مبلغ این دوره (${unit})`, `مبلغ تجمعی (${unit})`],
    rows: statement.items.map((i) => [
      i.rowNumber,
      i.code,
      i.description,
      i.unit,
      i.contractQuantity,
      i.previousQuantity,
      i.currentQuantity,
      i.cumulativeQuantity,
      m(i.unitRate),
      m(i.currentAmount),
      m(i.cumulativeAmount),
    ]),
  };
}

export type FinancialReportKind = 'project_pnl' | 'trial_balance' | 'income_statement' | 'balance_sheet' | 'general_ledger';

/** The accounting report on screen as CSV (figures from selectFinancialReports). */
export function financialReportCsv(kind: FinancialReportKind, r: ReturnType<typeof selectFinancialReports>, project?: Project): CsvTable {
  const unit = moneyUnitLabel();
  switch (kind) {
    case 'project_pnl':
      return { filename: `project-pnl-${project?.code || ''}`, headers: ['کد حساب', 'حساب', `مبلغ (${unit})`], rows: r.breakdown.map((b) => [b.accountCode, b.accountName, m(b.amount)]) };
    case 'trial_balance':
      return {
        filename: 'trial-balance',
        headers: ['کد حساب', 'حساب', `گردش بدهکار (${unit})`, `گردش بستانکار (${unit})`, `مانده بدهکار (${unit})`, `مانده بستانکار (${unit})`],
        rows: r.trial.map((t) => [t.code, t.name, m(t.debit), m(t.credit), m(t.debitBalance), m(t.creditBalance)]),
      };
    case 'income_statement': {
      const i = r.incomeStatement;
      return {
        filename: 'income-statement',
        headers: ['شرح', `مبلغ (${unit})`],
        rows: [
          ['درآمدهای عملیاتی', m(i.revenue)],
          ['بهای تمام‌شده مستقیم', m(-i.directCost)],
          ['هزینه‌های عمومی و اداری', m(-i.overhead)],
          ['هزینه‌های مالی', m(-i.financialCost)],
          ['سود (زیان) خالص', m(i.profit)],
        ],
      };
    }
    case 'balance_sheet': {
      const b = r.balanceSheet;
      return {
        filename: 'balance-sheet',
        headers: ['شرح', `مبلغ (${unit})`],
        rows: [
          ['جمع دارایی‌ها', m(b.assets)],
          ['جمع بدهی‌ها', m(b.liabilities)],
          ['حقوق صاحبان سهام', m(b.equity)],
          ['سود (زیان) دوره بسته‌نشده', m(b.netProfit)],
        ],
      };
    }
    case 'general_ledger':
      return {
        filename: 'journal',
        headers: ['شماره سند', 'تاریخ', 'نوع', 'شرح', 'کد حساب', 'حساب', `بدهکار (${unit})`, `بستانکار (${unit})`],
        rows: r.finals.flatMap((j) => j.rows.map((row) => [j.docNumber, j.date, j.type, j.title, row.accountCode, row.accountName, m(row.debit), m(row.credit)])),
      };
  }
}
