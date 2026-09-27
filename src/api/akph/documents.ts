/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppDocument } from '../../types';
import type { DocumentApi, DocumentUploadMeta } from '../documents';
import { apiClient, apiErrorFrom, ApiError, authHeaders, buildApiUrl } from '../client';
import { CATEGORY_OF, DOC_TYPE_OF, formatOfFile, toAppEntity, toServerEntity } from '../../store/documents';
import { isoToJalali } from '../../utils/jalali';
import { formatFileSize } from '../../utils/formatters';
import { obj } from './mapping';

/** Documents of the akph/v1 server: multipart upload with progress (XMLHttpRequest), download as a Blob. */

const text = (v: unknown) => (typeof v === 'string' ? v : '');

export function parseDocument(raw: unknown): AppDocument {
  const o = obj('/documents', raw, 'document');
  const size = Number(o.size) || 0;
  const version = Number(o.version) || 1;
  const links = Array.isArray(o.links) ? o.links : [];
  return {
    id: text(o.id),
    title: text(o.title),
    type: CATEGORY_OF[text(o.doc_type)] ?? 'سایر اسناد',
    fileName: text(o.file_name),
    links: links.map((l) => {
      const x = obj('/documents', l, 'links');
      return { entityType: toAppEntity(text(x.entity_type)), entityId: text(x.entity_id) };
    }),
    docNumber: text(o.doc_number),
    date: isoToJalali(text(o.uploaded_at).slice(0, 10)),
    fileFormat: formatOfFile(text(o.file_name)),
    fileSize: formatFileSize(size),
    version: String(version),
    status: o.status === 'archived' ? 'بایگانی‌شده' : 'معتبر و جاری',
    confidentiality: 'عادی',
    registeredBy: text(o.uploaded_by_name),
    tags: [],
    description: text(o.description),
    file: {
      mime: text(o.mime),
      sizeBytes: size,
      previewable: o.preview === true,
      canArchive: o.can_archive === true,
      recordVersion: version,
      projectId: typeof o.project_id === 'string' ? o.project_id : undefined,
    },
  };
}

const firstDocument = (raw: unknown) => {
  const records = obj('/documents', obj('/documents', raw).records ?? {}, 'records');
  return parseDocument(Array.isArray(records.documents) ? records.documents[0] : undefined);
};

/** Multipart POST with upload progress; the same Idempotency-Key for every send of the same submission. */
function sendForm(path: string, form: FormData, key: string, onProgress: (fraction: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildApiUrl(path));
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Idempotency-Key', key);
    for (const [name, value] of Object.entries(authHeaders())) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(apiErrorFrom(xhr.status, body));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Network error', 'عدم برقراری ارتباط با سرور؛ دوباره تلاش کنید.'));
    xhr.send(form);
  });
}

export function createAkphDocumentApi(): DocumentApi {
  return {
    demo: false,
    async upload(file: File, meta: DocumentUploadMeta, key, onProgress) {
      const form = new FormData();
      form.append('file', file, file.name);
      if (meta.title.trim()) form.append('title', meta.title.trim());
      form.append('doc_type', DOC_TYPE_OF[meta.category] ?? 'other');
      if (meta.description.trim()) form.append('description', meta.description.trim());
      if (meta.projectId) form.append('project_id', meta.projectId);
      if (meta.counterpartyId) form.append('counterparty_id', meta.counterpartyId);
      if (meta.link) {
        form.append('entity_type', toServerEntity(meta.link.entityType));
        form.append('entity_id', meta.link.entityId);
      }
      const raw = await sendForm('documents', form, key, onProgress);
      const o = obj('/documents', raw);
      return {
        message: text(o.message) || 'بارگذاری شد.',
        document: firstDocument(raw),
        duplicateOf: Array.isArray(o.duplicate_of) ? o.duplicate_of.map(String) : [],
      };
    },
    async fetchFile(doc, inline) {
      const url = buildApiUrl(`documents/${doc.id}/download`, inline ? { inline: 1 } : undefined);
      let response: Response;
      try {
        response = await fetch(url, { headers: authHeaders(), credentials: 'same-origin' });
      } catch {
        throw new ApiError(0, 'Network error', 'عدم برقراری ارتباط با سرور؛ دوباره تلاش کنید.');
      }
      if (!response.ok) {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          /* not JSON */
        }
        throw apiErrorFrom(response.status, body);
      }
      return response.blob();
    },
    async link(doc, link, key) {
      const raw = await apiClient.command<unknown>('POST', `documents/${doc.id}/links`, { entity_type: toServerEntity(link.entityType), entity_id: link.entityId }, { idempotencyKey: key });
      return { message: text(obj('/documents', raw).message) || 'پیوند شد.', document: firstDocument(raw) };
    },
    async archive(doc, key) {
      const version = doc.file?.recordVersion ?? 1;
      const raw = await apiClient.command<unknown>('POST', `documents/${doc.id}/archive`, { version }, { idempotencyKey: key, version });
      return { message: text(obj('/documents', raw).message) || 'بایگانی شد.', document: firstDocument(raw) };
    },
  };
}

/** Every document the user may see (active and archived) for the store. */
export async function loadDocuments(): Promise<AppDocument[]> {
  const raw = obj('/documents', await apiClient.get<unknown>('documents', { status: 'all', per_page: 200 }));
  return (Array.isArray(raw.documents) ? raw.documents : []).map(parseDocument);
}
