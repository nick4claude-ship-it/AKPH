/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState } from './types';
import { JournalEntry, KpiItem, Project } from '../types';
import { CLIENT_APPROVED_STATUSES } from './state';
import { formatInt } from '../utils/money';

/**
 * همه ارقام مالی از اسناد حسابداری و رویدادهای مالی محاسبه می‌شوند؛ هیچ مقدار ثابت یا پیش‌فرضی وجود ندارد.
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toLatinDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));

const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

/** Accounting period of a journal date, as a sortable 'YYYY/MM' key (null if unparseable). */
export function periodKey(date: string): string | null {
  const m = toLatinDigits(date || '').match(/^(\d{4})\/(\d{1,2})/);
  return m ? `${m[1]}/${m[2].padStart(2, '0')}` : null;
}

function shiftPeriod(key: string, months: number): string {
  const [y, m] = key.split('/').map(Number);
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}/${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Monthly sums of dated amounts for the last `months` periods, ending at the latest period with data. */
export function monthlyTotals(items: { date: string; amount: number }[], months = 5): { period: string; label: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const key = periodKey(it.date);
    if (key) map.set(key, (map.get(key) || 0) + it.amount);
  }
  const last = [...map.keys()].sort().pop();
  if (!last) return [];
  const out: { period: string; label: string; amount: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const period = shiftPeriod(last, -i);
    out.push({ period, label: MONTH_NAMES[Number(period.split('/')[1]) - 1], amount: map.get(period) || 0 });
  }
  return out;
}

/** Entries that affect the ledger (drafts, rejected and pending vouchers are excluded). */
export function postedEntries(state: AppState): JournalEntry[] {
  return state.journalEntries.filter((j) => j.status === 'ثبت قطعی' || j.status === 'تأیید شده' || j.status === 'برگشت خورده');
}

export interface Balances {
  revenue: number;
  cost: number;
  receivables: number;
  liabilities: number;
  cash: number;
}

const isRevenue = (code: string) => code.startsWith('4');
const isCost = (code: string) => code.startsWith('5') || code.startsWith('6');
const isProjectCost = (code: string) => code.startsWith('5');
const isReceivable = (code: string) => code.startsWith('112');
const isCurrentLiability = (code: string) => code.startsWith('21');
const isProjectLiability = (code: string) => ['211', '214', '216'].some((p) => code.startsWith(p));
const isCash = (code: string) => code.startsWith('111');

function sumBalances(
  entries: JournalEntry[],
  filter: (row: JournalEntry['rows'][number]) => boolean,
  opts: { projectScope: boolean }
): Balances {
  const b: Balances = { revenue: 0, cost: 0, receivables: 0, liabilities: 0, cash: 0 };
  for (const entry of entries) {
    for (const row of entry.rows) {
      if (!filter(row)) continue;
      const code = row.accountCode;
      const dr = row.debit - row.credit;
      if (isRevenue(code)) b.revenue -= dr;
      if (opts.projectScope ? isProjectCost(code) : isCost(code)) b.cost += dr;
      if (isReceivable(code)) b.receivables += dr;
      if (opts.projectScope ? isProjectLiability(code) : isCurrentLiability(code)) b.liabilities -= dr;
      if (isCash(code)) b.cash += dr;
    }
  }
  return b;
}

export interface ProjectFinancials {
  recordedRevenue: number;
  actualCost: number;
  receivables: number;
  liabilities: number;
  profit: number;
  profitMargin: number;
}

/** درآمد، هزینه، مطالبات و بدهی یک پروژه از ردیف‌های اسناد حسابداری آن پروژه. */
export function selectProjectFinancials(state: AppState, projectId: string): ProjectFinancials {
  const b = sumBalances(postedEntries(state), (r) => r.projectId === projectId, { projectScope: true });
  const profit = b.revenue - b.cost;
  return {
    recordedRevenue: b.revenue,
    actualCost: b.cost,
    receivables: b.receivables,
    liabilities: b.liabilities,
    profit,
    profitMargin: b.revenue > 0 ? Math.round((profit / b.revenue) * 1000) / 10 : 0,
  };
}

/** Projects with financial fields derived from the ledger. */
export function selectProjects(state: AppState): Project[] {
  return state.projects.map((p) => {
    const f = selectProjectFinancials(state, p.id);
    return {
      ...p,
      recordedRevenue: f.recordedRevenue,
      cost: f.actualCost,
      actualCost: f.actualCost,
      directCost: f.actualCost,
      profit: f.profit,
      profitMargin: f.profitMargin,
      receivables: f.receivables,
      liabilities: f.liabilities,
      financialProgress: p.contractAmount > 0 ? Math.round((f.recordedRevenue / p.contractAmount) * 1000) / 10 : 0,
    };
  });
}

function changePercent(value: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((value - previous) / Math.abs(previous)) * 1000) / 10;
}

/** KPIهای داشبورد: مقدار جاری و مقدار پایان دوره قبل هر دو از دفاتر محاسبه می‌شوند. */
export function selectKpiItems(state: AppState, projectId: string = 'all'): KpiItem[] {
  const entries = postedEntries(state);
  const inScope = (r: JournalEntry['rows'][number]) => projectId === 'all' || r.projectId === projectId;
  const keys = entries.map((e) => periodKey(e.date)).filter((k): k is string => Boolean(k)).sort();
  const latest = keys[keys.length - 1];
  const priorEntries = latest ? entries.filter((e) => (periodKey(e.date) || '') < latest) : [];

  const now = sumBalances(entries, inScope, { projectScope: projectId !== 'all' });
  const prev = sumBalances(priorEntries, inScope, { projectScope: projectId !== 'all' });
  const periodLabel = latest ? `نسبت به پایان ${MONTH_NAMES[Number(latest.split('/')[1]) - 1]} ماه قبل` : 'بدون دوره مقایسه';

  const grossProfit = now.revenue - now.cost;
  const prevProfit = prev.revenue - prev.cost;
  const margin = now.revenue > 0 ? Math.round((grossProfit / now.revenue) * 1000) / 10 : 0;
  const prevMargin = prev.revenue > 0 ? Math.round((prevProfit / prev.revenue) * 1000) / 10 : 0;

  const inFlight = state.clientStatements.filter(
    (s) =>
      (projectId === 'all' || s.projectId === projectId) &&
      !CLIENT_APPROVED_STATUSES.includes(s.status) &&
      s.status !== 'rejected' &&
      s.status !== 'draft'
  );
  const inFlightAmount = inFlight.reduce((a, s) => a + s.grossAmount, 0);

  // Cash is company-wide: bank, cash desks and petty cash funds as maintained by postings.
  const cashNow =
    state.bankAccounts.reduce((a, b) => a + b.balance, 0) +
    state.cashDesks.reduce((a, c) => a + c.balance, 0) +
    state.pettyCashAccounts.reduce((a, p) => a + p.actualBalance, 0);
  const latestCashMovement = latest
    ? sumBalances(entries.filter((e) => periodKey(e.date) === latest), () => true, { projectScope: false }).cash
    : 0;
  const cashPrev = cashNow - latestCashMovement;

  const kpi = (
    id: string,
    title: string,
    value: number,
    previousValue: number,
    rest: Pick<KpiItem, 'isPositiveGood' | 'unit' | 'icon' | 'color' | 'description'> & { changePeriod?: string }
  ): KpiItem => ({
    id,
    title,
    value,
    previousValue,
    changePercent: changePercent(value, previousValue),
    changePeriod: rest.changePeriod ?? periodLabel,
    ...rest,
  });

  return [
    kpi('kpi-1', 'کل درآمد کارکرد پروژه‌ها', now.revenue, prev.revenue, {
      isPositiveGood: true, unit: 'money', icon: 'TrendingUp', color: 'emerald',
      description: 'مجموع درآمد شناسایی‌شده در اسناد حسابداری از صورت‌وضعیت‌های تأییدشده کارفرما',
    }),
    kpi('kpi-2', 'بهای تمام‌شده و هزینه‌ها', now.cost, prev.cost, {
      isPositiveGood: false, unit: 'money', icon: 'Receipt', color: 'amber',
      description: 'مجموع مانده حساب‌های بهای تمام‌شده پروژه و هزینه‌های ستادی در دفاتر',
    }),
    kpi('kpi-3', 'سود ناخالص عملیاتی شرکت', grossProfit, prevProfit, {
      isPositiveGood: true, unit: 'money', icon: 'Coins', color: 'emerald',
      description: 'تفاضل درآمد و بهای تمام‌شده ثبت‌شده در دفاتر',
    }),
    kpi('kpi-4', 'حاشیه سود ناخالص میانگین', margin, prevMargin, {
      isPositiveGood: true, unit: 'درصد', icon: 'Percent', color: 'blue',
      description: 'نسبت سود ناخالص به درآمد شناسایی‌شده',
    }),
    kpi('kpi-5', 'مطالبات معوق و تجاری از کارفرما', now.receivables, prev.receivables, {
      isPositiveGood: false, unit: 'money', icon: 'Clock', color: 'amber',
      description: 'مانده حساب‌های دریافتنی تجاری در دفاتر',
    }),
    kpi('kpi-6', 'صورت‌وضعیت‌های در جریان', inFlightAmount, inFlightAmount, {
      isPositiveGood: true, unit: 'money', icon: 'FileSpreadsheet', color: 'purple',
      changePeriod: `${formatInt(inFlight.length)} فقره در کارتابل رسیدگی`,
      description: 'ارزش صورت‌وضعیت‌های ارسالی که هنوز به تأیید کارفرما نرسیده‌اند',
    }),
    kpi('kpi-7', 'کل موجودی نقد و بانک‌ها', cashNow, cashPrev, {
      isPositiveGood: true, unit: 'money', icon: 'Wallet', color: 'cyan',
      description: 'جمع موجودی حساب‌های بانکی، صندوق‌ها و تنخواه‌گردان‌ها',
    }),
    kpi('kpi-8', 'تعهدات و بدهی‌های جاری', now.liabilities, prev.liabilities, {
      isPositiveGood: false, unit: 'money', icon: 'CreditCard', color: 'rose',
      description: 'مانده بدهی‌های جاری به تأمین‌کنندگان، پیمانکاران، پرسنل و نهادها در دفاتر',
    }),
  ];
}

export interface MonthlyTrendPoint {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
}

/** روند ماهانه درآمد و هزینه از اسناد حسابداری (آخرین n ماه تا آخرین دوره دارای سند). */
export function selectMonthlyFinancialTrend(state: AppState, months = 7, projectId: string = 'all'): MonthlyTrendPoint[] {
  const entries = postedEntries(state);
  const keys = entries.map((e) => periodKey(e.date)).filter((k): k is string => Boolean(k)).sort();
  const latest = keys[keys.length - 1];
  if (!latest) return [];
  const buckets = new Map<string, { revenue: number; cost: number }>();
  for (let i = months - 1; i >= 0; i--) buckets.set(shiftPeriod(latest, -i), { revenue: 0, cost: 0 });
  for (const entry of entries) {
    const bucket = buckets.get(periodKey(entry.date) || '');
    if (!bucket) continue;
    for (const r of entry.rows) {
      if (projectId !== 'all' && r.projectId !== projectId) continue;
      if (isRevenue(r.accountCode)) bucket.revenue += r.credit - r.debit;
      if (isCost(r.accountCode)) bucket.cost += r.debit - r.credit;
    }
  }
  return [...buckets.entries()].map(([key, v]) => ({
    month: MONTH_NAMES[Number(key.split('/')[1]) - 1],
    revenue: v.revenue,
    cost: v.cost,
    profit: v.revenue - v.cost,
  }));
}

export interface ExpenseCategoryTotal {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  isDirect: boolean;
}

/** Presentation grouping of cost accounts (by account-code prefix from the chart of accounts). */
const EXPENSE_CATEGORIES: Array<{ name: string; prefixes: string[]; color: string; isDirect: boolean }> = [
  { name: 'مصالح پایه و ساختمانی', prefixes: ['511'], color: '#f59e0b', isDirect: true },
  { name: 'دستمزد و نیروی انسانی', prefixes: ['512'], color: '#3b82f6', isDirect: true },
  { name: 'پیمانکاران جزء و تخصصی', prefixes: ['513'], color: '#10b981', isDirect: true },
  { name: 'ماشین‌آلات و تجهیزات سنگین', prefixes: ['514'], color: '#8b5cf6', isDirect: true },
  { name: 'حمل‌ونقل و باربری', prefixes: ['515'], color: '#ec4899', isDirect: true },
  { name: 'سوخت و روانکارها', prefixes: ['516'], color: '#f97316', isDirect: true },
  { name: 'تعمیرات و نگهداری کارگاهی', prefixes: ['517'], color: '#64748b', isDirect: true },
  { name: 'سایر هزینه‌های مستقیم', prefixes: ['5'], color: '#94a3b8', isDirect: true },
  { name: 'حقوق و دستمزد ستاد مرکزی', prefixes: ['611'], color: '#06b6d4', isDirect: false },
  { name: 'اجاره و خدمات دفتر مرکزی', prefixes: ['612'], color: '#84cc16', isDirect: false },
  { name: 'مشاوره، حقوقی، مالی و سایر سربار', prefixes: ['6'], color: '#6366f1', isDirect: false },
];

export function selectExpenseCategoryTotals(state: AppState, projectId: string = 'all'): ExpenseCategoryTotal[] {
  const totals = EXPENSE_CATEGORIES.map(() => 0);
  for (const entry of postedEntries(state)) {
    for (const r of entry.rows) {
      if (!isCost(r.accountCode)) continue;
      if (projectId !== 'all' && r.projectId !== projectId) continue;
      // First matching category wins; the categories are ordered from specific to generic prefixes.
      const idx = EXPENSE_CATEGORIES.findIndex((c) => c.prefixes.some((p) => r.accountCode.startsWith(p)));
      if (idx >= 0) totals[idx] += r.debit - r.credit;
    }
  }
  const grand = totals.reduce((a, b) => a + Math.max(0, b), 0);
  return EXPENSE_CATEGORIES.map((c, i) => ({
    name: c.name,
    amount: Math.max(0, totals[i]),
    percentage: grand > 0 ? Math.round((Math.max(0, totals[i]) / grand) * 1000) / 10 : 0,
    color: c.color,
    isDirect: c.isDirect,
  })).filter((c) => c.amount > 0);
}



/** Project cost by ledger account (group 5 rows tagged with the project). */
export function selectProjectCostBreakdown(state: AppState, projectId: string): { accountCode: string; accountName: string; amount: number }[] {
  const map = new Map<string, { accountName: string; amount: number }>();
  for (const e of postedEntries(state)) {
    for (const r of e.rows) {
      if (r.projectId !== projectId || !isProjectCost(r.accountCode)) continue;
      const cur = map.get(r.accountCode) || { accountName: r.accountName, amount: 0 };
      map.set(r.accountCode, { accountName: cur.accountName, amount: cur.amount + r.debit - r.credit });
    }
  }
  return [...map].map(([accountCode, v]) => ({ accountCode, ...v })).filter((x) => x.amount !== 0).sort((a, b) => b.amount - a.amount);
}

/** Cash received and paid for a project, from cash-account rows of final entries tagged with the project. */
export function selectProjectCashFlow(state: AppState, projectId: string): { inflow: number; outflow: number; net: number } {
  let inflow = 0;
  let outflow = 0;
  for (const e of postedEntries(state)) {
    if (e.projectId !== projectId) continue;
    for (const r of e.rows) {
      if (!isCash(r.accountCode)) continue;
      inflow += r.debit;
      outflow += r.credit;
    }
  }
  return { inflow, outflow, net: inflow - outflow };
}

/** Company-wide ledger totals (all final entries). */
export function selectLedgerTotals(state: AppState): Balances {
  return sumBalances(postedEntries(state), () => true, { projectScope: false });
}

export interface CashFlowPoint {
  period: string;
  label: string;
  receipt: number;
  payment: number;
}

/** Cash in/out per month from the cash-account rows (bank, cash desks, petty cash) of final entries. */
export function selectCashFlowByMonth(state: AppState, months = 6): CashFlowPoint[] {
  const map = new Map<string, { receipt: number; payment: number }>();
  for (const e of postedEntries(state)) {
    const key = periodKey(e.date);
    if (!key) continue;
    for (const r of e.rows) {
      if (!isCash(r.accountCode)) continue;
      const cur = map.get(key) || { receipt: 0, payment: 0 };
      map.set(key, { receipt: cur.receipt + r.debit, payment: cur.payment + r.credit });
    }
  }
  const keys = [...map.keys()].sort();
  const last = keys[keys.length - 1];
  if (!last) return [];
  const out: CashFlowPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const period = shiftPeriod(last, -i);
    const month = Number(period.split('/')[1]);
    const v = map.get(period) || { receipt: 0, payment: 0 };
    out.push({ period, label: MONTH_NAMES[month - 1], ...v });
  }
  return out;
}
