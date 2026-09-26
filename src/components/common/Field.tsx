/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface FieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

/**
 * A labelled form field: label (htmlFor), the control, and a hint or an inline error announced to screen
 * readers. `children` receives the props the control needs (id, aria-invalid, aria-describedby).
 */
export const Field: React.FC<{
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (control: FieldControlProps) => React.ReactNode;
}> = ({ id, label, hint, error, required, className = '', children }) => {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1">
        {label}
        {required && (
          <span className="text-danger" aria-hidden>
            {' '}*
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger mt-1">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-subtle mt-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

/** Result line under a form: success or failure, announced politely. */
export const FormStatus: React.FC<{ outcome: { ok: boolean; message: string } | null }> = ({ outcome }) => (
  <p role="status" aria-live="polite" className={`text-sm min-h-6 ${outcome ? (outcome.ok ? 'text-success' : 'text-danger') : ''}`}>
    {outcome?.message}
  </p>
);
