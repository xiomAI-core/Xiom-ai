/**
 * World model service — Neo4j graph operations
 */
import { runQuery } from './neo4j.js';

export async function getFullGraph() {
  // TODO: run Cypher MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 500
  const _ = runQuery;
  return { nodes: [], edges: [] };
}

export async function upsertNode(type: string, label: string, properties: Record<string, unknown>) {
  // TODO: MERGE (n:${type} {id: $id}) SET n += $props
  const _ = { type, label, properties };
  return { id: crypto.randomUUID() };
}

export async function createEdge(from: string, to: string, type: string) {
  // TODO: MATCH (a {id: $from}), (b {id: $to}) MERGE (a)-[:${type}]->(b)
  const _ = { from, to, type };
  return { created: true };
}
