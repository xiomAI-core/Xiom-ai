/**
 * Cryptographic receipts service
 */
import { createHash } from 'crypto';

export interface Receipt {
  id: string;
  action: string;
  agent?: string;
  allowed: boolean;
  hash: string;
  timestamp: string;
  signature?: string;
}

export function issueReceipt(action: string, allowed: boolean, agent?: string): Receipt {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify({ id, action, allowed, agent, timestamp });
  const hash = createHash('sha256').update(payload).digest('hex');

  // `exactOptionalPropertyTypes` forbids assigning `undefined` to an optional
  // key, so spread `agent` only when it is actually provided.
  return {
    id,
    action,
    ...(agent !== undefined ? { agent } : {}),
    allowed,
    hash,
    timestamp,
  };
}

export async function anchorToChain(receipt: Receipt): Promise<`0x${string}` | null> {
  // TODO: submit receipt hash to Base L2 via viem
  const _ = receipt;
  return null;
}
