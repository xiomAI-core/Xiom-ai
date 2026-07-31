/**
 * Context freshness daemon — Sync Score σ = (C · F · Q · K)^(1/4) per Human.
 * Interval: 2h
 */
import { runQuery } from '../services/neo4j.js';
import { logger } from '../lib/logger.js';

const EXPECTED_WORLD_SOURCES = 5;
const FRESHNESS_HALF_LIFE_DAYS = 30;

export interface SyncScoreCacheEntry {
  humanId: string;
  syncScore: number;
  C: number;
  F: number;
  Q: number;
  K: number;
  updatedAt: string;
}

export const syncScoreCache: SyncScoreCacheEntry[] = [];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function geometricMean4(c: number, f: number, q: number, k: number): number {
  const product = clamp01(c) * clamp01(f) * clamp01(q) * clamp01(k);
  return Math.pow(product, 0.25);
}

export async function contextFreshnessDaemon(): Promise<void> {
  try {
    const humans = await runQuery('MATCH (h:Human) RETURN h.id AS id LIMIT 500');
    if (humans.length === 0) {
      syncScoreCache.length = 0;
      logger.debug('contextFreshness: no humans');
      return;
    }

    const now = new Date().toISOString();
    const nextCache: SyncScoreCacheEntry[] = [];

    for (const row of humans) {
      const humanId = String(row.get('id') ?? '');
      if (!humanId) continue;

      try {
        const [coverageRows, factRows] = await Promise.all([
          runQuery(
            `MATCH (h:Human {id: $humanId})
             OPTIONAL MATCH (h)-[:HAS_CONNECTION|CONNECTED_TO]->(c)
             WITH h, count(DISTINCT c) AS connected
             RETURN connected,
                    coalesce(size(h.worldSources), connected) AS sources`,
            { humanId }
          ),
          runQuery(
            `MATCH (h:Human {id: $humanId})-[:KNOWS|HAS_FACT|BELIEVES*0..2]->(f:Fact)
             WHERE coalesce(f.isDeleted, false) = false
             RETURN f.confidence AS confidence,
                    f.updatedAt AS updatedAt,
                    f.createdAt AS createdAt,
                    coalesce(f.isContradicted, false) AS isContradicted,
                    coalesce(f.isStale, false) AS isStale
             LIMIT 2000`,
            { humanId }
          ),
        ]);

        const cov = coverageRows[0];
        const connected = Number(cov?.get('connected') ?? 0);
        const sources = Number(cov?.get('sources') ?? connected);
        const C = clamp01(
          Math.max(connected, sources) / EXPECTED_WORLD_SOURCES
        );

        const facts = factRows;
        let F = 1;
        let Q = 1;
        let K = 1;

        if (facts.length > 0) {
          let ageSum = 0;
          let highConf = 0;
          let consistent = 0;
          const nowMs = Date.now();

          for (const f of facts) {
            const updatedAt = String(f.get('updatedAt') ?? f.get('createdAt') ?? '');
            const ts = updatedAt ? Date.parse(updatedAt) : NaN;
            const ageDays = Number.isFinite(ts)
              ? Math.max(0, (nowMs - ts) / (86_400_000))
              : FRESHNESS_HALF_LIFE_DAYS;
            ageSum += ageDays;

            const confidence = Number(f.get('confidence') ?? 0);
            if (confidence > 0.7) highConf += 1;

            const contradicted = Boolean(f.get('isContradicted'));
            const stale = Boolean(f.get('isStale'));
            if (!contradicted && !stale) consistent += 1;
          }

          const avgAgeDays = ageSum / facts.length;
          F = clamp01(1 - Math.min(1, avgAgeDays / FRESHNESS_HALF_LIFE_DAYS));
          Q = clamp01(highConf / facts.length);
          K = clamp01(consistent / facts.length);
        }

        const sigma = geometricMean4(C, F, Q, K);

        await runQuery(
          `MATCH (h:Human {id: $humanId})
           SET h.syncScore = $sigma,
               h.syncScoreUpdatedAt = $now,
               h.syncScoreComponents = $components`,
          {
            humanId,
            sigma,
            now,
            components: JSON.stringify({ C, F, Q, K }),
          }
        );

        nextCache.push({
          humanId,
          syncScore: sigma,
          C,
          F,
          Q,
          K,
          updatedAt: now,
        });
      } catch (err) {
        logger.warn({ err, humanId }, 'contextFreshness: human failed');
      }
    }

    syncScoreCache.length = 0;
    syncScoreCache.push(...nextCache);
    logger.info({ humans: nextCache.length }, 'contextFreshness: sync scores updated');
  } catch (err) {
    logger.warn({ err }, 'contextFreshness: failed');
  }
}
