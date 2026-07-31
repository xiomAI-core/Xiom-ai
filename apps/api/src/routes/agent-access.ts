/**
 * Agent Access routes — plan catalog, quote generation, claim verification
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SignJWT } from 'jose';
import bcrypt from 'bcrypt';
import { db } from '../lib/db.js';
import { agentAccessQuotes, agentAccessClaims, apiCredentials } from '@xiom/db';
import { eq } from 'drizzle-orm';
import { sha256, generateApiKey } from '../lib/crypto.js';
import { verifyUsdgPayment, CHAIN_IDS } from '@xiom/blockchain';
import { QuoteRequestSchema, ClaimRequestSchema } from '../types/api.js';
import type { ActivationPacket } from '../types/api.js';
import { paymentClaims } from '../telemetry.js';
import { publicApiEndpoints } from '../lib/public-urls.js';

export const agentAccessRoute = new Hono();

// ─── Plan Catalog ───────────────────────────────────────────────────
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'For individual developers and small projects',
    priceUsdg: '10.00',
    dailyQuota: 1000,
    durationDays: 30,
    features: ['world-model-query', 'guardrail-check', 'mcp-access'],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For teams and production workloads',
    priceUsdg: '50.00',
    dailyQuota: 10000,
    durationDays: 30,
    features: ['world-model-query', 'guardrail-check', 'mcp-access', 'signal-write', 'knowledge-graph'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited access with dedicated support',
    priceUsdg: '200.00',
    dailyQuota: 100000,
    durationDays: 30,
    features: ['all'],
  },
] as const;

const JWT_SECRET_BYTES = new TextEncoder().encode(
  process.env['JWT_SECRET'] ?? 'dev-secret-32-bytes-minimum-length-here'
);

const TREASURY_ADDRESS = (process.env['XIOM_TREASURY_ADDRESS'] ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;

// GET /api/agent-access/plans
agentAccessRoute.get('/plans', (c) => {
  return c.json({ ok: true, plans: PLANS });
});

// POST /api/agent-access/quote
agentAccessRoute.post(
  '/quote',
  zValidator('json', QuoteRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const plan = PLANS.find((p) => p.id === body.planId);
    if (!plan) {
      return c.json({ ok: false, error: 'Unknown plan', code: 'INVALID_PLAN' }, 400);
    }

    const expiresAt = new Date(Date.now() + 30 * 60_000); // 30 min expiry
    const quoteHash = sha256(
      JSON.stringify({ planId: body.planId, payerAddress: body.payerAddress, amount: plan.priceUsdg, expiresAt: expiresAt.toISOString() })
    );
    const paymentRequirementHash = sha256(
      JSON.stringify({ recipient: TREASURY_ADDRESS, amount: plan.priceUsdg, currency: 'USDG', network: 'robinhood_chain', quoteHash })
    );

    // Sign the payment requirement hash
    const signature = sha256(`${quoteHash}:${paymentRequirementHash}:${process.env['JWT_SECRET'] ?? 'dev'}`);

    const [inserted] = await db.insert(agentAccessQuotes).values({
      planId: body.planId,
      payerAddress: body.payerAddress,
      amount: plan.priceUsdg,
      quoteHash,
      paymentRequirementHash,
      signature,
      status: 'pending',
      expiresAt,
      ...(body.agentId !== undefined ? { agentId: body.agentId } : {}),
      ...(body.callbackUrl !== undefined ? { callbackUrl: body.callbackUrl } : {}),
    }).returning();

    if (!inserted) {
      return c.json({ ok: false, error: 'Failed to create quote', code: 'INTERNAL_ERROR' }, 500);
    }

    return c.json(
      {
        ok: true,
        quoteId: inserted.id,
        planId: body.planId,
        amount: plan.priceUsdg,
        currency: 'USDG',
        network: 'robinhood_chain',
        chainId: CHAIN_IDS.robinhood,
        paymentAddress: TREASURY_ADDRESS,
        quoteHash,
        paymentRequirementHash,
        signature,
        expiresAt: expiresAt.toISOString(),
        createdAt: inserted.createdAt?.toISOString() ?? new Date().toISOString(),
      },
      201
    );
  }
);

// POST /api/agent-access/claim
agentAccessRoute.post(
  '/claim',
  zValidator('json', ClaimRequestSchema),
  async (c) => {
    const body = c.req.valid('json');

    // Load the quote
    const quoteRows = await db.select().from(agentAccessQuotes).where(eq(agentAccessQuotes.id, body.quoteId)).limit(1);
    const quote = quoteRows[0];
    if (!quote) {
      return c.json({ ok: false, error: 'Quote not found', code: 'NOT_FOUND' }, 404);
    }
    if (quote.status !== 'pending') {
      return c.json({ ok: false, error: 'Quote already claimed or expired', code: 'INVALID_STATE' }, 409);
    }
    if (new Date() > quote.expiresAt) {
      return c.json({ ok: false, error: 'Quote expired', code: 'QUOTE_EXPIRED' }, 410);
    }

    const plan = PLANS.find((p) => p.id === quote.planId);
    if (!plan) {
      return c.json({ ok: false, error: 'Unknown plan', code: 'INVALID_PLAN' }, 500);
    }

    if (body.quoteHash !== quote.quoteHash) {
      return c.json({ ok: false, error: 'quoteHash mismatch', code: 'INVALID_QUOTE_HASH' }, 400);
    }

    // Replay prevention — transactionHash is unique at the DB layer; reject early with 409
    const priorClaims = await db
      .select({ id: agentAccessClaims.id })
      .from(agentAccessClaims)
      .where(eq(agentAccessClaims.transactionHash, body.transactionHash))
      .limit(1);
    if (priorClaims[0]) {
      return c.json(
        { ok: false, error: 'transactionHash already claimed', code: 'DUPLICATE_TX' },
        409
      );
    }

    // Verify USDG transfer on Robinhood Chain
    const payment = await verifyUsdgPayment({
      txHash: body.transactionHash as `0x${string}`,
      expectedRecipient: TREASURY_ADDRESS,
      expectedAmount: plan.priceUsdg,
      expectedFrom: body.payerAddress as `0x${string}`,
      chainId: CHAIN_IDS.robinhood,
    });

    if (!payment.ok) {
      return c.json(
        {
          ok: false,
          error: payment.reason ?? 'USDG payment not found on Robinhood Chain',
          code: 'TX_NOT_FOUND',
        },
        400
      );
    }

    // Generate JWT and API key
    const expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60_000);
    const jwtToken = await new SignJWT({ planId: quote.planId, payerAddress: body.payerAddress })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(body.payerAddress)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(JWT_SECRET_BYTES);

    const rawApiKey = generateApiKey();
    const rawKeyPart = rawApiKey.slice(5); // strip "XIOM-" prefix
    const apiKeyHash = await bcrypt.hash(rawKeyPart, 12);

    // Mark quote as claimed and create claim + credentials in DB
    await db.update(agentAccessQuotes)
      .set({ status: 'claimed' })
      .where(eq(agentAccessQuotes.id, body.quoteId));

    const [claim] = await db.insert(agentAccessClaims).values({
      quoteId: body.quoteId,
      transactionHash: body.transactionHash,
      planId: quote.planId,
      payerAddress: body.payerAddress,
      jwtToken,
      apiKeyHash,
      expiresAt,
    }).returning();

    if (!claim) {
      return c.json({ ok: false, error: 'Failed to create claim', code: 'INTERNAL_ERROR' }, 500);
    }

    await db.insert(apiCredentials).values({
      humanId: body.payerAddress,
      claimId: claim.id,
      apiKeyHash,
      isActive: true,
      dailyQuota: plan.dailyQuota,
      usedToday: 0,
      planId: quote.planId,
      expiresAt,
    });

    const activationPacket: ActivationPacket = {
      claimId: claim.id,
      planId: quote.planId,
      jwtToken,
      apiKey: rawApiKey,
      expiresAt: expiresAt.toISOString(),
      endpoints: publicApiEndpoints(),
      rateLimit: { requestsPerDay: plan.dailyQuota },
    };

    paymentClaims.add(1, { planId: quote.planId });

    return c.json(
      {
        ok: true,
        claimId: claim.id,
        activationPacket,
        createdAt: claim.createdAt?.toISOString() ?? new Date().toISOString(),
      },
      201
    );
  }
);

// GET /api/agent-access/claims/:claimId — receipt (PII-redacted)
agentAccessRoute.get('/claims/:claimId', async (c) => {
  const claimId = c.req.param('claimId');
  const rows = await db
    .select({
      id: agentAccessClaims.id,
      planId: agentAccessClaims.planId,
      transactionHash: agentAccessClaims.transactionHash,
      expiresAt: agentAccessClaims.expiresAt,
      createdAt: agentAccessClaims.createdAt,
    })
    .from(agentAccessClaims)
    .where(eq(agentAccessClaims.id, claimId))
    .limit(1);

  const claim = rows[0];
  if (!claim) {
    return c.json({ ok: false, error: 'Claim not found', code: 'NOT_FOUND' }, 404);
  }

  return c.json({
    ok: true,
    claimId: claim.id,
    planId: claim.planId,
    transactionHash: claim.transactionHash,
    expiresAt: claim.expiresAt?.toISOString() ?? null,
    createdAt: claim.createdAt?.toISOString() ?? null,
  });
});

// Keep legacy verify endpoint for backwards compatibility
agentAccessRoute.post('/verify', async (c) => {
  const body = await c.req.json() as { agentId?: string; action?: string };
  return c.json({
    agentId: body.agentId ?? 'unknown',
    action: body.action ?? 'unknown',
    allowed: true,
    receiptId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
});

agentAccessRoute.get('/passport/:address', async (c) => {
  const address = c.req.param('address');
  return c.json({ address, tokenId: null, tier: 'free', expiresAt: null });
});
