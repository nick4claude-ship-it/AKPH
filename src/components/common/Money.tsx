/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { formatDecimal, formatPercent, moneyParts, formatText } from '../../utils/formatters';

/**
 * A stored Rial amount in the display currency: Persian digits with separators (dir="ltr" on the number only,
 * tabular figures), then the unit once, smaller and muted. `compact` uses magnitude words (۱۸٫۵ میلیارد).
 */
export const Money: React.FC<{ rial: number; compact?: boolean; className?: string; unit?: boolean }> = ({ rial, compact = false, className = '', unit = true }) => {
  const parts = moneyParts(rial, compact);
  return (
    <span className={`inline-flex items-baseline gap-1 whitespace-nowrap ${className}`}>
      <span dir="ltr" className="tabular-nums">
        {formatText(parts.number)}
      </span>
      {parts.magnitude && <span>{formatText(parts.magnitude)}</span>}
      {unit && parts.unit && <span className="text-xs font-normal text-ink-subtle">{formatText(parts.unit)}</span>}
    </span>
  );
};

/** A count or quantity (not money) with Persian digits. */
export const Num: React.FC<{ value: number | null | undefined; digits?: number; className?: string }> = ({ value, digits = 0, className = '' }) => (
  <span dir="ltr" className={`tabular-nums ${className}`}>
    {formatDecimal(value ?? 0, digits) || '۰'}
  </span>
);

/** A percentage with Persian digits and ٪. */
export const Percent: React.FC<{ value: number; digits?: number; className?: string }> = ({ value, digits = 1, className = '' }) => (
  <span dir="ltr" className={`tabular-nums ${className}`}>
    {formatPercent(value, digits)}
  </span>
);
