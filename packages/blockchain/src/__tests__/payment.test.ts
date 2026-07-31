/**
 * verifyUsdgPayment — Robinhood Chain + USDG (mocked receipts)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  type Address,
  type Hash,
  type Log,
} from 'viem';
import { USDG_ABI } from '../contracts.js';

const USDG = '0x1111111111111111111111111111111111111111' as Address;
const FROM = '0x2222222222222222222222222222222222222222' as Address;
const TO = '0x3333333333333333333333333333333333333333' as Address;
const OTHER = '0x4444444444444444444444444444444444444444' as Address;
const TX = ('0x' + 'ab'.repeat(32)) as Hash;

vi.mock('../client.js', () => ({
  publicClient: {
    getTransactionReceipt: vi.fn(),
  },
}));

vi.mock('../contracts.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../contracts.js')>();
  return {
    ...actual,
    getContractAddresses: () => ({
      usdg: USDG,
      axai: '0x0000000000000000000000000000000000000000',
      bidWall: '0x0000000000000000000000000000000000000000',
      agentPassport: '0x0000000000000000000000000000000000000000',
      paymaster: '0x0000000000000000000000000000000000000000',
      weth: '0x0000000000000000000000000000000000000000',
      swapRouter: '0x0000000000000000000000000000000000000000',
      treasury: TO,
      entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    }),
  };
});

import { publicClient } from '../client.js';
import { verifyUsdgPayment } from '../payment.js';
import { CHAIN_IDS } from '../chains.js';
import { parseUsdg } from '../tokens.js';

function transferLog(from: Address, to: Address, value: bigint): Log {
  const topics = encodeEventTopics({
    abi: USDG_ABI,
    eventName: 'Transfer',
    args: { from, to },
  }) as [`0x${string}`, ...`0x${string}`[]];
  const data = encodeAbiParameters([{ type: 'uint256' }], [value]);
  return {
    address: USDG,
    data,
    topics,
    blockHash: ('0x' + '11'.repeat(32)) as Hash,
    blockNumber: 1n,
    logIndex: 0,
    transactionHash: TX,
    transactionIndex: 0,
    removed: false,
  };
}

function receipt(logs: Log[], status: 'success' | 'reverted' = 'success') {
  return {
    status,
    logs,
    transactionHash: TX,
    blockNumber: 1n,
  };
}

describe('verifyUsdgPayment (Robinhood Chain + USDG)', () => {
  beforeEach(() => {
    vi.mocked(publicClient.getTransactionReceipt).mockReset();
  });

  it('verifies a valid USDG Transfer to the expected recipient', async () => {
    const amount = parseUsdg('10.00');
    vi.mocked(publicClient.getTransactionReceipt).mockResolvedValue(
      receipt([transferLog(FROM, TO, amount)]) as never
    );

    const result = await verifyUsdgPayment({
      txHash: TX,
      expectedRecipient: TO,
      expectedAmount: '10.00',
      expectedFrom: FROM,
      chainId: CHAIN_IDS.robinhood,
    });

    expect(result.ok).toBe(true);
    expect(result.amount).toBe(amount);
    expect(result.from?.toLowerCase()).toBe(FROM.toLowerCase());
    expect(result.to?.toLowerCase()).toBe(TO.toLowerCase());
  });

  it('returns false when recipient does not match', async () => {
    const amount = parseUsdg('10.00');
    vi.mocked(publicClient.getTransactionReceipt).mockResolvedValue(
      receipt([transferLog(FROM, OTHER, amount)]) as never
    );

    const result = await verifyUsdgPayment({
      txHash: TX,
      expectedRecipient: TO,
      expectedAmount: '10.00',
      expectedFrom: FROM,
      chainId: CHAIN_IDS.robinhood,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/No matching USDG Transfer/i);
  });

  it('returns false when amount is insufficient', async () => {
    vi.mocked(publicClient.getTransactionReceipt).mockResolvedValue(
      receipt([transferLog(FROM, TO, parseUsdg('1.00'))]) as never
    );

    const result = await verifyUsdgPayment({
      txHash: TX,
      expectedRecipient: TO,
      expectedAmount: '10.00',
      expectedFrom: FROM,
      chainId: CHAIN_IDS.robinhood,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/</);
  });

  it('rejects unsupported chainId (not Robinhood)', async () => {
    const result = await verifyUsdgPayment({
      txHash: TX,
      expectedRecipient: TO,
      expectedAmount: '10.00',
      chainId: 8453, // Base — must not be accepted
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Unsupported chainId/i);
  });

  it('accepts Robinhood testnet chainId 46630', async () => {
    const amount = parseUsdg('5.00');
    vi.mocked(publicClient.getTransactionReceipt).mockResolvedValue(
      receipt([transferLog(FROM, TO, amount)]) as never
    );

    const result = await verifyUsdgPayment({
      txHash: TX,
      expectedRecipient: TO,
      expectedAmount: '5.00',
      chainId: CHAIN_IDS.robinhoodTestnet,
    });

    expect(result.ok).toBe(true);
  });
});
