import React, { useState, useEffect } from 'react';
import { Project, ApprovalItem, DetailedProgressStatement, PettyCashAccount } from '../../types';
import { formatCurrencyCompact, formatInt, formatText } from '../../utils/formatters';
import { Search, Building2, FileText, UserCheck, Coins, Receipt, X, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Dialog } from '../../ui/Dialog';
import { Money } from '../common/Money';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  approvals: ApprovalItem[];
  statements: DetailedProgressStatement[];
  pettyFunds: PettyCashAccount[];
  onSelectProject: (p: Project) => void;
  onSelectApproval: (a: ApprovalItem) => void;
  onSelectStatement: (s: DetailedProgressStatement) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  projects,
  approvals,
  statements,
  pettyFunds,
  onSelectProject,
  onSelectApproval,
  onSelectStatement,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // toggle search
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  // Matched Projects
  const matchedProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.client.toLowerCase().includes(q)
  );

  // Matched Invoices & Approvals
  const matchedApprovals = approvals.filter(
    (a) =>
      a.docNumber.toLowerCase().includes(q) ||
      a.projectName.toLowerCase().includes(q) ||
      (a.counterpartyName || '').toLowerCase().includes(q) ||
      a.requester.toLowerCase().includes(q) ||
      a.moduleLabel.toLowerCase().includes(q)
  );

  // Matched Progress Statements
  const matchedStatements = statements.filter(
    (s) =>
      s.statementNumber.toLowerCase().includes(q) ||
      s.projectName.toLowerCase().includes(q) ||
      (s.client || '').toLowerCase().includes(q)
  );

  // Matched Petty Cash
  const matchedPettyCash = pettyFunds.filter(
    (pc) =>
      pc.holderName.toLowerCase().includes(q) ||
      pc.projectName.toLowerCase().includes(q) ||
      pc.code.toLowerCase().includes(q)
  );

  const totalResults =
    matchedProjects.length +
    matchedApprovals.length +
    matchedStatements.length +
    matchedPettyCash.length;

  return (
    <Dialog onClose={onClose} label="جستجوی سراسری" overlayClassName="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-20" className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-right">
      
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50/60">
          <Search className="w-5 h-5 text-amber-700 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی سراسری: پروژه، فاکتور، سند مالی، تأمین‌کننده، صورت‌وضعیت..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-slate-500 hover:text-slate-600 cursor-pointer"
            >
              پاک کردن
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categories Tabs */}
        <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-sm">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-white text-slate-900 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            همه نتایج ({totalResults})
          </button>
          <button
            onClick={() => setActiveCategory('projects')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              activeCategory === 'projects'
                ? 'bg-white text-amber-700 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            پروژه‌ها ({formatInt(matchedProjects.length)})
          </button>
          <button
            onClick={() => setActiveCategory('approvals')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              activeCategory === 'approvals'
                ? 'bg-white text-rose-700 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            فاکتورها و اسناد ({formatInt(matchedApprovals.length)})
          </button>
          <button
            onClick={() => setActiveCategory('statements')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              activeCategory === 'statements'
                ? 'bg-white text-blue-700 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            صورت‌وضعیت‌ها ({formatInt(matchedStatements.length)})
          </button>
          <button
            onClick={() => setActiveCategory('petty')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              activeCategory === 'petty'
                ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تنخواه‌ها ({formatInt(matchedPettyCash.length)})
          </button>
        </div>

        {/* Results Scroll Area */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4 text-sm">
          {totalResults === 0 ? (
            <div className="py-12 text-center text-slate-500">
              موردی مطابق با عبارت «{query}» پیدا نشد.
            </div>
          ) : (
            <>
              {/* Projects Section */}
              {(activeCategory === 'all' || activeCategory === 'projects') &&
                matchedProjects.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 mb-2 px-2">پروژه‌های عمرانی</h4>
                    <div className="space-y-1">
                      {matchedProjects.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            onSelectProject(p);
                            onClose();
                          }}
                          className="p-2 rounded-lg hover:bg-amber-50/50 border border-transparent hover:border-amber-200 transition-colors cursor-pointer flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                              <Building2 className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-2">
                                <span>{formatText(p.name)}</span>
                                <span className="tabular-nums text-xs text-slate-500 bg-slate-100 px-1 py-1 rounded">
                                  {formatText(p.code)}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">کارفرما: {formatText(p.client)}</div>
                            </div>
                          </div>
                          <div className="text-left tabular-nums">
                            <div className="font-bold text-slate-800"><Money rial={p.contractAmount} compact /></div>
                            <div className="text-sm text-emerald-700">{formatText(p.status)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Invoices & Approvals Section */}
              {(activeCategory === 'all' || activeCategory === 'approvals') &&
                matchedApprovals.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 mb-2 px-2">اسناد مالی و فاکتورها</h4>
                    <div className="space-y-1">
                      {matchedApprovals.map((a) => (
                        <div
                          key={a.id}
                          onClick={() => {
                            onSelectApproval(a);
                            onClose();
                          }}
                          className="p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                              <Receipt className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-2">
                                <span className="tabular-nums text-amber-700">{formatText(a.docNumber)}</span>
                                <span>-</span>
                                <span>{formatText(a.moduleLabel)}</span>
                              </div>
                              <div className="text-xs text-slate-500">
                                {formatText(a.projectName)} · طرف حساب: {formatText(a.counterpartyName || '-')}
                              </div>
                            </div>
                          </div>
                          <div className="text-left tabular-nums">
                            <div className="font-bold text-slate-900"><Money rial={a.amount} compact /></div>
                            <div className="text-sm text-amber-700">{formatText(a.stage)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Progress Statements */}
              {(activeCategory === 'all' || activeCategory === 'statements') &&
                matchedStatements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 mb-2 px-2">صورت‌وضعیت‌ها</h4>
                    <div className="space-y-1">
                      {matchedStatements.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            onSelectStatement(s);
                            onClose();
                          }}
                          className="p-2 rounded-lg hover:bg-blue-50/50 border border-transparent hover:border-blue-200 transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{formatText(s.statementNumber)}</div>
                              <div className="text-xs text-slate-500">{formatText(s.projectName)}</div>
                            </div>
                          </div>
                          <div className="text-left tabular-nums">
                            <div className="font-bold text-emerald-700"><Money rial={s.approvedNetPayable ?? s.netPayable} compact /></div>
                            <div className="text-xs text-slate-500">{formatText(s.status)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>راهنما: برای پیمایش از کیبورد و کلید Escape استفاده کنید.</span>
          </div>
          <span className="tabular-nums text-slate-500">Ctrl + K</span>
        </div>
      </Dialog>
  );
};
