/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CompanyProfile, PrintSignature, ReportSettings, ReportType, SignatorySlot } from '../../types';
import { apiClient } from '../client';
import { REPORT_TYPES, type PrintApi, type ReportSettingsInput, type ReportSettingsResult } from '../print';
import { arr, obj, ShapeError } from './mapping';

/** «تنظیمات گزارش و چاپ» of the akph/v1 server (GET/POST /report-settings, /report-settings/logo, /print/signatures). */

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const KNOWN = new Set<string>(REPORT_TYPES.map((t) => t.key));

function parseSlot(raw: unknown): SignatorySlot {
  const o = obj('/report-settings', raw, 'signatory');
  return { title: text(o.title), userId: typeof o.user_id === 'string' && o.user_id ? o.user_id : null, name: text(o.name) };
}

export function parseReportSettings(raw: unknown): ReportSettings {
  const route = '/report-settings';
  const o = obj(route, raw, 'settings');
  const c = obj(route, o.company, 'company');
  const legalName = text(c.legal_name);
  const company: CompanyProfile = {
    name: legalName,
    legalName,
    nationalId: text(c.national_id),
    registrationNumber: text(c.registration_number),
    economicCode: text(c.economic_code),
    address: text(c.address),
    phone: text(c.phone),
    logoUrl: typeof c.logo_url === 'string' && c.logo_url ? c.logo_url : null,
  };
  const s = obj(route, o.signatories, 'signatories');
  const signatories: ReportSettings['signatories'] = {};
  for (const [key, slots] of Object.entries(s)) {
    if (KNOWN.has(key) && Array.isArray(slots)) signatories[key as ReportType] = slots.map(parseSlot);
  }
  const version = Number(o.version);
  if (!Number.isInteger(version) || version < 1) throw new ShapeError(route, 'version', 'عدد صحیح نیست');
  const types = Array.isArray(o.report_types)
    ? o.report_types.map((t) => obj(route, t, 'report_types')).filter((t) => KNOWN.has(text(t.key))).map((t) => ({ key: text(t.key) as ReportType, label: text(t.label), workflow: t.workflow === true }))
    : REPORT_TYPES;
  return { company, signatories, reportTypes: types, version };
}

function result(raw: unknown): ReportSettingsResult {
  const o = obj('/report-settings', raw);
  const records = obj('/report-settings', o.records ?? {}, 'records');
  const settings = Array.isArray(records.report_settings) ? records.report_settings[0] : undefined;
  return { message: text(o.message) || 'انجام شد.', settings: parseReportSettings(settings) };
}

function body(input: ReportSettingsInput, version: number) {
  const out: Record<string, unknown> = { version };
  if (input.company) {
    const map: [keyof NonNullable<ReportSettingsInput['company']>, string][] = [
      ['legalName', 'legal_name'],
      ['nationalId', 'national_id'],
      ['registrationNumber', 'registration_number'],
      ['economicCode', 'economic_code'],
      ['address', 'address'],
      ['phone', 'phone'],
    ];
    const c: Record<string, string> = {};
    for (const [k, f] of map) if (input.company[k] !== undefined) c[f] = String(input.company[k]).trim();
    out.company = c;
  }
  if (input.signatories) {
    const s: Record<string, unknown[]> = {};
    for (const [type, slots] of Object.entries(input.signatories)) {
      s[type] = (slots || []).map((slot) => (slot.userId ? { title: slot.title.trim(), user_id: slot.userId } : { title: slot.title.trim(), name: slot.name.trim() }));
    }
    out.signatories = s;
  }
  return out;
}

function parseSignature(raw: unknown): PrintSignature {
  const o = obj('/print/signatures', raw, 'slot');
  const signed = o.signed === true;
  return { title: text(o.title), name: text(o.name), at: signed && typeof o.at === 'string' ? o.at : null, signed };
}

export function createAkphPrintApi(): PrintApi {
  return {
    demo: false,
    async settings() {
      return parseReportSettings(obj('/report-settings', await apiClient.get<unknown>('report-settings')).settings);
    },
    async save(input, version, key) {
      return result(await apiClient.command<unknown>('POST', 'report-settings', body(input, version), { idempotencyKey: key, version }));
    },
    async uploadLogo(image, fileName, version, key) {
      const form = new FormData();
      form.append('logo', image, fileName);
      return result(await apiClient.command<unknown>('POST', 'report-settings/logo', form, { idempotencyKey: key, version }));
    },
    async removeLogo(version, key) {
      return result(await apiClient.command<unknown>('DELETE', 'report-settings/logo', { version }, { idempotencyKey: key, version }));
    },
    async users() {
      const o = obj('/report-settings/users', await apiClient.get<unknown>('report-settings/users'));
      return arr('/report-settings/users', o, 'users').map((u) => {
        const x = obj('/report-settings/users', u);
        return { id: text(x.id), name: text(x.name), role: text(x.role) };
      });
    },
    async signatures(entityType, entityId) {
      const o = obj('/print/signatures', await apiClient.get<unknown>('print/signatures', { entity_type: entityType, entity_id: entityId }));
      return { number: text(o.number), slots: arr('/print/signatures', o, 'slots').map(parseSignature) };
    },
  };
}
