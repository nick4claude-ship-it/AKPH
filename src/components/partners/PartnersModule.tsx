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
import { formatNumber, formatCurrencyCompact, formatDecimal, formatText } from '../../utils/formatters';
import { formatMoney, formatInt } from '../../utils/money';
import { Money } from '../common/Money';

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
    <div className="text-xs text-slate-500">{label}</div>
    <div className={`text-sm font-bold tabular-nums ${tone}`}>{value}</div>
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
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Icon className="w-5 h-5 text-amber-700" /> {formatText(meta.title)}
            <span className="text-xs font-normal text-slate-500">({formatDecimal(rows.length)})</span>
          </h2>
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
            <input aria-label="جستجوی نام"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام..."
              className="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 table-scroll">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">نام</th>
                <th className="py-2 px-3 text-left">{formatText(meta.contracts)}</th>
                <th className="py-2 px-3 text-left">پروژه‌ها</th>
                <th className="py-2 px-3 text-left">{formatText(meta.executed)}</th>
                <th className="py-2 px-3 text-left">{formatText(meta.approved)}</th>
                <th className="py-2 px-3 text-left">{formatText(meta.settled)}</th>
                <th className="py-2 px-3 text-left">{formatText(meta.balance)} (دفاتر)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.counterparty.id} className="hover:bg-slate-50/70 cursor-pointer" onClick={() => onOpenProfile(p.counterparty.id)}>
                  <td className="py-2 px-3">
                    <div className="font-bold text-slate-900">{formatText(p.counterparty.name)}</div>
                    <div className="text-xs text-slate-500">{formatText(p.counterparty.tradeType || p.counterparty.nationalId || '')}</div>
                  </td>
                  <td className="py-2 px-3 text-left tabular-nums">{formatDecimal(p.contracts.length)}</td>
                  <td className="py-2 px-3 text-left tabular-nums">{formatDecimal(p.projects.length)}</td>
                  <td className="py-2 px-3 text-left tabular-nums"><Money rial={p.executed} compact /></td>
                  <td className="py-2 px-3 text-left tabular-nums"><Money rial={p.approvedStatements} compact /></td>
                  <td className="py-2 px-3 text-left tabular-nums text-emerald-700"><Money rial={p.paidOrReceived} compact /></td>
                  <td className="py-2 px-3 text-left tabular-nums font-bold text-amber-700"><Money rial={p.balance} compact /></td>
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
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => onOpenProfile(null)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer" title="بازگشت">
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <div className="text-sm text-amber-700 font-bold">{formatText(meta.title)}</div>
            <h2 className="text-base font-bold text-slate-900">{formatText(c.name)}</h2>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">
              {c.nationalId && <span>شناسه ملی: {formatText(c.nationalId)}</span>}
              {c.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {formatText(c.phone)}
                </span>
              )}
              {c.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {formatText(c.email)}
                </span>
              )}
              {c.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {formatText(c.address)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-left">
          <div className="text-xs text-slate-500">سابقه عملکرد (بدون برگشت/مغایرت)</div>
          <div className={`text-lg font-bold ${profile.performance.score >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>{formatDecimal(profile.performance.score)}٪</div>
          <div className="text-xs text-slate-500">
            {formatDecimal(profile.performance.returned)} مورد برگشتی از {formatInt(profile.performance.total)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat label={meta.contracts} value={formatDecimal(profile.contracts.length)} />
        <Stat label={meta.executed} value={formatMoney(profile.executed)} />
        <Stat label={meta.approved} value={formatMoney(profile.approvedStatements)} />
        <Stat label={meta.settled} value={formatMoney(profile.paidOrReceived, false)} tone="text-emerald-700" />
        <Stat label={`${meta.balance} (دفاتر)`} value={formatMoney(profile.balance, false)} tone="text-amber-700" />
        <Stat label={kind === 'clients' ? 'کسورات نزد کارفرما' : 'کسورات/تضمین مکسوره'} value={formatMoney(profile.deductionsHeld, false)} tone="text-blue-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="font-bold text-slate-900">{formatText(meta.contracts)} و پروژه‌ها</h3>
          {profile.contracts.length === 0 && <p className="text-slate-500">موردی ثبت نشده است.</p>}
          {profile.contracts.map((k) => (
            <div key={k.id} className="flex justify-between border-b border-slate-50 py-2">
              <div>
                <div className="font-bold">{formatText(k.number)}</div>
                <button onClick={() => onNavigate(`/projects/${k.projectId}`)} className="text-sm text-amber-700 cursor-pointer">
                  {formatText(k.projectName)}
                </button>
                <div className="text-xs text-slate-500 truncate max-w-[260px]">{formatText(k.title)}</div>
              </div>
              <div className="text-left">
                <div className="tabular-nums"><Money rial={k.value} compact /></div>
                <div className="text-xs text-slate-500">{formatText(k.status)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="font-bold text-slate-900">{kind === 'suppliers' ? 'فاکتورها' : 'صورت‌وضعیت‌ها'}</h3>
          {profile.statements.length === 0 && <p className="text-slate-500">موردی ثبت نشده است.</p>}
          {profile.statements.map((s) => (
            <div key={s.id} className="flex justify-between border-b border-slate-50 py-2">
              <div>
                <div className="font-bold">{formatText(s.number)}</div>
                <div className="text-xs text-slate-500">
                  {formatText(s.projectName)} · {statusLabel(s.status)} · {formatText(s.date)}
                </div>
              </div>
              <div className="text-left tabular-nums">
                <div><Money rial={s.amount} compact /></div>
                <div className="text-xs text-slate-500">{kind === 'suppliers' ? 'مانده' : 'خالص'} <Money rial={s.net} compact /></div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="font-bold text-slate-900">{kind === 'clients' ? 'دریافت‌ها' : 'پرداخت‌ها'} (رویدادهای مالی)</h3>
          {profile.payments.length === 0 && <p className="text-slate-500">موردی ثبت نشده است.</p>}
          {profile.payments.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-slate-50 py-2">
              <span>
                {formatText(p.description)} <span className="text-xs text-slate-500 tabular-nums">{formatText(p.docNumber)}</span>
              </span>
              <span className="tabular-nums text-emerald-700"><Money rial={p.amount} compact /></span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" /> تضامین و اسناد
          </h3>
          {profile.guarantees.map((g) => (
            <div key={g.id} className="flex justify-between bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
              <span>{formatText(g.title)}</span>
              <span className="text-xs text-slate-500">{formatText(g.status)}</span>
            </div>
          ))}
          {profile.documents
            .filter((d) => d.type !== 'ضمانت‌نامه بانکی')
            .map((d) => (
              <div key={d.id} className="flex items-center justify-between border-b border-slate-50 py-1">
                <span className="flex items-center gap-2">
                  <FileText className="w-3 h-3 text-slate-500" />
                  {formatText(d.title)}
                </span>
                <span className="text-xs text-slate-500">{formatText(d.type)}</span>
              </div>
            ))}
          {profile.documents.length === 0 && <p className="text-slate-500">سندی متصل نیست.</p>}
        </div>

        {kind === 'suppliers' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 lg:col-span-2">
            <h3 className="font-bold text-slate-900">سوابق قیمت و کالاها</h3>
            <div className="table-scroll">
              <table className="w-full text-right">
              <tbody className="divide-y divide-slate-50">
                {profile.priceHistory.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2">{formatText(h.material)}</td>
                    <td className="py-2 tabular-nums text-xs text-slate-500">{formatText(h.poNumber)}</td>
                    <td className="py-2 tabular-nums text-xs text-slate-500">{formatText(h.date)}</td>
                    <td className="py-2 text-left tabular-nums">
                      {formatMoney(h.unitPrice, false)} / {formatText(h.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
