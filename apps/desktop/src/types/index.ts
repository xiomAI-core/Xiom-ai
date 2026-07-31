// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Frontend TypeScript Types
// Mirror of the Rust DTOs from commands/mod.rs
// ──────────────────────────────────────────────────────────────

export type Provider = 'claude-code' | 'codex' | 'gemini' | 'grok' | 'custom';
export type AuthorityLevel = 'observe' | 'suggest' | 'confirm' | 'supervised' | 'autonomous';
export type SessionStatus = 'active' | 'closed' | 'recovering';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface WorldModelProjection {
  node_count: number;
  edge_count: number;
  active_goal_count: number;
  active_policy_count: number;
  generated_at: string;
}

export interface AppHealth {
  neo4j: boolean;
  sqlite: boolean;
  mcp: boolean;
  node_count: number;
  session_count: number;
}

export interface Neo4jStatus {
  connected: boolean;
  node_count: number;
  version: string;
}

export interface GoalData {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: GoalStatus;
  priority: number;
  domain: string;
}

export interface ReceiptData {
  id: string;
  receipt_number: string;
  intent: string;
  action: string;
  result: string;
  policy: string;
  hash: string;
  prev_hash: string;
  is_approved: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  seq: number;
}

export interface SessionSummary {
  id: string;
  provider: string;
  started_at: string;
  ended_at?: string;
  message_count: number;
  is_recoverable: boolean;
  status: SessionStatus;
}

export interface PolicyRecord {
  id: string;
  name: string;
  description: string;
  condition: string;
  effect: 'block' | 'require_approval' | 'warn' | 'allow';
  version: number;
  approvedBy: string;
  createdAt: string;
  isActive?: boolean;
}

export interface ContextCapsule {
  human_id: string;
  active_goals: GoalData[];
  recent_facts: unknown[];
  active_policies: unknown[];
  pending_actions: unknown[];
  patterns: unknown[];
  generated_at: string;
}

export interface GuardianInput {
  operation: string;
  actor_type: 'human' | 'agent' | 'system';
  actor_id: string;
  payload: unknown;
  authority_level: AuthorityLevel;
}

export interface GuardianResult {
  allowed: boolean;
  requires_human_approval: boolean;
  denied_layers: number[];
  reason?: string;
  warnings: string[];
}

// ─── Graph viewer types ───────────────────────────────────────

export type WorldModelDomain =
  | 'FOUNDATION' | 'VISION' | 'STRATEGY' | 'TACTICS'
  | 'EXECUTION' | 'TRACK' | 'SYMBIOSIS';

export interface GraphNode {
  id: string;
  node_type: string;
  domain: WorldModelDomain;
  label: string;
  // D3 SimulationNodeDatum fields (optional, set by D3 during simulation)
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  from_id: string;
  to_id: string;
  rel_type: string;
  // D3 source/target resolved separately in D3Link — not stored here
}

export interface WorldModelGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  node_count: number;
  edge_count: number;
}
