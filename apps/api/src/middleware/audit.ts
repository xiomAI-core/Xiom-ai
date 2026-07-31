import type { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';

export async function auditMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);

  await next();

  const duration = Date.now() - start;
  logger.info({
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
    ip: c.req.header('x-forwarded-for') ?? 'unknown',
  }, 'request');
}
