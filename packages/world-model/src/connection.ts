// ──────────────────────────────────────────────────────────────
// XIOM World Model — Neo4j Connection Manager
// ──────────────────────────────────────────────────────────────
import neo4j from 'neo4j-driver';
import type {
  Driver,
  Session,
  Transaction,
  QueryResult,
} from 'neo4j-driver';

// ─── Config ───────────────────────────────────────────────────

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  /** Maximum number of connections in the pool (default: 50) */
  maxConnectionPoolSize?: number;
}

// ─── Connection Manager ───────────────────────────────────────

export class Neo4jConnectionManager {
  private readonly driver: Driver;

  constructor(config: Neo4jConfig) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.user, config.password),
      {
        maxConnectionPoolSize: config.maxConnectionPoolSize ?? 50,
        logging: neo4j.logging.console('warn'),
      }
    );
  }

  /**
   * Verify connectivity to the Neo4j instance.
   * Throws if the database is unreachable or credentials are wrong.
   */
  async connect(): Promise<void> {
    await this.driver.verifyConnectivity();
  }

  /**
   * Gracefully close all connections in the pool.
   */
  async disconnect(): Promise<void> {
    await this.driver.close();
  }

  /**
   * Return a new session. Callers are responsible for closing it.
   */
  getSession(): Session {
    return this.driver.session();
  }

  /**
   * Execute a Cypher statement and return the raw QueryResult.
   */
  async query(
    cypher: string,
    params: Record<string, unknown> = {}
  ): Promise<QueryResult> {
    const session = this.getSession();
    try {
      return await session.run(cypher, params);
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a Cypher statement and return the first record as T, or null.
   */
  async queryOne<T>(
    cypher: string,
    params: Record<string, unknown> = {}
  ): Promise<T | null> {
    const result = await this.query(cypher, params);
    const first = result.records[0];
    if (!first) return null;
    return first.toObject() as T;
  }

  /**
   * Execute a Cypher statement and return all records mapped to T.
   */
  async queryMany<T>(
    cypher: string,
    params: Record<string, unknown> = {}
  ): Promise<T[]> {
    const result = await this.query(cypher, params);
    return result.records.map((r) => r.toObject() as T);
  }

  /**
   * Execute a function inside an explicit write transaction.
   * Automatically commits on success, rolls back on any throw.
   */
  async withTransaction<T>(
    fn: (tx: Transaction) => Promise<T>
  ): Promise<T> {
    const session = this.getSession();
    const tx = session.beginTransaction();
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback();
      throw err;
    } finally {
      await session.close();
    }
  }
}

// ─── Singleton Factory ────────────────────────────────────────

/**
 * Create (or reuse) a Neo4jConnectionManager from a config object.
 * Call this once at application startup and inject the result everywhere.
 */
export function createConnectionManager(
  config: Neo4jConfig
): Neo4jConnectionManager {
  return new Neo4jConnectionManager(config);
}
