/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * Top of a module screen: its title (h2; the page h1 is in the app header), one line on what it is for,
 * and the screen's main actions. Replaces the large colored banners so every module starts the same way.
 */
export const PageHeader: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  /** Chips or small facts under the description. */
  meta?: React.ReactNode;
  className?: string;
}> = ({ title, description, icon: Icon, actions, meta, className = '' }) => (
  <div className={`flex flex-wrap items-start justify-between gap-4 ${className}`}>
    <div className="flex items-start gap-3 min-w-0 flex-1">
      {Icon && (
        <span className="w-11 h-11 rounded-xl bg-brand-soft text-brand-strong border border-amber-200 flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6" />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        {description && <p className="text-sm text-ink-muted mt-1 max-w-3xl">{description}</p>}
        {meta && <div className="flex flex-wrap items-center gap-2 mt-2">{meta}</div>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
