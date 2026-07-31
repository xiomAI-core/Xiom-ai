'use client';

import { CHAIN_IDS, robinhoodChain } from '@xiom/blockchain';

/**
 * Prompts the injected wallet to add Robinhood Chain (EIP-3085)
 */
export default function AddNetworkButton() {
  async function addNetwork() {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('No EIP-1193 wallet found');
      return;
    }

    const rpc =
      process.env['NEXT_PUBLIC_RH_RPC_URL'] ??
      robinhoodChain.rpcUrls.default.http[0] ??
      'https://rpc.robinhoodchain.com';
    const explorer =
      process.env['NEXT_PUBLIC_BLOCKSCOUT_URL'] ??
      robinhoodChain.blockExplorers?.default.url ??
      'https://explorer.robinhoodchain.com';

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${CHAIN_IDS.robinhood.toString(16)}`,
            chainName: 'Robinhood Chain',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [rpc],
            blockExplorerUrls: [explorer],
          },
        ],
      });
    } catch (err) {
      console.error('Failed to add Robinhood Chain', err);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void addNetwork()}
      className="px-3 py-1.5 text-xs tracking-wider uppercase border border-white/20 hover:border-white/50 hover:bg-white/5 transition-all"
    >
      Add Robinhood Chain
    </button>
  );
}
