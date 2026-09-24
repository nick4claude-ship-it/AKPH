/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FinancialEvent,
  JournalEntry,
  JournalEntryRow,
  JournalEntryType,
  AccountNode,
} from '../types';
import { mockChartOfAccounts } from '../data/accountingMockData';
import { toPersianDate, toPersianTime, getCurrentFiscalYear } from '../utils/date';
import { generateUUID, getNextSequentialDocNumber } from '../utils/ids';
import { getCounterpartyName } from '../data/counterpartiesMockData';

/**
 * Recursively search the official Chart of Accounts by ASCII account code.
 * Ensures all posting rules strictly resolve codes through AccountNode.code.
 */
export function findAccountNode(code: string, tree: AccountNode[] = mockChartOfAccounts): AccountNode | null {
  for (const node of tree) {
    if (node.code === code) return node;
    if (node.children && node.children.length > 0) {
      const found = findAccountNode(code, node.children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Helper to safely fetch an account name or throw an error if account code is invalid.
 */
function getAccountOrThrow(code: string): { code: string; title: string } {
  const node = findAccountNode(code);
  if (!node) {
    throw new Error(`[PostingEngine] Invalid account code '${code}' not found in Chart of Accounts!`);
  }
  return { code: node.code, title: node.title };
}

export interface PostingRuleResult {
  entryType: JournalEntryType;
  title: string;
  rows: Array<{
    accountCode: string;
    description: string;
    debit: number;
    credit: number;
    subledgerCode?: string;
    subledgerName?: string;
    projectId?: string;
    projectName?: string;
    costCenterId?: string;
    costCenterName?: string;
  }>;
}

/**
 * Definitive Rule-Based Posting Engine mapping Financial Events to balanced Double-Entry Journal Entries.
 */
export function generatePostingRows(
  event: FinancialEvent,
  projectName?: string,
  costCenterName?: string
): PostingRuleResult {
  const counterpartyName = getCounterpartyName(event.counterpartyId) || 'نامشخص';
  const rows: PostingRuleResult['rows'] = [];
  let entryType: JournalEntryType = 'عمومی';
  let title = '';

  switch (event.type) {
    // 1. خرید کالای انباری - رسید انبار: موجودی انبار / کالای دریافتی فاکتورنشده (بدون هزینه پروژه)
    case 'GOODS_RECEIPT': {
      entryType = 'انبارداری';
      title = `رسید انبار شماره ${event.sourceId} - ثبت موقت موجودی انبار مصالح`;
      const invAcc = getAccountOrThrow('11501'); // موجودی انبار مصالح و اقلام پای کار
      const clearingAcc = getAccountOrThrow('21401'); // کالای دریافتی فاکتورنشده (حساب موقت انبار)

      rows.push({
        accountCode: invAcc.code,
        description: `ورود مصالح به انبار بابت رسید ${event.sourceId} از تأمین‌کننده ${counterpartyName}`,
        debit: event.amount,
        credit: 0,
        subledgerCode: event.counterpartyId,
        subledgerName: counterpartyName,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });

      rows.push({
        accountCode: clearingAcc.code,
        description: `بستانکاری موقت کالای دریافتی فاکتورنشده (رسید ${event.sourceId}) تا دریافت فاکتور رسمی`,
        debit: 0,
        credit: event.amount,
        subledgerCode: event.counterpartyId,
        subledgerName: counterpartyName,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });
      break;
    }

    // 2. خرید کالای انباری - فاکتور تأمین‌کننده: بستن حساب موقت انبار + ارزش‌افزوده / بستانکاران تجاری (بدون هزینه پروژه)
    case 'VENDOR_INVOICE': {
      entryType = 'خرید';
      title = `فاکتور خرید تأمین‌کننده ${counterpartyName} (عطف ${event.sourceId})`;
      const clearingAcc = getAccountOrThrow('21401'); // کالای دریافتی فاکتورنشده
      const vatAcc = getAccountOrThrow('11304'); // مالیات بر ارزش افزوده خرید (اعتبار مالیاتی)
      const payableAcc = getAccountOrThrow('21101'); // بستانکاران تأمین‌کننده مصالح

      const subtotal = event.details?.subtotal ?? event.amount;
      const vatAmount = event.details?.vatAmount ?? (event.amount - subtotal);
      const totalPayable = subtotal + vatAmount;

      rows.push({
        accountCode: clearingAcc.code,
        description: `تسویه حساب موقت انبار بابت فاکتور خرید ${event.sourceId}`,
        debit: subtotal,
        credit: 0,
        subledgerCode: event.counterpartyId,
        subledgerName: counterpartyName,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });

      if (vatAmount > 0) {
        rows.push({
          accountCode: vatAcc.code,
          description: `اعتبار مالیات بر ارزش افزوده خرید ۱۰٪ فاکتور ${event.sourceId}`,
          debit: vatAmount,
          credit: 0,
          subledgerCode: event.counterpartyId,
          subledgerName: counterpartyName,
        });
      }

      rows.push({
        accountCode: payableAcc.code,
        description: `بستانکاری تأمین‌کننده ${counterpartyName} بابت فاکتور خرید ${event.sourceId}`,
        debit: 0,
        credit: totalPayable,
        subledgerCode: event.counterpartyId,
        subledgerName: counterpartyName,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });
      break;
    }

    // 3. مصرف انبار: بدهکار بهای تمام‌شده پروژه (مرکز هزینه) / بستانکار موجودی انبار به میانگین موزون (افزایش هزینه پروژه)
    case 'STORE_ISSUE': {
      entryType = 'انبارداری';
      title = `حواله مصرف انبار ${event.sourceId} در مرکز هزینه ${costCenterName || event.costCenterId}`;
      const projectCostAcc = getAccountOrThrow('51101'); // هزینه مصالح مصرفی مستقیم در کارگاه‌ها
      const invAcc = getAccountOrThrow('11501'); // موجودی انبار مصالح

      rows.push({
        accountCode: projectCostAcc.code,
        description: `بهای تمام‌شده مستقیم مصرف مصالح حواله ${event.sourceId} در پروژه ${projectName || event.projectId}`,
        debit: event.amount,
        credit: 0,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });

      rows.push({
        accountCode: invAcc.code,
        description: `خروج مصالح از انبار به بهای میانگین موزون مصرفی حواله ${event.sourceId}`,
        debit: 0,
        credit: event.amount,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });
      break;
    }

    // 4. صورت‌وضعیت کارفرما پس از تأیید: بدهکار مطالبات و کسورات / بستانکار درآمد کارکرد و ارزش‌افزوده (متوازن)
    case 'CLIENT_STATEMENT_APPROVED': {
      entryType = 'فروش';
      title = `شناسایی درآمد و مطالبات صورت‌وضعیت کارفرما ${event.sourceId}`;
      const receivablesAcc = getAccountOrThrow('11201'); // مطالبات از کارفرمایان
      const retentionAcc = getAccountOrThrow('11301'); // سپرده حسن انجام کار نزد کارفرما
      const insuranceAcc = getAccountOrThrow('11302'); // سپرده بیمه ماده ۳۸
      const advanceAcc = getAccountOrThrow('21301'); // پیش‌دریافت کارفرما
      const revenueAcc = getAccountOrThrow('41101'); // درآمد کارکرد پیمانکاری
      const salesVatAcc = getAccountOrThrow('21202'); // مالیات بر ارزش افزوده فروش

      const grossAmount = event.details?.grossAmount ?? event.amount;
      const vatAmount = event.details?.vatAmount ?? 0;
      const retention = event.details?.retentionAmount ?? Math.round(grossAmount * 0.1);
      const insurance = event.details?.insuranceDeduction ?? Math.round(grossAmount * 0.05);
      const advanceAmort = event.details?.advanceAmortization ?? 0;
      const otherDeductions = event.details?.otherDeductions ?? 0;

      // Net approved receivables
      const netReceivable = (grossAmount + vatAmount) - (retention + insurance + advanceAmort + otherDeductions);

      rows.push({
        accountCode: receivablesAcc.code,
        description: `خالص مطالبات قابل وصول از کارفرما ${counterpartyName} صورت‌وضعیت ${event.sourceId}`,
        debit: netReceivable,
        credit: 0,
        subledgerCode: event.counterpartyId,
        subledgerName: counterpartyName,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });

      if (retention > 0) {
        rows.push({
          accountCode: retentionAcc.code,
          description: `کسر سپرده حسن انجام کار ۱۰٪ صورت‌وضعیت ${event.sourceId}`,
          debit: retention,
          credit: 0,
          subledgerCode: event.counterpartyId,
          subledgerName: counterpartyName,
          projectId: event.projectId,
          projectName,
        });
      }

      if (insurance > 0) {
        rows.push({
          accountCode: insuranceAcc.code,
          description: `کسر ودیعه بیمه ماده ۳۸ تأمین اجتماعی ۵٪ صورت‌وضعیت ${event.sourceId}`,
          debit: insurance,
          credit: 0,
          subledgerCode: event.counterpartyId,
          subledgerName: counterpartyName,
          projectId: event.projectId,
          projectName,
        });
      }

      if (advanceAmort > 0) {
        rows.push({
          accountCode: advanceAcc.code,
          description: `استهلاک اقساط پیش‌دریافت کارفرما صورت‌وضعیت ${event.sourceId}`,
          debit: advanceAmort,
          credit: 0,
          subledgerCode: event.counterpartyId,
          subledgerName: counterpartyName,
          projectId: event.projectId,
          projectName,
        });
      }

      if (otherDeductions > 0) {
        const otherAcc = getAccountOrThrow('11303');
        rows.push({
          accountCode: otherAcc.code,
          description: `سایر کسورات قانونی و کارگاهی صورت‌وضعیت ${event.sourceId}`,
          debit: otherDeductions,
          credit: 0,
          subledgerCode: event.counterpartyId,
          subledgerName: counterpartyName,
          projectId: event.projectId,
          projectName,
        });
      }

      rows.push({
        accountCode: revenueAcc.code,
        description: `شناسایی درآمد ناخالص کارکرد مصوب صورت‌وضعیت ${event.sourceId} پروژه ${projectName || event.projectId}`,
        debit: 0,
        credit: grossAmount,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });

      if (vatAmount > 0) {
        rows.push({
          accountCode: salesVatAcc.code,
          description: `مالیات بر ارزش افزوده فروش صورت‌وضعیت ${event.sourceId}`,
          debit: 0,
          credit: vatAmount,
          subledgerCode: event.counterpartyId,
          subledgerName: counterpartyName,
        });
      }
      break;
    }

    // 5. صورت‌وضعیت جزء پس از تأیید مدیرعامل: بدهکار بهای پروژه / بستانکار پرداختنی پیمانکار و کسورات
    case 'SUBCONTRACTOR_STATEMENT_APPROVED': {
      entryType = 'عمومی';
      title = `تأیید صورت‌وضعیت پیمانکار جزء ${counterpartyName} (عطف ${event.sourceId})`;
      const subCostAcc = getAccountOrThrow('51301'); // هزینه قراردادهای پیمانکاران جزء
      const subPayableAcc = getAccountOrThrow('21102'); // بستانکاران پیمانکاران جزء
      const subRetentionAcc = getAccountOrThrow('21601'); // سپرده حسن انجام کار مکسوره پیمانکاران
      const advanceAmortAcc = getAccountOrThrow('11402'); // پیش‌پرداخت به پیمانکاران جزء

      const grossAmount = event.details?.grossAmount ?? event.amount;
      const retention = event.details?.retentionAmount ?? Math.round(grossAmount * 0.1);
      const advanceAmort = event.details?.advanceAmortization ?? 0;
      const otherDeductions = event.details?.otherDeductions ?? 0;
      const netPayable = grossAmount - (retention + advanceAmort + otherDeductions);

      rows.push({
        accountCode: subCostAcc.code,
        description: `بهای تمام‌شده کارکرد تأییدشده پیمانکار جزء ${counterpartyName} در صورت‌وضعیت ${event.sourceId}`,
        debit: grossAmount,
        credit: 0,
        subledgerCode: event.counterpartyId,
        subledgerName: counterpartyName,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });

      rows.push({
        accountCode: subPayableAcc.code,
        description: `خالص بستانکاری قابل پرداخت به پیمانکار جزء ${counterpartyName} (عطف ${event.sourceId})`,
        debit: 0,
        credit: netPayable,
        subledgerCode: event.counterpartyId,
        subledgerName: counterpartyName,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });

      if (retention > 0) {
        rows.push({
          accountCode: subRetentionAcc.code,
          description: `کسر سپرده حسن انجام کار ۱۰٪ پیمانکار جزء ${counterpartyName}`,
          debit: 0,
          credit: retention,
          subledgerCode: event.counterpartyId,
          subledgerName: counterpartyName,
          projectId: event.projectId,
          projectName,
        });
      }

      if (advanceAmort > 0) {
        rows.push({
          accountCode: advanceAmortAcc.code,
          description: `استهلاک پیش‌پرداخت داده‌شده به پیمانکار جزء ${counterpartyName}`,
          debit: 0,
          credit: advanceAmort,
          subledgerCode: event.counterpartyId,
          subledgerName: counterpartyName,
          projectId: event.projectId,
          projectName,
        });
      }

      if (otherDeductions > 0) {
        const subInsAcc = getAccountOrThrow('21602');
        rows.push({
          accountCode: subInsAcc.code,
          description: `سایر کسورات و بیمه مکسوره پیمانکار جزء ${counterpartyName}`,
          debit: 0,
          credit: otherDeductions,
          subledgerCode: event.counterpartyId,
          subledgerName: counterpartyName,
        });
      }
      break;
    }

    // 6. حقوق و دستمزد پس از تأیید: بدهکار هزینه حقوق هر مرکز هزینه / بستانکار حقوق، بیمه و مالیات
    case 'PAYROLL_APPROVED': {
      entryType = 'حقوق و دستمزد';
      title = `سند حقوق و دستمزد ماهانه کارگاه/ستاد (عطف ${event.sourceId})`;
      const isHq = event.costCenterId === 'cc-hq' || !event.projectId;
      const salaryExpAcc = isHq ? getAccountOrThrow('61101') : getAccountOrThrow('51201');
      const salaryPayableAcc = getAccountOrThrow('21501'); // حقوق و مزایای پرداختنی
      const insurancePayableAcc = getAccountOrThrow('21201'); // بیمه پرداختنی
      const taxPayableAcc = getAccountOrThrow('21202'); // مالیات تکلیفی پرداختنی

      const grossSalary = event.details?.grossSalary ?? event.amount;
      const netSalary = event.details?.netSalary ?? Math.round(grossSalary * 0.77);
      const insurance = event.details?.insuranceAmount ?? Math.round(grossSalary * 0.16);
      const tax = event.details?.taxAmount ?? (grossSalary - (netSalary + insurance));

      rows.push({
        accountCode: salaryExpAcc.code,
        description: `هزینه ناخالص حقوق و دستمزد پرسنل در مرکز هزینه ${costCenterName || event.costCenterId}`,
        debit: grossSalary,
        credit: 0,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });

      rows.push({
        accountCode: salaryPayableAcc.code,
        description: `خالص حقوق و دستمزد پرداختنی به پرسنل (عطف ${event.sourceId})`,
        debit: 0,
        credit: netSalary,
        costCenterId: event.costCenterId,
      });

      rows.push({
        accountCode: insurancePayableAcc.code,
        description: `حق بیمه سهم کارگر و کارفرما پرداختنی به سازمان تأمین اجتماعی`,
        debit: 0,
        credit: insurance,
        costCenterId: event.costCenterId,
      });

      if (tax > 0) {
        rows.push({
          accountCode: taxPayableAcc.code,
          description: `مالیات تکلیفی مکسوره حقوق پرداختنی به اداره مالیات`,
          debit: 0,
          credit: tax,
          costCenterId: event.costCenterId,
        });
      }
      break;
    }

    // 7. هزینه تنخواه پس از تأیید مالی: بدهکار هزینه پروژه / بستانکار وجه صندوق/تنخواه
    case 'PETTY_CASH_EXPENSE_APPROVED': {
      entryType = 'تنخواه';
      title = `سند هزینه تنخواه کارگاهی شماره ${event.sourceId}`;
      const projectCostAcc = getAccountOrThrow('51101'); // هزینه مستقیم کارگاهی
      const pettyFundAcc = getAccountOrThrow('11103'); // تنخواه‌گردان‌های کارگاه‌ها

      rows.push({
        accountCode: projectCostAcc.code,
        description: `هزینه تنخواه مصوب ${event.sourceId} در مرکز هزینه ${costCenterName || event.costCenterId}`,
        debit: event.amount,
        credit: 0,
        subledgerCode: event.counterpartyId,
        subledgerName: counterpartyName,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });

      rows.push({
        accountCode: pettyFundAcc.code,
        description: `کاهش موجودی صندوق تنخواه بابت فاکتور مصوب ${event.sourceId}`,
        debit: 0,
        credit: event.amount,
        subledgerCode: event.counterpartyId,
        subledgerName: counterpartyName,
        projectId: event.projectId,
        projectName,
      });
      break;
    }

    // 8. پرداخت خزانه‌داری: بستانکار بانک در برابر بدهکار پرداختنی
    case 'TREASURY_PAYMENT': {
      entryType = 'پرداخت';
      title = `سند پرداخت بانکی حواله/چک ${event.sourceId} به ${counterpartyName}`;
      const bankAcc = getAccountOrThrow('11101'); // موجودی نزد بانک‌ها
      
      // Determine payable account based on counterparty kind / details
      let payableAcc = getAccountOrThrow('21101'); // تأمین‌کننده پیش‌فرض
      if (event.details?.payableType === 'subcontractor' || event.counterpartyId.startsWith('cp-sub')) {
        payableAcc = getAccountOrThrow('21102');
      } else if (event.details?.payableType === 'payroll' || event.counterpartyId.startsWith('cp-emp')) {
        payableAcc = getAccountOrThrow('21501');
      }

      rows.push({
        accountCode: payableAcc.code,
        description: `تسویه بدهی و پرداخت به ${counterpartyName} طبق دستور پرداخت ${event.sourceId}`,
        debit: event.amount,
        credit: 0,
        subledgerCode: event.counterpartyId,
        subledgerName: counterpartyName,
        projectId: event.projectId,
        projectName,
        costCenterId: event.costCenterId,
        costCenterName,
      });

      rows.push({
        accountCode: bankAcc.code,
        description: `خروج وجه از حساب بانکی بابت دستور پرداخت ${event.sourceId}`,
        debit: 0,
        credit: event.amount,
        subledgerCode: event.details?.bankAccountId || 'bank-1',
        subledgerName: event.details?.bankName || 'بانک تجارت / ملت',
      });
      break;
    }

    // 9. دریافت خزانه‌داری: بدهکار بانک در برابر بستانکار مطالبات
    case 'TREASURY_RECEIPT': {
      entryType = 'دریافت';
      title = `سند دریافت و واریز بانکی ${event.sourceId} از ${counterpartyName}`;
      const bankAcc = getAccountOrThrow('11101'); // موجودی نزد بانک‌ها
      const receivableAcc = getAccountOrThrow('11201'); // مطالبات از کارفرمایان

      rows.push({
        accountCode: bankAcc.code,
        description: `ورود وجه به حساب بانکی بابت وصول مطالبات کارفرما ${counterpartyName} (عطف ${event.sourceId})`,
        debit: event.amount,
        credit: 0,
        subledgerCode: event.details?.bankAccountId || 'bank-1',
        subledgerName: event.details?.bankName || 'بانک تجارت',
      });

      rows.push({
        accountCode: receivableAcc.code,
        description: `کاهش مانده مطالبات کارفرما ${counterpartyName} بابت واریزی ${event.sourceId}`,
        debit: 0,
        credit: event.amount,
        subledgerCode: event.counterpartyId,
        subledgerName: counterpartyName,
        projectId: event.projectId,
        projectName,
      });
      break;
    }

    // 10. مغایرت بانکی: رفع مغایرت واریز یا برداشت با وضعیت تطبیق
    case 'BANK_RECONCILIATION_MATCH': {
      const isDeposit = event.details?.type === 'واریز';
      const bankAcc = getAccountOrThrow('11101');
      if (isDeposit) {
        entryType = 'دریافت';
        title = `سند رفع مغایرت بانکی: واریز فاقد سند دفتری (${event.sourceId})`;
        const suspenseAcc = getAccountOrThrow('21101'); // بستانکاران متفرقه / معلق

        rows.push({
          accountCode: bankAcc.code,
          description: `ثبت ورود وجه واریزی بانکی نامشخص طبق صورت‌حساب بانک (عطف ${event.sourceId})`,
          debit: event.amount,
          credit: 0,
          subledgerCode: event.details?.bankAccountId || 'bank-1',
          subledgerName: 'بانک عامل',
        });

        rows.push({
          accountCode: suspenseAcc.code,
          description: `شناسایی بستانکاری موقت تا تعیین منشأ واریز بانکی ${event.sourceId}`,
          debit: 0,
          credit: event.amount,
          subledgerCode: event.counterpartyId,
          subledgerName: counterpartyName,
        });
      } else {
        entryType = 'پرداخت';
        title = `سند رفع مغایرت بانکی: کارمزد یا برداشت بانکی فاقد سند (${event.sourceId})`;
        const bankFeeAcc = getAccountOrThrow('62101'); // کارمزد خدمات بانکی

        rows.push({
          accountCode: bankFeeAcc.code,
          description: `هزینه کارمزد بانکی و خدمات الکترونیک تراکنش ${event.sourceId}`,
          debit: event.amount,
          credit: 0,
          costCenterId: 'cc-hq',
          costCenterName: 'ستاد مرکزی',
        });

        rows.push({
          accountCode: bankAcc.code,
          description: `برداشت کارمزد طبق صورت‌حساب رسمی بانک (عطف ${event.sourceId})`,
          debit: 0,
          credit: event.amount,
          subledgerCode: event.details?.bankAccountId || 'bank-1',
          subledgerName: 'بانک عامل',
        });
      }
      break;
    }

    default:
      throw new Error(`[PostingEngine] Unsupported financial event type: ${event.type}`);
  }

  return { entryType, title, rows };
}

/**
 * Creates a balanced JournalEntry from a FinancialEvent.
 * Strictly verifies that totalDebit === totalCredit and account codes are valid.
 */
export function buildJournalEntry(
  event: FinancialEvent,
  existingDocNumbers: string[],
  submitter: string = 'مدیر مالی',
  projectName?: string,
  costCenterName?: string
): { success: boolean; entry?: JournalEntry; error?: string } {
  try {
    const { entryType, title, rows: rawRows } = generatePostingRows(event, projectName, costCenterName);

    const docNumber = getNextSequentialDocNumber(
      existingDocNumbers,
      'ACC',
      4,
      getCurrentFiscalYear()
    );

    let totalDebit = 0;
    let totalCredit = 0;

    const rows: JournalEntryRow[] = rawRows.map((r) => {
      const node = findAccountNode(r.accountCode);
      const accountName = node ? node.title : 'حساب نامشخص';
      totalDebit += r.debit;
      totalCredit += r.credit;

      return {
        id: generateUUID(),
        accountCode: r.accountCode,
        accountName,
        subledgerCode: r.subledgerCode || '',
        subledgerName: r.subledgerName || '',
        description: r.description,
        debit: r.debit,
        credit: r.credit,
        projectId: r.projectId,
        projectName: r.projectName,
        costCenterId: r.costCenterId,
        costCenterName: r.costCenterName,
      };
    });

    // Check balance
    if (Math.abs(totalDebit - totalCredit) > 1) { // 1 Rial/Toman rounding tolerance
      return {
        success: false,
        error: `[PostingEngine] Unbalanced voucher for event ${event.type}: Total Debit (${totalDebit}) !== Total Credit (${totalCredit})`,
      };
    }

    const now = new Date();
    const entry: JournalEntry = {
      id: generateUUID(),
      docNumber,
      date: event.date || toPersianDate(now),
      title,
      type: entryType,
      projectId: event.projectId,
      projectName,
      costCenterId: event.costCenterId,
      costCenterName,
      submitter,
      status: 'ثبت قطعی',
      rows,
      totalDebit,
      totalCredit,
      isBalanced: true,
      history: [
        {
          date: toPersianDate(now),
          time: toPersianTime(now),
          user: submitter,
          action: `صدور خودکار سند حسابداری از رویداد مالی [${event.type}]`,
          note: `منبع: ${event.sourceModule} / شناسه: ${event.sourceId}`,
        },
      ],
    };

    return { success: true, entry };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
