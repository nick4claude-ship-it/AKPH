/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';

const EVENT = 'portal:toast';

/** Shows a message in the app toast from code that has no access to the App shell (e.g. sync errors). */
export function emitToast(message: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

export function useToastListener(onMessage: (message: string) => void): void {
  useEffect(() => {
    const handler = (e: Event) => onMessage((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [onMessage]);
}
