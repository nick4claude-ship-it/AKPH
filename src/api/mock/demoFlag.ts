/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Operational demo records ship only in DEV and in demo builds (VITE_DEMO_DATA=true: the GitHub Pages
 * site). The value is a build-time constant, so a plain production build (the WordPress plugin) drops
 * the sample records from the bundle entirely instead of carrying them unused.
 */
export const DEMO_DATA: boolean = import.meta.env.DEV === true || import.meta.env.VITE_DEMO_DATA === 'true';

export function demoDataEnabled(): boolean {
  return DEMO_DATA;
}
