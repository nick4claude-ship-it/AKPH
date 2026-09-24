/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Paydar Management Portal REST API client for WordPress integration.
 * Connects to namespace paydar/v1.
 * Handles simple permalinks where restUrl contains '?rest_route='.
 */

export interface PaydarPortalConfig {
  restUrl?: string;
  nonce?: string;
  userId?: string | number;
  displayName?: string;
  role?: string;
  /** Optional runtime permission hook; it can never allow approving one's own document. */
  can?: (action: string, user: unknown, context?: unknown) => boolean;
  accounting?: {
    currency?: 'toman' | 'rial';
    fiscalYear?: number;
  };
  petty?: {
    approvalLimitLevel1?: number;
    approvalLimitLevel2?: number;
  };
}

declare global {
  interface Window {
    PaydarPortal?: PaydarPortalConfig;
  }
}

export class ApiError extends Error {
  status: number;
  farsiMessage: string;

  constructor(status: number, message: string, farsiMessage: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.farsiMessage = farsiMessage;
  }
}

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
  const config = window.PaydarPortal || {};
  const baseUrl = config.restUrl || '/wp-json/paydar/v1';

  // Normalize endpoint to remove leading slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  let url: string;
  if (baseUrl.includes('rest_route=')) {
    // Simple permalink mode: e.g. "https://example.com/?rest_route=/paydar/v1"
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
  const config = window.PaydarPortal || {};
  const url = buildApiUrl(endpoint, queryParams);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (config.nonce) {
    headers['X-WP-Nonce'] = config.nonce;
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
      try {
        const body = (await response.json()) as { message?: unknown };
        if (typeof body?.message === 'string') serverMessage = body.message;
      } catch {
        /* not JSON */
      }
      const farsiMsg = /[\u0600-\u06FF]/.test(serverMessage) ? serverMessage : getFarsiErrorMessage(response.status);
      throw new ApiError(response.status, serverMessage || `HTTP error ${response.status}`, farsiMsg);
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
  /** Same key for every retry of one user action; the server answers a repeated key with the first result. */
  idempotencyKey: string;
  /** Version of the record the command acts on (optimistic concurrency, answered with 409 when stale). */
  version?: number;
}

/**
 * Sends a command. A network failure (no response) is retried once with the same Idempotency-Key,
 * so a command is never applied twice.
 */
export async function sendCommand<T>(method: 'POST' | 'PUT' | 'DELETE', endpoint: string, body: unknown, options: CommandOptions): Promise<T> {
  const headers: Record<string, string> = { 'Idempotency-Key': options.idempotencyKey };
  if (options.version !== undefined) headers['If-Match'] = `"${options.version}"`;
  const init: RequestInit = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
  try {
    return await apiRequest<T>(endpoint, init);
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) return apiRequest<T>(endpoint, init);
    throw err;
  }
}

/**
 * JSON REST helpers used by the WordPress data source (src/api/wordpress).
 */
export const apiClient = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean>) =>
    apiRequest<T>(endpoint, { method: 'GET' }, params),
  command: sendCommand,
};
