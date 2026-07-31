/**
 * @xiom/x402 payment helpers — Robinhood Chain + USDG
 *
 * On-chain verification is delegated to @xiom/blockchain verifyUsdgPayment.
 * Replay prevention (duplicate txHash → 409) lives in apps/api agent-access claim.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hash } from 'viem';

const TX = ('0x' + 'cd'.repeat(32)) as Hash;
const FROM = '0x2222222222222222222222222222222222222222' as Address;
const TO = '0x3333333333333333333333333333333333333333' as Address;

const verifyUsdgPayment = vi.fn();

vi.mock('@xiom/blockchain', () => ({
  verifyUsdgPayment: (...args: unknown[]) => verifyUsdgPayment(...args),
}));

import {
  buildPaymentRequired,
  formatUsdg,
  parsePaymentHeader,
  verifyPaymentOnChain,
  buildManifest,
} from '../src/index.js';

describe('x402 payment helpers', () => {
  beforeEach(() => {
    verifyUsdgPayment.mockReset();
  });

  it('buildPaymentRequired uses robinhood_chain + USDG', () => {
    const res = buildPaymentRequired(1_000_000n, '/api/agent-access/claim', TO, 'starter plan');
    expect(res.status).toBe(402);
    expect(res.body.network).toBe('robinhood_chain');
    expect(res.headers['X-Payment-Network']).toBe('robinhood_chain');
    expect(res.headers['X-Payment-Currency']).toBe('USDG');
    expect(res.headers['X-Payment-Recipient']).toBe(TO);
  });

  it('formatUsdg formats 6-decimal amounts', () => {
    expect(formatUsdg(10_500_000n)).toBe('10.50 USDG');
  });

  it('parsePaymentHeader returns null on invalid JSON', () => {
    expect(parsePaymentHeader('not-json')).toBeNull();
  });

  it('verifyPaymentOnChain returns true for valid mocked payment', async () => {
    verifyUsdgPayment.mockResolvedValue({
      ok: true,
      amount: 10_000_000n,
      from: FROM,
      to: TO,
    });

    const ok = await verifyPaymentOnChain(
      {
        txHash: TX,
        from: FROM,
        amount: '10.00',
        timestamp: new Date().toISOString(),
      },
      10_000_000n,
      TO
    );
    expect(ok).toBe(true);
    expect(verifyUsdgPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        txHash: TX,
        expectedRecipient: TO,
        expectedAmount: 10_000_000n,
        expectedFrom: FROM,
        chainId: buildManifest().chainId,
      })
    );
  });

  it('verifyPaymentOnChain returns false for wrong recipient / failed verification', async () => {
    verifyUsdgPayment.mockResolvedValue({
      ok: false,
      amount: 0n,
      from: null,
      to: null,
      reason: 'No matching USDG Transfer event found',
    });

    const ok = await verifyPaymentOnChain(
      {
        txHash: TX,
        from: FROM,
        amount: '10.00',
        timestamp: new Date().toISOString(),
      },
      10_000_000n,
      TO
    );
    expect(ok).toBe(false);
  });

  it('verifyPaymentOnChain returns false for insufficient amount', async () => {
    verifyUsdgPayment.mockResolvedValue({
      ok: false,
      amount: 1_000_000n,
      from: FROM,
      to: TO,
      reason: 'Amount 1000000 < expected 10000000',
    });

    const ok = await verifyPaymentOnChain(
      {
        txHash: TX,
        from: FROM,
        amount: '10.00',
        timestamp: new Date().toISOString(),
      },
      10_000_000n,
      TO
    );
    expect(ok).toBe(false);
  });

  it('documents replay prevention at API layer (no markTxHashUsed in x402)', () => {
    // x402 package verifies a single receipt; apps/api claim route returns 409 DUPLICATE_TX
    // when agent_access_claims.transaction_hash is already used.
    expect(typeof verifyPaymentOnChain).toBe('function');
  });
});
