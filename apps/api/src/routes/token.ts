/**
 * Token routes — XIOM token price, holders, and holder map
 */
import { Hono } from 'hono';
import { tokenCache } from '../daemons/tokenTelemetry.js';

export const tokenRoute = new Hono();

tokenRoute.get('/info', (c) => {
  return c.json({
    symbol: 'XIOM',
    name: 'XIOM Token',
    address: process.env['XIOM_TOKEN_ADDRESS'] ?? null,
    chain: 'robinhood_chain',
    chainId: 4663,
    decimals: 18,
  });
});

tokenRoute.get('/price', (c) => {
  return c.json({
    ok: true,
    priceUsd: tokenCache.priceUsd,
    priceChange24h: tokenCache.priceChange24h,
    volume24h: tokenCache.volume24h,
    marketCapUsd: tokenCache.marketCapUsd,
    source: tokenCache.source,
    timestamp: tokenCache.lastUpdatedAt,
  });
});

tokenRoute.get('/holders', (c) => {
  return c.json({
    ok: true,
    holderCount: tokenCache.holderCount,
    timestamp: tokenCache.lastUpdatedAt,
  });
});

tokenRoute.get('/holders-map', (c) => {
  const page = Number(c.req.query('page') ?? '1');
  const limit = Math.min(Number(c.req.query('limit') ?? '100'), 500);
  const offset = (page - 1) * limit;
  const sliced = tokenCache.holders.slice(offset, offset + limit);

  return c.json({
    ok: true,
    holders: sliced,
    total: tokenCache.holders.length,
    page,
    limit,
    hasMore: offset + limit < tokenCache.holders.length,
  });
});

tokenRoute.get('/holders-map-temporal', (c) => {
  return c.json({
    ok: true,
    snapshots: tokenCache.temporalSnapshots,
    count: tokenCache.temporalSnapshots.length,
    timestamp: new Date().toISOString(),
  });
});

// Legacy endpoint
tokenRoute.get('/holders/snapshot', (c) => {
  return c.json({
    holders: tokenCache.holders,
    snapshot_at: tokenCache.lastUpdatedAt,
    total: tokenCache.holderCount,
  });
});
