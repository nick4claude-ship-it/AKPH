/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Static check of the design boundary (docs/DESIGN-HANDOFF.md): screens in src/components and src/pages
// only render. They read the store through hooks and selectors, write only through useWorkflows(),
// never compute amounts, and follow the accessibility rules. Run by `npm test` and `npm run check:design`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve('.');
const UI_DIRS = ['src/components', 'src/pages'];

/** Modules a screen may import (repo-relative, without extension). `names` limits the imported names. */
const ALLOWED_MODULES = {
  'src/types': {},
  'src/store/AppStore': { names: ['useAppState', 'useSelector'] },
  'src/store/session': {},
  'src/store/useWorkflows': {},
  'src/store/useApprovalActions': {},
  'src/store/useAssistant': {},
  'src/store/notifications': { names: ['useDismissedNotifications'] },
  'src/store/toast': {},
  'src/store/selectors': {},
  'src/store/domainSelectors': {},
  'src/utils/formatters': {},
  'src/utils/money': { names: ['formatMoney', 'formatMoneyCompact', 'formatRial', 'formatToman', 'formatInt', 'moneyUnitLabel'] },
  'src/utils/date': { names: ['toPersianDate', 'toPersianTime', 'toPersianDateTime', 'getRelativePersianDate', 'getCurrentFiscalYear', 'getFormattedCurrentPersianDate', 'getCurrentPersianMonthName'] },
  'src/utils/export': { names: ['downloadTable', 'CsvTable'] },
  'src/navigation/navConfig': {},
  'src/ui/Dialog': {},
  'src/ui/NumberInput': {},
};
/** Folders whose modules are all allowed. */
const ALLOWED_PREFIXES = ['src/components/', 'src/pages/', 'src/assets/', 'src/store/views/'];
const ALLOWED_PACKAGES = ['react', 'react-dom', 'react-router-dom', 'lucide-react'];

/** Code a screen must not contain (comments are stripped first). */
const FORBIDDEN_CODE = [
  [/\buseStoreSlice\b|\buseAppDispatch\b|\buseGetState\b|\busePostFinancialEvent\b|\buseDataSource\b/, 'writes the store directly; call a workflow from useWorkflows() instead'],
  [/\.reduce\(/, 'sums in the UI; take the total from a store selector (src/store/views)'],
  [/\bMath\./, 'arithmetic in the UI; take the figure from a store selector (bar widths: barWidth())'],
  [/\.toLocaleString\(/, 'formats numbers by hand; use formatInt / formatDecimal / formatPercent / formatMoney'],
  [/\.toFixed\(/, 'formats numbers by hand; use formatPercent / formatDecimal'],
  [/\bgenerateUUID\b|\bnextDocNumber\b/, 'creates ids or document numbers; the workflow issues them'],
  [/\bwindow\.AkphPortal\b|\bfetch\(|\bXMLHttpRequest\b/, 'talks to the server; only src/api does'],
  [/\blocalStorage\b|\bsessionStorage\b/, 'stores data in the browser; keep state in the store'],
  [/role=["']dialog["']/, 'hand-made dialog; use <Dialog> from src/ui/Dialog (role="dialog", Esc, focus trap)'],
  [
    /(?<![=$\w])\{\s*[\w.?!\[\]]+?(?:\.length|Count|(?<![A-Za-z])count|Percent|(?<![A-Za-z])percent|Quantity|(?<![A-Za-z])quantity|Qty|(?<![A-Za-z])qty)\s*\}/,
    'renders a raw number (Latin digits); use formatInt / formatDecimal / formatPercent',
  ],
];
const CONTROL = /<(input|select|textarea|IntegerInput|MoneyInput|PercentInput)\b/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const lineOf = (src, index) => src.slice(0, index).split('\n').length;
/** Import statements blanked out (line numbers kept), so code rules only see code. */
const blankImports = (src) => src.replace(/^import\s[\s\S]*?;$/gm, (m) => m.replace(/[^\n]/g, ' '));

function checkImports(file, src, problems) {
  const re = /import\s+(type\s+)?([\s\S]*?)\s+from\s+'([^']+)';/g;
  for (const m of src.matchAll(re)) {
    const typeOnly = !!m[1];
    const spec = m[3];
    const line = lineOf(src, m.index);
    if (!spec.startsWith('.')) {
      if (!ALLOWED_PACKAGES.includes(spec)) problems.push([line, `imports package "${spec}"`]);
      continue;
    }
    const target = relative(root, resolve(dirname(file), spec)).replace(/\\/g, '/').replace(/\.(tsx?|jsx?)$/, '');
    if (target.startsWith('src/assets/') || ALLOWED_PREFIXES.some((p) => target.startsWith(p))) continue;
    if (typeOnly && target.startsWith('src/')) continue;
    const rule = ALLOWED_MODULES[target];
    if (!rule) {
      problems.push([line, `imports ${target} (not part of the screens' API; see docs/DESIGN-HANDOFF.md)`]);
      continue;
    }
    if (rule.names) {
      const names = (m[2].match(/\{([\s\S]*)\}/)?.[1] || '')
        .split(',')
        .map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0])
        .filter(Boolean);
      for (const n of names) if (!rule.names.includes(n)) problems.push([line, `imports ${n} from ${target} (allowed: ${rule.names.join(', ')})`]);
    }
  }
}

function checkLabels(src, problems) {
  const re = /<label\b([^>]*)>/g;
  for (const m of src.matchAll(re)) {
    if (/\bhtmlFor=/.test(m[1])) continue;
    const close = src.indexOf('</label>', m.index);
    const inner = close > 0 ? src.slice(m.index + m[0].length, close) : '';
    if (CONTROL.test(inner)) continue;
    problems.push([lineOf(src, m.index), '<label> without htmlFor (and no control inside it)']);
  }
}

export function checkDesignBoundary() {
  const report = [];
  for (const dir of UI_DIRS) {
    for (const file of walk(join(root, dir))) {
      const raw = readFileSync(file, 'utf8');
      const src = stripComments(raw);
      const problems = [];
      checkImports(file, src, problems);
      const code = blankImports(src);
      for (const [re, why] of FORBIDDEN_CODE) {
        const g = new RegExp(re.source, 'g');
        for (const m of code.matchAll(g)) problems.push([lineOf(code, m.index), `${m[0].trim()} — ${why}`]);
      }
      checkLabels(src, problems);
      if (problems.length) report.push({ file: relative(root, file), problems: problems.sort((a, b) => a[0] - b[0]) });
    }
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = checkDesignBoundary();
  const count = report.reduce((a, r) => a + r.problems.length, 0);
  for (const r of report) {
    console.log(`\n${r.file}`);
    for (const [line, msg] of r.problems) console.log(`  ${line}: ${msg}`);
  }
  if (count) {
    console.log(`\nمرز طراحی: ${count} مورد در ${report.length} فایل (docs/DESIGN-HANDOFF.md).`);
    process.exit(1);
  }
  console.log('مرز طراحی: کامپوننت‌ها و صفحه‌ها فقط نمایش می‌دهند؛ منطق در src/store است.');
}
