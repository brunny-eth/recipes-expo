import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../server/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createRateLimiter } from '../../server/lib/rateLimit';
import { normalizeAppError } from '../../utils/normalizeAppError';

vi.mock('../../utils/networkUtils', () => ({ isOfflineError: () => false }));

function makeReq(ip: string): any {
  return { ip, originalUrl: '/api/test', method: 'POST', body: {} };
}

function makeRes() {
  const res: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string> };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  return res;
}

/** Runs the limiter once; returns whether next() was called and the response. */
function hit(limiter: ReturnType<typeof createRateLimiter>, ip: string) {
  const res = makeRes();
  let passed = false;
  limiter(makeReq(ip), res, () => { passed = true; });
  return { passed, res };
}

describe('createRateLimiter', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('allows N requests then blocks N+1 with 429 RATE_LIMITED', () => {
    const limiter = createRateLimiter({ name: 'test', windowMs: 60_000, max: 3 });
    for (let i = 0; i < 3; i++) expect(hit(limiter, '1.1.1.1').passed).toBe(true);

    const blocked = hit(limiter, '1.1.1.1');
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.res.body).toEqual({ error: expect.any(String), code: 'RATE_LIMITED' });
    expect(Number(blocked.res.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('tracks separate keys independently', () => {
    const limiter = createRateLimiter({ name: 'test', windowMs: 60_000, max: 2 });
    hit(limiter, '1.1.1.1');
    hit(limiter, '1.1.1.1');
    expect(hit(limiter, '1.1.1.1').passed).toBe(false);
    expect(hit(limiter, '2.2.2.2').passed).toBe(true);
  });

  it('resets after the window elapses', () => {
    const limiter = createRateLimiter({ name: 'test', windowMs: 60_000, max: 1 });
    expect(hit(limiter, '1.1.1.1').passed).toBe(true);
    expect(hit(limiter, '1.1.1.1').passed).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(hit(limiter, '1.1.1.1').passed).toBe(true);
  });

  it('supports a custom key function', () => {
    const limiter = createRateLimiter({ name: 'test', windowMs: 60_000, max: 1, keyFn: (req) => req.body.email });
    const res = makeRes();
    let passed = 0;
    limiter({ ...makeReq('1.1.1.1'), body: { email: 'a@x.com' } } as any, res, () => { passed++; });
    limiter({ ...makeReq('1.1.1.1'), body: { email: 'b@x.com' } } as any, res, () => { passed++; });
    expect(passed).toBe(2);
  });
});

describe('normalizeAppError for rate limits', () => {
  it('maps 429 to RATE_LIMITED instead of a parsing/network error', () => {
    expect(normalizeAppError('whatever', { statusCode: 429, stage: 'parsing' }).code).toBe('RATE_LIMITED');
    expect(normalizeAppError(new Error('Too many requests. Please wait a few minutes and try again.'), { stage: 'parsing', context: 'url' }).code).toBe('RATE_LIMITED');
  });
});
