/**
 * v2 loops routes — list / create / toggle scheduled XIOM loops
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { loops } from '@xiom/db';
import { db } from '../../lib/db.js';
import { computeNextRunAt } from '../../daemons/loopScheduler.js';
import { seedDefaultLoops } from '../../daemons/defaultLoops.js';

export const loopsRoute = new Hono();

const CreateLoopSchema = z.object({
  name:            z.string().min(1).max(128),
  schedule:        z.string().min(1),
  actionToolName:  z.string().min(1),
  actionToolInput: z.record(z.unknown()).optional(),
  authorityLevel:  z.string().optional(),
  triggerType:     z.enum(['schedule', 'event', 'threshold']).optional(),
});

// GET /api/v2/loops — list loops for authenticated human
loopsRoute.get('/', async (c) => {
  const humanId = c.get('humanId') as string;
  const rows = await db.select().from(loops).where(eq(loops.humanId, humanId));
  return c.json({ ok: true, loops: rows, count: rows.length });
});

// POST /api/v2/loops — create a loop
loopsRoute.post(
  '/',
  zValidator('json', CreateLoopSchema),
  async (c) => {
    const humanId = c.get('humanId') as string;
    const body = c.req.valid('json');
    const now = new Date();
    const nextRunAt = computeNextRunAt(body.schedule, now);

    const [row] = await db.insert(loops).values({
      humanId,
      name:            body.name,
      schedule:        body.schedule,
      triggerType:     body.triggerType ?? 'schedule',
      triggerConfig:   {},
      actionToolName:  body.actionToolName,
      actionToolInput: body.actionToolInput ?? {},
      authorityLevel:  body.authorityLevel ?? 'supervised',
      nextRunAt,
      isActive:        true,
    }).returning();

    return c.json({ ok: true, loop: row }, 201);
  }
);

// POST /api/v2/loops/seed — seed the five default loops
loopsRoute.post('/seed', async (c) => {
  const humanId = c.get('humanId') as string;
  const result = await seedDefaultLoops(humanId);
  return c.json({ ok: true, ...result });
});

// PATCH /api/v2/loops/:id/toggle — activate / deactivate
loopsRoute.patch('/:id/toggle', async (c) => {
  const humanId = c.get('humanId') as string;
  const id = c.req.param('id');

  const existing = await db
    .select()
    .from(loops)
    .where(and(eq(loops.id, id), eq(loops.humanId, humanId)))
    .limit(1);

  const loop = existing[0];
  if (!loop) {
    return c.json({ ok: false, error: 'Loop not found', code: 'NOT_FOUND' }, 404);
  }

  const [updated] = await db
    .update(loops)
    .set({ isActive: !loop.isActive })
    .where(eq(loops.id, id))
    .returning();

  return c.json({ ok: true, loop: updated });
});
