/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Download, Eye, Paperclip } from 'lucide-react';
import type { AppDocument, DocumentEntityType } from '../../types';
import { useAttachments, useDocumentActions, useUploadQueue } from '../../store/useDocuments';
import { defaultCategoryFor } from '../../store/documents';
import { formatInt, formatText } from '../../utils/formatters';
import { UploadDropzone } from './UploadDropzone';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';

/**
 * «پیوست‌ها» of a record: its documents in the document center and a drop area that uploads new files linked
 * to it. Works in every mode: attachments go to the document center even where the record itself is read-only.
 */
export const AttachmentsPanel: React.FC<{ entityType: DocumentEntityType; entityId: string; projectId?: string; counterpartyId?: string }> = ({
  entityType,
  entityId,
  projectId = '',
  counterpartyId = '',
}) => {
  const attachments = useAttachments(entityType, entityId);
  const actions = useDocumentActions();
  const queue = useUploadQueue();
  const [preview, setPreview] = useState<AppDocument | null>(null);

  // Files start uploading as soon as they are chosen or dropped.
  useEffect(() => {
    if (queue.pending && !queue.running) {
      queue.start({ category: defaultCategoryFor(entityType), description: '', projectId, counterpartyId, link: { entityType, entityId } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.items.length]);

  if (!queue.available) return null;

  return (
    <section aria-label="پیوست‌ها" className="rounded-lg border border-line p-3 space-y-3 text-right">
      <h4 className="text-sm font-bold text-ink flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-ink-subtle" aria-hidden />
        پیوست‌ها
        <span className="text-xs font-normal text-ink-subtle">({formatInt(attachments.length)})</span>
      </h4>
      {attachments.length === 0 ? (
        <p className="text-xs text-ink-subtle">هنوز پیوستی برای این رکورد ثبت نشده است.</p>
      ) : (
        <ul className="divide-y divide-line">
          {attachments.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="flex-1 min-w-0">
                <span className="block truncate text-ink">{formatText(doc.title)}</span>
                <span className="block text-xs text-ink-subtle">
                  {formatText(doc.docNumber)} · {formatText(doc.fileSize)} · {formatText(doc.date)}
                </span>
              </span>
              <button type="button" onClick={() => setPreview(doc)} aria-label={`مشاهده ${doc.title}`} className="btn btn-ghost btn-sm btn-icon">
                <Eye className="w-4 h-4" aria-hidden />
              </button>
              <button type="button" onClick={() => actions.download(doc)} disabled={!actions.hasFile(doc)} aria-label={`دانلود ${doc.title}`} className="btn btn-ghost btn-sm btn-icon">
                <Download className="w-4 h-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <UploadDropzone queue={queue} compact />
      {preview && <DocumentPreviewDialog doc={preview} onClose={() => setPreview(null)} />}
    </section>
  );
};
