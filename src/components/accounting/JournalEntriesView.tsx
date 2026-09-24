import React, { useState } from 'react';
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
  FileText,
  Printer,
  ChevronDown,
  Building2,
  Trash2,
  AlertTriangle,
  History,
} from 'lucide-react';
import {
  JournalEntry,
  JournalEntryRow,
  JournalEntryStatus,
  JournalEntryType,
  Project,
  CostCenter,
  Subledger,
  UserProfile,
} from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { generateUUID, getNextSequentialDocNumber } from '../../utils/ids';
import { parseIntegerAmount } from '../../utils/money';
import { toPersianDate, toPersianTime, getCurrentPersianYear } from '../../utils/date';
import { can } from '../../utils/permissions';

interface JournalEntriesViewProps {
  entries: JournalEntry[];
  projects: Project[];
  costCenters: CostCenter[];
  subledgers: Subledger[];
  currentUser: UserProfile;
  onSaveNewEntry: (entry: JournalEntry) => void;
  onApproveEntry: (id: string) => void;
  onRejectEntry: (id: string, reason: string) => void;
  onReverseEntry: (id: string, reason: string) => void;
  isNewDocModalOpen: boolean;
  setIsNewDocModalOpen: (open: boolean) => void;
}

export const JournalEntriesView: React.FC<JournalEntriesViewProps> = ({
  entries,
  projects,
  costCenters,
  subledgers,
  currentUser,
  onSaveNewEntry,
  onApproveEntry,
  onRejectEntry,
  onReverseEntry,
  isNewDocModalOpen,
  setIsNewDocModalOpen,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // Reversal confirmation prompt state
  const [reversingEntryId, setReversingEntryId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Rejection prompt state
  const [rejectingEntryId, setRejectingEntryId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // New Entry Form State
  const [newDocDate, setNewDocDate] = useState(() => toPersianDate(new Date()));
  const [newDocType, setNewDocType] = useState<JournalEntryType>('خرید و مصالح');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocProjectId, setNewDocProjectId] = useState<string>('');
  const [newDocCostCenterId, setNewDocCostCenterId] = useState<string>('');
  const [newDocRows, setNewDocRows] = useState<JournalEntryRow[]>([
    {
      id: generateUUID(),
      accountCode: '511',
      accountName: 'هزینه مستقیم مصالح مصرفی',
      subledgerCode: '',
      subledgerName: '',
      description: '',
      debit: 0,
      credit: 0,
    },
    {
      id: generateUUID(),
      accountCode: '21101',
      accountName: 'بستانکاران تأمین‌کننده مصالح',
      subledgerCode: '',
      subledgerName: '',
      description: '',
      debit: 0,
      credit: 0,
    },
  ]);

  // Filtered Entries
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.docNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.projectName && entry.projectName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      entry.submitter.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    const matchesProject = projectFilter === 'all' || entry.projectId === projectFilter;

    return matchesSearch && matchesStatus && matchesProject;
  });

  // Calculate Balance for New Entry Form with strict integer logic
  const totalDebitNew = newDocRows.reduce((sum, r) => sum + (Math.floor(r.debit) || 0), 0);
  const totalCreditNew = newDocRows.reduce((sum, r) => sum + (Math.floor(r.credit) || 0), 0);
  const diffNew = totalDebitNew - totalCreditNew;

  // Strict validation: each row has account, either debit OR credit positive (not both, not neither), min 2 rows
  const areRowsValid =
    newDocRows.length >= 2 &&
    newDocRows.every(
      (r) =>
        Boolean(r.accountCode && r.accountName) &&
        ((r.debit > 0 && r.credit === 0) || (r.credit > 0 && r.debit === 0))
    );

  const isFormBalanced = totalDebitNew > 0 && totalDebitNew === totalCreditNew && areRowsValid;

  const handleAddRow = () => {
    setNewDocRows((prev) => [
      ...prev,
      {
        id: generateUUID(),
        accountCode: '511',
        accountName: 'هزینه مستقیم مصالح مصرفی',
        subledgerCode: '',
        subledgerName: '',
        description: '',
        debit: 0,
        credit: 0,
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (newDocRows.length <= 2) return;
    setNewDocRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRowChange = (id: string, field: keyof JournalEntryRow, value: any) => {
    setNewDocRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          if (field === 'debit') {
            const intDebit = parseIntegerAmount(value);
            return {
              ...r,
              debit: intDebit,
              credit: intDebit > 0 ? 0 : r.credit,
            };
          }
          if (field === 'credit') {
            const intCredit = parseIntegerAmount(value);
            return {
              ...r,
              credit: intCredit,
              debit: intCredit > 0 ? 0 : r.debit,
            };
          }
          return { ...r, [field]: value };
        }
        return r;
      })
    );
  };

  const handleSubmitNewDoc = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newDocRows.length < 2) {
      setFormError('سند حسابداری دوبل باید حداقل شامل دو آرتیکل (ردیف) باشد.');
      return;
    }

    for (let i = 0; i < newDocRows.length; i++) {
      const r = newDocRows[i];
      if (!r.accountCode) {
        setFormError(`ردیف شماره ${i + 1} فاقد سرفصل حساب معین است.`);
        return;
      }
      if ((r.debit === 0 && r.credit === 0) || (r.debit > 0 && r.credit > 0)) {
        setFormError(`در ردیف شماره ${i + 1} باید دقیقاً یکی از مقادیر بدهکار یا بستانکار بزرگتر از صفر باشد.`);
        return;
      }
    }

    if (totalDebitNew !== totalCreditNew || totalDebitNew <= 0) {
      setFormError('سند تراز نیست. جمع بدهکار باید دقیقاً با جمع بستانکار برابر و بزرگتر از صفر باشد.');
      return;
    }

    if (!newDocTitle.trim()) {
      setFormError('شرح کلی سند الزامی است.');
      return;
    }

    const project = projects.find((p) => p.id === newDocProjectId);
    const costCenter = costCenters.find((c) => c.id === newDocCostCenterId);

    const docNum = getNextSequentialDocNumber(
      entries.map((ent) => ent.docNumber),
      'ACC',
      4,
      getCurrentPersianYear()
    );

    const newDoc: JournalEntry = {
      id: generateUUID(),
      docNumber: docNum,
      date: newDocDate,
      title: newDocTitle,
      type: newDocType,
      projectId: project?.id,
      projectName: project?.name,
      costCenterId: costCenter?.id,
      costCenterName: costCenter?.name,
      submitter: currentUser.name,
      status: 'در انتظار تأیید',
      rows: newDocRows,
      totalDebit: totalDebitNew,
      totalCredit: totalCreditNew,
      isBalanced: isFormBalanced,
      history: [
        {
          date: toPersianDate(new Date()),
          time: toPersianTime(new Date()),
          user: currentUser.name,
          action: 'ایجاد سند و ارسال به کارتابل تأیید',
        },
      ],
    };

    onSaveNewEntry(newDoc);
    setIsNewDocModalOpen(false);

    // Reset Form
    setNewDocTitle('');
    setNewDocRows([
      {
        id: generateUUID(),
        accountCode: '511',
        accountName: 'هزینه مستقیم مصالح مصرفی',
        subledgerCode: '',
        subledgerName: '',
        description: '',
        debit: 0,
        credit: 0,
      },
      {
        id: generateUUID(),
        accountCode: '21101',
        accountName: 'بستانکاران تأمین‌کننده مصالح',
        subledgerCode: '',
        subledgerName: '',
        description: '',
        debit: 0,
        credit: 0,
      },
    ]);
  };

  const getStatusBadge = (status: JournalEntryStatus) => {
    switch (status) {
      case 'ثبت قطعی':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>ثبت قطعی در دفاتر</span>
          </span>
        );
      case 'تأیید شده':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            <span>تأیید شده</span>
          </span>
        );
      case 'در انتظار تأیید':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>در انتظار تأیید</span>
          </span>
        );
      case 'برگشت خورده':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md">
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>برگشت خورده (معکوس)</span>
          </span>
        );
      case 'رد شده':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>رد شده</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
            <span>پیش‌نویس</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header & Search Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="جستجو در شماره سند، شرح، پروژه، ثبت‌کننده..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">تمام وضعیت‌ها</option>
              <option value="ثبت قطعی">ثبت قطعی</option>
              <option value="تأیید شده">تأیید شده</option>
              <option value="در انتظار تأیید">در انتظار تأیید</option>
              <option value="برگشت خورده">برگشت خورده</option>
              <option value="رد شده">رد شده</option>
            </select>

            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">تمام پروژه‌ها</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => setIsNewDocModalOpen(true)}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-2xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت سند حسابداری جدید</span>
        </button>
      </div>

      {/* Journal Entries Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
              <tr>
                <th className="py-3 px-4 font-mono">شماره سند</th>
                <th className="py-3 px-3">تاریخ</th>
                <th className="py-3 px-4">شرح سند</th>
                <th className="py-3 px-3">نوع سند</th>
                <th className="py-3 px-3">پروژه و مرکز هزینه</th>
                <th className="py-3 px-3">ثبت‌کننده</th>
                <th className="py-3 px-3 font-mono text-left">مبلغ کل سند (تومان)</th>
                <th className="py-3 px-3 text-center">وضعیت</th>
                <th className="py-3 px-4 text-center">اقدامات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {entry.docNumber}
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                    {entry.date}
                  </td>
                  <td className="py-3 px-4 text-slate-800 font-medium max-w-xs truncate" title={entry.title}>
                    {entry.title}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {entry.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    <div className="font-semibold text-slate-800 text-[11px] truncate max-w-[150px]">
                      {entry.projectName || 'دفتر مرکزی'}
                    </div>
                    {entry.costCenterName && (
                      <span className="text-[10px] text-slate-400 block truncate">
                        {entry.costCenterName}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-600 text-[11px]">
                    {entry.submitter}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900 text-left tabular-nums">
                    {formatCurrency(entry.totalDebit)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {getStatusBadge(entry.status)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedEntry(entry)}
                      className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
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

        {filteredEntries.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-xs">
            سند حسابداری با مشخصات جستجویافته یافت نشد.
          </div>
        )}
      </div>

      {/* MODAL 1: VIEW JOURNAL ENTRY DETAILS (Drill-Down & Actions) */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col text-right overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span>سند حسابداری: {selectedEntry.docNumber}</span>
                    {getStatusBadge(selectedEntry.status)}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    تاریخ سند: {selectedEntry.date} · ثبت‌کننده: {selectedEntry.submitter}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedEntry(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Document Overview Strip */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">عنوان سند:</span>
                  <span className="font-bold text-slate-800">{selectedEntry.title}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">نوع سند:</span>
                  <span className="font-bold text-slate-800">{selectedEntry.type}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">پروژه مرتبط:</span>
                  <span className="font-bold text-slate-800">{selectedEntry.projectName || 'عمومی شرکت'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">مرکز هزینه:</span>
                  <span className="font-bold text-slate-800">{selectedEntry.costCenterName || 'دفتر مرکزی'}</span>
                </div>
              </div>

              {/* Rows (Articles) Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">
                  آرتیکل‌ها و ردیف‌های بدهکار و بستانکار سند:
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center font-mono">#</th>
                        <th className="py-2.5 px-3">کد و نام معین</th>
                        <th className="py-2.5 px-3">حساب تفصیلی</th>
                        <th className="py-2.5 px-3">شرح ردیف</th>
                        <th className="py-2.5 px-3 font-mono text-left">بدهکار (تومان)</th>
                        <th className="py-2.5 px-3 font-mono text-left">بستانکار (تومان)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedEntry.rows.map((r, i) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{i + 1}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[10px] text-slate-500 block">{r.accountCode}</span>
                            <span className="font-bold text-slate-900">{r.accountName}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {r.subledgerName ? (
                              <div>
                                <span className="font-bold text-slate-800">{r.subledgerName}</span>
                                {r.subledgerCode && (
                                  <span className="font-mono text-[10px] text-slate-400 block">{r.subledgerCode}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{r.description}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-left text-slate-900 tabular-nums">
                            {r.debit > 0 ? formatCurrency(r.debit) : '-'}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-left text-slate-900 tabular-nums">
                            {r.credit > 0 ? formatCurrency(r.credit) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold font-mono">
                      <tr>
                        <td colSpan={4} className="py-3 px-3 text-left font-sans text-xs text-slate-700">
                          جمع کل ستون‌ها و تراز سند:
                        </td>
                        <td className="py-3 px-3 text-left text-emerald-700 tabular-nums">
                          {formatCurrency(selectedEntry.totalDebit)}
                        </td>
                        <td className="py-3 px-3 text-left text-emerald-700 tabular-nums">
                          {formatCurrency(selectedEntry.totalCredit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Audit Trail & History Log */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-amber-600" />
                  <span>تاریخچه گردش سند و ردیابی حسابرسی (Audit Trail):</span>
                </h4>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                  {selectedEntry.history.map((h, idx) => (
                    <div key={`${h.date}-${h.time}-${h.action}-${idx}`} className="flex items-center justify-between text-xs text-slate-600 border-b border-slate-200/60 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <strong className="text-slate-800">{h.user}:</strong>
                        <span>{h.action}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {h.date} - ساعت {h.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer with Operational Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ سند</span>
                </button>

                {/* Reverse Document Button (Strict rule: No direct deletion of approved documents) */}
                {selectedEntry.status !== 'برگشت خورده' && selectedEntry.status !== 'رد شده' && (
                  <button
                    onClick={() => setReversingEntryId(selectedEntry.id)}
                    className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>صدور سند معکوس (Reverse Entry)</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedEntry.status === 'در انتظار تأیید' && (
                  <>
                    {selectedEntry.submitter.trim() === currentUser.name.trim() ? (
                      <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg font-medium">
                        تأیید سند توسط ثبت‌کننده مجاز نمی‌باشد (تفکیک وظایف)
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => setRejectingEntryId(selectedEntry.id)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          رد سند
                        </button>
                        <button
                          onClick={() => {
                            onApproveEntry(selectedEntry.id);
                            setSelectedEntry(null);
                          }}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          تأیید و صدور قطعی
                        </button>
                      </>
                    )}
                  </>
                )}
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-medium cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVERSAL REASON MODAL */}
      {reversingEntryId && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full text-right shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold">صدور سند معکوس و ابطال (Accounting Reversal)</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              طبق اصول استانداردهای حسابداری، اسناد تأییدشده حذف نمی‌شوند؛ بلکه یک سند معکوس متقابل با تاریخچه حسابرسی صادر می‌گردد.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                علت و مستندات اصلاح سند:
              </label>
              <textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="مثلاً: مغایرت در ثبت سرفصل مصالح یا اصلاح فاکتور رسمی..."
                rows={3}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setReversingEntryId(null);
                  setReversalReason('');
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  if (reversalReason.trim()) {
                    onReverseEntry(reversingEntryId, reversalReason);
                    setReversingEntryId(null);
                    setReversalReason('');
                    setSelectedEntry(null);
                  }
                }}
                disabled={!reversalReason.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                تأیید و صدور سند معکوس
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingEntryId && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full text-right shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-rose-700">رد سند حسابداری</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                علت رد سند:
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="مثلاً: عدم تطابق مبالغ با صورت‌جلسه کارگاهی یا عدم پیوست فاکتور رسمی..."
                rows={3}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setRejectingEntryId(null);
                  setRejectionReason('');
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  if (rejectionReason.trim()) {
                    onRejectEntry(rejectingEntryId, rejectionReason);
                    setRejectingEntryId(null);
                    setRejectionReason('');
                    setSelectedEntry(null);
                  }
                }}
                disabled={!rejectionReason.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                ثبت رد سند
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW JOURNAL ENTRY FORM (Requirement 4: Balanced Sheet, Rows, Cost Centers) */}
      {isNewDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitNewDoc}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col text-right overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">ثبت و صدور سند حسابداری دوبل</h3>
                  <span className="text-[11px] text-slate-400">
                    سیستم کنترل توازن بدهکار و بستانکار و تخصیص به پروژه و مراکز هزینه
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewDocModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {/* Document Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    تاریخ سند:
                  </label>
                  <input
                    type="text"
                    value={newDocDate}
                    onChange={(e) => setNewDocDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    نوع سند:
                  </label>
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer"
                  >
                    <option value="خرید و مصالح">خرید و مصالح</option>
                    <option value="صورت وضعیت">صورت وضعیت کارکرد</option>
                    <option value="تنخواه گردان">تنخواه گردان کارگاهی</option>
                    <option value="دریافت">دریافت نقد / چک</option>
                    <option value="پرداخت">پرداخت و تادیه</option>
                    <option value="حقوق و دستمزد">حقوق و دستمزد</option>
                    <option value="عمومی">عمومی / متفرقه</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    پروژه مرتبط:
                  </label>
                  <select
                    value={newDocProjectId}
                    onChange={(e) => setNewDocProjectId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer"
                  >
                    <option value="">بدون انتساب (عمومی ستاد)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    مرکز هزینه (Cost Center):
                  </label>
                  <select
                    value={newDocCostCenterId}
                    onChange={(e) => setNewDocCostCenterId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer"
                  >
                    <option value="">انتخاب مرکز هزینه...</option>
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name} ({cc.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  شرح کلی سند:
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: خرید ۱۲۰ تن میلگرد سایز ۲۰ و تخلیه در کارگاه فجر..."
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  required
                />
              </div>

              {/* Dynamic Rows Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800">
                    ردیف‌های بدهکار و بستانکار سند (آرتیکل‌ها):
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن ردیف جدید</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2 w-8 text-center font-mono">#</th>
                        <th className="py-2 px-2 w-48">حساب معین</th>
                        <th className="py-2 px-2 w-44">تفصیلی</th>
                        <th className="py-2 px-2">شرح ردیف</th>
                        <th className="py-2 px-2 w-36 font-mono">بدهکار (تومان)</th>
                        <th className="py-2 px-2 w-36 font-mono">بستانکار (تومان)</th>
                        <th className="py-2 px-2 w-10 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {newDocRows.map((row, idx) => (
                        <tr key={row.id}>
                          <td className="py-2 px-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-2">
                            <select
                              value={row.accountCode}
                              onChange={(e) => {
                                const code = e.target.value;
                                let name = 'سایر حساب‌ها';
                                if (code === '511') name = 'هزینه مستقیم مصالح مصرفی';
                                if (code === '512') name = 'دستمزد مستقیم نیروی انسانی';
                                if (code === '513') name = 'پیمانکاران جزء و دست‌دوم';
                                if (code === '11101') name = 'موجودی نزد بانک‌ها';
                                if (code === '11103') name = 'تنخواه‌گردان کارگاهی';
                                if (code === '11201') name = 'مطالبات از کارفرمایان';
                                if (code === '21101') name = 'بستانکاران تأمین‌کننده مصالح';
                                if (code === '411') name = 'درآمد کارکرد پیمانکاری';
                                handleRowChange(row.id, 'accountCode', code);
                                handleRowChange(row.id, 'accountName', name);
                              }}
                              className="w-full p-1.5 text-xs bg-slate-50 border border-slate-200 rounded"
                            >
                              <option value="511">511 - هزینه مستقیم مصالح</option>
                              <option value="512">512 - دستمزد مستقیم کارگاه</option>
                              <option value="513">513 - پیمانکاران جزء</option>
                              <option value="11101">11101 - موجودی بانک‌ها</option>
                              <option value="11103">11103 - تنخواه‌گردان</option>
                              <option value="11201">11201 - مطالبات کارفرما</option>
                              <option value="21101">21101 - بستانکاران مصالح</option>
                              <option value="411">411 - درآمد کارکرد پیمان</option>
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={row.subledgerCode || ''}
                              onChange={(e) => {
                                const code = e.target.value;
                                const sub = subledgers.find((s) => s.code === code);
                                handleRowChange(row.id, 'subledgerCode', code);
                                handleRowChange(row.id, 'subledgerName', sub ? sub.name : '');
                              }}
                              className="w-full p-1.5 text-xs bg-slate-50 border border-slate-200 rounded"
                            >
                              <option value="">انتخاب تفصیلی...</option>
                              {subledgers.map((s) => (
                                <option key={s.id} value={s.code}>
                                  {s.name} ({s.code})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) => handleRowChange(row.id, 'description', e.target.value)}
                              placeholder="شرح ردیف..."
                              className="w-full p-1.5 text-xs bg-slate-50 border border-slate-200 rounded"
                              required
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              value={row.debit || ''}
                              onChange={(e) => handleRowChange(row.id, 'debit', Number(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full p-1.5 text-xs font-mono text-left bg-slate-50 border border-slate-200 rounded"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              value={row.credit || ''}
                              onChange={(e) => handleRowChange(row.id, 'credit', Number(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full p-1.5 text-xs font-mono text-left bg-slate-50 border border-slate-200 rounded"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.id)}
                              disabled={newDocRows.length <= 2}
                              className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold font-mono">
                      <tr>
                        <td colSpan={4} className="py-3 px-3 text-left font-sans text-xs text-slate-700">
                          جمع ستون‌ها:
                        </td>
                        <td className="py-3 px-2 text-left font-bold text-slate-900">
                          {formatCurrency(totalDebitNew)}
                        </td>
                        <td className="py-3 px-2 text-left font-bold text-slate-900">
                          {formatCurrency(totalCreditNew)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Balance Check Box */}
                <div
                  className={`mt-3 p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                    isFormBalanced
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isFormBalanced ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-sans font-semibold">
                      {isFormBalanced
                        ? 'سند کاملاً متوازن است (جمع بدهکار با جمع بستانکار برابر است).'
                        : 'سند نامتوازن است! طبق اصول حسابداری، ثبت سند نامتوازن مجاز نمی‌باشد.'}
                    </span>
                  </div>
                  <div>
                    <span>اختلاف تراز: </span>
                    <strong className="text-sm">{formatCurrency(Math.abs(diffNew))} تومان</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                سند پس از ذخیره وارد کارتابل در انتظار تأیید مدیر مالی خواهد شد.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewDocModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={!isFormBalanced || !newDocTitle.trim()}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                >
                  ثبت سند حسابداری
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
