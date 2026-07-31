'use client';

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { CHAIN_IDS } from '@xiom/blockchain';
import { truncateAddress } from '@/lib/utils';

export default function WalletButton() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const wrongNetwork =
    isConnected &&
    chainId !== CHAIN_IDS.robinhood &&
    chainId !== CHAIN_IDS.robinhoodTestnet;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {wrongNetwork && (
          <button
            type="button"
            onClick={() => switchChain?.({ chainId: CHAIN_IDS.robinhood })}
            className="px-3 py-1.5 text-xs tracking-wider uppercase border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 transition-colors"
          >
            Switch to RH Chain
          </button>
        )}
        <button
          type="button"
          onClick={() => disconnect()}
          className="px-3 py-1.5 text-xs font-mono tracking-wider border border-white/20 hover:border-white/50 hover:bg-white/5 transition-all"
          title={address}
        >
          {truncateAddress(address)}
        </button>
      </div>
    );
  }

  const injected = connectors.find((c) => c.id === 'injected') ?? connectors[0];

  return (
    <button
      type="button"
      disabled={isConnecting || isPending || !injected}
      onClick={() => injected && connect({ connector: injected })}
      className="px-4 py-2 text-xs font-medium tracking-wider uppercase border border-white/20 hover:border-white/50 hover:bg-white/5 transition-all disabled:opacity-40"
    >
      {isConnecting || isPending ? 'Connecting…' : 'Connect Wallet'}
    </button>
  );
}
