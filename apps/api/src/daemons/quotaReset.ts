/**
 * Quota reset daemon — resets usedToday = 0 for all API credentials at midnight UTC
 */
import { db } from '../lib/db.js';
import { apiCredentials } from '@xiom/db';
import { logger } from '../lib/logger.js';

export async function quotaResetDaemon(): Promise<void> {
  try {
    const now = new Date();
    const isNearMidnightUtc = now.getUTCHours() === 0 && now.getUTCMinutes() < 30;

    if (!isNearMidnightUtc) {
      return;
    }

    await db.update(apiCredentials).set({ usedToday: 0 });
    logger.info('quotaReset: daily quota reset completed');
  } catch (err) {
    logger.warn({ err }, 'quotaReset: failed');
  }
}
