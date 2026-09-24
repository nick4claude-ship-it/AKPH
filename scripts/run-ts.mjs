/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Bundles a TypeScript scenario with esbuild (already a build dependency) and runs it in Node.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const entry = process.argv[2];
if (!entry) {
  console.error('usage: node scripts/run-ts.mjs <file.ts>');
  process.exit(2);
}

const dir = mkdtempSync(join(tmpdir(), 'akph-scenario-'));
const outfile = join(dir, 'scenario.mjs');
try {
  await build({
    entryPoints: [resolve(entry)],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'warning',
    loader: { '.jpg': 'empty', '.png': 'empty', '.svg': 'empty' },
    define: { 'import.meta.env.DEV': 'true', 'import.meta.env.PROD': 'false' },
  });
  await import(pathToFileURL(outfile).href);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
