/**
 * World-model node round-trips + ALLOWED_EDGES ↔ RELATIONSHIPS coverage
 */
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_EDGES,
  RELATIONSHIPS,
  WorldModelDomain,
  type AnyNode,
  type HumanNode,
  type GoalNode,
  type RuleNode,
  type FactNode,
  type ActionNode,
  type PolicyNode,
  type ReceiptNode,
  type PatternNode,
  type SessionNode,
  type DeadlineNode,
  type ConnectionNode,
  type InsightNode,
  type AuditEntryNode,
} from '../src/index.js';
import { AuthorityLevel } from '../src/types/domains.js';

const now = new Date('2026-07-30T00:00:00.000Z');

function base(overrides: Partial<AnyNode> & { nodeType: AnyNode['nodeType'] }): AnyNode {
  const common = {
    id: '00000000-0000-0000-0000-000000000001',
    createdAt: now,
    updatedAt: now,
    domain: WorldModelDomain.FOUNDATION,
    confidence: 1,
    version: 1,
    isDeleted: false,
  };
  return { ...common, ...overrides } as AnyNode;
}

function roundTrip<T extends AnyNode>(node: T): T {
  const json = JSON.stringify(node, (_k, v) => (v instanceof Date ? v.toISOString() : v));
  const parsed = JSON.parse(json) as Record<string, unknown>;
  // Restore Date fields commonly present on nodes
  for (const key of Object.keys(parsed)) {
    const val = parsed[key];
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      parsed[key] = new Date(val);
    }
  }
  return parsed as T;
}

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

describe('13 node types serialize/deserialize', () => {
  const fixtures: Record<(typeof NODE_TYPES)[number], AnyNode> = {
    Human: base({
      nodeType: 'Human',
      name: 'Ada',
      values: ['truth'],
      constraints: [],
    }) as HumanNode,
    Goal: base({
      nodeType: 'Goal',
      domain: WorldModelDomain.VISION,
      name: 'Ship',
      description: 'Launch XIOM',
      progress: 0.5,
      status: 'active',
      priority: 8,
      successCriteria: ['live'],
      blockers: [],
    }) as GoalNode,
    Rule: base({
      nodeType: 'Rule',
      condition: 'always',
      action: 'log',
      authorityLevel: AuthorityLevel.CONFIRM,
      policyVersion: 1,
      isActive: true,
      triggerCount: 0,
    }) as RuleNode,
    Fact: base({
      nodeType: 'Fact',
      domain: WorldModelDomain.TRACK,
      content: 'USDG on Robinhood Chain',
      sourceType: 'manual',
      isStale: false,
    }) as FactNode,
    Action: base({
      nodeType: 'Action',
      domain: WorldModelDomain.EXECUTION,
      actionType: 'email.send',
      intent: 'notify',
      executionStatus: 'proposed',
    }) as ActionNode,
    Policy: base({
      nodeType: 'Policy',
      name: 'No payments',
      description: 'block payments',
      condition: "action.actionType.includes('payment')",
      effect: 'block',
      policyVersion: 1,
      isActive: true,
      approvedBy: 'human',
    }) as PolicyNode,
    Receipt: base({
      nodeType: 'Receipt',
      domain: WorldModelDomain.TRACK,
      receiptNumber: '2026-07-30-0001',
      intent: 'test',
      context: '{}',
      policy: 'none',
      action: 'noop',
      result: 'ok',
      isApproved: true,
      rollbackAvailable: false,
      prevHash: '0'.repeat(64),
      hash: 'a'.repeat(64),
    }) as ReceiptNode,
    Pattern: base({
      nodeType: 'Pattern',
      domain: WorldModelDomain.SYMBIOSIS,
      description: 'morning focus',
      patternType: 'temporal',
      detectedAt: now,
      evidenceCount: 3,
      isConfirmedByUser: false,
      affectsDecisions: true,
    }) as PatternNode,
    Session: base({
      nodeType: 'Session',
      domain: WorldModelDomain.EXECUTION,
      provider: 'claude-code',
      startedAt: now,
      messageCount: 10,
      actionsExecuted: 2,
      isRecoverable: true,
      manifest: { toolsUsed: ['bash'] },
    }) as SessionNode,
    Deadline: base({
      nodeType: 'Deadline',
      domain: WorldModelDomain.TACTICS,
      name: 'Launch',
      dueAt: now,
      status: 'pending',
      alertsSent: 0,
    }) as DeadlineNode,
    Connection: base({
      nodeType: 'Connection',
      name: 'Partner',
      contactInfo: { email: 'a@b.c' },
      trustLevel: 'high',
    }) as ConnectionNode,
    Insight: base({
      nodeType: 'Insight',
      domain: WorldModelDomain.SYMBIOSIS,
      description: 'Demand spike',
      insightType: 'opportunity',
      confidence: 0.8,
      evidenceIds: [],
      actionable: true,
    }) as InsightNode,
    AuditEntry: base({
      nodeType: 'AuditEntry',
      domain: WorldModelDomain.TRACK,
      operation: 'create',
      actorType: 'agent',
      actorId: 'agent-1',
      targetNodeId: '00000000-0000-0000-0000-000000000099',
      targetNodeType: 'Goal',
      changeDescription: 'create',
      prevHash: '0'.repeat(64),
      hash: 'b'.repeat(64),
      isVerified: false,
    }) as AuditEntryNode,
  };

  it('defines exactly 13 node types', () => {
    expect(NODE_TYPES).toHaveLength(13);
    expect(Object.keys(fixtures)).toHaveLength(13);
  });

  for (const type of NODE_TYPES) {
    it(`${type} JSON round-trip preserves nodeType and key fields`, () => {
      const original = fixtures[type];
      const restored = roundTrip(original);
      expect(restored.nodeType).toBe(type);
      expect(restored.id).toBe(original.id);
      expect(restored.domain).toBe(original.domain);
      expect(restored.confidence).toBe(original.confidence);
      expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString());
    });
  }
});

describe('ALLOWED_EDGES covers RELATIONSHIPS', () => {
  it('every RELATIONSHIPS value has an ALLOWED_EDGES entry', () => {
    const relValues = Object.values(RELATIONSHIPS);
    for (const rel of relValues) {
      expect(ALLOWED_EDGES[rel], `missing ALLOWED_EDGES for ${rel}`).toBeDefined();
      expect(ALLOWED_EDGES[rel]!.from.length).toBeGreaterThan(0);
      expect(ALLOWED_EDGES[rel]!.to.length).toBeGreaterThan(0);
    }
  });

  it('ALLOWED_EDGES keys are all known RELATIONSHIPS', () => {
    const known = new Set(Object.values(RELATIONSHIPS));
    for (const key of Object.keys(ALLOWED_EDGES)) {
      expect(known.has(key as (typeof RELATIONSHIPS)[keyof typeof RELATIONSHIPS])).toBe(true);
    }
  });

  it('HAS_GOAL only allows Human → Goal', () => {
    expect(ALLOWED_EDGES.HAS_GOAL).toEqual({ from: ['Human'], to: ['Goal'] });
  });
});
