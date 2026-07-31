/**
 * Holder snapshot daemon — fetches full holder map and persists to DB (Blockscout)
 */
import { db } from '../lib/db.js';
import { holderSnapshots } from '@xiom/db';
import { tokenCache } from './tokenTelemetry.js';
import { logger } from '../lib/logger.js';
import { CHAIN_IDS } from '@xiom/blockchain';

const BLOCKSCOUT_API =
  process.env['BLOCKSCOUT_API_URL'] ?? 'https://explorer.robinhoodchain.com/api';

export async function holderSnapshotDaemon(): Promise<void> {
  const tokenAddress = process.env['XIOM_TOKEN_ADDRESS'];
  const apiKey = process.env['BLOCKSCOUT_API_KEY'];

  if (!tokenAddress) {
    logger.debug('holderSnapshot: XIOM_TOKEN_ADDRESS not set, skipping');
    return;
  }

  try {
    const url = new URL(BLOCKSCOUT_API);
    url.searchParams.set('module', 'token');
    url.searchParams.set('action', 'tokenholderlist');
    url.searchParams.set('contractaddress', tokenAddress);
    url.searchParams.set('page', '1');
    url.searchParams.set('offset', '1000');
    if (apiKey) url.searchParams.set('apikey', apiKey);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'holderSnapshot: Blockscout request failed');
      return;
    }

    const data = await response.json() as {
      status: string;
      result?: Array<{ TokenHolderAddress: string; TokenHolderQuantity: string }>;
    };

    if (data.status !== '1' || !Array.isArray(data.result)) {
      logger.debug({ status: data.status }, 'holderSnapshot: Blockscout returned non-success status');
      return;
    }

    const holders = data.result.map((h, i) => ({
      address: h.TokenHolderAddress,
      balance: h.TokenHolderQuantity,
      rank: i + 1,
    }));

    tokenCache.holderCount = holders.length;
    tokenCache.holders = holders;

    await db.insert(holderSnapshots).values({
      holderCount: holders.length,
      topHolders: holders.slice(0, 100) as unknown as Record<string, unknown>[],
      source: 'blockscout',
      chainId: CHAIN_IDS.robinhood,
    });

    logger.info({ holderCount: holders.length }, 'holderSnapshot: snapshot persisted');
  } catch (err) {
    logger.warn({ err }, 'holderSnapshot: failed');
  }
}
