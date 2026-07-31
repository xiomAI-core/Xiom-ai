/**
 * World model sync daemon — queries Neo4j for domain counts, caches result
 */
import { runQuery } from '../services/neo4j.js';
import { logger } from '../lib/logger.js';
import { recordWorldModelNodeCount } from '../telemetry.js';

export interface WorldModelCacheData {
  domains: Record<string, number>;
  totalNodes: number;
  totalEdges: number;
  lastUpdatedAt: string;
  snapshot: Array<{ id: string; type: string; label: string; domain: string }>;
}

export const worldModelCache: WorldModelCacheData = {
  domains: {},
  totalNodes: 0,
  totalEdges: 0,
  lastUpdatedAt: new Date().toISOString(),
  snapshot: [],
};

export async function worldModelSyncDaemon(): Promise<void> {
  try {
    const [countRecords, domainRecords, snapshotRecords, edgeRecords] = await Promise.allSettled([
      runQuery('MATCH (n) RETURN count(n) AS total'),
      runQuery('MATCH (n) WHERE n.domain IS NOT NULL RETURN n.domain AS domain, count(n) AS cnt'),
      runQuery('MATCH (n) RETURN n.id AS id, labels(n)[0] AS type, n.label AS label, n.domain AS domain LIMIT 200'),
      runQuery('MATCH ()-[r]->() RETURN count(r) AS total'),
    ]);

    if (countRecords.status === 'fulfilled') {
      worldModelCache.totalNodes = Number(countRecords.value[0]?.get('total') ?? 0);
    }
    if (edgeRecords.status === 'fulfilled') {
      worldModelCache.totalEdges = Number(edgeRecords.value[0]?.get('total') ?? 0);
    }
    if (domainRecords.status === 'fulfilled') {
      worldModelCache.domains = {};
      for (const r of domainRecords.value) {
        const domain = String(r.get('domain') ?? 'unknown');
        worldModelCache.domains[domain] = Number(r.get('cnt') ?? 0);
      }
    }
    if (snapshotRecords.status === 'fulfilled') {
      worldModelCache.snapshot = snapshotRecords.value.map((r) => ({
        id: String(r.get('id') ?? crypto.randomUUID()),
        type: String(r.get('type') ?? 'Node'),
        label: String(r.get('label') ?? ''),
        domain: String(r.get('domain') ?? 'unknown'),
      }));
    }

    worldModelCache.lastUpdatedAt = new Date().toISOString();
    recordWorldModelNodeCount(worldModelCache.totalNodes);
  } catch (err) {
    logger.warn({ err }, 'worldModelSync: failed to query Neo4j');
  }
}
