/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, UserRound } from 'lucide-react';
import { Dialog } from '../../ui/Dialog';
import { useAvatarCrop } from '../../store/useAvatarCrop';
import type { FormOutcome } from '../../store/useAccount';
import { Button } from '../common/Button';
import { FormStatus } from '../common/Field';

interface Props {
  name: string;
  avatarUrl: string | null;
  busy: boolean;
  checkFile: (file: File) => string | null;
  onUpload: (image: { blob: Blob; fileName: string; id: string }) => Promise<FormOutcome>;
  onRemove: () => Promise<FormOutcome>;
}

/** Profile picture: preview, choose a file, crop it to a square in a dialog, upload; or remove it. */
export const AvatarEditor: React.FC<Props> = ({ name, avatarUrl, busy, checkFile, onUpload, onRemove }) => {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [outcome, setOutcome] = useState<FormOutcome | null>(null);
  const crop = useAvatarCrop(file);

  const choose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;
    e.target.value = '';
    if (!picked) return;
    const error = checkFile(picked);
    if (error) return setOutcome({ ok: false, message: error, errors: {} });
    setOutcome(null);
    setFile(picked);
  };

  const save = async () => {
    const image = await crop.exportCrop();
    if (!image) return setOutcome({ ok: false, message: 'آماده‌سازی تصویر انجام نشد؛ تصویر دیگری انتخاب کنید.', errors: {} });
    const result = await onUpload(image);
    setOutcome(result);
    if (result.ok) setFile(null);
  };

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="w-28 h-28 rounded-full bg-canvas border border-line overflow-hidden flex items-center justify-center">
        {avatarUrl ? <img src={avatarUrl} alt={`تصویر پروفایل ${name}`} className="w-full h-full object-cover" /> : <UserRound className="w-12 h-12 text-ink-subtle" aria-hidden />}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <input ref={input} id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choose} />
        <Button variant="secondary" size="sm" icon={Camera} onClick={() => input.current?.click()} disabled={busy}>
          {avatarUrl ? 'تغییر تصویر' : 'انتخاب تصویر'}
        </Button>
        {avatarUrl && (
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            loading={busy && !file}
            onClick={async () => setOutcome(await onRemove())}
          >
            حذف تصویر
          </Button>
        )}
      </div>
      <p className="text-xs text-ink-subtle">JPG، PNG یا WebP تا ۲ مگابایت؛ به‌صورت مربع ذخیره می‌شود.</p>
      <FormStatus outcome={outcome} />

      {file && (
        <Dialog label="برش تصویر پروفایل" onClose={() => setFile(null)} className="card w-full max-w-sm p-4 space-y-4 text-right">
          <h3 className="text-base font-bold text-ink">برش تصویر پروفایل</h3>
          <p className="text-sm text-ink-muted">تصویر را بکشید یا با کلیدهای جهت جابه‌جا کنید؛ با نوار زیر بزرگ‌نمایی کنید.</p>
          <div className="flex justify-center">
            <div
              role="img"
              aria-label="پیش‌نمایش برش؛ کلیدهای جهت برای جابه‌جایی و + یا − برای بزرگ‌نمایی"
              tabIndex={0}
              className="relative overflow-hidden rounded-full bg-canvas border border-line-strong cursor-move"
              style={{ width: crop.viewSize, height: crop.viewSize }}
              {...crop.handlers}
            >
              {crop.url && <img src={crop.url} alt="" draggable={false} style={crop.imageStyle} />}
              {!crop.ready && !crop.loadError && <div className="skeleton absolute inset-0" />}
            </div>
          </div>
          {crop.loadError && <p className="text-sm text-danger">{crop.loadError}</p>}
          <div>
            <label htmlFor={`${inputId}-zoom`} className="block text-sm font-medium text-ink mb-1">
              بزرگ‌نمایی
            </label>
            <input
              id={`${inputId}-zoom`}
              type="range"
              min={crop.minZoom}
              max={crop.maxZoom}
              step={0.05}
              value={crop.zoom}
              onChange={(e) => crop.setZoom(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setFile(null)}>
              انصراف
            </Button>
            <Button variant="primary" icon={ImagePlus} loading={busy} disabled={!crop.ready} onClick={save}>
              ذخیره تصویر
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
};
