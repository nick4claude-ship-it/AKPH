/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CompanyProfile, PrintSignature, ReportSettings, ReportType, ReportTypeInfo, SignatorySlot } from '../types';

/**
 * «تنظیمات گزارش و چاپ» and signature slots (akph/v1 /report-settings, /print/signatures; docs/API-CONTRACT.md).
 * Every portal user reads the settings to print; only the system administrator changes them.
 */

export interface ReportSettingsInput {
  company?: Partial<Pick<CompanyProfile, 'legalName' | 'nationalId' | 'registrationNumber' | 'economicCode' | 'address' | 'phone'>>;
  signatories?: Partial<Record<ReportType, SignatorySlot[]>>;
}

export interface ReportSettingsResult {
  message: string;
  settings: ReportSettings;
}

/** Signature slots of one record, from the server's approval history (then the configured extra slots). */
export interface RecordSignatures {
  number: string;
  slots: PrintSignature[];
}

export interface PrintApi {
  /** Demo sandbox: nothing is stored on a server. */
  readonly demo: boolean;
  settings(): Promise<ReportSettings>;
  save(input: ReportSettingsInput, version: number, key: string): Promise<ReportSettingsResult>;
  uploadLogo(image: Blob, fileName: string, version: number, key: string): Promise<ReportSettingsResult>;
  removeLogo(version: number, key: string): Promise<ReportSettingsResult>;
  /** Portal users a signature slot may name (system administrator). */
  users(): Promise<{ id: string; name: string; role: string }[]>;
  /** null: the data source keeps no approval history (demo: the record's own fields are used). */
  signatures(entityType: string, entityId: string): Promise<RecordSignatures | null>;
}

/** Same list and labels as Akph_Print::report_types() on the server. */
export const REPORT_TYPES: ReportTypeInfo[] = [
  { key: 'projects', label: 'گزارش پروژه‌ها', workflow: false },
  { key: 'management', label: 'گزارش مدیریتی و هوش تجاری', workflow: false },
  { key: 'financial', label: 'گزارش‌های مالی (ترازنامه، سود و زیان، تراز)', workflow: false },
  { key: 'journal_entry', label: 'سند حسابداری', workflow: true },
  { key: 'petty_cash', label: 'گزارش‌ها و صورتجلسه تنخواه', workflow: false },
  { key: 'petty_expense', label: 'هزینه تنخواه', workflow: true },
  { key: 'payment_request', label: 'درخواست پرداخت', workflow: true },
  { key: 'receipt', label: 'رسید دریافت', workflow: true },
  { key: 'contracts', label: 'گزارش قراردادها', workflow: false },
  { key: 'client_statement', label: 'صورت‌وضعیت کارفرما', workflow: true },
  { key: 'subcontractor_statement', label: 'صورت‌وضعیت پیمانکار جزء', workflow: true },
  { key: 'purchase_order', label: 'سفارش خرید', workflow: false },
  { key: 'inventory', label: 'اسناد و کاردکس انبار', workflow: false },
  { key: 'payroll', label: 'حقوق و دستمزد', workflow: false },
];

export const DEFAULT_SIGNATORY_TITLES = ['تهیه‌کننده', 'حسابدار', 'مدیر مالی', 'مدیرعامل'];

/** Default settings: the titles of the positions only, without any name (the server's defaults). */
export function defaultReportSettings(company: CompanyProfile): ReportSettings {
  const signatories: ReportSettings['signatories'] = {};
  for (const t of REPORT_TYPES) signatories[t.key] = t.workflow ? [] : DEFAULT_SIGNATORY_TITLES.map((title) => ({ title, userId: null, name: '' }));
  return { company, signatories, reportTypes: REPORT_TYPES, version: 1 };
}
