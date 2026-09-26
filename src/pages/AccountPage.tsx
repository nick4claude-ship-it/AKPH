/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, LogOut, Mail, MonitorSmartphone, Save, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';
import { useAccount, type FormOutcome, type ProfileForm } from '../store/useAccount';
import type { Account, AccountPreferences } from '../api/account';
import { toPersianDate, toPersianDateTime } from '../utils/date';
import { formatText } from '../utils/formatters';
import { Dialog } from '../ui/Dialog';
import { AvatarEditor } from '../components/account/AvatarEditor';
import { Button } from '../components/common/Button';
import { Card, CardHeader } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { Field, FormStatus } from '../components/common/Field';
import { PageHeader } from '../components/common/PageHeader';
import { PageSkeleton } from '../components/common/Skeleton';

type AccountState = ReturnType<typeof useAccount>;

/** «حساب کاربری من»: every role sees and changes only its own account. Role and access are not editable here. */
export const AccountPage: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const acc = useAccount();

  if (acc.status === 'loading') return <PageSkeleton />;
  if (acc.status === 'unavailable') return <EmptyState icon={UserRound} title="حساب کاربری در این نسخه در دسترس نیست" />;
  if (acc.status === 'error' || !acc.account) return <ErrorState title="اطلاعات حساب دریافت نشد" description={acc.loadError} onRetry={acc.reload} />;
  const account = acc.account;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserRound}
        title="حساب کاربری من"
        description="نام و اطلاعات تماس، تصویر پروفایل، ترجیحات نمایش، رمز عبور و نشست‌های فعال خود را مدیریت کنید."
        meta={acc.demo ? <span className="px-2 py-1 rounded-full bg-brand-soft text-xs text-warning">نمایشی: تغییرات فقط در همین مرورگر می‌ماند</span> : undefined}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="space-y-6">
          <Card className="p-6">
            <AvatarEditor
              name={account.displayName}
              avatarUrl={account.avatarUrl}
              busy={acc.busy === 'avatar'}
              checkFile={acc.checkAvatarFile}
              onUpload={async (image) => report(onToast, await acc.uploadAvatar(image))}
              onRemove={async () => report(onToast, await acc.removeAvatar())}
            />
          </Card>
          <RoleCard account={account} />
        </div>
        <div className="space-y-6 xl:col-span-2">
          <ProfileCard acc={acc} account={account} onToast={onToast} />
          <PreferencesCard acc={acc} account={account} onToast={onToast} />
          <EmailCard acc={acc} account={account} onToast={onToast} />
          <PasswordCard acc={acc} account={account} onToast={onToast} />
          <SessionsCard acc={acc} onToast={onToast} />
        </div>
      </div>
    </div>
  );
};

export default AccountPage;

/** Successful saves also appear as a toast. */
function report(onToast: (msg: string) => void, outcome: FormOutcome): FormOutcome {
  if (outcome.ok) onToast(outcome.message);
  return outcome;
}

interface SectionProps {
  acc: AccountState;
  account: Account;
  onToast: (msg: string) => void;
}

const RoleCard: React.FC<{ account: Account }> = ({ account }) => (
  <Card className="p-6 space-y-4">
    <CardHeader icon={ShieldCheck} title="نقش و دسترسی" />
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-ink-muted">نقش</dt>
        <dd className="font-medium text-ink">{account.role || 'بدون نقش پرتال'}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-ink-muted">نام کاربری</dt>
        <dd className="font-medium text-ink" dir="ltr">
          {formatText(account.userLogin)}
        </dd>
      </div>
      {account.registeredAt && (
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">عضویت از</dt>
          <dd className="text-ink">{toPersianDate(account.registeredAt)}</dd>
        </div>
      )}
    </dl>
    <p className="text-xs text-ink-subtle">نقش و دسترسی‌ها را فقط مدیر سیستم در وردپرس تغییر می‌دهد و از این صفحه قابل تغییر نیست.</p>
  </Card>
);

const ProfileCard: React.FC<SectionProps> = ({ acc, account, onToast }) => {
  const initial = (a: Account): ProfileForm => ({ displayName: a.displayName, firstName: a.firstName, lastName: a.lastName, mobile: a.mobile });
  const [form, setForm] = useState<ProfileForm>(() => initial(account));
  const [outcome, setOutcome] = useState<FormOutcome | null>(null);
  useEffect(() => setForm(initial(account)), [account]);
  const set = (key: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const errors = outcome?.errors || {};

  return (
    <Card className="p-6">
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setOutcome(report(onToast, await acc.saveProfile(form)));
        }}
      >
        <CardHeader icon={UserRound} title="اطلاعات شخصی" description="نام نمایشی در سربرگ پرتال و در سوابق تغییرات دیده می‌شود." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field id="acc-display-name" label="نام نمایشی" required error={errors.displayName} className="md:col-span-2">
            {(p) => <input {...p} className="input" value={form.displayName} onChange={set('displayName')} maxLength={100} autoComplete="nickname" />}
          </Field>
          <Field id="acc-first-name" label="نام" error={errors.firstName}>
            {(p) => <input {...p} className="input" value={form.firstName} onChange={set('firstName')} maxLength={60} autoComplete="given-name" />}
          </Field>
          <Field id="acc-last-name" label="نام خانوادگی" error={errors.lastName}>
            {(p) => <input {...p} className="input" value={form.lastName} onChange={set('lastName')} maxLength={60} autoComplete="family-name" />}
          </Field>
          <Field id="acc-mobile" label="شماره همراه" hint="مثل ۰۹۱۲۳۴۵۶۷۸۹" error={errors.mobile}>
            {(p) => <input {...p} className="input text-left" dir="ltr" inputMode="tel" value={form.mobile} onChange={set('mobile')} autoComplete="tel" />}
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormStatus outcome={outcome} />
          <Button type="submit" variant="primary" icon={Save} loading={acc.busy === 'profile'}>
            ذخیره اطلاعات
          </Button>
        </div>
      </form>
    </Card>
  );
};

const PreferencesCard: React.FC<SectionProps> = ({ acc, account, onToast }) => {
  const [prefs, setPrefs] = useState<AccountPreferences>(account.preferences);
  const [outcome, setOutcome] = useState<FormOutcome | null>(null);
  useEffect(() => setPrefs(account.preferences), [account]);
  const siteUnit = account.siteCurrency === 'rial' ? 'ریال' : 'تومان';

  return (
    <Card className="p-6">
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setOutcome(report(onToast, await acc.savePreferences(prefs)));
        }}
      >
        <CardHeader icon={SlidersHorizontal} title="ترجیحات نمایش" description="فقط برای حساب شما؛ مبالغ همیشه به ریال ذخیره می‌شوند." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field id="acc-currency" label="واحد نمایش مبالغ">
            {(p) => (
              <select {...p} className="input" value={prefs.currency} onChange={(e) => setPrefs({ ...prefs, currency: e.target.value as AccountPreferences['currency'] })}>
                <option value="site">پیش‌فرض سامانه ({siteUnit})</option>
                <option value="toman">تومان</option>
                <option value="rial">ریال</option>
              </select>
            )}
          </Field>
          <Field id="acc-rows" label="تعداد ردیف هر صفحه جدول">
            {(p) => (
              <select {...p} className="input" value={prefs.rowsPerPage} onChange={(e) => setPrefs({ ...prefs, rowsPerPage: Number(e.target.value) as AccountPreferences['rowsPerPage'] })}>
                <option value={10}>۱۰ ردیف</option>
                <option value={25}>۲۵ ردیف</option>
                <option value={50}>۵۰ ردیف</option>
                <option value={100}>۱۰۰ ردیف</option>
              </select>
            )}
          </Field>
          <Field id="acc-start" label="صفحه شروع پس از ورود">
            {(p) => (
              <select {...p} className="input" value={prefs.startPage} onChange={(e) => setPrefs({ ...prefs, startPage: e.target.value })}>
                {acc.startPages.map((page) => (
                  <option key={page.path} value={page.path}>
                    {page.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormStatus outcome={outcome} />
          <Button type="submit" variant="primary" icon={Save} loading={acc.busy === 'preferences'}>
            ذخیره ترجیحات
          </Button>
        </div>
      </form>
    </Card>
  );
};

/** Password input with a show/hide button. */
const PasswordInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? 'text' : 'password'} className="input pl-12" dir="ltr" />
      <button
        type="button"
        className="absolute inset-y-0 left-0 w-11 flex items-center justify-center text-ink-muted hover:text-ink"
        aria-label={shown ? 'پنهان کردن رمز' : 'نمایش رمز'}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
      </button>
    </div>
  );
};

const EmailCard: React.FC<SectionProps> = ({ acc, account, onToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [outcome, setOutcome] = useState<FormOutcome | null>(null);
  const errors = outcome?.errors || {};

  return (
    <Card className="p-6">
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = report(onToast, await acc.changeEmail(email, password));
          setOutcome(result);
          if (result.ok) {
            setEmail('');
            setPassword('');
          }
        }}
      >
        <CardHeader icon={Mail} title="ایمیل" description={<>ایمیل فعلی: <span dir="ltr">{account.email}</span></>} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field id="acc-email" label="ایمیل جدید" required error={errors.email}>
            {(p) => <input {...p} type="email" className="input text-left" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
          </Field>
          <Field id="acc-email-password" label="رمز عبور فعلی" required error={errors.currentPassword}>
            {(p) => <PasswordInput {...p} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormStatus outcome={outcome} />
          <Button type="submit" variant="primary" icon={Save} loading={acc.busy === 'email'}>
            تغییر ایمیل
          </Button>
        </div>
      </form>
    </Card>
  );
};

const PasswordCard: React.FC<SectionProps> = ({ acc, account, onToast }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [outcome, setOutcome] = useState<FormOutcome | null>(null);
  const errors = outcome?.errors || {};

  return (
    <Card className="p-6">
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = report(onToast, await acc.changePassword(current, next, repeat));
          setOutcome(result);
          if (result.ok) {
            setCurrent('');
            setNext('');
            setRepeat('');
          }
        }}
      >
        <CardHeader icon={KeyRound} title="رمز عبور" description="پس از تغییر رمز، همه نشست‌های دیگر شما بسته می‌شود و این نشست باز می‌ماند." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field id="acc-current-password" label="رمز عبور فعلی" required error={errors.currentPassword}>
            {(p) => <PasswordInput {...p} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}
          </Field>
          <Field id="acc-new-password" label="رمز عبور جدید" required hint={`دست‌کم ${formatText(String(account.passwordMinLength))} نویسه`} error={errors.newPassword}>
            {(p) => <PasswordInput {...p} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />}
          </Field>
          <Field id="acc-repeat-password" label="تکرار رمز جدید" required error={errors.repeat}>
            {(p) => <PasswordInput {...p} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />}
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormStatus outcome={outcome} />
          <Button type="submit" variant="primary" icon={KeyRound} loading={acc.busy === 'password'}>
            تغییر رمز عبور
          </Button>
        </div>
      </form>
    </Card>
  );
};

const SessionsCard: React.FC<{ acc: AccountState; onToast: (msg: string) => void }> = ({ acc, onToast }) => {
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<FormOutcome | null>(null);
  const others = (acc.sessions || []).filter((s) => !s.current).length > 0;

  return (
    <Card className="p-6 space-y-4">
      <CardHeader
        icon={MonitorSmartphone}
        title="نشست‌های فعال"
        description="مرورگرها و دستگاه‌هایی که اکنون با حساب شما وارد پرتال هستند."
        actions={
          <Button variant="secondary" icon={LogOut} disabled={!others} loading={acc.busy === 'sessions'} onClick={() => setConfirming(true)}>
            خروج از نشست‌های دیگر
          </Button>
        }
      />
      {acc.sessionsError ? (
        <ErrorState title="فهرست نشست‌ها دریافت نشد" description={acc.sessionsError} onRetry={acc.reloadSessions} />
      ) : !acc.sessions ? (
        <div className="skeleton h-24" />
      ) : (
        <div className="table-scroll rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-ink-muted bg-surface-muted">
                <th className="px-4 py-2 font-medium">دستگاه</th>
                <th className="px-4 py-2 font-medium">نشانی IP</th>
                <th className="px-4 py-2 font-medium">ورود</th>
                <th className="px-4 py-2 font-medium">پایان اعتبار</th>
              </tr>
            </thead>
            <tbody>
              {acc.sessions.map((s, i) => (
                <tr key={`${s.loginAt}-${i}`} className="border-t border-line">
                  <td className="px-4 py-3 text-ink">
                    {formatText(s.device)}
                    {s.current && <span className="mr-2 px-2 py-1 rounded-full bg-success-soft text-xs text-success">همین دستگاه</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted" dir="ltr">
                    {s.ip ? formatText(s.ip) : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{s.loginAt ? toPersianDateTime(s.loginAt) : '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{s.expiresAt ? toPersianDateTime(s.expiresAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <FormStatus outcome={outcome} />
      {confirming && (
        <Dialog label="خروج از نشست‌های دیگر" onClose={() => setConfirming(false)} className="card w-full max-w-md p-6 space-y-4">
          <h3 className="text-base font-bold text-ink">خروج از نشست‌های دیگر</h3>
          <p className="text-sm text-ink-muted">همه مرورگرها و دستگاه‌های دیگر از حساب شما خارج می‌شوند. این نشست باز می‌ماند.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              انصراف
            </Button>
            <Button
              variant="danger"
              icon={LogOut}
              loading={acc.busy === 'sessions'}
              onClick={async () => {
                const result = report(onToast, await acc.logoutOthers());
                setOutcome(result);
                setConfirming(false);
              }}
            >
              خروج از همه نشست‌های دیگر
            </Button>
          </div>
        </Dialog>
      )}
    </Card>
  );
};
