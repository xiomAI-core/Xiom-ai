/**
 * Revenue accounting daemon — aggregates protocol revenue from all sources
 */
import { logger } from '../lib/logger.js';

export interface RevenueCacheData {
  totalUsdc: string;
  totalTxns: number;
  last30dUsdc: string;
  flaunchFees: string;
  acpEarnings: string;
  lastUpdatedAt: string;
}

export const revenueCache: RevenueCacheData = {
  totalUsdc: '0',
  totalTxns: 0,
  last30dUsdc: '0',
  flaunchFees: '0',
  acpEarnings: '0',
  lastUpdatedAt: new Date().toISOString(),
};

export async function revenueAccountingDaemon(): Promise<void> {
  try {
    // TODO: fetch Flaunch fee events from Base chain
    // TODO: aggregate ACP earnings from DB

    revenueCache.lastUpdatedAt = new Date().toISOString();
    logger.debug('revenueAccounting: tick completed');
  } catch (err) {
    logger.warn({ err }, 'revenueAccounting: failed');
  }
}
