import React from 'react';
import { Project, KpiItem, PettyCashAccount, DetailedProgressStatement } from '../../types';
import { formatPercent, formatText } from '../../utils/formatters';
import { getCurrentFiscalYear } from '../../utils/date';
import { downloadTable } from '../../utils/export';
import { X, Printer, FileSpreadsheet } from 'lucide-react';
import { Dialog } from '../../ui/Dialog';
import { reportProjectTotals } from '../../store/views/reports';
import { projectsReportCsv } from '../../store/views/exports';
import { Money } from '../common/Money';
import { OfficialPrint, moneyHeader } from '../common/OfficialPrint';
import { EmptyState } from '../common/EmptyState';

interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  kpis: KpiItem[];
  pettyFunds: PettyCashAccount[];
  statements: DetailedProgressStatement[];
  targetProject?: Project | null;
}

/** «گزارش رسمی پروژه‌ها»: every figure from the loaded projects (the ledger in live mode), nothing typed in. */
export const PdfReportModal: React.FC<PdfReportModalProps> = ({ isOpen, onClose, projects, targetProject }) => {
  if (!isOpen) return null;

  const selectedProjects = targetProject ? [targetProject] : projects;
  const totals = reportProjectTotals(selectedProjects);
  const title = targetProject ? `کارنامه مالی پروژه ${targetProject.name}` : 'گزارش رسمی عملکرد مالی و سودآوری پروژه‌ها';
  const empty = selectedProjects.length === 0;

  return (
    <Dialog onClose={onClose} label={title} overlayClassName="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto" className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden animate-in fade-in duration-200">
      <div className="no-print bg-slate-900 text-white px-5 py-3 flex items-center justify-between border-b border-slate-800 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">پیش‌نمایش چاپ رسمی</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadTable(projectsReportCsv(selectedProjects))} disabled={empty} className="btn btn-secondary btn-sm">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>خروجی Excel</span>
          </button>
          <button onClick={() => window.print()} disabled={empty} className="btn btn-primary">
            <Printer className="w-3.5 h-3.5" />
            <span>چاپ / ذخیره PDF</span>
          </button>
          <button onClick={onClose} aria-label="بستن" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-h-[82vh] overflow-y-auto">
        <OfficialPrint
          reportType="projects"
          title={title}
          orientation="landscape"
          money
          preview={empty}
          noSignatures={empty}
          filters={[
            { label: 'پروژه', value: targetProject ? `${targetProject.name} (${targetProject.code})` : `همه پروژه‌های در دسترس (${formatText(selectedProjects.length)})` },
            { label: 'دوره', value: `سال مالی ${formatText(getCurrentFiscalYear())} تا امروز` },
            { label: 'مبنا', value: 'اسناد قطعی دفتر کل' },
          ]}
        >
          {empty ? (
            <EmptyState title="پروژه‌ای برای گزارش ثبت نشده است" description="پس از ثبت پروژه و اسناد آن، ارقام این گزارش از دفاتر رسمی خوانده می‌شود." />
          ) : (
            <>
              <table className="mb-4">
                <thead>
                  <tr>
                    <th>{moneyHeader('کارکرد (درآمد)')}</th>
                    <th>{moneyHeader('هزینه')}</th>
                    <th>{moneyHeader('سود ناخالص')}</th>
                    <th>حاشیه سود</th>
                    <th>{moneyHeader('مطالبات')}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  <tr>
                    <td><Money rial={totals.revenue} unit={false} /></td>
                    <td><Money rial={totals.cost} unit={false} /></td>
                    <td><Money rial={totals.profit} unit={false} /></td>
                    <td>{formatPercent(totals.margin)}</td>
                    <td><Money rial={totals.receivables} unit={false} /></td>
                  </tr>
                </tbody>
              </table>

              <table>
                <thead>
                  <tr>
                    <th>کد</th>
                    <th>پروژه و کارفرما</th>
                    <th>{moneyHeader('مبلغ قرارداد')}</th>
                    <th>{moneyHeader('کارکرد')}</th>
                    <th>{moneyHeader('هزینه')}</th>
                    <th>{moneyHeader('سود')}</th>
                    <th>حاشیه سود</th>
                    <th>{moneyHeader('مطالبات')}</th>
                    <th>وضعیت</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {selectedProjects.map((p) => (
                    <tr key={p.id}>
                      <td>{formatText(p.code)}</td>
                      <td>
                        <div className="font-bold">{formatText(p.name)}</div>
                        <div className="text-xs text-slate-600">{formatText(p.client)}</div>
                      </td>
                      <td><Money rial={p.contractAmount} unit={false} /></td>
                      <td><Money rial={p.recordedRevenue} unit={false} /></td>
                      <td><Money rial={p.cost} unit={false} /></td>
                      <td><Money rial={p.profit} unit={false} /></td>
                      <td>{formatPercent(p.profitMargin)}</td>
                      <td><Money rial={p.receivables} unit={false} /></td>
                      <td>{formatText(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={2}>جمع کل</td>
                    <td><Money rial={totals.contractAmount} unit={false} /></td>
                    <td><Money rial={totals.revenue} unit={false} /></td>
                    <td><Money rial={totals.cost} unit={false} /></td>
                    <td><Money rial={totals.profit} unit={false} /></td>
                    <td>{formatPercent(totals.margin)}</td>
                    <td><Money rial={totals.receivables} unit={false} /></td>
                    <td>—</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </OfficialPrint>
      </div>
    </Dialog>
  );
};
