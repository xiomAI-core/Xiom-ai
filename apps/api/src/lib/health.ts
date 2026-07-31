/**
 * Health check helpers — ping Neo4j and PostgreSQL
 */
import { getNeo4jDriver } from '../services/neo4j.js';
import { db } from './db.js';
import { logger } from './logger.js';

export async function checkNeo4jHealth(): Promise<boolean> {
  try {
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
      await session.run('RETURN 1');
      return true;
    } finally {
      await session.close();
    }
  } catch (err) {
    logger.warn({ err }, 'Neo4j health check failed');
    return false;
  }
}

export async function checkPostgresHealth(): Promise<boolean> {
  try {
    await db.execute('SELECT 1' as unknown as Parameters<typeof db.execute>[0]);
    return true;
  } catch (err) {
    logger.warn({ err }, 'PostgreSQL health check failed');
    return false;
  }
}
