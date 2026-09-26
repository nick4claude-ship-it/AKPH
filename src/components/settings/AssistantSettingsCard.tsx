/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { PlugZap, Save, Sparkles } from 'lucide-react';
import { PROVIDER_OPTIONS, useAssistant, useAssistantSettings } from '../../store/useAssistant';
import type { AssistantSettings, AssistantSettingsInput } from '../../api/assistant';
import { IntegerInput } from '../../ui/NumberInput';
import { Button } from '../common/Button';
import { Card, CardHeader } from '../common/Card';
import { ErrorState } from '../common/ErrorState';
import { Field, FormStatus } from '../common/Field';

const toInput = (s: AssistantSettings): AssistantSettingsInput => ({
  enabled: s.enabled,
  provider: s.provider,
  baseUrl: s.baseUrl,
  model: s.model,
  maxTokens: s.maxTokens,
  dailyLimit: s.dailyLimit,
  logContent: s.logContent,
  apiKey: '',
  clearKey: false,
});

const KEY_SOURCE: Record<AssistantSettings['key']['source'], string> = {
  constant: 'از ثابت AKPH_AI_API_KEY در wp-config.php',
  settings: 'ذخیره‌شده (رمزنگاری‌شده)',
  unreadable: 'ذخیره‌شده ولی خوانده نمی‌شود؛ دوباره وارد کنید',
  none: 'وارد نشده',
};

/** «دستیار هوشمند» settings: system administrator only. The key is never shown, only its last four characters. */
export const AssistantSettingsCard: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const assistant = useAssistant();
  const settings = useAssistantSettings(assistant.canManage);
  const [form, setForm] = useState<AssistantSettingsInput | null>(null);
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string; field?: string } | null>(null);

  useEffect(() => {
    if (settings.settings) setForm(toInput(settings.settings));
  }, [settings.settings]);

  if (assistant.demo) {
    return (
      <Card className="p-4 sm:p-6 space-y-2" id="assistant-settings">
        <CardHeader icon={Sparkles} title="دستیار هوشمند" description="نمایشی: در این نسخه دستیار به سرویس هوش مصنوعی وصل نمی‌شود و پاسخ‌ها با قواعد ثابت از داده‌های نمونه ساخته می‌شوند." />
        <p className="text-sm text-ink-muted">در نسخه نصب‌شده روی وردپرس، مدیر سیستم سرویس‌دهنده، مدل، کلید API و سقف روزانه را همین‌جا تنظیم می‌کند.</p>
      </Card>
    );
  }
  if (!assistant.canManage) return null;
  if (settings.status === 'error') return <ErrorState title="تنظیمات دستیار دریافت نشد" description={settings.loadError} onRetry={settings.reload} />;
  if (!form || !settings.settings) return <div className="card p-6"><div className="skeleton h-32" /></div>;

  const s = settings.settings;
  const set = <K extends keyof AssistantSettingsInput>(key: K, value: AssistantSettingsInput[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const error = (field: string) => (outcome && !outcome.ok && outcome.field === field ? outcome.message : undefined);
  const provider = PROVIDER_OPTIONS.find((p) => p.value === form.provider);

  return (
    <Card className="p-4 sm:p-6" id="assistant-settings">
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await settings.save(form);
          setOutcome(result);
          if (result.ok) onToast(result.message);
        }}
      >
        <CardHeader
          icon={Sparkles}
          title="دستیار هوشمند"
          description="پاسخ‌ها را سرور از مدل زبانی می‌گیرد؛ کلید API هرگز به مرورگر فرستاده نمی‌شود و دستیار فقط داده‌های مجاز همان کاربر را می‌بیند."
        />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} className="w-4 h-4 accent-amber-600" />
          دستیار فعال باشد
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field id="ai-provider" label="سرویس‌دهنده" hint={provider?.hint}>
            {(p) => (
              <select {...p} className="input" value={form.provider} onChange={(e) => set('provider', e.target.value as AssistantSettingsInput['provider'])}>
                {PROVIDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field id="ai-base-url" label="نشانی پایه (Base URL)" error={error('baseUrl')} hint={form.provider === 'compatible' ? 'الزامی؛ مثل https://example.com/v1' : 'اختیاری'}>
            {(p) => <input {...p} className="input text-left" dir="ltr" value={form.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} placeholder="https://" />}
          </Field>
          <Field id="ai-model" label="مدل" required error={error('model')}>
            {(p) => <input {...p} className="input text-left" dir="ltr" value={form.model} onChange={(e) => set('model', e.target.value)} />}
          </Field>
          <Field
            id="ai-key"
            label="کلید API"
            error={error('apiKey')}
            hint={
              s.key.source === 'constant'
                ? `${KEY_SOURCE.constant}: ${s.key.hint}`
                : s.key.source === 'settings'
                  ? `${KEY_SOURCE.settings}: ${s.key.hint} — برای نگه‌داشتن، خالی بگذارید.`
                  : KEY_SOURCE[s.key.source]
            }
          >
            {(p) => (
              <input
                {...p}
                type="password"
                className="input text-left"
                dir="ltr"
                autoComplete="new-password"
                value={form.apiKey}
                disabled={s.key.source === 'constant'}
                onChange={(e) => set('apiKey', e.target.value)}
                placeholder={s.key.hint || ''}
              />
            )}
          </Field>
          <Field id="ai-max-tokens" label="حداکثر توکن پاسخ" error={error('maxTokens')}>
            {(p) => <IntegerInput {...p} max={32000} className="input" value={form.maxTokens} onValueChange={(v) => set('maxTokens', v)} />}
          </Field>
          <Field id="ai-daily-limit" label="سقف روزانه درخواست هر کاربر" error={error('dailyLimit')}>
            {(p) => <IntegerInput {...p} max={1000} className="input" value={form.dailyLimit} onValueChange={(v) => set('dailyLimit', v)} />}
          </Field>
        </div>
        {!s.encryptionReady && s.key.source !== 'constant' && (
          <p className="text-sm text-danger">کلیدهای امنیتی وردپرس (AUTH_KEY و SECURE_AUTH_SALT) تنظیم نشده‌اند؛ برای ذخیره کلید آن‌ها را تنظیم کنید یا کلید را در ثابت AKPH_AI_API_KEY قرار دهید.</p>
        )}
        <div className="flex flex-wrap gap-4 text-sm text-ink">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.logContent} onChange={(e) => set('logContent', e.target.checked)} className="w-4 h-4 accent-amber-600" />
            متن کامل پرسش و پاسخ هم ثبت شود
          </label>
          {s.key.source === 'settings' && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.clearKey} onChange={(e) => set('clearKey', e.target.checked)} className="w-4 h-4 accent-amber-600" />
              حذف کلید ذخیره‌شده
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormStatus outcome={outcome} />
          <div className="flex flex-wrap gap-2">
            <Button
              icon={PlugZap}
              loading={settings.busy === 'test'}
              disabled={!s.configured}
              onClick={async () => setOutcome(await settings.test())}
            >
              آزمون اتصال
            </Button>
            <Button type="submit" variant="primary" icon={Save} loading={settings.busy === 'save'}>
              ذخیره تنظیمات دستیار
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
};
