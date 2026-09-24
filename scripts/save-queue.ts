/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Store persistence: serial saves, "saved" only after confirmation, retry, rollback.
import assert from 'node:assert/strict';
import { SaveQueue, diffStates } from '../src/store/saveQueue';
import { emptyState } from '../src/store/state';
import type { AppState } from '../src/store/types';
import type { StoreChange } from '../src/api/types';

const base = emptyState();
const withSuppliers = (n: number): AppState => ({ ...base, suppliers: Array.from({ length: n }, (_, i) => ({ id: `s${i}` }) as never) });

// 1) Serial saves; saved state advances only after the save resolves.
{
  let saved = base;
  let latest = withSuppliers(1);
  const log: string[] = [];
  let release!: () => void;
  const q = new SaveQueue({
    save: async (changes) => {
      log.push(`start:${(changes[0] as { upserted: unknown[] }).upserted.length}`);
      if (log.length === 1) await new Promise<void>((r) => (release = r));
      log.push('end');
    },
    getSaved: () => saved,
    setSaved: (s) => (saved = s),
    getLatest: () => latest,
    rollback: () => assert.fail('no rollback expected'),
    wait: async () => undefined,
  });
  const first = q.flush();
  await Promise.resolve();
  assert.equal(saved, base, 'not marked saved before the server confirmed');
  latest = { ...latest, suppliers: [...latest.suppliers, { id: 's1' } as never] };
  const second = q.flush();
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(log, ['start:1'], 'the second save waits for the first');
  release();
  await first;
  await second;
  assert.deepEqual(log, ['start:1', 'end', 'start:1', 'end'], 'second save sends only what changed since the first');
  assert.equal(saved, latest);
  console.log('  ✔ ذخیره‌ها پشت‌سرهم؛ وضعیت «ذخیره‌شده» فقط پس از تأیید سرور جلو می‌رود');
}

// 2) A transient failure is retried.
{
  let saved = base;
  const latest = withSuppliers(1);
  let calls = 0;
  const q = new SaveQueue({
    save: async () => {
      calls++;
      if (calls === 1) throw new Error('network');
    },
    getSaved: () => saved,
    setSaved: (s) => (saved = s),
    getLatest: () => latest,
    rollback: () => assert.fail('no rollback expected'),
    wait: async () => undefined,
  });
  await q.flush();
  assert.equal(calls, 2);
  assert.equal(saved, latest);
  console.log('  ✔ خطای گذرا دوباره تلاش می‌شود');
}

// 3) A persistent failure rolls back to the last saved state.
{
  let saved = base;
  const latest = withSuppliers(3);
  let rolledBackTo: AppState | null = null;
  const q = new SaveQueue({
    save: async () => {
      throw Object.assign(new Error('403'), { farsiMessage: 'دسترسی ندارید' });
    },
    getSaved: () => saved,
    setSaved: (s) => (saved = s),
    getLatest: () => latest,
    rollback: (to) => (rolledBackTo = to),
    retries: 2,
    wait: async () => undefined,
  });
  await q.flush();
  assert.equal(rolledBackTo, base, 'rolled back to the last confirmed state');
  assert.equal(saved, base, 'saved state not moved');
  console.log('  ✔ خطای ماندگار پس از تلاش مجدد به آخرین وضعیت ذخیره‌شده برمی‌گردد');
}

// 4) A final journal entry is never sent as changed.
{
  const entry = { id: 'j1', docNumber: 'ACC-1405-00001', status: 'ثبت قطعی', rows: [] } as never;
  const edited = { id: 'j1', docNumber: 'ACC-1405-00001', status: 'ثبت قطعی', rows: [], title: 'x' } as never;
  const err = console.error;
  console.error = () => undefined;
  const changes: StoreChange[] = diffStates({ ...base, journalEntries: [entry] }, { ...base, journalEntries: [edited] });
  console.error = err;
  assert.deepEqual(changes, []);
  console.log('  ✔ ویرایش سند قطعی هرگز ارسال نمی‌شود');
}

console.log('\nذخیره‌سازی: همه آزمون‌ها موفق.');
