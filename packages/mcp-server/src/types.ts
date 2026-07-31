// ──────────────────────────────────────────────────────────────
// @xiom/mcp-server — Shared types for the AI provider MCP lane
// ──────────────────────────────────────────────────────────────
import type {
  ActionNode,
  FactNode,
  GoalNode,
  PatternNode,
  PolicyNode,
  AuthorityLevel,
} from '@xiom/world-model';

/** Session continuity fields injected alongside the world-model capsule. */
export interface SessionManifestSummary {
  previousSessions: number;
  lastSessionAt: string;
  /** 0–1 how complete the available context is */
  continuityScore: number;
}

/**
 * Context capsule returned by `axiom_get_context_capsule`.
 * Extends world-model ContextCapsule with session + authority fields.
 */
export interface McpContextCapsule {
  humanId: string;
  activeGoals: GoalNode[];
  recentFacts: FactNode[];
  activePolicies: PolicyNode[];
  pendingActions: ActionNode[];
  patterns: PatternNode[];
  sessionManifest: SessionManifestSummary;
  authorityLevel: AuthorityLevel | string;
  generatedAt: string;
}

/** A single chat message stored in the session store. */
export interface SessionMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  timestamp: string;
  seq: number;
}

/**
 * Injectable session store — desktop owns SQLite; Node MCP uses
 * an in-memory stub by default.
 */
export interface SessionStore {
  getSessionHistory(sessionId: string, limit: number): Promise<SessionMessage[]>;
  getSessionManifestSummary(humanId?: string): Promise<SessionManifestSummary>;
  countPreviousSessions?(): Promise<number>;
}

export interface SoftPolicyCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  matchedPolicies: string[];
  warnings: string[];
}

export interface ToolHandlerResult {
  /** Structured JSON payload for clients that parse tool results */
  structured: unknown;
  /** Human-readable markdown / text for LLM consumption */
  text: string;
  isError?: boolean;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolHandlerResult>;

export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
}

export interface AxiomMcpServerOptions {
  humanId: string;
  authorityLevel?: AuthorityLevel | string;
  surfaceId?: string;
  currentSessionId?: string;
  neo4jUri?: string;
  neo4jUser?: string;
  neo4jPassword?: string;
  /** Injected connection manager (skips env-based connect) */
  conn?: import('@xiom/world-model').Neo4jConnectionManager;
  sessionStore?: SessionStore;
  actorId?: string;
}

/** Re-export commonly used world-model node types for consumers. */
export type { ActionNode, FactNode, GoalNode, PatternNode, PolicyNode, AuthorityLevel };
