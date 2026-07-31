/**
 * Intake routes — onboarding flow for human / agent / enterprise lanes
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db } from '../lib/db.js';
import { intakes } from '@xiom/db';
import { eq, desc, count } from 'drizzle-orm';
import { generateUlid } from '../lib/ulid.js';
import { createRateLimit } from '../middleware/rate-limit.js';
import { IntakeRequestSchema } from '../types/api.js';
import type { ProvisioningCapsule } from '../types/api.js';
import { intakeRegistrations } from '../telemetry.js';
import { publicApiEndpoints } from '../lib/public-urls.js';

export const intakeRoute = new Hono();

function buildProvisioningCapsule(intakeId: string, lane: string): ProvisioningCapsule {
  return {
    intakeId,
    lane,
    endpoints: publicApiEndpoints(),
    instructions: `Welcome to XIOM! Your intake ID is ${intakeId}. Use the /api/agent-access/plans endpoint to activate API access.`,
    createdAt: new Date().toISOString(),
  };
}

// POST /api/intake — submit intake
intakeRoute.post(
  '/',
  createRateLimit(20),
  zValidator('json', IntakeRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const intakeId = generateUlid();
    const capsule = buildProvisioningCapsule(intakeId, body.lane);

    await db.insert(intakes).values({
      id: intakeId,
      lane: body.lane,
      consentGiven: true,
      status: 'provisioned',
      provisioningCapsule: capsule as unknown as Record<string, unknown>,
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.useCase !== undefined ? { useCase: body.useCase } : {}),
      ...(body.agentId !== undefined ? { agentId: body.agentId } : {}),
      ...(body.operatorAddress !== undefined ? { operatorAddress: body.operatorAddress } : {}),
      ...(body.organizationName !== undefined ? { organizationName: body.organizationName } : {}),
    });

    intakeRegistrations.add(1, { lane: body.lane });

    return c.json(
      {
        ok: true,
        intakeId,
        lane: body.lane,
        status: 'provisioned',
        provisioningCapsule: capsule,
        createdAt: new Date().toISOString(),
      },
      201
    );
  }
);

// GET /api/intake/stats — aggregate counts by lane
intakeRoute.get('/stats', async (c) => {
  const rows = await db
    .select({ lane: intakes.lane, count: count() })
    .from(intakes)
    .groupBy(intakes.lane);

  const stats: Record<string, number> = { human: 0, agent: 0, enterprise: 0, total: 0 };
  for (const row of rows) {
    stats[row.lane] = Number(row.count);
    stats['total'] = (stats['total'] ?? 0) + Number(row.count);
  }

  return c.json({ ok: true, ...stats });
});

// GET /api/intake/recent — last 20 intakes (anonymized)
intakeRoute.get('/recent', async (c) => {
  const rows = await db
    .select({
      id: intakes.id,
      lane: intakes.lane,
      status: intakes.status,
      createdAt: intakes.createdAt,
    })
    .from(intakes)
    .orderBy(desc(intakes.createdAt))
    .limit(20);

  return c.json({ ok: true, intakes: rows, count: rows.length });
});

// GET /api/intake/:intakeId — status
intakeRoute.get('/:intakeId', async (c) => {
  const intakeId = c.req.param('intakeId');
  const row = await db
    .select({
      id: intakes.id,
      lane: intakes.lane,
      status: intakes.status,
      createdAt: intakes.createdAt,
      activatedAt: intakes.activatedAt,
    })
    .from(intakes)
    .where(eq(intakes.id, intakeId))
    .limit(1);

  if (!row[0]) {
    return c.json({ ok: false, error: 'Intake not found', code: 'NOT_FOUND' }, 404);
  }

  return c.json({
    ok: true,
    intakeId: row[0].id,
    lane: row[0].lane,
    status: row[0].status,
    createdAt: row[0].createdAt?.toISOString() ?? null,
    activatedAt: row[0].activatedAt?.toISOString() ?? null,
  });
});

// GET /api/intake/:intakeId/capsule — full provisioning capsule
intakeRoute.get('/:intakeId/capsule', async (c) => {
  const intakeId = c.req.param('intakeId');
  const row = await db
    .select({ provisioningCapsule: intakes.provisioningCapsule, lane: intakes.lane, status: intakes.status })
    .from(intakes)
    .where(eq(intakes.id, intakeId))
    .limit(1);

  if (!row[0]) {
    return c.json({ ok: false, error: 'Intake not found', code: 'NOT_FOUND' }, 404);
  }

  return c.json({
    ok: true,
    intakeId,
    capsule: row[0].provisioningCapsule ?? buildProvisioningCapsule(intakeId, row[0].lane),
  });
});
