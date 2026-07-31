/**
 * Cryptographic helpers — SHA-256 hashing and API key generation
 */
import { createHash, randomBytes } from 'node:crypto';

export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function generateApiKey(): string {
  return `XIOM-${randomBytes(32).toString('hex')}`;
}

export function generateNonce(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}
