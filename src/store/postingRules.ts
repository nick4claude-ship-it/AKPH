/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccountNode, FinancialEvent, FinancialEventType, JournalEntryType, DeductionType } from '../types';

/**
 * جدول قواعد ثبت: هر نوع رویداد مالی به یک تابع قاعده نگاشت می‌شود که ردیف‌های سند دوبل را می‌سازد.
 * کد حساب‌ها فقط از کدینگ حسابداری (AccountNode.code) خوانده می‌شود؛ کد ناموجود خطا می‌دهد.
 */

export interface PostingRow {
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  subledgerCode?: string;
  subledgerName?: string;
  projectId?: string;
  projectName?: string;
  costCenterId?: string;
  costCenterName?: string;
}

export interface PostingRuleOutput {
  entryType: JournalEntryType;
  title: string;
  rows: PostingRow[];
}

export interface PostingContext {
  /** Resolves an account from the chart of accounts, throwing if the code does not exist. */
  account: (code: string) => AccountNode;
  counterpartyName: string;
  projectName?: string;
  costCenterName?: string;
  /** True when the event's cost center is a headquarters/overhead center (not a project site). */
  isOverheadCostCenter: (costCenterId?: string) => boolean;
  costCenterNameOf: (costCenterId?: string) => string | undefined;
  projectNameOf: (projectId?: string) => string | undefined;
}

export type PostingRule = (event: FinancialEvent, ctx: PostingContext) => PostingRuleOutput;

export interface DeductionLine {
  type: string;
  amount: number;
  title?: string;
}

/** Posting accounts, by role. Every code must exist in the chart of accounts. */
export const ACCOUNTS = {
  bank: '11101',
  cashDesk: '11102',
  pettyCash: '11103',
  receivables: '11201',
  loansToStaff: '11303',
  purchaseVat: '11304',
  advanceToSubcontractors: '11402',
  inventory: '11501',
  supplierPayables: '21101',
  subcontractorPayables: '21102',
  insurancePayable: '21201',
  taxAndVatPayable: '21202',
  grniClearing: '21401',
  salaryPayable: '21501',
  subRetention: '21601',
  subInsurance: '21602',
  subOtherDeductions: '21603',
  bankSuspense: '21701',
  contractRevenue: '41101',
  stocktakeGain: '41301',
  materialsCost: '51101',
  siteLaborCost: '51201',
  subcontractorCost: '51301',
  hqSalaryCost: '61101',
  bankFees: '62101',
  stocktakeLoss: '62401',
} as const;

/** کسورات صورت‌وضعیت کارفرما: هر نوع کسر در حساب اختصاصی خودش. */
export const CLIENT_DEDUCTION_ACCOUNTS: Record<DeductionType, string> = {
  advance_payment: '21301', // استهلاک پیش‌دریافت (کاهش بدهی)
  retention: '11301', // سپرده حسن انجام کار نزد کارفرما
  insurance: '11302', // سپرده بیمه ماده ۳۸ نزد کارفرما
  tax: '11305', // مالیات تکلیفی مکسوره توسط کارفرما
  materials: '11306', // کسورات مصالح تحویلی کارفرما
  vat: '11307', // ارزش افزوده مکسوره نزد کارفرما
  penalties: '62301', // جرائم تأخیر
  on_account: '21302', // علی‌الحساب‌های دریافتی قبلی
  other: '11308', // سایر کسورات
};

/** کسورات صورت‌وضعیت پیمانکار جزء. */
export const SUBCONTRACTOR_DEDUCTION_ACCOUNTS: Record<string, string> = {
  retention: '21601',
  insurance: '21602',
  tax: '21202',
  advance_payment: '11402',
  penalty: '21603',
  other: '21603',
};

/** حساب طرف بدهکار در پرداخت‌های خزانه بر اساس نوع بدهی. */
export const PAYABLE_ACCOUNTS: Record<string, string> = {
  supplier: '21101',
  subcontractor: '21102',
  payroll: '21501',
  insurance: '21201',
  tax: '21202',
  petty_cash: '11103',
  advance: '11401', // پیش‌پرداخت خرید
  general_expense: '612', // سایر هزینه‌های عمومی و ستادی بدون تعهد قبلی
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function row(
  ctx: PostingContext,
  code: string,
  description: string,
  debit: number,
  credit: number,
  extra: Partial<PostingRow> = {}
): PostingRow {
  const node = ctx.account(code);
  return { accountCode: node.code, accountName: node.title, description, debit, credit, ...extra };
}

function projectTags(event: FinancialEvent, ctx: PostingContext): Partial<PostingRow> {
  return {
    projectId: event.projectId || undefined,
    projectName: ctx.projectName,
    costCenterId: event.costCenterId || undefined,
    costCenterName: ctx.costCenterName,
  };
}

function partyTags(event: FinancialEvent, ctx: PostingContext): Partial<PostingRow> {
  return { subledgerCode: event.counterpartyId, subledgerName: ctx.counterpartyName };
}

function requireDetail<T>(event: FinancialEvent, key: string): T {
  const value = event.details?.[key];
  if (value === undefined || value === null) {
    throw new Error(`[PostingEngine] رویداد ${event.type} فاقد جزئیات الزامی «${key}» است.`);
  }
  return value as T;
}

export const POSTING_RULES: Record<FinancialEventType, PostingRule> = {
  // رسید انبار: بدهکار موجودی / بستانکار کالای دریافتی فاکتورنشده. هزینه پروژه تغییر نمی‌کند.
  GOODS_RECEIPT: (e, ctx) => ({
    entryType: 'انبارداری',
    title: `رسید انبار ${e.details?.docNumber || e.sourceId} از ${ctx.counterpartyName}`,
    rows: [
      row(ctx, ACCOUNTS.inventory, `ورود کالا به انبار طبق رسید ${e.details?.docNumber || e.sourceId}`, e.amount, 0, {
        ...projectTags(e, ctx),
        subledgerCode: e.details?.warehouseId,
        subledgerName: e.details?.warehouseName,
      }),
      row(ctx, ACCOUNTS.grniClearing, `کالای دریافتی فاکتورنشده - ${ctx.counterpartyName}`, 0, e.amount, {
        ...partyTags(e, ctx),
        projectId: e.projectId || undefined,
        projectName: ctx.projectName,
      }),
    ],
  }),

  // فاکتور خرید: بدهکار کالای دریافتی فاکتورنشده و ارزش‌افزوده / بستانکار پرداختنی تأمین‌کننده.
  VENDOR_INVOICE: (e, ctx) => {
    const subtotal = requireDetail<number>(e, 'subtotal');
    const vat = e.details?.vatAmount ?? 0;
    const ref = e.details?.docNumber || e.sourceId;
    const rows = [
      row(ctx, ACCOUNTS.grniClearing, `تسویه کالای دریافتی فاکتورنشده با فاکتور ${ref}`, subtotal, 0, {
        ...partyTags(e, ctx),
        projectId: e.projectId || undefined,
        projectName: ctx.projectName,
      }),
    ];
    if (vat > 0) {
      rows.push(row(ctx, ACCOUNTS.purchaseVat, `ارزش افزوده خرید فاکتور ${ref}`, vat, 0, partyTags(e, ctx)));
    }
    rows.push(
      row(ctx, ACCOUNTS.supplierPayables, `بستانکاری ${ctx.counterpartyName} بابت فاکتور ${ref}`, 0, subtotal + vat, {
        ...partyTags(e, ctx),
        projectId: e.projectId || undefined,
        projectName: ctx.projectName,
      })
    );
    return { entryType: 'خرید', title: `فاکتور خرید ${ref} - ${ctx.counterpartyName}`, rows };
  },

  // مصرف انبار: بدهکار بهای پروژه (مرکز هزینه) / بستانکار موجودی، به قیمت میانگین موزون.
  STORE_ISSUE: (e, ctx) => {
    const ref = e.details?.docNumber || e.sourceId;
    return {
      entryType: 'انبارداری',
      title: `حواله مصرف ${ref} - ${ctx.costCenterName || ctx.projectName || ''}`.trim(),
      rows: [
        row(ctx, ACCOUNTS.materialsCost, `مصرف مصالح طبق حواله ${ref} به بهای میانگین موزون`, e.amount, 0, projectTags(e, ctx)),
        row(ctx, ACCOUNTS.inventory, `خروج کالا از انبار طبق حواله ${ref}`, 0, e.amount, {
          ...projectTags(e, ctx),
          subledgerCode: e.details?.warehouseId,
          subledgerName: e.details?.warehouseName,
        }),
      ],
    };
  },

  // صورت‌وضعیت کارفرما پس از تأیید کارفرما: مطالبات + کسورات (هر کسر در حساب خودش) = درآمد + ارزش‌افزوده.
  CLIENT_STATEMENT_APPROVED: (e, ctx) => {
    const vat = e.details?.vatAmount ?? 0;
    const deductions = (e.details?.deductions ?? []) as DeductionLine[];
    const ref = e.details?.docNumber || e.sourceId;
    const totalDeductions = sum(deductions.map((d) => d.amount));
    const netReceivable = e.amount - totalDeductions;
    if (netReceivable < 0) {
      throw new Error(`[PostingEngine] جمع کسورات صورت‌وضعیت ${ref} از مبلغ ناخالص بیشتر است.`);
    }
    const rows = [
      row(ctx, ACCOUNTS.receivables, `خالص مطالبات صورت‌وضعیت ${ref}`, netReceivable, 0, {
        ...partyTags(e, ctx),
        ...projectTags(e, ctx),
      }),
    ];
    for (const d of deductions) {
      if (d.amount <= 0) continue;
      const code = CLIENT_DEDUCTION_ACCOUNTS[d.type as DeductionType];
      if (!code) throw new Error(`[PostingEngine] نوع کسر «${d.type}» حساب تعریف‌شده ندارد.`);
      rows.push(
        row(ctx, code, `${d.title || 'کسر'} صورت‌وضعیت ${ref}`, d.amount, 0, {
          ...partyTags(e, ctx),
          projectId: e.projectId || undefined,
          projectName: ctx.projectName,
        })
      );
    }
    rows.push(
      row(ctx, ACCOUNTS.contractRevenue, `درآمد کارکرد مصوب صورت‌وضعیت ${ref}`, 0, e.amount - vat, projectTags(e, ctx))
    );
    if (vat > 0) {
      rows.push(row(ctx, ACCOUNTS.taxAndVatPayable, `ارزش افزوده فروش صورت‌وضعیت ${ref}`, 0, vat, partyTags(e, ctx)));
    }
    return { entryType: 'صورت وضعیت', title: `شناسایی درآمد صورت‌وضعیت ${ref} - ${ctx.counterpartyName}`, rows };
  },

  // صورت‌وضعیت جزء پس از تأیید مدیرعامل: بدهکار بهای پروژه / بستانکار پرداختنی پیمانکار و کسورات.
  SUBCONTRACTOR_STATEMENT_APPROVED: (e, ctx) => {
    const deductions = (e.details?.deductions ?? []) as DeductionLine[];
    const ref = e.details?.docNumber || e.sourceId;
    const totalDeductions = sum(deductions.map((d) => d.amount));
    const netPayable = e.amount - totalDeductions;
    if (netPayable < 0) {
      throw new Error(`[PostingEngine] جمع کسورات صورت‌وضعیت ${ref} از مبلغ کارکرد بیشتر است.`);
    }
    const rows = [
      row(ctx, ACCOUNTS.subcontractorCost, `کارکرد تأییدشده ${ctx.counterpartyName} - ${ref}`, e.amount, 0, {
        ...partyTags(e, ctx),
        ...projectTags(e, ctx),
      }),
      row(ctx, ACCOUNTS.subcontractorPayables, `خالص قابل پرداخت به ${ctx.counterpartyName} - ${ref}`, 0, netPayable, {
        ...partyTags(e, ctx),
        projectId: e.projectId || undefined,
        projectName: ctx.projectName,
      }),
    ];
    for (const d of deductions) {
      if (d.amount <= 0) continue;
      const code = SUBCONTRACTOR_DEDUCTION_ACCOUNTS[d.type];
      if (!code) throw new Error(`[PostingEngine] نوع کسر «${d.type}» حساب تعریف‌شده ندارد.`);
      const extra: Partial<PostingRow> = { ...partyTags(e, ctx), projectId: e.projectId || undefined, projectName: ctx.projectName };
      rows.push(
        d.type === 'advance_payment'
          ? row(ctx, code, `استهلاک پیش‌پرداخت ${ctx.counterpartyName} - ${ref}`, 0, d.amount, extra)
          : row(ctx, code, `${d.title || 'کسر'} ${ctx.counterpartyName} - ${ref}`, 0, d.amount, extra)
      );
    }
    return { entryType: 'صورت وضعیت', title: `تأیید صورت‌وضعیت پیمانکار جزء ${ref} - ${ctx.counterpartyName}`, rows };
  },

  // حقوق پس از تأیید: بدهکار هزینه حقوق هر مرکز هزینه / بستانکار حقوق پرداختنی، بیمه، مالیات و مساعده.
  PAYROLL_APPROVED: (e, ctx) => {
    const lines = requireDetail<Array<{ projectId?: string; costCenterId: string; amount: number }>>(e, 'lines');
    const credits = requireDetail<{ netSalary: number; insurance: number; tax: number; loans?: number }>(e, 'credits');
    const period = e.details?.period || e.sourceId;
    const rows: PostingRow[] = lines
      .filter((l) => l.amount > 0)
      .map((l) => {
        const overhead = ctx.isOverheadCostCenter(l.costCenterId);
        return row(
          ctx,
          overhead ? ACCOUNTS.hqSalaryCost : ACCOUNTS.siteLaborCost,
          `هزینه حقوق و سهم بیمه کارفرما دوره ${period} - ${ctx.costCenterNameOf(l.costCenterId) || l.costCenterId}`,
          l.amount,
          0,
          {
            projectId: overhead ? undefined : l.projectId,
            projectName: overhead ? undefined : ctx.projectNameOf(l.projectId),
            costCenterId: l.costCenterId,
            costCenterName: ctx.costCenterNameOf(l.costCenterId),
          }
        );
      });
    rows.push(row(ctx, ACCOUNTS.salaryPayable, `خالص حقوق پرداختنی دوره ${period}`, 0, credits.netSalary));
    if (credits.insurance > 0) {
      rows.push(row(ctx, ACCOUNTS.insurancePayable, `بیمه سهم کارگر و کارفرما دوره ${period}`, 0, credits.insurance));
    }
    if (credits.tax > 0) {
      rows.push(row(ctx, ACCOUNTS.taxAndVatPayable, `مالیات حقوق دوره ${period}`, 0, credits.tax));
    }
    if ((credits.loans ?? 0) > 0) {
      rows.push(row(ctx, ACCOUNTS.loansToStaff, `کسر اقساط مساعده پرسنل دوره ${period}`, 0, credits.loans!));
    }
    return { entryType: 'حقوق و دستمزد', title: `سند حقوق و دستمزد دوره ${period}`, rows };
  },

  // هزینه تنخواه پس از تأیید مالی: بدهکار هزینه پروژه / بستانکار وجه همان صندوق تنخواه.
  PETTY_CASH_EXPENSE_APPROVED: (e, ctx) => {
    const pettyCashId = requireDetail<string>(e, 'pettyCashId');
    const requested: string | undefined = e.details?.expenseAccountCode;
    let expenseCode: string = ACCOUNTS.materialsCost;
    if (requested && /^[56]/.test(requested)) {
      ctx.account(requested);
      expenseCode = requested;
    }
    const ref = e.details?.docNumber || e.sourceId;
    return {
      entryType: 'تنخواه',
      title: `هزینه تنخواه ${ref} - ${e.details?.pettyCashTitle || ''}`.trim(),
      rows: [
        row(ctx, expenseCode, `${e.details?.description || 'هزینه تنخواه'} (${ref})`, e.amount, 0, {
          ...projectTags(e, ctx),
          subledgerCode: e.counterpartyId,
          subledgerName: ctx.counterpartyName,
        }),
        row(ctx, ACCOUNTS.pettyCash, `کسر از تنخواه ${e.details?.pettyCashTitle || pettyCashId} بابت ${ref}`, 0, e.amount, {
          subledgerCode: pettyCashId,
          subledgerName: e.details?.pettyCashTitle,
          projectId: e.projectId || undefined,
          projectName: ctx.projectName,
        }),
      ],
    };
  },

  // شارژ تنخواه از بانک: بدهکار تنخواه / بستانکار بانک.
  PETTY_CASH_REPLENISHMENT: (e, ctx) => {
    const pettyCashId = requireDetail<string>(e, 'pettyCashId');
    const bankAccountId = requireDetail<string>(e, 'bankAccountId');
    return {
      entryType: 'پرداخت',
      title: `شارژ تنخواه ${e.details?.pettyCashTitle || pettyCashId}`,
      rows: [
        row(ctx, ACCOUNTS.pettyCash, `واریز شارژ تنخواه طبق حواله ${e.details?.trackingNumber || e.sourceId}`, e.amount, 0, {
          subledgerCode: pettyCashId,
          subledgerName: e.details?.pettyCashTitle,
          projectId: e.projectId || undefined,
          projectName: ctx.projectName,
        }),
        row(ctx, ACCOUNTS.bank, `برداشت بابت شارژ تنخواه ${e.details?.pettyCashTitle || pettyCashId}`, 0, e.amount, {
          subledgerCode: bankAccountId,
          subledgerName: e.details?.bankName,
        }),
      ],
    };
  },

  // پرداخت خزانه: بدهکار حساب پرداختنی / بستانکار بانک یا صندوق.
  TREASURY_PAYMENT: (e, ctx) => {
    const payableType = requireDetail<string>(e, 'payableType');
    const payableCode = PAYABLE_ACCOUNTS[payableType];
    if (!payableCode) throw new Error(`[PostingEngine] نوع بدهی «${payableType}» برای پرداخت تعریف نشده است.`);
    const fromCashDesk = Boolean(e.details?.cashDeskId);
    const sourceId: string = fromCashDesk ? e.details!.cashDeskId : requireDetail<string>(e, 'bankAccountId');
    const ref = e.details?.docNumber || e.sourceId;
    return {
      entryType: 'پرداخت',
      title: `پرداخت ${ref} به ${ctx.counterpartyName}`,
      rows: [
        row(ctx, payableCode, `تسویه بدهی ${ctx.counterpartyName} طبق ${ref}`, e.amount, 0, {
          ...(payableType === 'petty_cash'
            ? { subledgerCode: e.details?.pettyCashId, subledgerName: e.details?.pettyCashTitle }
            : partyTags(e, ctx)),
          projectId: e.projectId || undefined,
          projectName: ctx.projectName,
        }),
        row(ctx, fromCashDesk ? ACCOUNTS.cashDesk : ACCOUNTS.bank, `خروج وجه بابت ${ref}`, 0, e.amount, {
          subledgerCode: sourceId,
          subledgerName: e.details?.bankName,
        }),
      ],
    };
  },

  // دریافت خزانه: بدهکار بانک / بستانکار مطالبات.
  TREASURY_RECEIPT: (e, ctx) => {
    const bankAccountId = requireDetail<string>(e, 'bankAccountId');
    const ref = e.details?.docNumber || e.sourceId;
    return {
      entryType: 'دریافت',
      title: `دریافت ${ref} از ${ctx.counterpartyName}`,
      rows: [
        row(ctx, ACCOUNTS.bank, `واریز وجه از ${ctx.counterpartyName} طبق ${ref}`, e.amount, 0, {
          subledgerCode: bankAccountId,
          subledgerName: e.details?.bankName,
        }),
        row(ctx, ACCOUNTS.receivables, `کاهش مطالبات ${ctx.counterpartyName} بابت ${ref}`, 0, e.amount, {
          ...partyTags(e, ctx),
          projectId: e.projectId || undefined,
          projectName: ctx.projectName,
        }),
      ],
    };
  },

  // تعدیل انبارگردانی: کسری ← هزینه کسری / موجودی؛ اضافی ← موجودی / سایر درآمدها.
  STOCKTAKE_ADJUSTMENT: (e, ctx) => {
    const direction = requireDetail<'loss' | 'gain'>(e, 'direction');
    const ref = e.details?.docNumber || e.sourceId;
    const inv = { subledgerCode: e.details?.warehouseId, subledgerName: e.details?.warehouseName };
    return {
      entryType: 'انبارداری',
      title: `سند تعدیل انبارگردانی ${ref}`,
      rows:
        direction === 'loss'
          ? [
              row(ctx, ACCOUNTS.stocktakeLoss, `کسری انبارگردانی ${ref}`, e.amount, 0, projectTags(e, ctx)),
              row(ctx, ACCOUNTS.inventory, `کاهش موجودی بابت کسری ${ref}`, 0, e.amount, inv),
            ]
          : [
              row(ctx, ACCOUNTS.inventory, `افزایش موجودی بابت اضافات ${ref}`, e.amount, 0, inv),
              row(ctx, ACCOUNTS.stocktakeGain, `اضافات انبارگردانی ${ref}`, 0, e.amount, projectTags(e, ctx)),
            ],
    };
  },

  // مغایرت بانکی: واریز فاقد سند ← بانک / واریز نامشخص؛ برداشت فاقد سند ← کارمزد بانکی / بانک.
  BANK_RECONCILIATION_MATCH: (e, ctx) => {
    const bankAccountId = requireDetail<string>(e, 'bankAccountId');
    const direction = requireDetail<'واریز' | 'برداشت'>(e, 'direction');
    const desc = e.details?.description || e.sourceId;
    const bankTags = { subledgerCode: bankAccountId, subledgerName: e.details?.bankName };
    return direction === 'واریز'
      ? {
          entryType: 'دریافت',
          title: `سند رفع مغایرت بانکی: واریز فاقد سند دفتری`,
          rows: [
            row(ctx, ACCOUNTS.bank, `شناسایی واریز طبق صورت‌حساب بانک: ${desc}`, e.amount, 0, bankTags),
            row(ctx, ACCOUNTS.bankSuspense, `واریز نامشخص در انتظار تعیین تکلیف: ${desc}`, 0, e.amount),
          ],
        }
      : {
          entryType: 'پرداخت',
          title: `سند رفع مغایرت بانکی: برداشت فاقد سند دفتری`,
          rows: [
            row(ctx, ACCOUNTS.bankFees, `کارمزد/برداشت بانکی: ${desc}`, e.amount, 0),
            row(ctx, ACCOUNTS.bank, `برداشت طبق صورت‌حساب بانک: ${desc}`, 0, e.amount, bankTags),
          ],
        };
  },
};
