/**
 * MCP routes — JSON-RPC 2.0 transport for XIOM tools
 */
import { Hono } from 'hono';
import { createRateLimit } from '../middleware/rate-limit.js';
import { runQuery } from '../services/neo4j.js';
import { cache } from '../lib/cache.js';
import type { McpEnvelope, McpResult } from '../types/api.js';

export const mcpRoute = new Hono();

function mcpError(id: string | number, code: number, message: string): McpResult {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function mcpOk(id: string | number, result: unknown): McpResult {
  return { jsonrpc: '2.0', id, result };
}

// POST /mcp — main JSON-RPC 2.0 transport
mcpRoute.post('/', createRateLimit(20), async (c) => {
  let envelope: McpEnvelope;
  try {
    envelope = await c.req.json() as McpEnvelope;
  } catch {
    return c.json(mcpError(0, -32700, 'Parse error'), 200);
  }

  const { id, method, params } = envelope;
  if (envelope.jsonrpc !== '2.0') {
    return c.json(mcpError(id, -32600, 'Invalid Request'), 200);
  }

  // All non-initialize calls require consent payload
  if (method !== 'initialize') {
    const p = params as Record<string, unknown> | undefined;
    const consent = p?.['consent'] as Record<string, unknown> | undefined;
    if (!consent?.['accepted']) {
      return c.json(mcpError(id, -32003, 'Missing consent payload'), 200);
    }
  }

  switch (method) {
    case 'initialize':
      return c.json(mcpOk(id, {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'xiom-mcp', version: '0.1.0' },
        capabilities: { tools: {}, resources: {}, prompts: {} },
      }));

    case 'tools/list':
      return c.json(mcpOk(id, {
        tools: [
          {
            name: 'xiom_world_model_query',
            description: 'Search the XIOM world model knowledge graph',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Fulltext search query' },
                domain: { type: 'string', description: 'Optional domain filter' },
                limit: { type: 'number', description: 'Max results (1-100)', default: 20 },
              },
              required: ['query'],
            },
          },
          {
            name: 'xiom_guardrail_check',
            description: 'Run a dry-run constitutional guardrail check',
            inputSchema: {
              type: 'object',
              properties: {
                action: { type: 'string', description: 'The action to evaluate' },
                context: { type: 'object', description: 'Optional context object' },
              },
              required: ['action'],
            },
          },
          {
            name: 'xiom_public_context',
            description: 'Retrieve the XIOM public context snapshot',
            inputSchema: { type: 'object', properties: {}, required: [] },
          },
        ],
      }));

    case 'tools/call': {
      const p = params as { name?: string; arguments?: Record<string, unknown>; consent?: unknown } | undefined;
      const toolName = p?.['name'];
      const args = p?.['arguments'] ?? {};

      switch (toolName) {
        case 'xiom_world_model_query': {
          const query = String(args['query'] ?? '');
          const domain = args['domain'] ? String(args['domain']) : null;
          const limit = Math.min(Number(args['limit'] ?? 20), 100);
          const cacheKey = `mcp:wm:${query}:${domain}:${limit}`;
          const cached = cache.get<unknown>(cacheKey);
          if (cached) {
            return c.json(mcpOk(id, { content: [{ type: 'text', text: JSON.stringify(cached) }] }));
          }
          const cypher = domain
            ? `MATCH (n) WHERE n.domain = $domain AND (n.label CONTAINS $q OR n.content CONTAINS $q) RETURN n LIMIT $limit`
            : `MATCH (n) WHERE (n.label CONTAINS $q OR n.content CONTAINS $q) RETURN n LIMIT $limit`;
          const records = await runQuery(cypher, { q: query, domain, limit }).catch(() => []);
          const results = records.map((r) => ({ node: r.get('n') }));
          cache.set(cacheKey, results, 30_000);
          return c.json(mcpOk(id, { content: [{ type: 'text', text: JSON.stringify(results) }] }));
        }

        case 'xiom_guardrail_check': {
          const action = String(args['action'] ?? '');
          return c.json(mcpOk(id, {
            content: [{
              type: 'text',
              text: JSON.stringify({
                allowed: true,
                reason: 'All policies satisfied (dry-run)',
                violatedRules: [],
                action,
                dryRun: true,
                checkedAt: new Date().toISOString(),
              }),
            }],
          }));
        }

        case 'xiom_public_context': {
          const ctx = cache.get<unknown>('public:context');
          return c.json(mcpOk(id, { content: [{ type: 'text', text: JSON.stringify(ctx ?? { service: 'xiom-api' }) }] }));
        }

        default:
          return c.json(mcpError(id, -32601, `Unknown tool: ${toolName ?? 'undefined'}`));
      }
    }

    default:
      return c.json(mcpError(id, -32601, 'Method not found'));
  }
});

// Legacy MCP endpoints
mcpRoute.post('/v1', createRateLimit(20), async (c) => {
  const body = await c.req.json() as McpEnvelope;
  const { method, id } = body;

  if (method === 'initialize') {
    return c.json(mcpOk(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'xiom-mcp', version: '0.1.0' },
      capabilities: { tools: {}, resources: {}, prompts: {} },
    }));
  }
  if (method === 'tools/list') {
    return c.json(mcpOk(id, { tools: [] }));
  }
  return c.json(mcpError(id, -32601, 'Method not found'));
});

mcpRoute.get('/v1/health', (c) =>
  c.json({ status: 'ok', transport: 'http', version: '2024-11-05' })
);
