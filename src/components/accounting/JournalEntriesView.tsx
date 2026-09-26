import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Eye,
  Printer,
  Trash2,
  AlertTriangle,
  History,
  Lock,
  X,
} from 'lucide-react';
import {
  AccountNode,
  JournalEntry,
  JournalEntryRow,
  JournalEntryType,
  Project,
  CostCenter,
  Subledger,
} from '../../types';
import { formatMoney, moneyUnitLabel } from '../../utils/money';
import { toPersianDate } from '../../utils/date';
import { usePagination } from '../../store/pagination';
import { TablePager } from '../common/TablePager';
import { useCurrentUser, usePermission } from '../../store/session';
import type { WorkflowResult } from '../../store/workflowKit';
import {
  blankJournalRow as emptyRow,
  computeManualEntryDraft,
  journalDisplayStatus,
  journalEntryActions,
  leafAccounts,
  type ManualEntryFormInput,
} from '../../store/views/accounting';
import { Dialog } from '../../ui/Dialog';
import { MoneyInput } from '../../ui/NumberInput';
import { Money } from '../common/Money';
import { formatText } from '../../utils/formatters';

interface JournalEntriesViewProps {
  entries: JournalEntry[];
  /** Ids of final entries that already have a reversal entry. */
  reversedIds: Set<string>;
  /** Final entries whose reversal waits for another user's approval. */
  pendingReversalIds: Set<string>;
  chartOfAccounts: AccountNode[];
  projects: Project[];
  costCenters: CostCenter[];
  subledgers: Subledger[];
  /** Saves the voucher through the workflow (numbered, pending approval by another user). */
  onCreateEntry: (form: ManualEntryFormInput) => WorkflowResult;
  onApproveEntry: (id: string) => WorkflowResult;
  onRejectEntry: (id: string, reason: string) => WorkflowResult;
  onReverseEntry: (id: string, reason: string) => WorkflowResult;
  isNewDocModalOpen: boolean;
  setIsNewDocModalOpen: (open: boolean) => void;
}


export const JournalEntriesView: React.FC<JournalEntriesViewProps> = ({
  entries,
  reversedIds,
  pendingReversalIds,
  chartOfAccounts,
  projects,
  costCenters,
  subledgers,
  onCreateEntry,
  onApproveEntry,
  onRejectEntry,
  onReverseEntry,
  isNewDocModalOpen,
  setIsNewDocModalOpen,
}) => {
  const { can } = usePermission();
  const currentUser = useCurrentUser();
  const accounts = useMemo(() => leafAccounts(chartOfAccounts), [chartOfAccounts]);
  const unit = moneyUnitLabel();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedEntry = entries.find((e) => e.id === selectedId) || null;

  const [reversingEntryId, setReversingEntryId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [rejectingEntryId, setRejectingEntryId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [newDocDate, setNewDocDate] = useState(() => toPersianDate(new Date()));
  const [newDocType, setNewDocType] = useState<JournalEntryType>('عمومی');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocProjectId, setNewDocProjectId] = useState<string>('');
  const [newDocCostCenterId, setNewDocCostCenterId] = useState<string>('');
  const [newDocRows, setNewDocRows] = useState<JournalEntryRow[]>(() => [emptyRow(), emptyRow()]);

  const entryByNumber = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  // The live reversal of an entry (a rejected request is history only).
  const reversalOf = (id: string) => entries.find((e) => e.reversedFromDocId === id && e.status !== 'رد شده');

  const filteredEntries = entries.filter((entry) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      entry.docNumber.toLowerCase().includes(q) ||
      entry.title.toLowerCase().includes(q) ||
      (entry.projectName || '').toLowerCase().includes(q) ||
      entry.submitter.toLowerCase().includes(q);
    const status = journalDisplayStatus(entry, reversedIds);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesProject = projectFilter === 'all' || entry.projectId === projectFilter;
    return matchesSearch && matchesStatus && matchesProject;
  });
  const entriesPage = usePagination(filteredEntries, filteredEntries.length);

  const newDocForm: ManualEntryFormInput = {
    date: newDocDate,
    type: newDocType,
    title: newDocTitle,
    projectId: newDocProjectId,
    costCenterId: newDocCostCenterId,
    rows: newDocRows,
  };
  // Totals, balance and the first problem of the voucher being typed.
  const newDocDraft = computeManualEntryDraft(newDocForm);
  const { totalDebit: totalDebitNew, totalCredit: totalCreditNew, isBalanced: isFormBalanced } = newDocDraft;

  const updateRow = (id: string, patch: Partial<JournalEntryRow>) =>
    setNewDocRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const resetForm = () => {
    setNewDocTitle('');
    setNewDocRows([emptyRow(), emptyRow()]);
    setFormError(null);
  };

  const handleSubmitNewDoc = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (newDocDraft.error) return setFormError(newDocDraft.error);
    const result = onCreateEntry(newDocForm);
    if (!result.ok) return setFormError(result.message);
    setIsNewDocModalOpen(false);
    resetForm();
  };

  const statusBadge = (entry: JournalEntry) => {
    if (reversedIds.has(entry.id)) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-1 rounded-md">
          <RotateCcw className="w-3 h-3 text-slate-500" />
          <span>معکوس‌شده</span>
        </span>
      );
    }
    switch (entry.status) {
      case 'ثبت قطعی':
      case 'تأیید شده':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
            <Lock className="w-3 h-3 text-emerald-700" />
            <span>{entry.reversedFromDocId ? 'سند معکوس (قطعی)' : 'قطعی'}</span>
          </span>
        );
      case 'در انتظار تأیید':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
            <Clock className="w-3 h-3 text-amber-700" />
            <span>در انتظار تأیید</span>
          </span>
        );
      case 'برگشت خورده':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-1 rounded-md">
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>برگشت خورده</span>
          </span>
        );
      case 'رد شده':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md">
            <XCircle className="w-3 h-3 text-rose-700" />
            <span>رد شده</span>
          </span>
        );
      default:
        return <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md">پیش‌نویس</span>;
    }
  };

  /** A final, non-reversal entry without an existing reversal is the only thing that can be reversed. */
  const canReverse = (e: JournalEntry) => journalEntryActions(currentUser, e, reversedIds, pendingReversalIds).canReverse;

  const run = (result: WorkflowResult, onDone: () => void) => {
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    setActionError(null);
    onDone();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="جستجو در اسناد"
              placeholder="جستجو در شماره سند، شرح، پروژه، ثبت‌کننده..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              aria-label="وضعیت"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">تمام وضعیت‌ها</option>
              <option value="ثبت قطعی">ثبت قطعی</option>
              <option value="تأیید شده">تأیید شده</option>
              <option value="در انتظار تأیید">در انتظار تأیید</option>
              <option value="برگشت خورده">معکوس‌شده</option>
              <option value="رد شده">رد شده</option>
            </select>
            <select
              aria-label="پروژه"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">تمام پروژه‌ها</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatText(p.name)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {can('journal.create') && (
          <button
            onClick={() => setIsNewDocModalOpen(true)}
            className="btn btn-primary shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت سند حسابداری جدید</span>
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
        <Lock className="w-3.5 h-3.5 text-slate-500" />
        اسناد قطعی قابل ویرایش یا حذف نیستند؛ اصلاح فقط با صدور سند معکوس انجام می‌شود.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium select-none">
              <tr>
                <th className="py-3 px-4 tabular-nums">شماره سند</th>
                <th className="py-3 px-3">تاریخ</th>
                <th className="py-3 px-4">شرح سند</th>
                <th className="py-3 px-3">نوع سند</th>
                <th className="py-3 px-3">پروژه و مرکز هزینه</th>
                <th className="py-3 px-3">ثبت‌کننده</th>
                <th className="py-3 px-3 tabular-nums text-left">مبلغ کل سند ({unit})</th>
                <th className="py-3 px-3 text-center">وضعیت</th>
                <th className="py-3 px-4 text-center">اقدامات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entriesPage.rows.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 tabular-nums font-bold text-slate-900">{formatText(entry.docNumber)}</td>
                  <td className="py-3 px-3 text-slate-600 tabular-nums text-sm">{formatText(entry.date)}</td>
                  <td className="py-3 px-4 text-slate-800 font-medium max-w-xs truncate" title={entry.title}>
                    {formatText(entry.title)}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-1 rounded">{formatText(entry.type)}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    <div className="font-medium text-slate-800 text-sm truncate max-w-[150px]">{formatText(entry.projectName || 'دفتر مرکزی')}</div>
                    {entry.costCenterName && <span className="text-xs text-slate-500 block truncate">{formatText(entry.costCenterName)}</span>}
                  </td>
                  <td className="py-3 px-3 text-slate-600 text-sm">{formatText(entry.submitter)}</td>
                  <td className="py-3 px-3 font-bold text-slate-900 text-left tabular-nums">{formatMoney(entry.totalDebit, false)}</td>
                  <td className="py-3 px-3 text-center">{statusBadge(entry)}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => {
                        setActionError(null);
                        setSelectedId(entry.id);
                      }}
                      className="px-2 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>مشاهده آرتیکل‌ها</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePager pager={entriesPage} label="صفحه‌بندی اسناد حسابداری" />
        {filteredEntries.length === 0 && <div className="py-12 text-center text-slate-500 text-xs">سند حسابداری با مشخصات جستجوشده یافت نشد.</div>}
      </div>

      {selectedEntry && (
        <Dialog
          onClose={() => setSelectedId(null)}
          label={`سند حسابداری ${selectedEntry.docNumber}`}
          overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col text-right overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span>سند حسابداری: {formatText(selectedEntry.docNumber)}</span>
                  {statusBadge(selectedEntry)}
                </h3>
                <span className="text-xs text-slate-500">
                  تاریخ سند: {formatText(selectedEntry.date)} · ثبت‌کننده: {formatText(selectedEntry.submitter)}
                </span>
              </div>
            </div>
            <button onClick={() => setSelectedId(null)} aria-label="بستن" className="text-slate-500 hover:text-white p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6">
            {selectedEntry.reversedFromDocId && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                این سند، سند معکوس سند {selectedEntry.reversedFromDocNumber || entryByNumber.get(selectedEntry.reversedFromDocId)?.docNumber} است و خود قابل معکوس‌شدن نیست.
              </div>
            )}
            {reversedIds.has(selectedEntry.id) && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                اثر این سند با سند معکوس {reversalOf(selectedEntry.id)?.docNumber} خنثی شده است.
              </div>
            )}
            {pendingReversalIds.has(selectedEntry.id) && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                سند معکوس {reversalOf(selectedEntry.id)?.docNumber} برای این سند ثبت شده و در انتظار تأیید کاربر دیگری است؛ تا تأیید آن، اثر این سند در دفاتر باقی است.
              </div>
            )}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-slate-500 text-xs block">عنوان سند:</span>
                <span className="font-bold text-slate-800">{formatText(selectedEntry.title)}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">نوع سند:</span>
                <span className="font-bold text-slate-800">{formatText(selectedEntry.type)}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">پروژه مرتبط:</span>
                <span className="font-bold text-slate-800">{formatText(selectedEntry.projectName || 'عمومی شرکت')}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">مرکز هزینه:</span>
                <span className="font-bold text-slate-800">{formatText(selectedEntry.costCenterName || 'دفتر مرکزی')}</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-2">آرتیکل‌های بدهکار و بستانکار سند:</h4>
              <div className="border border-slate-200 rounded-xl table-scroll">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-100 text-slate-600 font-medium border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center tabular-nums">#</th>
                      <th className="py-2 px-3">کد و نام حساب</th>
                      <th className="py-2 px-3">حساب تفصیلی</th>
                      <th className="py-2 px-3">شرح ردیف</th>
                      <th className="py-2 px-3 tabular-nums text-left">بدهکار ({unit})</th>
                      <th className="py-2 px-3 tabular-nums text-left">بستانکار ({unit})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEntry.rows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center text-slate-500 tabular-nums">{i + 1}</td>
                        <td className="py-2 px-3">
                          <span className="tabular-nums text-xs text-slate-500 block">{formatText(r.accountCode)}</span>
                          <span className="font-bold text-slate-900">{formatText(r.accountName)}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {r.subledgerName ? (
                            <div>
                              <span className="font-bold text-slate-800">{formatText(r.subledgerName)}</span>
                              {r.subledgerCode && <span className="tabular-nums text-xs text-slate-500 block">{formatText(r.subledgerCode)}</span>}
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-700">{formatText(r.description)}</td>
                        <td className="py-2 px-3 font-bold text-left text-slate-900 tabular-nums">{r.debit > 0 ? formatMoney(r.debit, false) : '-'}</td>
                        <td className="py-2 px-3 font-bold text-left text-slate-900 tabular-nums">{r.credit > 0 ? formatMoney(r.credit, false) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold tabular-nums">
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-left font-sans text-sm text-slate-700">
                        جمع کل ستون‌ها و تراز سند:
                      </td>
                      <td className="py-3 px-3 text-left text-emerald-700 tabular-nums">{formatMoney(selectedEntry.totalDebit, false)}</td>
                      <td className="py-3 px-3 text-left text-emerald-700 tabular-nums">{formatMoney(selectedEntry.totalCredit, false)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                <History className="w-4 h-4 text-amber-700" />
                <span>تاریخچه گردش سند:</span>
              </h4>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                {selectedEntry.history.map((h, idx) => (
                  <div key={`${h.date}-${h.time}-${h.action}-${idx}`} className="flex items-center justify-between text-sm text-slate-600 border-b border-slate-200/60 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <strong className="text-slate-800">{formatText(h.user)}:</strong>
                      <span>{formatText(h.action)}</span>
                    </div>
                    <span className="text-xs tabular-nums text-slate-500">
                      {formatText(h.date)} - ساعت {formatText(h.time)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {actionError && (
              <p className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800" role="alert">
                {actionError}
              </p>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ سند</span>
              </button>
              {canReverse(selectedEntry) && (
                <button
                  onClick={() => setReversingEntryId(selectedEntry.id)}
                  className="px-3 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 rounded-lg text-sm font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-700" />
                  <span>صدور سند معکوس</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedEntry.status === 'در انتظار تأیید' &&
                (() => {
                  const actions = journalEntryActions(currentUser, selectedEntry, reversedIds, pendingReversalIds);
                  const permission = { ok: actions.canApprove, reason: actions.approveReason };
                  if (!permission.ok) {
                    return <span className="text-sm bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 rounded-lg font-medium">{formatText(permission.reason)}</span>;
                  }
                  return (
                    <>
                      <button
                        onClick={() => setRejectingEntryId(selectedEntry.id)}
                        className="px-3 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-sm font-bold transition-colors cursor-pointer"
                      >
                        رد سند
                      </button>
                      <button
                        onClick={() => run(onApproveEntry(selectedEntry.id), () => setSelectedId(null))}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        تأیید و ثبت قطعی
                      </button>
                    </>
                  );
                })()}
              <button onClick={() => setSelectedId(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-sm font-medium cursor-pointer">
                بستن
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {reversingEntryId && (
        <Dialog
          onClose={() => {
            setReversingEntryId(null);
            setReversalReason('');
          }}
          label="صدور سند معکوس"
          overlayClassName="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full text-right shadow-2xl space-y-4"
        >
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="text-base font-bold">صدور سند معکوس</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            سند قطعی ویرایش یا حذف نمی‌شود؛ یک سند معکوس با جابه‌جایی بدهکار و بستانکار ثبت می‌شود و سند اصلی بدون تغییر باقی می‌ماند. سند معکوس سند دستی مانند هر سند دیگر با تأیید کاربر دیگری قطعی می‌شود.
          </p>
          <label className="block text-xs font-medium text-slate-700">
            علت و مستندات اصلاح:
            <textarea
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              rows={3}
              className="mt-1 w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-rose-500"
            />
          </label>
          {actionError && <p className="text-sm text-rose-700" role="alert">{actionError}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setReversingEntryId(null);
                setReversalReason('');
              }}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              انصراف
            </button>
            <button
              onClick={() =>
                run(onReverseEntry(reversingEntryId, reversalReason.trim()), () => {
                  setReversingEntryId(null);
                  setReversalReason('');
                  setSelectedId(null);
                })
              }
              disabled={!reversalReason.trim()}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-sm font-bold rounded-lg cursor-pointer"
            >
              صدور سند معکوس
            </button>
          </div>
        </Dialog>
      )}

      {rejectingEntryId && (
        <Dialog
          onClose={() => {
            setRejectingEntryId(null);
            setRejectionReason('');
          }}
          label="رد سند حسابداری"
          overlayClassName="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full text-right shadow-2xl space-y-4"
        >
          <h3 className="text-base font-bold text-rose-700">رد سند حسابداری</h3>
          <label className="block text-xs font-medium text-slate-700">
            علت رد سند:
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="mt-1 w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-rose-500"
            />
          </label>
          {actionError && <p className="text-sm text-rose-700" role="alert">{actionError}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setRejectingEntryId(null);
                setRejectionReason('');
              }}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              انصراف
            </button>
            <button
              onClick={() =>
                run(onRejectEntry(rejectingEntryId, rejectionReason.trim()), () => {
                  setRejectingEntryId(null);
                  setRejectionReason('');
                  setSelectedId(null);
                })
              }
              disabled={!rejectionReason.trim()}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-sm font-bold rounded-lg cursor-pointer"
            >
              ثبت رد سند
            </button>
          </div>
        </Dialog>
      )}

      {isNewDocModalOpen && (
        <Dialog
          as="form"
          onSubmit={handleSubmitNewDoc}
          onClose={() => setIsNewDocModalOpen(false)}
          label="ثبت سند حسابداری دستی"
          overlayClassName="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col text-right overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">ثبت سند حسابداری دستی</h3>
                <span className="text-xs text-slate-500">شماره سند پس از ثبت، به ترتیب سال مالی تاریخ سند تخصیص می‌یابد.</span>
              </div>
            </div>
            <button type="button" onClick={() => setIsNewDocModalOpen(false)} aria-label="بستن" className="text-slate-500 hover:text-white p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-5">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-center gap-2" role="alert">
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <label className="block text-xs font-medium text-slate-700">
                تاریخ سند:
                <input
                  type="text"
                  value={newDocDate}
                  onChange={(e) => setNewDocDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm tabular-nums"
                  required
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                نوع سند:
                <select
                  value={newDocType}
                  onChange={(e) => setNewDocType(e.target.value as JournalEntryType)}
                  className="mt-1 w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer"
                >
                  <option value="عمومی">عمومی / متفرقه</option>
                  <option value="خرید و مصالح">خرید و مصالح</option>
                  <option value="صورت وضعیت">صورت وضعیت کارکرد</option>
                  <option value="تنخواه گردان">تنخواه گردان</option>
                  <option value="دریافت">دریافت</option>
                  <option value="پرداخت">پرداخت</option>
                  <option value="حقوق و دستمزد">حقوق و دستمزد</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-700">
                پروژه مرتبط:
                <select
                  value={newDocProjectId}
                  onChange={(e) => setNewDocProjectId(e.target.value)}
                  className="mt-1 w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer"
                >
                  <option value="">بدون انتساب (عمومی ستاد)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatText(p.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-700">
                مرکز هزینه:
                <select
                  value={newDocCostCenterId}
                  onChange={(e) => setNewDocCostCenterId(e.target.value)}
                  className="mt-1 w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer"
                >
                  <option value="">انتخاب مرکز هزینه...</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {formatText(cc.name)} ({cc.code})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-xs font-medium text-slate-700">
              شرح کلی سند:
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                required
              />
            </label>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-800">ردیف‌های بدهکار و بستانکار ({unit}):</h4>
                <button
                  type="button"
                  onClick={() => setNewDocRows((prev) => [...prev, emptyRow()])}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن ردیف</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl table-scroll">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-100 text-slate-600 font-medium border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2 w-8 text-center tabular-nums">#</th>
                      <th className="py-2 px-2 w-56">حساب</th>
                      <th className="py-2 px-2 w-44">تفصیلی</th>
                      <th className="py-2 px-2">شرح ردیف</th>
                      <th className="py-2 px-2 w-36">بدهکار</th>
                      <th className="py-2 px-2 w-36">بستانکار</th>
                      <th className="py-2 px-2 w-10 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {newDocRows.map((row, idx) => (
                      <tr key={row.id}>
                        <td className="py-2 px-2 text-center text-slate-500 tabular-nums">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <select
                            aria-label={`حساب ردیف ${idx + 1}`}
                            value={row.accountCode}
                            onChange={(e) => {
                              const acc = accounts.find((a) => a.code === e.target.value);
                              updateRow(row.id, { accountCode: acc?.code || '', accountName: acc?.title || '' });
                            }}
                            className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded"
                          >
                            <option value="">انتخاب حساب...</option>
                            {accounts.map((a) => (
                              <option key={a.code} value={a.code}>
                                {formatText(a.code)} - {formatText(a.title)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <select
                            aria-label={`تفصیلی ردیف ${idx + 1}`}
                            value={row.subledgerCode || ''}
                            onChange={(e) => {
                              const sub = subledgers.find((s) => s.code === e.target.value);
                              updateRow(row.id, { subledgerCode: e.target.value, subledgerName: sub ? sub.name : '' });
                            }}
                            className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded"
                          >
                            <option value="">بدون تفصیلی</option>
                            {subledgers.map((s) => (
                              <option key={s.id} value={s.code}>
                                {formatText(s.name)} ({s.code})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            aria-label={`شرح ردیف ${idx + 1}`}
                            value={row.description}
                            onChange={(e) => updateRow(row.id, { description: e.target.value })}
                            className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded"
                            required
                          />
                        </td>
                        <td className="py-2 px-2">
                          <MoneyInput
                            aria-label={`بدهکار ردیف ${idx + 1}`}
                            value={row.debit}
                            blankZero
                            onValueChange={(v) => updateRow(row.id, { debit: v, credit: v > 0 ? 0 : row.credit })}
                            className="w-full p-2 text-sm tabular-nums text-left bg-slate-50 border border-slate-200 rounded"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <MoneyInput
                            aria-label={`بستانکار ردیف ${idx + 1}`}
                            value={row.credit}
                            blankZero
                            onValueChange={(v) => updateRow(row.id, { credit: v, debit: v > 0 ? 0 : row.debit })}
                            className="w-full p-2 text-sm tabular-nums text-left bg-slate-50 border border-slate-200 rounded"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            aria-label={`حذف ردیف ${idx + 1}`}
                            onClick={() => setNewDocRows((prev) => (prev.length <= 2 ? prev : prev.filter((r) => r.id !== row.id)))}
                            disabled={newDocRows.length <= 2}
                            className="text-slate-500 hover:text-rose-600 disabled:opacity-30 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold tabular-nums">
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-left font-sans text-sm text-slate-700">
                        جمع ستون‌ها:
                      </td>
                      <td className="py-3 px-2 text-left font-bold text-slate-900">{formatMoney(totalDebitNew, false)}</td>
                      <td className="py-3 px-2 text-left font-bold text-slate-900">{formatMoney(totalCreditNew, false)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div
                className={`mt-3 p-3 rounded-xl border flex items-center justify-between text-sm tabular-nums ${
                  isFormBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isFormBalanced ? <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />}
                  <span className="font-sans font-medium">{isFormBalanced ? 'سند متوازن است.' : 'سند نامتوازن است و ثبت آن مجاز نیست.'}</span>
                </div>
                <div>
                  <span>اختلاف: </span>
                  <strong className="text-sm"><Money rial={newDocDraft.difference} /></strong>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">سند پس از ذخیره در انتظار تأیید حسابدار/مدیر ارشد (غیر از ثبت‌کننده) می‌ماند.</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setIsNewDocModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
                انصراف
              </button>
              <button
                type="submit"
                disabled={!isFormBalanced || !newDocTitle.trim()}
                className="btn btn-primary"
              >
                ثبت سند
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
