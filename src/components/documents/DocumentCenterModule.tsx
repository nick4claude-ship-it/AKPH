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
import { Project } from '../../types';
import { SystemDocument, DocumentCategory } from '../../data/documentsMockData';
import { useStoreSlice } from '../../store/AppStore';

interface DocumentCenterModuleProps {
  projects: Project[];
}

export const DocumentCenterModule: React.FC<DocumentCenterModuleProps> = ({ projects }) => {
  const [documents, setDocuments] = useStoreSlice('documents');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<SystemDocument | null>(null);

  const handleDownloadFile = (title: string, format: string) => {
    const blob = new Blob(
      [`شرکت پایدار مدیریت پروژه\nعنوان سند: ${title}\nنوع فایل: ${format}\nتاریخ دریافت: ${new Date().toLocaleDateString('fa-IR')}`],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[\/\\:*?"<>|]/g, '_')}.${format.toLowerCase().includes('pdf') ? 'pdf' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // New Document Modal State
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<DocumentCategory>('نامه و مکاتبات رسمی');
  const [newDocProject, setNewDocProject] = useState(projects[0]?.id || '');
  const [newDocPartner, setNewDocPartner] = useState('');
  const [newDocFormat, setNewDocFormat] = useState<any>('PDF');
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

  const handleUploadDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle) return;

    const proj = projects.find((p) => p.id === newDocProject) || projects[0];

    const newDoc: SystemDocument = {
      id: `doc-${Date.now()}`,
      docNumber: `DOC-NEW-${Date.now().toString().slice(-4)}`,
      title: newDocTitle,
      category: newDocCategory,
      date: '۱۴۰۳/۰۷/۰۳',
      projectId: proj.id,
      projectName: proj.name,
      partnerName: newDocPartner || undefined,
      fileFormat: newDocFormat,
      fileSize: '۲.۱ MB',
      status: 'معتبر و جاری',
      confidentiality: 'عادی',
      registeredBy: 'مدیر سیستم',
      tags: ['جدید', proj.name],
      description: newDocDesc || 'سند بارگذاری شده در مرکز اسناد فنی و مالی شرکت.',
    };

    setDocuments((prev) => [newDoc, ...prev]);
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
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-slate-900 text-amber-400 font-bold px-2 py-0.5 rounded font-mono">
              مرکز اسناد یکپارچه سازمانی (Document Center DMS)
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
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
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          <span>بارگذاری سند جدید</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
            <input
              type="text"
              placeholder="جستجو در عنوان، شماره سند، برچسب‌ها..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none"
          >
            <option value="all">همه پروژه‌ها</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-400 font-mono text-[11px]">
          تعداد اسناد یافت شده: {filteredDocs.length}
        </span>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
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
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <strong className="block text-slate-900 font-medium leading-snug">{doc.title}</strong>
                    <span className="text-[10px] text-slate-400 font-mono">{doc.docNumber}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                      {doc.category}
                    </span>
                    <span className="inline-block mr-1 text-[10px] font-mono px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded font-bold">
                      {doc.fileFormat}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-slate-800 font-medium block truncate max-w-[170px]">
                      {doc.projectName}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-slate-700 block truncate max-w-[150px]">
                      {doc.partnerName || 'دفتر مرکزی'}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-500">{doc.date}</td>
                  <td className="py-3 px-3 font-mono text-slate-500">{doc.fileSize}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        doc.status === 'معتبر و جاری'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setSelectedDocForPreview(doc)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                        title="مشاهده جزئیات و محتوا"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownloadFile(doc.title, doc.fileFormat)}
                        className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg cursor-pointer"
                        title="دریافت فایل پیوست"
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
      </div>

      {/* Modal: Document Preview */}
      {selectedDocForPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 text-right animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <FileText className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedDocForPreview.title}</h3>
                  <span className="text-xs text-slate-400 font-mono">{selectedDocForPreview.docNumber}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedDocForPreview(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">پروژه منتسب:</span>
                  <strong className="text-slate-900">{selectedDocForPreview.projectName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">دسته‌بندی مدرک:</span>
                  <span className="font-semibold text-slate-800">{selectedDocForPreview.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">طرف‌حساب مرتبط:</span>
                  <span>{selectedDocForPreview.partnerName || '---'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">تاریخ ثبت:</span>
                  <span className="font-mono">{selectedDocForPreview.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">فرمت و حجم:</span>
                  <span className="font-mono">{selectedDocForPreview.fileFormat} • {selectedDocForPreview.fileSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">سطح محرمانگی:</span>
                  <span className="font-medium text-amber-800">{selectedDocForPreview.confidentiality}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block mb-1">شرح و محتوای سند:</span>
                <p className="text-slate-700 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed text-xs">
                  {selectedDocForPreview.description}
                </p>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block mb-1">برچسب‌ها:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedDocForPreview.tags.map((t, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">ثبت‌کننده: {selectedDocForPreview.registeredBy}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadFile(selectedDocForPreview.title, selectedDocForPreview.fileFormat)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>دانلود فایل پیوست</span>
                </button>
                <button
                  onClick={() => setSelectedDocForPreview(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs cursor-pointer font-medium"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Upload New Document */}
      {isNewDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">بارگذاری و بایگانی سند جدید</h3>
              <button
                onClick={() => setIsNewDocModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadDoc} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">عنوان سند:</label>
                <input
                  type="text"
                  placeholder="مثال: قرارداد تکمیلی، صورتجلسه کارگاهی..."
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  required
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">دسته‌بندی مدرک:</label>
                <select
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value as DocumentCategory)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  {categories.filter((c) => c.id !== 'all').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">پروژه منتسب:</label>
                <select
                  value={newDocProject}
                  onChange={(e) => setNewDocProject(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">طرف‌حساب مرتبط (کارفرما / پیمانکار / وندور):</label>
                <input
                  type="text"
                  placeholder="اختیاری..."
                  value={newDocPartner}
                  onChange={(e) => setNewDocPartner(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">فرمت فایل:</label>
                <select
                  value={newDocFormat}
                  onChange={(e) => setNewDocFormat(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  <option value="PDF">PDF Document</option>
                  <option value="DWG">AutoCAD DWG</option>
                  <option value="XLSX">Excel Spreadsheet</option>
                  <option value="DOCX">Word Document</option>
                  <option value="JPG">Image / Scan</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">توضیحات و خلاصه محتوا:</label>
                <textarea
                  rows={2}
                  placeholder="شرح مختصر..."
                  value={newDocDesc}
                  onChange={(e) => setNewDocDesc(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
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
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  ذخیره و ثبت سند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
