/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDocument, DocumentLink } from '../types';
import type { DocumentUploadMeta } from '../api/documents';
import { ApiError } from '../api/client';
import { useAppDispatch, useAppState } from './AppStore';
import { commandKeys } from './commandKeys';
import { useSession } from './session';
import { emitToast } from './toast';
import { attachmentsOf, DEFAULT_MAX_BYTES, titleFromFile, uploadError } from './documents';
import type { DocumentEntityType } from '../types';
import { generateUUID } from '../utils/ids';

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.farsiMessage : fallback);

/** Upload limit of this installation. */
export function useDocumentLimit(): number {
  return useSession().session.documentMaxBytes ?? DEFAULT_MAX_BYTES;
}

/** Download, archive and link documents; each result is merged into the store. */
export function useDocumentActions() {
  const { documents: api } = useSession();
  const dispatch = useAppDispatch();
  const merge = useCallback((doc: AppDocument) => dispatch({ type: 'MERGE_SERVER_RECORDS', records: [{ slice: 'documents', upserted: [doc as unknown as Record<string, unknown>] }] }), [dispatch]);

  /** A document has a file to download when it was uploaded (server or demo) or carries a URL. */
  const hasFile = useCallback((doc: AppDocument) => !!doc.file || !!doc.url, []);

  const download = useCallback(
    async (doc: AppDocument) => {
      if (!api) return;
      try {
        const blob = await api.fetchFile(doc, false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName || doc.title;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      } catch (err) {
        emitToast(errorText(err, 'دریافت فایل انجام نشد.'));
      }
    },
    [api]
  );

  const run = useCallback(
    async (action: string, fingerprint: unknown[], send: (key: string) => Promise<{ message: string; document: AppDocument }>) => {
      const { key, inFlight } = commandKeys.acquire(action, fingerprint);
      if (inFlight) return;
      try {
        const result = await send(key);
        commandKeys.settle(key, 'ok');
        merge(result.document);
        emitToast(result.message);
      } catch (err) {
        commandKeys.settle(key, err instanceof ApiError && err.outcomeUnknown ? 'unknown' : 'rejected');
        emitToast(errorText(err, 'انجام نشد؛ دوباره تلاش کنید.'));
      }
    },
    [merge]
  );

  const archive = useCallback(
    (doc: AppDocument) => (api ? run('documents.archive', [doc.id, doc.file?.recordVersion], (key) => api.archive(doc, key)) : Promise.resolve()),
    [api, run]
  );
  const link = useCallback(
    (doc: AppDocument, target: DocumentLink) => (api ? run('documents.link', [doc.id, target], (key) => api.link(doc, target, key)) : Promise.resolve()),
    [api, run]
  );

  return { available: !!api, demo: api?.demo ?? true, hasFile, download, archive, link };
}

/** Object URL of a document's file for the preview (PDF, images); revoked when the preview closes. */
export function useDocumentPreview(doc: AppDocument | null) {
  const { documents: api } = useSession();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const previewable = !!doc && (doc.file ? doc.file.previewable : /\.(pdf|jpe?g|png|webp)$/i.test(doc.fileName) && !!doc.url);
  useEffect(() => {
    setUrl(null);
    setError('');
    if (!doc || !api || !previewable) return;
    let alive = true;
    let objectUrl: string | null = null;
    setLoading(true);
    api
      .fetchFile(doc, true)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => alive && setError(errorText(err, 'پیش‌نمایش در دسترس نیست.')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc, api, previewable]);
  const kind: 'pdf' | 'image' | null = !previewable || !doc ? null : /pdf/i.test(doc.file?.mime || doc.fileName) ? 'pdf' : 'image';
  return { previewable, kind, url, loading, error };
}

export interface UploadItem {
  id: string;
  file: File;
  title: string;
  /** 0 to 100. */
  progress: number;
  status: 'ready' | 'uploading' | 'done' | 'error';
  message: string;
  /** Stored, but the same file is already on the same record. */
  duplicate?: boolean;
}

/**
 * Files chosen or dropped for upload, each with its progress. `start` sends them one after another with the
 * same metadata (one Idempotency-Key per file submission); successful uploads are merged into the store.
 */
export function useUploadQueue() {
  const { documents: api } = useSession();
  const dispatch = useAppDispatch();
  const maxBytes = useDocumentLimit();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [running, setRunning] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const patch = (id: string, change: Partial<UploadItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...change } : i)));

  const add = useCallback(
    (files: FileList | File[]) => {
      const next = Array.from(files).map((file): UploadItem => {
        const error = uploadError(file, maxBytes);
        return { id: generateUUID(), file, title: titleFromFile(file.name), progress: 0, status: error ? 'error' : 'ready', message: error || '' };
      });
      setItems((list) => [...list, ...next]);
    },
    [maxBytes]
  );

  const remove = useCallback((id: string) => setItems((list) => list.filter((i) => i.id !== id || i.status === 'uploading')), []);
  const setTitle = useCallback((id: string, title: string) => patch(id, { title }), []);
  const clearDone = useCallback(() => setItems((list) => list.filter((i) => i.status !== 'done')), []);

  /** Sends every ready file (and failed ones that may be retried). Returns how many were stored. */
  const start = useCallback(
    async (meta: Omit<DocumentUploadMeta, 'title'>): Promise<number> => {
      if (!api || running) return 0;
      setRunning(true);
      let stored = 0;
      for (const item of itemsRef.current) {
        const retryable = item.status === 'error' && !uploadError(item.file, maxBytes);
        if (item.status !== 'ready' && !retryable) continue;
        const full: DocumentUploadMeta = { ...meta, title: item.title };
        const { key, inFlight } = commandKeys.acquire('documents.upload', [item.file.name, item.file.size, item.file.lastModified, full]);
        if (inFlight) continue;
        patch(item.id, { status: 'uploading', progress: 0, message: '' });
        try {
          const result = await api.upload(item.file, full, key, (p) => patch(item.id, { progress: Math.round(Math.min(1, Math.max(0, p)) * 100) }));
          commandKeys.settle(key, 'ok');
          dispatch({ type: 'MERGE_SERVER_RECORDS', records: [{ slice: 'documents', upserted: [result.document as unknown as Record<string, unknown>] }] });
          patch(item.id, { status: 'done', progress: 100, message: result.message, duplicate: result.duplicateOf.length > 0 });
          stored += 1;
        } catch (err) {
          commandKeys.settle(key, err instanceof ApiError && err.outcomeUnknown ? 'unknown' : 'rejected');
          patch(item.id, { status: 'error', message: errorText(err, 'بارگذاری انجام نشد.') });
        }
      }
      setRunning(false);
      return stored;
    },
    [api, running, maxBytes, dispatch]
  );

  return {
    available: !!api,
    maxBytes,
    items,
    running,
    pending: items.some((i) => i.status === 'ready' || (i.status === 'error' && !uploadError(i.file, maxBytes))),
    add,
    remove,
    setTitle,
    clearDone,
    start,
  };
}

/** Documents attached to a record (active ones). */
export function useAttachments(entityType: DocumentEntityType, entityId: string): AppDocument[] {
  const { documents } = useAppState();
  return attachmentsOf(documents, entityType, entityId);
}
