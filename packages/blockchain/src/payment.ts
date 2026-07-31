/**
 * USDG payment verification on Robinhood Chain (replaces USDC on Base)
 */
import {
  decodeEventLog,
  type Address,
  type Hash,
  type Log,
} from 'viem';
import { publicClient } from './client';
import { activeChain, CHAIN_IDS } from './chains';
import { USDG_ABI, getContractAddresses } from './contracts';
import { parseUsdg } from './tokens';

export interface VerifyUsdgPaymentParams {
  txHash: Hash;
  expectedRecipient: Address;
  /** Human-readable USDG amount (e.g. "10.00") or raw bigint */
  expectedAmount: string | bigint;
  expectedFrom?: Address;
  chainId?: number;
}

export interface VerifyUsdgPaymentResult {
  ok: boolean;
  amount: bigint;
  from: Address | null;
  to: Address | null;
  reason?: string;
}

export async function verifyUsdgPayment(
  params: VerifyUsdgPaymentParams
): Promise<VerifyUsdgPaymentResult> {
  const chainId = params.chainId ?? activeChain.id;
  if (chainId !== CHAIN_IDS.robinhood && chainId !== CHAIN_IDS.robinhoodTestnet) {
    return {
      ok: false,
      amount: 0n,
      from: null,
      to: null,
      reason: `Unsupported chainId ${chainId}; expected Robinhood Chain`,
    };
  }

  const { usdg } = getContractAddresses(chainId);
  if (usdg === '0x0000000000000000000000000000000000000000') {
    return {
      ok: false,
      amount: 0n,
      from: null,
      to: null,
      reason: 'USDG_ADDRESS is not configured',
    };
  }

  const expectedAmount =
    typeof params.expectedAmount === 'bigint'
      ? params.expectedAmount
      : parseUsdg(params.expectedAmount);

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: params.txHash });
  } catch {
    return {
      ok: false,
      amount: 0n,
      from: null,
      to: null,
      reason: 'Transaction not found on Robinhood Chain',
    };
  }

  if (receipt.status !== 'success') {
    return {
      ok: false,
      amount: 0n,
      from: null,
      to: null,
      reason: 'Transaction reverted',
    };
  }

  for (const log of receipt.logs as Log[]) {
    if (log.address.toLowerCase() !== usdg.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: USDG_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== 'Transfer') continue;
      const args = decoded.args as { from: Address; to: Address; value: bigint };
      if (args.to.toLowerCase() !== params.expectedRecipient.toLowerCase()) continue;
      if (
        params.expectedFrom &&
        args.from.toLowerCase() !== params.expectedFrom.toLowerCase()
      ) {
        continue;
      }
      if (args.value < expectedAmount) {
        return {
          ok: false,
          amount: args.value,
          from: args.from,
          to: args.to,
          reason: `Amount ${args.value} < expected ${expectedAmount}`,
        };
      }
      return { ok: true, amount: args.value, from: args.from, to: args.to };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    amount: 0n,
    from: null,
    to: null,
    reason: 'No matching USDG Transfer event found',
  };
}
