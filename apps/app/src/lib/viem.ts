/**
 * App-local viem helpers — Robinhood Chain (prefer @xiom/blockchain exports)
 */
import { createWalletClient, custom, type CustomTransport, type WalletClient, type Account } from 'viem';
import { publicClient, activeChain, type ActiveChain } from '@xiom/blockchain';

export { publicClient, activeChain };

export function getWalletClient(): WalletClient<CustomTransport, ActiveChain, Account> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet provider found');
  }
  return createWalletClient({
    chain: activeChain,
    transport: custom(window.ethereum),
  }) as WalletClient<CustomTransport, ActiveChain, Account>;
}
