/**
 * Integration tests — POST/GET /api/intake (mocked DB, no live Postgres)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { insertChain, mockDb, queryChain, resetMockDb } from '../helpers/mock-db.js';

vi.mock('../../lib/db.js', () => ({ db: mockDb }));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { clearRateLimitWindows } from '../../middleware/rate-limit.js';
import { publicApiUrl } from '../../lib/public-urls.js';
import { app } from '../../app.js';

const HUMAN_BODY = {
  lane: 'human' as const,
  consent: true as const,
  email: 'ada@xiom-ai.com',
  name: 'Ada',
  useCase: 'Personal OS',
};

describe('POST /api/intake', () => {
  beforeEach(() => {
    resetMockDb();
    clearRateLimitWindows();
    mockDb.insert.mockReturnValue(insertChain([]));
  });

  it('human lane → 201 + intakeId', async () => {
    const res = await app.request('/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
      body: JSON.stringify(HUMAN_BODY),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.intakeId).toEqual(expect.any(String));
    expect(body.lane).toBe('human');
    expect(body.provisioningCapsule.endpoints.api).toBe(publicApiUrl());
  });

  it('missing consent → 400', async () => {
    const res = await app.request('/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.2' },
      body: JSON.stringify({ lane: 'human', consent: false }),
    });
    expect(res.status).toBe(400);
  });

  it('rate limit 21st → 429', async () => {
    const headers = {
      'content-type': 'application/json',
      'x-forwarded-for': '10.0.0.99',
    };
    let lastStatus = 0;
    for (let i = 0; i < 21; i++) {
      const res = await app.request('/api/intake', {
        method: 'POST',
        headers,
        body: JSON.stringify(HUMAN_BODY),
      });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('GET /api/intake/:id', () => {
  beforeEach(() => {
    resetMockDb();
    clearRateLimitWindows();
  });

  it('GET by id → 200 status payload', async () => {
    mockDb.select.mockReturnValue(
      queryChain([
        {
          id: '01HXYZINTAKE0000000000000',
          lane: 'human',
          status: 'provisioned',
          createdAt: new Date('2026-07-30T00:00:00Z'),
          activatedAt: null,
        },
      ])
    );

    const res = await app.request('/api/intake/01HXYZINTAKE0000000000000');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.intakeId).toBe('01HXYZINTAKE0000000000000');
  });

  it('GET capsule → 200', async () => {
    mockDb.select.mockReturnValue(
      queryChain([
        {
          provisioningCapsule: {
            intakeId: '01HXYZINTAKE0000000000000',
            lane: 'human',
            endpoints: {
              api: 'https://api.xiom-ai.com',
              mcp: 'https://api.xiom-ai.com/mcp',
              worldModel: 'https://api.xiom-ai.com/api/worldmodel/live',
            },
            instructions: 'ok',
            createdAt: '2026-07-30T00:00:00.000Z',
          },
          lane: 'human',
          status: 'provisioned',
        },
      ])
    );

    const res = await app.request('/api/intake/01HXYZINTAKE0000000000000/capsule');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.capsule.endpoints.api).toBe(publicApiUrl());
  });

  it('nonexistent → 404', async () => {
    mockDb.select.mockReturnValue(queryChain([]));
    const res = await app.request('/api/intake/does-not-exist');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });
});
