/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { AppDocument } from '../../types';
import { useDocumentPreview } from '../../store/useDocuments';

/** The file itself for PDF and images (fetched through the server with the user's access). */
export const DocumentFilePreview: React.FC<{ doc: AppDocument }> = ({ doc }) => {
  const preview = useDocumentPreview(doc);
  if (!preview.previewable) return null;
  if (preview.loading) return <div className="skeleton h-64" aria-label="در حال بارگذاری پیش‌نمایش" />;
  if (preview.error) return <p className="text-sm text-danger">{preview.error}</p>;
  if (!preview.url) return null;
  return preview.kind === 'pdf' ? (
    <iframe src={preview.url} title={`پیش‌نمایش ${doc.title}`} className="w-full h-[60vh] rounded-lg border border-line bg-surface" />
  ) : (
    <img src={preview.url} alt={`پیش‌نمایش ${doc.title}`} className="max-h-[60vh] w-auto mx-auto rounded-lg border border-line" />
  );
};
