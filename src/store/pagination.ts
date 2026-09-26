/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { usePreferences } from './session';

/**
 * Rows of one table page, sized by the user's «تعداد ردیف جدول» preference. The page goes back to the first
 * one when `resetKey` (a filter or search) or the page size changes.
 */
export function usePagination<T>(items: readonly T[], resetKey?: unknown) {
  const pageSize = usePreferences().rowsPerPage;
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey, pageSize]);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  return {
    rows: items.slice(start, start + pageSize),
    page: current,
    pageCount,
    pageSize,
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
    hasPrev: current > 1,
    hasNext: current < pageCount,
    prev: () => setPage(Math.max(1, current - 1)),
    next: () => setPage(Math.min(pageCount, current + 1)),
  };
}

export type Pagination<T> = ReturnType<typeof usePagination<T>>;
