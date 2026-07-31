// ──────────────────────────────────────────────────────────────
// @xiom/world-model — Public API
// Neo4j-backed constitutional knowledge graph for the XIOM system.
// ──────────────────────────────────────────────────────────────

// ─── Domain & Authority enums ─────────────────────────────────
export { WorldModelDomain, AuthorityLevel } from './types/domains.js';

// ─── Node type interfaces ─────────────────────────────────────
export type {
  BaseNode,
  HumanNode,
  GoalNode,
  RuleNode,
  FactNode,
  ActionNode,
  PolicyNode,
  ReceiptNode,
  PatternNode,
  SessionNode,
  SessionManifest,
  DeadlineNode,
  ConnectionNode,
  InsightNode,
  AuditEntryNode,
  AnyNode,
} from './types/nodes.js';

// ─── Relationship constants & edge matrix ─────────────────────
export { RELATIONSHIPS, ALLOWED_EDGES } from './types/relationships.js';
export type { RelationshipType } from './types/relationships.js';

// ─── Connection manager ───────────────────────────────────────
export { Neo4jConnectionManager, createConnectionManager } from './connection.js';
export type { Neo4jConfig } from './connection.js';

// ─── Schema initializer ───────────────────────────────────────
export { initializeSchema } from './schema.js';

// ─── Query helpers — Goals ────────────────────────────────────
export {
  createGoal,
  getGoal,
  getGoalsForHuman,
  updateGoalProgress,
  getBlockedGoals,
  getDriftingGoals,
} from './queries/goals.js';

// ─── Query helpers — Facts ────────────────────────────────────
export {
  writeFact,
  getRelevantFacts,
  markFactStale,
  getStaleFactsForHuman,
} from './queries/facts.js';

// ─── Query helpers — Actions ──────────────────────────────────
export {
  proposeAction,
  approveAction,
  completeAction,
  failAction,
  getPendingActionsForHuman,
} from './queries/actions.js';

// ─── Query helpers — Receipts ─────────────────────────────────
export {
  createReceipt,
  getReceiptsForAction,
  verifyReceiptChain,
} from './queries/receipts.js';

// ─── Query helpers — World Model projections ──────────────────
export {
  getWorldModelProjection,
  getContextCapsule,
  exportWorldModel,
} from './queries/worldmodel.js';

export type {
  WorldModelProjection,
  ContextCapsule,
  WorldModelEdge,
  WorldModelExport,
} from './queries/worldmodel.js';

// ─── Re-export @xiom/types for convenience ────────────────────
export * from '@xiom/types';
