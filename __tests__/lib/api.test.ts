import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getSession = vi.fn();
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { auth: { getSession: (...args: unknown[]) => getSession(...args) } },
}));

const getNetworkStatus = vi.fn();
vi.mock('../../utils/networkUtils', () => ({
  getNetworkStatus: (...args: unknown[]) => getNetworkStatus(...args),
  isOfflineError: (error: Error | string) => {
    const m = typeof error === 'string' ? error : error.message;
    return m.includes('Network request failed') || m.includes('Failed to fetch');
  },
}));

import { api, ApiError, isApiError } from '../../lib/api';
import { normalizeAppError } from '../../utils/normalizeAppError';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** fetch that never resolves until its signal aborts (like a real hung request). */
function hangingFetch(_url: string, init: RequestInit) {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => {
      const e = new Error('The operation was aborted');
      e.name = 'AbortError';
      reject(e);
    });
  });
}

async function catchErr(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return e as ApiError;
  }
  throw new Error('expected rejection');
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test/';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: null } });
  getNetworkStatus.mockReset();
  getNetworkStatus.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api()', () => {
  it('builds the URL, decodes JSON and returns the body', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 1 }]));
    const data = await api<{ id: number }[]>('/api/recipes/explore-random');
    expect(data).toEqual([{ id: 1 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/recipes/explore-random');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('JSON-encodes bodies and sets Content-Type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await api('/api/x', { method: 'POST', body: { a: 1 } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe('{"a":1}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('returns undefined for an empty 2xx body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api('/api/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('attaches the bearer token when a session exists', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
    fetchMock.mockResolvedValue(jsonResponse({}));
    await api('/api/x');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok123');
  });

  it('omits Authorization when there is no session', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await api('/api/x');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('omits Authorization when auth: false, even with a session', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
    fetchMock.mockResolvedValue(jsonResponse({}));
    await api('/api/x', { auth: false });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('omits Authorization if getSession throws', async () => {
    getSession.mockRejectedValue(new Error('secure store unavailable'));
    fetchMock.mockResolvedValue(jsonResponse({}));
    await api('/api/x');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('times out → kind "timeout"', async () => {
    fetchMock.mockImplementation(hangingFetch);
    const err = await catchErr(api('/api/slow', { timeoutMs: 20 }));
    expect(err.kind).toBe('timeout');
    expect(getNetworkStatus).not.toHaveBeenCalled();
  });

  it('network failure while online → kind "interrupted"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    getNetworkStatus.mockResolvedValue(true);
    const err = await catchErr(api('/api/x'));
    expect(err.kind).toBe('interrupted');
  });

  it('network failure while offline → kind "offline"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    getNetworkStatus.mockResolvedValue(false);
    const err = await catchErr(api('/api/x'));
    expect(err.kind).toBe('offline');
  });

  it('network failure when NetInfo itself fails → "interrupted" (never falsely offline)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    getNetworkStatus.mockRejectedValue(new Error('netinfo down'));
    const err = await catchErr(api('/api/x'));
    expect(err.kind).toBe('interrupted');
  });

  it('4xx → kind "http" with status, body and server message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Missing or empty "input"' }, 400));
    const err = await catchErr(api('/api/x', { method: 'POST', body: {} }));
    expect(err.kind).toBe('http');
    expect(err.status).toBe(400);
    expect(err.body).toEqual({ error: 'Missing or empty "input"' });
    expect(err.message).toBe('Missing or empty "input"');
  });

  it('extracts nested { error: { code, message } } bodies', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: 'INVALID_INPUT', message: 'bad' } }, 422));
    const err = await catchErr(api('/api/x'));
    expect(err.kind).toBe('http');
    expect(err.code).toBe('INVALID_INPUT');
    expect(err.message).toBe('bad');
  });

  it('5xx with a non-JSON body → kind "http" with raw text body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }));
    const err = await catchErr(api('/api/x'));
    expect(err.kind).toBe('http');
    expect(err.status).toBe(502);
    expect(err.body).toBe('<html>Bad Gateway</html>');
  });

  it('429 → kind "rate_limited" with retryAfterMs', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Slow down' }, 429, { 'Retry-After': '7' }));
    const err = await catchErr(api('/api/x'));
    expect(err.kind).toBe('rate_limited');
    expect(err.status).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retryAfterMs).toBe(7000);
  });

  it('{ code: "RATE_LIMITED" } body → kind "rate_limited" regardless of status', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'RATE_LIMITED', error: 'Too many parses' }, 403));
    const err = await catchErr(api('/api/x'));
    expect(err.kind).toBe('rate_limited');
    expect(err.status).toBe(403);
  });

  it('schema failure → kind "invalid_response"', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'Soup' }));
    const schema = {
      parse(x: unknown) {
        if (!x || typeof (x as any).id !== 'number') throw new Error('missing id');
        return x as { id: number; title: string };
      },
    };
    const err = await catchErr(api('/api/recipes/parse', { schema }));
    expect(err.kind).toBe('invalid_response');
    expect(err.body).toEqual({ title: 'Soup' });
    expect((err as any).cause).toBeInstanceOf(Error);
  });

  it('schema success returns the parsed value', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 5 }));
    const out = await api('/api/x', { schema: { parse: (x: unknown) => ({ ...(x as object), checked: true }) } });
    expect(out).toEqual({ id: 5, checked: true });
  });

  it('non-JSON 2xx body → kind "invalid_response"', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    const err = await catchErr(api('/api/x'));
    expect(err.kind).toBe('invalid_response');
  });

  it('FormData body is passed through without a JSON Content-Type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1 }));
    const form = new FormData();
    form.append('image', 'data');
    await api('/api/recipes/parse-image', { method: 'POST', body: form });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(form);
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('external abort mid-flight → kind "aborted"', async () => {
    fetchMock.mockImplementation(hangingFetch);
    const controller = new AbortController();
    const p = api('/api/x', { signal: controller.signal, timeoutMs: 5000 });
    setTimeout(() => controller.abort(), 5);
    const err = await catchErr(p);
    expect(err.kind).toBe('aborted');
  });

  it('already-aborted signal → kind "aborted" without calling fetch', async () => {
    const controller = new AbortController();
    controller.abort();
    const err = await catchErr(api('/api/x', { signal: controller.signal }));
    expect(err.kind).toBe('aborted');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('missing EXPO_PUBLIC_API_URL → kind "config"', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const err = await catchErr(api('/api/x'));
    expect(err.kind).toBe('config');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('isApiError narrows by kind', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const err = await catchErr(api('/api/x'));
    expect(isApiError(err)).toBe(true);
    expect(isApiError(err, 'interrupted', 'offline')).toBe(true);
    expect(isApiError(err, 'http')).toBe(false);
    expect(isApiError(new Error('x'))).toBe(false);
  });
});

describe('normalizeAppError(ApiError)', () => {
  const mk = (kind: ApiError['kind'], extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
    new ApiError({ kind, message: 'Network request failed', method: 'GET', path: '/x', ...extra });

  it('interrupted does NOT say "check your internet connection"', () => {
    const n = normalizeAppError(mk('interrupted'));
    expect(n.code).toBe('NETWORK_INTERRUPTED');
    expect(n.message).not.toMatch(/internet/i);
    expect(n.retryable).toBe(true);
  });

  it('interrupted wins over context-based permission mapping', () => {
    const n = normalizeAppError(mk('interrupted'), { context: 'photos' });
    expect(n.code).toBe('NETWORK_INTERRUPTED');
  });

  it('offline says "check your internet connection"', () => {
    const n = normalizeAppError(mk('offline'));
    expect(n.code).toBe('NETWORK_OFFLINE');
    expect(n.message).toBe('Please check your internet connection and try again.');
  });

  it('timeout / rate_limited / invalid_response / aborted have distinct codes', () => {
    expect(normalizeAppError(mk('timeout')).code).toBe('TIMEOUT');
    expect(normalizeAppError(mk('rate_limited', { status: 429 })).code).toBe('RATE_LIMITED');
    expect(normalizeAppError(mk('invalid_response')).code).toBe('INVALID_RESPONSE');
    expect(normalizeAppError(mk('aborted')).severity).toBe('info');
  });

  it('http 401 → AUTH_REQUIRED', () => {
    const n = normalizeAppError(mk('http', { status: 401, message: 'nope' }));
    expect(n.code).toBe('AUTH_REQUIRED');
  });

  it('http without stage/context uses status-code copy', () => {
    const n = normalizeAppError(mk('http', { status: 500, message: 'db exploded' }));
    expect(n.code).toBe('HTTP_500');
    expect(n.message).toBe('Recipe service is having issues. Please try again in a few minutes.');
  });

  it('http with a parse context keeps the existing context-aware mapping', () => {
    const n = normalizeAppError(
      mk('http', { status: 400, message: "That doesn't look like a valid recipe" }),
      { context: 'url' },
    );
    expect(n.code).toBe('PARSING_ERROR');
  });

  it('plain Error("Network request failed") behaviour is unchanged', () => {
    const n = normalizeAppError(new Error('Network request failed'));
    expect(n.message).toBe('Please check your internet connection and try again.');
  });
});
