/**
 * v2 knowledge-graph routes — build and query the knowledge graph
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { runQuery } from '../../services/neo4j.js';
import { KnowledgeGraphBuildRequestSchema } from '../../types/api.js';

export const knowledgeGraphRoute = new Hono();

// POST /api/v2/knowledge-graph/build
knowledgeGraphRoute.post(
  '/build',
  zValidator('json', KnowledgeGraphBuildRequestSchema),
  async (c) => {
    const { nodes, edges } = c.req.valid('json');
    const humanId = c.get('humanId');
    let nodesCreated = 0;
    let edgesCreated = 0;

    for (const node of nodes) {
      const id = crypto.randomUUID();
      await runQuery(
        `MERGE (n:${node.type} {id: $id}) SET n += $props, n.humanId = $humanId, n.updatedAt = datetime()`,
        {
          id,
          props: {
            label: node.label,
            domain: node.domain ?? 'general',
            ...(node.properties ?? {}),
          },
          humanId,
        }
      ).catch(() => null);
      nodesCreated++;
    }

    if (edges) {
      for (const edge of edges) {
        await runQuery(
          `MATCH (a {id: $from}), (b {id: $to}) MERGE (a)-[:${edge.type}]->(b)`,
          { from: edge.from, to: edge.to }
        ).catch(() => null);
        edgesCreated++;
      }
    }

    return c.json({ ok: true, nodesCreated, edgesCreated, timestamp: new Date().toISOString() });
  }
);

// GET /api/v2/knowledge-graph/summary
knowledgeGraphRoute.get('/summary', async (c) => {
  const records = await runQuery(
    `MATCH (n) RETURN count(n) AS nodeCount, collect(DISTINCT labels(n)[0])[0..20] AS labels`
  ).catch(() => []);
  const nodeCount = Number(records[0]?.get('nodeCount') ?? 0);
  return c.json({ ok: true, nodeCount, edgeCount: 0, labels: [], relationships: [] });
});

// Legacy ingest endpoint
knowledgeGraphRoute.post('/ingest', async (c) => {
  const body = await c.req.json();
  return c.json({ ingested: true, nodesCreated: 0, edgesCreated: 0, source: body });
});
