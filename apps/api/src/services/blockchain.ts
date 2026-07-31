/**
 * Blockchain service — viem Robinhood Chain helpers
 */
import {
  publicClient,
  getAxaiBalance,
  getBidWallStats,
  activeChain,
  type XiomPublicClient,
} from '@xiom/blockchain';

export { publicClient, activeChain };
export type { XiomPublicClient };

export async function getXiomBalance(address: `0x${string}`): Promise<bigint> {
  return getAxaiBalance(address);
}

export async function getBidWallState() {
  const stats = await getBidWallStats();
  return {
    totalDeposited: stats.totalEthIn,
    ethBalance: stats.ethBalance,
    totalAxaiBought: stats.totalAxaiBought,
    currentBid: 0n,
    topBidder: null as `0x${string}` | null,
  };
}
