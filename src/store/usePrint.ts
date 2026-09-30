/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { defaultReportSettings, type ReportSettingsInput, type ReportSettingsResult } from '../api/print';
import type { PrintSignature, ReportSettings, ReportType, SignatorySlot } from '../types';
import { avatarFileError } from '../utils/accountRules';
import { getCurrentFiscalYear, toPersianDate, toPersianDateTime } from '../utils/date';
import { toPersianDigits } from '../utils/formatters';
import { commandKeys } from './commandKeys';
import { useCurrentUser, useSession } from './session';
import type { FormOutcome } from './useAccount';

/** «تنظیمات گزارش و چاپ» of this installation (defaults until loaded: titles only, no names). */
export function useReportSettings(): ReportSettings {
  const { session } = useSession();
  return useMemo(() => session.reportSettings ?? defaultReportSettings(session.company), [session.reportSettings, session.company]);
}

/** A record whose signatures come from its approval history on the server. */
export interface PrintEntity {
  type: 'journal_entry' | 'petty_expense' | 'petty_request' | 'payment_request' | 'receipt' | string;
  id: string;
}

const configured = (slots: SignatorySlot[] | undefined): PrintSignature[] => (slots || []).map((s) => ({ title: s.title, name: s.name, at: null, signed: false }));

/**
 * Signature boxes of a printed report.
 * - A record with an approval workflow (`entity`): the server's approval history gives the real name and time
 *   of every signed step, an unsigned step stays empty; the configured slots of the type follow. Without a
 *   server (demo), `local` (the record's own fields) is used the same way.
 * - Any other report: the configured slots of its type (default: titles only).
 */
export function usePrintSignatures(reportType: ReportType, entity?: PrintEntity | null, local?: PrintSignature[]): { slots: PrintSignature[]; loading: boolean; error: string } {
  const { print } = useSession();
  const settings = useReportSettings();
  const extra = useMemo(() => configured(settings.signatories[reportType]), [settings, reportType]);
  const [server, setServer] = useState<PrintSignature[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const entityType = entity?.type;
  const entityId = entity?.id;

  useEffect(() => {
    setServer(null);
    setError('');
    if (!entityType || !entityId || !print || print.demo) return;
    let alive = true;
    setLoading(true);
    print
      .signatures(entityType, entityId)
      .then((r) => alive && setServer(r ? r.slots : null))
      .catch((err) => alive && setError(err instanceof ApiError ? err.farsiMessage : 'امضاهای این سند از سرور دریافت نشد.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [print, entityType, entityId]);

  const slots = useMemo(() => {
    if (server) return server; // the server already appends the configured slots
    return local ? [...local, ...extra] : extra;
  }, [server, local, extra]);
  return { slots, loading, error };
}

/** Header facts of a printed report: number, date and time of issue, the preparer. */
export function usePrintMeta(reportType: ReportType, number?: string) {
  const user = useCurrentUser();
  return useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const day = toPersianDate(now);
    return {
      number: number || toPersianDigits(`${day.replace(/[^\d۰-۹]/g, '')}-${stamp}`),
      date: day,
      issuedAt: toPersianDateTime(now),
      preparedBy: user.name,
    };
  }, [reportType, number, user.name]);
}

/** Jalali date of a signature (ISO time from the server). */
export const signatureDate = (at: string | null): string => (at ? toPersianDate(at) : '');

const failed = (message: string, errors: Record<string, string> = {}): FormOutcome => ({ ok: false, message, errors });

/** «تنظیمات گزارش و چاپ» form of the system administrator: save, logo, users for the signatory picker. */
export function useReportSettingsEditor() {
  const { print, updateSession } = useSession();
  const settings = useReportSettings();
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [busy, setBusy] = useState<'save' | 'logo' | null>(null);

  useEffect(() => {
    let alive = true;
    print
      ?.users()
      .then((u) => alive && setUsers(u))
      .catch(() => alive && setUsers([]));
    return () => {
      alive = false;
    };
  }, [print]);

  const send = useCallback(
    async (what: 'save' | 'logo', action: string, fingerprint: unknown[], run: (key: string) => Promise<ReportSettingsResult>): Promise<FormOutcome> => {
      const { key, inFlight } = commandKeys.acquire(`report-settings.${action}`, fingerprint);
      if (inFlight) return failed('درخواست قبلی هنوز در حال ارسال است.');
      setBusy(what);
      try {
        const result = await run(key);
        commandKeys.settle(key, 'ok');
        updateSession?.({ reportSettings: result.settings });
        return { ok: true, message: result.message, errors: {} };
      } catch (err) {
        commandKeys.settle(key, err instanceof ApiError && err.outcomeUnknown ? 'unknown' : 'rejected');
        const message = err instanceof ApiError ? err.farsiMessage : err instanceof Error ? err.message : 'ذخیره نشد؛ دوباره تلاش کنید.';
        return failed(message, err instanceof ApiError && err.field ? { [err.field]: message } : {});
      } finally {
        setBusy(null);
      }
    },
    [updateSession]
  );

  const save = useCallback(
    async (input: ReportSettingsInput): Promise<FormOutcome> => {
      if (!print) return failed('این بخش در دسترس نیست.');
      const errors: Record<string, string> = {};
      const c = input.company;
      if (c?.legalName !== undefined && !c.legalName.trim()) errors['company.legal_name'] = 'نام رسمی شرکت را وارد کنید.';
      if (c?.nationalId && !/^\d{10,11}$/.test(c.nationalId.trim())) errors['company.national_id'] = 'شناسه ملی باید ۱۰ یا ۱۱ رقم باشد.';
      if (c?.registrationNumber && !/^\d{1,12}$/.test(c.registrationNumber.trim())) errors['company.registration_number'] = 'شماره ثبت باید فقط رقم باشد.';
      if (c?.economicCode && !/^\d{10,14}$/.test(c.economicCode.trim())) errors['company.economic_code'] = 'کد اقتصادی باید ۱۰ تا ۱۴ رقم باشد.';
      for (const [type, slots] of Object.entries(input.signatories || {})) {
        if ((slots || []).some((s) => !s.title.trim())) errors[`signatories.${type}`] = 'عنوان هر جایگاه امضا را وارد کنید.';
        if ((slots || []).length > 6) errors[`signatories.${type}`] = 'حداکثر ۶ جایگاه امضا برای هر گزارش.';
      }
      if (Object.keys(errors).length) return failed('چند مورد را اصلاح کنید.', errors);
      const version = settings.version;
      return send('save', 'save', [input, version], (key) => print.save(input, version, key));
    },
    [print, settings.version, send]
  );

  const uploadLogo = useCallback(
    async (file: File): Promise<FormOutcome> => {
      if (!print) return failed('این بخش در دسترس نیست.');
      const error = avatarFileError({ type: file.type, size: file.size });
      if (error) return failed(error, { logo: error });
      const version = settings.version;
      return send('logo', 'logo', [file.name, file.size, file.lastModified, version], (key) => print.uploadLogo(file, file.name, version, key));
    },
    [print, settings.version, send]
  );

  const removeLogo = useCallback(async (): Promise<FormOutcome> => {
    if (!print) return failed('این بخش در دسترس نیست.');
    const version = settings.version;
    return send('logo', 'logo-remove', [version], (key) => print.removeLogo(version, key));
  }, [print, settings.version, send]);

  return { settings, users, busy, save, uploadLogo, removeLogo, demo: print?.demo ?? true };
}
