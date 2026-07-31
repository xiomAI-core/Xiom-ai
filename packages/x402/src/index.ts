/**
 * @xiom/x402
 * x402 USDG payment protocol helpers for HTTP 402 agent-native payments
 * on Robinhood Chain (replaces USDC on Base)
 */
import type { X402PaymentRequest, X402PaymentProof } from '@xiom/types';
import type { Address } from 'viem';
import { verifyUsdgPayment } from '@xiom/blockchain';
import { buildManifest, USDG_ADDRESS, X402_VERSION } from './manifest.js';

export type { X402PaymentRequest, X402PaymentProof };
export { buildManifest, USDG_ADDRESS, X402_VERSION } from './manifest.js';
export type { X402Manifest } from './manifest.js';
export { x402Middleware } from './middleware.js';
export type { X402MiddlewareOptions } from './middleware.js';

/**
 * Build the WWW-Authenticate header for a 402 response
 */
export function buildPaymentRequired(
  amount: bigint,
  resource: string,
  recipient: Address,
  description?: string
): { status: 402; headers: Record<string, string>; body: X402PaymentRequest } {
  const req: X402PaymentRequest = {
    x402Version: X402_VERSION,
    scheme: 'exact',
    network: 'robinhood_chain',
    maxAmountRequired: amount.toString(),
    resource,
    ...(description !== undefined ? { description } : {}),
  };

  return {
    status: 402,
    headers: {
      'WWW-Authenticate': `x402 ${JSON.stringify(req)}`,
      'X-Payment-Recipient': recipient,
      'X-Payment-Network': 'robinhood_chain',
      'X-Payment-Currency': 'USDG',
    },
    body: req,
  };
}

/**
 * Parse an X-Payment header from an incoming request
 */
export function parsePaymentHeader(header: string): X402PaymentProof | null {
  try {
    return JSON.parse(header) as X402PaymentProof;
  } catch {
    return null;
  }
}

/**
 * Verify a payment proof on-chain (USDG on Robinhood Chain)
 */
export async function verifyPaymentOnChain(
  proof: X402PaymentProof,
  expectedAmount: bigint,
  expectedRecipient: Address
): Promise<boolean> {
  const result = await verifyUsdgPayment({
    txHash: proof.txHash,
    expectedRecipient,
    expectedAmount,
    expectedFrom: proof.from,
    chainId: buildManifest().chainId,
  });
  return result.ok;
}

/**
 * Format USDG amount for display (6 decimals)
 */
export function formatUsdg(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const frac = (amount % 1_000_000n).toString().padStart(6, '0');
  return `${whole}.${frac.slice(0, 2)} USDG`;
}

/** @deprecated Use formatUsdg */
export const formatUsdc = formatUsdg;
