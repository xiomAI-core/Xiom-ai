/**
 * Revenue routes — protocol revenue accounting
 */
import { Hono } from 'hono';
import { revenueCache } from '../daemons/revenueAccounting.js';

export const revenueRoute = new Hono();

revenueRoute.get('/moltlaunch', (c) => {
  return c.json({
    ok: true,
    totalUsdc: revenueCache.totalUsdc,
    totalTxns: revenueCache.totalTxns,
    last30dUsdc: revenueCache.last30dUsdc,
    flaunchFees: revenueCache.flaunchFees,
    acpEarnings: revenueCache.acpEarnings,
    timestamp: revenueCache.lastUpdatedAt,
  });
});

// Legacy endpoints
revenueRoute.get('/', (c) => {
  return c.json({
    totalUsdc: revenueCache.totalUsdc,
    totalTxns: revenueCache.totalTxns,
    last30d: revenueCache.last30dUsdc,
    timestamp: revenueCache.lastUpdatedAt,
  });
});

revenueRoute.get('/breakdown', (c) => {
  return c.json({
    guardian: '0',
    mcp: '0',
    agentAccess: revenueCache.acpEarnings,
    x402: '0',
    flaunch: revenueCache.flaunchFees,
  });
});
