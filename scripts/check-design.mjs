/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// `npm run check:design` — run after the designer's files are copied into the repository
// (docs/DESIGN-HANDOFF.md). It lists changed files and warns about any outside the design folders,
// then runs lint, build and every test (the test suite includes the design-boundary check).
//
//   npm run check:design                       changes not yet committed (working tree against HEAD)
//   npm run check:design -- --base=origin/main  also commits made since that ref
//   npm run check:design -- --strict            fail (exit 1) when a file outside the design folders changed
import { execFileSync, spawnSync } from 'node:child_process';

/** What the designer may change. Everything else is logic, data, build or server code. */
const DESIGN_PATHS = ['src/components/', 'src/pages/', 'src/assets/', 'src/index.css'];

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('--base='))?.slice('--base='.length);
const strict = args.includes('--strict');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' });

function changedFiles() {
  const files = new Map();
  const add = (status, path) => files.set(path, status);
  if (base) {
    for (const line of git('diff', '--name-status', '--no-renames', `${base}...HEAD`).split('\n').filter(Boolean)) {
      const [status, path] = line.split('\t');
      add(status, path);
    }
  }
  for (const line of git('status', '--porcelain', '--untracked-files=all', '--no-renames').split('\n').filter(Boolean)) {
    add(line.slice(0, 2).trim() || 'M', line.slice(3));
  }
  return [...files].sort((a, b) => a[0].localeCompare(b[0]));
}

const isDesignFile = (path) => DESIGN_PATHS.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p));

const changes = changedFiles();
const outside = changes.filter(([path]) => !isDesignFile(path));

console.log(`\nفایل‌های تغییرکرده${base ? ` (از ${base})` : ''}: ${changes.length}`);
for (const [path, status] of changes) console.log(`  ${isDesignFile(path) ? '  ' : '⚠ '}${status.padEnd(2)} ${path}`);

const steps = [
  ['lint', ['run', 'lint']],
  ['build', ['run', 'build']],
  ['test', ['test']],
];
const results = [];
for (const [name, npmArgs] of steps) {
  console.log(`\n▶ npm ${npmArgs.join(' ')}`);
  const r = spawnSync('npm', npmArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
  results.push([name, r.status === 0]);
}

console.log('\n──────── نتیجه check:design ────────');
for (const [name, ok] of results) console.log(`  ${ok ? '✔' : '✘'} ${name}`);
if (outside.length) {
  console.log(`\n⚠ هشدار: ${outside.length} فایل بیرون از پوشه‌های مجاز طراحی تغییر کرده است:`);
  for (const [path, status] of outside) console.log(`    ${status.padEnd(2)} ${path}`);
  console.log(`  پوشه‌های مجاز: ${DESIGN_PATHS.join('، ')} — این تغییرات را برگردانید یا جداگانه بازبینی کنید (docs/DESIGN-HANDOFF.md).`);
} else {
  console.log('  ✔ همه تغییرات داخل پوشه‌های مجاز طراحی است.');
}

const failed = results.some(([, ok]) => !ok) || (strict && outside.length > 0);
process.exit(failed ? 1 : 0);
