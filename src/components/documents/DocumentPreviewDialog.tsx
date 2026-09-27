/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Archive, Download } from 'lucide-react';
import type { AppDocument } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { useDocumentActions } from '../../store/useDocuments';
import { formatText } from '../../utils/formatters';
import { Button } from '../common/Button';
import { DocumentFilePreview } from './DocumentFilePreview';

/** A document: its file (PDF and images inline), download and archive. */
export const DocumentPreviewDialog: React.FC<{ doc: AppDocument; onClose: () => void }> = ({ doc, onClose }) => {
  const actions = useDocumentActions();
  return (
    <Dialog label={`سند ${doc.docNumber}`} onClose={onClose} closeOnBackdrop className="card w-full max-w-3xl p-6 space-y-4 text-right">
      <div>
        <h3 className="text-base font-bold text-ink">{formatText(doc.title)}</h3>
        <p className="text-xs text-ink-subtle">
          {formatText(doc.docNumber)} · {formatText(doc.type)} · {formatText(doc.fileSize)} · {formatText(doc.date)} · {formatText(doc.registeredBy)}
        </p>
      </div>
      <DocumentFilePreview doc={doc} />
      {doc.description && <p className="text-sm text-ink-muted">{formatText(doc.description)}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {doc.file?.canArchive && doc.status !== 'بایگانی‌شده' && (
          <Button
            variant="ghost"
            icon={Archive}
            onClick={async () => {
              await actions.archive(doc);
              onClose();
            }}
          >
            بایگانی
          </Button>
        )}
        <Button variant="secondary" icon={Download} disabled={!actions.hasFile(doc)} onClick={() => actions.download(doc)}>
          دانلود
        </Button>
        <Button variant="primary" onClick={onClose}>
          بستن
        </Button>
      </div>
    </Dialog>
  );
};
