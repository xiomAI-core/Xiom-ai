/**
 * Wagmi config — Robinhood Chain primary for XIOM
 */
'use client';

import { http, createConfig, fallback, type Config } from 'wagmi';
import { injected, walletConnect } from '@/lib/wagmi-connectors';
import {
  robinhoodChain,
  robinhoodChainTestnet,
  CHAIN_IDS,
} from '@xiom/blockchain/chains';
import { APP_URL } from '@/lib/urls';

const projectId =
  process.env['NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID'] ?? 'xiom-placeholder-wc-id';

const alchemyKey = process.env['NEXT_PUBLIC_RH_ALCHEMY_KEY'];
const publicRpc =
  process.env['NEXT_PUBLIC_RH_RPC_URL'] ?? 'https://rpc.robinhoodchain.com';
const alchemyRpc = alchemyKey
  ? (process.env['NEXT_PUBLIC_RH_ALCHEMY_RPC_URL'] ??
    `https://robinhood-mainnet.g.alchemy.com/v2/${alchemyKey}`)
  : undefined;

const mainnetTransport = alchemyRpc
  ? fallback([http(alchemyRpc), http(publicRpc)])
  : http(publicRpc);

export const wagmiConfig: Config = createConfig({
  chains: [robinhoodChain, robinhoodChainTestnet],
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId,
      metadata: {
        name: 'XIOM',
        description: 'XIOM — Personal AI Operating System',
        url: APP_URL,
        icons: ['https://xiom-ai.com/icon.png'],
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [CHAIN_IDS.robinhood]: mainnetTransport,
    [CHAIN_IDS.robinhoodTestnet]: http(
      process.env['NEXT_PUBLIC_RH_TESTNET_RPC_URL'] ??
        'https://rpc.testnet.robinhoodchain.com'
    ),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: Config;
  }
}
