/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppDocument } from '../../types';
import type { DocumentApi } from '../documents';
import { ApiError } from '../client';
import { formatOfFile, previewableMime } from '../../store/documents';
import { formatFileSize } from '../../utils/formatters';
import { getCurrentFiscalYear, toPersianDate } from '../../utils/date';
import { generateUUID } from '../../utils/ids';

/**
 * Documents of the demo: uploaded files stay in this browser tab (object URLs); nothing reaches a server.
 * Upload progress is simulated.
 */
export function createMockDocumentApi(userName: () => string): DocumentApi {
  const files = new Map<string, Blob>();
  let seq = 0;
  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
  return {
    demo: true,
    async upload(file, meta, _key, onProgress) {
      for (const step of [0.25, 0.5, 0.75, 1]) {
        await pause(60);
        onProgress(step);
      }
      const id = generateUUID();
      files.set(id, file);
      seq += 1;
      const links = [...(meta.projectId ? [{ entityType: 'project' as const, entityId: meta.projectId }] : []), ...(meta.counterpartyId ? [{ entityType: 'counterparty' as const, entityId: meta.counterpartyId }] : []), ...(meta.link ? [meta.link] : [])];
      const document: AppDocument = {
        id,
        title: meta.title.trim() || file.name,
        type: meta.category,
        fileName: file.name,
        links,
        docNumber: `DOC-${getCurrentFiscalYear()}-D${String(seq).padStart(4, '0')}`,
        date: toPersianDate(new Date()),
        fileFormat: formatOfFile(file.name),
        fileSize: formatFileSize(file.size),
        version: '1',
        status: 'معتبر و جاری',
        confidentiality: 'عادی',
        registeredBy: userName(),
        tags: [],
        description: meta.description,
        url: URL.createObjectURL(file),
        file: { mime: file.type || 'application/octet-stream', sizeBytes: file.size, previewable: previewableMime(file.type), canArchive: true, recordVersion: 1, projectId: meta.projectId || undefined },
      };
      return { message: `سند ${document.docNumber} بارگذاری شد (نسخه نمایشی: فقط در همین مرورگر).`, document, duplicateOf: [] };
    },
    async fetchFile(doc) {
      const blob = files.get(doc.id);
      if (blob) return blob;
      if (doc.url) return (await fetch(doc.url)).blob();
      throw new ApiError(404, 'No file', 'فایل اصلی این سند در نسخه نمایشی موجود نیست.');
    },
    async link(doc, link) {
      return { message: 'سند به رکورد پیوند شد.', document: { ...doc, links: [...doc.links, link] } };
    },
    async archive(doc) {
      return { message: `سند ${doc.docNumber} بایگانی شد.`, document: { ...doc, status: 'بایگانی‌شده', file: doc.file ? { ...doc.file, canArchive: false } : doc.file } };
    },
  };
}
