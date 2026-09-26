/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/** Grey placeholder block while data loads. */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => <div className={`skeleton ${className}`} aria-hidden="true" />;

/** Placeholder of a whole page: title, a row of stat cards and a table. */
export const PageSkeleton: React.FC<{ label?: string }> = ({ label = 'در حال بارگذاری…' }) => (
  <div className="space-y-6" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    <div className="space-y-2">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
    <div className="card p-4 space-y-3">
      <Skeleton className="h-5 w-40" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  </div>
);
