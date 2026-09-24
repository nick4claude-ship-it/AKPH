/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Builds the public GitHub Pages demo into dist/: demo data only (no WordPress REST source),
// served from PAGES_BASE (default /AKPH/, the project site https://<owner>.github.io/AKPH/).
import { execFileSync } from 'node:child_process';
import { copyFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const base = process.env.PAGES_BASE || '/AKPH/';
if (!base.startsWith('/') || !base.endsWith('/')) throw new Error(`PAGES_BASE must start and end with "/": ${base}`);
const out = resolve('dist');

execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], {
  stdio: 'inherit',
  env: { ...process.env, PAGES_BASE: base, VITE_DEMO_DATA: 'true', VITE_PAGES: 'true' },
});

// Routing is hash based (#/projects), so every page is index.html. A mistyped path still lands on the app.
copyFileSync(join(out, 'index.html'), join(out, '404.html'));
// Serve files as built (no Jekyll processing).
writeFileSync(join(out, '.nojekyll'), '');
console.log(`\nGitHub Pages build: ${out} (base ${base})`);
