/**
 * BidWall routes — balance, ETH price, snapshot, events
 */
import { Hono } from 'hono';
import { bidwallCache } from '../daemons/bidwallMonitor.js';

export const bidwallRoute = new Hono();

bidwallRoute.get('/balance', (c) => {
  return c.json({
    ok: true,
    balanceEth: bidwallCache.balanceEth,
    balanceUsd: bidwallCache.balanceUsd,
    contractAddress: process.env['BIDWALL_CONTRACT_ADDRESS'] ?? null,
    chainId: 4663,
    timestamp: bidwallCache.lastUpdatedAt,
  });
});

bidwallRoute.get('/eth-price', (c) => {
  return c.json({
    ok: true,
    ethPriceUsd: bidwallCache.ethPriceUsd,
    source: 'chainlink',
    timestamp: bidwallCache.lastUpdatedAt,
  });
});

bidwallRoute.get('/snapshot', (c) => {
  return c.json({
    ok: true,
    balanceEth: bidwallCache.balanceEth,
    balanceUsd: bidwallCache.balanceUsd,
    ethPriceUsd: bidwallCache.ethPriceUsd,
    revenueUsd: bidwallCache.revenueUsd,
    eventCount: bidwallCache.events.length,
    lastUpdatedAt: bidwallCache.lastUpdatedAt,
  });
});

bidwallRoute.get('/events', (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? '50'), 200);
  return c.json({
    ok: true,
    events: bidwallCache.events.slice(0, limit),
    total: bidwallCache.events.length,
  });
});

// Legacy endpoints
bidwallRoute.get('/state', (c) => {
  return c.json({
    totalDeposited: bidwallCache.balanceEth,
    currentBid: '0',
    topBidder: null,
  });
});

bidwallRoute.get('/bids', (c) => {
  return c.json({ bids: bidwallCache.events, total: bidwallCache.events.length });
});

bidwallRoute.post('/simulate', async (c) => {
  const body = await c.req.json();
  return c.json({ estimatedRevenue: '0', impact: 'low', ...body });
});
