/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import type { DocumentCategory, DocumentEntityType, Project } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { useAppState } from '../../store/AppStore';
import { useUploadQueue } from '../../store/useDocuments';
import { DOCUMENT_CATEGORIES } from '../../store/documents';
import { formatInt, formatText } from '../../utils/formatters';
import { Button } from '../common/Button';
import { Field } from '../common/Field';
import { UploadDropzone } from './UploadDropzone';

interface Props {
  projects: Project[];
  entityLabels: Partial<Record<DocumentEntityType, string>>;
  entityOptions: (type: DocumentEntityType, projectId?: string) => Array<{ id: string; label: string }>;
  onClose: () => void;
}

/** «بارگذاری سند»: several files, their kind, project, counterparty and the record they belong to. */
export const DocumentUploadDialog: React.FC<Props> = ({ projects, entityLabels, entityOptions, onClose }) => {
  const { counterparties } = useAppState();
  const queue = useUploadQueue();
  const [category, setCategory] = useState<DocumentCategory>('نامه و مکاتبات رسمی');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [linkType, setLinkType] = useState<DocumentEntityType>('contract');
  const [linkId, setLinkId] = useState('');
  const [description, setDescription] = useState('');
  const [summary, setSummary] = useState('');

  const linkTypes = (Object.keys(entityLabels) as DocumentEntityType[]).filter((t) => t !== 'project' && t !== 'counterparty');

  return (
    <Dialog label="بارگذاری سند" onClose={() => !queue.running && onClose()} className="card w-full max-w-2xl p-6 space-y-4 text-right max-h-[92vh] overflow-y-auto">
      <h3 className="text-base font-bold text-ink">بارگذاری سند</h3>
      <UploadDropzone queue={queue} editableTitles disabled={queue.running} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="upl-category" label="نوع سند">
          {(p) => (
            <select {...p} className="input" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="upl-project" label="پروژه">
          {(p) => (
            <select {...p} className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">بدون پروژه (ستادی)</option>
              {projects.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {formatText(pr.name)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="upl-partner" label="طرف حساب (اختیاری)">
          {(p) => (
            <select {...p} className="input" value={counterpartyId} onChange={(e) => setCounterpartyId(e.target.value)}>
              <option value="">—</option>
              {counterparties.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatText(c.name)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field id="upl-link-type" label="نوع رکورد مرتبط">
            {(p) => (
              <select
                {...p}
                className="input"
                value={linkType}
                onChange={(e) => {
                  setLinkType(e.target.value as DocumentEntityType);
                  setLinkId('');
                }}
              >
                {linkTypes.map((t) => (
                  <option key={t} value={t}>
                    {entityLabels[t]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field id="upl-link" label="رکورد مرتبط">
            {(p) => (
              <select {...p} className="input" value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                <option value="">— بدون اتصال —</option>
                {entityOptions(linkType, projectId || undefined).map((o) => (
                  <option key={o.id} value={o.id}>
                    {formatText(o.label)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field id="upl-desc" label="شرح (اختیاری)" className="sm:col-span-2">
          {(p) => <textarea {...p} rows={2} className="input" value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-ink-muted min-h-6">
        {summary}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onClose} disabled={queue.running}>
          بستن
        </Button>
        <Button
          variant="primary"
          icon={Upload}
          loading={queue.running}
          disabled={!queue.pending}
          onClick={async () => {
            const stored = await queue.start({ category, description, projectId, counterpartyId, link: linkId ? { entityType: linkType, entityId: linkId } : undefined });
            setSummary(stored > 0 ? `${formatInt(stored)} سند بارگذاری شد.` : 'سندی بارگذاری نشد؛ پیام کنار هر فایل را ببینید.');
          }}
        >
          شروع بارگذاری
        </Button>
      </div>
    </Dialog>
  );
};
