/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useState } from 'react';
import { X } from 'lucide-react';
import type { AccountLevel, AccountNature, AccountNode, CounterpartyKind, Project } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { MoneyInput } from '../../ui/NumberInput';
import {
  COST_CENTER_TYPES,
  COUNTERPARTY_KIND_LABELS,
  parentCandidates,
  type AccountFormInput,
  type CostCenterFormInput,
  type CounterpartyFormInput,
} from '../../store/views/masterData';
import type { WorkflowResult } from '../../store/workflowKit';

const INPUT = 'w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500';

const Shell: React.FC<{ title: string; titleId: string; error: string | null; onClose: () => void; onSubmit: (e: React.FormEvent) => void; children: React.ReactNode }> = ({
  title,
  titleId,
  error,
  onClose,
  onSubmit,
  children,
}) => (
  <Dialog as="form" onSubmit={onSubmit} noValidate onClose={onClose} labelledBy={titleId} className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200">
    <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
      <h3 id={titleId} className="text-sm font-bold text-slate-900">
        {title}
      </h3>
      <button type="button" onClick={onClose} aria-label="بستن" className="p-1.5 rounded-lg hover:bg-slate-200 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
    <div className="p-4 space-y-3 text-xs">
      {children}
      {error && (
        <p className="text-rose-700 font-bold" role="alert">
          {error}
        </p>
      )}
    </div>
    <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
      <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-xs cursor-pointer">
        انصراف
      </button>
      <button type="submit" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">
        ثبت
      </button>
    </div>
  </Dialog>
);

/** Runs the command; closes on success, shows the reason otherwise. */
function useSubmit(onClose: () => void) {
  const [error, setError] = useState<string | null>(null);
  const run = (result: WorkflowResult) => {
    if (result.ok) onClose();
    else setError(result.message);
  };
  return { error, run };
}

export const CostCenterFormModal: React.FC<{ projects: Project[]; onClose: () => void; onSave: (form: CostCenterFormInput) => WorkflowResult }> = ({ projects, onClose, onSave }) => {
  const uid = useId();
  const [form, setForm] = useState<CostCenterFormInput>({ code: '', name: '', projectId: '', type: 'کارگاه پروژه', manager: '', budget: 0 });
  const { error, run } = useSubmit(onClose);
  const set = <K extends keyof CostCenterFormInput>(k: K, v: CostCenterFormInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Shell title="مرکز هزینه جدید" titleId={`${uid}-t`} error={error} onClose={onClose} onSubmit={(e) => (e.preventDefault(), run(onSave(form)))}>
      <label htmlFor={`${uid}-name`} className="block text-[11px] text-slate-600">نام</label>
      <input id={`${uid}-name`} className={INPUT} value={form.name} onChange={(e) => set('name', e.target.value)} />
      <label htmlFor={`${uid}-code`} className="block text-[11px] text-slate-600">کد (خالی: سرور شماره می‌دهد)</label>
      <input id={`${uid}-code`} dir="ltr" className={INPUT} value={form.code} onChange={(e) => set('code', e.target.value)} />
      <label htmlFor={`${uid}-project`} className="block text-[11px] text-slate-600">پروژه</label>
      <select id={`${uid}-project`} className={INPUT} value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>
        <option value="">ستاد (بدون پروژه)</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <label htmlFor={`${uid}-type`} className="block text-[11px] text-slate-600">نوع</label>
      <select id={`${uid}-type`} className={INPUT} value={form.type} onChange={(e) => set('type', e.target.value)}>
        {COST_CENTER_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <label htmlFor={`${uid}-manager`} className="block text-[11px] text-slate-600">مسئول</label>
      <input id={`${uid}-manager`} className={INPUT} value={form.manager} onChange={(e) => set('manager', e.target.value)} />
      <label htmlFor={`${uid}-budget`} className="block text-[11px] text-slate-600">بودجه</label>
      <MoneyInput id={`${uid}-budget`} showUnit className={INPUT} value={form.budget} onValueChange={(v) => set('budget', v)} />
    </Shell>
  );
};

export const CounterpartyFormModal: React.FC<{ onClose: () => void; onSave: (form: CounterpartyFormInput) => WorkflowResult }> = ({ onClose, onSave }) => {
  const uid = useId();
  const [form, setForm] = useState<CounterpartyFormInput>({ kind: 'supplier', name: '', nationalId: '', economicCode: '', phone: '', email: '', address: '', shebaNumber: '', bankName: '', tradeType: '' });
  const { error, run } = useSubmit(onClose);
  const set = <K extends keyof CounterpartyFormInput>(k: K, v: CounterpartyFormInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const field = (k: keyof CounterpartyFormInput, label: string, ltr = false) => (
    <div className="space-y-1">
      <label htmlFor={`${uid}-${k}`} className="block text-[11px] text-slate-600">
        {label}
      </label>
      <input id={`${uid}-${k}`} dir={ltr ? 'ltr' : undefined} className={INPUT} value={form[k]} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );
  return (
    <Shell title="طرف حساب جدید" titleId={`${uid}-t`} error={error} onClose={onClose} onSubmit={(e) => (e.preventDefault(), run(onSave(form)))}>
      <label htmlFor={`${uid}-kind`} className="block text-[11px] text-slate-600">نوع</label>
      <select id={`${uid}-kind`} className={INPUT} value={form.kind} onChange={(e) => set('kind', e.target.value as CounterpartyKind)}>
        {(Object.keys(COUNTERPARTY_KIND_LABELS) as CounterpartyKind[]).map((k) => (
          <option key={k} value={k}>
            {COUNTERPARTY_KIND_LABELS[k]}
          </option>
        ))}
      </select>
      {field('name', 'نام')}
      <div className="grid grid-cols-2 gap-2">
        {field('nationalId', 'شناسه یا کد ملی', true)}
        {field('economicCode', 'کد اقتصادی', true)}
        {field('phone', 'تلفن', true)}
        {field('email', 'ایمیل', true)}
      </div>
      {field('address', 'نشانی')}
      <div className="grid grid-cols-2 gap-2">
        {field('shebaNumber', 'شماره شبا (IR…)', true)}
        {field('bankName', 'بانک')}
      </div>
      {field('tradeType', 'رشته کاری')}
    </Shell>
  );
};

const LEVELS: AccountLevel[] = ['گروه', 'کل', 'معین', 'تفصیلی'];
const NATURES: AccountNature[] = ['بدهکار', 'بستانکار', 'دوگانه'];

export const AccountFormModal: React.FC<{ chart: AccountNode[]; onClose: () => void; onSave: (form: AccountFormInput) => WorkflowResult }> = ({ chart, onClose, onSave }) => {
  const uid = useId();
  const [form, setForm] = useState<AccountFormInput>({ code: '', title: '', level: 'تفصیلی', nature: 'بدهکار', parentCode: '' });
  const { error, run } = useSubmit(onClose);
  const set = <K extends keyof AccountFormInput>(k: K, v: AccountFormInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const parents = parentCandidates(chart, form.level);
  return (
    <Shell title="حساب جدید در کدینگ" titleId={`${uid}-t`} error={error} onClose={onClose} onSubmit={(e) => (e.preventDefault(), run(onSave(form)))}>
      <label htmlFor={`${uid}-level`} className="block text-[11px] text-slate-600">سطح</label>
      <select id={`${uid}-level`} className={INPUT} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as AccountLevel, parentCode: '' }))}>
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      {form.level !== 'گروه' && (
        <>
          <label htmlFor={`${uid}-parent`} className="block text-[11px] text-slate-600">حساب والد</label>
          <select id={`${uid}-parent`} className={INPUT} value={form.parentCode} onChange={(e) => set('parentCode', e.target.value)}>
            <option value="">— انتخاب کنید —</option>
            {parents.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} — {p.title}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor={`${uid}-code`} className="block text-[11px] text-slate-600">کد (با کد والد شروع می‌شود)</label>
      <input id={`${uid}-code`} dir="ltr" inputMode="numeric" className={INPUT} value={form.code} onChange={(e) => set('code', e.target.value.trim())} />
      <label htmlFor={`${uid}-title`} className="block text-[11px] text-slate-600">عنوان</label>
      <input id={`${uid}-title`} className={INPUT} value={form.title} onChange={(e) => set('title', e.target.value)} />
      <label htmlFor={`${uid}-nature`} className="block text-[11px] text-slate-600">ماهیت</label>
      <select id={`${uid}-nature`} className={INPUT} value={form.nature} onChange={(e) => set('nature', e.target.value as AccountNature)}>
        {NATURES.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-slate-500">فقط حساب معین یا تفصیلی بدون زیرحساب در سند ثبت می‌شود.</p>
    </Shell>
  );
};

interface MasterDataPanelProps {
  kind: 'cost_centers' | 'counterparties' | 'accounts';
  projects: Project[];
  costCenters: { id: string; code: string; name: string; projectId?: string; type?: string; budget?: number }[];
  counterparties: { id: string; name: string; kind: CounterpartyKind; nationalId?: string; shebaNumber?: string }[];
  chart: AccountNode[];
  canManage: boolean;
  onSaveCostCenter: (form: CostCenterFormInput) => WorkflowResult;
  onSaveCounterparty: (form: CounterpartyFormInput) => WorkflowResult;
  onSaveAccount: (form: AccountFormInput) => WorkflowResult;
  formatAmount: (rial: number) => string;
}

/** Lists of base records with a «new» button; the forms send server commands in live mode. */
export const MasterDataPanel: React.FC<MasterDataPanelProps> = ({ kind, projects, costCenters, counterparties, chart, canManage, onSaveCostCenter, onSaveCounterparty, onSaveAccount, formatAmount }) => {
  const [open, setOpen] = useState(false);
  const title = kind === 'cost_centers' ? 'مراکز هزینه' : kind === 'counterparties' ? 'طرف‌های حساب' : 'کدینگ حساب‌ها';
  const button = kind === 'cost_centers' ? 'مرکز هزینه جدید' : kind === 'counterparties' ? 'طرف حساب جدید' : 'حساب جدید';
  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name || 'ستاد';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-800">{title}</h4>
        {canManage && (
          <button onClick={() => setOpen(true)} className="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">
            {button}
          </button>
        )}
      </div>
      {kind === 'cost_centers' && (
        <table className="w-full text-right text-xs">
          <thead className="text-slate-500 border-b border-slate-200">
            <tr>
              <th className="py-1.5">کد</th>
              <th>نام</th>
              <th>پروژه</th>
              <th>نوع</th>
              <th className="text-left">بودجه</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {costCenters.map((c) => (
              <tr key={c.id}>
                <td className="py-1.5 font-mono">{c.code}</td>
                <td>{c.name}</td>
                <td>{projectName(c.projectId)}</td>
                <td>{c.type}</td>
                <td className="text-left font-mono">{formatAmount(c.budget || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {kind === 'counterparties' && (
        <table className="w-full text-right text-xs">
          <thead className="text-slate-500 border-b border-slate-200">
            <tr>
              <th className="py-1.5">نام</th>
              <th>نوع</th>
              <th>شناسه ملی</th>
              <th>شبا</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {counterparties.map((c) => (
              <tr key={c.id}>
                <td className="py-1.5">{c.name}</td>
                <td>{COUNTERPARTY_KIND_LABELS[c.kind]}</td>
                <td className="font-mono">{c.nationalId || '—'}</td>
                <td className="font-mono" dir="ltr">{c.shebaNumber || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && kind === 'cost_centers' && <CostCenterFormModal projects={projects} onClose={() => setOpen(false)} onSave={onSaveCostCenter} />}
      {open && kind === 'counterparties' && <CounterpartyFormModal onClose={() => setOpen(false)} onSave={onSaveCounterparty} />}
      {open && kind === 'accounts' && <AccountFormModal chart={chart} onClose={() => setOpen(false)} onSave={onSaveAccount} />}
    </div>
  );
};
