/**
 * Health route — service health and dependency checks
 */
import { Hono } from 'hono';
import { checkNeo4jHealth, checkPostgresHealth } from '../lib/health.js';

export const healthRoute = new Hono();

healthRoute.get('/', async (c) => {
  const [neo4j, postgres] = await Promise.allSettled([
    checkNeo4jHealth(),
    checkPostgresHealth(),
  ]);
  return c.json({
    ok: true,
    service: 'xiom-api',
    version: process.env['npm_package_version'] ?? '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    neo4j: neo4j.status === 'fulfilled' ? neo4j.value : false,
    postgres: postgres.status === 'fulfilled' ? postgres.value : false,
  });
});
