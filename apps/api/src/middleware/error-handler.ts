import type { Context } from 'hono';
import { logger } from '../lib/logger.js';

export function errorHandler(err: Error, c: Context) {
  logger.error({ err, path: c.req.path }, 'Unhandled error');

  if (process.env['NODE_ENV'] === 'production') {
    return c.json({ error: 'Internal server error' }, 500);
  }

  return c.json({
    error: 'Internal server error',
    message: err.message,
    stack: err.stack,
  }, 500);
}
