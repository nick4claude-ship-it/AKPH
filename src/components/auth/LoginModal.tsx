import React from 'react';
import { UserProfile } from '../../types';
import { alternativeUsers } from '../../data/mockData';
import { X, ShieldCheck, UserCheck, Check } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-right">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">تغییر کاربر و نقش دسترسی</h3>
              <p className="text-[11px] text-slate-400">شبیه‌سازی سطوح دسترسی مدیرعامل، مالی و پروژه</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User list */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600 mb-2">
            جهت تست جریان کارتابل و اختیارات تأییدیه، نقش کاربری مورد نظر را انتخاب نمایید:
          </p>

          {alternativeUsers.map((u) => {
            const isSelected = u.id === currentUser.id;

            return (
              <button
                key={u.id}
                onClick={() => {
                  onSelectUser(u);
                  onClose();
                }}
                className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-right ${
                  isSelected
                    ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/20'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-300"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{u.name}</h4>
                    <p className="text-[11px] text-amber-700 font-medium">{u.role}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{u.email}</p>
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

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
          <span className="text-[11px] text-slate-500">
            سیستم احراز هویت یکپارچه سازمانی (SSO / IAM Enterprise)
          </span>
        </div>
      </div>
    </div>
  );
};
