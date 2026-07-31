/**
 * ZeroDev session-key / ERC-4337 helpers for Robinhood Chain.
 *
 * Optional deps: @zerodev/sdk, @zerodev/ecdsa-validator
 * Install when ready: pnpm --filter @xiom/blockchain add @zerodev/sdk @zerodev/ecdsa-validator
 *
 * Until those packages are present, helpers throw a clear error or return stubs.
 */
import type { Address, Hex } from 'viem';
import { CHAIN_IDS } from './chains';
import { getContractAddresses } from './contracts';

export const ENTRY_POINT_V07 =
  '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const;

export interface SessionKeyConfig {
  owner: Address;
  /** Session public key / validator address */
  sessionKeyAddress: Address;
  /** Permissions encoded as bytes (ZeroDev permission plugin) */
  permissions?: Hex;
  validUntil?: number;
  validAfter?: number;
  chainId?: number;
}

export interface KernelAccountHandle {
  address: Address;
  entryPoint: typeof ENTRY_POINT_V07;
  chainId: number;
  /** True when ZeroDev SDK is available and wired */
  ready: boolean;
}

function zerodevProjectId(): string | undefined {
  return process.env['ZERODEV_PROJECT_ID'] ?? process.env['NEXT_PUBLIC_ZERODEV_PROJECT_ID'];
}

/**
 * Soft-detect ZeroDev SDK. Returns null when packages are not installed.
 */
export async function tryLoadZeroDev(): Promise<{
  createKernelAccount: unknown;
  createKernelAccountClient: unknown;
} | null> {
  try {
    // Dynamic import — fails gracefully when optional deps are missing
    const sdk = await import('@zerodev/sdk');
    return {
      createKernelAccount: (sdk as { createKernelAccount?: unknown }).createKernelAccount,
      createKernelAccountClient: (sdk as { createKernelAccountClient?: unknown })
        .createKernelAccountClient,
    };
  } catch {
    return null;
  }
}

/**
 * Create (or describe) a ZeroDev Kernel account for session keys.
 * TODO: wire full ZeroDev Kernel v3 + ECDSA validator once packages resolve.
 */
export async function createSessionKeyAccount(
  config: SessionKeyConfig
): Promise<KernelAccountHandle> {
  const chainId = config.chainId ?? CHAIN_IDS.robinhood;
  const { paymaster, entryPoint } = getContractAddresses(chainId);
  const projectId = zerodevProjectId();
  const zd = await tryLoadZeroDev();

  if (!zd || !projectId) {
    // Stub handle so callers can typecheck / feature-detect
    return {
      address: config.owner,
      entryPoint: ENTRY_POINT_V07,
      chainId,
      ready: false,
    };
  }

  // TODO: implement Kernel account creation with @zerodev/sdk + ecdsa-validator
  // using ENTRY_POINT_V07, paymaster, and session permissions.
  void paymaster;
  void entryPoint;
  void config.permissions;
  void config.validUntil;
  void config.validAfter;

  return {
    address: config.sessionKeyAddress,
    entryPoint: ENTRY_POINT_V07,
    chainId,
    ready: false, // flip to true when ZeroDev wiring is complete
  };
}

/**
 * Send a UserOperation sponsored by AxiomPaymaster (stub until ZeroDev wired).
 */
export async function sendSponsoredUserOp(_params: {
  account: KernelAccountHandle;
  to: Address;
  data: Hex;
  value?: bigint;
}): Promise<HashOrStub> {
  if (!_params.account.ready) {
    throw new Error(
      'ZeroDev session keys not ready. Install @zerodev/sdk / @zerodev/ecdsa-validator and set ZERODEV_PROJECT_ID.'
    );
  }
  throw new Error('TODO: sendSponsoredUserOp — wire ZeroDev Kernel client');
}

export type HashOrStub = `0x${string}`;
