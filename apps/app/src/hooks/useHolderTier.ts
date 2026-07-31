'use client';

import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { getAxaiBalance, getHolderTier, type HolderTier } from '@xiom/blockchain';

export interface UseHolderTierResult {
  tier: HolderTier;
  balance: bigint;
  isLoading: boolean;
  isError: boolean;
}

export function useHolderTier(): UseHolderTierResult {
  const { address, isConnected } = useAccount();

  const query = useQuery({
    queryKey: ['holder-tier', address],
    enabled: Boolean(isConnected && address),
    queryFn: async () => {
      if (!address) return { tier: 'none' as const, balance: 0n };
      const balance = await getAxaiBalance(address);
      return { tier: getHolderTier(balance), balance };
    },
    staleTime: 60_000,
  });

  return {
    tier: query.data?.tier ?? 'none',
    balance: query.data?.balance ?? 0n,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
