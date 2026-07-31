/**
 * Price oracle daemon — ETH/USD via Chainlink on Robinhood Chain (not Base).
 * Interval: 30s
 */
import { getEthUsdPrice } from '@xiom/blockchain';
import { bidwallCache } from './bidwallMonitor.js';
import { logger } from '../lib/logger.js';

export interface PriceOracleCache {
  ethUsd: number;
  source: string;
  lastUpdatedAt: string;
}

export const priceOracleCache: PriceOracleCache = {
  ethUsd: 0,
  source: 'unset',
  lastUpdatedAt: new Date().toISOString(),
};

export async function priceOracleDaemon(): Promise<void> {
  try {
    const ethUsd = await getEthUsdPrice();
    if (!(ethUsd > 0)) {
      logger.debug('priceOracle: invalid price, skipping cache update');
      return;
    }

    priceOracleCache.ethUsd = ethUsd;
    priceOracleCache.source =
      process.env['ETH_USD_PRICE']
        ? 'env_override'
        : process.env['ETH_USD_ORACLE_URL']
          ? 'http_oracle'
          : process.env['CHAINLINK_ETH_USD_RH']
            ? 'chainlink_rh'
            : 'fallback';
    priceOracleCache.lastUpdatedAt = new Date().toISOString();

    // Keep bidwall cache in sync for USD conversions
    bidwallCache.ethPriceUsd = ethUsd.toFixed(2);
    const balanceEth = parseFloat(bidwallCache.balanceEth);
    if (Number.isFinite(balanceEth)) {
      bidwallCache.balanceUsd = (balanceEth * ethUsd).toFixed(2);
      bidwallCache.revenueUsd = bidwallCache.balanceUsd;
    }
    bidwallCache.lastUpdatedAt = priceOracleCache.lastUpdatedAt;

    logger.debug({ ethUsd, source: priceOracleCache.source }, 'priceOracle: tick');
  } catch (err) {
    logger.warn({ err }, 'priceOracle: failed');
  }
}
