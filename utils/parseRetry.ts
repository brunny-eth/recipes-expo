/**
 * Retry policy + response validation for recipe parse requests.
 *
 * Pure (no React / React Native imports) so it can be unit-tested directly.
 *
 * Why: parses are one long POST (15–40s+). When the user backgrounds the app,
 * iOS tears down the socket and the request fails even though the device is
 * online. lib/api.ts reports that as `interrupted`; we silently re-run the parse
 * instead of showing an error.
 */
import { isApiError } from '../lib/apiError';

/** Automatic retries allowed per parse (on top of the first attempt). */
export const MAX_PARSE_AUTO_RETRIES = 2;

/** Parses routinely take 15–40s+, so the client default (30s) is too short. */
export const PARSE_TIMEOUT_MS = 120_000;

export type ParseRetryDecision = 'retry_now' | 'retry_when_active' | 'show_error';

export type DecideParseRetryInput = {
  error: unknown;
  /** Automatic retries already performed for this parse (0 on the first failure). */
  attempt: number;
  /** The app went `background`/`inactive` while this request was in flight. */
  wasBackgrounded: boolean;
  /** Whether the app is currently `active`. Defaults to true. */
  isAppActive?: boolean;
};

export function decideParseRetry({
  error,
  attempt,
  wasBackgrounded,
  isAppActive = true,
}: DecideParseRetryInput): ParseRetryDecision {
  if (!isApiError(error)) return 'show_error';

  const retryable =
    error.kind === 'interrupted' || (error.kind === 'timeout' && wasBackgrounded);
  if (!retryable) return 'show_error';
  if (attempt >= MAX_PARSE_AUTO_RETRIES) return 'show_error';

  return isAppActive ? 'retry_now' : 'retry_when_active';
}

/** Short reason string for analytics/logs. */
export function parseRetryReason(error: unknown, wasBackgrounded: boolean): string {
  const kind = isApiError(error) ? error.kind : 'unknown';
  return wasBackgrounded ? `${kind}_backgrounded` : kind;
}

export type ParseRecipeResponse = {
  recipe?: { id: string | number; [key: string]: unknown } | null;
  [key: string]: unknown;
};

/**
 * Light schema for 2xx parse responses (`/api/recipes/parse`, `/parse-image`,
 * `/parse-images`). Accepts anything the screens already handle (error bodies,
 * cachedMatches without a recipe, video `source: null` responses) but rejects a
 * non-object body or a returned recipe with no `id`.
 */
export const parseRecipeResponseSchema = {
  parse(input: unknown): ParseRecipeResponse {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Parse response is not an object');
    }
    const recipe = (input as { recipe?: unknown }).recipe;
    if (recipe) {
      if (typeof recipe !== 'object') {
        throw new Error('Parse response recipe is not an object');
      }
      const id = (recipe as { id?: unknown }).id;
      if (id === undefined || id === null || id === '') {
        throw new Error('Parse response recipe is missing an id');
      }
    }
    return input as ParseRecipeResponse;
  },
};
