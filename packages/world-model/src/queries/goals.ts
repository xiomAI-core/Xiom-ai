// ──────────────────────────────────────────────────────────────
// XIOM World Model — Goal Query Helpers
// ──────────────────────────────────────────────────────────────
import type { Neo4jConnectionManager } from '../connection.js';
import type { GoalNode } from '../types/nodes.js';
import { WorldModelDomain } from '../types/domains.js';

type CreateGoalData = Omit<
  GoalNode,
  'id' | 'nodeType' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted'
>;

/**
 * Create a new Goal node and attach it to the Human via HAS_GOAL.
 */
export async function createGoal(
  conn: Neo4jConnectionManager,
  humanId: string,
  data: CreateGoalData
): Promise<GoalNode> {
  const id = crypto.randomUUID();
  const now = new Date();

  const cypher = `
    MATCH (h:Human {id: $humanId})
    CREATE (g:Goal {
      id:              $id,
      nodeType:        'Goal',
      name:            $name,
      description:     $description,
      progress:        $progress,
      status:          $status,
      priority:        $priority,
      successCriteria: $successCriteria,
      blockers:        $blockers,
      domain:          $domain,
      confidence:      $confidence,
      version:         1,
      isDeleted:       false,
      createdAt:       $now,
      updatedAt:       $now
    })
    CREATE (h)-[:HAS_GOAL]->(g)
    RETURN g { .* } AS goal
  `;

  const params: Record<string, unknown> = {
    humanId,
    id,
    name:            data.name,
    description:     data.description,
    progress:        data.progress,
    status:          data.status,
    priority:        data.priority,
    successCriteria: data.successCriteria,
    blockers:        data.blockers,
    domain:          data.domain,
    confidence:      data.confidence,
    now:             now.toISOString(),
  };

  if (data.deadline !== undefined) {
    params['deadline'] = data.deadline.toISOString();
  }

  const result = await conn.queryOne<{ goal: Record<string, unknown> }>(
    cypher,
    params
  );

  if (!result) throw new Error(`Failed to create goal — human ${humanId} not found`);
  return mapGoal(result.goal);
}

/**
 * Fetch a single goal by ID. Returns null if not found or soft-deleted.
 */
export async function getGoal(
  conn: Neo4jConnectionManager,
  goalId: string
): Promise<GoalNode | null> {
  const result = await conn.queryOne<{ goal: Record<string, unknown> }>(
    `MATCH (g:Goal {id: $goalId, isDeleted: false}) RETURN g { .* } AS goal`,
    { goalId }
  );
  return result ? mapGoal(result.goal) : null;
}

/**
 * Get all goals for a human, optionally filtered by status.
 */
export async function getGoalsForHuman(
  conn: Neo4jConnectionManager,
  humanId: string,
  status?: GoalNode['status']
): Promise<GoalNode[]> {
  const cypher = status
    ? `MATCH (:Human {id: $humanId})-[:HAS_GOAL]->(g:Goal {isDeleted: false, status: $status}) RETURN g { .* } AS goal`
    : `MATCH (:Human {id: $humanId})-[:HAS_GOAL]->(g:Goal {isDeleted: false}) RETURN g { .* } AS goal`;

  const params: Record<string, unknown> = { humanId };
  if (status !== undefined) params['status'] = status;

  const rows = await conn.queryMany<{ goal: Record<string, unknown> }>(cypher, params);
  return rows.map((r) => mapGoal(r.goal));
}

/**
 * Update a goal's progress percentage (0.0 → 1.0).
 */
export async function updateGoalProgress(
  conn: Neo4jConnectionManager,
  goalId: string,
  progress: number
): Promise<void> {
  await conn.query(
    `MATCH (g:Goal {id: $goalId})
     SET g.progress = $progress, g.updatedAt = $now, g.version = g.version + 1`,
    { goalId, progress, now: new Date().toISOString() }
  );
}

/**
 * Get all active goals that have at least one blocker relationship.
 */
export async function getBlockedGoals(
  conn: Neo4jConnectionManager,
  humanId: string
): Promise<GoalNode[]> {
  const rows = await conn.queryMany<{ goal: Record<string, unknown> }>(
    `MATCH (:Human {id: $humanId})-[:HAS_GOAL]->(g:Goal {status: 'active', isDeleted: false})
     WHERE size(g.blockers) > 0
     RETURN g { .* } AS goal`,
    { humanId }
  );
  return rows.map((r) => mapGoal(r.goal));
}

/**
 * Get active goals where the most recent linked Action is older than
 * `daysThreshold` days (goals that have "drifted" without progress).
 */
export async function getDriftingGoals(
  conn: Neo4jConnectionManager,
  humanId: string,
  daysThreshold: number
): Promise<GoalNode[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysThreshold);

  const rows = await conn.queryMany<{ goal: Record<string, unknown> }>(
    `MATCH (:Human {id: $humanId})-[:HAS_GOAL]->(g:Goal {status: 'active', isDeleted: false})
     OPTIONAL MATCH (g)-[:LINKED_TO_ACTION]->(a:Action)
     WITH g, max(a.createdAt) AS lastAction
     WHERE lastAction IS NULL OR lastAction < $cutoff
     RETURN g { .* } AS goal
     ORDER BY g.priority DESC`,
    { humanId, cutoff: cutoff.toISOString() }
  );
  return rows.map((r) => mapGoal(r.goal));
}

// ─── Mapper ───────────────────────────────────────────────────

function mapGoal(raw: Record<string, unknown>): GoalNode {
  const base = {
    id:              String(raw['id'] ?? ''),
    nodeType:        'Goal' as const,
    name:            String(raw['name'] ?? ''),
    description:     String(raw['description'] ?? ''),
    progress:        Number(raw['progress'] ?? 0),
    status:          (raw['status'] ?? 'active') as GoalNode['status'],
    priority:        Number(raw['priority'] ?? 5),
    successCriteria: (raw['successCriteria'] as string[]) ?? [],
    blockers:        (raw['blockers'] as string[]) ?? [],
    domain:          (raw['domain'] as WorldModelDomain) ?? WorldModelDomain.VISION,
    confidence:      Number(raw['confidence'] ?? 1),
    version:         Number(raw['version'] ?? 1),
    isDeleted:       Boolean(raw['isDeleted'] ?? false),
    createdAt:       raw['createdAt'] ? new Date(String(raw['createdAt'])) : new Date(),
    updatedAt:       raw['updatedAt'] ? new Date(String(raw['updatedAt'])) : new Date(),
  };

  if (raw['deadline'] !== undefined && raw['deadline'] !== null) {
    return { ...base, deadline: new Date(String(raw['deadline'])) };
  }
  if (raw['source'] !== undefined) {
    return { ...base, source: String(raw['source']) };
  }
  return base;
}
