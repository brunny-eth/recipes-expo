import type { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from './logger';

/**
 * Minimal fixed-window, in-memory rate limiter.
 *
 * LIMITATION: counters live in this process's memory. On Vercel each
 * serverless instance has its own counters and they reset on cold start, so
 * this is a cheap deterrent against runaway loops / casual abuse, not a hard
 * guarantee. A distributed store (Redis/Upstash) would be needed for that.
 *
 * Keys default to the client IP (`req.ip`). That relies on
 * `app.set('trust proxy', 1)` in server/index.ts so Express reads the client
 * address from Vercel's `x-forwarded-for` header instead of the proxy's socket.
 */

export interface RateLimitOptions {
  /** Short label used in logs, e.g. 'recipe-parse'. */
  name: string;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests allowed per key within one window. */
  max: number;
  /** Derives the bucket key from the request. Defaults to client IP. */
  keyFn?: (req: Request) => string;
  /** Error message returned in the 429 body. */
  message?: string;
}

export const DEFAULT_RATE_LIMIT_MESSAGE =
  'Too many requests. Please wait a few minutes and try again.';

export function createRateLimiter(opts: RateLimitOptions): RequestHandler {
  const { name, windowMs, max, message = DEFAULT_RATE_LIMIT_MESSAGE } = opts;
  const keyFn = opts.keyFn ?? ((req: Request) => req.ip || req.socket?.remoteAddress || 'unknown');
  const store = new Map<string, { count: number; resetTime: number }>();
  let lastSweep = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    // Drop expired buckets at most once per window so the map can't grow unbounded.
    if (now - lastSweep > windowMs) {
      for (const [k, v] of store) {
        if (now > v.resetTime) store.delete(k);
      }
      lastSweep = now;
    }

    const key = keyFn(req);
    const entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (entry.count < max) {
      entry.count++;
      return next();
    }

    const retryAfterSec = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
    logger.warn(
      { requestId: (req as any).id, limiter: name, key, route: req.originalUrl, method: req.method, max, windowMs },
      'Rate limit exceeded',
    );
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({ error: message, code: 'RATE_LIMITED' });
  };
}

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * Recipe parsing (URL/text/image). A parse takes 15-40s, so 30 per 10 min
 * (~180/hr) leaves plenty of headroom for a user importing 10-20 recipes plus
 * client retries, while capping a scripted loop.
 */
export const recipeParseLimiter = createRateLimiter({ name: 'recipe-parse', windowMs: TEN_MINUTES, max: 30 });

/** Instruction modification + variations (LLM). Same budget as parsing. */
export const recipeModifyLimiter = createRateLimiter({ name: 'recipe-modify', windowMs: TEN_MINUTES, max: 30 });

/** Chat endpoints: conversational, so more requests per session. */
export const aiChatLimiter = createRateLimiter({ name: 'ai-chat', windowMs: TEN_MINUTES, max: 60 });

/**
 * Embeddings. This endpoint is called BY THE SERVER ITSELF over HTTP
 * (utils/embedText.ts, from parseTextRecipe fuzzy matching and
 * recipeEmbeddings), so requests arrive from Vercel's shared egress IPs on
 * behalf of many users. The limit is deliberately very generous: it only
 * exists to stop a hammering loop against an open OpenAI proxy, and must
 * never trip under real parse traffic.
 */
export const aiEmbedLimiter = createRateLimiter({ name: 'ai-embed', windowMs: TEN_MINUTES, max: 600 });
