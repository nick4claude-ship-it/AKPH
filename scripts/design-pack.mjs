/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// `npm run design:pack` — ZIP for the designer (docs/DESIGN-HANDOFF.md): the app source of the last
// commit, enough to run it with demo data (`npm install && npm run dev`). No server code, no reference/.
import { execFileSync } from 'node:child_process';

const out = process.argv[2] || 'design-handoff.zip';
const paths = ['src', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'docs/DESIGN-HANDOFF.md'];
execFileSync('git', ['archive', '--format=zip', `--output=${out}`, 'HEAD', '--', ...paths], { stdio: 'inherit' });
console.log(`${out}: کد اپ (آخرین commit) و docs/DESIGN-HANDOFF.md — پوشه‌های مجاز طراح: src/components، src/pages، src/index.css`);
