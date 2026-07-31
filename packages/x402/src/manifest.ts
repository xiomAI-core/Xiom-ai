/**
 * x402 payment manifest — Robinhood Chain + USDG
 */
import type { Address } from 'viem';

export const X402_VERSION = 1;

export interface X402Manifest {
  x402Version: number;
  network: 'robinhood_chain';
  chainId: 4663;
  scheme: 'exact';
  currency: 'USDG';
  asset: Address;
  recipient: Address;
  decimals: 6;
}

export function buildManifest(overrides?: {
  asset?: Address;
  recipient?: Address;
}): X402Manifest {
  const asset = (overrides?.asset ??
    process.env['USDG_ADDRESS'] ??
    '0x0000000000000000000000000000000000000000') as Address;
  const recipient = (overrides?.recipient ??
    process.env['XIOM_TREASURY_ADDRESS'] ??
    '0x0000000000000000000000000000000000000000') as Address;

  return {
    x402Version: X402_VERSION,
    network: 'robinhood_chain',
    chainId: 4663,
    scheme: 'exact',
    currency: 'USDG',
    asset,
    recipient,
    decimals: 6,
  };
}

/** Canonical USDG address placeholder until RH deployment */
export const USDG_ADDRESS =
  (process.env['USDG_ADDRESS'] ??
    '0x0000000000000000000000000000000000000000') as Address;
