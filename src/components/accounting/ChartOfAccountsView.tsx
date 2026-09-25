import React, { useMemo, useState } from 'react';
import {
  Network,
  ChevronLeft,
  ChevronDown,
  Search,
  Folder,
  FolderOpen,
  FileText,
  Plus,
} from 'lucide-react';
import { AccountNode, JournalEntry } from '../../types';
import { formatMoney, moneyUnitLabel } from '../../utils/money';

interface ChartOfAccountsViewProps {
  chart: AccountNode[];
  /** Final entries; turnover and balance of every node are summed from their rows. */
  entries: JournalEntry[];
}

export const ChartOfAccountsView: React.FC<ChartOfAccountsViewProps> = ({ chart, entries }) => {
  // Posting rows by account code; a group node covers every code that starts with its own code.
  const totals = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    for (const e of entries) {
      for (const r of e.rows) {
        const cur = map.get(r.accountCode) || { debit: 0, credit: 0 };
        map.set(r.accountCode, { debit: cur.debit + r.debit, credit: cur.credit + r.credit });
      }
    }
    return map;
  }, [entries]);
  const nodeTotals = (code: string) => {
    let debit = 0;
    let credit = 0;
    for (const [c, v] of totals) {
      if (!c.startsWith(code)) continue;
      debit += v.debit;
      credit += v.credit;
    }
    return { debit, credit };
  };
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    '1': true,
    '11': true,
    '111': true,
    '2': true,
    '4': true,
    '5': true,
    '6': true,
  });
  const [searchTerm, setSearchTerm] = useState('');

  const toggleNode = (code: string) => {
    setExpandedNodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const renderNode = (node: AccountNode, depth: number = 0) => {
    const t = nodeTotals(node.code);
    const balance = node.nature === 'بستانکار' ? t.credit - t.debit : t.debit - t.credit;
    const isExpanded = expandedNodes[node.code];
    const hasChildren = node.children && node.children.length > 0;

    const matchesSearch =
      !searchTerm ||
      node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.code.includes(searchTerm);

    return (
      <div key={node.code} className="text-right">
        <div
          onClick={() => hasChildren && toggleNode(node.code)}
          className={`flex items-center justify-between py-2 px-3 hover:bg-slate-50 border-b border-slate-100 transition-colors cursor-pointer text-xs ${
            depth === 0 ? 'bg-slate-50/80 font-bold text-slate-900' : 'text-slate-800'
          }`}
          style={{ paddingRight: `${depth * 24 + 12}px` }}
        >
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <span className="text-slate-400 p-0.5">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronLeft className="w-3.5 h-3.5" />
                )}
              </span>
            ) : (
              <span className="w-4 h-4 inline-block" />
            )}

            {hasChildren ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-slate-400 shrink-0" />
              )
            ) : (
              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            )}

            <span className="font-mono font-bold text-slate-600 ml-1">{node.code}</span>
            <span className="font-medium">{node.title}</span>

            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-sans ${
                node.level === 'گروه'
                  ? 'bg-purple-50 text-purple-700 font-bold'
                  : node.level === 'کل'
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : node.level === 'معین'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {node.level}
            </span>
          </div>

          <div className="flex items-center gap-6 font-mono text-[11px]">
            <div className="w-24 text-left text-slate-500 hidden sm:block">
              گردش: {formatMoney(t.debit, false)}
            </div>
            <div className="w-28 text-left font-bold text-slate-900 tabular-nums">
              مانده: {formatMoney(balance, false)}
            </div>
            <div className="w-16 text-center font-sans">
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded ${
                  node.nature === 'بدهکار'
                    ? 'text-blue-700 bg-blue-50'
                    : 'text-amber-800 bg-amber-50'
                }`}
              >
                {node.nature}
              </span>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>{node.children!.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header & Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Network className="w-4 h-4 text-amber-600" />
            <span>درخت سرفصل‌های کدینگ حسابداری (Hierarchical Chart of Accounts)</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            ساختار درختی استاندارد شرکت‌های ساختمانی و عمرانی: گروه → کل → معین → تفصیلی
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="جستجو در کد یا نام سرفصل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Chart Tree Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-100 py-2 px-4 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-bold select-none">
          <span>ساختار سلسله‌مراتبی حساب‌ها</span>
          <div className="flex items-center gap-6 font-mono text-[11px]">
            <span className="w-24 text-left hidden sm:block">گردش بدهکار</span>
            <span className="w-28 text-left">مانده دفاتر ({moneyUnitLabel()})</span>
            <span className="w-16 text-center font-sans">ماهیت</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {chart.map((node) => renderNode(node, 0))}
        </div>
      </div>
    </div>
  );
};
