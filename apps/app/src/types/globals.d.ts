/**
 * Global ambient type augmentations for browser APIs not in the default lib.
 */
import type { EIP1193Provider } from 'viem';

declare global {
  interface Window {
    /**
     * EIP-1193 Ethereum provider injected by wallets (e.g. MetaMask).
     * Typed as viem's EIP1193Provider so callers can pass it directly to
     * `createWalletClient({ transport: custom(window.ethereum) })`.
     */
    ethereum?: EIP1193Provider;
  }
}

export {};
