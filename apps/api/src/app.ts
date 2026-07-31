/**
 * Core Hono application — middleware stack and route mounting
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { compress } from 'hono/compress';
import { randomBytes } from 'node:crypto';
import { logger as pinoLogger } from './lib/logger.js';

import { errorHandler } from './middleware/error-handler.js';
import { auditMiddleware } from './middleware/audit.js';

import { healthRoute } from './routes/health.js';
import { contextRoute } from './routes/context.js';
import { worldModelRoute } from './routes/worldmodel.js';
import { intakeRoute } from './routes/intake.js';
import { tokenRoute } from './routes/token.js';
import { bidwallRoute } from './routes/bidwall.js';
import { revenueRoute } from './routes/revenue.js';
import { agentAccessRoute } from './routes/agent-access.js';
import { mcpRoute } from './routes/mcp.js';
import { blinkRoute } from './routes/blink.js';
import { installRoute } from './routes/install.js';
import { v2Routes } from './routes/v2/index.js';

import {
  getXiomPublicContract,
  x402Contract,
  agentContract,
  mcpContract,
} from './well-known/contracts.js';
import { buildOpenApiSpec } from './openapi.js';
import { publicApiUrl, publicAppUrl } from './lib/public-urls.js';

const app = new Hono();

// ─── Global middleware ──────────────────────────────────────────────
app.use('*', cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3002',
    'https://xiom-ai.com',
    'https://app.xiom-ai.com',
  ],
  credentials: true,
  allowHeaders: ['Authorization', 'X-Api-Key', 'Content-Type', 'x-request-id'],
}));
app.use('*', secureHeaders());
app.use('*', compress());

// Request ID
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? randomBytes(8).toString('hex');
  c.res.headers.set('x-request-id', requestId);
  c.set('requestId', requestId);
  await next();
});

// Pino request logger
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  pinoLogger.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms }, 'request');
});

// ─── API docs (Scalar) + OpenAPI spec ───────────────────────────────
app.get('/openapi.json', (c) => c.json(buildOpenApiSpec()));

app.get('/docs', (c) =>
  c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>XIOM API</title>
</head>
<body>
  <script id="api-reference" data-url="/openapi.json" src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`)
);

app.get('/', (c) =>
  c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>XIOM API</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fafafa; padding: 2rem; max-width: 40rem; margin: 0 auto; }
    a { color: #93c5fd; }
    li { margin: 0.5rem 0; }
  </style>
</head>
<body>
  <h1>XIOM API</h1>
  <p>Constitutional personal AI operating system — REST + MCP + x402.</p>
  <ul>
    <li><a href="/docs">Interactive API docs</a></li>
    <li><a href="/health">Health check</a></li>
    <li><a href="/openapi.json">OpenAPI spec</a></li>
    <li><a href="/.well-known/xiom-public-contract.json">Public contract</a></li>
    <li><a href="${publicAppUrl()}">Onboarding app</a></li>
  </ul>
</body>
</html>`)
);

// ─── Health (no auth, no rate limit) ───────────────────────────────
app.route('/health', healthRoute);

// ─── Provider install scripts (curl | bash) ────────────────────────
app.route('/install', installRoute);

// ─── Well-known static files ────────────────────────────────────────
app.get('/.well-known/xiom-public-contract.json', (c) => c.json(getXiomPublicContract()));
app.get('/.well-known/x402.json', (c) => c.json(x402Contract));
app.get('/.well-known/agent.json', (c) => c.json(agentContract));
app.get('/.well-known/mcp.json', (c) => c.json(mcpContract));

// ─── Solana Blink actions ───────────────────────────────────────────
app.route('/blink', blinkRoute);

// ─── MCP — JSON-RPC 2.0 at /mcp ────────────────────────────────────
app.route('/mcp', mcpRoute);

// ─── Public API routes (rate-limited, no auth) ─────────────────────
app.use('/api/context*', auditMiddleware);
app.route('/api/context', contextRoute);

app.use('/api/site-metrics*', auditMiddleware);
app.get('/api/site-metrics', async (c) => {
  // Delegate to contextRoute handler
  return c.redirect('/api/context/site-metrics', 307);
});

app.use('/api/worldmodel*', auditMiddleware);
app.route('/api/worldmodel', worldModelRoute);

app.use('/api/intake*', auditMiddleware);
app.route('/api/intake', intakeRoute);

app.use('/api/token*', auditMiddleware);
app.route('/api/token', tokenRoute);
// Legacy /token prefix (kept for backward compat)
app.route('/token', tokenRoute);

app.use('/api/bidwall*', auditMiddleware);
app.route('/api/bidwall', bidwallRoute);

app.use('/api/revenue*', auditMiddleware);
app.route('/api/revenue', revenueRoute);

app.use('/api/agent-access*', auditMiddleware);
app.route('/api/agent-access', agentAccessRoute);

// ─── Authenticated v2 routes (auth enforced inside v2 router) ──────
app.use('/api/v2*', auditMiddleware);
app.route('/api/v2', v2Routes);

// ─── Legacy /api/mcp ────────────────────────────────────────────────
app.route('/api/mcp', mcpRoute);

// ─── Error handling ─────────────────────────────────────────────────
app.onError(errorHandler);
app.notFound((c) => c.json({ ok: false, error: 'Not found', code: 'NOT_FOUND' }, 404));

export { app };
