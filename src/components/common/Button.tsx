/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: the main action of a screen or dialog; secondary: others; danger: destructive; ghost: toolbar. */
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  /** Shows a spinner, keeps the width and blocks clicks until the action ends. */
  loading?: boolean;
  /** Icon before the label (lucide component). */
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /** Square icon-only button; give it an aria-label. */
  iconOnly?: boolean;
};

/** Class list of a button, for elements that cannot use <Button> (links styled as buttons). */
export function buttonClass(variant: ButtonVariant = 'secondary', size: 'md' | 'sm' = 'md', extra = ''): string {
  return `btn btn-${variant}${size === 'sm' ? ' btn-sm' : ''}${extra ? ` ${extra}` : ''}`;
}

/** The app's button: three levels (primary, secondary, danger) plus ghost, with disabled and loading states. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon: Icon, iconOnly = false, className = '', disabled, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, `${iconOnly ? 'btn-icon' : ''} ${className}`.trim())}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : Icon ? <Icon className="w-4 h-4 shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
});
