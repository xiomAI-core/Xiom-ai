/**
 * Rate limiting middleware — in-memory sliding window
 */
import type { Context, Next } from 'hono';

const windows = new Map<string, { count: number; resetAt: number }>();

const LIMIT_PUBLIC = Number(process.env['RATE_LIMIT_PUBLIC'] ?? 100);
const WINDOW_MS = 60_000; // 1 minute

/** Clear in-memory rate-limit buckets (for unit/integration tests). */
export function clearRateLimitWindows(): void {
  windows.clear();
}

export async function rateLimitMiddleware(c: Context, next: Next) {
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
  const key = `rl:${ip}`;
  const now = Date.now();

  const entry = windows.get(key);
  if (!entry || entry.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    c.header('X-RateLimit-Limit', String(LIMIT_PUBLIC));
    c.header('X-RateLimit-Remaining', String(LIMIT_PUBLIC - 1));
    return next();
  }

  entry.count += 1;
  c.header('X-RateLimit-Limit', String(LIMIT_PUBLIC));
  c.header('X-RateLimit-Remaining', String(Math.max(0, LIMIT_PUBLIC - entry.count)));
  c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > LIMIT_PUBLIC) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    c.header('Retry-After', String(retryAfter));
    return c.json({ ok: false, error: 'Too many requests', code: 'RATE_LIMITED' }, 429);
  }

  return next();
}

/**
 * Factory to create per-route rate limiters with custom limits.
 */
export function createRateLimit(limit: number, windowMs: number = WINDOW_MS) {
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('x-forwarded-for') ??
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-real-ip') ??
      'unknown';
    const bucket = Math.floor(Date.now() / windowMs);
    const key = `${ip}:${c.req.path}:${bucket}`;
    const now = Date.now();
    const resetAt = (bucket + 1) * windowMs;

    const window = windows.get(key) ?? { count: 0, resetAt };
    window.count += 1;
    windows.set(key, window);

    const remaining = Math.max(0, limit - window.count);
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (window.count > limit) {
      const retryAfter = Math.ceil((resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({ ok: false, error: 'Too many requests', code: 'RATE_LIMITED' }, 429);
    }

    return next();
  };
}

// Periodically clean up expired entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (entry.resetAt < now) windows.delete(key);
  }
}, 5 * 60_000);
