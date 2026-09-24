/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowRight, Search, UserCheck, HardHat, Truck, ShieldCheck, FileText, Phone, Mail, MapPin } from 'lucide-react';
import { Project, CounterpartyKind } from '../../types';
import { useAppState } from '../../store/AppStore';
import { selectCounterpartyProfile, CounterpartyProfile } from '../../store/domainSelectors';
import { CLIENT_STATUS_LABELS, SUB_STATUS_LABELS } from '../statements/statementLabels';
import { formatNumber, formatCurrencyCompact } from '../../utils/formatters';

type PartnerKind = 'clients' | 'subcontractors' | 'suppliers';

const KIND_META: Record<PartnerKind, { kind: CounterpartyKind; title: string; icon: typeof UserCheck; executed: string; approved: string; settled: string; balance: string; contracts: string }> = {
  clients: { kind: 'client', title: 'کارفرمایان', icon: UserCheck, executed: 'کارکرد اجراشده', approved: 'صورت‌وضعیت مصوب', settled: 'دریافتی', balance: 'مطالبات', contracts: 'قراردادهای کارفرما' },
  subcontractors: { kind: 'subcontractor', title: 'پیمانکاران جزء', icon: HardHat, executed: 'کارکرد', approved: 'صورت‌وضعیت مصوب', settled: 'پرداختی', balance: 'مانده بدهی', contracts: 'قراردادهای جزء' },
  suppliers: { kind: 'supplier', title: 'تأمین‌کنندگان', icon: Truck, executed: 'کالای تحویلی', approved: 'فاکتور مصوب', settled: 'پرداختی', balance: 'بدهی', contracts: 'سفارش‌های خرید' },
};

interface PartnersModuleProps {
  projects: Project[];
  kind: PartnerKind;
  counterpartyId?: string;
  onOpenProfile: (id: string | null) => void;
  onNavigate: (path: string) => void;
}

const Stat: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-slate-900' }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
    <div className="text-[10px] text-slate-500">{label}</div>
    <div className={`text-sm font-bold font-mono ${tone}`}>{value}</div>
  </div>
);

const statusLabel = (s: string) => (CLIENT_STATUS_LABELS as Record<string, string>)[s] || (SUB_STATUS_LABELS as Record<string, string>)[s] || s;

/** طرف‌های حساب: فهرست و پروفایل هر کارفرما، پیمانکار جزء یا تأمین‌کننده؛ همه ارقام از store محاسبه می‌شود. */
export const PartnersModule: React.FC<PartnersModuleProps> = ({ kind, counterpartyId, onOpenProfile, onNavigate }) => {
  const state = useAppState();
  const [search, setSearch] = useState('');
  const meta = KIND_META[kind];
  const Icon = meta.icon;

  const profiles = useMemo(
    () =>
      state.counterparties
        .filter((c) => c.kind === meta.kind)
        .map((c) => selectCounterpartyProfile(state, c.id))
        .filter((p): p is CounterpartyProfile => Boolean(p)),
    [state, meta.kind]
  );

  const profile = counterpartyId ? selectCounterpartyProfile(state, counterpartyId) : undefined;

  if (!profile) {
    const q = search.trim().toLowerCase();
    const rows = profiles.filter((p) => !q || p.counterparty.name.toLowerCase().includes(q));
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Icon className="w-5 h-5 text-amber-600" /> {meta.title}
            <span className="text-xs font-normal text-slate-500">({rows.length.toLocaleString('fa-IR')})</span>
          </h2>
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام..."
              className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-500 text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">نام</th>
                <th className="py-2.5 px-3 text-left">{meta.contracts}</th>
                <th className="py-2.5 px-3 text-left">پروژه‌ها</th>
                <th className="py-2.5 px-3 text-left">{meta.executed}</th>
                <th className="py-2.5 px-3 text-left">{meta.approved}</th>
                <th className="py-2.5 px-3 text-left">{meta.settled}</th>
                <th className="py-2.5 px-3 text-left">{meta.balance} (دفاتر)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.counterparty.id} className="hover:bg-slate-50/70 cursor-pointer" onClick={() => onOpenProfile(p.counterparty.id)}>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{p.counterparty.name}</div>
                    <div className="text-[10px] text-slate-400">{p.counterparty.tradeType || p.counterparty.nationalId || ''}</div>
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono">{p.contracts.length.toLocaleString('fa-IR')}</td>
                  <td className="py-2.5 px-3 text-left font-mono">{p.projects.length.toLocaleString('fa-IR')}</td>
                  <td className="py-2.5 px-3 text-left font-mono">{formatCurrencyCompact(p.executed)}</td>
                  <td className="py-2.5 px-3 text-left font-mono">{formatCurrencyCompact(p.approvedStatements)}</td>
                  <td className="py-2.5 px-3 text-left font-mono text-emerald-700">{formatCurrencyCompact(p.paidOrReceived)}</td>
                  <td className="py-2.5 px-3 text-left font-mono font-bold text-amber-700">{formatCurrencyCompact(p.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const c = profile.counterparty;
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => onOpenProfile(null)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer" title="بازگشت">
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <div className="text-[10px] text-amber-700 font-bold">{meta.title}</div>
            <h2 className="text-base font-bold text-slate-900">{c.name}</h2>
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mt-0.5">
              {c.nationalId && <span>شناسه ملی: {c.nationalId}</span>}
              {c.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {c.phone}
                </span>
              )}
              {c.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {c.email}
                </span>
              )}
              {c.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {c.address}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-left">
          <div className="text-[10px] text-slate-500">سابقه عملکرد (بدون برگشت/مغایرت)</div>
          <div className={`text-lg font-bold ${profile.performance.score >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>{profile.performance.score.toLocaleString('fa-IR')}٪</div>
          <div className="text-[10px] text-slate-400">
            {profile.performance.returned.toLocaleString('fa-IR')} مورد برگشتی از {profile.performance.total.toLocaleString('fa-IR')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat label={meta.contracts} value={profile.contracts.length.toLocaleString('fa-IR')} />
        <Stat label={meta.executed} value={formatNumber(profile.executed)} />
        <Stat label={meta.approved} value={formatNumber(profile.approvedStatements)} />
        <Stat label={meta.settled} value={formatNumber(profile.paidOrReceived)} tone="text-emerald-700" />
        <Stat label={`${meta.balance} (دفاتر)`} value={formatNumber(profile.balance)} tone="text-amber-700" />
        <Stat label={kind === 'clients' ? 'کسورات نزد کارفرما' : 'کسورات/تضمین مکسوره'} value={formatNumber(profile.deductionsHeld)} tone="text-blue-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="font-bold text-slate-900">{meta.contracts} و پروژه‌ها</h3>
          {profile.contracts.length === 0 && <p className="text-slate-400">موردی ثبت نشده است.</p>}
          {profile.contracts.map((k) => (
            <div key={k.id} className="flex justify-between border-b border-slate-50 py-1.5">
              <div>
                <div className="font-bold">{k.number}</div>
                <button onClick={() => onNavigate(`/projects/${k.projectId}`)} className="text-[10px] text-amber-700 cursor-pointer">
                  {k.projectName}
                </button>
                <div className="text-[10px] text-slate-500 truncate max-w-[260px]">{k.title}</div>
              </div>
              <div className="text-left">
                <div className="font-mono">{formatCurrencyCompact(k.value)}</div>
                <div className="text-[10px] text-slate-500">{k.status}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="font-bold text-slate-900">{kind === 'suppliers' ? 'فاکتورها' : 'صورت‌وضعیت‌ها'}</h3>
          {profile.statements.length === 0 && <p className="text-slate-400">موردی ثبت نشده است.</p>}
          {profile.statements.map((s) => (
            <div key={s.id} className="flex justify-between border-b border-slate-50 py-1.5">
              <div>
                <div className="font-bold">{s.number}</div>
                <div className="text-[10px] text-slate-500">
                  {s.projectName} · {statusLabel(s.status)} · {s.date}
                </div>
              </div>
              <div className="text-left font-mono">
                <div>{formatCurrencyCompact(s.amount)}</div>
                <div className="text-[10px] text-slate-500">{kind === 'suppliers' ? 'مانده' : 'خالص'} {formatCurrencyCompact(s.net)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="font-bold text-slate-900">{kind === 'clients' ? 'دریافت‌ها' : 'پرداخت‌ها'} (رویدادهای مالی)</h3>
          {profile.payments.length === 0 && <p className="text-slate-400">موردی ثبت نشده است.</p>}
          {profile.payments.map((p, i) => (
            <div key={i} className="flex justify-between border-b border-slate-50 py-1.5">
              <span>
                {p.description} <span className="text-[10px] text-slate-400 font-mono">{p.docNumber}</span>
              </span>
              <span className="font-mono text-emerald-700">{formatCurrencyCompact(p.amount)}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> تضامین و اسناد
          </h3>
          {profile.guarantees.map((g) => (
            <div key={g.id} className="flex justify-between bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
              <span>{g.title}</span>
              <span className="text-[10px] text-slate-500">{g.status}</span>
            </div>
          ))}
          {profile.documents
            .filter((d) => d.type !== 'ضمانت‌نامه بانکی')
            .map((d) => (
              <div key={d.id} className="flex items-center justify-between border-b border-slate-50 py-1">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-slate-400" />
                  {d.title}
                </span>
                <span className="text-[10px] text-slate-500">{d.type}</span>
              </div>
            ))}
          {profile.documents.length === 0 && <p className="text-slate-400">سندی متصل نیست.</p>}
        </div>

        {kind === 'suppliers' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 lg:col-span-2">
            <h3 className="font-bold text-slate-900">سوابق قیمت و کالاها</h3>
            <table className="w-full text-right">
              <tbody className="divide-y divide-slate-50">
                {profile.priceHistory.map((h, i) => (
                  <tr key={i}>
                    <td className="py-1.5">{h.material}</td>
                    <td className="py-1.5 font-mono text-[11px] text-slate-500">{h.poNumber}</td>
                    <td className="py-1.5 font-mono text-[11px] text-slate-500">{h.date}</td>
                    <td className="py-1.5 text-left font-mono">
                      {formatNumber(h.unitPrice)} / {h.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
