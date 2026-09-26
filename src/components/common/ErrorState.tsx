/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

/** A failure the user can act on: what happened and a retry. */
export const ErrorState: React.FC<{ title?: string; description?: React.ReactNode; onRetry?: () => void; className?: string }> = ({
  title = 'نمایش این بخش ممکن نشد',
  description = 'مشکلی در نمایش اطلاعات پیش آمد. دوباره تلاش کنید؛ اگر تکرار شد، صفحه را تازه کنید.',
  onRetry,
  className = '',
}) => (
  <div className={`card p-8 text-center max-w-lg mx-auto space-y-3 ${className}`} role="alert">
    <span className="w-12 h-12 rounded-full bg-danger-soft text-danger flex items-center justify-center mx-auto">
      <AlertTriangle className="w-6 h-6" />
    </span>
    <h2 className="text-base font-bold text-ink">{title}</h2>
    <p className="text-sm text-ink-muted">{description}</p>
    {onRetry && (
      <Button variant="primary" icon={RotateCcw} onClick={onRetry}>
        تلاش دوباره
      </Button>
    )}
  </div>
);

/** Catches a render error of one page so the rest of the portal keeps working. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  componentDidCatch(error: unknown) {
    console.error('[portal] page failed to render', error);
  }

  render() {
    if (this.state.failed) return <ErrorState onRetry={() => this.setState({ failed: false })} />;
    return this.props.children;
  }
}
