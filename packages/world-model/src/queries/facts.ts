// ──────────────────────────────────────────────────────────────
// XIOM World Model — Fact Query Helpers
// ──────────────────────────────────────────────────────────────
import type { Neo4jConnectionManager } from '../connection.js';
import type { FactNode } from '../types/nodes.js';
import { WorldModelDomain } from '../types/domains.js';

type CreateFactData = Omit<
  FactNode,
  'id' | 'nodeType' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted'
>;

/**
 * Write a new Fact to the graph and link it to the Human.
 */
export async function writeFact(
  conn: Neo4jConnectionManager,
  humanId: string,
  data: CreateFactData
): Promise<FactNode> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const params: Record<string, unknown> = {
    humanId,
    id,
    content:    data.content,
    sourceType: data.sourceType,
    isStale:    data.isStale,
    domain:     data.domain,
    confidence: data.confidence,
    now,
  };

  if (data.sourceRef !== undefined)  params['sourceRef']  = data.sourceRef;
  if (data.expiresAt !== undefined)  params['expiresAt']  = data.expiresAt.toISOString();
  if (data.source !== undefined)     params['source']     = data.source;
  if (data.embedding !== undefined)  params['embedding']  = data.embedding;

  const cypher = `
    MATCH (h:Human {id: $humanId})
    CREATE (f:Fact {
      id:         $id,
      nodeType:   'Fact',
      content:    $content,
      sourceType: $sourceType,
      isStale:    $isStale,
      domain:     $domain,
      confidence: $confidence,
      version:    1,
      isDeleted:  false,
      createdAt:  $now,
      updatedAt:  $now
    })
    CREATE (h)-[:USED_FACT]->(f)
    RETURN f { .* } AS fact
  `;

  const result = await conn.queryOne<{ fact: Record<string, unknown> }>(
    cypher,
    params
  );
  if (!result) throw new Error(`writeFact: human ${humanId} not found`);
  return mapFact(result.fact);
}

/**
 * Full-text search for relevant facts using the `fact_content` index.
 * Uses Neo4j's built-in BM25 scoring — higher score = more relevant.
 */
export async function getRelevantFacts(
  conn: Neo4jConnectionManager,
  query: string,
  limit = 20
): Promise<FactNode[]> {
  const rows = await conn.queryMany<{ fact: Record<string, unknown> }>(
    `CALL db.index.fulltext.queryNodes('fact_content', $query) YIELD node AS f, score
     WHERE f.isStale = false AND f.isDeleted = false
     RETURN f { .* } AS fact
     ORDER BY score DESC
     LIMIT $limit`,
    { query, limit }
  );
  return rows.map((r) => mapFact(r.fact));
}

/**
 * Mark a single fact as stale so it is excluded from relevance queries.
 */
export async function markFactStale(
  conn: Neo4jConnectionManager,
  factId: string
): Promise<void> {
  await conn.query(
    `MATCH (f:Fact {id: $factId})
     SET f.isStale = true, f.updatedAt = $now, f.version = f.version + 1`,
    { factId, now: new Date().toISOString() }
  );
}

/**
 * Return all stale or expired facts linked to a human.
 */
export async function getStaleFactsForHuman(
  conn: Neo4jConnectionManager,
  humanId: string
): Promise<FactNode[]> {
  const rows = await conn.queryMany<{ fact: Record<string, unknown> }>(
    `MATCH (:Human {id: $humanId})-[:USED_FACT]->(f:Fact {isDeleted: false})
     WHERE f.isStale = true OR (f.expiresAt IS NOT NULL AND f.expiresAt < $now)
     RETURN f { .* } AS fact
     ORDER BY f.expiresAt ASC`,
    { humanId, now: new Date().toISOString() }
  );
  return rows.map((r) => mapFact(r.fact));
}

// ─── Mapper ───────────────────────────────────────────────────

function mapFact(raw: Record<string, unknown>): FactNode {
  const base = {
    id:         String(raw['id'] ?? ''),
    nodeType:   'Fact' as const,
    content:    String(raw['content'] ?? ''),
    sourceType: (raw['sourceType'] ?? 'manual') as FactNode['sourceType'],
    isStale:    Boolean(raw['isStale'] ?? false),
    domain:     (raw['domain'] as WorldModelDomain) ?? WorldModelDomain.TRACK,
    confidence: Number(raw['confidence'] ?? 1),
    version:    Number(raw['version'] ?? 1),
    isDeleted:  Boolean(raw['isDeleted'] ?? false),
    createdAt:  raw['createdAt'] ? new Date(String(raw['createdAt'])) : new Date(),
    updatedAt:  raw['updatedAt'] ? new Date(String(raw['updatedAt'])) : new Date(),
  };

  return {
    ...base,
    ...(raw['source']    !== undefined ? { source:    String(raw['source']) }    : {}),
    ...(raw['sourceRef'] !== undefined ? { sourceRef: String(raw['sourceRef']) } : {}),
    ...(raw['expiresAt'] !== undefined ? { expiresAt: new Date(String(raw['expiresAt'])) } : {}),
    ...(Array.isArray(raw['embedding']) ? { embedding: raw['embedding'] as number[] } : {}),
  };
}
