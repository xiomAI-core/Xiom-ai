/**
 * Integration tests — /api/agent-access (mocked DB + verifyUsdgPayment)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertChain,
  mockDb,
  mockVerifyUsdgPayment,
  queryChain,
  resetMockDb,
} from '../helpers/mock-db.js';

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

vi.mock('@xiom/blockchain', () => ({
  verifyUsdgPayment: (...args: unknown[]) => mockVerifyUsdgPayment(...args),
  CHAIN_IDS: { robinhood: 4663, robinhoodTestnet: 46630 },
}));

import { app } from '../../app.js';

const PAYER = '0x2222222222222222222222222222222222222222';
const TX = '0x' + 'ab'.repeat(32);
const QUOTE_ID = '11111111-1111-4111-8111-111111111111';

describe('GET /api/agent-access/plans', () => {
  it('returns 200 with plans', async () => {
    const res = await app.request('/api/agent-access/plans');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.plans.length).toBeGreaterThan(0);
    expect(body.plans[0].priceUsdg).toBeDefined();
  });
});

describe('POST /api/agent-access/quote', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('returns 201 with quoteId + quoteHash', async () => {
    mockDb.insert.mockReturnValue(
      insertChain([
        {
          id: QUOTE_ID,
          createdAt: new Date('2026-07-30T00:00:00Z'),
        },
      ])
    );

    const res = await app.request('/api/agent-access/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'starter', payerAddress: PAYER }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.quoteId).toBe(QUOTE_ID);
    expect(body.quoteHash).toEqual(expect.any(String));
    expect(body.network).toBe('robinhood_chain');
    expect(body.currency).toBe('USDG');
    expect(body.chainId).toBe(4663);
  });
});

describe('POST /api/agent-access/claim', () => {
  const pendingQuote = {
    id: QUOTE_ID,
    planId: 'starter',
    payerAddress: PAYER,
    amount: '10.00',
    quoteHash: 'deadbeefquotehash',
    paymentRequirementHash: 'reqhash',
    signature: 'sig',
    status: 'pending',
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  };

  beforeEach(() => {
    resetMockDb();
    mockVerifyUsdgPayment.mockResolvedValue({
      ok: true,
      amount: 10_000_000n,
      from: PAYER,
      to: '0x0000000000000000000000000000000000000000',
    });
  });

  it('claim success → 201', async () => {
    let selectCalls = 0;
    mockDb.select.mockImplementation(() => {
      selectCalls += 1;
      if (selectCalls === 1) return queryChain([pendingQuote]); // load quote
      return queryChain([]); // no prior claim by txHash
    });
    mockDb.update.mockReturnValue(queryChain(undefined));
    mockDb.insert
      .mockReturnValueOnce(
        insertChain([
          {
            id: '22222222-2222-4222-8222-222222222222',
            createdAt: new Date(),
          },
        ])
      )
      .mockReturnValueOnce(insertChain([])); // apiCredentials

    const res = await app.request('/api/agent-access/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        quoteId: QUOTE_ID,
        quoteHash: pendingQuote.quoteHash,
        transactionHash: TX,
        payerAddress: PAYER,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.claimId).toBeDefined();
    expect(body.activationPacket.apiKey).toMatch(/^XIOM-/);
    expect(mockVerifyUsdgPayment).toHaveBeenCalled();
  });

  it('duplicate txHash → 409', async () => {
    let selectCalls = 0;
    mockDb.select.mockImplementation(() => {
      selectCalls += 1;
      if (selectCalls === 1) return queryChain([pendingQuote]);
      return queryChain([{ id: 'already-claimed' }]);
    });

    const res = await app.request('/api/agent-access/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        quoteId: QUOTE_ID,
        quoteHash: pendingQuote.quoteHash,
        transactionHash: TX,
        payerAddress: PAYER,
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('DUPLICATE_TX');
  });

  it('wrong quoteHash → 400', async () => {
    mockDb.select.mockReturnValue(queryChain([pendingQuote]));

    const res = await app.request('/api/agent-access/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        quoteId: QUOTE_ID,
        quoteHash: 'wrong-hash',
        transactionHash: TX,
        payerAddress: PAYER,
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_QUOTE_HASH');
  });
});
