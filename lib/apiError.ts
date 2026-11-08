/**
 * Typed error thrown by `lib/api.ts`.
 *
 * Kept in its own dependency-free module (no supabase / NetInfo imports) so the
 * error layer (`utils/normalizeAppError.ts`) and unit tests can import it
 * without pulling in React Native native modules.
 */

export type ApiErrorKind =
  /** NetInfo confirms the device has no connection. */
  | 'offline'
  /** Our own timeout (`timeoutMs`) fired before the response finished. */
  | 'timeout'
  /**
   * The request failed at the network layer while the device appears to be
   * online — e.g. iOS tore down the socket while the app was backgrounded.
   * NOT a connectivity problem; usually safe to retry.
   */
  | 'interrupted'
  /** Server responded with a non-2xx status (other than rate limiting). */
  | 'http'
  /** Server responded 429 or with `{ code: 'RATE_LIMITED' }`. */
  | 'rate_limited'
  /** 2xx response whose body was not valid JSON or failed schema validation. */
  | 'invalid_response'
  /** The caller's `signal` aborted the request (e.g. screen unmounted). */
  | 'aborted'
  /** Client misconfiguration (EXPO_PUBLIC_API_URL missing). */
  | 'config';

export type ApiErrorInit = {
  kind: ApiErrorKind;
  message: string;
  method: string;
  path: string;
  status?: number;
  body?: unknown;
  code?: string;
  retryAfterMs?: number;
  cause?: unknown;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status (http / rate_limited / invalid_response only). */
  readonly status?: number;
  /** Parsed server response body (JSON if parseable, else raw text). */
  readonly body?: unknown;
  /** Machine-readable server code, e.g. `RATE_LIMITED` or a ParseErrorCode. */
  readonly code?: string;
  /** From the `Retry-After` header on rate-limited responses. */
  readonly retryAfterMs?: number;
  readonly method: string;
  readonly path: string;

  constructor(init: ApiErrorInit) {
    super(init.message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.body = init.body;
    this.code = init.code;
    this.retryAfterMs = init.retryAfterMs;
    this.method = init.method;
    this.path = init.path;
    if (init.cause !== undefined) {
      (this as { cause?: unknown }).cause = init.cause;
    }
  }
}

/**
 * True if `error` is an ApiError (optionally of one of the given kinds).
 * Duck-typed on `name` so it survives duplicated module instances.
 */
export function isApiError(error: unknown, ...kinds: ApiErrorKind[]): error is ApiError {
  if (!error || typeof error !== 'object') return false;
  const e = error as Partial<ApiError>;
  if (e.name !== 'ApiError' || typeof e.kind !== 'string') return false;
  return kinds.length === 0 || kinds.includes(e.kind as ApiErrorKind);
}
