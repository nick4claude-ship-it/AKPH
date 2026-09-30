/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { useCompany } from '../../store/session';
import { signatureDate, usePrintMeta, usePrintSignatures, type PrintEntity } from '../../store/usePrint';
import type { PrintSignature, ReportType } from '../../types';
import { formatText } from '../../utils/formatters';
import { moneyUnitLabel } from '../../utils/money';

export interface PrintFilter {
  label: string;
  value: string;
}

interface OfficialPrintProps {
  reportType: ReportType;
  title: string;
  /** Server number of the record (سند، درخواست…); a report without one gets a report number. */
  number?: string;
  /** Period, project, currency…; the money unit is added when `money` is set. */
  filters?: PrintFilter[];
  /** Tables show amounts in the display unit (named once, here and in the column headers). */
  money?: boolean;
  orientation?: 'portrait' | 'landscape';
  /** No real data yet: a «پیش‌نمایش» label instead of pretending. */
  preview?: boolean;
  /** Record with an approval workflow: signatures from the server's approval history. */
  entity?: PrintEntity | null;
  /** Demo only: the record's own approval fields. */
  localSignatures?: PrintSignature[];
  /** Hide the signature row (e.g. an empty report). */
  noSignatures?: boolean;
  children: React.ReactNode;
}

/** Text for a CSS `content` string. */
const cssString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;

/**
 * The official print layout of every report: letterhead (logo, company, report title), number and date, filters,
 * the report body, signatures and a footer with «صفحه ۱ از ۳», the time of issue and the preparer.
 *
 * It renders twice: inline (the on-screen preview inside a dialog) and as a copy under <body> that is the only
 * thing printed (no menu, button or dialog chrome). A4 portrait or landscape, table headers repeat on each page.
 */
export const OfficialPrint: React.FC<OfficialPrintProps> = (props) => {
  const meta = usePrintMeta(props.reportType, props.number);
  const { slots } = usePrintSignatures(props.reportType, props.entity, props.localSignatures);
  const doc = <OfficialPrintBody {...props} meta={meta} slots={slots} />;
  const footer = `تهیه: ${meta.preparedBy} · ${meta.issuedAt}`;
  return (
    <>
      <div className="official-print-screen">{doc}</div>
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="official-print-portal" data-orientation={props.orientation || 'portrait'}>
            <style>{`@page { @bottom-left { content: ${cssString(footer)}; } }`}</style>
            {doc}
          </div>,
          document.body
        )}
    </>
  );
};

const OfficialPrintBody: React.FC<OfficialPrintProps & { meta: ReturnType<typeof usePrintMeta>; slots: PrintSignature[] }> = ({ title, filters = [], money, preview, noSignatures, children, meta, slots }) => {
  const company = useCompany();
  const ids = [
    company.nationalId ? `شناسه ملی: ${company.nationalId}` : '',
    company.registrationNumber ? `شماره ثبت: ${company.registrationNumber}` : '',
    company.economicCode ? `کد اقتصادی: ${company.economicCode}` : '',
  ].filter(Boolean);
  const contact = [company.address || '', company.phone ? `تلفن: ${company.phone}` : ''].filter(Boolean);
  const allFilters = money ? [...filters, { label: 'واحد مبالغ', value: moneyUnitLabel() }] : filters;
  return (
    <article className="official-print bg-white text-slate-900 text-right" aria-label={title}>
      <header className="official-print-head">
        <div className="flex items-center gap-3 min-w-0">
          {company.logoUrl && <img src={company.logoUrl} alt={`لوگوی ${company.legalName}`} className="official-print-logo" />}
          <div className="min-w-0">
            <div className="text-base font-bold">{formatText(company.legalName)}</div>
            {ids.length > 0 && <div className="text-xs text-slate-600 tabular-nums">{formatText(ids.join(' · '))}</div>}
            {contact.length > 0 && <div className="text-xs text-slate-600">{formatText(contact.join(' · '))}</div>}
          </div>
        </div>
        <div className="official-print-title">
          <h1 className="text-base font-bold">{formatText(title)}</h1>
          {preview && <span className="official-print-preview">پیش‌نمایش — داده ثبت‌شده‌ای در سرور ندارد</span>}
        </div>
        <dl className="official-print-facts tabular-nums">
          <div>
            <dt>شماره</dt>
            <dd>{formatText(meta.number)}</dd>
          </div>
          <div>
            <dt>تاریخ</dt>
            <dd>{formatText(meta.date)}</dd>
          </div>
        </dl>
      </header>

      {allFilters.length > 0 && (
        <div className="official-print-filters">
          {allFilters.map((f) => (
            <span key={f.label}>
              <strong>{formatText(f.label)}:</strong> {formatText(f.value)}
            </span>
          ))}
        </div>
      )}

      <div className="official-print-content">{children}</div>

      {!noSignatures && slots.length > 0 && (
        <section className="official-print-signatures" aria-label="امضاها">
          {slots.map((s, i) => (
            <div key={`${s.title}-${i}`} className="official-print-signature">
              <div className="font-bold text-sm">{formatText(s.title)}</div>
              <div className="official-print-signer">{s.name ? formatText(s.name) : '\u00a0'}</div>
              <div className="official-print-line" aria-hidden="true" />
              <div className="text-xs text-slate-600 tabular-nums">{s.signed && s.at ? `تأیید: ${formatText(signatureDate(s.at))}` : 'امضا و تاریخ'}</div>
            </div>
          ))}
        </section>
      )}

      <footer className="official-print-foot tabular-nums">
        <span>{formatText(`زمان تهیه: ${meta.issuedAt}`)}</span>
        <span>{formatText(`تهیه‌کننده: ${meta.preparedBy}`)}</span>
      </footer>
    </article>
  );
};

/** Column header with the money unit named once: «مبلغ (ریال)». */
export const moneyHeader = (label: string) => `${label} (${moneyUnitLabel()})`;
