/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppDocument, DocumentLink } from '../types';

/**
 * Document center and attachments (akph/v1 /documents*, docs/API-CONTRACT.md). The browser sends the file and
 * what the user picked; the server checks the content, stores it privately, numbers it and keeps the scope.
 */

export interface DocumentUploadMeta {
  title: string;
  category: AppDocument['type'];
  description: string;
  /** '' = headquarters (not allowed for a project manager). */
  projectId: string;
  counterpartyId: string;
  /** A record to attach it to (optional). */
  link?: DocumentLink;
}

export interface DocumentUploadResult {
  message: string;
  document: AppDocument;
  /** Numbers of earlier documents with the same content on the same record. */
  duplicateOf: string[];
}

export interface DocumentApi {
  /** Demo: kept in this browser tab only. The upload limit comes with the session (documentMaxBytes). */
  readonly demo: boolean;
  upload(file: File, meta: DocumentUploadMeta, key: string, onProgress: (fraction: number) => void): Promise<DocumentUploadResult>;
  /** The file itself (preview: PDF and images inline). */
  fetchFile(doc: AppDocument, inline: boolean): Promise<Blob>;
  link(doc: AppDocument, link: DocumentLink, key: string): Promise<{ message: string; document: AppDocument }>;
  archive(doc: AppDocument, key: string): Promise<{ message: string; document: AppDocument }>;
}
