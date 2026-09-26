/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Inbox } from 'lucide-react';

/** Shown instead of zeros and empty tables: what is missing and, when there is one, the action that fills it. */
export const EmptyState: React.FC<{
  title?: string;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}> = ({ title = 'هنوز داده‌ای ثبت نشده', description, icon: Icon = Inbox, action, compact = false, className = '' }) => (
  <div className={`flex flex-col items-center justify-center text-center ${compact ? 'gap-2 py-6 px-4' : 'gap-3 py-12 px-6'} ${className}`} role="status">
    <span className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded-full bg-canvas text-ink-subtle flex items-center justify-center`}>
      <Icon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
    </span>
    <p className={`${compact ? 'text-sm' : 'text-base'} font-bold text-ink`}>{title}</p>
    {description && <p className="text-xs text-ink-subtle max-w-sm">{description}</p>}
    {action && <div className="mt-1">{action}</div>}
  </div>
);

/** An empty table body: one row across every column. */
export const EmptyTableRow: React.FC<{ colSpan: number; title?: string; description?: React.ReactNode; action?: React.ReactNode }> = ({ colSpan, ...props }) => (
  <tr>
    <td colSpan={colSpan}>
      <EmptyState compact {...props} />
    </td>
  </tr>
);
