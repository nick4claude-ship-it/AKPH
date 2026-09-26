/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/** The stages of a workflow, in order, as a light strip (the last stage can be highlighted as the outcome). */
export const StepStrip: React.FC<{ title: string; steps: { label: string; hint?: string }[]; highlightLast?: boolean; className?: string }> = ({
  title,
  steps,
  highlightLast = false,
  className = '',
}) => (
  <section className={`card p-4 ${className}`} aria-label={title}>
    <h3 className="text-sm font-bold text-ink mb-3">{title}</h3>
    <ol className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
      {steps.map((step, i) => {
        const last = highlightLast && i === steps.length - 1;
        return (
          <li key={step.label} className={`rounded-lg border p-3 ${last ? 'border-amber-300 bg-brand-soft' : 'border-line bg-surface-muted'}`}>
            <span className="block text-sm font-bold text-ink">{step.label}</span>
            {step.hint && <span className="block text-xs text-ink-subtle mt-1">{step.hint}</span>}
          </li>
        );
      })}
    </ol>
  </section>
);
