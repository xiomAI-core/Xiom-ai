/**
 * Health check daemon — pings Neo4j and PostgreSQL, exports health status
 */
import { checkNeo4jHealth, checkPostgresHealth } from '../lib/health.js';
import { logger } from '../lib/logger.js';

export interface HealthStatus {
  neo4j: boolean;
  postgres: boolean;
  lastCheckedAt: string;
}

const healthStatus: HealthStatus = {
  neo4j: false,
  postgres: false,
  lastCheckedAt: new Date().toISOString(),
};

export function getHealthStatus(): HealthStatus {
  return healthStatus;
}

export async function healthCheckDaemon(): Promise<void> {
  try {
    const [neo4j, postgres] = await Promise.allSettled([
      checkNeo4jHealth(),
      checkPostgresHealth(),
    ]);

    healthStatus.neo4j = neo4j.status === 'fulfilled' ? neo4j.value : false;
    healthStatus.postgres = postgres.status === 'fulfilled' ? postgres.value : false;
    healthStatus.lastCheckedAt = new Date().toISOString();

    logger.debug({ neo4j: healthStatus.neo4j, postgres: healthStatus.postgres }, 'healthCheck: tick');
  } catch (err) {
    logger.warn({ err }, 'healthCheck: failed');
  }
}
