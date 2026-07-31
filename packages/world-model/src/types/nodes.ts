// ──────────────────────────────────────────────────────────────
// XIOM World Model — Node Type Definitions
// ──────────────────────────────────────────────────────────────
import type { WorldModelDomain, AuthorityLevel } from './domains.js';

// ─── Base Node ────────────────────────────────────────────────

/**
 * All nodes in the XIOM world model share this base structure.
 */
export interface BaseNode {
  /** UUID v4 — primary key */
  id: string;
  createdAt: Date;
  updatedAt: Date;
  domain: WorldModelDomain;
  /** Where this node originated (URI, session ID, integration name) */
  source?: string;
  /** Epistemic confidence in this node's accuracy: 0.0 → 1.0 */
  confidence: number;
  /** Monotonically increasing — starts at 1, incremented on every edit */
  version: number;
  /** Soft-delete flag — nodes are never hard-deleted from the graph */
  isDeleted: boolean;
}

// ─── Human Node ───────────────────────────────────────────────

export interface HumanNode extends BaseNode {
  nodeType: 'Human';
  name: string;
  displayName?: string;
  email?: string;
  walletAddress?: string;
  /** Core values that govern all decisions */
  values: string[];
  /** Hard constraints that cannot be overridden by any policy */
  constraints: string[];
  timezone?: string;
  locale?: string;
}

// ─── Goal Node ────────────────────────────────────────────────

export interface GoalNode extends BaseNode {
  nodeType: 'Goal';
  name: string;
  description: string;
  deadline?: Date;
  /** Completion progress: 0.0 → 1.0 */
  progress: number;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  /** Priority 1 (lowest) → 10 (highest) */
  priority: number;
  /** Conditions that define successful completion */
  successCriteria: string[];
  /** IDs of nodes blocking this goal */
  blockers: string[];
}

// ─── Rule Node ────────────────────────────────────────────────

export interface RuleNode extends BaseNode {
  nodeType: 'Rule';
  /** Natural-language if-then rule condition */
  condition: string;
  /** What the rule dictates should happen */
  action: string;
  authorityLevel: AuthorityLevel;
  policyVersion: number;
  isActive: boolean;
  lastTriggeredAt?: Date;
  triggerCount: number;
}

// ─── Fact Node ────────────────────────────────────────────────

export interface FactNode extends BaseNode {
  nodeType: 'Fact';
  content: string;
  sourceType: 'email' | 'calendar' | 'session' | 'manual' | 'sensor' | 'onchain';
  /** URI or ID of the original source document / event */
  sourceRef?: string;
  /** When this fact should be re-verified for staleness */
  expiresAt?: Date;
  isStale: boolean;
  /** 1536-dimensional vector for semantic similarity search */
  embedding?: number[];
}

// ─── Action Node ──────────────────────────────────────────────

export interface ActionNode extends BaseNode {
  nodeType: 'Action';
  /** Namespaced action type: calendar.create, email.send, etc. */
  actionType: string;
  /** Human-readable intent description */
  intent: string;
  policyId?: string;
  policyVersion?: number;
  executionStatus: 'proposed' | 'approved' | 'executing' | 'completed' | 'failed' | 'rolled_back';
  result?: string;
  errorMessage?: string;
  receiptId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
}

// ─── Policy Node ──────────────────────────────────────────────

export interface PolicyNode extends BaseNode {
  nodeType: 'Policy';
  name: string;
  description: string;
  /** Cypher expression or natural language condition that triggers this policy */
  condition: string;
  /** What happens when the policy condition is met */
  effect: string;
  policyVersion: number;
  /** ID of the previous version — forms a version chain */
  parentPolicyId?: string;
  isActive: boolean;
  approvedAt?: Date;
  approvedBy: 'human' | 'system';
  /** Window within which this policy can be reverted */
  rollbackAvailableUntil?: Date;
}

// ─── Receipt Node ─────────────────────────────────────────────

export interface ReceiptNode extends BaseNode {
  nodeType: 'Receipt';
  /** Human-readable sequential number: "2026-07-29-0001" */
  receiptNumber: string;
  intent: string;
  context: string;
  policy: string;
  action: string;
  result: string;
  isApproved: boolean;
  rollbackAvailable: boolean;
  /** SHA-256 of the previous receipt — forms an immutable hash chain */
  prevHash: string;
  /** SHA-256(prevHash + this receipt's content) */
  hash: string;
}

// ─── Pattern Node ─────────────────────────────────────────────

export interface PatternNode extends BaseNode {
  nodeType: 'Pattern';
  description: string;
  patternType: 'behavioral' | 'temporal' | 'preference' | 'risk';
  detectedAt: Date;
  evidenceCount: number;
  isConfirmedByUser: boolean;
  affectsDecisions: boolean;
}

// ─── Session Manifest ─────────────────────────────────────────

export interface SessionManifest {
  toolsUsed: string[];
  tokensConsumed?: number;
  summaryHash?: string;
  checkpointAt?: string; // ISO-8601
  recoveryKey?: string;
}

// ─── Session Node ─────────────────────────────────────────────

export interface SessionNode extends BaseNode {
  nodeType: 'Session';
  provider: 'claude-code' | 'codex' | 'gemini' | 'grok' | 'custom';
  startedAt: Date;
  endedAt?: Date;
  messageCount: number;
  actionsExecuted: number;
  isRecoverable: boolean;
  manifest: SessionManifest;
}

// ─── Deadline Node ────────────────────────────────────────────

export interface DeadlineNode extends BaseNode {
  nodeType: 'Deadline';
  name: string;
  dueAt: Date;
  linkedGoalId?: string;
  status: 'pending' | 'met' | 'missed' | 'extended';
  alertsSent: number;
}

// ─── Connection Node ──────────────────────────────────────────

export interface ConnectionNode extends BaseNode {
  nodeType: 'Connection';
  name: string;
  role?: string;
  contactInfo: Record<string, string>;
  trustLevel: 'high' | 'medium' | 'low';
  lastInteractionAt?: Date;
}

// ─── Insight Node ─────────────────────────────────────────────

export interface InsightNode extends BaseNode {
  nodeType: 'Insight';
  description: string;
  insightType: 'opportunity' | 'risk' | 'pattern' | 'correlation';
  /** Confidence specific to this insight (may differ from base confidence) */
  confidence: number;
  /** IDs of nodes that provide evidence for this insight */
  evidenceIds: string[];
  actionable: boolean;
  suggestedAction?: string;
}

// ─── Audit Entry Node ─────────────────────────────────────────

export interface AuditEntryNode extends BaseNode {
  nodeType: 'AuditEntry';
  operation: 'create' | 'update' | 'delete' | 'policy_check' | 'action_execute';
  actorType: 'human' | 'agent' | 'system' | 'daemon';
  actorId: string;
  targetNodeId: string;
  targetNodeType: string;
  changeDescription: string;
  /** SHA-256 of the previous AuditEntry — hash chain root is '0'.repeat(64) */
  prevHash: string;
  /** SHA-256(timestamp + operation + targetNodeId + prevHash) */
  hash: string;
  isVerified: boolean;
}

// ─── Union Type ───────────────────────────────────────────────

export type AnyNode =
  | HumanNode
  | GoalNode
  | RuleNode
  | FactNode
  | ActionNode
  | PolicyNode
  | ReceiptNode
  | PatternNode
  | SessionNode
  | DeadlineNode
  | ConnectionNode
  | InsightNode
  | AuditEntryNode;
