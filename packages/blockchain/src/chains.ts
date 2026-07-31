/**
 * Robinhood Chain definitions for XIOM
 */
import { defineChain } from 'viem';

export const CHAIN_IDS = {
  robinhood: 4663,
  robinhoodTestnet: 46630,
} as const;

export type XiomChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS];

const ZERO = '0x0000000000000000000000000000000000000000' as const;

/** Robinhood Chain mainnet (chainId 4663) */
export const robinhoodChain = defineChain({
  id: CHAIN_IDS.robinhood,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env['RH_RPC_URL'] ??
          process.env['NEXT_PUBLIC_RH_RPC_URL'] ??
          'https://rpc.robinhoodchain.com',
      ],
      webSocket: [
        process.env['RH_WS_URL'] ??
          process.env['NEXT_PUBLIC_RH_WS_URL'] ??
          'wss://rpc.robinhoodchain.com',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url:
        process.env['BLOCKSCOUT_URL'] ??
        process.env['NEXT_PUBLIC_BLOCKSCOUT_URL'] ??
        'https://explorer.robinhoodchain.com',
    },
  },
  contracts: {
    multicall3: { address: ZERO },
  },
});

/** Robinhood Chain testnet (chainId 46630) */
export const robinhoodChainTestnet = defineChain({
  id: CHAIN_IDS.robinhoodTestnet,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env['RH_TESTNET_RPC_URL'] ??
          process.env['NEXT_PUBLIC_RH_TESTNET_RPC_URL'] ??
          'https://rpc.testnet.robinhoodchain.com',
      ],
      webSocket: [
        process.env['RH_TESTNET_WS_URL'] ??
          process.env['NEXT_PUBLIC_RH_TESTNET_WS_URL'] ??
          'wss://rpc.testnet.robinhoodchain.com',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url:
        process.env['BLOCKSCOUT_TESTNET_URL'] ??
        process.env['NEXT_PUBLIC_BLOCKSCOUT_TESTNET_URL'] ??
        'https://explorer.testnet.robinhoodchain.com',
    },
  },
});

const useTestnet =
  process.env['RH_USE_TESTNET'] === 'true' ||
  process.env['NEXT_PUBLIC_RH_USE_TESTNET'] === 'true';

/** Active chain — mainnet by default; set RH_USE_TESTNET=true for testnet */
export const activeChain = useTestnet ? robinhoodChainTestnet : robinhoodChain;

export type ActiveChain = typeof activeChain;
