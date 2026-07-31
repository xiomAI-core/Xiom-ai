/**
 * v2 memory routes — structured memory node design
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { MemoryDesignRequestSchema } from '../../types/api.js';

export const memoryRoute = new Hono();

// POST /api/v2/memory/design
memoryRoute.post(
  '/design',
  zValidator('json', MemoryDesignRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    // Generate structured memory nodes from description
    const nodes = [
      {
        id: crypto.randomUUID(),
        type: 'MemoryNode',
        label: body.description.slice(0, 64),
        domain: 'memory',
        properties: {
          description: body.description,
          ...(body.context !== undefined ? { context: body.context } : {}),
          tags: body.tags ?? [],
          createdAt: new Date().toISOString(),
        },
      },
    ];

    return c.json({ ok: true, nodes, count: nodes.length, createdAt: new Date().toISOString() }, 201);
  }
);

memoryRoute.get('/', async (c) => {
  return c.json({ memories: [], total: 0 });
});

memoryRoute.post('/', async (c) => {
  const body = await c.req.json();
  return c.json({ id: crypto.randomUUID(), ...body, createdAt: new Date().toISOString() }, 201);
});

memoryRoute.delete('/:id', async (c) => {
  const id = c.req.param('id');
  return c.json({ deleted: true, id });
});
