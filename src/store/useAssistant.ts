/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import type { AssistantProvider, AssistantSettings, AssistantSettingsInput, AssistantStatus } from '../api/assistant';
import { useAppState } from './AppStore';
import { answerManagementQuery } from './assistant';
import { commandKeys } from './commandKeys';
import { useCurrentUser, useSession } from './session';
import { generateUUID } from '../utils/ids';
import { toPersianTime } from '../utils/date';

export interface AssistantMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  dataPoints?: { label: string; value: string }[];
  time: string;
  /** The question could not be answered (limit, service unavailable, ...). */
  error?: boolean;
}

const QUESTION_MAX = 1000;
const message = (sender: AssistantMessage['sender'], text: string, extra: Partial<AssistantMessage> = {}): AssistantMessage => ({
  id: generateUUID(),
  sender,
  text,
  time: toPersianTime(new Date()),
  ...extra,
});

/**
 * The management assistant.
 * - Server (akph): the question goes to /assistant/ask; the server answers from the data this user may see.
 *   When the system administrator has not turned it on, `status.enabled` is false.
 * - Demo data: answers are computed in the browser with fixed rules from the sample data (labelled «نمایشی»).
 */
export function useAssistant() {
  const { assistant: api } = useSession();
  const user = useCurrentUser();
  const state = useAppState();
  const demo = !api;
  const [status, setStatus] = useState<AssistantStatus | null>(
    demo ? { enabled: true, canManage: false, dailyLimit: 0, usedToday: 0, remaining: 0, questionMax: QUESTION_MAX } : null
  );
  const [statusError, setStatusError] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sending, setSending] = useState(false);
  const conversation = useRef<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!api) return;
    setStatusError('');
    try {
      setStatus(await api.status());
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.farsiMessage : 'وضعیت دستیار دریافت نشد.');
    }
  }, [api]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || sending) return;
      if (Array.from(question).length > (status?.questionMax ?? QUESTION_MAX)) {
        setMessages((m) => [...m, message('ai', `پرسش حداکثر ${(status?.questionMax ?? QUESTION_MAX).toLocaleString('fa-IR')} نویسه است.`, { error: true })]);
        return;
      }
      setMessages((m) => [...m, message('user', question)]);
      setSending(true);
      try {
        if (!api) {
          const answer = answerManagementQuery(state, question);
          setMessages((m) => [...m, message('ai', answer.text, { dataPoints: answer.dataPoints })]);
          return;
        }
        const answer = await api.ask(question, conversation.current);
        conversation.current = answer.conversationId || conversation.current;
        setMessages((m) => [...m, message('ai', answer.answer)]);
        setStatus((s) => (s ? { ...s, remaining: answer.remaining, dailyLimit: answer.dailyLimit, usedToday: answer.dailyLimit - answer.remaining } : s));
      } catch (err) {
        const text = err instanceof ApiError ? err.farsiMessage : 'پاسخ دریافت نشد؛ دوباره تلاش کنید.';
        setMessages((m) => [...m, message('ai', text, { error: true })]);
        if (err instanceof ApiError && err.code === 'akph_assistant_disabled') setStatus((s) => (s ? { ...s, enabled: false } : s));
      } finally {
        setSending(false);
      }
    },
    [api, state, status, sending]
  );

  const reset = useCallback(() => {
    conversation.current = null;
    setMessages([]);
  }, []);

  return {
    demo,
    /** Demo: the demo answers stand in for the assistant; the system administrator of the demo is not a server admin. */
    status,
    statusError,
    reloadStatus: loadStatus,
    ready: !!status?.enabled,
    canManage: demo ? false : !!status?.canManage,
    userName: user.name,
    messages,
    sending,
    send,
    reset,
  };
}

/** Settings of the server assistant (system administrator). Unavailable with demo data. */
export function useAssistantSettings(enabled: boolean) {
  const { assistant: api } = useSession();
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);

  const load = useCallback(async () => {
    if (!api || !enabled) return;
    setStatus('loading');
    try {
      setSettings(await api.settings());
      setStatus('ready');
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.farsiMessage : 'تنظیمات دستیار دریافت نشد.');
      setStatus('error');
    }
  }, [api, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (input: AssistantSettingsInput): Promise<{ ok: boolean; message: string; field?: string }> => {
      if (!api) return { ok: false, message: 'در نسخه نمایشی در دسترس نیست.' };
      if (input.provider === 'compatible' && !input.baseUrl.trim()) return { ok: false, message: 'برای سرویس سازگار با OpenAI نشانی پایه لازم است.', field: 'baseUrl' };
      if (input.baseUrl.trim() && !/^https:\/\/[^\s/?#]+/i.test(input.baseUrl.trim())) return { ok: false, message: 'نشانی پایه باید با https:// شروع شود.', field: 'baseUrl' };
      if (!input.model.trim()) return { ok: false, message: 'نام مدل را وارد کنید.', field: 'model' };
      // The key is not part of the fingerprint kept in memory; its presence is.
      const { key, inFlight } = commandKeys.acquire('assistant.settings', [{ ...input, apiKey: input.apiKey ? generateUUID() : '' }]);
      if (inFlight) return { ok: false, message: 'درخواست قبلی هنوز در حال ارسال است.' };
      setBusy('save');
      try {
        const result = await api.saveSettings(input, key);
        commandKeys.settle(key, 'ok');
        setSettings(result.settings);
        return { ok: true, message: result.message };
      } catch (err) {
        commandKeys.settle(key, err instanceof ApiError && err.outcomeUnknown ? 'unknown' : 'rejected');
        const field = err instanceof ApiError ? ({ base_url: 'baseUrl', model: 'model', api_key: 'apiKey', max_tokens: 'maxTokens', daily_limit: 'dailyLimit' } as Record<string, string>)[err.field] : undefined;
        return { ok: false, message: err instanceof ApiError ? err.farsiMessage : 'ذخیره انجام نشد.', field };
      } finally {
        setBusy(null);
      }
    },
    [api]
  );

  const test = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!api) return { ok: false, message: 'در نسخه نمایشی در دسترس نیست.' };
    setBusy('test');
    try {
      return await api.testConnection();
    } catch (err) {
      return { ok: false, message: err instanceof ApiError ? err.farsiMessage : 'آزمون اتصال انجام نشد.' };
    } finally {
      setBusy(null);
    }
  }, [api]);

  return { available: !!api, status, loadError, reload: load, settings, busy, save, test };
}

export const PROVIDER_OPTIONS: { value: AssistantProvider; label: string; hint: string }[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)', hint: 'نشانی پایه را خالی بگذارید (https://api.anthropic.com).' },
  { value: 'openai', label: 'OpenAI', hint: 'نشانی پایه را خالی بگذارید (https://api.openai.com/v1).' },
  { value: 'compatible', label: 'سازگار با OpenAI', hint: 'نشانی سرویس تا /v1 را وارد کنید؛ مسیر /chat/completions خودکار اضافه می‌شود.' },
];
