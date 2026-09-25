/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The standard chart of accounts of the server (wordpress-plugin/akph-portal/includes/standard-chart.php)
// is generated from the app's chart: codes, titles, levels and natures only — never balances.
//   node scripts/run-ts.mjs scripts/standard-chart.ts          check the PHP file is up to date (npm test)
//   node scripts/run-ts.mjs scripts/standard-chart.ts --write  regenerate it
import { readFileSync, writeFileSync } from 'node:fs';
import { mockChartOfAccounts } from '../src/api/mock/data/accountingMockData';
import { ACCOUNTS, CLIENT_DEDUCTION_ACCOUNTS, SUBCONTRACTOR_DEDUCTION_ACCOUNTS, PAYABLE_ACCOUNTS } from '../src/store/postingRules';
import type { AccountNode } from '../src/types';

const LEVEL: Record<AccountNode['level'], string> = { 'گروه': 'group', 'کل': 'general', 'معین': 'subsidiary', 'تفصیلی': 'detail' };
const NATURE: Record<AccountNode['nature'], string> = { 'بدهکار': 'debit', 'بستانکار': 'credit', 'دوگانه': 'both' };

const rows: [string, string, string, string, string][] = [];
const walk = (nodes: AccountNode[], parent: string) => {
  for (const n of nodes) {
    rows.push([n.code, n.title, LEVEL[n.level], NATURE[n.nature], parent]);
    if (n.children) walk(n.children, n.code);
  }
};
walk(mockChartOfAccounts, '');

const codes = new Set(rows.map((r) => r[0]));
const used = [...Object.values(ACCOUNTS), ...Object.values(CLIENT_DEDUCTION_ACCOUNTS), ...Object.values(SUBCONTRACTOR_DEDUCTION_ACCOUNTS), ...Object.values(PAYABLE_ACCOUNTS)];
const missing = [...new Set(used)].filter((c) => !codes.has(c));
if (missing.length) {
  console.error(`standard chart: posting rules use codes missing from the chart: ${missing.join(', ')}`);
  process.exit(1);
}

const esc = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const php = `<?php
/**
 * Standard chart of accounts (codes, titles, levels, natures; no balances). Generated from the app's chart by
 * scripts/standard-chart.ts — do not edit by hand. Rows: [code, title, level, nature, parent_code].
 */
if (!defined('ABSPATH')) {
    exit;
}

return array(
${rows.map((r) => `    array(${r.map(esc).join(', ')}),`).join('\n')}
);
`;

const target = 'wordpress-plugin/akph-portal/includes/standard-chart.php';
if (process.argv.includes('--write')) {
  writeFileSync(target, php);
  console.log(`${target}: ${rows.length} accounts`);
} else {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    /* missing */
  }
  if (current !== php) {
    console.error(`${target} is out of date: run node scripts/run-ts.mjs scripts/standard-chart.ts --write`);
    process.exit(1);
  }
  console.log(`standard chart: ${rows.length} accounts, every posting-rule code present, PHP file up to date.`);
}
