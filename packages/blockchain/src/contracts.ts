/**
 * Contract ABIs and address resolution for Robinhood Chain
 */
import { parseAbi, type Address } from 'viem';
import { CHAIN_IDS } from './chains';

const ZERO = '0x0000000000000000000000000000000000000000' as Address;

export const USDG_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

export const ERC20_ABI = USDG_ABI;

export const BIDWALL_ABI = parseAbi([
  'function deposit() payable',
  'function executeBuyback(uint256 amountIn, uint256 amountOutMinimum) returns (uint256 amountOut)',
  'function getStats() view returns (uint256 ethBalance, uint256 totalEthIn, uint256 totalAxaiBought, uint24 poolFee, uint256 minBuyAmount)',
  'function treasury() view returns (address)',
  'function axai() view returns (address)',
  'function pause()',
  'function unpause()',
  'event EthReceived(address indexed from, uint256 amount)',
  'event BuybackExecuted(address indexed caller, uint256 ethSpent, uint256 axaiBought, uint256 timestamp)',
]);

export const AGENT_PASSPORT_ABI = parseAbi([
  'function mint(address to, address operator, string uri) returns (uint256 tokenId)',
  'function bindOperator(uint256 tokenId, address operator)',
  'function burn(uint256 tokenId)',
  'function hasPassport(address account) view returns (bool)',
  'function getPassportByOperator(address operator) view returns (uint256 tokenId, address owner, string uri)',
  'function operatorOf(uint256 tokenId) view returns (address)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'event PassportMinted(address indexed to, address indexed operator, uint256 indexed tokenId, string uri)',
]);

export const AXAI_ABI = USDG_ABI;

export interface ContractAddresses {
  usdg: Address;
  axai: Address;
  bidWall: Address;
  agentPassport: Address;
  paymaster: Address;
  weth: Address;
  swapRouter: Address;
  treasury: Address;
  entryPoint: Address;
}

const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;

function envAddress(key: string, fallback: Address = ZERO): Address {
  const v = process.env[key] ?? process.env[`NEXT_PUBLIC_${key}`];
  if (!v || v === '') return fallback;
  return v as Address;
}

const MAINNET_DEFAULTS: ContractAddresses = {
  usdg: envAddress('USDG_ADDRESS'),
  axai: envAddress('XIOM_TOKEN_ADDRESS'),
  bidWall: envAddress('BIDWALL_CONTRACT_ADDRESS'),
  agentPassport: envAddress('AGENT_PASSPORT_CONTRACT_ADDRESS'),
  paymaster: envAddress('AXIOM_PAYMASTER_ADDRESS'),
  weth: envAddress('RH_WETH_ADDRESS'),
  swapRouter: envAddress('RH_SWAP_ROUTER'),
  treasury: envAddress('XIOM_TREASURY_ADDRESS'),
  entryPoint: ENTRY_POINT_V07,
};

const TESTNET_DEFAULTS: ContractAddresses = {
  usdg: envAddress('USDG_TESTNET_ADDRESS', MAINNET_DEFAULTS.usdg),
  axai: envAddress('XIOM_TOKEN_TESTNET_ADDRESS', MAINNET_DEFAULTS.axai),
  bidWall: envAddress('BIDWALL_TESTNET_ADDRESS', MAINNET_DEFAULTS.bidWall),
  agentPassport: envAddress(
    'AGENT_PASSPORT_TESTNET_ADDRESS',
    MAINNET_DEFAULTS.agentPassport
  ),
  paymaster: envAddress('AXIOM_PAYMASTER_TESTNET_ADDRESS', MAINNET_DEFAULTS.paymaster),
  weth: envAddress('RH_WETH_TESTNET_ADDRESS', MAINNET_DEFAULTS.weth),
  swapRouter: envAddress('RH_SWAP_ROUTER_TESTNET', MAINNET_DEFAULTS.swapRouter),
  treasury: envAddress('XIOM_TREASURY_ADDRESS', MAINNET_DEFAULTS.treasury),
  entryPoint: ENTRY_POINT_V07,
};

export function getContractAddresses(chainId: number): ContractAddresses {
  if (chainId === CHAIN_IDS.robinhoodTestnet) return { ...TESTNET_DEFAULTS };
  return { ...MAINNET_DEFAULTS };
}

/** @deprecated Prefer getContractAddresses(chainId) */
export const CONTRACTS = {
  XIOM_TOKEN: MAINNET_DEFAULTS.axai,
  AXAI: MAINNET_DEFAULTS.axai,
  BIDWALL: MAINNET_DEFAULTS.bidWall,
  AGENT_PASSPORT: MAINNET_DEFAULTS.agentPassport,
  USDG: MAINNET_DEFAULTS.usdg,
  PAYMASTER: MAINNET_DEFAULTS.paymaster,
  WETH: MAINNET_DEFAULTS.weth,
  ENTRY_POINT: ENTRY_POINT_V07,
} as const;
