/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileSpreadsheet, Printer, X } from 'lucide-react';
import type { ReportType } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { downloadTable, type CsvTable } from '../../utils/export';
import { formatInt } from '../../utils/money';
import { formatText } from '../../utils/formatters';
import { OfficialPrint, type PrintFilter } from './OfficialPrint';

/** A number of a table (display unit, already rounded): Persian digits, separators, negatives in parentheses. */
const cell = (v: string | number | null | undefined) => {
  if (typeof v === 'number') return v < 0 ? `(${formatInt(-v)})` : formatInt(v);
  return formatText(v ?? '');
};

/**
 * Official print of a report table: the same rows as its Excel (CSV) export, in the official layout
 * (letterhead, filters, «جمع», signatures, page numbers).
 */
export const TablePrintDialog: React.FC<{
  reportType: ReportType;
  title: string;
  table: CsvTable;
  filters?: PrintFilter[];
  orientation?: 'portrait' | 'landscape';
  onClose: () => void;
}> = ({ reportType, title, table, filters, orientation, onClose }) => {
  const empty = table.rows.length === 0;
  return (
    <Dialog onClose={onClose} label={`پیش‌نمایش چاپ ${title}`} overlayClassName="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto" className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 flex-wrap no-print">
        <span className="text-sm font-bold text-slate-800">{formatText(`پیش‌نمایش چاپ رسمی — ${title}`)}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadTable(table)} disabled={empty} className="btn btn-secondary btn-sm">
            <FileSpreadsheet className="w-4 h-4" />
            <span>خروجی Excel</span>
          </button>
          <button onClick={() => window.print()} className="btn btn-primary">
            <Printer className="w-4 h-4" />
            <span>چاپ / ذخیره PDF</span>
          </button>
          <button onClick={onClose} aria-label="بستن" className="p-2 rounded-lg text-slate-500 hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-4 sm:p-6 overflow-y-auto">
        <OfficialPrint reportType={reportType} title={title} filters={filters} orientation={orientation} preview={empty} noSignatures={empty}>
          <table>
            <thead>
              <tr>
                {table.headers.map((h) => (
                  <th key={h}>{formatText(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j}>{cell(v)}</td>
                  ))}
                </tr>
              ))}
              {empty && (
                <tr>
                  <td colSpan={table.headers.length}>داده‌ای برای این گزارش ثبت نشده است.</td>
                </tr>
              )}
            </tbody>
            {table.totals && !empty && (
              <tfoot>
                <tr className="font-bold">
                  {table.totals.map((v, j) => (
                    <td key={j}>{cell(v)}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </OfficialPrint>
      </div>
    </Dialog>
  );
};
