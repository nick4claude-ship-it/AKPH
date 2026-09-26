/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatInt } from '../../utils/formatters';

interface PagerState {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  hasPrev: boolean;
  hasNext: boolean;
  prev: () => void;
  next: () => void;
}

/** Under a paged table (usePagination): which rows are shown and previous/next page. Hidden for one page. */
export const TablePager: React.FC<{ pager: PagerState; label?: string }> = ({ pager, label = 'صفحه‌بندی جدول' }) => {
  if (pager.pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-line text-sm text-ink-muted">
      <span>
        ردیف {formatInt(pager.from)} تا {formatInt(pager.to)} از {formatInt(pager.total)}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={pager.prev} disabled={!pager.hasPrev}>
          <ChevronRight className="w-4 h-4" aria-hidden />
          قبلی
        </button>
        <span aria-current="page">
          صفحه {formatInt(pager.page)} از {formatInt(pager.pageCount)}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={pager.next} disabled={!pager.hasNext}>
          بعدی
          <ChevronLeft className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
};
