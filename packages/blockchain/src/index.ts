/**
 * @xiom/blockchain
 * Robinhood Chain helpers — shared across API and frontend (replaces Base L2)
 */

export {
  robinhoodChain,
  robinhoodChainTestnet,
  activeChain,
  CHAIN_IDS,
  type XiomChainId,
  type ActiveChain,
} from './chains';

export {
  publicClient,
  signerWalletClient,
  createWebSocketClient,
  createRhPublicClient,
  getTxUrl,
  getAddressUrl,
  type XiomPublicClient,
} from './client';

export {
  USDG_ABI,
  ERC20_ABI,
  BIDWALL_ABI,
  AGENT_PASSPORT_ABI,
  AXAI_ABI,
  CONTRACTS,
  getContractAddresses,
  type ContractAddresses,
} from './contracts';

export {
  getUsdgBalance,
  formatUsdg,
  parseUsdg,
  getEthBalance,
  getAxaiBalance,
  getHolderTier,
  getEthUsdPrice,
  USDG_DECIMALS,
  AXAI_DECIMALS,
  type HolderTier,
} from './tokens';

export {
  getBidWallStats,
  getRecentBidWallEvents,
  subscribeToBidWallEvents,
  type BidWallStats,
  type BidWallEvent,
} from './bidwall';

export {
  hasPassport,
  getPassportByOperator,
  mintPassport,
  type PassportInfo,
} from './passport';

export {
  verifyUsdgPayment,
  type VerifyUsdgPaymentParams,
  type VerifyUsdgPaymentResult,
} from './payment';

export {
  ENTRY_POINT_V07,
  tryLoadZeroDev,
  createSessionKeyAccount,
  sendSponsoredUserOp,
  type SessionKeyConfig,
  type KernelAccountHandle,
} from './account-abstraction';

// Common viem re-exports for consumers
export {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
  formatUnits,
} from 'viem';
