/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// `npm run test:ui` — screenshots of every menu route of the demo build (sample data in the browser)
// at 1440px and 390px, plus a typography audit of every visible text on those pages:
//   - no text smaller than 12px;
//   - one font: Vazirmatn (no monospace or other family in the computed font-family).
//
//   node scripts/ui-screens.mjs                 build the demo, capture, audit (exit 1 on a violation)
//   node scripts/ui-screens.mjs --report        audit without failing (prints the violations)
//   node scripts/ui-screens.mjs --no-build      reuse the demo build in .ui-build/
//   node scripts/ui-screens.mjs --only=projects,ai
//
// Screenshots go to ui-screenshots/<width>/<route>.png (a CI artifact), the audit to ui-screenshots/audit.json.
// The browser is Playwright's Chromium; PLAYWRIGHT_CHROMIUM (or PLAYWRIGHT_BROWSERS_PATH) selects another build.
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const report = args.includes('--report');
const noBuild = args.includes('--no-build');
const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',');

const root = resolve('.');
const buildDir = join(root, '.ui-build');
const outDir = join(root, 'ui-screenshots');
const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900, isMobile: false },
  { name: '390', width: 390, height: 844, isMobile: true },
];
const MIN_FONT_PX = 12;

/** Menu routes, read from the single navigation config (every node with a path, hidden ones included). */
function menuRoutes() {
  const src = readFileSync(join(root, 'src/navigation/navConfig.ts'), 'utf8');
  const routes = [];
  for (const m of src.matchAll(/\{\s*id:\s*'([^']+)'[^}]*?path:\s*'([^']+)'/g)) routes.push({ id: m[1], path: m[2] });
  if (!routes.length) throw new Error('no routes found in navConfig.ts');
  return only ? routes.filter((r) => only.includes(r.id)) : routes;
}

function buildDemo() {
  execFileSync('npx', ['vite', 'build', '--outDir', buildDir, '--emptyOutDir', '--logLevel', 'warn'], {
    stdio: 'inherit',
    env: { ...process.env, PAGES_BASE: '/', VITE_DEMO_DATA: 'true', VITE_PAGES: 'true' },
  });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve(dir) {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = join(dir, path);
      if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => ok(server));
  });
}

/** Runs in the page: every visible element that holds text of its own, with its computed type. */
function auditPage(minPx) {
  const out = { small: [], font: [], checked: 0 };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const describe = (el) => {
    const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 6).join(' ') : '';
    return `<${el.tagName.toLowerCase()} class="${cls}"> ${text}`;
  };
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || el.closest('[aria-hidden="true"], .sr-only, script, style, noscript')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    out.checked++;
    const size = parseFloat(style.fontSize);
    if (size < minPx - 0.01) out.small.push(`${size}px ${describe(el)}`);
    const families = style.fontFamily.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '').toLowerCase());
    if (!families[0].startsWith('vazirmatn') || families.some((f) => f.includes('mono'))) out.font.push(`${style.fontFamily} ${describe(el)}`);
  }
  // Form controls render their own text (value, options, placeholder).
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea, button')) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden') continue;
    if (el.tagName !== 'BUTTON' || !seen.has(el)) {
      if (parseFloat(style.fontSize) < minPx - 0.01) out.small.push(`${style.fontSize} <${el.tagName.toLowerCase()}> control`);
      const first = style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (!first.startsWith('vazirmatn') || /mono/i.test(style.fontFamily)) out.font.push(`${style.fontFamily} <${el.tagName.toLowerCase()}> control`);
    }
  }
  const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''));
  out.loadedFonts = [...new Set(loaded)];
  return out;
}

async function main() {
  if (!noBuild || !existsSync(join(buildDir, 'index.html'))) buildDemo();
  rmSync(outDir, { recursive: true, force: true });
  const server = await serve(buildDir);
  const base = `http://127.0.0.1:${server.address().port}/`;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const routes = menuRoutes();
  const results = [];
  const pageErrors = [];
  try {
    for (const vp of VIEWPORTS) {
      mkdirSync(join(outDir, vp.name), { recursive: true });
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: vp.isMobile, hasTouch: vp.isMobile, locale: 'fa-IR' });
      const page = await context.newPage();
      page.on('pageerror', (e) => pageErrors.push(`${vp.name} ${page.url()}: ${e.message}`));
      for (const route of routes) {
        await page.goto('about:blank');
        await page.goto(`${base}#${route.path}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('main', { timeout: 20000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400); // lazy chunks and chart transitions
        const file = join(outDir, vp.name, `${route.id}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const audit = await page.evaluate(auditPage, MIN_FONT_PX);
        results.push({ viewport: vp.name, route: route.id, path: route.path, ...audit });
        const flag = audit.small.length || audit.font.length ? '✘' : '✔';
        console.log(`  ${flag} ${vp.name.padStart(4)} ${route.path.padEnd(26)} texts ${String(audit.checked).padStart(4)}  <${MIN_FONT_PX}px: ${audit.small.length}  font: ${audit.font.length}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  writeFileSync(join(outDir, 'audit.json'), JSON.stringify({ results, pageErrors }, null, 2));
  const small = results.reduce((n, r) => n + r.small.length, 0);
  const font = results.reduce((n, r) => n + r.font.length, 0);
  const fonts = [...new Set(results.flatMap((r) => r.loadedFonts))];
  const nonVazir = fonts.filter((f) => !/^vazirmatn/i.test(f));
  console.log(`\n${routes.length} مسیر × ${VIEWPORTS.length} عرض؛ اسکرین‌شات‌ها در ${outDir}`);
  console.log(`متن زیر ${MIN_FONT_PX}px: ${small} · فونت غیر Vazirmatn: ${font} · فونت‌های بارگذاری‌شده: ${fonts.join('، ') || '—'} · خطای صفحه: ${pageErrors.length}`);
  for (const r of results) {
    for (const s of [...r.small.slice(0, 3), ...r.font.slice(0, 3)]) console.log(`    ${r.viewport} ${r.route}: ${s}`);
  }
  for (const e of pageErrors.slice(0, 10)) console.log(`    خطای صفحه: ${e}`);
  const failed = small > 0 || font > 0 || nonVazir.length > 0 || pageErrors.length > 0;
  if (failed && !report) {
    console.log('\n✘ آزمون تایپوگرافی رد شد.');
    process.exit(1);
  }
  console.log(failed ? '\n(حالت گزارش: رد نمی‌شود)' : '\n✔ همه متن‌ها ۱۲px یا بزرگ‌تر و با فونت Vazirmatn هستند.');
}

await main();
