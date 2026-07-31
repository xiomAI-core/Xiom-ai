/**
 * x402 USDG payment protocol service (Robinhood Chain)
 */
import { buildPaymentRequired, verifyPaymentOnChain, parsePaymentHeader } from '@xiom/x402';

export interface X402PaymentRequest {
  amount: bigint;
  recipient: `0x${string}`;
  memo?: string;
}

export interface X402PaymentResult {
  txHash: `0x${string}` | null;
  success: boolean;
  amount: bigint;
}

export async function createPaymentRequest(req: X402PaymentRequest): Promise<string> {
  const built = buildPaymentRequired(
    req.amount,
    req.memo ?? '/api',
    req.recipient,
    req.memo
  );
  return JSON.stringify(built.body);
}

export async function verifyPayment(paymentHeader: string): Promise<X402PaymentResult> {
  const proof = parsePaymentHeader(paymentHeader);
  if (!proof) {
    return { txHash: null, success: false, amount: 0n };
  }
  const treasury = (process.env['XIOM_TREASURY_ADDRESS'] ??
    '0x0000000000000000000000000000000000000000') as `0x${string}`;
  const amount = BigInt(proof.amount);
  const ok = await verifyPaymentOnChain(proof, amount, treasury);
  return {
    txHash: ok ? proof.txHash : null,
    success: ok,
    amount,
  };
}
