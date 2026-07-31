/**
 * BidWall read + event subscription helpers
 */
import {
  type Address,
  type Log,
  type WatchContractEventReturnType,
} from 'viem';
import { publicClient, createWebSocketClient } from './client';
import { activeChain } from './chains';
import { BIDWALL_ABI, getContractAddresses } from './contracts';

export interface BidWallStats {
  ethBalance: bigint;
  totalEthIn: bigint;
  totalAxaiBought: bigint;
  poolFee: number;
  minBuyAmount: bigint;
  contractAddress: Address;
  chainId: number;
}

export interface BidWallEvent {
  type: 'EthReceived' | 'BuybackExecuted';
  txHash: `0x${string}`;
  blockNumber: bigint;
  from?: Address;
  amount?: bigint;
  ethSpent?: bigint;
  axaiBought?: bigint;
  timestamp?: bigint;
}

export async function getBidWallStats(chainId?: number): Promise<BidWallStats> {
  const id = chainId ?? activeChain.id;
  const { bidWall } = getContractAddresses(id);
  if (bidWall === '0x0000000000000000000000000000000000000000') {
    return {
      ethBalance: 0n,
      totalEthIn: 0n,
      totalAxaiBought: 0n,
      poolFee: 0,
      minBuyAmount: 0n,
      contractAddress: bidWall,
      chainId: id,
    };
  }

  const [ethBalance, totalEthIn, totalAxaiBought, poolFee, minBuyAmount] =
    await publicClient.readContract({
      address: bidWall,
      abi: BIDWALL_ABI,
      functionName: 'getStats',
    });

  return {
    ethBalance,
    totalEthIn,
    totalAxaiBought,
    poolFee: Number(poolFee),
    minBuyAmount,
    contractAddress: bidWall,
    chainId: id,
  };
}

export async function getRecentBidWallEvents(
  limit = 50,
  chainId?: number
): Promise<BidWallEvent[]> {
  const id = chainId ?? activeChain.id;
  const { bidWall } = getContractAddresses(id);
  if (bidWall === '0x0000000000000000000000000000000000000000') return [];

  const latest = await publicClient.getBlockNumber();
  const fromBlock = latest > 5000n ? latest - 5000n : 0n;

  const [received, buybacks] = await Promise.all([
    publicClient.getContractEvents({
      address: bidWall,
      abi: BIDWALL_ABI,
      eventName: 'EthReceived',
      fromBlock,
      toBlock: latest,
    }),
    publicClient.getContractEvents({
      address: bidWall,
      abi: BIDWALL_ABI,
      eventName: 'BuybackExecuted',
      fromBlock,
      toBlock: latest,
    }),
  ]);

  const mapped: BidWallEvent[] = [
    ...received.map((log: Log) => {
      const args = (log as { args?: { from?: Address; amount?: bigint } }).args ?? {};
      return {
        type: 'EthReceived' as const,
        txHash: log.transactionHash!,
        blockNumber: log.blockNumber ?? 0n,
        ...(args.from !== undefined ? { from: args.from } : {}),
        ...(args.amount !== undefined ? { amount: args.amount } : {}),
      };
    }),
    ...buybacks.map((log: Log) => {
      const args =
        (
          log as {
            args?: {
              ethSpent?: bigint;
              axaiBought?: bigint;
              timestamp?: bigint;
            };
          }
        ).args ?? {};
      return {
        type: 'BuybackExecuted' as const,
        txHash: log.transactionHash!,
        blockNumber: log.blockNumber ?? 0n,
        ...(args.ethSpent !== undefined ? { ethSpent: args.ethSpent } : {}),
        ...(args.axaiBought !== undefined ? { axaiBought: args.axaiBought } : {}),
        ...(args.timestamp !== undefined ? { timestamp: args.timestamp } : {}),
      };
    }),
  ];

  mapped.sort((a, b) => (a.blockNumber < b.blockNumber ? 1 : -1));
  return mapped.slice(0, limit);
}

export function subscribeToBidWallEvents(
  onEvent: (event: BidWallEvent) => void,
  chainId?: number
): WatchContractEventReturnType {
  const id = chainId ?? activeChain.id;
  const { bidWall } = getContractAddresses(id);
  const ws = createWebSocketClient();

  const unEth = ws.watchContractEvent({
    address: bidWall,
    abi: BIDWALL_ABI,
    eventName: 'EthReceived',
    onLogs: (logs) => {
      for (const log of logs) {
        const args = (log as { args?: { from?: Address; amount?: bigint } }).args ?? {};
        onEvent({
          type: 'EthReceived',
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber ?? 0n,
          ...(args.from !== undefined ? { from: args.from } : {}),
          ...(args.amount !== undefined ? { amount: args.amount } : {}),
        });
      }
    },
  });

  const unBuy = ws.watchContractEvent({
    address: bidWall,
    abi: BIDWALL_ABI,
    eventName: 'BuybackExecuted',
    onLogs: (logs) => {
      for (const log of logs) {
        const args =
          (
            log as {
              args?: {
                ethSpent?: bigint;
                axaiBought?: bigint;
                timestamp?: bigint;
              };
            }
          ).args ?? {};
        onEvent({
          type: 'BuybackExecuted',
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber ?? 0n,
          ...(args.ethSpent !== undefined ? { ethSpent: args.ethSpent } : {}),
          ...(args.axaiBought !== undefined ? { axaiBought: args.axaiBought } : {}),
          ...(args.timestamp !== undefined ? { timestamp: args.timestamp } : {}),
        });
      }
    },
  });

  return () => {
    unEth();
    unBuy();
  };
}
