/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useRef, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, TriangleAlert, X } from 'lucide-react';
import type { useUploadQueue } from '../../store/useDocuments';
import { ACCEPT_ATTRIBUTE } from '../../store/documents';
import { formatFileSize, formatInt, formatText } from '../../utils/formatters';

type Queue = ReturnType<typeof useUploadQueue>;

/** Drop area and file picker (several files at once) with each file's progress. */
export const UploadDropzone: React.FC<{ queue: Queue; compact?: boolean; editableTitles?: boolean; disabled?: boolean }> = ({ queue, compact = false, editableTitles = false, disabled = false }) => {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const limit = formatFileSize(queue.maxBytes);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled && e.dataTransfer.files.length) queue.add(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed text-center ${compact ? 'p-3' : 'p-6'} ${over ? 'border-brand-strong bg-brand-soft' : 'border-line-strong bg-surface-muted'} ${disabled ? 'opacity-60' : ''}`}
      >
        <input
          ref={input}
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) queue.add(e.target.files);
            e.target.value = '';
          }}
        />
        <FileUp className={`mx-auto text-ink-subtle ${compact ? 'w-5 h-5' : 'w-8 h-8'}`} aria-hidden />
        <p className="text-sm text-ink mt-1">
          فایل‌ها را اینجا رها کنید یا{' '}
          <button type="button" className="font-medium text-brand-strong underline" onClick={() => input.current?.click()} disabled={disabled}>
            انتخاب فایل
          </button>
        </p>
        {!compact && <p className="text-xs text-ink-subtle mt-1">PDF، تصویر، Excel، Word، CSV، TXT، ZIP، DWG یا DXF؛ هر فایل تا {limit}</p>}
      </div>

      {queue.items.length > 0 && (
        <ul className="space-y-2" aria-label="فایل‌های انتخاب‌شده">
          {queue.items.map((item) => (
            <li key={item.id} className="rounded-lg border border-line p-2 text-sm">
              <div className="flex items-center gap-2">
                {item.status === 'done' ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" aria-hidden />
                ) : item.status === 'error' ? (
                  <TriangleAlert className="w-4 h-4 text-danger shrink-0" aria-hidden />
                ) : item.status === 'uploading' ? (
                  <Loader2 className="w-4 h-4 text-brand-strong animate-spin shrink-0" aria-hidden />
                ) : (
                  <FileUp className="w-4 h-4 text-ink-subtle shrink-0" aria-hidden />
                )}
                <span className="flex-1 min-w-0 truncate text-ink" dir="auto">
                  {formatText(item.file.name)}
                </span>
                <span className="text-xs text-ink-subtle shrink-0">{formatFileSize(item.file.size)}</span>
                {item.status !== 'uploading' && item.status !== 'done' && (
                  <button type="button" onClick={() => queue.remove(item.id)} aria-label={`حذف ${item.file.name} از فهرست`} className="p-1 rounded text-ink-subtle hover:text-ink">
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                )}
              </div>
              {editableTitles && item.status === 'ready' && (
                <div className="mt-2">
                  <label htmlFor={`${item.id}-title`} className="block text-xs text-ink-muted mb-1">
                    عنوان سند
                  </label>
                  <input id={`${item.id}-title`} className="input" value={item.title} maxLength={190} onChange={(e) => queue.setTitle(item.id, e.target.value)} />
                </div>
              )}
              {(item.status === 'uploading' || item.status === 'done') && (
                <div
                  role="progressbar"
                  aria-label={`پیشرفت بارگذاری ${item.file.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                  className="mt-2 h-2 rounded-full bg-canvas overflow-hidden"
                >
                  <div className={`h-full ${item.status === 'done' ? 'bg-success' : 'bg-brand'}`} style={{ width: `${item.progress}%` }} />
                </div>
              )}
              {item.message && <p className={`mt-1 text-xs ${item.status === 'error' ? 'text-danger' : item.duplicate ? 'text-warning' : 'text-success'}`}>{formatText(item.message)}</p>}
              {item.status === 'uploading' && <p className="mt-1 text-xs text-ink-subtle">{formatInt(item.progress)}٪</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
