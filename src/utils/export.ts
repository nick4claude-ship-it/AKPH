/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CsvCell = string | number | null | undefined;

const escapeCell = (value: CsvCell): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Triggers a browser download of a file built in memory. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * CSV that Excel opens correctly with Persian text: UTF-8 with BOM, CRLF line endings.
 * Numbers are written as plain integers (no separators) so they stay numeric in Excel.
 */
export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]): void {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(','));
  const blob = new Blob(['﻿', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(filename.endsWith('.csv') ? filename : `${filename}.csv`, blob);
}
