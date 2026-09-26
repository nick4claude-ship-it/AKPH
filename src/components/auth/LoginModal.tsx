/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId } from 'react';
import { X, ShieldCheck, Check } from 'lucide-react';
import { UserProfile } from '../../types';
import { Dialog } from '../../ui/Dialog';
import { formatText } from '../../utils/formatters';

interface LoginModalProps {
  onClose: () => void;
  currentUser: UserProfile;
  users: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
}

/**
 * Role switcher for local development only (rendered only when import.meta.env.DEV and the mock data
 * source provides demo users). In WordPress the signed-in user comes from the paydar-portal session.
 */
export const LoginModal: React.FC<LoginModalProps> = ({ onClose, currentUser, users, onSelectUser }) => {
  const titleId = useId();
  return (
    <Dialog
      onClose={onClose}
      labelledBy={titleId}
      closeOnBackdrop
      className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-right"
    >
      <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 id={titleId} className="text-base font-bold text-white">
              تغییر کاربر (فقط محیط توسعه)
            </h3>
            <p className="text-xs text-slate-500">نقش‌ها مطابق افزونه پرتال: مدیر سیستم، مدیر ارشد، مدیر پروژه، حسابدار</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="بستن" className="p-1 text-slate-500 hover:text-white rounded-lg cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-3">
        <p className="text-sm text-slate-600 mb-2">با تغییر کاربر، داده‌های قابل مشاهده برای همان نقش دوباره بارگذاری می‌شود.</p>
        {users.map((u) => {
          const isSelected = u.id === currentUser.id;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onSelectUser(u);
                onClose();
              }}
              aria-pressed={isSelected}
              className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-right ${
                isSelected ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-300" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{formatText(u.name)}</h4>
                  <p className="text-sm text-amber-700 font-medium">{formatText(u.role)}</p>
                  <p className="text-xs text-slate-500 tabular-nums">{formatText(u.email)}</p>
                </div>
              </div>
              {isSelected && (
                <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
};
