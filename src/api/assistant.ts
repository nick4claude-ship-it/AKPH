/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * «دستیار مدیریت» of the akph/v1 server (/assistant/*, docs/API-CONTRACT.md). The browser sends only the
 * question; the server builds the data summary within the user's own access and calls the language model.
 * The API key never reaches the browser: settings describe it only by its source and last four characters.
 */

export interface AssistantStatus {
  /** On and fully configured by the system administrator. */
  enabled: boolean;
  /** The system administrator (akph_ai_manage) sees the settings link. */
  canManage: boolean;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  questionMax: number;
}

export interface AssistantAnswer {
  answer: string;
  conversationId: string;
  truncated: boolean;
  dailyLimit: number;
  remaining: number;
}

export type AssistantProvider = 'anthropic' | 'openai' | 'compatible';

export interface AssistantSettings {
  enabled: boolean;
  provider: AssistantProvider;
  baseUrl: string;
  model: string;
  maxTokens: number;
  dailyLimit: number;
  logContent: boolean;
  key: { source: 'constant' | 'settings' | 'unreadable' | 'none'; hint: string };
  encryptionReady: boolean;
  configured: boolean;
}

export interface AssistantSettingsInput {
  enabled: boolean;
  provider: AssistantProvider;
  baseUrl: string;
  model: string;
  maxTokens: number;
  dailyLimit: number;
  logContent: boolean;
  /** A new key; '' keeps the stored one. */
  apiKey: string;
  clearKey: boolean;
}

export interface AssistantApi {
  status(): Promise<AssistantStatus>;
  ask(question: string, conversationId: string | null): Promise<AssistantAnswer>;
  settings(): Promise<AssistantSettings>;
  saveSettings(input: AssistantSettingsInput, key: string): Promise<{ message: string; settings: AssistantSettings }>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}
