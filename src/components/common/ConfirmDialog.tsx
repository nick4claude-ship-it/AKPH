/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useRef } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Dialog } from './Dialog';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  showCancel?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  type = 'warning',
  confirmText = 'تأیید',
  cancelText = 'انصراف',
  onConfirm,
  onCancel,
  showCancel = true,
}) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  if (!isOpen) return null;

  return (
    <Dialog
      onClose={onCancel}
      labelledBy={titleId}
      describedBy={descId}
      initialFocusRef={confirmButtonRef}
      overlayClassName="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-right relative overflow-hidden"
    >
      <button
        type="button"
        onClick={onCancel}
        aria-label="بستن پنجره"
        className="absolute top-4 left-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            type === 'danger'
              ? 'bg-red-50 text-red-600 border border-red-200'
              : type === 'warning'
              ? 'bg-amber-50 text-amber-600 border border-amber-200'
              : type === 'success'
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : 'bg-blue-50 text-blue-600 border border-blue-200'
          }`}
        >
          {type === 'danger' ? (
            <AlertCircle className="w-6 h-6" />
          ) : type === 'warning' ? (
            <AlertTriangle className="w-6 h-6" />
          ) : type === 'success' ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <Info className="w-6 h-6" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 id={titleId} className="text-base font-bold text-slate-900 mb-1">
            {title}
          </h3>
          <p id={descId} className="text-xs text-slate-600 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
        {showCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
        )}
        <button
          type="button"
          ref={confirmButtonRef}
          onClick={onConfirm}
          className={`px-4 py-2 text-xs font-bold rounded-lg text-white transition-colors cursor-pointer ${
            type === 'danger'
              ? 'bg-red-600 hover:bg-red-700'
              : type === 'warning'
              ? 'bg-amber-600 hover:bg-amber-700'
              : type === 'success'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </Dialog>
  );
};
