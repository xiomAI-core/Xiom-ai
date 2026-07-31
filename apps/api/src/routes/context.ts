/**
 * Context routes — public XIOM context and site metrics
 */
import { Hono } from 'hono';
import { createRateLimit } from '../middleware/rate-limit.js';
import { cache } from '../lib/cache.js';
import { worldModelCache } from '../daemons/worldModelSync.js';
import { tokenCache } from '../daemons/tokenTelemetry.js';
import { bidwallCache } from '../daemons/bidwallMonitor.js';
import { intakeMetricsCache } from '../daemons/intakeMetrics.js';

export const contextRoute = new Hono();

contextRoute.get('/', createRateLimit(100), async (c) => {
  const cached = cache.get<object>('public:context');
  if (cached) {
    c.header('X-Cache', 'HIT');
    c.header('Cache-Control', 'public, max-age=60');
    return c.json(cached);
  }

  const ctx = {
    ok: true,
    service: 'xiom-api',
    version: process.env['npm_package_version'] ?? '0.1.0',
    tagline: 'Constitutional personal AI operating system',
    website: 'https://xiom-ai.com',
    token: {
      symbol: 'XIOM',
      chain: 'robinhood_chain',
      chainId: 4663,
      address: process.env['XIOM_TOKEN_ADDRESS'] ?? null,
      priceUsd: tokenCache.priceUsd,
      holderCount: tokenCache.holderCount,
    },
    worldModel: {
      totalNodes: worldModelCache.totalNodes,
      totalEdges: worldModelCache.totalEdges,
      domains: worldModelCache.domains,
      lastUpdatedAt: worldModelCache.lastUpdatedAt,
    },
    timestamp: new Date().toISOString(),
  };

  cache.set('public:context', ctx, 60_000);
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(ctx);
});

contextRoute.get('/site-metrics', createRateLimit(60), async (c) => {
  const cached = cache.get<object>('public:site-metrics');
  if (cached) {
    c.header('X-Cache', 'HIT');
    c.header('Cache-Control', 'public, max-age=30');
    return c.json(cached);
  }

  const metrics = {
    ok: true,
    nodeCount: worldModelCache.totalNodes,
    edgeCount: worldModelCache.totalEdges,
    intakeCount: intakeMetricsCache.total,
    holderCount: tokenCache.holderCount,
    revenueUsd: bidwallCache.revenueUsd,
    timestamp: new Date().toISOString(),
  };

  cache.set('public:site-metrics', metrics, 30_000);
  c.header('Cache-Control', 'public, max-age=30');
  return c.json(metrics);
});
