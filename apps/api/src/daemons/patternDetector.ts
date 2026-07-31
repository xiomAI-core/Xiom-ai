/**
 * Pattern detector daemon — PolicyEvolutionEngine.detectPatterns per human.
 * Interval: 24h
 */
import { PolicyEvolutionEngine } from '@xiom/guardian';
import { getWmConn } from './wmConn.js';
import { logger } from '../lib/logger.js';

const SAMPLE_LIMIT = 100;
const CONFIDENCE_PROPOSE_THRESHOLD = 0.7;

export async function patternDetectorDaemon(): Promise<void> {
  try {
    const conn = getWmConn();
    const humans = await conn.queryMany<{ id: string }>(
      `MATCH (h:Human) RETURN h.id AS id LIMIT $limit`,
      { limit: SAMPLE_LIMIT }
    );

    if (humans.length === 0) {
      logger.debug('patternDetector: no humans');
      return;
    }

    const engine = new PolicyEvolutionEngine(conn);
    let patternsCreated = 0;
    let proposals = 0;

    for (const { id: humanId } of humans) {
      try {
        const patterns = await engine.detectPatterns(humanId, 30);
        const now = new Date().toISOString();

        for (const pattern of patterns) {
          await conn.query(
            `MATCH (h:Human {id: $humanId})
             CREATE (p:Pattern {
               id: $id,
               nodeType: 'Pattern',
               type: $type,
               description: $description,
               evidenceCount: $evidenceCount,
               confidence: $confidence,
               metadata: $metadata,
               domain: 'SYMBIOSIS',
               version: 1,
               isDeleted: false,
               createdAt: $now,
               updatedAt: $now
             })
             CREATE (h)-[:HAS_PATTERN]->(p)`,
            {
              humanId,
              id: pattern.id,
              type: pattern.type,
              description: pattern.description,
              evidenceCount: pattern.evidenceCount,
              confidence: pattern.confidence,
              metadata: JSON.stringify(pattern.metadata),
              now,
            }
          );
          patternsCreated += 1;

          if (pattern.confidence >= CONFIDENCE_PROPOSE_THRESHOLD) {
            await engine.proposePolicyUpdate(humanId, pattern);
            proposals += 1;
          }
        }
      } catch (err) {
        logger.warn({ err, humanId }, 'patternDetector: human failed');
      }
    }

    logger.info(
      { humans: humans.length, patternsCreated, proposals },
      'patternDetector: tick'
    );
  } catch (err) {
    logger.warn({ err }, 'patternDetector: failed');
  }
}
