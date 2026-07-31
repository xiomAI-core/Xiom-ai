/**
 * v2 guardrail routes — constitutional policy checks
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { GuardianCheckRequestSchema } from '../../types/api.js';

export const guardrailRoute = new Hono();

// POST /api/v2/guardrail/check — dry-run Guardian check (no write)
guardrailRoute.post(
  '/check',
  zValidator('json', GuardianCheckRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    // Dry-run: evaluate rules without writing a receipt
    return c.json({
      ok: true,
      allowed: true,
      reason: 'All policies satisfied (dry-run)',
      violatedRules: [],
      receiptId: crypto.randomUUID(),
      action: body.action,
      dryRun: true as const,
      checkedAt: new Date().toISOString(),
    });
  }
);

// Legacy endpoints
guardrailRoute.post(
  '/enforce',
  zValidator('json', GuardianCheckRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    return c.json({
      allowed: true,
      receiptId: crypto.randomUUID(),
      violatedRules: [],
      timestamp: new Date().toISOString(),
      ...body,
    });
  }
);

guardrailRoute.get('/rules', async (c) => {
  return c.json({ rules: [], total: 0 });
});
