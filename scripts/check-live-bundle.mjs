/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// `npm run test:live-bundle` — the app as the WordPress plugin ships it (plain production build, live mode)
// must not carry anything of the sample dataset: no person or company name of src/api/mock, no sample logo
// initials, no made-up signatory. Names are read from the sample data itself, so a new sample record is
// covered without editing this list. Run by `npm test`.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve('.');
const out = join(root, '.live-build');
const args = process.argv.slice(2);

/** Person names of the sample data (fields that hold a person, «مهندس …», «دکتر …») and its company names. */
export function sampleNames() {
  const dir = join(root, 'src/api/mock/data');
  const names = new Set(['رادمنش', 'صمدیان', 'کیارش نادری', 'سازه گستران پارس', 'سازه گستر پیشرو', 'سازه‌اندیش', 'شرکت پیمانکاری نمونه']);
  const person = /\b(?:fullName|lastName|\w*PersonName|approvedBy|approverName|submitterName|holderName|receiverName|driverName|qcInspectorName|preparerName|dispatchedByKeeperName|receivedByCrewLeaderName|approvedByManagerName|issuedBy|requestedBy|registeredBy|authorizedBy|managerName|contactPerson|employeeName|user|uploadedBy|createdBy|signedBy|responsiblePerson|siteSupervisor)\s*:\s*'([^'\n]{3,80})'/g;
  const company = /\b(?:supplierName|subcontractorName|employer|client|consultant|legalName|contractorName)\s*:\s*'([^'\n]{3,80})'/g;
  // Role words: a value made of them is a position, not a person.
  const role = /مدیر|سرپرست|دفتر|امور|واحد|بخش|کارشناس|انباردار|تنخواه|حسابدار|سیستم|کارفرما|پیمانکار|مشاور|ناظر|کاربر|پرسنل|تیم|اداره|سازمان|شهرداری|وزارت|بانک/;
  for (const f of readdirSync(dir)) {
    const text = readFileSync(join(dir, f), 'utf8');
    for (const m of text.matchAll(person)) {
      const v = m[1].replace(/\s*\(.*$/, '').trim();
      if (/[؀-ۿ]/.test(v) && v.split(/\s+/).length >= 2 && !role.test(v.replace(/^(?:مهندس|دکتر)\s+/, ''))) names.add(v);
    }
    for (const m of text.matchAll(company)) {
      const v = m[1].replace(/\s*\(.*$/, '').trim();
      if (/[؀-ۿ]/.test(v) && v.split(/\s+/).length >= 2) names.add(v);
    }
    for (const m of text.matchAll(/(?:مهندس|دکتر)\s+[؀-ۿ]+(?:\s+[؀-ۿ]+)?/g)) {
      if (!role.test(m[0].replace(/^(?:مهندس|دکتر)\s+/, '')) && !/^(?:مهندس|دکتر)\s+(?:و|در|از|به|با)\b/.test(m[0])) names.add(m[0]);
    }
  }
  return [...names];
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/** Builds the plain production app and fails when it carries a sample name. */
function main() {
  if (!args.includes('--no-build') || !existsSync(out)) {
    const env = { ...process.env };
    delete env.VITE_DEMO_DATA;
    delete env.VITE_PAGES;
    delete env.PAGES_BASE;
    rmSync(out, { recursive: true, force: true });
    execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir', '--sourcemap', 'false', '--logLevel', 'warn'], { stdio: 'inherit', env });
  }

  const names = sampleNames();
  const files = walk(out).filter((f) => /\.(js|css|html)$/.test(f));
  const problems = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const n of names) if (text.includes(n)) problems.push(`«${n}» in ${f.slice(out.length + 1)}`);
    if (/>\s*SGP\s*</.test(text) || /"SGP"/.test(text)) problems.push(`sample logo initials SGP in ${f.slice(out.length + 1)}`);
  }
  if (problems.length) {
    console.error(`Live bundle carries sample data (${problems.length}):\n  ${problems.slice(0, 40).join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Live bundle: ${files.length} files, none of ${names.length} sample names (src/api/mock) found.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
