/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AssistantAnswer, AssistantApi, AssistantSettings, AssistantSettingsInput, AssistantStatus } from '../assistant';
import { apiClient } from '../client';
import { obj, ShapeError } from './mapping';

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const text = (v: unknown) => (typeof v === 'string' ? v : '');

function parseStatus(raw: unknown): AssistantStatus {
  const o = obj('/assistant/status', raw);
  return {
    enabled: o.enabled === true,
    canManage: o.can_manage === true,
    dailyLimit: num(o.daily_limit),
    usedToday: num(o.used_today),
    remaining: num(o.remaining),
    questionMax: num(o.question_max, 1000),
  };
}

function parseAnswer(raw: unknown): AssistantAnswer {
  const o = obj('/assistant/ask', raw);
  if (typeof o.answer !== 'string') throw new ShapeError('/assistant/ask', 'answer', 'متن نیست');
  return { answer: o.answer, conversationId: text(o.conversation_id), truncated: o.truncated === true, dailyLimit: num(o.daily_limit), remaining: num(o.remaining) };
}

export function parseAssistantSettings(raw: unknown): AssistantSettings {
  const o = obj('/assistant/settings', raw, 'settings');
  const key = obj('/assistant/settings', o.key ?? {}, 'key');
  const source = key.source === 'constant' || key.source === 'settings' || key.source === 'unreadable' ? key.source : 'none';
  return {
    enabled: o.enabled === true,
    provider: o.provider === 'openai' || o.provider === 'compatible' ? o.provider : 'anthropic',
    baseUrl: text(o.base_url),
    model: text(o.model),
    maxTokens: num(o.max_tokens, 4096),
    dailyLimit: num(o.daily_limit, 30),
    logContent: o.log_content === true,
    key: { source, hint: text(key.hint) },
    encryptionReady: o.encryption_ready === true,
    configured: o.configured === true,
  };
}

function settingsBody(input: AssistantSettingsInput) {
  const body: Record<string, unknown> = {
    enabled: input.enabled,
    provider: input.provider,
    base_url: input.baseUrl.trim(),
    model: input.model.trim(),
    max_tokens: input.maxTokens,
    daily_limit: input.dailyLimit,
    log_content: input.logContent,
  };
  if (input.apiKey.trim()) body.api_key = input.apiKey.trim();
  if (input.clearKey) body.clear_key = true;
  return body;
}

export function createAkphAssistantApi(): AssistantApi {
  return {
    async status() {
      return parseStatus(await apiClient.get<unknown>('assistant/status'));
    },
    async ask(question, conversationId) {
      const body: Record<string, unknown> = { question };
      if (conversationId) body.conversation_id = conversationId;
      return parseAnswer(await apiClient.post<unknown>('assistant/ask', body));
    },
    async settings() {
      return parseAssistantSettings(obj('/assistant/settings', await apiClient.get<unknown>('assistant/settings')).settings);
    },
    async saveSettings(input, key) {
      const raw = obj('/assistant/settings', await apiClient.command<unknown>('POST', 'assistant/settings', settingsBody(input), { idempotencyKey: key }));
      const records = obj('/assistant/settings', raw.records ?? {}, 'records');
      const saved = Array.isArray(records.assistant_settings) ? records.assistant_settings[0] : undefined;
      return { message: text(raw.message) || 'ذخیره شد.', settings: parseAssistantSettings(saved) };
    },
    async testConnection() {
      const o = obj('/assistant/test', await apiClient.post<unknown>('assistant/test', {}));
      return { ok: o.ok === true, message: text(o.message) };
    },
  };
}
