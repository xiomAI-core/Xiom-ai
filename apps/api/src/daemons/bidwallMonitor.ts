/**
 * BidWall monitor daemon — ETH balance on RH Chain; price from price oracle / Chainlink RH
 */
import { publicClient, getEthUsdPrice } from '@xiom/blockchain';
import { logger } from '../lib/logger.js';

export interface BidwallCacheData {
  balanceEth: string;
  balanceUsd: string;
  ethPriceUsd: string;
  revenueUsd: string;
  events: Array<{ type: string; value: string; txHash: string; timestamp: string }>;
  lastUpdatedAt: string;
}

export const bidwallCache: BidwallCacheData = {
  balanceEth: '0',
  balanceUsd: '0',
  ethPriceUsd: '0',
  revenueUsd: '0',
  events: [],
  lastUpdatedAt: new Date().toISOString(),
};

export async function bidwallMonitorDaemon(): Promise<void> {
  const contractAddress = process.env['BIDWALL_CONTRACT_ADDRESS'] as `0x${string}` | undefined;
  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
    logger.debug('bidwallMonitor: BIDWALL_CONTRACT_ADDRESS not set, skipping balance check');
    return;
  }

  try {
    const [balanceResult, priceResult] = await Promise.allSettled([
      publicClient.getBalance({ address: contractAddress }),
      getEthUsdPrice(),
    ]);

    if (balanceResult.status === 'fulfilled') {
      const balanceWei = balanceResult.value;
      bidwallCache.balanceEth = (Number(balanceWei) / 1e18).toFixed(6);
    }

    if (priceResult.status === 'fulfilled' && priceResult.value > 0) {
      const ethPriceUsd = priceResult.value;
      bidwallCache.ethPriceUsd = ethPriceUsd.toFixed(2);
      const balanceEth = parseFloat(bidwallCache.balanceEth);
      bidwallCache.balanceUsd = (balanceEth * ethPriceUsd).toFixed(2);
      bidwallCache.revenueUsd = bidwallCache.balanceUsd;
    }

    bidwallCache.lastUpdatedAt = new Date().toISOString();
  } catch (err) {
    logger.warn({ err }, 'bidwallMonitor: failed to fetch on-chain data');
  }
}
