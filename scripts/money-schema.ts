/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Money schema and seed consistency: every numeric field is classified, the demo seed is internally
// consistent, every seeded entry balances, and parsing/rounding of amounts never fails silently.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MONEY_FIELDS, NON_MONEY_NUMERIC_FIELDS, MONEY_MAP_MEMBERS, MONEY_MAPS } from '../src/api/moneyFields';
import { loadMockSeeds } from '../src/api/mock/seeds';
import { buildMockState } from '../src/api/mock/buildState';
import { AmountOverflowError, formatMoney, initCurrencyUnit, parseIntegerAmount, rialToToman, toDisplayAmount, tomanToRial, tryParseIntegerAmount } from '../src/utils/money';

// 1) Every `x: number` in the domain types is classified exactly once.
const types = readFileSync('src/types/index.ts', 'utf8');
const typeFields = new Set([...types.matchAll(/^\s+(\w+)\??:\s*number(\s*\|[^;]*)?;/gm)].map((m) => m[1]));
const both = [...MONEY_FIELDS].filter((f) => NON_MONEY_NUMERIC_FIELDS.has(f));
assert.deepEqual(both, [], `classified as money and non-money: ${both}`);
const unclassified = [...typeFields].filter((f) => !MONEY_FIELDS.has(f) && !NON_MONEY_NUMERIC_FIELDS.has(f) && !MONEY_MAP_MEMBERS.has(f));
assert.deepEqual(unclassified, [], `numeric fields without a money classification: ${unclassified.join(', ')}`);
assert.ok(MONEY_FIELDS.has('workerInsuranceDeduction'));
console.log(`  ✔ ${typeFields.size} فیلد عددی نوع‌ها همه طبقه‌بندی شده‌اند (پولی / غیرپولی)`);

// 2) Same for every numeric value in the seed data.
const seedFields = new Set<string>();
const walk = (v: unknown, inMap = false) => {
  if (Array.isArray(v)) v.forEach((x) => walk(x));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      if (typeof x === 'number') {
        if (!inMap) seedFields.add(k);
        if ((inMap || MONEY_FIELDS.has(k)) && !Number.isSafeInteger(x)) assert.fail(`seed money ${k}=${x} is not an integer Rial`);
      } else walk(x, MONEY_MAPS.has(k));
    }
};
walk(loadMockSeeds());
const seedUnclassified = [...seedFields].filter((f) => !MONEY_FIELDS.has(f) && !NON_MONEY_NUMERIC_FIELDS.has(f));
assert.deepEqual(seedUnclassified, [], `seed numeric fields without classification: ${seedUnclassified.join(', ')}`);
console.log('  ✔ همه مبالغ داده نمونه ریال صحیح‌اند و هر فیلد عددی طبقه‌بندی دارد');

// 3) Payroll slips: components add up.
const seeds = loadMockSeeds();
for (const s of seeds.operational!.payrollSlips) {
  const parts = s.baseSalaryGross + s.housingAllowance + s.foodAllowance + s.childAllowance + s.specialSkillAllowance + s.overtimePay + s.missionPay;
  assert.equal(s.grossTotalSalary, parts, `${s.id}: gross ≠ sum of components`);
  const ded = s.workerInsuranceDeduction + s.incomeTaxDeduction + s.loanDeduction + s.disciplinaryDeduction;
  assert.equal(s.totalDeductions, ded, `${s.id}: deductions`);
  assert.equal(s.netPayableSalary, s.grossTotalSalary - s.totalDeductions, `${s.id}: net`);
  assert.equal(s.totalCostForCompany, s.grossTotalSalary + s.employerInsuranceContribution, `${s.id}: company cost`);
}
console.log('  ✔ فیش‌های حقوق نمونه: ناخالص = جمع اجزا، خالص = ناخالص − کسورات');

// 4) Building the demo state posts every seed event without a warning, and every entry balances.
const warnings: unknown[][] = [];
const warn = console.warn;
console.warn = (...a: unknown[]) => warnings.push(a);
const state = buildMockState();
console.warn = warn;
assert.deepEqual(warnings, [], `seed warnings: ${JSON.stringify(warnings)}`);
for (const e of state.journalEntries) {
  const d = e.rows.reduce((a, r) => a + r.debit, 0);
  const c = e.rows.reduce((a, r) => a + r.credit, 0);
  assert.equal(d, c, `${e.docNumber} unbalanced: ${d} ≠ ${c}`);
}
console.log(`  ✔ ${state.journalEntries.length} سند نمونه همه متوازن‌اند و هشدار [Seed] وجود ندارد`);

// 5) Parsing and rounding.
assert.equal(parseIntegerAmount('۱۲٬۳۴۵'), 12345);
assert.throws(() => parseIntegerAmount('99999999999999999999'), AmountOverflowError);
assert.throws(() => parseIntegerAmount(Number.MAX_SAFE_INTEGER + 2), AmountOverflowError);
assert.deepEqual(tryParseIntegerAmount('9'.repeat(20)), { ok: false, error: 'مبلغ واردشده بیش از حد بزرگ است.' });
assert.throws(() => tomanToRial(Number.MAX_SAFE_INTEGER), AmountOverflowError);
assert.equal(tomanToRial(123), 1230);
assert.equal(rialToToman(15), 2);
assert.equal(rialToToman(14), 1);
assert.equal(rialToToman(-15), -2);
initCurrencyUnit('toman');
assert.equal(toDisplayAmount(15), rialToToman(15));
assert.equal(formatMoney(15, false), '۲', 'formatMoney and toDisplayAmount round the same way');
console.log('  ✔ سرریز مبلغ خطا می‌دهد (نه صفر)؛ تبدیل ریال به تومان همه‌جا یکسان گرد می‌شود');

console.log('\nطرح پولی و داده نمونه: همه آزمون‌ها موفق.');
