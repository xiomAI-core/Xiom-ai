/**
 * Shared Neo4j connection for daemons that use @xiom/world-model helpers.
 */
import {
  createConnectionManager,
  type Neo4jConnectionManager,
} from '@xiom/world-model';

let _conn: Neo4jConnectionManager | null = null;

export function getWmConn(): Neo4jConnectionManager {
  if (!_conn) {
    _conn = createConnectionManager({
      uri:      process.env['NEO4J_URI'] ?? 'bolt://localhost:7687',
      user:     process.env['NEO4J_USER'] ?? 'neo4j',
      password: process.env['NEO4J_PASSWORD'] ?? 'password',
    });
  }
  return _conn;
}
