/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const READ_ONLY_NOTICE = 'فقط خواندنی — به‌زودی: ثبت و تأیید این بخش هنوز در سرور پیاده نشده است.';

/** Notice for a section whose writes the data source does not execute (null when writes work there). */
export function readOnlyNoticeFor(writablePaths: readonly string[] | undefined, pathname: string): string | null {
  if (!writablePaths) return null;
  const backed = writablePaths.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));
  return backed ? null : READ_ONLY_NOTICE;
}
