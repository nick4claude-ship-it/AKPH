/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * REST client of the akph/v1 server (wordpress-plugin/akph-portal). Handles plain permalinks, where
 * restUrl is "https://site/?rest_route=/akph/v1" and query parameters are joined with "&".
 */

/** What the app page of the plugin (/?akph_portal=1) defines as window.AkphPortal. */
export interface AkphPortalConfig {
  /** 'live': data from akph/v1; 'demo': empty in-browser sandbox (system administrator only). */
  mode?: 'live' | 'demo';
  restUrl?: string;
  nonce?: string;
  userId?: string | number;
  displayName?: string;
  /** WordPress site title (get_bloginfo('name')); shown as the company name. */
  siteName?: string;
  logoutUrl?: string;
  /** Optional runtime permission hook; it can only restrict, never allow approving one's own document. */
  can?: (action: string, user: unknown, context?: unknown) => boolean;
}

declare global {
  interface Window {
    AkphPortal?: AkphPortalConfig;
  }
}

export class ApiError extends Error {
  status: number;
  farsiMessage: string;
  /** WordPress REST error code (e.g. akph_retry, akph_conflict); '' when the server sent none. */
  code: string;
  /** Input field the server named in data.field (inline form errors); '' when none. */
  field: string;

  constructor(status: number, message: string, farsiMessage: string, code = '', field = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.farsiMessage = farsiMessage;
    this.code = code;
    this.field = field;
  }

  /** No answer reached the browser: the command may or may not have run on the server. */
  get outcomeUnknown(): boolean {
    return this.status === 0;
  }
}

/** 409 akph_retry: a deadlock or lock wait timeout on the server; nothing was saved and the same command may run again. */
export const isRetryableConflict = (err: unknown): boolean => err instanceof ApiError && err.status === 409 && err.code === 'akph_retry';

function getFarsiErrorMessage(status: number): string {
  switch (status) {
    case 401:
      return 'نشست کاربری منقضی شده است. لطفاً مجدداً وارد سامانه شوید.';
    case 403:
      return 'شما دسترسی لازم برای انجام این عملیات را ندارید.';
    case 404:
      return 'رکورد یا سرویس مورد نظر در سیستم یافت نشد.';
    case 409:
      return 'تداخل در ثبت اطلاعات. این رکورد قبلاً تغییر کرده یا تکراری است.';
    case 500:
    case 502:
    case 503:
      return 'خطای سرور در پردازش درخواست مالی. لطفاً مجدداً تلاش نمایید.';
    default:
      return `خطا در ارتباط با سرور سامانه (کد ${status}).`;
  }
}

/**
 * Build URL taking into account plain permalinks with '?rest_route='
 */
export function buildApiUrl(endpoint: string, queryParams?: Record<string, string | number | boolean>): string {
  const config = window.AkphPortal || {};
  const baseUrl = config.restUrl || '/wp-json/akph/v1';

  // Normalize endpoint to remove leading slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  let url: string;
  if (baseUrl.includes('rest_route=')) {
    // Simple permalink mode: e.g. "https://example.com/?rest_route=/akph/v1"
    const separator = baseUrl.endsWith('/') ? '' : '/';
    url = `${baseUrl}${separator}${cleanEndpoint}`;
  } else {
    // Pretty permalinks mode
    const separator = baseUrl.endsWith('/') ? '' : '/';
    url = `${baseUrl}${separator}${cleanEndpoint}`;
  }

  if (queryParams && Object.keys(queryParams).length > 0) {
    const qs = Object.entries(queryParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const joinChar = url.includes('?') ? '&' : '?';
    url = `${url}${joinChar}${qs}`;
  }

  return url;
}

/**
 * Standard fetch with WP nonce and credentials
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  queryParams?: Record<string, string | number | boolean>
): Promise<T> {
  const config = window.AkphPortal || {};
  const url = buildApiUrl(endpoint, queryParams);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (config.nonce) {
    headers['X-WP-Nonce'] = config.nonce;
  }
  // A file upload: the browser sets multipart/form-data with its boundary.
  if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'same-origin',
    });

    if (!response.ok) {
      // WordPress REST errors carry { code, message }; a Persian message from the server wins.
      let serverMessage = '';
      let code = '';
      let field = '';
      try {
        const body = (await response.json()) as { message?: unknown; code?: unknown; data?: { field?: unknown } };
        if (typeof body?.message === 'string') serverMessage = body.message;
        if (typeof body?.code === 'string') code = body.code;
        if (typeof body?.data?.field === 'string') field = body.data.field;
      } catch {
        /* not JSON */
      }
      const farsiMsg = /[\u0600-\u06FF]/.test(serverMessage) ? serverMessage : getFarsiErrorMessage(response.status);
      throw new ApiError(response.status, serverMessage || `HTTP error ${response.status}`, farsiMsg, code, field);
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Network error';
    throw new ApiError(0, message, 'عدم برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی نمایید.');
  }
}

/** Options of a state-changing command (docs/API-CONTRACT.md). */
export interface CommandOptions {
  /**
   * One key per form submission (src/store/commandKeys.ts), the same for every retry of it; the server
   * answers a repeated key with the first result.
   */
  idempotencyKey: string;
  /** Version of the record the command acts on (optimistic concurrency, answered with 409 when stale). */
  version?: number;
  /** Pause before sending again after 409 akph_retry (ms). */
  retryDelayMs?: number;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a command. Sent again once, with the same Idempotency-Key, when no response arrived (network
 * failure: the server replays the result if the first attempt did run) or when the server answered 409
 * akph_retry (deadlock or lock wait timeout: nothing was saved). A command is never applied twice.
 */
export async function sendCommand<T>(method: 'POST' | 'PUT' | 'DELETE', endpoint: string, body: unknown, options: CommandOptions): Promise<T> {
  const headers: Record<string, string> = { 'Idempotency-Key': options.idempotencyKey };
  if (options.version !== undefined) headers['If-Match'] = `"${options.version}"`;
  const payload = body === undefined ? undefined : typeof FormData !== 'undefined' && body instanceof FormData ? body : JSON.stringify(body);
  const init: RequestInit = { method, headers, body: payload };
  try {
    return await apiRequest<T>(endpoint, init);
  } catch (err) {
    if (err instanceof ApiError && err.outcomeUnknown) return apiRequest<T>(endpoint, init);
    if (isRetryableConflict(err)) {
      await pause(options.retryDelayMs ?? 400 + Math.floor(Math.random() * 400));
      return apiRequest<T>(endpoint, init);
    }
    throw err;
  }
}

/** JSON REST helpers used by the akph data source (src/api/akph). */
export const apiClient = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean>) =>
    apiRequest<T>(endpoint, { method: 'GET' }, params),
  /** A POST that is not a stored command (e.g. a question to the assistant): sent once, never repeated. */
  post: <T>(endpoint: string, body: unknown) => apiRequest<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  command: sendCommand,
};
