/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Builds the installable WordPress plugin: .plugin-build/akph-portal.zip
//   akph-portal/akph-portal.php, readme.txt, includes/*.php   the server (akph/v1)
//   akph-portal/app/                                          the built app (Vite manifest, JS, CSS, Vazirmatn woff2)
// The app is a plain production build: no sample records (they exist only in demo builds), no source
// maps, no TypeScript, no node_modules, no environment files. The package is checked before zipping.
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve('.');
const out = join(root, '.plugin-build');
const pluginDir = join(out, 'akph-portal');
const source = join(root, 'wordpress-plugin', 'akph-portal');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(pluginDir, 'includes'), { recursive: true });
for (const f of ['akph-portal.php', 'readme.txt']) copyFileSync(join(source, f), join(pluginDir, f));
for (const f of readdirSync(join(source, 'includes'))) {
  if (f.endsWith('.php')) copyFileSync(join(source, 'includes', f), join(pluginDir, 'includes', f));
}

// Plain production build: VITE_DEMO_DATA and VITE_PAGES are never set here.
const env = { ...process.env };
delete env.VITE_DEMO_DATA;
delete env.VITE_PAGES;
delete env.PAGES_BASE;
execFileSync('npx', ['vite', 'build', '--outDir', join(pluginDir, 'app'), '--emptyOutDir', '--sourcemap', 'false'], { stdio: 'inherit', env });
if (!existsSync(join(pluginDir, 'app', '.vite', 'manifest.json'))) throw new Error('manifest.json missing');
cpSync(join(root, 'node_modules', '@fontsource-variable', 'vazirmatn', 'LICENSE'), join(pluginDir, 'app', 'VAZIRMATN-LICENSE-OFL.txt'));
// The app shell of the plugin is rendered by PHP (includes/class-akph-app.php); Vite's HTML is not used.
rmSync(join(pluginDir, 'app', 'index.html'), { force: true });

// ------------------------------------------------------------------ package check
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
const files = walk(pluginDir).map((p) => relative(out, p).replace(/\\/g, '/'));
const problems = [];
for (const f of files) {
  if (/(^|\/)node_modules\//.test(f)) problems.push(`node_modules: ${f}`);
  if (/\.(tsx?|map|mjs)$/.test(f) && !f.endsWith('.d.ts')) problems.push(`source or map file: ${f}`);
  if (/(^|\/)\.env/.test(f) || /(^|\/)(wp-config|wp-tests-config)\.php$/.test(f) || /\.(sql|log|pem|key)$/.test(f)) problems.push(`environment file: ${f}`);
  if (/(^|\/)tests?\//.test(f)) problems.push(`tests: ${f}`);
}
// Sample records of the demo dataset must not be in the plugin (they live only in demo builds).
const SAMPLE_MARKERS = ['prj-101', 'PRJ-101', 'رونیکا', 'کاربر مدیر ارشد نمونه', 'usr-001', '@example.com'];
for (const f of files.filter((x) => /\.(js|css|php|json|txt)$/.test(x))) {
  const text = readFileSync(join(out, f), 'utf8');
  for (const m of SAMPLE_MARKERS) if (text.includes(m)) problems.push(`sample data «${m}» in ${f}`);
}
if (!files.some((f) => /app\/assets\/vazirmatn-.*\.woff2$/.test(f))) problems.push('Vazirmatn font files missing from app/assets');
if (problems.length) {
  console.error('\nPlugin package check failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}

execFileSync('zip', ['-rqX', 'akph-portal.zip', 'akph-portal'], { cwd: out, stdio: 'inherit' });
const version = /Version:\s*([0-9.]+)/.exec(readFileSync(join(source, 'akph-portal.php'), 'utf8'))?.[1];
console.log(`\nWordPress plugin ${version}: ${join(out, 'akph-portal.zip')} (${files.length} files, package check passed)`);
