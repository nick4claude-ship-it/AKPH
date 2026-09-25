/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Stack of open dialogs so Esc and the focus trap only act on the top-most one. */
const openDialogs: HTMLElement[] = [];

type PanelProps = {
  /** Accessible name when the dialog has no visible element to point at with `labelledBy`. */
  label?: string;
  /** id of the visible title element. */
  labelledBy?: string;
  describedBy?: string;
  /** Classes of the panel (the element with role="dialog"). */
  className?: string;
  /** Classes of the full-screen backdrop. */
  overlayClassName?: string;
  /** Close when the backdrop itself is clicked. */
  closeOnBackdrop?: boolean;
  /** Element focused on open; defaults to the first focusable element in the panel. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
};

type DialogProps = PanelProps &
  ({ as?: 'div' } | { as: 'form'; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; noValidate?: boolean });

const DEFAULT_OVERLAY = 'fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto';

/**
 * Shared modal: role="dialog", aria-modal, focus trap, Esc to close, focus restored on close.
 * Every modal in the app renders through this component (or ConfirmDialog, which uses it).
 */
export const Dialog: React.FC<DialogProps> = (props) => {
  const { label, labelledBy, describedBy, className, overlayClassName, closeOnBackdrop, initialFocusRef, onClose, children } = props;
  const panelRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Runs once per mount: dialogs are mounted while open and unmounted when closed.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openDialogs.push(panel);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const target = initialFocusRef?.current || focusables()[0] || panel;
    target.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== panel) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const idx = openDialogs.lastIndexOf(panel);
      if (idx >= 0) openDialogs.splice(idx, 1);
      if (openDialogs.length === 0) document.body.style.overflow = prevOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);

  const common = {
    role: 'dialog' as const,
    'aria-modal': true as const,
    'aria-label': labelledBy ? undefined : label,
    'aria-labelledby': labelledBy,
    'aria-describedby': describedBy,
    tabIndex: -1,
    className: `${className || ''} focus:outline-none`,
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  };

  return (
    <div
      className={overlayClassName || DEFAULT_OVERLAY}
      onMouseDown={closeOnBackdrop ? () => onClose() : undefined}
      dir="rtl"
    >
      {props.as === 'form' ? (
        <form {...common} ref={(el) => { panelRef.current = el; }} onSubmit={props.onSubmit} noValidate={props.noValidate}>
          {children}
        </form>
      ) : (
        <div {...common} ref={(el) => { panelRef.current = el; }}>
          {children}
        </div>
      )}
    </div>
  );
};
