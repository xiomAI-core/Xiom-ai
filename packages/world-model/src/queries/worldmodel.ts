// ──────────────────────────────────────────────────────────────
// XIOM World Model — High-Level Projection & Context Queries
// ──────────────────────────────────────────────────────────────
import type { Neo4jConnectionManager } from '../connection.js';
import type { ActionNode, FactNode, GoalNode, PatternNode, PolicyNode, AnyNode } from '../types/nodes.js';

// ─── Return Types ─────────────────────────────────────────────

export interface WorldModelProjection {
  /** Node counts grouped by domain */
  nodeCountByDomain: Record<string, number>;
  totalEdges: number;
  /** Most recent 10 actions */
  recentActions: ActionNode[];
  activeGoalCount: number;
  activePolicyCount: number;
  generatedAt: string;
}

export interface ContextCapsule {
  humanId: string;
  /** All active (non-paused, non-completed) goals */
  activeGoals: GoalNode[];
  /** The 20 most recently created non-stale facts */
  recentFacts: FactNode[];
  /** All active policies sorted by version desc */
  activePolicies: PolicyNode[];
  /** All proposed/approved actions awaiting execution */
  pendingActions: ActionNode[];
  /** All confirmed patterns */
  patterns: PatternNode[];
  generatedAt: string;
}

export interface WorldModelEdge {
  from: string;
  to: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface WorldModelExport {
  humanId: string;
  exportedAt: string;
  version: string;
  nodes: AnyNode[];
  edges: WorldModelEdge[];
}

// ─── Queries ──────────────────────────────────────────────────

/**
 * Return a lightweight dashboard projection for a human's world model.
 */
export async function getWorldModelProjection(
  conn: Neo4jConnectionManager,
  humanId: string
): Promise<WorldModelProjection> {
  // Domain counts
  const domainRows = await conn.queryMany<{ domain: string; count: number }>(
    `MATCH (:Human {id: $humanId})-[*1..4]->(n)
     WHERE n.isDeleted = false
     RETURN n.domain AS domain, count(n) AS count`,
    { humanId }
  );

  const nodeCountByDomain: Record<string, number> = {};
  for (const row of domainRows) {
    nodeCountByDomain[row.domain] = Number(row.count);
  }

  // Edge count
  const edgeResult = await conn.queryOne<{ count: number }>(
    `MATCH (:Human {id: $humanId})-[r*1..4]-()
     RETURN count(r) AS count`,
    { humanId }
  );

  // Recent actions
  const actionRows = await conn.queryMany<{ a: Record<string, unknown> }>(
    `MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action {isDeleted: false})
     RETURN a { .* } AS a
     ORDER BY a.createdAt DESC
     LIMIT 10`,
    { humanId }
  );

  // Active goals count
  const goalResult = await conn.queryOne<{ count: number }>(
    `MATCH (:Human {id: $humanId})-[:HAS_GOAL]->(g:Goal {status: 'active', isDeleted: false})
     RETURN count(g) AS count`,
    { humanId }
  );

  // Active policies count
  const policyResult = await conn.queryOne<{ count: number }>(
    `MATCH (:Human {id: $humanId})-[:HAS_RULE]->(p:Policy {isActive: true, isDeleted: false})
     RETURN count(p) AS count`,
    { humanId }
  );

  return {
    nodeCountByDomain,
    totalEdges: Number(edgeResult?.count ?? 0),
    recentActions: actionRows.map((r) => r.a as unknown as ActionNode),
    activeGoalCount: Number(goalResult?.count ?? 0),
    activePolicyCount: Number(policyResult?.count ?? 0),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Build the context capsule injected into every AI session.
 * Provides the AI with the minimum necessary world model context.
 */
export async function getContextCapsule(
  conn: Neo4jConnectionManager,
  humanId: string
): Promise<ContextCapsule> {
  const [goals, facts, policies, actions, patterns] = await Promise.all([
    conn.queryMany<{ g: Record<string, unknown> }>(
      `MATCH (:Human {id: $humanId})-[:HAS_GOAL]->(g:Goal {isDeleted: false})
       WHERE g.status IN ['active', 'paused']
       RETURN g { .* } AS g
       ORDER BY g.priority DESC`,
      { humanId }
    ),
    conn.queryMany<{ f: Record<string, unknown> }>(
      `MATCH (:Human {id: $humanId})-[:USED_FACT]->(f:Fact {isStale: false, isDeleted: false})
       RETURN f { .* } AS f
       ORDER BY f.createdAt DESC
       LIMIT 20`,
      { humanId }
    ),
    conn.queryMany<{ p: Record<string, unknown> }>(
      `MATCH (:Human {id: $humanId})-[:HAS_RULE]->(p:Policy {isActive: true, isDeleted: false})
       RETURN p { .* } AS p
       ORDER BY p.policyVersion DESC`,
      { humanId }
    ),
    conn.queryMany<{ a: Record<string, unknown> }>(
      `MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action {isDeleted: false})
       WHERE a.executionStatus IN ['proposed', 'approved']
       RETURN a { .* } AS a
       ORDER BY a.createdAt DESC`,
      { humanId }
    ),
    conn.queryMany<{ pt: Record<string, unknown> }>(
      `MATCH (:Human {id: $humanId})-[:HAS_PATTERN]->(pt:Pattern {isDeleted: false})
       RETURN pt { .* } AS pt
       ORDER BY pt.detectedAt DESC`,
      { humanId }
    ),
  ]);

  return {
    humanId,
    activeGoals:    goals.map((r) => r.g as unknown as GoalNode),
    recentFacts:    facts.map((r) => r.f as unknown as FactNode),
    activePolicies: policies.map((r) => r.p as unknown as PolicyNode),
    pendingActions: actions.map((r) => r.a as unknown as ActionNode),
    patterns:       patterns.map((r) => r.pt as unknown as PatternNode),
    generatedAt:    new Date().toISOString(),
  };
}

/**
 * Export the entire world model as a portable JSON snapshot.
 * Useful for backup, migration, or inter-system sync.
 */
export async function exportWorldModel(
  conn: Neo4jConnectionManager,
  humanId: string
): Promise<WorldModelExport> {
  const [nodeRows, edgeRows] = await Promise.all([
    conn.queryMany<{ n: Record<string, unknown> }>(
      `MATCH (:Human {id: $humanId})-[*0..5]->(n)
       WHERE n.isDeleted = false
       RETURN DISTINCT n { .* } AS n`,
      { humanId }
    ),
    conn.queryMany<{ from: string; to: string; type: string; props: Record<string, unknown> }>(
      `MATCH (:Human {id: $humanId})-[*0..5]->(a)-[r]->(b)
       WHERE a.isDeleted = false AND b.isDeleted = false
       RETURN DISTINCT
         a.id           AS from,
         b.id           AS to,
         type(r)        AS type,
         properties(r)  AS props`,
      { humanId }
    ),
  ]);

  return {
    humanId,
    exportedAt: new Date().toISOString(),
    version:    '1.0.0',
    nodes:      nodeRows.map((r) => r.n as unknown as AnyNode),
    edges:      edgeRows.map((r) => ({
      from:       r.from,
      to:         r.to,
      type:       r.type,
      ...(Object.keys(r.props ?? {}).length > 0 ? { properties: r.props } : {}),
    })),
  };
}
