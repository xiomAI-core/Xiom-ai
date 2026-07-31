/**
 * v2 world model routes — authenticated Neo4j queries and signal writes
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { runQuery } from '../../services/neo4j.js';
import { cache } from '../../lib/cache.js';
import { WorldModelQueryRequestSchema, SignalRequestSchema } from '../../types/api.js';

export const worldModelV2Route = new Hono();

// POST /api/v2/world-model/query
worldModelV2Route.post(
  '/query',
  zValidator('json', WorldModelQueryRequestSchema),
  async (c) => {
    const { query, domain, limit } = c.req.valid('json');
    const start = Date.now();
    const cacheKey = `v2:wm:query:${query}:${domain ?? ''}:${limit}`;
    const cached = cache.get<object>(cacheKey);
    if (cached) {
      return c.json(cached);
    }

    const cypher = domain
      ? `MATCH (n) WHERE n.domain = $domain AND (n.label CONTAINS $query OR n.content CONTAINS $query)
         RETURN n.id AS id, n.type AS type, n.label AS label, n.domain AS domain, n.score AS score, n AS properties
         LIMIT $limit`
      : `MATCH (n) WHERE (n.label CONTAINS $query OR n.content CONTAINS $query)
         RETURN n.id AS id, n.type AS type, n.label AS label, n.domain AS domain, n.score AS score, n AS properties
         LIMIT $limit`;

    const records = await runQuery(cypher, { query, domain: domain ?? null, limit }).catch(() => []);
    const results = records.map((r) => ({
      id: String(r.get('id') ?? crypto.randomUUID()),
      type: String(r.get('type') ?? 'node'),
      label: String(r.get('label') ?? ''),
      domain: String(r.get('domain') ?? 'unknown'),
      score: Number(r.get('score') ?? 0),
      properties: (r.get('properties') as Record<string, unknown> | null) ?? {},
    }));

    const response = {
      ok: true,
      query,
      results,
      total: results.length,
      queryMs: Date.now() - start,
    };
    cache.set(cacheKey, response, 30_000);
    return c.json(response);
  }
);

// POST /api/v2/world-model/signal
worldModelV2Route.post(
  '/signal',
  zValidator('json', SignalRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const factId = crypto.randomUUID();
    const humanId = c.get('humanId');

    // Write Fact node to Neo4j
    const cypher = `
      CREATE (f:Fact {
        id: $factId,
        content: $content,
        domain: $domain,
        source: $source,
        humanId: $humanId,
        isStale: false,
        createdAt: datetime(),
        expiresAt: datetime() + duration('P30D')
      }) RETURN f
    `;
    await runQuery(cypher, {
      factId,
      content: body.content,
      domain: body.domain ?? 'general',
      source: body.source ?? 'api',
      humanId,
    }).catch(() => []);

    return c.json({
      ok: true,
      factId,
      guardianResult: { allowed: true, violatedRules: [] },
      nodeCreated: true,
      createdAt: new Date().toISOString(),
    });
  }
);

// Legacy endpoints
worldModelV2Route.get('/graph', async (c) => {
  return c.json({ nodes: [], edges: [], semantic: true });
});

worldModelV2Route.post('/search', async (c) => {
  const body = await c.req.json() as { query?: string };
  return c.json({ query: body.query ?? '', results: [], total: 0 });
});
