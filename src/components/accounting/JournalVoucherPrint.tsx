/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Printer, X } from 'lucide-react';
import type { JournalEntry } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { formatText } from '../../utils/formatters';
import { journalEntrySignatures } from '../../store/views/print';
import { useSession } from '../../store/session';
import { Money } from '../common/Money';
import { OfficialPrint, moneyHeader } from '../common/OfficialPrint';

/**
 * «سند حسابداری» in the official print layout. Signatures: the preparer and the approver from the server's
 * approval history (akph/v1 /print/signatures); an entry not yet approved prints an empty approver box.
 */
export const JournalVoucherPrint: React.FC<{ entry: JournalEntry; onClose: () => void }> = ({ entry, onClose }) => {
  const { isDemoData } = useSession();
  return (
    <Dialog onClose={onClose} label={`چاپ سند ${entry.docNumber}`} overlayClassName="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto" className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between no-print">
        <span className="text-sm font-bold text-slate-800">پیش‌نمایش چاپ رسمی سند حسابداری</span>
        <div className="flex items-center gap-2">
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
        <OfficialPrint
          reportType="journal_entry"
          title="سند حسابداری"
          number={entry.docNumber}
          money
          entity={isDemoData ? null : { type: 'journal_entry', id: entry.id }}
          localSignatures={journalEntrySignatures(entry)}
          filters={[
            { label: 'تاریخ سند', value: entry.date },
            { label: 'نوع', value: entry.type },
            { label: 'وضعیت', value: entry.status },
            ...(entry.projectName ? [{ label: 'پروژه', value: entry.projectName }] : []),
          ]}
        >
          <p className="mb-2 text-sm">
            <strong>شرح: </strong>
            {formatText(entry.title)}
          </p>
          <table>
            <thead>
              <tr>
                <th>کد حساب</th>
                <th>عنوان حساب</th>
                <th>تفصیلی</th>
                <th>شرح ردیف</th>
                <th>{moneyHeader('بدهکار')}</th>
                <th>{moneyHeader('بستانکار')}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {entry.rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatText(r.accountCode)}</td>
                  <td>{formatText(r.accountName)}</td>
                  <td>{formatText(r.subledgerName || '—')}</td>
                  <td>{formatText(r.description)}</td>
                  <td>{r.debit ? <Money rial={r.debit} unit={false} /> : '—'}</td>
                  <td>{r.credit ? <Money rial={r.credit} unit={false} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td colSpan={4}>جمع</td>
                <td><Money rial={entry.totalDebit} unit={false} /></td>
                <td><Money rial={entry.totalCredit} unit={false} /></td>
              </tr>
            </tfoot>
          </table>
        </OfficialPrint>
      </div>
    </Dialog>
  );
};
