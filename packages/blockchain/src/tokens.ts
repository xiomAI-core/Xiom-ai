/**
 * Token balance + holder tier helpers (USDG, ETH, AXAI)
 */
import { formatUnits, parseUnits, type Address } from 'viem';
import { publicClient } from './client';
import { activeChain, CHAIN_IDS } from './chains';
import { AXAI_ABI, USDG_ABI, getContractAddresses } from './contracts';

export const USDG_DECIMALS = 6;
export const AXAI_DECIMALS = 18;

export type HolderTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

const TIER_THRESHOLDS: { tier: HolderTier; min: bigint }[] = [
  { tier: 'platinum', min: parseUnits('100000', AXAI_DECIMALS) },
  { tier: 'gold', min: parseUnits('10000', AXAI_DECIMALS) },
  { tier: 'silver', min: parseUnits('1000', AXAI_DECIMALS) },
  { tier: 'bronze', min: parseUnits('100', AXAI_DECIMALS) },
];

function addresses(chainId?: number) {
  return getContractAddresses(chainId ?? activeChain.id);
}

export async function getUsdgBalance(
  owner: Address,
  chainId?: number
): Promise<bigint> {
  const { usdg } = addresses(chainId);
  if (usdg === '0x0000000000000000000000000000000000000000') return 0n;
  return publicClient.readContract({
    address: usdg,
    abi: USDG_ABI,
    functionName: 'balanceOf',
    args: [owner],
  });
}

export function formatUsdg(amount: bigint, decimals = USDG_DECIMALS): string {
  return formatUnits(amount, decimals);
}

export function parseUsdg(amount: string, decimals = USDG_DECIMALS): bigint {
  return parseUnits(amount, decimals);
}

export async function getEthBalance(owner: Address): Promise<bigint> {
  return publicClient.getBalance({ address: owner });
}

export async function getAxaiBalance(
  owner: Address,
  chainId?: number
): Promise<bigint> {
  const { axai } = addresses(chainId);
  if (axai === '0x0000000000000000000000000000000000000000') return 0n;
  return publicClient.readContract({
    address: axai,
    abi: AXAI_ABI,
    functionName: 'balanceOf',
    args: [owner],
  });
}

export function getHolderTier(axaiBalance: bigint): HolderTier {
  for (const { tier, min } of TIER_THRESHOLDS) {
    if (axaiBalance >= min) return tier;
  }
  return 'none';
}

const CHAINLINK_AGGREGATOR_ABI = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * ETH/USD on Robinhood Chain via Chainlink (`CHAINLINK_ETH_USD_RH`).
 * Prefers env override → HTTP oracle → RH Chainlink → placeholder.
 * Do not use Base Chainlink feeds.
 */
export async function getEthUsdPrice(): Promise<number> {
  const override = process.env['ETH_USD_PRICE'];
  if (override) {
    const n = Number(override);
    if (!Number.isNaN(n) && n > 0) return n;
  }

  const oracleUrl = process.env['ETH_USD_ORACLE_URL'];
  if (oracleUrl) {
    try {
      const res = await fetch(oracleUrl, { signal: AbortSignal.timeout(8_000) });
      if (res.ok) {
        const data = (await res.json()) as { price?: number; usd?: number };
        const price = data.price ?? data.usd;
        if (typeof price === 'number' && price > 0) return price;
      }
    } catch {
      // fall through to Chainlink
    }
  }

  const feed = process.env['CHAINLINK_ETH_USD_RH'] as `0x${string}` | undefined;
  if (feed && feed !== '0x0000000000000000000000000000000000000000') {
    try {
      const result = await publicClient.readContract({
        address: feed,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'latestRoundData',
      });
      const answer = result[1];
      const price = Number(answer) / 1e8;
      if (Number.isFinite(price) && price > 0) return price;
    } catch {
      // fall through
    }
  }

  return 3000; // placeholder until RH Chainlink feed address is configured
}

export { CHAIN_IDS };
