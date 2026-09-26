/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Skeleton } from '../common/Skeleton';
import { ErrorState } from '../common/ErrorState';

/** While the session and the user's data load: the outline of the portal. */
export const BootLoading: React.FC = () => (
  <div className="min-h-screen bg-canvas flex" role="status" aria-live="polite">
    <span className="sr-only">در حال بارگذاری پورتال…</span>
    <div className="hidden lg:flex flex-col gap-3 w-68 bg-nav p-4 shrink-0">
      <Skeleton className="h-10 w-40 bg-white/10" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Skeleton key={i} className="h-8 w-full bg-white/10" />
      ))}
    </div>
    <div className="flex-1 min-w-0">
      <div className="h-16 bg-surface border-b border-line px-6 flex items-center">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="p-4 sm:p-6 lg:p-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-4 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** The session or the data could not be loaded. */
export const BootError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
    <ErrorState title="بارگذاری پورتال انجام نشد" description={message} onRetry={onRetry} />
  </div>
);
