/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CompanyProfile, ReportSettings } from '../../types';
import { defaultReportSettings, type PrintApi } from '../print';

/**
 * Demo «تنظیمات گزارش و چاپ»: kept in memory for this tab, like the rest of the demo. Starts from the
 * server's defaults (titles of the positions only, no names). The demo keeps no approval history, so
 * signatures of a record come from the record's own fields (`signatures` answers null).
 */
export function createMockPrintApi(company: () => CompanyProfile): PrintApi {
  let settings: ReportSettings | null = null;
  const current = () => (settings ??= defaultReportSettings(company()));
  const saved = (next: ReportSettings, message: string) => {
    settings = { ...next, version: next.version + 1 };
    return Promise.resolve({ message, settings });
  };
  const stale = (version: number) => {
    if (version !== current().version) throw new Error('این تنظیمات هم‌زمان تغییر کرده است؛ صفحه را تازه کنید.');
  };
  return {
    demo: true,
    async settings() {
      return current();
    },
    async save(input, version) {
      stale(version);
      const s = current();
      const legalName = input.company?.legalName?.trim() || s.company.legalName;
      return saved({ ...s, company: { ...s.company, ...input.company, legalName, name: legalName }, signatories: { ...s.signatories, ...input.signatories } }, 'تنظیمات گزارش و چاپ ذخیره شد (فقط در همین نسخه نمایشی).');
    },
    async uploadLogo(image, _fileName, version) {
      stale(version);
      const s = current();
      return saved({ ...s, company: { ...s.company, logoUrl: URL.createObjectURL(image) } }, 'لوگو ذخیره شد (فقط در همین نسخه نمایشی).');
    },
    async removeLogo(version) {
      stale(version);
      const s = current();
      return saved({ ...s, company: { ...s.company, logoUrl: null } }, 'لوگو حذف شد.');
    },
    async users() {
      return [];
    },
    async signatures() {
      return null;
    },
  };
}
