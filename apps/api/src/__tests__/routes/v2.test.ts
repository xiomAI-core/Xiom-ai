/**
 * Integration tests — /api/v2 auth envelopes + guardrail + quota
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { mockDb, queryChain, resetMockDb } from '../helpers/mock-db.js';

vi.mock('../../lib/db.js', () => ({ db: mockDb }));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-key'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { app } from '../../app.js';

const JWT_SECRET = new TextEncoder().encode(
  process.env['JWT_SECRET'] ?? 'dev-secret-32-bytes-minimum-length-here'
);

async function mintJwt(sub = '0x2222222222222222222222222222222222222222') {
  return new SignJWT({ planId: 'starter' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JWT_SECRET);
}

describe('/api/v2 auth', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('no auth → 401 UNAUTHORIZED envelope', async () => {
    const res = await app.request('/api/v2/guardrail/rules');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: 'Missing authentication credential',
      code: 'UNAUTHORIZED',
    });
  });

  it('valid JWT → 200', async () => {
    const token = await mintJwt();
    const res = await app.request('/api/v2/guardrail/rules', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rules).toEqual([]);
  });

  it('guardrail/check → GuardianResult', async () => {
    const token = await mintJwt();
    const res = await app.request('/api/v2/guardrail/check', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'email.send', agent: 'agent-1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.allowed).toBe('boolean');
    expect(body.reason).toEqual(expect.any(String));
    expect(Array.isArray(body.violatedRules)).toBe(true);
    expect(body.dryRun).toBe(true);
  });

  it('quota exceeded → 429', async () => {
    mockDb.select.mockReturnValue(
      queryChain([
        {
          id: 'cred-1',
          humanId: '0x2222222222222222222222222222222222222222',
          apiKeyHash: 'hashed',
          isActive: true,
          expiresAt: new Date(Date.now() + 86_400_000),
          usedToday: 1000,
          dailyQuota: 1000,
          planId: 'starter',
        },
      ])
    );

    const res = await app.request('/api/v2/guardrail/rules', {
      headers: { 'X-Api-Key': 'XIOM-testkey' },
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: false,
      error: 'Daily quota exceeded',
      code: 'QUOTA_EXCEEDED',
    });
  });
});
