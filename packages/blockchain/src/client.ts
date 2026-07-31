/**
 * viem clients for Robinhood Chain — Alchemy primary, public RPC fallback
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  fallback,
  type HttpTransport,
  type Transport,
  type WalletClient,
  type PublicClient,
  type Account,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { activeChain, robinhoodChain, type ActiveChain } from './chains';

function alchemyHttpUrl(): string | undefined {
  const key = process.env['RH_ALCHEMY_KEY'] ?? process.env['NEXT_PUBLIC_RH_ALCHEMY_KEY'];
  if (!key) return undefined;
  // Placeholder Alchemy RH URL pattern — override via RH_RPC_URL when known
  return process.env['RH_ALCHEMY_RPC_URL'] ?? `https://robinhood-mainnet.g.alchemy.com/v2/${key}`;
}

function buildHttpTransport(): Transport {
  const alchemy = alchemyHttpUrl();
  const publicUrl =
    process.env['RH_RPC_URL'] ??
    process.env['NEXT_PUBLIC_RH_RPC_URL'] ??
    activeChain.rpcUrls.default.http[0] ??
    'https://rpc.robinhoodchain.com';

  if (alchemy) {
    return fallback([http(alchemy, { retryCount: 2 }), http(publicUrl, { retryCount: 3 })]);
  }
  return http(publicUrl, { retryCount: 3 });
}

export type XiomPublicClient = PublicClient<Transport, ActiveChain>;

/** Shared read-only client (Alchemy + public fallback) */
export const publicClient: XiomPublicClient = createPublicClient({
  chain: activeChain,
  transport: buildHttpTransport(),
}) as XiomPublicClient;

/**
 * Create a signer wallet client from XIOM_SIGNER_PRIVATE_KEY (server-side only)
 */
export function signerWalletClient(): WalletClient<Transport, ActiveChain, Account> {
  const key = process.env['XIOM_SIGNER_PRIVATE_KEY'];
  if (!key) {
    throw new Error('XIOM_SIGNER_PRIVATE_KEY is not set');
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  return createWalletClient({
    account,
    chain: activeChain,
    transport: buildHttpTransport(),
  }) as WalletClient<Transport, ActiveChain, Account>;
}

/**
 * WebSocket client for event subscriptions
 */
export function createWebSocketClient(): PublicClient<Transport, ActiveChain> {
  const wsUrl =
    process.env['RH_WS_URL'] ??
    process.env['NEXT_PUBLIC_RH_WS_URL'] ??
    activeChain.rpcUrls.default.webSocket?.[0] ??
    'wss://rpc.robinhoodchain.com';

  return createPublicClient({
    chain: activeChain,
    transport: webSocket(wsUrl),
  }) as PublicClient<Transport, ActiveChain>;
}

function explorerBase(chainId?: number): string {
  const id = chainId ?? activeChain.id;
  if (id === robinhoodChain.id) {
    return (
      process.env['BLOCKSCOUT_URL'] ??
      process.env['NEXT_PUBLIC_BLOCKSCOUT_URL'] ??
      'https://explorer.robinhoodchain.com'
    );
  }
  return (
    process.env['BLOCKSCOUT_TESTNET_URL'] ??
    process.env['NEXT_PUBLIC_BLOCKSCOUT_TESTNET_URL'] ??
    'https://explorer.testnet.robinhoodchain.com'
  );
}

export function getTxUrl(txHash: `0x${string}`, chainId?: number): string {
  return `${explorerBase(chainId)}/tx/${txHash}`;
}

export function getAddressUrl(address: `0x${string}`, chainId?: number): string {
  return `${explorerBase(chainId)}/address/${address}`;
}

/** Explicit typed helper to avoid TS7056 on deeply nested viem generics */
export function createRhPublicClient(
  chain: Chain = activeChain,
  rpcUrl?: string
): PublicClient<HttpTransport, Chain> {
  return createPublicClient({
    chain,
    transport: http(rpcUrl ?? chain.rpcUrls.default.http[0], { retryCount: 3 }),
  }) as PublicClient<HttpTransport, Chain>;
}
