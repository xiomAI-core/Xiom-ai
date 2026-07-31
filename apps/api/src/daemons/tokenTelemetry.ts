/**
 * Token telemetry daemon — fetches XIOM token price and holder data
 */
import { logger } from '../lib/logger.js';

export interface HolderEntry {
  address: string;
  balance: string;
  rank: number;
}

export interface TemporalSnapshot {
  snapshotAt: string;
  holderCount: number;
  priceUsd: string | null;
}

export interface TokenCacheData {
  priceUsd: string | null;
  priceChange24h: string | null;
  volume24h: string | null;
  marketCapUsd: string | null;
  source: string | null;
  holderCount: number;
  holders: HolderEntry[];
  temporalSnapshots: TemporalSnapshot[];
  lastUpdatedAt: string;
}

export const tokenCache: TokenCacheData = {
  priceUsd: null,
  priceChange24h: null,
  volume24h: null,
  marketCapUsd: null,
  source: null,
  holderCount: 0,
  holders: [],
  temporalSnapshots: [],
  lastUpdatedAt: new Date().toISOString(),
};

const DEXSCREENER_URL = 'https://api.dexscreener.com/latest/dex/tokens/';

export async function tokenTelemetryDaemon(): Promise<void> {
  const tokenAddress = process.env['XIOM_TOKEN_ADDRESS'];
  if (!tokenAddress) {
    logger.debug('tokenTelemetry: XIOM_TOKEN_ADDRESS not set, skipping');
    return;
  }

  try {
    const response = await fetch(`${DEXSCREENER_URL}${tokenAddress}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'tokenTelemetry: DexScreener request failed');
      return;
    }

    const data = await response.json() as {
      pairs?: Array<{
        priceUsd?: string;
        priceChange?: { h24?: number };
        volume?: { h24?: number };
        fdv?: number;
      }>;
    };
    const pair = data.pairs?.[0];
    if (pair) {
      tokenCache.priceUsd = pair.priceUsd ?? null;
      tokenCache.priceChange24h = String(pair.priceChange?.h24 ?? 0);
      tokenCache.volume24h = String(pair.volume?.h24 ?? 0);
      tokenCache.marketCapUsd = String(pair.fdv ?? 0);
      tokenCache.source = 'dexscreener';
    }

    tokenCache.lastUpdatedAt = new Date().toISOString();

    // Record temporal snapshot
    const snap: TemporalSnapshot = {
      snapshotAt: tokenCache.lastUpdatedAt,
      holderCount: tokenCache.holderCount,
      priceUsd: tokenCache.priceUsd,
    };
    tokenCache.temporalSnapshots.push(snap);
    if (tokenCache.temporalSnapshots.length > 1440) {
      tokenCache.temporalSnapshots.shift();
    }
  } catch (err) {
    logger.warn({ err }, 'tokenTelemetry: failed to fetch price data');
  }
}
