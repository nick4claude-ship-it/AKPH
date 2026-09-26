/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { generateUUID } from '../utils/ids';

/** Side of the square crop window on screen (px). */
export const CROP_VIEW = 240;
/** Side of the image sent to the server (it stores 256×256). */
const OUTPUT = 512;
const MAX_ZOOM = 3;
const STEP = 8;

interface Offset {
  x: number;
  y: number;
}

/**
 * Square crop of a chosen image before upload: the image covers the crop window; the user drags it (or uses
 * the arrow keys) and zooms. `exportCrop` draws the visible square into a 512×512 image (PNG stays PNG,
 * everything else becomes JPEG).
 */
export function useAvatarCrop(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoomState] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState('');
  const image = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setSize(null);
    setZoomState(1);
    setOffset({ x: 0, y: 0 });
    setLoadError('');
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    const img = new Image();
    img.onload = () => {
      image.current = img;
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => setLoadError('این فایل تصویر قابل نمایش نیست.');
    img.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const scale = size ? (CROP_VIEW / Math.min(size.w, size.h)) * zoom : 1;
  const shown = size ? { w: size.w * scale, h: size.h * scale } : { w: CROP_VIEW, h: CROP_VIEW };

  /** Keeps the crop window covered by the image. */
  const clamp = useCallback(
    (o: Offset, w = shown.w, h = shown.h): Offset => {
      const mx = Math.max(0, (w - CROP_VIEW) / 2);
      const my = Math.max(0, (h - CROP_VIEW) / 2);
      return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
    },
    [shown.w, shown.h]
  );

  const setZoom = useCallback(
    (value: number) => {
      const z = Math.min(MAX_ZOOM, Math.max(1, value));
      setZoomState(z);
      if (size) {
        const s = (CROP_VIEW / Math.min(size.w, size.h)) * z;
        setOffset((o) => clamp(o, size.w * s, size.h * s));
      }
    },
    [size, clamp]
  );

  const imageStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: `${shown.w}px`,
    height: `${shown.h}px`,
    maxWidth: 'none',
    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
    touchAction: 'none',
    userSelect: 'none',
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      drag.current = { id: d.id, x: e.clientX, y: e.clientY };
      setOffset((o) => clamp({ x: o.x + dx, y: o.y + dy }));
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onPointerCancel: () => {
      drag.current = null;
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      const move: Record<string, Offset> = { ArrowLeft: { x: -STEP, y: 0 }, ArrowRight: { x: STEP, y: 0 }, ArrowUp: { x: 0, y: -STEP }, ArrowDown: { x: 0, y: STEP } };
      if (move[e.key]) {
        e.preventDefault();
        setOffset((o) => clamp({ x: o.x + move[e.key].x, y: o.y + move[e.key].y }));
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom(zoom + 0.1);
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom(zoom - 0.1);
      }
    },
  };

  /** The visible square as an image file for upload. */
  const exportCrop = useCallback(async (): Promise<{ blob: Blob; fileName: string; id: string } | null> => {
    const img = image.current;
    if (!img || !size || !file) return null;
    const left = CROP_VIEW / 2 - shown.w / 2 + offset.x;
    const top = CROP_VIEW / 2 - shown.h / 2 + offset.y;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const png = file.type === 'image/png';
    if (!png) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -left / scale, -top / scale, CROP_VIEW / scale, CROP_VIEW / scale, 0, 0, OUTPUT, OUTPUT);
    const type = png ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    return blob ? { blob, fileName: png ? 'avatar.png' : 'avatar.jpg', id: generateUUID() } : null;
  }, [file, size, shown.w, shown.h, offset.x, offset.y, scale]);

  return {
    url,
    ready: !!size,
    loadError,
    zoom,
    minZoom: 1,
    maxZoom: MAX_ZOOM,
    setZoom,
    viewSize: CROP_VIEW,
    imageStyle,
    handlers,
    exportCrop,
  };
}
