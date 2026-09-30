/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Part of `npm run test:ui`: the official print of «گزارش پروژه‌ها» in live mode.
//
// The app is the plain production build (as in the WordPress plugin: no sample data), opened as the plugin's
// app page opens it (window.AkphPortal.mode = 'live'). akph/v1 answers come from tests/fixtures/live-api.json,
// recorded from the real server by the PHP test suite's routes (one project, one posted entry, default
// «تنظیمات گزارش و چاپ»). The test prints the project report in print media and checks:
//   - no person or company name of the sample data (src/api/mock) on the printed page;
//   - only the official document is printed (no menu, button or dialog chrome);
//   - letterhead from the report settings, signature boxes with titles only (the default: no names);
//   - Persian digits in the printed table.
// Screenshots: ui-screenshots/print/projects-live.png (print media) and projects-live.pdf (A4).
//
//   node scripts/ui-print-live.mjs [--no-build]
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { sampleNames } from './check-live-bundle.mjs';

const root = resolve('.');
const buildDir = join(root, '.live-build');
const outDir = join(root, 'ui-screenshots', 'print');
const fixture = JSON.parse(readFileSync(join(root, 'tests/fixtures/live-api.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

if (!process.argv.includes('--no-build') || !existsSync(join(buildDir, 'index.html'))) {
  const env = { ...process.env };
  delete env.VITE_DEMO_DATA;
  delete env.VITE_PAGES;
  delete env.PAGES_BASE;
  execFileSync('npx', ['vite', 'build', '--outDir', buildDir, '--emptyOutDir', '--sourcemap', 'false', '--logLevel', 'warn'], { stdio: 'inherit', env });
}

const PORTAL = { mode: 'live', restUrl: '/wp-json/akph/v1', nonce: 'ui-test', userId: fixture.me.id, displayName: fixture.me.display_name, siteName: 'سایت آزمون' };

function serve() {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/wp-json/akph/v1/')) {
        const route = url.pathname.slice('/wp-json/akph/v1/'.length);
        const body = fixture[route];
        // A route the fixture does not hold answers as for a role without its capability (403).
        res.writeHead(body ? 200 : 403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body || { code: 'akph_role_forbidden', message: 'نقش شما مجاز به این عملیات نیست.' }));
        return;
      }
      let file = join(buildDir, decodeURIComponent(url.pathname));
      if (!file.startsWith(buildDir) || !existsSync(file) || statSync(file).isDirectory()) file = join(buildDir, 'index.html');
      if (file.endsWith('index.html')) {
        const html = readFileSync(file, 'utf8').replace('<head>', `<head><script>window.AkphPortal=${JSON.stringify(PORTAL)}</script>`);
        res.writeHead(200, { 'Content-Type': TYPES['.html'] });
        res.end(html);
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => ok(server));
  });
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const problems = [];
try {
  mkdirSync(outDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fa-IR' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}#/projects`, { waitUntil: 'networkidle' });
  await page.waitForSelector('main', { timeout: 20000 });
  if (await page.getByText('فقط خواندنی — به‌زودی', { exact: false }).first().isVisible().catch(() => false)) problems.push('«به‌زودی» notice on /projects in live mode');
  await page.getByRole('button', { name: 'چاپ گزارش' }).click();
  await page.getByRole('dialog').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'projects-live.png'), fullPage: true });
  await page.pdf({ path: join(outDir, 'projects-live.pdf'), format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });

  const printed = await page.evaluate(() => {
    const visible = (el) => {
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && el.getClientRects().length > 0;
    };
    const portal = document.querySelector('.official-print-portal');
    const others = [...document.body.children].filter((el) => el !== portal && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && visible(el));
    return {
      hasPortal: !!portal && visible(portal),
      othersVisible: others.map((el) => el.tagName + (el.id ? `#${el.id}` : '')),
      buttons: portal ? [...portal.querySelectorAll('button')].filter(visible).length : -1,
      text: portal ? portal.innerText : '',
      signatureTitles: portal ? [...portal.querySelectorAll('.official-print-signature > div:first-child')].map((d) => d.textContent) : [],
      signers: portal ? [...portal.querySelectorAll('.official-print-signer')].map((d) => d.textContent.trim()) : [],
    };
  });
  if (!printed.hasPortal) problems.push('the official document is not printed');
  if (printed.othersVisible.length) problems.push(`other page content printed: ${printed.othersVisible.join(', ')}`);
  if (printed.buttons) problems.push(`${printed.buttons} buttons on the printed page`);
  for (const n of sampleNames()) if (printed.text.includes(n)) problems.push(`sample name «${n}» on the printed page`);
  if (!printed.text.includes(fixture['report-settings'].settings.company.legal_name)) problems.push('company name of the report settings missing from the letterhead');
  if (!printed.text.includes('پروژه آزمون چاپ')) problems.push('the project is missing from the report');
  if (/[0-9]/.test(printed.text.replace(/RPT-[\w-]+/g, ''))) problems.push('Latin digits on the printed page');
  const expected = fixture['report-settings'].settings.signatories.projects.map((s) => s.title);
  if (JSON.stringify(printed.signatureTitles) !== JSON.stringify(expected)) problems.push(`signature titles ${JSON.stringify(printed.signatureTitles)} ≠ ${JSON.stringify(expected)}`);
  if (printed.signers.some((s) => s && s !== ' ')) problems.push(`names printed in default signature boxes: ${printed.signers.join('، ')}`);

  // 0.7.0: contracts and statements are written on the server — no «به‌زودی» notice; server items and alerts show.
  await page.emulateMedia({ media: 'screen' });
  const live = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fa-IR' });
  live.on('pageerror', (e) => errors.push(e.message));
  const checks = [
    ['/contracts/client', 'اجرای فونداسیون'],
    ['/contracts/subcontract', 'آرماتوربندی'],
    ['/statements/client', 'صورت‌وضعیت'],
    ['/statements/subcontractor', 'صورت‌وضعیت'],
    ['/approvals', 'قرارداد پیمانکار جزء'],
    ['/notifications', 'سررسید ضمانت‌نامه'],
  ];
  for (const [path, text] of checks) {
    await live.goto(`${base}#${path}`, { waitUntil: 'networkidle' });
    await live.waitForSelector('main', { timeout: 20000 });
    await live.waitForFunction((t) => (document.querySelector('main')?.innerText || '').includes(t), text, { timeout: 5000 }).catch(() => {});
    const body = await live.evaluate(() => document.querySelector('main')?.innerText || '');
    if (body.includes('به‌زودی')) problems.push(`«به‌زودی» notice on ${path} in live mode`);
    if (!body.includes(text)) problems.push(`${path}: «${text}» from the server is not shown`);
  }
  // The contract opened from the list shows its server state (approval, guarantees, amendments).
  await live.goto(`${base}#/contracts/client`, { waitUntil: 'networkidle' });
  await live.getByRole('button', { name: 'قراردادهای کارفرما' }).click();
  await live.getByText('اجرای فونداسیون').first().click();
  await live.waitForTimeout(300);
  const detail = await live.evaluate(() => document.querySelector('main')?.innerText || '');
  if (!detail.includes('وضعیت قرارداد در دفاتر رسمی')) problems.push('the contract detail does not show the server panel');
  if (!detail.includes('ض-۱')) problems.push('the guarantee of the contract is not shown');
  await live.screenshot({ path: join(outDir, 'contract-live.png'), fullPage: true });
  await live.close();
  for (const e of errors) problems.push(`page error: ${e}`);
} finally {
  await browser.close();
  server.close();
}
if (problems.length) {
  console.error(`✘ چاپ رسمی گزارش پروژه‌ها (حالت واقعی):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`✔ چاپ رسمی گزارش پروژه‌ها در حالت واقعی: فقط سند رسمی، بدون نام نمونه، سربرگ و امضاهای تنظیمات؛ ${join('ui-screenshots', 'print')}`);
console.log('✔ قراردادها و صورت‌وضعیت‌ها در حالت واقعی: بدون «به‌زودی»، وضعیت سرور، کارتابل و هشدار سررسید ضمانت‌نامه');
