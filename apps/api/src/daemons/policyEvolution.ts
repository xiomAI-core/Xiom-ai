/**
 * Policy evolution daemon — weekly analyze / detect / propose cycle.
 * Interval: 7d (also invokable from loopScheduler tools)
 */
import { PolicyEvolutionEngine } from '@xiom/guardian';
import { getWmConn } from './wmConn.js';
import { logger } from '../lib/logger.js';

export const POLICY_EVOLUTION_INTERVAL_MS = 7 * 24 * 60 * 60_000;

const SAMPLE_LIMIT = 50;

export async function policyEvolutionDaemon(): Promise<void> {
  try {
    const conn = getWmConn();
    const humans = await conn.queryMany<{ id: string }>(
      `MATCH (h:Human) RETURN h.id AS id LIMIT $limit`,
      { limit: SAMPLE_LIMIT }
    );

    if (humans.length === 0) {
      logger.debug('policyEvolution: no humans');
      return;
    }

    const engine = new PolicyEvolutionEngine(conn);
    let analyzed = 0;
    let proposals = 0;

    for (const { id: humanId } of humans) {
      try {
        await engine.analyzeOutcomes(humanId, 30);
        const patterns = await engine.detectPatterns(humanId, 30);
        for (const pattern of patterns) {
          if (pattern.confidence >= 0.75) {
            await engine.proposePolicyUpdate(humanId, pattern);
            proposals += 1;
          }
        }
        analyzed += 1;
      } catch (err) {
        logger.warn({ err, humanId }, 'policyEvolution: human failed');
      }
    }

    logger.info({ analyzed, proposals }, 'policyEvolution: weekly tick');
  } catch (err) {
    logger.warn({ err }, 'policyEvolution: failed');
  }
}
