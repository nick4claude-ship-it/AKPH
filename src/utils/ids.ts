/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getCurrentPersianYear } from './date';

/**
 * Generate a cryptographically secure UUID for all internal entity IDs.
 * Strictly avoids Math.random() or Date.now() for entity IDs.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback if randomUUID is not natively available in environment
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate the next sequential document number for a given prefix and year.
 * e.g., Prefix 'ACC' in year 1403:
 * Scans existing codes like 'ACC-1403-001', 'ACC-1403-002',
 * extracts highest number and produces 'ACC-1403-003' without gaps.
 */
export function getNextSequentialDocNumber(
  existingCodes: string[],
  prefix: string,
  padLength: number = 3,
  year?: number
): string {
  const currentYear = year || getCurrentPersianYear();
  const yearPrefix = `${prefix}-${currentYear}-`;

  let maxSeq = 0;
  for (const code of existingCodes) {
    if (!code) continue;
    if (code.startsWith(yearPrefix)) {
      const remainder = code.substring(yearPrefix.length);
      const num = parseInt(remainder, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    } else if (code.startsWith(`${prefix}-`)) {
      const parts = code.split('-');
      const lastPart = parts[parts.length - 1];
      const num = parseInt(lastPart, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const padded = nextSeq.toString().padStart(padLength, '0');
  return `${yearPrefix}${padded}`;
}
