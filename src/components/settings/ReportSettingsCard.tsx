/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ImagePlus, Plus, Printer, Save, Trash2 } from 'lucide-react';
import type { ReportType, SignatorySlot } from '../../types';
import { useCurrentUser } from '../../store/session';
import { useReportSettingsEditor } from '../../store/usePrint';
import { Button } from '../common/Button';
import { Card, CardHeader } from '../common/Card';
import { Field, FormStatus } from '../common/Field';
import { formatText } from '../../utils/formatters';

type CompanyForm = { legalName: string; nationalId: string; registrationNumber: string; economicCode: string; address: string; phone: string };

/**
 * «تنظیمات گزارش و چاپ» (system administrator): letterhead of every printed report and the signatories of
 * each report type. The default is the titles of the positions only; a name is printed only when a portal
 * user or a typed name is chosen here.
 */
export const ReportSettingsCard: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const user = useCurrentUser();
  const editor = useReportSettingsEditor();
  const { settings } = editor;
  const [company, setCompany] = useState<CompanyForm | null>(null);
  const [type, setType] = useState<ReportType>('projects');
  const [slots, setSlots] = useState<Partial<Record<ReportType, SignatorySlot[]>>>({});
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string; errors: Record<string, string> } | null>(null);

  useEffect(() => {
    const c = settings.company;
    setCompany({ legalName: c.legalName, nationalId: c.nationalId || '', registrationNumber: c.registrationNumber || '', economicCode: c.economicCode || '', address: c.address || '', phone: c.phone || '' });
    setSlots(settings.signatories);
  }, [settings]);

  if (user.role !== 'مدیر سیستم' || !company) return null;
  const current = slots[type] || [];
  const info = settings.reportTypes.find((t) => t.key === type);
  const setSlot = (i: number, patch: Partial<SignatorySlot>) => setSlots((s) => ({ ...s, [type]: current.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const error = (key: string) => outcome?.errors[key];

  const finish = (result: { ok: boolean; message: string; errors: Record<string, string> }) => {
    setOutcome(result);
    if (result.ok) onToast(result.message);
  };

  return (
    <Card className="p-4 sm:p-6" id="report-settings">
      <form
        noValidate
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          finish(await editor.save({ company, signatories: slots }));
        }}
      >
        <CardHeader
          icon={Printer}
          title="تنظیمات گزارش و چاپ"
          description="سربرگ همه گزارش‌ها و چاپ‌ها و امضاکنندگان هر نوع گزارش. در اسنادی که گردش تأیید دارند، نام و تاریخ تأییدکنندگان از سابقه تأیید سرور چاپ می‌شود و جایگاه‌های این‌جا پس از آن‌ها می‌آید."
          actions={
            <Button type="submit" variant="primary" icon={Save} disabled={editor.busy !== null}>
              ذخیره تنظیمات چاپ
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field id="rs-legal-name" label="نام رسمی شرکت" required error={error('company.legal_name')}>
            {(p) => <input {...p} className="input" value={company.legalName} onChange={(e) => setCompany({ ...company, legalName: e.target.value })} />}
          </Field>
          <Field id="rs-national-id" label="شناسه ملی" error={error('company.national_id')}>
            {(p) => <input {...p} className="input text-left" dir="ltr" inputMode="numeric" value={company.nationalId} onChange={(e) => setCompany({ ...company, nationalId: e.target.value })} />}
          </Field>
          <Field id="rs-registration" label="شماره ثبت" error={error('company.registration_number')}>
            {(p) => <input {...p} className="input text-left" dir="ltr" inputMode="numeric" value={company.registrationNumber} onChange={(e) => setCompany({ ...company, registrationNumber: e.target.value })} />}
          </Field>
          <Field id="rs-economic" label="کد اقتصادی" error={error('company.economic_code')}>
            {(p) => <input {...p} className="input text-left" dir="ltr" inputMode="numeric" value={company.economicCode} onChange={(e) => setCompany({ ...company, economicCode: e.target.value })} />}
          </Field>
          <Field id="rs-phone" label="تلفن" error={error('company.phone')}>
            {(p) => <input {...p} className="input text-left" dir="ltr" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />}
          </Field>
          <Field id="rs-address" label="نشانی" error={error('company.address')}>
            {(p) => <input {...p} className="input" value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />}
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="w-20 h-20 rounded-lg border border-line bg-canvas flex items-center justify-center overflow-hidden">
            {settings.company.logoUrl ? <img src={settings.company.logoUrl} alt="لوگوی فعلی گزارش‌ها" className="w-full h-full object-contain" /> : <span className="text-xs text-ink-subtle">بدون لوگو</span>}
          </div>
          <label className="btn btn-secondary btn-sm cursor-pointer">
            <ImagePlus className="w-4 h-4" />
            <span>بارگذاری لوگو (JPG، PNG یا WebP تا ۲ مگابایت)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="فایل لوگو"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) finish(await editor.uploadLogo(file));
              }}
            />
          </label>
          {settings.company.logoUrl && (
            <Button variant="secondary" size="sm" icon={Trash2} onClick={async () => finish(await editor.removeLogo())} disabled={editor.busy !== null}>
              حذف لوگو
            </Button>
          )}
          {error('logo') && <span className="text-xs text-danger">{error('logo')}</span>}
        </div>

        <div className="space-y-3">
          <Field id="rs-report-type" label="امضاکنندگان گزارش" hint={info?.workflow ? 'این نوع سند گردش تأیید دارد: تأییدکنندگان واقعی به‌طور خودکار چاپ می‌شوند؛ جایگاه‌های زیر پس از آن‌ها می‌آید.' : 'فقط عنوان جایگاه کافی است؛ نام اختیاری است.'}>
            {(p) => (
              <select {...p} className="input" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
                {settings.reportTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {error(`signatories.${type}`) && <p className="text-xs text-danger">{error(`signatories.${type}`)}</p>}
          {current.length === 0 && <p className="text-sm text-ink-subtle">جایگاه اضافه‌ای تعریف نشده است.</p>}
          {current.map((slot, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
              <Field id={`rs-slot-title-${i}`} label="عنوان جایگاه">
                {(p) => <input {...p} className="input" value={slot.title} onChange={(e) => setSlot(i, { title: e.target.value })} />}
              </Field>
              <Field id={`rs-slot-user-${i}`} label="کاربر پرتال">
                {(p) => (
                  <select {...p} className="input" value={slot.userId || ''} onChange={(e) => setSlot(i, { userId: e.target.value || null, name: '' })}>
                    <option value="">— بدون کاربر —</option>
                    {editor.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {formatText(`${u.name} (${u.role})`)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field id={`rs-slot-name-${i}`} label="یا نام دستی">
                {(p) => <input {...p} className="input" disabled={!!slot.userId} value={slot.userId ? '' : slot.name} onChange={(e) => setSlot(i, { name: e.target.value })} />}
              </Field>
              <Button variant="secondary" size="sm" icon={Trash2} aria-label={`حذف جایگاه ${slot.title || i + 1}`} onClick={() => setSlots((s) => ({ ...s, [type]: current.filter((_, j) => j !== i) }))}>
                حذف
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" icon={Plus} disabled={current.length >= 6} onClick={() => setSlots((s) => ({ ...s, [type]: [...current, { title: '', userId: null, name: '' }] }))}>
            افزودن جایگاه امضا
          </Button>
        </div>
        <FormStatus outcome={outcome} />
      </form>
    </Card>
  );
};
