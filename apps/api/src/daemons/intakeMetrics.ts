/**
 * Intake metrics daemon — caches intake counts per lane
 */
import { db } from '../lib/db.js';
import { intakes } from '@xiom/db';
import { count } from 'drizzle-orm';
import { logger } from '../lib/logger.js';

export interface IntakeMetricsCacheData {
  human: number;
  agent: number;
  enterprise: number;
  total: number;
  lastUpdatedAt: string;
}

export const intakeMetricsCache: IntakeMetricsCacheData = {
  human: 0,
  agent: 0,
  enterprise: 0,
  total: 0,
  lastUpdatedAt: new Date().toISOString(),
};

export async function intakeMetricsDaemon(): Promise<void> {
  try {
    const rows = await db
      .select({ lane: intakes.lane, count: count() })
      .from(intakes)
      .groupBy(intakes.lane);

    let total = 0;
    const updated: Record<string, number> = { human: 0, agent: 0, enterprise: 0 };
    for (const row of rows) {
      const n = Number(row.count);
      updated[row.lane] = n;
      total += n;
    }

    intakeMetricsCache.human = updated['human'] ?? 0;
    intakeMetricsCache.agent = updated['agent'] ?? 0;
    intakeMetricsCache.enterprise = updated['enterprise'] ?? 0;
    intakeMetricsCache.total = total;
    intakeMetricsCache.lastUpdatedAt = new Date().toISOString();
  } catch (err) {
    logger.warn({ err }, 'intakeMetrics: failed');
  }
}
