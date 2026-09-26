/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/** White surface with the standard border, radius and shadow. */
export const Card: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' }> = ({ as = 'section', className = '', children, ...rest }) => {
  const Tag = as;
  return (
    <Tag className={`card ${className}`} {...rest}>
      {children}
    </Tag>
  );
};

/** Title row of a card or page section: title, optional description and actions. */
export const CardHeader: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  className?: string;
  /** Heading level for the document outline (default h3). */
  level?: 2 | 3 | 4;
}> = ({ title, description, icon: Icon, actions, className = '', level = 3 }) => {
  const H = `h${level}` as 'h2' | 'h3' | 'h4';
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span className="w-10 h-10 rounded-lg bg-brand-soft text-brand-strong flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </span>
        )}
        <div className="min-w-0">
          <H className="text-base font-bold text-ink">{title}</H>
          {description && <p className="text-xs text-ink-subtle mt-1">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
};
