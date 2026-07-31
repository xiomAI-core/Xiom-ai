/**
 * Audit verifier daemon — verifyReceiptChain for all humans; alert on breaks.
 * Interval: 6h
 */
import { verifyReceiptChain, proposeAction, WorldModelDomain } from '@xiom/world-model';
import { getWmConn } from './wmConn.js';
import { logger } from '../lib/logger.js';

export async function auditVerifierDaemon(): Promise<void> {
  try {
    const conn = getWmConn();
    const humans = await conn.queryMany<{ id: string }>(
      `MATCH (h:Human) RETURN h.id AS id LIMIT 500`
    );

    if (humans.length === 0) {
      logger.debug('auditVerifier: no humans');
      return;
    }

    let ok = 0;
    let broken = 0;

    for (const { id: humanId } of humans) {
      try {
        const result = await verifyReceiptChain(conn, humanId);
        if (result.valid) {
          ok += 1;
          continue;
        }

        broken += 1;
        const brokenAt = result.brokenAt ?? 'unknown';
        await proposeAction(conn, {
          actionType: 'audit.receipt_chain_break',
          intent: `Urgent: receipt chain broken for human ${humanId} at ${brokenAt}`,
          domain: WorldModelDomain.TRACK,
          confidence: 1,
          source: 'auditVerifier',
          toolName: 'auditVerifier',
          toolInput: { humanId, brokenAt, urgency: 'urgent', alert: true },
        });

        // Link alert Action to Human for notificationDispatcher
        await conn.query(
          `MATCH (h:Human {id: $humanId})
           MATCH (a:Action {actionType: 'audit.receipt_chain_break'})
           WHERE a.createdAt >= $since AND NOT (h)<-[:OCCURRED_IN]-(a)
           WITH h, a ORDER BY a.createdAt DESC LIMIT 1
           CREATE (a)-[:OCCURRED_IN]->(h)
           SET a.urgency = 'urgent', a.alert = true, a.notificationPending = true`,
          {
            humanId,
            since: new Date(Date.now() - 60_000).toISOString(),
          }
        );

        logger.warn({ humanId, brokenAt }, 'auditVerifier: receipt chain broken');
      } catch (err) {
        logger.warn({ err, humanId }, 'auditVerifier: human failed');
      }
    }

    logger.info({ ok, broken, total: humans.length }, 'auditVerifier: tick');
  } catch (err) {
    logger.warn({ err }, 'auditVerifier: failed');
  }
}
