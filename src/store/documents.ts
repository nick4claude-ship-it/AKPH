/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppDocument, DocumentCategory, DocumentEntityType, DocumentLink } from '../types';

/**
 * Document center rules shared by the app and the server mapping: the kinds of document and of linked record
 * (the server's names: wordpress-plugin/akph-portal/includes/class-akph-documents.php), the files that may be
 * uploaded, and which documents are attachments of a record.
 */

/** App category ↔ server doc_type (one to one). */
export const DOC_TYPE_OF: Record<DocumentCategory, string> = {
  'قرارداد اصلی کارفرما': 'client_contract',
  'قرارداد پیمانکار جزء': 'subcontract',
  'الحاقیه قرارداد': 'amendment',
  'صورت‌وضعیت کارفرما': 'client_statement',
  'صورت‌وضعیت پیمانکار جزء': 'subcontractor_statement',
  'فایل متره و اندازه‌گیری': 'measurement',
  'فاکتور خرید تأمین‌کننده': 'supplier_invoice',
  'فاکتور هزینه تنخواه': 'petty_invoice',
  'نامه و مکاتبات رسمی': 'letter',
  'صورتجلسه کارگاهی': 'minutes',
  'نقشه اجرایی و ازبیلت': 'drawing',
  'گزارش کنترل کیفیت و آزمایشگاه': 'qc_report',
  'ضمانت‌نامه بانکی': 'guarantee',
  'رسید و سند مالی': 'financial',
  'عکس و تصویر کارگاه': 'photo',
  'سایر اسناد': 'other',
};
export const CATEGORY_OF: Record<string, DocumentCategory> = Object.fromEntries(Object.entries(DOC_TYPE_OF).map(([c, t]) => [t, c as DocumentCategory]));
export const DOCUMENT_CATEGORIES = Object.keys(DOC_TYPE_OF) as DocumentCategory[];

/** Server entity types (the list the server accepts). */
export type ServerEntityType = 'project' | 'contract' | 'counterparty' | 'journal_entry' | 'invoice' | 'statement' | 'petty_expense' | 'payment' | 'payroll' | 'inventory_doc' | 'other';

const SERVER_ENTITY: Record<DocumentEntityType, ServerEntityType> = {
  project: 'project',
  contract: 'contract',
  subcontract: 'contract',
  client_statement: 'statement',
  subcontractor_statement: 'statement',
  counterparty: 'counterparty',
  petty_cash_expense: 'petty_expense',
  vendor_invoice: 'invoice',
  purchase_order: 'invoice',
  goods_receipt: 'inventory_doc',
  payment_request: 'payment',
  receipt: 'payment',
  journal_entry: 'journal_entry',
  payroll: 'payroll',
  other: 'other',
};
const APP_ENTITY: Record<ServerEntityType, DocumentEntityType> = {
  project: 'project',
  contract: 'contract',
  counterparty: 'counterparty',
  journal_entry: 'journal_entry',
  invoice: 'vendor_invoice',
  statement: 'client_statement',
  petty_expense: 'petty_cash_expense',
  payment: 'payment_request',
  payroll: 'payroll',
  inventory_doc: 'goods_receipt',
  other: 'other',
};

export const toServerEntity = (type: DocumentEntityType): ServerEntityType => SERVER_ENTITY[type];
export const toAppEntity = (type: string): DocumentEntityType => APP_ENTITY[type as ServerEntityType] ?? 'other';

/** Same record, whichever app name the link uses (a subcontract and a contract share the server's «contract»). */
export const sameEntity = (link: DocumentLink, type: DocumentEntityType, id: string) => link.entityId === id && SERVER_ENTITY[link.entityType] === SERVER_ENTITY[type];

/** Active documents attached to a record, newest first. */
export function attachmentsOf(documents: readonly AppDocument[], type: DocumentEntityType, id: string): AppDocument[] {
  return documents.filter((d) => d.status !== 'بایگانی‌شده' && d.links.some((l) => sameEntity(l, type, id)));
}

// ----------------------------------------------------------------------------- files

/** Extensions the server accepts (the server checks the content again). */
export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'xlsx', 'xls', 'docx', 'doc', 'csv', 'txt', 'zip', 'dwg', 'dxf'] as const;
const DANGEROUS = ['php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'pht', 'phar', 'phps', 'inc', 'pl', 'py', 'cgi', 'asp', 'aspx', 'jsp', 'js', 'mjs', 'html', 'htm', 'shtml', 'xhtml', 'svg', 'svgz', 'xml', 'exe', 'com', 'bat', 'cmd', 'sh', 'msi', 'dll', 'jar', 'vbs', 'ps1', 'htaccess', 'scr', 'hta'];
export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');
export const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

const FORMAT_OF: Record<string, AppDocument['fileFormat']> = {
  pdf: 'PDF', jpg: 'JPG', jpeg: 'JPG', png: 'PNG', webp: 'WEBP', heic: 'HEIC', xlsx: 'XLSX', xls: 'XLS', docx: 'DOCX', doc: 'DOC', csv: 'CSV', txt: 'TXT', zip: 'ZIP', dwg: 'DWG', dxf: 'DXF',
};

export const extensionOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');
export const formatOfFile = (name: string): AppDocument['fileFormat'] => FORMAT_OF[extensionOf(name)] ?? 'PDF';
export const previewableMime = (mime: string) => ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mime);

/** Why a file cannot be uploaded (the same rules as the server), or null. */
export function uploadError(file: { name: string; size: number }, maxBytes: number): string | null {
  const parts = file.name.toLowerCase().split('.');
  const ext = parts.length > 1 ? parts.pop()! : '';
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) return 'این نوع فایل پذیرفته نمی‌شود (مجاز: PDF، تصویر، Excel، Word، CSV، TXT، ZIP، DWG، DXF).';
  parts.shift();
  if (parts.some((p) => (ALLOWED_EXTENSIONS as readonly string[]).includes(p) || DANGEROUS.includes(p))) return 'نام فایل پسوند دوگانه دارد؛ نام را اصلاح کنید.';
  if (file.size <= 0) return 'فایل خالی است.';
  if (file.size > maxBytes) return `حجم فایل بیش از ${Math.round(maxBytes / 1048576).toLocaleString('fa-IR')} مگابایت است.`;
  return null;
}

/** Title suggested from a file name (without the extension). */
export const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

/** Kind of document suggested for an attachment of a record. */
export function defaultCategoryFor(type: DocumentEntityType): DocumentCategory {
  const map: Partial<Record<DocumentEntityType, DocumentCategory>> = {
    contract: 'قرارداد اصلی کارفرما',
    subcontract: 'قرارداد پیمانکار جزء',
    client_statement: 'صورت‌وضعیت کارفرما',
    subcontractor_statement: 'صورت‌وضعیت پیمانکار جزء',
    vendor_invoice: 'فاکتور خرید تأمین‌کننده',
    purchase_order: 'فاکتور خرید تأمین‌کننده',
    petty_cash_expense: 'فاکتور هزینه تنخواه',
    payment_request: 'رسید و سند مالی',
    receipt: 'رسید و سند مالی',
    journal_entry: 'رسید و سند مالی',
  };
  return map[type] ?? 'سایر اسناد';
}
