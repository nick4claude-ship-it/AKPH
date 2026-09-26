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
//   node scripts/ui-screens.mjs --skip=digits    leave a check out
//
// Besides the typography test it checks Latin digits in displayed text, contrast (4.5:1, large text 3:1),
// buttons and links without an accessible name, form controls without a label and horizontal page overflow.
// Screenshots go to ui-screenshots/<width>/<route>.png (full page) and <width>/top/<route>.png (first screen),
// a CI artifact; the audit to ui-screenshots/audit.json.
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

/**
 * Runs in the page. Every visible element that holds text of its own is checked for:
 *   small    — font size below the minimum;
 *   font     — a family other than Vazirmatn (or any monospace) in the computed font-family;
 *   digits   — Latin digits in displayed text (numbers are shown with Persian digits);
 *   contrast — text/background contrast below 4.5:1 (3:1 for large text);
 * plus buttons without an accessible name, form controls without a label, and horizontal page overflow.
 */
function auditPage(minPx) {
  const out = { logout: [], small: [], font: [], digits: [], contrast: [], names: [], labels: [], overflow: [], checked: 0 };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rgba = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (top, under) => {
    const a = top[3] + under[3] * (1 - top[3]);
    if (a === 0) return [255, 255, 255, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a).concat(a);
  };
  /**
   * Opaque backgrounds behind an element: one color, or one per color stop when a gradient is in the way
   * (the text must read on every stop). null when an image (url()) is behind it.
   */
  const backgrounds = (el) => {
    const layers = [];
    let stops = null;
    for (let e = el; e; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.backgroundImage && st.backgroundImage !== 'none') {
        if (/url\(/.test(st.backgroundImage)) return null;
        const colors = st.backgroundImage.match(/(rgba?|oklch|oklab|hsla?|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi) || [];
        if (colors.length) {
          stops = colors.map(rgba);
          if (stops.every((c) => c[3] >= 1)) break;
        }
      }
      const c = rgba(st.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1 && !stops) break;
    }
    let base = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return (stops || [[0, 0, 0, 0]]).map((stop) => over(stop, base));
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const describe = (el) => {
    const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 8).join(' ') : '';
    return `<${el.tagName.toLowerCase()} class="${cls}"> ${text}`;
  };
  const hidden = (el, style) =>
    style.visibility === 'hidden' || style.display === 'none' || el.closest('[aria-hidden="true"], .sr-only, script, style, noscript');
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue || '';
    if (!value.trim()) continue;
    const el = node.parentElement;
    if (!el) continue;
    const style = getComputedStyle(el);
    if (hidden(el, style)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (/[0-9]/.test(value) && !el.closest('input, textarea, [data-latin]')) out.digits.push(`«${value.trim().slice(0, 40)}» ${describe(el)}`);
    if (seen.has(el)) continue;
    seen.add(el);
    out.checked++;
    const size = parseFloat(style.fontSize);
    if (size < minPx - 0.01) out.small.push(`${size}px ${describe(el)}`);
    const families = style.fontFamily.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '').toLowerCase());
    if (!families[0].startsWith('vazirmatn') || families.some((f) => f.includes('mono'))) out.font.push(`${style.fontFamily} ${describe(el)}`);
    if (!el.closest('button:disabled, [aria-disabled="true"], option')) {
      const bgs = backgrounds(el);
      if (bgs) {
        const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
        const r = Math.min(...bgs.map((bg) => ratio(over(rgba(style.color), bg), bg)));
        if (r < (large ? 3 : 4.5) - 0.01) out.contrast.push(`${r.toFixed(2)} ${describe(el)}`);
      }
    }
  }
  for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea, button, [role=button], a[href]')) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || hidden(el, style)) continue;
    const isControl = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    if (isControl) {
      if (parseFloat(style.fontSize) < minPx - 0.01) out.small.push(`${style.fontSize} <${el.tagName.toLowerCase()}> control`);
      const first = style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (!first.startsWith('vazirmatn') || /mono/i.test(style.fontFamily)) out.font.push(`${style.fontFamily} <${el.tagName.toLowerCase()}> control`);
      const labelled = (el.labels && el.labels.length) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
      if (!labelled) out.labels.push(describe(el) + ` name=${el.getAttribute('name') || ''} placeholder=${el.getAttribute('placeholder') || ''}`);
    } else {
      const name = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
      if (!name) out.names.push(describe(el) + ` ${el.outerHTML.slice(0, 120)}`);
    }
  }
  if (document.documentElement.scrollWidth > window.innerWidth + 1) out.overflow.push(`page ${document.documentElement.scrollWidth}px wide in a ${window.innerWidth}px viewport`);
  const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''));
  out.loadedFonts = [...new Set(loaded)];
  return out;
}

/** Violation kinds. The first two are the typography test; all of them fail the run unless --report. */
const KINDS = ['small', 'font', 'digits', 'contrast', 'names', 'labels', 'overflow', 'logout'];
const KIND_LABELS = { small: `زیر ${MIN_FONT_PX}px`, font: 'فونت غیر Vazirmatn', digits: 'رقم لاتین', contrast: 'کنتراست کم', names: 'دکمه بی‌نام', labels: 'کنترل بی‌برچسب', overflow: 'اسکرول افقی صفحه', logout: 'دکمه خروج' };
const LOGOUT = 'خروج از حساب';

/**
 * «خروج از حساب» with that accessible name: at the bottom of the menu (the sidebar at 1440px, the drawer at
 * 390px) and in the avatar menu, and it asks for confirmation before leaving.
 */
async function checkLogout(page, vp) {
  const problems = [];
  const visible = async (locator, what) => {
    if (!(await locator.first().isVisible().catch(() => false))) problems.push(`${what}: no visible «${LOGOUT}»`);
  };
  if (vp.isMobile) {
    await page.getByRole('button', { name: 'باز کردن منو' }).click();
    const drawer = page.getByRole('dialog', { name: 'منوی اصلی' });
    await visible(drawer.getByRole('button', { name: LOGOUT, exact: true }), 'menu drawer');
    await page.keyboard.press('Escape');
  } else {
    await visible(page.locator('aside').getByRole('button', { name: LOGOUT, exact: true }), 'sidebar');
  }
  await page.getByRole('button', { name: /^حساب کاربری / }).click();
  const item = page.getByRole('menuitem', { name: LOGOUT, exact: true });
  await visible(item, 'avatar menu');
  if (await item.first().isVisible().catch(() => false)) {
    await item.first().click();
    const confirm = page.getByRole('dialog', { name: LOGOUT });
    if (!(await confirm.isVisible().catch(() => false))) problems.push('no confirmation dialog');
    else await confirm.getByRole('button', { name: 'انصراف' }).click();
  }
  return problems;
}
const skipKinds = (args.find((a) => a.startsWith('--skip=')) || '--skip=').slice('--skip='.length).split(',').filter(Boolean);

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
      mkdirSync(join(outDir, vp.name, 'top'), { recursive: true });
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: vp.isMobile, hasTouch: vp.isMobile, locale: 'fa-IR' });
      const page = await context.newPage();
      page.on('pageerror', (e) => pageErrors.push(`${vp.name} ${page.url()}: ${e.message}`));
      for (const route of routes) {
        await page.goto('about:blank');
        await page.goto(`${base}#${route.path}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('main', { timeout: 20000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400); // lazy chunks and chart transitions
        await page.screenshot({ path: join(outDir, vp.name, `${route.id}.png`), fullPage: true });
        await page.screenshot({ path: join(outDir, vp.name, 'top', `${route.id}.png`) });
        const audit = await page.evaluate(auditPage, MIN_FONT_PX);
        results.push({ viewport: vp.name, route: route.id, path: route.path, ...audit });
        const counts = KINDS.filter((k) => !skipKinds.includes(k)).map((k) => `${k} ${audit[k].length}`);
        const flag = KINDS.some((k) => !skipKinds.includes(k) && audit[k].length) ? '✘' : '✔';
        console.log(`  ${flag} ${vp.name.padStart(4)} ${route.path.padEnd(26)} texts ${String(audit.checked).padStart(4)}  ${counts.join('  ')}`);
      }
      if (!skipKinds.includes('logout')) {
        await page.goto('about:blank');
        await page.goto(`${base}#/`, { waitUntil: 'networkidle' });
        await page.waitForSelector('main', { timeout: 20000 });
        const logout = await checkLogout(page, vp);
        const empty = Object.fromEntries(KINDS.map((k) => [k, []]));
        results.push({ viewport: vp.name, route: 'logout', path: '/', ...empty, logout, checked: 0, loadedFonts: [] });
        console.log(`  ${logout.length ? '✘' : '✔'} ${vp.name.padStart(4)} «${LOGOUT}»${' '.repeat(12)}${logout.join('؛ ') || 'در منو و منوی آواتار، با تأیید'}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  writeFileSync(join(outDir, 'audit.json'), JSON.stringify({ results, pageErrors }, null, 2));
  const totals = Object.fromEntries(KINDS.map((k) => [k, results.reduce((n, r) => n + r[k].length, 0)]));
  const fonts = [...new Set(results.flatMap((r) => r.loadedFonts))];
  const nonVazir = fonts.filter((f) => !/^vazirmatn/i.test(f));
  console.log(`\n${routes.length} مسیر × ${VIEWPORTS.length} عرض؛ اسکرین‌شات‌ها در ${outDir}`);
  console.log(KINDS.map((k) => `${KIND_LABELS[k]}: ${totals[k]}${skipKinds.includes(k) ? ' (بررسی نشد)' : ''}`).join(' · '));
  console.log(`فونت‌های بارگذاری‌شده: ${fonts.join('، ') || '—'} · خطای صفحه: ${pageErrors.length}`);
  for (const k of KINDS) {
    if (skipKinds.includes(k)) continue;
    for (const r of results) for (const v of r[k].slice(0, 2)) console.log(`    [${k}] ${r.viewport} ${r.route}: ${v}`);
  }
  for (const e of pageErrors.slice(0, 10)) console.log(`    خطای صفحه: ${e}`);
  const failed = KINDS.some((k) => !skipKinds.includes(k) && totals[k] > 0) || nonVazir.length > 0 || pageErrors.length > 0;
  if (failed && !report) {
    console.log('\n✘ آزمون ظاهر رد شد.');
    process.exit(1);
  }
  console.log(failed ? '\n(حالت گزارش: رد نمی‌شود)' : `\n✔ همه متن‌ها ${MIN_FONT_PX}px یا بزرگ‌تر، با فونت Vazirmatn، ارقام فارسی و کنتراست کافی؛ دکمه‌ها و کنترل‌ها نام دارند؛ صفحه اسکرول افقی ندارد؛ «${LOGOUT}» در هر دو عرض هست.`);
}

await main();
