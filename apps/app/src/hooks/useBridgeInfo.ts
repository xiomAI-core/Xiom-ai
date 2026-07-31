'use client';

import { useQuery } from '@tanstack/react-query';
import { CHAIN_IDS, getEthUsdPrice } from '@xiom/blockchain';

export interface BridgeInfo {
  chainId: number;
  chainName: string;
  nativeSymbol: 'ETH';
  stablecoin: 'USDG';
  ethUsd: number;
  bridgeUrl: string;
  explorerUrl: string;
}

export function useBridgeInfo() {
  return useQuery({
    queryKey: ['bridge-info'],
    queryFn: async (): Promise<BridgeInfo> => {
      const ethUsd = await getEthUsdPrice();
      return {
        chainId: CHAIN_IDS.robinhood,
        chainName: 'Robinhood Chain',
        nativeSymbol: 'ETH',
        stablecoin: 'USDG',
        ethUsd,
        bridgeUrl:
          process.env['NEXT_PUBLIC_RH_BRIDGE_URL'] ?? 'https://bridge.robinhoodchain.com',
        explorerUrl:
          process.env['NEXT_PUBLIC_BLOCKSCOUT_URL'] ??
          'https://explorer.robinhoodchain.com',
      };
    },
    staleTime: 120_000,
  });
}
