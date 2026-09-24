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
  can?: (action: string, user: any, context?: any) => boolean;
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
      const farsiMsg = getFarsiErrorMessage(response.status);
      throw new ApiError(response.status, `HTTP error ${response.status}`, farsiMsg);
    }

    return (await response.json()) as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(0, err.message || 'Network error', 'عدم برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی نمایید.');
  }
}

/**
 * Mock API service wrapper providing consistent interface during development.
 */
export const apiClient = {
  get: <T>(endpoint: string, params?: Record<string, any>) =>
    apiRequest<T>(endpoint, { method: 'GET' }, params),
  post: <T>(endpoint: string, data: any) =>
    apiRequest<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: any) =>
    apiRequest<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};
