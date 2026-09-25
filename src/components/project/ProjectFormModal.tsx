/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useState } from 'react';
import { Building2, X } from 'lucide-react';
import type { Project, ProjectStatus } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { MoneyInput, PercentInput } from '../../ui/NumberInput';
import { useCurrentUser, useProjectManagers } from '../../store/session';
import {
  PROJECT_STATUSES,
  projectChanges,
  projectEditableGroups,
  projectFormDefaults,
  type ProjectFieldGroup,
  type ProjectFormInput,
} from '../../store/views/masterData';
import type { WorkflowResult } from '../../store/workflowKit';

interface ProjectFormModalProps {
  /** Omitted for a new project. */
  project?: Project;
  onClose: () => void;
  onCreate: (form: ProjectFormInput) => WorkflowResult;
  onUpdate: (id: string, changes: Partial<ProjectFormInput>) => WorkflowResult;
}

const INPUT = 'w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500 disabled:opacity-60';

const GROUP_TITLES: Record<ProjectFieldGroup, string> = {
  base: 'مشخصات پایه',
  budget: 'بودجه و قرارداد',
  assign: 'مدیر پروژه',
  exec: 'اجرا',
  financial: 'خلاصه دستی (سند حسابداری نمی‌سازد)',
};

/** Create or edit a project; only the field groups the user may write are editable. */
export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ project, onClose, onCreate, onUpdate }) => {
  const user = useCurrentUser();
  const managers = useProjectManagers();
  const uid = useId();
  const initial = projectFormDefaults(project);
  const [form, setForm] = useState<ProjectFormInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const groups = projectEditableGroups(user, project || null);
  const can = (g: ProjectFieldGroup) => groups.includes(g);
  const set = <K extends keyof ProjectFormInput>(key: K, value: ProjectFormInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const id = (name: string) => `${uid}-${name}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = project ? onUpdate(project.id, projectChanges(initial, form, groups)) : onCreate(form);
    if (result.ok) onClose();
    else setError(result.message);
  };

  const text = (name: keyof ProjectFormInput, label: string, group: ProjectFieldGroup) => (
    <div className="space-y-1">
      <label htmlFor={id(name)} className="text-[11px] text-slate-600">
        {label}
      </label>
      <input id={id(name)} className={INPUT} disabled={!can(group)} value={form[name] as string} onChange={(e) => set(name, e.target.value as never)} />
    </div>
  );
  const money = (name: keyof ProjectFormInput, label: string, group: ProjectFieldGroup) => (
    <div className="space-y-1">
      <label htmlFor={id(name)} className="text-[11px] text-slate-600">
        {label}
      </label>
      <MoneyInput id={id(name)} showUnit className={INPUT} disabled={!can(group)} value={form[name] as number} onValueChange={(v) => set(name, v as never)} />
    </div>
  );

  return (
    <Dialog as="form" onSubmit={submit} noValidate onClose={onClose} labelledBy={id('title')} className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
        <h3 id={id('title')} className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-amber-600" /> {project ? `ویرایش پروژه ${project.code}` : 'پروژه جدید'}
        </h3>
        <button type="button" onClick={onClose} aria-label="بستن" className="p-1.5 rounded-lg hover:bg-slate-200 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-5 overflow-y-auto text-xs">
        {!groups.length && <p className="text-rose-700">اجازه ویرایش این پروژه را ندارید.</p>}
        <fieldset className="space-y-2">
          <legend className="font-bold text-slate-800 mb-2">{GROUP_TITLES.base}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {text('name', 'نام پروژه', 'base')}
            {text('clientName', 'کارفرما', 'base')}
            {text('location', 'محل اجرا', 'base')}
            {text('contractRef', 'شماره قرارداد', 'base')}
          </div>
          <div className="space-y-1">
            <label htmlFor={id('description')} className="text-[11px] text-slate-600">
              شرح
            </label>
            <textarea id={id('description')} rows={2} className={INPUT} disabled={!can('base')} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
        </fieldset>
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <legend className="font-bold text-slate-800 mb-2">{GROUP_TITLES.budget}</legend>
          {money('budget', 'بودجه مصوب', 'budget')}
          {money('contractAmount', 'مبلغ قرارداد', 'budget')}
        </fieldset>
        <fieldset className="space-y-1">
          <legend className="font-bold text-slate-800 mb-2">{GROUP_TITLES.assign}</legend>
          <label htmlFor={id('manager')} className="text-[11px] text-slate-600">
            مدیر پروژه (کاربر با نقش مدیر پروژه)
          </label>
          <select
            id={id('manager')}
            className={INPUT}
            disabled={!can('assign')}
            value={form.managerUserId}
            onChange={(e) => {
              const m = managers.find((x) => x.id === e.target.value);
              setForm((f) => ({ ...f, managerUserId: e.target.value, managerName: m?.name || '' }));
            }}
          >
            <option value="">— بدون مدیر —</option>
            {form.managerUserId && !managers.some((m) => m.id === form.managerUserId) && <option value={form.managerUserId}>{form.managerName || form.managerUserId}</option>}
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </fieldset>
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <legend className="font-bold text-slate-800 mb-2">{GROUP_TITLES.exec}</legend>
          <div className="space-y-1">
            <label htmlFor={id('status')} className="text-[11px] text-slate-600">
              وضعیت
            </label>
            <select id={id('status')} className={INPUT} disabled={!can('exec')} value={form.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={id('physical')} className="text-[11px] text-slate-600">
              پیشرفت فیزیکی (درصد)
            </label>
            <PercentInput id={id('physical')} className={INPUT} disabled={!can('exec')} value={form.physicalProgress} onValueChange={(v) => set('physicalProgress', v)} />
          </div>
          {text('siteSupervisor', 'سرپرست کارگاه', 'exec')}
          {text('consultantName', 'مشاور', 'exec')}
          {text('startDate', 'تاریخ شروع (۱۴۰۵/۰۱/۱۵)', 'exec')}
          {text('endDate', 'تاریخ پایان', 'exec')}
        </fieldset>
        <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <legend className="font-bold text-slate-800 mb-2">{GROUP_TITLES.financial}</legend>
          {money('manualRevenue', 'درآمد', 'financial')}
          {money('manualCost', 'هزینه', 'financial')}
          {money('manualCash', 'نقد', 'financial')}
          {money('manualReceivable', 'مطالبات', 'financial')}
          {money('manualPayable', 'بدهی', 'financial')}
        </fieldset>
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
        <button type="submit" disabled={!groups.length} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
          {project ? 'ذخیره تغییرات' : 'ثبت پروژه'}
        </button>
      </div>
    </Dialog>
  );
};
