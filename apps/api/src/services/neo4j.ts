/**
 * Neo4j service — connects to the world model graph database
 */
import neo4j, { type Driver } from 'neo4j-driver';

let driver: Driver | null = null;

export function getNeo4jDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      process.env['NEO4J_URI'] ?? 'bolt://localhost:7687',
      neo4j.auth.basic(
        process.env['NEO4J_USER'] ?? 'neo4j',
        process.env['NEO4J_PASSWORD'] ?? 'password'
      )
    );
  }
  return driver;
}

export async function runQuery(cypher: string, params: Record<string, unknown> = {}) {
  const d = getNeo4jDriver();
  const session = d.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

export async function closNeo4j() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
