// ──────────────────────────────────────────────────────────────
// XIOM API — Default Loop Seeder (Phase 5 Evolve)
// Pre-built loops for morning digest, drift, policy evolution,
// fact freshness, and receipt chain verification.
// ──────────────────────────────────────────────────────────────
import { and, eq } from 'drizzle-orm';
import { loops } from '@xiom/db';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { computeNextRunAt } from './loopScheduler.js';

export interface DefaultLoopSpec {
  name: string;
  schedule: string;
  actionToolName: string;
  actionToolInput: Record<string, unknown>;
  authorityLevel: string;
}

export const DEFAULT_LOOP_SPECS: DefaultLoopSpec[] = [
  {
    name: 'Morning Digest',
    schedule: '0 8 * * 1-5',
    actionToolName: 'morning_digest',
    actionToolInput: { lookbackHours: 24 },
    authorityLevel: 'autonomous',
  },
  {
    name: 'Goal Drift Detector',
    schedule: '0 9 */3 * *',
    actionToolName: 'get_drifting_goals',
    actionToolInput: { daysThreshold: 7 },
    authorityLevel: 'autonomous',
  },
  {
    name: 'Policy Evolution Trigger',
    schedule: '0 10 */7 * *',
    actionToolName: 'policy_evolution',
    actionToolInput: { windowDays: 30 },
    authorityLevel: 'supervised',
  },
  {
    name: 'Fact Freshness',
    schedule: '0 0 * * *',
    actionToolName: 'fact_freshness',
    actionToolInput: {},
    authorityLevel: 'autonomous',
  },
  {
    name: 'Receipt Chain Verification',
    schedule: '0 11 * * 0',
    actionToolName: 'verify_receipt_chain',
    actionToolInput: {},
    authorityLevel: 'autonomous',
  },
];

/**
 * Seed the five pre-built XIOM loops for a human.
 * Idempotent: skips loops that already exist by name for that human.
 */
export async function seedDefaultLoops(humanId: string): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  const now = new Date();

  for (const spec of DEFAULT_LOOP_SPECS) {
    const existing = await db
      .select({ id: loops.id })
      .from(loops)
      .where(and(eq(loops.humanId, humanId), eq(loops.name, spec.name)))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const nextRunAt = computeNextRunAt(spec.schedule, now);

    await db.insert(loops).values({
      humanId,
      name:            spec.name,
      schedule:        spec.schedule,
      triggerType:     'schedule',
      triggerConfig:   {},
      actionToolName:  spec.actionToolName,
      actionToolInput: spec.actionToolInput,
      authorityLevel:  spec.authorityLevel,
      nextRunAt,
      isActive:        true,
      runCount:        0,
      successCount:    0,
      failureCount:    0,
    });
    created++;
  }

  logger.info({ humanId, created, skipped }, 'XIOM seedDefaultLoops complete');
  return { created, skipped };
}
