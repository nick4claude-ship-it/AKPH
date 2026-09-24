/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Contract, UserProfile } from '../../types';
import { ContractFile } from './contractFiles';
import { FileText, Download, Plus, Search, Paperclip, Eye } from 'lucide-react';

interface ContractDocumentsViewProps {
  contracts: Contract[];
  documents: ContractFile[];
  currentUser: UserProfile;
  /** Uploads happen in the single document center. */
  onUpload?: () => void;
}

export const ContractDocumentsView: React.FC<ContractDocumentsViewProps> = ({
  contracts,
  documents,
  currentUser,
  onUpload,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContractId, setSelectedContractId] = useState('all');

  const filteredDocs = documents.filter((doc) => {
    const matchSearch =
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.fileType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.uploaderName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchContract = selectedContractId === 'all' || doc.contractId === selectedContractId;
    return matchSearch && matchContract;
  });

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            مخزن اسناد، مدارک فنی و پیوست‌های قراردادها (Contract Document Repository)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            آرشیو متن پیمان‌ها، نقشه‌های اجرایی، ابلاغیه‌ها، صورت‌جلسات کارگاهی و کاربرگ‌های اکسل متره
          </p>
        </div>

        <button onClick={onUpload} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer">
          <Paperclip className="w-4 h-4" />
          <span>بارگذاری سند در مرکز اسناد</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="جستجو در عنوان فایل، نوع مدرک یا ثبت‌کننده..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50 focus:outline-amber-500"
          />
        </div>

        <select
          value={selectedContractId}
          onChange={(e) => setSelectedContractId(e.target.value)}
          className="p-2 rounded-lg border border-slate-200 bg-white"
        >
          <option value="all">همه قراردادها</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} - {c.projectTitle.slice(0, 30)}...
            </option>
          ))}
        </select>
      </div>

      {/* Grid of Documents */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => {
          const contract = contracts.find((c) => c.id === doc.contractId);
          return (
            <div
              key={doc.id}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-xl bg-amber-50 text-amber-700 shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate" title={doc.fileName}>
                    {doc.fileName}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {contract?.code} · {contract?.projectTitle.slice(0, 25)}...
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {doc.fileType}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">نسخه {doc.version}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {doc.uploadDate} · {doc.fileSize}
                </span>
                <button
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
                  title="دانلود فایل"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
