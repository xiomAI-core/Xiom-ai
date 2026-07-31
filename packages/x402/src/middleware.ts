/**
 * Hono middleware for x402 USDG payments on Robinhood Chain
 */
import type { MiddlewareHandler } from 'hono';
import type { Address, Hash } from 'viem';
import { verifyUsdgPayment } from '@xiom/blockchain';
import { buildManifest, X402_VERSION } from './manifest.js';
import type { X402PaymentProof, X402PaymentRequest } from '@xiom/types';

export interface X402MiddlewareOptions {
  /** Human-readable USDG amount required (e.g. "0.10") */
  amount: string;
  resource: string;
  recipient?: Address;
  description?: string;
}

/**
 * Returns 402 with WWW-Authenticate when X-Payment is missing;
 * verifies USDG transfer on Robinhood Chain when present.
 */
export function x402Middleware(options: X402MiddlewareOptions): MiddlewareHandler {
  return async (c, next) => {
    const paymentHeader = c.req.header('X-Payment') ?? c.req.header('x-payment');
    const manifest = buildManifest({
      ...(options.recipient !== undefined ? { recipient: options.recipient } : {}),
    });

    const reqBody: X402PaymentRequest = {
      x402Version: X402_VERSION,
      scheme: 'exact',
      network: 'robinhood_chain',
      maxAmountRequired: options.amount,
      resource: options.resource,
      ...(options.description !== undefined ? { description: options.description } : {}),
    };

    if (!paymentHeader) {
      c.header('WWW-Authenticate', `x402 ${JSON.stringify(reqBody)}`);
      c.header('X-Payment-Recipient', manifest.recipient);
      c.header('X-Payment-Network', 'robinhood_chain');
      c.header('X-Payment-Currency', 'USDG');
      return c.json(reqBody, 402);
    }

    let proof: X402PaymentProof;
    try {
      proof = JSON.parse(paymentHeader) as X402PaymentProof;
    } catch {
      return c.json({ error: 'Invalid X-Payment header', code: 'BAD_PAYMENT' }, 400);
    }

    const result = await verifyUsdgPayment({
      txHash: proof.txHash as Hash,
      expectedRecipient: manifest.recipient,
      expectedAmount: options.amount,
      expectedFrom: proof.from as Address,
      chainId: manifest.chainId,
    });

    if (!result.ok) {
      c.header('WWW-Authenticate', `x402 ${JSON.stringify(reqBody)}`);
      return c.json(
        {
          error: result.reason ?? 'Payment verification failed',
          code: 'PAYMENT_INVALID',
        },
        402
      );
    }

    c.set('x402Payment', result);
    await next();
  };
}
