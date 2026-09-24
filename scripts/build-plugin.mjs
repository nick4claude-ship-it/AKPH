/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Builds the WordPress plugin package: a demo-capable production build of the app inside
// wordpress-plugin/akph-portal/app, zipped as .plugin-build/akph-portal.zip.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('.');
const out = join(root, '.plugin-build');
const pluginDir = join(out, 'akph-portal');

rmSync(out, { recursive: true, force: true });
mkdirSync(pluginDir, { recursive: true });
cpSync(join(root, 'wordpress-plugin', 'akph-portal'), pluginDir, { recursive: true });

execFileSync('npx', ['vite', 'build', '--outDir', join(pluginDir, 'app'), '--emptyOutDir'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEMO_DATA: 'true' },
});
if (!existsSync(join(pluginDir, 'app', '.vite', 'manifest.json'))) throw new Error('manifest.json missing');

execFileSync('zip', ['-rq', 'akph-portal.zip', 'akph-portal'], { cwd: out, stdio: 'inherit' });
console.log(`\nWordPress plugin: ${join(out, 'akph-portal.zip')}`);
