/**
 * AgentPassport helpers — soulbound identity on Robinhood Chain
 */
import { type Address, type WalletClient, type Account, type Chain, type Transport } from 'viem';
import { publicClient } from './client';
import { activeChain } from './chains';
import { AGENT_PASSPORT_ABI, getContractAddresses } from './contracts';

export interface PassportInfo {
  tokenId: bigint;
  owner: Address;
  uri: string;
}

export async function hasPassport(
  account: Address,
  chainId?: number
): Promise<boolean> {
  const { agentPassport } = getContractAddresses(chainId ?? activeChain.id);
  if (agentPassport === '0x0000000000000000000000000000000000000000') return false;
  return publicClient.readContract({
    address: agentPassport,
    abi: AGENT_PASSPORT_ABI,
    functionName: 'hasPassport',
    args: [account],
  });
}

export async function getPassportByOperator(
  operator: Address,
  chainId?: number
): Promise<PassportInfo | null> {
  const { agentPassport } = getContractAddresses(chainId ?? activeChain.id);
  if (agentPassport === '0x0000000000000000000000000000000000000000') return null;
  try {
    const [tokenId, owner, uri] = await publicClient.readContract({
      address: agentPassport,
      abi: AGENT_PASSPORT_ABI,
      functionName: 'getPassportByOperator',
      args: [operator],
    });
    return { tokenId, owner, uri };
  } catch {
    return null;
  }
}

export async function mintPassport(
  walletClient: WalletClient<Transport, Chain, Account>,
  to: Address,
  operator: Address,
  uri: string,
  chainId?: number
): Promise<`0x${string}`> {
  const { agentPassport } = getContractAddresses(chainId ?? activeChain.id);
  if (agentPassport === '0x0000000000000000000000000000000000000000') {
    throw new Error('AGENT_PASSPORT_CONTRACT_ADDRESS is not configured');
  }
  const account = walletClient.account;
  if (!account) throw new Error('Wallet client has no account');

  const hash = await walletClient.writeContract({
    address: agentPassport,
    abi: AGENT_PASSPORT_ABI,
    functionName: 'mint',
    args: [to, operator, uri],
    account,
    chain: walletClient.chain ?? activeChain,
  });
  return hash;
}
