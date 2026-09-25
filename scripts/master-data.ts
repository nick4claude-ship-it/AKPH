/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Base records (projects, cost centers, counterparties, accounts): the same field groups and rules as the
// akph/v1 server — project managers write execution fields of own projects only, accountants the manual
// summary only; group and general accounts receive no lines.
import assert from 'node:assert/strict';
import { buildMockState } from '../src/api/mock/buildState';
import { postFinancialEventToState } from '../src/store/postingEngine';
import * as rw from '../src/store/recordWorkflows';
import type { WorkflowEnv } from '../src/store/workflowKit';
import type { AppState, SliceKey } from '../src/store/types';
import type { UserProfile } from '../src/types';
import { isValidSheba, projectChanges, projectEditableGroups, projectFormDefaults } from '../src/store/views/masterData';

let state: AppState = buildMockState();
const user = (id: string, role: UserProfile['role'], projectIds?: string[]): UserProfile => ({ id, name: id, role, email: '', avatar: '', projectIds });
const env = (u: UserProfile): WorkflowEnv => ({
  getState: () => state,
  set: (key: SliceKey, updater: unknown) => {
    state = { ...state, [key]: typeof updater === 'function' ? (updater as (p: unknown) => unknown)(state[key]) : updater };
  },
  post: (input, options) => {
    const { state: next, result } = postFinancialEventToState(state, input, options);
    state = next;
    return result;
  },
  user: u,
});

const CEO = user('m-ceo', 'مدیر ارشد');
const ACC = user('m-acc', 'حسابدار');

// ---- projects
const form = { ...projectFormDefaults(), name: 'پروژه آزمون پایه', clientName: 'کارفرمای آزمون', budget: 5_000_000_000, managerUserId: 'm-pm', managerName: 'مدیر آزمون' };
assert.equal(rw.createProject(env(ACC), form).ok, false, 'an accountant does not create projects');
const created = rw.createProject(env(CEO), form);
assert.ok(created.ok, created.message);
const project = state.projects.find((p) => p.id === created.id)!;
assert.equal(project.version, 1);
assert.equal(project.recordedRevenue, 0, 'ledger figures start at zero');
const PM = user('m-pm', 'مدیر پروژه', [project.id]);
const PM_OTHER = user('m-pm2', 'مدیر پروژه', []);

assert.deepEqual(projectEditableGroups(PM, project), ['exec']);
assert.deepEqual(projectEditableGroups(ACC, project), ['financial']);
assert.deepEqual(projectEditableGroups(PM_OTHER, project), []);
assert.equal(projectEditableGroups(CEO, project).length, 5);

const before = projectFormDefaults(project);
const changes = projectChanges(before, { ...before, physicalProgress: 30, budget: 1, name: 'x' }, projectEditableGroups(PM, project));
assert.deepEqual(changes, { physicalProgress: 30 }, 'only changed fields of the writable groups');
assert.ok(rw.updateProject(env(PM), project.id, changes).ok);
assert.equal(rw.updateProject(env(PM), project.id, { budget: 1 }).ok, false, 'a project manager cannot change the budget');
assert.equal(rw.updateProject(env(PM_OTHER), project.id, { physicalProgress: 5 }).ok, false, 'nor another manager’s project');
assert.ok(rw.updateProject(env(ACC), project.id, { manualRevenue: 7_000 }).ok);
assert.equal(rw.updateProject(env(ACC), project.id, { name: 'نام' }).ok, false);
assert.equal(state.projects.find((p) => p.id === project.id)!.version, 3);
assert.equal(rw.updateProject(env(CEO), project.id, { endDate: '۱۴۰۴/۱۲/۳۰' }).ok, false, '1404 has no Esfand 30');
console.log('  ✔ پروژه: ایجاد فقط مدیر ارشد/سیستم؛ گروه فیلدها مثل سرور (مدیر پروژه: اجرا، حسابدار: خلاصه دستی)');

// ---- cost centers, counterparties
assert.ok(rw.createCostCenter(env(ACC), { code: '', name: 'کارگاه آزمون', projectId: project.id, type: 'کارگاه پروژه', manager: '', budget: 0 }).ok);
assert.equal(rw.createCostCenter(env(PM), { code: '', name: 'x', projectId: project.id, type: 'کارگاه پروژه', manager: '', budget: 0 }).ok, false);
assert.ok(state.projects.find((p) => p.id === project.id)!.costCenterIds.length === 1);
// Valid IBAN: check digits computed for this test only (the number belongs to nobody).
const bban = '0170000000000000000001'; // 22 digits: IR + 2 check digits + 22 = 26 characters
const rem = [...(bban + '182700')].reduce((r, ch) => (r * 10 + Number(ch)) % 97, 0);
const valid = `IR${String(98 - rem).padStart(2, '0')}${bban}`;
assert.ok(isValidSheba(valid));
assert.equal(isValidSheba('IR000000000000000000000000'), false);
const party = { kind: 'supplier' as const, name: 'تأمین‌کننده آزمون', nationalId: '', economicCode: '', phone: '', email: '', address: '', shebaNumber: 'IR00', bankName: '', tradeType: '' };
assert.equal(rw.createCounterparty(env(ACC), party).ok, false, 'invalid IBAN refused');
assert.ok(rw.createCounterparty(env(ACC), { ...party, shebaNumber: valid }).ok);
console.log('  ✔ مرکز هزینه و طرف حساب: فقط نقش‌های مالی؛ شبا با رقم کنترل');

// ---- accounts
assert.equal(rw.createAccount(env(ACC), { code: '11109', title: 'پرش سطح', level: 'تفصیلی', nature: 'بدهکار', parentCode: '11' }).ok, false, 'detail under a general account');
assert.equal(rw.createAccount(env(ACC), { code: '22101', title: 'پیشوند غلط', level: 'تفصیلی', nature: 'بدهکار', parentCode: '111' }).ok, false, 'code must start with the parent');
assert.equal(rw.createAccount(env(PM), { code: '11109', title: 'x', level: 'تفصیلی', nature: 'بدهکار', parentCode: '111' }).ok, false);
assert.ok(rw.createAccount(env(ACC), { code: '11109', title: 'بانک آزمون', level: 'تفصیلی', nature: 'بدهکار', parentCode: '111' }).ok);
assert.equal(rw.createAccount(env(ACC), { code: '11109', title: 'تکراری', level: 'تفصیلی', nature: 'بدهکار', parentCode: '111' }).ok, false);
console.log('  ✔ کدینگ: سطح و پیشوند والد کنترل می‌شود؛ کد تکراری پذیرفته نمی‌شود');

console.log('\nاطلاعات پایه: همه آزمون‌ها موفق.');
