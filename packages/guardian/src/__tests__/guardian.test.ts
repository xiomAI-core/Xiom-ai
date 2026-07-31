// ──────────────────────────────────────────────────────────────
// XIOM Guardian — Comprehensive Test Suite
//
// Unit tests mock the Neo4j connection.
// Integration tests (tagged @integration) require Docker + Neo4j.
// ──────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  runGuardian,
  evaluatePolicyCondition,
  AuthorityLevel,
  type GuardianInput,
  type SurfacePermissions,
  type AuditEntryDraft,
} from '../guardian.js';
import { WorldModelDomain } from '@xiom/world-model';
import type { Neo4jConnectionManager } from '@xiom/world-model';

// ════════════════════════════════════════════════════════════════
// TEST HELPERS & FIXTURES
// ════════════════════════════════════════════════════════════════

/** Build a minimal Neo4j connection mock. */
function mockConn(overrides: Partial<{
  queryOne: (...args: unknown[]) => Promise<unknown>;
  queryMany: (...args: unknown[]) => Promise<unknown[]>;
  query: (...args: unknown[]) => Promise<unknown>;
}> = {}): Neo4jConnectionManager {
  return {
    query:    overrides.query    ?? vi.fn().mockResolvedValue({ records: [] }),
    queryOne: overrides.queryOne ?? vi.fn().mockResolvedValue(null),
    queryMany:overrides.queryMany ?? vi.fn().mockResolvedValue([]),
    getSession: vi.fn(),
    connect:    vi.fn(),
    disconnect: vi.fn(),
    withTransaction: vi.fn(),
  } as unknown as Neo4jConnectionManager;
}

const DEFAULT_SURFACE: SurfacePermissions = {
  surfaceId:         'chat',
  allowedOperations: ['CREATE_NODE', 'UPDATE_NODE', 'CREATE_EDGE', 'EXECUTE_ACTION', 'DELETE_NODE'],
  allowedNodeTypes:  ['Goal', 'Fact', 'Action', 'Rule', 'Policy', 'Receipt', 'Pattern', 'Session', 'Deadline', 'Connection', 'Insight', 'AuditEntry'],
};

function baseInput(overrides: Partial<GuardianInput> = {}): GuardianInput {
  return {
    operation:      'CREATE_NODE',
    actorType:      'agent',
    actorId:        'agent-001',
    humanId:        '00000000-0000-0000-0000-000000000001',
    surfaceId:      'chat',
    authorityLevel: AuthorityLevel.AUTONOMOUS,
    payload: {
      nodeType: 'Goal',
      domain:   WorldModelDomain.VISION,
      name:     'Launch product',
    },
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════
// SAFE EXPRESSION EVALUATOR TESTS
// ════════════════════════════════════════════════════════════════

describe('evaluatePolicyCondition', () => {
  it('evaluates simple equality', () => {
    expect(evaluatePolicyCondition("action.toolName === 'email.send'", {
      action: { toolName: 'email.send' },
    })).toBe(true);
  });

  it('evaluates inequality', () => {
    expect(evaluatePolicyCondition("action.toolName !== 'email.send'", {
      action: { toolName: 'calendar.create' },
    })).toBe(true);
  });

  it('evaluates numeric comparison', () => {
    expect(evaluatePolicyCondition('action.toolInput.to.length > 1', {
      action: { toolInput: { to: { length: 3 } } },
    })).toBe(true);
  });

  it('evaluates string.includes()', () => {
    expect(evaluatePolicyCondition("action.actionType.includes('payment')", {
      action: { actionType: 'usdc.payment.send' },
    })).toBe(true);
  });

  it('evaluates string.startsWith()', () => {
    expect(evaluatePolicyCondition("action.toolName.startsWith('email')", {
      action: { toolName: 'email.send' },
    })).toBe(true);
  });

  it('evaluates string.endsWith()', () => {
    expect(evaluatePolicyCondition("action.toolName.endsWith('.delete')", {
      action: { toolName: 'file.delete' },
    })).toBe(true);
  });

  it('evaluates logical AND', () => {
    expect(evaluatePolicyCondition(
      "action.toolName === 'email.send' && action.toolInput.to.length > 1",
      { action: { toolName: 'email.send', toolInput: { to: { length: 3 } } } }
    )).toBe(true);
  });

  it('evaluates logical OR', () => {
    expect(evaluatePolicyCondition(
      "action.toolName === 'a' || action.toolName === 'b'",
      { action: { toolName: 'b' } }
    )).toBe(true);
  });

  it('evaluates NOT', () => {
    expect(evaluatePolicyCondition("!action.isUrgent", {
      action: { isUrgent: false },
    })).toBe(true);
  });

  it('returns false for unmatched condition', () => {
    expect(evaluatePolicyCondition("action.toolName === 'email.send'", {
      action: { toolName: 'calendar.create' },
    })).toBe(false);
  });

  it('rejects eval in condition string', () => {
    expect(() =>
      evaluatePolicyCondition("eval('alert(1)')", {})
    ).toThrow('unsafe condition pattern rejected');
  });

  it('rejects globalThis access', () => {
    expect(() =>
      evaluatePolicyCondition("globalThis.process.env", {})
    ).toThrow('unsafe condition pattern rejected');
  });

  it('handles missing property gracefully (returns false)', () => {
    expect(evaluatePolicyCondition("action.nonExistent === 'foo'", {
      action: {},
    })).toBe(false);
  });

  it('evaluates boolean literals', () => {
    expect(evaluatePolicyCondition('true', {})).toBe(true);
    expect(evaluatePolicyCondition('false', {})).toBe(false);
  });

  it('evaluates parenthesised expressions', () => {
    expect(evaluatePolicyCondition(
      "(action.a === '1') && (action.b === '2')",
      { action: { a: '1', b: '2' } }
    )).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// LAYER 1 — SCHEMA VALIDATION
// ════════════════════════════════════════════════════════════════

describe('Layer 1 — Schema Validation', () => {
  it('passes for valid CREATE_NODE payload', async () => {
    const result = await runGuardian(baseInput(), mockConn(), DEFAULT_SURFACE);
    expect(result.deniedLayers).not.toContain(1);
  });

  it('denies CREATE_NODE missing nodeType', async () => {
    const result = await runGuardian(
      baseInput({ payload: { domain: WorldModelDomain.VISION } }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/nodeType/i);
  });

  it('denies CREATE_NODE with invalid domain', async () => {
    const result = await runGuardian(
      baseInput({ payload: { nodeType: 'Goal', domain: 'INVALID_DOMAIN' } }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(1);
  });

  it('passes valid UPDATE_NODE with UUID id', async () => {
    const result = await runGuardian(
      baseInput({
        operation: 'UPDATE_NODE',
        payload: { id: '00000000-0000-0000-0000-000000000099', name: 'Updated' },
      }),
      mockConn({ queryOne: vi.fn().mockResolvedValue({ exists: true }) }),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(1);
  });

  it('denies UPDATE_NODE with non-UUID id', async () => {
    const result = await runGuardian(
      baseInput({ operation: 'UPDATE_NODE', payload: { id: 'not-a-uuid' } }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(1);
  });

  it('passes valid CREATE_EDGE payload', async () => {
    const conn = mockConn({ queryOne: vi.fn().mockResolvedValue({ exists: true }) });
    const result = await runGuardian(
      baseInput({
        operation: 'CREATE_EDGE',
        payload: {
          fromId:           '00000000-0000-0000-0000-000000000001',
          toId:             '00000000-0000-0000-0000-000000000002',
          relationshipType: 'HAS_GOAL',
          fromNodeType:     'Human',
          toNodeType:       'Goal',
        },
      }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(1);
  });

  it('passes valid EXECUTE_ACTION payload', async () => {
    const result = await runGuardian(
      baseInput({
        operation: 'EXECUTE_ACTION',
        payload: {
          actionType: 'email.send',
          intent:     'Send weekly report',
          toolName:   'email_tool',
          toolInput:  { to: ['a@b.com'], body: 'hello' },
        },
      }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(1);
  });

  it('denies EXECUTE_ACTION missing toolName', async () => {
    const result = await runGuardian(
      baseInput({
        operation: 'EXECUTE_ACTION',
        payload: { actionType: 'email.send', intent: 'test', toolInput: {} },
      }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(1);
  });
});

// ════════════════════════════════════════════════════════════════
// LAYER 2 — ENTITY EXISTENCE
// ════════════════════════════════════════════════════════════════

describe('Layer 2 — Entity Existence', () => {
  it('passes CREATE_NODE (no existence check needed)', async () => {
    const result = await runGuardian(baseInput(), mockConn(), DEFAULT_SURFACE);
    expect(result.deniedLayers).not.toContain(2);
  });

  it('passes UPDATE_NODE when node exists', async () => {
    const conn = mockConn({ queryOne: vi.fn().mockResolvedValue({ exists: true }) });
    const result = await runGuardian(
      baseInput({
        operation: 'UPDATE_NODE',
        payload: { id: '00000000-0000-0000-0000-000000000099' },
      }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(2);
  });

  it('denies UPDATE_NODE when node missing', async () => {
    const conn = mockConn({ queryOne: vi.fn().mockResolvedValue(null) });
    const result = await runGuardian(
      baseInput({
        operation: 'UPDATE_NODE',
        payload: { id: '00000000-0000-0000-0000-000000000099' },
      }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(2);
    expect(result.reason).toMatch(/does not exist/i);
  });

  it('denies CREATE_EDGE when source node missing', async () => {
    const conn = mockConn({
      queryOne: vi.fn()
        .mockResolvedValueOnce(null) // fromId check → missing
        .mockResolvedValue({ exists: true }),
    });
    const result = await runGuardian(
      baseInput({
        operation: 'CREATE_EDGE',
        payload: {
          fromId: '00000000-0000-0000-0000-000000000001',
          toId:   '00000000-0000-0000-0000-000000000002',
          relationshipType: 'HAS_GOAL',
          fromNodeType: 'Human',
          toNodeType:   'Goal',
        },
      }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(2);
  });

  it('denies CREATE_EDGE when target node missing', async () => {
    const conn = mockConn({
      queryOne: vi.fn()
        .mockResolvedValueOnce({ exists: true }) // fromId ok
        .mockResolvedValueOnce(null)             // toId missing
        .mockResolvedValue(null),                // fallback for audit layer
    });
    const result = await runGuardian(
      baseInput({
        operation: 'CREATE_EDGE',
        payload: {
          fromId: '00000000-0000-0000-0000-000000000001',
          toId:   '00000000-0000-0000-0000-000000000002',
          relationshipType: 'HAS_GOAL',
          fromNodeType: 'Human',
          toNodeType:   'Goal',
        },
      }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(2);
    expect(result.reason).toMatch(/target node/i);
  });
});

// ════════════════════════════════════════════════════════════════
// LAYER 3 — RELATIONSHIP VALIDITY
// ════════════════════════════════════════════════════════════════

describe('Layer 3 — Relationship Validity', () => {
  const edgeConn = () =>
    mockConn({ queryOne: vi.fn().mockResolvedValue({ exists: true }) });

  it('passes a valid HAS_GOAL edge (Human → Goal)', async () => {
    const result = await runGuardian(
      baseInput({
        operation: 'CREATE_EDGE',
        payload: {
          fromId: '00000000-0000-0000-0000-000000000001',
          toId:   '00000000-0000-0000-0000-000000000002',
          relationshipType: 'HAS_GOAL',
          fromNodeType: 'Human',
          toNodeType:   'Goal',
        },
      }),
      edgeConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(3);
  });

  it('denies an unknown relationship type', async () => {
    const result = await runGuardian(
      baseInput({
        operation: 'CREATE_EDGE',
        payload: {
          fromId: '00000000-0000-0000-0000-000000000001',
          toId:   '00000000-0000-0000-0000-000000000002',
          relationshipType: 'INVENTED_REL',
          fromNodeType: 'Human',
          toNodeType:   'Goal',
        },
      }),
      edgeConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(3);
    expect(result.reason).toMatch(/Unknown relationship/i);
  });

  it('denies wrong source node type for HAS_GOAL', async () => {
    const result = await runGuardian(
      baseInput({
        operation: 'CREATE_EDGE',
        payload: {
          fromId: '00000000-0000-0000-0000-000000000001',
          toId:   '00000000-0000-0000-0000-000000000002',
          relationshipType: 'HAS_GOAL',
          fromNodeType: 'Goal',   // ← wrong! must be Human
          toNodeType:   'Goal',
        },
      }),
      edgeConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(3);
    expect(result.reason).toMatch(/cannot be source/i);
  });

  it('denies wrong target node type for HAS_GOAL', async () => {
    const result = await runGuardian(
      baseInput({
        operation: 'CREATE_EDGE',
        payload: {
          fromId: '00000000-0000-0000-0000-000000000001',
          toId:   '00000000-0000-0000-0000-000000000002',
          relationshipType: 'HAS_GOAL',
          fromNodeType: 'Human',
          toNodeType:   'Fact',  // ← wrong!
        },
      }),
      edgeConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(3);
    expect(result.reason).toMatch(/cannot be target/i);
  });

  it('skips Layer 3 for non-edge operations', async () => {
    const result = await runGuardian(baseInput(), mockConn(), DEFAULT_SURFACE);
    expect(result.deniedLayers).not.toContain(3);
  });
});

// ════════════════════════════════════════════════════════════════
// LAYER 4 — PERMISSION SCOPE
// ════════════════════════════════════════════════════════════════

describe('Layer 4 — Permission Scope', () => {
  it('passes when operation is in surface allowlist', async () => {
    const result = await runGuardian(baseInput(), mockConn(), DEFAULT_SURFACE);
    expect(result.deniedLayers).not.toContain(4);
  });

  it('denies operation not in surface allowlist', async () => {
    const restrictedSurface: SurfacePermissions = {
      surfaceId:         'readonly',
      allowedOperations: ['CREATE_NODE'],
      allowedNodeTypes:  ['Goal', 'Fact'],
    };
    const result = await runGuardian(
      baseInput({ operation: 'DELETE_NODE', payload: { id: '00000000-0000-0000-0000-000000000099' } }),
      mockConn(),
      restrictedSurface
    );
    expect(result.deniedLayers).toContain(4);
    expect(result.reason).toMatch(/not permitted on surface/i);
  });

  it('denies CREATE_NODE for nodeType not in allowedNodeTypes', async () => {
    const surface: SurfacePermissions = {
      surfaceId:         'limited',
      allowedOperations: ['CREATE_NODE'],
      allowedNodeTypes:  ['Fact'], // Goal is not allowed
    };
    const result = await runGuardian(baseInput(), mockConn(), surface);
    expect(result.deniedLayers).toContain(4);
    expect(result.reason).toMatch(/Goal.*not permitted/i);
  });

  it('blocks payment EXECUTE_ACTION on non-payment surface', async () => {
    const result = await runGuardian(
      baseInput({
        operation: 'EXECUTE_ACTION',
        payload: {
          actionType: 'usdc.payment.send',
          intent:     'Pay $50',
          toolName:   'payment_tool',
          toolInput:  { amount: 50 },
        },
      }),
      mockConn(),
      DEFAULT_SURFACE // surfaceId = 'chat', not 'payment'
    );
    expect(result.deniedLayers).toContain(4);
    expect(result.reason).toMatch(/payment.*blocked/i);
  });

  it('allows payment EXECUTE_ACTION on payment surface', async () => {
    const paymentSurface: SurfacePermissions = {
      surfaceId:         'payment',
      allowedOperations: ['EXECUTE_ACTION'],
      allowedNodeTypes:  [],
    };
    const result = await runGuardian(
      baseInput({
        operation: 'EXECUTE_ACTION',
        payload: {
          actionType: 'usdc.payment.send',
          intent:     'Pay $50',
          toolName:   'payment_tool',
          toolInput:  { amount: 50 },
        },
      }),
      mockConn(),
      paymentSurface
    );
    expect(result.deniedLayers).not.toContain(4);
  });
});

// ════════════════════════════════════════════════════════════════
// LAYER 5 — POLICY EVALUATION
// ════════════════════════════════════════════════════════════════

describe('Layer 5 — Policy Evaluation', () => {
  it('passes when no policies exist', async () => {
    const conn = mockConn({ queryMany: vi.fn().mockResolvedValue([]) });
    const result = await runGuardian(baseInput(), conn, DEFAULT_SURFACE);
    expect(result.deniedLayers).not.toContain(5);
  });

  it('blocks when a matching policy has effect=block', async () => {
    const conn = mockConn({
      queryMany: vi.fn().mockResolvedValue([
        { condition: "operation === 'CREATE_NODE'", effect: 'block', name: 'No new nodes' },
      ]),
    });
    const result = await runGuardian(baseInput(), conn, DEFAULT_SURFACE);
    expect(result.deniedLayers).toContain(5);
    expect(result.reason).toMatch(/Blocked by policy/i);
  });

  it('sets requiresHumanApproval for require_approval effect', async () => {
    const conn = mockConn({
      queryMany: vi.fn().mockResolvedValue([
        { condition: "operation === 'CREATE_NODE'", effect: 'require_approval', name: 'Needs review' },
      ]),
    });
    const result = await runGuardian(baseInput(), conn, DEFAULT_SURFACE);
    expect(result.deniedLayers).not.toContain(5);
    expect(result.requiresHumanApproval).toBe(true);
    expect(result.warnings[0]).toMatch(/requires human approval/i);
  });

  it('adds warning for warn effect', async () => {
    const conn = mockConn({
      queryMany: vi.fn().mockResolvedValue([
        { condition: 'true', effect: 'warn', name: 'Caution' },
      ]),
    });
    const result = await runGuardian(baseInput(), conn, DEFAULT_SURFACE);
    expect(result.deniedLayers).not.toContain(5);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/Caution/);
  });

  it('skips non-matching policy conditions', async () => {
    const conn = mockConn({
      queryMany: vi.fn().mockResolvedValue([
        { condition: "operation === 'DELETE_NODE'", effect: 'block', name: 'No deletes' },
      ]),
    });
    const result = await runGuardian(baseInput(), conn, DEFAULT_SURFACE);
    expect(result.deniedLayers).not.toContain(5);
  });

  it('handles unsafe policy condition gracefully (skips)', async () => {
    const conn = mockConn({
      queryMany: vi.fn().mockResolvedValue([
        { condition: "eval('boom')", effect: 'block', name: 'Dangerous' },
      ]),
    });
    // unsafe condition throws → is skipped → no block
    const result = await runGuardian(baseInput(), conn, DEFAULT_SURFACE);
    expect(result.deniedLayers).not.toContain(5);
  });
});

// ════════════════════════════════════════════════════════════════
// LAYER 6 — AUTHORITY TIER
// ════════════════════════════════════════════════════════════════

describe('Layer 6 — Authority Tier', () => {
  it('AUTONOMOUS allows everything', async () => {
    const result = await runGuardian(
      baseInput({ authorityLevel: AuthorityLevel.AUTONOMOUS }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(6);
  });

  it('OBSERVE allows TRACK domain CREATE_NODE', async () => {
    const result = await runGuardian(
      baseInput({
        authorityLevel: AuthorityLevel.OBSERVE,
        payload: { nodeType: 'AuditEntry', domain: WorldModelDomain.TRACK },
      }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(6);
  });

  it('OBSERVE denies non-TRACK domain node', async () => {
    const result = await runGuardian(
      baseInput({
        authorityLevel: AuthorityLevel.OBSERVE,
        payload: { nodeType: 'Goal', domain: WorldModelDomain.VISION },
      }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(6);
    expect(result.reason).toMatch(/OBSERVE tier/i);
  });

  it('OBSERVE denies UPDATE_NODE', async () => {
    const result = await runGuardian(
      baseInput({
        authorityLevel: AuthorityLevel.OBSERVE,
        operation: 'UPDATE_NODE',
        payload: { id: '00000000-0000-0000-0000-000000000099', domain: WorldModelDomain.TRACK },
      }),
      mockConn({ queryOne: vi.fn().mockResolvedValue({ exists: true }) }),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(6);
  });

  it('SUGGEST denies EXECUTION domain write', async () => {
    const result = await runGuardian(
      baseInput({
        authorityLevel: AuthorityLevel.SUGGEST,
        payload: { nodeType: 'Action', domain: WorldModelDomain.EXECUTION },
      }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(6);
    expect(result.reason).toMatch(/SUGGEST tier/i);
  });

  it('SUGGEST denies EXECUTE_ACTION', async () => {
    const result = await runGuardian(
      baseInput({
        authorityLevel: AuthorityLevel.SUGGEST,
        operation: 'EXECUTE_ACTION',
        payload: { actionType: 'email.send', intent: 'test', toolName: 'email', toolInput: {} },
      }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(6);
  });

  it('CONFIRM allows EXECUTION writes but requires approval', async () => {
    const result = await runGuardian(
      baseInput({
        authorityLevel: AuthorityLevel.CONFIRM,
        payload: { nodeType: 'Action', domain: WorldModelDomain.EXECUTION },
      }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(6);
    expect(result.requiresHumanApproval).toBe(true);
  });

  it('SUPERVISED allows all but EXECUTE_ACTION requires approval', async () => {
    const result = await runGuardian(
      baseInput({
        authorityLevel: AuthorityLevel.SUPERVISED,
        operation: 'EXECUTE_ACTION',
        payload: { actionType: 'email.send', intent: 'test', toolName: 'email', toolInput: {} },
      }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(6);
    expect(result.requiresHumanApproval).toBe(true);
  });

  it('covers all 5 authority levels for CREATE_NODE Goal', async () => {
    const levels = [
      AuthorityLevel.OBSERVE,
      AuthorityLevel.SUGGEST,
      AuthorityLevel.CONFIRM,
      AuthorityLevel.SUPERVISED,
      AuthorityLevel.AUTONOMOUS,
    ] as const;

    const results = await Promise.all(
      levels.map((authorityLevel) =>
        runGuardian(baseInput({ authorityLevel }), mockConn(), DEFAULT_SURFACE)
      )
    );

    // OBSERVE cannot write VISION domain Goal
    expect(results[0]!.deniedLayers).toContain(6);
    // SUGGEST+ can create Goal in VISION
    expect(results[1]!.deniedLayers).not.toContain(6);
    expect(results[2]!.deniedLayers).not.toContain(6);
    expect(results[3]!.deniedLayers).not.toContain(6);
    expect(results[4]!.deniedLayers).not.toContain(6);
  });
});

// ════════════════════════════════════════════════════════════════
// LAYER 7 — BUDGET & COOLDOWN
// ════════════════════════════════════════════════════════════════

describe('Layer 7 — Budget & Cooldown', () => {
  it('skips non-EXECUTE_ACTION operations', async () => {
    const result = await runGuardian(baseInput(), mockConn(), DEFAULT_SURFACE);
    expect(result.deniedLayers).not.toContain(7);
  });

  it('passes when action count is below limit', async () => {
    const conn = mockConn({
      queryOne: vi.fn().mockResolvedValue({ count: 10 }),
    });
    const result = await runGuardian(
      baseInput({
        operation: 'EXECUTE_ACTION',
        payload: { actionType: 'email.send', intent: 'test', toolName: 'email', toolInput: {} },
      }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(7);
  });

  it('denies when hourly action limit is reached', async () => {
    const conn = mockConn({
      queryOne: vi.fn().mockResolvedValue({ count: 60 }),
    });
    const result = await runGuardian(
      baseInput({
        operation: 'EXECUTE_ACTION',
        payload: { actionType: 'email.send', intent: 'test', toolName: 'email', toolInput: {} },
      }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(7);
    expect(result.reason).toMatch(/Rate limit/i);
  });

  it('denies during cooldown window', async () => {
    const recentTime = new Date(Date.now() - 10_000).toISOString(); // 10 seconds ago
    const conn = mockConn({
      queryOne: vi.fn()
        .mockResolvedValueOnce({ count: 5 })              // total actions
        .mockResolvedValueOnce({ lastAt: recentTime })    // cooldown check
        .mockResolvedValue(null),                          // fallback for audit layer
    });
    const result = await runGuardian(
      baseInput({
        operation: 'EXECUTE_ACTION',
        payload: { actionType: 'email.send', intent: 'test', toolName: 'email', toolInput: {} },
      }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(7);
    expect(result.reason).toMatch(/Cooldown active/i);
  });

  it('boundary: exactly 59 actions passes', async () => {
    const conn = mockConn({
      queryOne: vi.fn().mockResolvedValue({ count: 59 }),
    });
    const result = await runGuardian(
      baseInput({
        operation: 'EXECUTE_ACTION',
        payload: { actionType: 'email.send', intent: 'test', toolName: 'email', toolInput: {} },
      }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(7);
  });

  it('boundary: 60 actions denies (limit inclusive), 61 also denies', async () => {
    const exec = (count: number) =>
      runGuardian(
        baseInput({
          operation: 'EXECUTE_ACTION',
          payload: { actionType: 'email.send', intent: 'test', toolName: 'email', toolInput: {} },
        }),
        mockConn({ queryOne: vi.fn().mockResolvedValue({ count }) }),
        DEFAULT_SURFACE
      );

    const atLimit = await exec(60);
    expect(atLimit.deniedLayers).toContain(7);
    expect(atLimit.reason).toMatch(/60\/60/);

    const overLimit = await exec(61);
    expect(overLimit.deniedLayers).toContain(7);
    expect(overLimit.reason).toMatch(/61\/60/);
  });
});

// ════════════════════════════════════════════════════════════════
// LAYER 8 — CONFLICT DETECTION
// ════════════════════════════════════════════════════════════════

describe('Layer 8 — Conflict Detection', () => {
  it('skips for non-CREATE_NODE operations', async () => {
    const result = await runGuardian(
      baseInput({
        operation: 'EXECUTE_ACTION',
        payload: { actionType: 'email.send', intent: 'test', toolName: 'email', toolInput: {} },
      }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(8);
  });

  it('passes when no similar fact exists', async () => {
    const conn = mockConn({ queryOne: vi.fn().mockResolvedValue(null) });
    const result = await runGuardian(
      baseInput({ payload: { nodeType: 'Fact', domain: WorldModelDomain.TRACK, content: 'New fact' } }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(8);
  });

  it('denies duplicate Fact (score > 0.99)', async () => {
    const conn = mockConn({
      queryOne: vi.fn().mockResolvedValue({ content: 'Existing fact', score: 0.999 }),
    });
    const result = await runGuardian(
      baseInput({ payload: { nodeType: 'Fact', domain: WorldModelDomain.TRACK, content: 'Existing fact' } }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).toContain(8);
    expect(result.reason).toMatch(/Duplicate fact/i);
  });

  it('warns but allows near-duplicate Fact (0.9 < score ≤ 0.99)', async () => {
    const conn = mockConn({
      queryOne: vi.fn().mockResolvedValue({ content: 'Similar fact', score: 0.95 }),
    });
    const result = await runGuardian(
      baseInput({ payload: { nodeType: 'Fact', domain: WorldModelDomain.TRACK, content: 'Near fact' } }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(8);
    expect(result.warnings.some((w) => w.toLowerCase().includes('similar fact'))).toBe(true);
  });

  it('warns about conflicting Rule condition', async () => {
    const conn = mockConn({
      queryOne: vi.fn().mockResolvedValue({ action: 'different action' }),
    });
    const result = await runGuardian(
      baseInput({
        payload: {
          nodeType: 'Rule',
          domain: WorldModelDomain.FOUNDATION,
          condition: 'some condition',
          action: 'new action',
        },
      }),
      conn,
      DEFAULT_SURFACE
    );
    expect(result.deniedLayers).not.toContain(8);
    expect(result.warnings.some((w) => w.toLowerCase().includes('already exists'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// LAYER 9 — AUDIT ENTRY
// ════════════════════════════════════════════════════════════════

describe('Layer 9 — Audit Entry', () => {
  it('always produces an audit entry even on allowed operations', async () => {
    const result = await runGuardian(baseInput(), mockConn(), DEFAULT_SURFACE);
    expect(result.auditEntry).toBeDefined();
    expect(result.auditEntry.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.auditEntry.isAllowed).toBe(result.allowed);
  });

  it('produces an audit entry even on denied operations', async () => {
    const result = await runGuardian(
      baseInput({ payload: {} }), // invalid payload → L1 deny
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.allowed).toBe(false);
    expect(result.auditEntry).toBeDefined();
    expect(result.auditEntry.isAllowed).toBe(false);
  });

  it('audit entry has correct human ID', async () => {
    const humanId = '99999999-0000-0000-0000-000000000001';
    const result = await runGuardian(
      baseInput({ humanId }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.auditEntry.humanId).toBe(humanId);
  });

  it('uses genesis hash when no prior audit entries exist', async () => {
    const conn = mockConn({ queryOne: vi.fn().mockResolvedValue(null) });
    const result = await runGuardian(baseInput(), conn, DEFAULT_SURFACE);
    expect(result.auditEntry.prevHash).toBe('0'.repeat(64));
  });

  it('chains onto the previous audit hash', async () => {
    const prevHash = 'a'.repeat(64);
    const conn = mockConn({ queryOne: vi.fn().mockResolvedValue({ hash: prevHash }) });
    const result = await runGuardian(baseInput(), conn, DEFAULT_SURFACE);
    expect(result.auditEntry.prevHash).toBe(prevHash);
    expect(result.auditEntry.hash).not.toBe(prevHash);
  });

  it('hash-chains across 10 sequential audit entries', async () => {
    let lastHash: string | null = null;
    const hashes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const conn = mockConn({
        queryOne: vi.fn().mockResolvedValue(lastHash ? { hash: lastHash } : null),
      });
      const result = await runGuardian(
        baseInput({
          payload: {
            nodeType: 'Goal',
            domain: WorldModelDomain.VISION,
            name: `Goal chain ${i}`,
          },
        }),
        conn,
        DEFAULT_SURFACE
      );

      expect(result.auditEntry.prevHash).toBe(lastHash ?? '0'.repeat(64));
      expect(result.auditEntry.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hashes).not.toContain(result.auditEntry.hash);
      hashes.push(result.auditEntry.hash);
      lastHash = result.auditEntry.hash;
    }

    expect(hashes).toHaveLength(10);
    // Each entry (after genesis) must reference the prior hash — already asserted in loop;
    // uniqueness of the 10 hashes proves the chain advances.
    expect(new Set(hashes).size).toBe(10);
  });
});

// ════════════════════════════════════════════════════════════════
// FULL INTEGRATION — runGuardian end-to-end
// ════════════════════════════════════════════════════════════════

describe('runGuardian — end-to-end', () => {
  it('happy path: valid CREATE_NODE fully passes all layers', async () => {
    const result = await runGuardian(baseInput(), mockConn(), DEFAULT_SURFACE);
    expect(result.allowed).toBe(true);
    expect(result.deniedLayers).toHaveLength(0);
    expect(result.requiresHumanApproval).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('multiple layers can fail simultaneously', async () => {
    // Surface blocks the operation AND authority tier also blocks it
    const restrictedSurface: SurfacePermissions = {
      surfaceId:         'readonly',
      allowedOperations: [], // nothing allowed
      allowedNodeTypes:  [],
    };
    const result = await runGuardian(
      baseInput({
        authorityLevel: AuthorityLevel.OBSERVE,
        payload:        { nodeType: 'Goal', domain: WorldModelDomain.VISION },
      }),
      mockConn(),
      restrictedSurface
    );
    expect(result.allowed).toBe(false);
    // L4 (surface) and L6 (OBSERVE + non-TRACK) should both fire
    expect(result.deniedLayers).toContain(4);
    expect(result.deniedLayers).toContain(6);
  });

  it('denial reason includes all failed layer numbers', async () => {
    const restrictedSurface: SurfacePermissions = {
      surfaceId:         'readonly',
      allowedOperations: [],
      allowedNodeTypes:  [],
    };
    const result = await runGuardian(baseInput(), mockConn(), restrictedSurface);
    expect(result.reason).toMatch(/\[L4\]/);
  });

  it('warnings accumulate from all layers', async () => {
    const conn = mockConn({
      queryMany: vi.fn().mockResolvedValue([
        { condition: 'true', effect: 'warn', name: 'Policy Warning 1' },
        { condition: 'true', effect: 'warn', name: 'Policy Warning 2' },
      ]),
      queryOne: vi.fn().mockResolvedValue({ content: 'Similar', score: 0.95 }),
    });
    const result = await runGuardian(
      baseInput({ payload: { nodeType: 'Fact', domain: WorldModelDomain.TRACK, content: 'test' } }),
      conn,
      DEFAULT_SURFACE
    );
    // 2 policy warnings + 1 similarity warning
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('requiresHumanApproval is false when denied', async () => {
    const result = await runGuardian(
      baseInput({ authorityLevel: AuthorityLevel.OBSERVE, payload: {} }),
      mockConn(),
      DEFAULT_SURFACE
    );
    expect(result.allowed).toBe(false);
    expect(result.requiresHumanApproval).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════
// INTEGRATION TESTS — require Docker + Neo4j
// Tag: @integration  (run with: vitest --testNamePattern=@integration)
// ════════════════════════════════════════════════════════════════

describe.skip('@integration — Neo4j testcontainer', () => {
  /**
   * To enable:
   * 1. Install Docker Desktop
   * 2. pnpm add -D @testcontainers/neo4j
   * 3. Remove `describe.skip` → `describe`
   * 4. Run: pnpm --filter @xiom/guardian test
   */

  it('@integration full guardian against real Neo4j', async () => {
    // const { Neo4jContainer } = await import('@testcontainers/neo4j');
    // const container = await new Neo4jContainer('neo4j:5').start();
    // const conn = createConnectionManager({
    //   uri:      container.getBoltUri(),
    //   user:     container.getUsername(),
    //   password: container.getPassword(),
    // });
    // await initializeSchema(conn);
    //
    // const result = await runGuardian(baseInput(), conn, DEFAULT_SURFACE);
    // expect(result.allowed).toBe(true);
    //
    // await conn.disconnect();
    // await container.stop();
    expect(true).toBe(true); // placeholder
  });
});
