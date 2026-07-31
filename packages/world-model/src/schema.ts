// ──────────────────────────────────────────────────────────────
// XIOM World Model — Schema Initialization
// Creates all Neo4j constraints and indexes on startup.
// ──────────────────────────────────────────────────────────────
import type { Neo4jConnectionManager } from './connection.js';

// ─── Constraint Statements ────────────────────────────────────

const NODE_TYPES = [
  'Human',
  'Goal',
  'Rule',
  'Fact',
  'Action',
  'Policy',
  'Receipt',
  'Pattern',
  'Session',
  'Deadline',
  'Connection',
  'Insight',
  'AuditEntry',
] as const;

type NodeType = typeof NODE_TYPES[number];

function uniqueConstraint(label: NodeType): string {
  const key = label.toLowerCase();
  return `CREATE CONSTRAINT ${key}_id IF NOT EXISTS FOR (n:${label}) REQUIRE n.id IS UNIQUE`;
}

// ─── Index Statements ─────────────────────────────────────────

const RANGE_INDEXES: Array<{ label: string; prop: string }> = [
  { label: 'Goal',       prop: 'deadline' },
  { label: 'Goal',       prop: 'status' },
  { label: 'Action',     prop: 'executionStatus' },
  { label: 'Action',     prop: 'createdAt' },
  { label: 'Fact',       prop: 'isStale' },
  { label: 'Fact',       prop: 'expiresAt' },
  { label: 'Receipt',    prop: 'hash' },
  { label: 'AuditEntry', prop: 'createdAt' },
  { label: 'Policy',     prop: 'isActive' },
  { label: 'Human',      prop: 'walletAddress' },
  { label: 'Pattern',    prop: 'patternType' },
  { label: 'Session',    prop: 'startedAt' },
];

function rangeIndex(label: string, prop: string): string {
  const key = `${label.toLowerCase()}_${prop.toLowerCase()}`;
  return `CREATE INDEX ${key} IF NOT EXISTS FOR (n:${label}) ON (n.${prop})`;
}

const FULLTEXT_INDEXES: Array<{ name: string; label: string; props: string[] }> = [
  { name: 'fact_content',  label: 'Fact',   props: ['content'] },
  { name: 'goal_search',   label: 'Goal',   props: ['name', 'description'] },
  { name: 'policy_search', label: 'Policy', props: ['name', 'description', 'condition'] },
  { name: 'insight_search',label: 'Insight',props: ['description'] },
];

function fulltextIndex(name: string, label: string, props: string[]): string {
  const propList = props.map((p) => `n.${p}`).join(', ');
  return `CREATE FULLTEXT INDEX ${name} IF NOT EXISTS FOR (n:${label}) ON EACH [${propList}]`;
}

// ─── Schema Initializer ───────────────────────────────────────

/**
 * Run all schema migrations (constraints + indexes) against the connected
 * Neo4j instance. Safe to call on every startup — all statements use
 * `IF NOT EXISTS` so they are idempotent.
 */
export async function initializeSchema(
  conn: Neo4jConnectionManager
): Promise<void> {
  const statements: string[] = [
    // Unique constraints for every node type
    ...NODE_TYPES.map(uniqueConstraint),

    // Range indexes
    ...RANGE_INDEXES.map(({ label, prop }) => rangeIndex(label, prop)),

    // Fulltext indexes
    ...FULLTEXT_INDEXES.map(({ name, label, props }) =>
      fulltextIndex(name, label, props)
    ),
  ];

  // Execute each DDL statement sequentially.
  // Neo4j requires schema changes to run in separate transactions.
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
    } catch (err) {
      // Log but don't throw — an individual index failure shouldn't block startup.
      // Common cause: Neo4j Community edition limits on fulltext indexes.
      console.warn(`[world-model] Schema stmt warning: ${String(err)}`);
      console.warn(`[world-model] Statement was: ${stmt}`);
    }
  }

  console.info(
    `[world-model] Schema initialized — ${statements.length} statements executed.`
  );
}
