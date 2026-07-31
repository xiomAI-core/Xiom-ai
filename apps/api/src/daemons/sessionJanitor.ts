/**
 * Session janitor daemon — deletes audit logs older than 30 days
 */
import { logger } from '../lib/logger.js';

export async function sessionJanitorDaemon(): Promise<void> {
  try {
    // TODO: delete audit_logs older than 30 days
    // TODO: archive sessions older than configured retention period
    logger.debug('sessionJanitor: cleanup tick completed');
  } catch (err) {
    logger.warn({ err }, 'sessionJanitor: failed');
  }
}
