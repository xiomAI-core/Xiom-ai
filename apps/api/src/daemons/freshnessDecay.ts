/**
 * Freshness decay daemon — marks Neo4j Facts as stale after expiresAt
 */
import { runQuery } from '../services/neo4j.js';
import { logger } from '../lib/logger.js';

export async function freshnessDecayDaemon(): Promise<void> {
  try {
    const result = await runQuery(
      `MATCH (n:Fact)
       WHERE n.isStale = false AND n.expiresAt IS NOT NULL AND n.expiresAt < datetime()
       SET n.isStale = true
       RETURN count(n) AS updated`
    );
    const updated = Number(result[0]?.get('updated') ?? 0);
    if (updated > 0) {
      logger.info({ updated }, 'freshnessDecay: marked stale facts');
    }
  } catch (err) {
    logger.warn({ err }, 'freshnessDecay: failed');
  }
}
