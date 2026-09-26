/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Download,
  Eye,
  Building2,
  HardHat,
  Truck,
  ShieldCheck,
  FolderOpen,
  Calendar,
  Layers,
  FileCode,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { AppDocument, DocumentCategory, DocumentEntityType, DocumentLink, Project } from '../../types';
import { useAppState } from '../../store/AppStore';
import { useWorkflows } from '../../store/useWorkflows';
import { useCurrentUser } from '../../store/session';
import { toPersianDate } from '../../utils/date';
import { usePagination } from '../../store/pagination';
import { TablePager } from '../common/TablePager';
import { Dialog } from '../../ui/Dialog';
import { formatInt, formatText } from '../../utils/formatters';

/** Labels for what a document can be linked to. */
const ENTITY_LABELS: Record<DocumentEntityType, string> = {
  project: 'پروژه',
  contract: 'قرارداد کارفرما',
  subcontract: 'قرارداد پیمانکار جزء',
  client_statement: 'صورت‌وضعیت کارفرما',
  subcontractor_statement: 'صورت‌وضعیت پیمانکار جزء',
  counterparty: 'طرف حساب',
  petty_cash_expense: 'هزینه تنخواه',
  vendor_invoice: 'فاکتور خرید',
  purchase_order: 'سفارش خرید',
  goods_receipt: 'رسید انبار',
  payment_request: 'درخواست پرداخت',
  receipt: 'دریافت',
  journal_entry: 'سند حسابداری',
};

type DocRow = AppDocument & { category: DocumentCategory; projectId: string; projectName: string; partnerName?: string };

interface DocumentCenterModuleProps {
  projects: Project[];
}

export const DocumentCenterModule: React.FC<DocumentCenterModuleProps> = ({ projects }) => {
  const state = useAppState();
  const wf = useWorkflows();
  const user = useCurrentUser();

  // Entities a document can be attached to, with display labels.
  const entityOptions = (type: DocumentEntityType, projectId?: string): Array<{ id: string; label: string }> => {
    const inProject = <T extends { projectId?: string }>(xs: T[]) => (projectId ? xs.filter((x) => x.projectId === projectId) : xs);
    switch (type) {
      case 'project':
        return state.projects.map((p) => ({ id: p.id, label: p.name }));
      case 'contract':
        return inProject(state.contracts).map((c) => ({ id: c.id, label: `${c.code} - ${c.projectTitle}` }));
      case 'subcontract':
        return inProject(state.subcontractorContracts).map((c) => ({ id: c.id, label: `${c.contractNumber} - ${c.subcontractorName}` }));
      case 'client_statement':
        return inProject(state.clientStatements).map((s) => ({ id: s.id, label: `${s.statementNumber} - ${s.projectName}` }));
      case 'subcontractor_statement':
        return inProject(state.subcontractorStatements).map((s) => ({ id: s.id, label: `${s.statementNumber} - ${s.subcontractorName}` }));
      case 'counterparty':
        return state.counterparties.map((c) => ({ id: c.id, label: c.name }));
      case 'petty_cash_expense':
        return inProject(state.pettyCashExpenses).map((e) => ({ id: e.id, label: `${e.expenseNumber} - ${e.description}` }));
      case 'vendor_invoice':
        return inProject(state.vendorInvoices).map((i) => ({ id: i.id, label: `${i.invoiceNumber} - ${i.supplierName}` }));
      case 'purchase_order':
        return inProject(state.purchaseOrders).map((p) => ({ id: p.id, label: `${p.poNumber} - ${p.supplierName}` }));
      case 'goods_receipt':
        return inProject(state.goodsReceipts).map((g) => ({ id: g.id, label: `${g.receiptNumber} - ${g.supplierName}` }));
      case 'payment_request':
        return state.paymentRequests.map((r) => ({ id: r.id, label: `${r.requestNumber} - ${r.beneficiaryName}` }));
      case 'receipt':
        return state.receipts.map((r) => ({ id: r.id, label: `${r.docNumber} - ${r.payer}` }));
      case 'journal_entry':
        return state.journalEntries.map((j) => ({ id: j.id, label: `${j.docNumber} - ${j.title}` }));
    }
  };
  const linkLabel = (l: DocumentLink) =>
    `${ENTITY_LABELS[l.entityType]}: ${entityOptions(l.entityType).find((o) => o.id === l.entityId)?.label || l.entityId}`;

  // View rows: project and counterparty come from the document's links.
  const documents: DocRow[] = state.documents.map((d) => {
    const projectId = d.links.find((l) => l.entityType === 'project')?.entityId || '';
    const partnerId = d.links.find((l) => l.entityType === 'counterparty')?.entityId;
    return {
      ...d,
      category: d.type,
      projectId,
      projectName: state.projects.find((p) => p.id === projectId)?.name || 'بدون پروژه',
      partnerName: state.counterparties.find((c) => c.id === partnerId)?.name,
    };
  });
  const [linkType, setLinkType] = useState<DocumentEntityType>('contract');
  const [linkId, setLinkId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<DocRow | null>(null);

  // Only a stored file can be downloaded; a metadata-only record has nothing to download yet.
  const handleDownloadFile = (doc: AppDocument) => {
    if (!doc.url) return;
    const a = document.createElement('a');
    a.href = doc.url;
    a.download = doc.fileName || doc.title;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // New Document Modal State
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<DocumentCategory>('نامه و مکاتبات رسمی');
  const [newDocProject, setNewDocProject] = useState(projects[0]?.id || '');
  const [newDocPartner, setNewDocPartner] = useState('');
  const [newDocLinkType, setNewDocLinkType] = useState<DocumentEntityType>('contract');
  const [newDocLinkId, setNewDocLinkId] = useState('');
  const [newDocFormat, setNewDocFormat] = useState<AppDocument['fileFormat']>('PDF');
  const [newDocDesc, setNewDocDesc] = useState('');

  const filteredDocs = documents.filter((doc) => {
    if (selectedCategory !== 'all' && doc.category !== selectedCategory) return false;
    if (selectedProjectId !== 'all' && doc.projectId !== selectedProjectId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.docNumber.toLowerCase().includes(q) ||
        doc.tags.some((t) => t.toLowerCase().includes(q)) ||
        (doc.partnerName && doc.partnerName.toLowerCase().includes(q))
      );
    }
    return true;
  });
  const docsPage = usePagination(filteredDocs, filteredDocs.length);

  const handleUploadDoc = (e: React.FormEvent) => {
    e.preventDefault();
    const result = wf.uploadDocument({
      title: newDocTitle,
      category: newDocCategory,
      format: newDocFormat,
      projectId: newDocProject,
      partnerId: newDocPartner,
      linkType: newDocLinkType,
      linkId: newDocLinkId,
      description: newDocDesc,
    });
    if (!result.ok) return;
    setIsNewDocModalOpen(false);
    setNewDocTitle('');
    setNewDocDesc('');
    setNewDocPartner('');
  };

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: 'همه دسته‌بندی‌ها' },
    { id: 'قرارداد اصلی کارفرما', label: 'قراردادهای کارفرما' },
    { id: 'قرارداد پیمانکار جزء', label: 'قراردادهای پیمانکاران جزء' },
    { id: 'صورت‌وضعیت کارفرما', label: 'صورت‌وضعیت‌های کارفرما' },
    { id: 'فاکتور خرید تأمین‌کننده', label: 'فاکتورهای تأمین‌کنندگان' },
    { id: 'ضمانت‌نامه بانکی', label: 'ضمانت‌نامه‌های بانکی' },
    { id: 'نقشه اجرایی و ازبیلت', label: 'نقشه‌ها و شاپ‌دراوینگ' },
    { id: 'نامه و مکاتبات رسمی', label: 'نامه‌ها و مکاتبات' },
    { id: 'صورتجلسه کارگاهی', label: 'صورتجلسات کارگاه' },
    { id: 'گزارش کنترل کیفیت و آزمایشگاه', label: 'گزارشات QC و آزمایشگاه' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-slate-900 text-amber-400 font-bold px-2 py-1 rounded tabular-nums">
              مرکز اسناد یکپارچه سازمانی
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded tabular-nums">
              متصل به پروژه، قرارداد، صورت‌وضعیت و طرف‌حساب
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            بایگانی الکترونیکی قراردادها، ضمانت‌نامه‌ها، صورت‌وضعیت‌ها و نقشه‌ها
          </h2>
          <p className="text-xs text-slate-500">
            جستجو و دسترسی سریع به فایل‌های معتبر با تفکیک سطوح محرمانگی و اتصال مستقیم به رویدادهای مالی و فنی
          </p>
        </div>

        <button
          onClick={() => setIsNewDocModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          <span>بارگذاری سند جدید</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
            <input aria-label="جستجو در عنوان، شماره سند، برچسب‌ها"
              type="text"
              placeholder="جستجو در عنوان، شماره سند، برچسب‌ها..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <select aria-label="فیلتر: دسته‌بندی"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-2 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {formatText(c.label)}
              </option>
            ))}
          </select>

          <select aria-label="فیلتر: پروژه‌ها"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="py-2 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
          >
            <option value="all">همه پروژه‌ها</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {formatText(p.name)}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-500 tabular-nums text-xs">
          تعداد اسناد یافت شده: {formatInt(filteredDocs.length)}
        </span>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="table-scroll">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">عنوان و شماره سند</th>
                <th className="py-3 px-3">دسته‌بندی و فرمت</th>
                <th className="py-3 px-3">پروژه منتسب</th>
                <th className="py-3 px-3">طرف‌حساب مرتبط</th>
                <th className="py-3 px-3">تاریخ ثبت</th>
                <th className="py-3 px-3">حجم</th>
                <th className="py-3 px-3">وضعیت</th>
                <th className="py-3 px-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docsPage.rows.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <strong className="block text-slate-900 font-medium leading-snug">{formatText(doc.title)}</strong>
                    <span className="text-xs text-slate-500 tabular-nums">{formatText(doc.docNumber)}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                      {formatText(doc.category)}
                    </span>
                    <span className="inline-block mr-1 text-xs tabular-nums px-2 py-0.2 bg-blue-50 text-blue-700 rounded font-bold">
                      {formatText(doc.fileFormat)}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-slate-800 font-medium block truncate max-w-[170px]">
                      {formatText(doc.projectName)}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-slate-700 block truncate max-w-[150px]">
                      {formatText(doc.partnerName || 'دفتر مرکزی')}
                    </span>
                  </td>
                  <td className="py-3 px-3 tabular-nums text-slate-500">{formatText(doc.date)}</td>
                  <td className="py-3 px-3 tabular-nums text-slate-500">{formatText(doc.fileSize)}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        doc.status === 'معتبر و جاری'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {formatText(doc.status)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedDocForPreview(doc)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                        title="مشاهده جزئیات و محتوا"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownloadFile(doc)}
                        disabled={!doc.url}
                        className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={doc.url ? 'دریافت فایل پیوست' : 'فایل اصلی هنوز بارگذاری نشده است (به‌زودی)'}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePager pager={docsPage} label="صفحه‌بندی اسناد" />
      </div>

      {/* Modal: Document Preview */}
      {selectedDocForPreview && (
        <Dialog onClose={() => setSelectedDocForPreview(null)} label="پیش‌نمایش سند" overlayClassName="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 text-right animate-in fade-in zoom-in-95 duration-150">
          
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <FileText className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{formatText(selectedDocForPreview.title)}</h3>
                  <span className="text-xs text-slate-500 tabular-nums">{formatText(selectedDocForPreview.docNumber)}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedDocForPreview(null)}
                className="text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm mb-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">پروژه منتسب:</span>
                  <strong className="text-slate-900">{formatText(selectedDocForPreview.projectName)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">دسته‌بندی مدرک:</span>
                  <span className="font-medium text-slate-800">{formatText(selectedDocForPreview.category)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">طرف‌حساب مرتبط:</span>
                  <span>{formatText(selectedDocForPreview.partnerName || '---')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">تاریخ ثبت:</span>
                  <span className="tabular-nums">{formatText(selectedDocForPreview.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">فرمت و حجم:</span>
                  <span className="tabular-nums">{formatText(selectedDocForPreview.fileFormat)} • {formatText(selectedDocForPreview.fileSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">سطح محرمانگی:</span>
                  <span className="font-medium text-amber-800">{formatText(selectedDocForPreview.confidentiality)}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 text-xs block mb-1">شرح و محتوای سند:</span>
                <p className="text-slate-700 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed text-sm">
                  {formatText(selectedDocForPreview.description)}
                </p>
              </div>

              <div>
                <span className="text-slate-500 text-xs block mb-1">متصل به:</span>
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedDocForPreview.links.map((l) => (
                    <span key={`${l.entityType}:${l.entityId}`} className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded text-xs">
                      {linkLabel(l)}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 mb-3">
                  <select aria-label="نوع رکورد مرتبط"
                    value={linkType}
                    onChange={(e) => {
                      setLinkType(e.target.value as DocumentEntityType);
                      setLinkId('');
                    }}
                    className="p-1 rounded border border-slate-200 text-sm"
                  >
                    {(Object.keys(ENTITY_LABELS) as DocumentEntityType[]).map((t) => (
                      <option key={t} value={t}>
                        {ENTITY_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <select aria-label="رکورد مرتبط" value={linkId} onChange={(e) => setLinkId(e.target.value)} className="p-1 rounded border border-slate-200 text-sm flex-1 min-w-0">
                    <option value="">— انتخاب رکورد —</option>
                    {entityOptions(linkType).map((o) => (
                      <option key={o.id} value={o.id}>
                        {formatText(o.label)}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!linkId}
                    onClick={() => {
                      wf.linkDocument(selectedDocForPreview.id, { entityType: linkType, entityId: linkId });
                      const d = state.documents.find((x) => x.id === selectedDocForPreview.id);
                      if (d) setSelectedDocForPreview({ ...selectedDocForPreview, links: [...selectedDocForPreview.links, { entityType: linkType, entityId: linkId }] });
                      setLinkId('');
                    }}
                    className="px-2 py-1 rounded bg-slate-900 text-white text-xs disabled:opacity-40 cursor-pointer"
                  >
                    پیوند
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-500 text-xs block mb-1">برچسب‌ها:</span>
                <div className="flex flex-wrap gap-1">
                  {[...new Set(selectedDocForPreview.tags)].map((t) => (
                    <span key={t} className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">ثبت‌کننده: {formatText(selectedDocForPreview.registeredBy)}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadFile(selectedDocForPreview)}
                  disabled={!selectedDocForPreview.url}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>{selectedDocForPreview.url ? 'دانلود فایل پیوست' : 'دانلود فایل (به‌زودی)'}</span>
                </button>
                <button
                  onClick={() => setSelectedDocForPreview(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm cursor-pointer font-medium"
                >
                  بستن
                </button>
              </div>
            </div>
          </Dialog>
      )}

      {/* Modal: Upload New Document */}
      {isNewDocModalOpen && (
        <Dialog onClose={() => setIsNewDocModalOpen(false)} label="بارگذاری و بایگانی سند جدید" overlayClassName="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4" className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 text-right">
          
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">بارگذاری و بایگانی سند جدید</h3>
              <button
                onClick={() => setIsNewDocModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadDoc} className="space-y-3 text-sm">
              <div>
                <label htmlFor="document-center-module-1" className="block font-medium text-slate-700 mb-1">عنوان سند:</label>
                <input id="document-center-module-1"
                  type="text"
                  placeholder="مثال: قرارداد تکمیلی، صورتجلسه کارگاهی..."
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  required
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label htmlFor="document-center-module-2" className="block font-medium text-slate-700 mb-1">دسته‌بندی مدرک:</label>
                <select id="document-center-module-2"
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value as DocumentCategory)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm"
                >
                  {categories.filter((c) => c.id !== 'all').map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatText(c.label)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="document-center-module-3" className="block font-medium text-slate-700 mb-1">پروژه منتسب:</label>
                <select id="document-center-module-3"
                  value={newDocProject}
                  onChange={(e) => setNewDocProject(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatText(p.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="document-center-module-4" className="block font-medium text-slate-700 mb-1">طرف‌حساب مرتبط (کارفرما / پیمانکار / وندور):</label>
                <select id="document-center-module-4"
                  value={newDocPartner}
                  onChange={(e) => setNewDocPartner(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm"
                >
                  <option value="">— اختیاری —</option>
                  {state.counterparties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatText(c.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="document-center-module-5" className="block font-medium text-slate-700 mb-1">اتصال به رکورد:</label>
                  <select id="document-center-module-5"
                    value={newDocLinkType}
                    onChange={(e) => {
                      setNewDocLinkType(e.target.value as DocumentEntityType);
                      setNewDocLinkId('');
                    }}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm"
                  >
                    {(Object.keys(ENTITY_LABELS) as DocumentEntityType[])
                      .filter((t) => t !== 'project' && t !== 'counterparty')
                      .map((t) => (
                        <option key={t} value={t}>
                          {ENTITY_LABELS[t]}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="document-center-module-6" className="block font-medium text-slate-700 mb-1">رکورد:</label>
                  <select id="document-center-module-6" value={newDocLinkId} onChange={(e) => setNewDocLinkId(e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm">
                    <option value="">— بدون اتصال —</option>
                    {entityOptions(newDocLinkType, newDocProject).map((o) => (
                      <option key={o.id} value={o.id}>
                        {formatText(o.label)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="document-center-module-7" className="block font-medium text-slate-700 mb-1">فرمت فایل:</label>
                <select id="document-center-module-7"
                  value={newDocFormat}
                  onChange={(e) => setNewDocFormat(e.target.value as AppDocument['fileFormat'])}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm"
                >
                  <option value="PDF">سند PDF</option>
                  <option value="DWG">نقشه اتوکد (DWG)</option>
                  <option value="XLSX">صفحه‌گسترده اکسل</option>
                  <option value="DOCX">سند ورد</option>
                  <option value="JPG">تصویر یا اسکن</option>
                </select>
              </div>

              <div>
                <label htmlFor="document-center-module-8" className="block font-medium text-slate-700 mb-1">توضیحات و خلاصه محتوا:</label>
                <textarea id="document-center-module-8"
                  rows={2}
                  placeholder="شرح مختصر..."
                  value={newDocDesc}
                  onChange={(e) => setNewDocDesc(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewDocModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="btn btn-secondary"
                >
                  ذخیره و ثبت سند
                </button>
              </div>
            </form>
          </Dialog>
      )}
    </div>
  );
};
