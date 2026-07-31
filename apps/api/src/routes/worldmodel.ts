/**
 * World model routes — public live snapshot + render variants
 */
import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import { worldModelCache } from '../daemons/worldModelSync.js';
import { cache } from '../lib/cache.js';

export const worldModelRoute = new Hono();

worldModelRoute.get('/live', async (c) => {
  const data = {
    ok: true,
    domains: worldModelCache.domains,
    totalNodes: worldModelCache.totalNodes,
    totalEdges: worldModelCache.totalEdges,
    lastUpdatedAt: worldModelCache.lastUpdatedAt,
    snapshot: worldModelCache.snapshot,
  };

  const etag = `"${createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16)}"`;
  const ifNoneMatch = c.req.header('if-none-match');
  if (ifNoneMatch === etag) {
    return c.body(null, 304);
  }

  c.header('ETag', etag);
  c.header('Cache-Control', 'public, max-age=30');
  return c.json(data);
});

worldModelRoute.get('/render', async (c) => {
  const view = c.req.query('view') ?? 'default';
  const compact = c.req.query('compact') === 'true';
  const cacheKey = `worldmodel:render:${view}:${compact}`;

  const cached = cache.get<object>(cacheKey);
  if (cached) {
    c.header('X-Cache', 'HIT');
    return c.json(cached);
  }

  const nodes = compact
    ? worldModelCache.snapshot.map((n) => ({ id: n.id, type: n.type, label: n.label }))
    : worldModelCache.snapshot;

  const rendered = {
    ok: true,
    view,
    compact,
    nodeCount: nodes.length,
    nodes,
    renderMs: 0,
    timestamp: new Date().toISOString(),
  };

  cache.set(cacheKey, rendered, 30_000);
  return c.json(rendered);
});

// Keep legacy endpoints for backwards compatibility
worldModelRoute.get('/', async (c) => {
  return c.json({
    nodes: worldModelCache.snapshot,
    edges: [],
    meta: { count: worldModelCache.totalNodes },
  });
});

worldModelRoute.post('/nodes', async (c) => {
  const body = await c.req.json() as { type: string; label: string; properties?: Record<string, unknown> };
  return c.json({ id: crypto.randomUUID(), ...body }, 201);
});

worldModelRoute.get('/nodes/:id', async (c) => {
  const id = c.req.param('id');
  return c.json({ id, type: 'unknown', label: '', properties: {} });
});

worldModelRoute.delete('/nodes/:id', async (c) => {
  const id = c.req.param('id');
  return c.json({ deleted: true, id });
});
