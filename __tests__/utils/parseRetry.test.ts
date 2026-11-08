import { describe, it, expect } from 'vitest';
import { ApiError, ApiErrorKind } from '../../lib/apiError';
import {
  decideParseRetry,
  parseRetryReason,
  parseRecipeResponseSchema,
  MAX_PARSE_AUTO_RETRIES,
} from '../../utils/parseRetry';

const err = (kind: ApiErrorKind, extra: Record<string, unknown> = {}) =>
  new ApiError({ kind, message: kind, method: 'POST', path: '/api/recipes/parse', ...extra });

describe('decideParseRetry', () => {
  it('retries interrupted requests whether or not the app was backgrounded', () => {
    expect(decideParseRetry({ error: err('interrupted'), attempt: 0, wasBackgrounded: true })).toBe('retry_now');
    expect(decideParseRetry({ error: err('interrupted'), attempt: 0, wasBackgrounded: false })).toBe('retry_now');
  });

  it('waits for the app to be active when it is not', () => {
    expect(
      decideParseRetry({ error: err('interrupted'), attempt: 0, wasBackgrounded: true, isAppActive: false }),
    ).toBe('retry_when_active');
    expect(
      decideParseRetry({ error: err('timeout'), attempt: 1, wasBackgrounded: true, isAppActive: false }),
    ).toBe('retry_when_active');
  });

  it('retries a timeout only if the app was backgrounded during the request', () => {
    expect(decideParseRetry({ error: err('timeout'), attempt: 0, wasBackgrounded: true })).toBe('retry_now');
    expect(decideParseRetry({ error: err('timeout'), attempt: 0, wasBackgrounded: false })).toBe('show_error');
  });

  it(`caps automatic retries at ${MAX_PARSE_AUTO_RETRIES}`, () => {
    expect(MAX_PARSE_AUTO_RETRIES).toBe(2);
    expect(decideParseRetry({ error: err('interrupted'), attempt: 1, wasBackgrounded: true })).toBe('retry_now');
    expect(decideParseRetry({ error: err('interrupted'), attempt: 2, wasBackgrounded: true })).toBe('show_error');
    expect(
      decideParseRetry({ error: err('interrupted'), attempt: 2, wasBackgrounded: true, isAppActive: false }),
    ).toBe('show_error');
    expect(decideParseRetry({ error: err('timeout'), attempt: 3, wasBackgrounded: true })).toBe('show_error');
  });

  it.each<ApiErrorKind>(['offline', 'http', 'rate_limited', 'invalid_response', 'aborted', 'config'])(
    'never auto-retries %s (backgrounded or not)',
    (kind) => {
      for (const wasBackgrounded of [true, false]) {
        for (const isAppActive of [true, false]) {
          expect(decideParseRetry({ error: err(kind), attempt: 0, wasBackgrounded, isAppActive })).toBe('show_error');
        }
      }
    },
  );

  it('never auto-retries non-ApiErrors', () => {
    for (const error of [new TypeError('Network request failed'), new Error('x'), 'oops', null, undefined]) {
      expect(decideParseRetry({ error, attempt: 0, wasBackgrounded: true })).toBe('show_error');
    }
  });
});

describe('parseRetryReason', () => {
  it('describes the kind and whether the app was backgrounded', () => {
    expect(parseRetryReason(err('interrupted'), true)).toBe('interrupted_backgrounded');
    expect(parseRetryReason(err('interrupted'), false)).toBe('interrupted');
    expect(parseRetryReason(err('timeout'), true)).toBe('timeout_backgrounded');
    expect(parseRetryReason(new Error('x'), false)).toBe('unknown');
  });
});

describe('parseRecipeResponseSchema', () => {
  const ok = (x: unknown) => parseRecipeResponseSchema.parse(x);

  it('accepts a recipe with an id (number or string)', () => {
    expect(ok({ recipe: { id: 12, title: 'Soup' } })).toEqual({ recipe: { id: 12, title: 'Soup' } });
    expect(ok({ recipe: { id: 'abc' } }).recipe?.id).toBe('abc');
    expect(ok({ recipe: { id: 0 } }).recipe?.id).toBe(0);
  });

  it('accepts shapes without a recipe that the screens already handle', () => {
    expect(() => ok({ cachedMatches: [{ recipe: { id: 1 }, similarity: 0.9 }] })).not.toThrow();
    expect(() => ok({ recipe: null, cachedMatches: [] })).not.toThrow();
    expect(() => ok({ source: null, recipe: null })).not.toThrow();
    expect(() => ok({ error: { code: 'X', message: 'nope' } })).not.toThrow();
    expect(() => ok({})).not.toThrow();
  });

  it('rejects a recipe without an id', () => {
    expect(() => ok({ recipe: { title: 'Soup' } })).toThrow(/id/);
    expect(() => ok({ recipe: { id: null } })).toThrow(/id/);
    expect(() => ok({ recipe: { id: '' } })).toThrow(/id/);
    expect(() => ok({ recipe: 'Soup' })).toThrow();
  });

  it('rejects non-object bodies', () => {
    for (const x of [null, undefined, 'text', 42, []]) {
      expect(() => ok(x)).toThrow();
    }
  });
});
