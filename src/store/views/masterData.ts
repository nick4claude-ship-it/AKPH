/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Forms of the base records served by akph/v1: projects (with the server's field groups), cost centers,
 * counterparties and accounts. The same rules run in the demo (src/store/recordWorkflows.ts) and on the
 * server (wordpress-plugin/akph-portal), which has the final word.
 */

import type { AccountLevel, AccountNature, AccountNode, CostCenter, CounterpartyKind, Project, ProjectStatus, UserProfile } from '../../types';
import { canAccessProject } from '../../utils/permissions';
import { jalaliToIso } from '../../utils/jalali';

export type ProjectFieldGroup = 'base' | 'budget' | 'assign' | 'exec' | 'financial';

export const PROJECT_STATUSES: ProjectStatus[] = ['در حال اجرا', 'تجهیز کارگاه', 'تحویل موقت', 'تعلیق', 'اختتام'];

/** Form of a project; amounts in integer Rials, dates Jalali. */
export interface ProjectFormInput {
  name: string;
  clientName: string;
  location: string;
  contractRef: string;
  description: string;
  budget: number;
  contractAmount: number;
  managerUserId: string;
  /** Display name of the chosen manager (demo only; the server looks the user up itself). */
  managerName?: string;
  status: ProjectStatus;
  physicalProgress: number;
  siteSupervisor: string;
  consultantName: string;
  startDate: string;
  endDate: string;
  manualRevenue: number;
  manualCost: number;
  manualCash: number;
  manualReceivable: number;
  manualPayable: number;
}

/** Field → group, as on the server (Akph_Projects::FIELD_GROUPS). */
export const PROJECT_FIELD_GROUPS: Record<Exclude<keyof ProjectFormInput, 'managerName'>, ProjectFieldGroup> = {
  name: 'base',
  clientName: 'base',
  location: 'base',
  contractRef: 'base',
  description: 'base',
  budget: 'budget',
  contractAmount: 'budget',
  managerUserId: 'assign',
  status: 'exec',
  physicalProgress: 'exec',
  siteSupervisor: 'exec',
  consultantName: 'exec',
  startDate: 'exec',
  endDate: 'exec',
  manualRevenue: 'financial',
  manualCost: 'financial',
  manualCash: 'financial',
  manualReceivable: 'financial',
  manualPayable: 'financial',
};

const ALL_GROUPS: ProjectFieldGroup[] = ['base', 'budget', 'assign', 'exec', 'financial'];

/**
 * Groups the user may write (null project = a new one). The server sends its own answer with each project
 * (`editableGroups`); without it the role rules below apply (demo).
 */
export function projectEditableGroups(user: UserProfile, project: Pick<Project, 'id' | 'managerUserId' | 'editableGroups'> | null): ProjectFieldGroup[] {
  if (project?.editableGroups) return project.editableGroups as ProjectFieldGroup[];
  switch (user.role) {
    case 'مدیر سیستم':
    case 'مدیر ارشد':
      return ALL_GROUPS;
    case 'حسابدار':
      return project ? ['financial'] : [];
    case 'مدیر پروژه':
      return project && (project.managerUserId === user.id || canAccessProject(user, project.id)) ? ['exec'] : [];
    default:
      return [];
  }
}

/** The manual summary is shown only when someone typed (or migrated) a figure into it. */
export function hasManualSummary(p: Pick<Project, 'manualSummary'>): boolean {
  const m = p.manualSummary;
  return Boolean(m && (m.revenue || m.cost || m.cash || m.receivable || m.payable));
}

export function canCreateProject(user: UserProfile): boolean {
  return user.role === 'مدیر سیستم' || user.role === 'مدیر ارشد';
}

export function projectFormDefaults(project?: Project): ProjectFormInput {
  const ms = project?.manualSummary;
  return {
    name: project?.name || '',
    clientName: project?.client || '',
    location: project?.location || '',
    contractRef: project?.contractRef || '',
    description: project?.description || '',
    budget: project?.budget || 0,
    contractAmount: project?.contractAmount || 0,
    managerUserId: project?.managerUserId || '',
    managerName: project?.manager || '',
    status: project?.status || 'در حال اجرا',
    physicalProgress: project?.physicalProgress || 0,
    siteSupervisor: project?.siteSupervisor || '',
    consultantName: project?.consultantName || '',
    startDate: project?.startDate || '',
    endDate: project?.expectedEndDate || '',
    manualRevenue: ms?.revenue || 0,
    manualCost: ms?.cost || 0,
    manualCash: ms?.cash || 0,
    manualReceivable: ms?.receivable || 0,
    manualPayable: ms?.payable || 0,
  };
}

/** Fields of the form that changed and that the user may write. */
export function projectChanges(before: ProjectFormInput, after: ProjectFormInput, groups: readonly ProjectFieldGroup[]): Partial<ProjectFormInput> {
  const out: Partial<ProjectFormInput> = {};
  for (const key of Object.keys(PROJECT_FIELD_GROUPS) as (keyof typeof PROJECT_FIELD_GROUPS)[]) {
    if (!groups.includes(PROJECT_FIELD_GROUPS[key]) || before[key] === after[key]) continue;
    (out as Record<string, unknown>)[key] = after[key];
    if (key === 'managerUserId') out.managerName = after.managerName;
  }
  return out;
}

/** First problem of a project form, or null. */
export function projectFormError(form: Partial<ProjectFormInput>, isNew: boolean): string | null {
  if ((isNew || 'name' in form) && !form.name?.trim()) return 'نام پروژه الزامی است.';
  if ((isNew || 'clientName' in form) && !form.clientName?.trim()) return 'کارفرما الزامی است.';
  if (form.physicalProgress !== undefined && (!Number.isInteger(form.physicalProgress) || form.physicalProgress < 0 || form.physicalProgress > 100)) {
    return 'پیشرفت فیزیکی باید عدد صحیح ۰ تا ۱۰۰ باشد.';
  }
  for (const key of ['startDate', 'endDate'] as const) {
    const v = form[key];
    if (v && !jalaliToIso(v)) return `تاریخ «${v}» تاریخ شمسی معتبر نیست.`;
  }
  if (form.startDate && form.endDate && (jalaliToIso(form.endDate) || '') < (jalaliToIso(form.startDate) || '')) return 'تاریخ پایان قبل از شروع است.';
  return null;
}

// ---------------------------------------------------------------------------- cost centers, counterparties

export interface CostCenterFormInput {
  code: string;
  name: string;
  projectId: string;
  type: NonNullable<CostCenter['type']>;
  manager: string;
  budget: number;
}

export const COST_CENTER_TYPES = ['کارگاه پروژه', 'دفتر مرکزی', 'انبار مرکزی', 'کارگاه ماشین‌آلات', 'دفتر فنی', 'سایر'];

export interface CounterpartyFormInput {
  kind: CounterpartyKind;
  name: string;
  nationalId: string;
  economicCode: string;
  phone: string;
  email: string;
  address: string;
  shebaNumber: string;
  bankName: string;
  tradeType: string;
}

export const COUNTERPARTY_KIND_LABELS: Record<CounterpartyKind, string> = {
  client: 'کارفرما',
  supplier: 'تأمین‌کننده',
  subcontractor: 'پیمانکار جزء',
  consultant: 'مشاور',
  employee: 'پرسنل',
  bank: 'بانک',
  other: 'سایر',
};

/** IR + 24 digits with a valid ISO 13616 check (same rule as the server). */
export function isValidSheba(value: string): boolean {
  const s = value.replace(/\s/g, '').toUpperCase();
  if (!/^IR\d{24}$/.test(s)) return false;
  const moved = s.slice(4) + '1827' + s.slice(2, 4);
  let rem = 0;
  for (const ch of moved) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}

export function counterpartyFormError(form: CounterpartyFormInput): string | null {
  if (!form.name.trim()) return 'نام طرف حساب الزامی است.';
  if (form.nationalId && !/^\d{10,11}$/.test(form.nationalId)) return 'شناسه ملی یا کد ملی باید ۱۰ یا ۱۱ رقم باشد.';
  if (form.shebaNumber && !isValidSheba(form.shebaNumber)) return 'شماره شبا معتبر نیست.';
  return null;
}

// ---------------------------------------------------------------------------- accounts

export interface AccountFormInput {
  code: string;
  title: string;
  level: AccountLevel;
  nature: AccountNature;
  parentCode: string;
}

const CHILD_LEVEL: Record<AccountLevel, AccountLevel | null> = { 'گروه': 'کل', 'کل': 'معین', 'معین': 'تفصیلی', 'تفصیلی': null };

/** Accounts that may receive a child of `level`. */
export function parentCandidates(chart: readonly AccountNode[], level: AccountLevel): AccountNode[] {
  const out: AccountNode[] = [];
  const walk = (list: readonly AccountNode[]) =>
    list.forEach((n) => {
      if (CHILD_LEVEL[n.level] === level) out.push(n);
      if (n.children) walk(n.children);
    });
  walk(chart);
  return out;
}

export function accountFormError(chart: readonly AccountNode[], form: AccountFormInput): string | null {
  if (!/^\d{1,12}$/.test(form.code)) return 'کد حساب باید ۱ تا ۱۲ رقم باشد.';
  if (!form.title.trim()) return 'عنوان حساب الزامی است.';
  if (form.level === 'گروه') return form.parentCode ? 'حساب گروه والد ندارد.' : null;
  const parent = parentCandidates(chart, form.level).find((n) => n.code === form.parentCode);
  if (!parent) return 'حساب والد را از سطح بالاتر انتخاب کنید (گروه › کل › معین › تفصیلی).';
  if (!form.code.startsWith(parent.code) || form.code.length <= parent.code.length) return 'کد حساب باید با کد والد شروع شود و از آن بلندتر باشد.';
  return null;
}
