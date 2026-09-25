/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Operational demo records ship only in DEV and in demo builds (VITE_DEMO_DATA=true: the WordPress
 * demo plugin and the GitHub Pages site). A plain production build carries none of them.
 */
export function demoDataEnabled(): boolean {
  try {
    return Boolean(import.meta.env?.DEV) || import.meta.env?.VITE_DEMO_DATA === 'true';
  } catch {
    return true;
  }
}
