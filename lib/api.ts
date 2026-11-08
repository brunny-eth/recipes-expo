/**
 * Shared client for the Olea backend (EXPO_PUBLIC_API_URL). Use this instead of
 * raw `fetch` in screens/hooks/components.
 *
 * What it does for you:
 *  - builds the URL from EXPO_PUBLIC_API_URL
 *  - attaches `Authorization: Bearer <supabase access token>` when signed in
 *  - JSON-encodes the body (FormData is passed through untouched)
 *  - times out (default 30s) and composes with your own AbortSignal
 *  - optionally validates the response with a schema (anything with
 *    `parse(input: unknown): T` — a zod schema works as-is)
 *  - throws a typed `ApiError` with a `kind` instead of a bare TypeError
 *
 * Usage:
 *
 *   import { api, isApiError } from '@/lib/api';
 *
 *   // Simple GET
 *   const recipes = await api<Recipe[]>('/api/recipes/explore-random');
 *
 *   // POST with JSON body
 *   await api('/api/mise/recipes', { method: 'POST', body: { recipeId } });
 *
 *   // Long recipe parse: pass a longer timeout and an unmount signal, and
 *   // validate the shape so a missing `id` fails here, not three screens later.
 *   const controller = new AbortController(); // abort in your effect cleanup
 *   const recipe = await api('/api/recipes/parse', {
 *     method: 'POST',
 *     body: { input, inputType: 'url' },
 *     timeoutMs: 120_000,
 *     signal: controller.signal,
 *     schema: { parse: (x) => assertRecipeWithId(x) },
 *   });
 *
 *   // Multipart upload — do NOT set Content-Type, fetch adds the boundary.
 *   const form = new FormData();
 *   form.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
 *   await api('/api/recipes/parse-image', { method: 'POST', body: form, timeoutMs: 120_000 });
 *
 *   // Error handling
 *   try { ... } catch (e) {
 *     if (isApiError(e, 'aborted')) return;            // we cancelled; stay quiet
 *     if (isApiError(e, 'interrupted')) retry();       // app was backgrounded etc.
 *     handleError('Error', e);                         // normalizeAppError understands ApiError
 *   }
 */

import { supabase } from './supabaseClient';
import { getNetworkStatus } from '../utils/networkUtils';
import { ApiError, ApiErrorInit, ApiErrorKind } from './apiError';

export { ApiError, isApiError } from './apiError';
export type { ApiErrorKind, ApiErrorInit } from './apiError';

export const DEFAULT_TIMEOUT_MS = 30_000;

/** Minimal schema contract. zod schemas satisfy it structurally. */
export type ApiSchema<T> = { parse(input: unknown): T };

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiOptions<T = unknown> = {
  method?: HttpMethod;
  /** Plain values are JSON-encoded; FormData is sent as multipart. */
  body?: unknown;
  /** Validates the decoded 2xx body; a throw becomes `invalid_response`. */
  schema?: ApiSchema<T>;
  /** Defaults to DEFAULT_TIMEOUT_MS. Pass 0 / Infinity to disable. */
  timeoutMs?: number;
  /** Caller cancellation (e.g. unmount). Aborting yields kind `aborted`. */
  signal?: AbortSignal;
  /** Attach the Supabase bearer token when a session exists. Default true. */
  auth?: boolean;
  /** Extra headers (override defaults). */
  headers?: Record<string, string>;
};

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  // Must be a literal `process.env.EXPO_PUBLIC_*` reference so Expo inlines it.
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base) return '';
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function getAccessToken(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? undefined;
  } catch {
    return undefined;
  }
}

/** Pull a human-readable message and machine code out of a server error body. */
function extractServerError(body: unknown): { message?: string; code?: string } {
  if (typeof body === 'string') return { message: body || undefined };
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;
  let message: string | undefined;
  let code: string | undefined;
  if (typeof b.error === 'string') message = b.error;
  else if (b.error && typeof b.error === 'object') {
    const inner = b.error as Record<string, unknown>;
    if (typeof inner.message === 'string') message = inner.message;
    if (typeof inner.code === 'string') code = inner.code;
  }
  if (!message && typeof b.message === 'string') message = b.message;
  if (typeof b.code === 'string') code = b.code;
  return { message, code };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

async function isDeviceOffline(): Promise<boolean> {
  try {
    return (await getNetworkStatus()) === false;
  } catch {
    // If NetInfo itself fails, don't claim the user is offline.
    return false;
  }
}

export async function api<T = unknown>(path: string, options: ApiOptions<T> = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    schema,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    auth = true,
    headers: extraHeaders,
  } = options;

  const fail = (kind: ApiErrorKind, message: string, extra: Partial<ApiErrorInit> = {}) =>
    new ApiError({ kind, message, method, path, ...extra });

  const url = buildUrl(path);
  if (!url) throw fail('config', 'Backend URL not configured');

  if (externalSignal?.aborted) throw fail('aborted', 'Request was cancelled');

  const headers: Record<string, string> = { Accept: 'application/json' };
  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (isFormData(body)) {
      requestBody = body;
    } else {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }
  }
  if (auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  Object.assign(headers, extraHeaders);

  // Compose timeout + caller signal into one controller.
  const controller = new AbortController();
  let timedOut = false;
  let externallyAborted = false;
  const onExternalAbort = () => {
    externallyAborted = true;
    controller.abort();
  };
  externalSignal?.addEventListener('abort', onExternalAbort);
  const timer =
    timeoutMs > 0 && Number.isFinite(timeoutMs)
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;

  const abortError = () =>
    externallyAborted
      ? fail('aborted', 'Request was cancelled')
      : fail('timeout', `Request timed out after ${timeoutMs}ms`);

  try {
    let response: Response;
    try {
      response = await fetch(url, { method, headers, body: requestBody, signal: controller.signal });
    } catch (cause) {
      if (timedOut || externallyAborted) throw abortError();
      if (cause instanceof Error && cause.name === 'AbortError') {
        throw fail('aborted', 'Request was cancelled', { cause });
      }
      const offline = await isDeviceOffline();
      throw offline
        ? fail('offline', 'Network request failed: device is offline', { cause })
        : fail('interrupted', 'Connection interrupted before the request completed', { cause });
    }

    let text: string;
    try {
      text = await response.text();
    } catch (cause) {
      if (timedOut || externallyAborted) throw abortError();
      throw fail('interrupted', 'Connection interrupted while reading the response', {
        cause,
        status: response.status,
      });
    }

    let parsed: unknown = undefined;
    let jsonOk = true;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        jsonOk = false;
        parsed = text;
      }
    }

    if (!response.ok) {
      const { message, code } = extractServerError(parsed);
      const status = response.status;
      if (status === 429 || code === 'RATE_LIMITED') {
        throw fail('rate_limited', message || 'Too many requests', {
          status,
          body: parsed,
          code: code ?? 'RATE_LIMITED',
          retryAfterMs: parseRetryAfter(response.headers.get('Retry-After')),
        });
      }
      throw fail('http', message || `Request failed with status ${status}`, { status, body: parsed, code });
    }

    if (!jsonOk) {
      throw fail('invalid_response', 'Server returned a non-JSON response', {
        status: response.status,
        body: parsed,
      });
    }

    if (schema) {
      try {
        return schema.parse(parsed);
      } catch (cause) {
        throw fail('invalid_response', 'Server response failed validation', {
          status: response.status,
          body: parsed,
          cause,
        });
      }
    }
    return parsed as T;
  } finally {
    if (timer) clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
