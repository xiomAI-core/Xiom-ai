// ──────────────────────────────────────────────────────────────
// XIOM Guardian — Policy Evolution Engine Tests
// ──────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PolicyEvolutionEngine,
  createPolicyEvolutionEngine,
  type DetectedPattern,
} from '../policy-evolution.js';
import type { Neo4jConnectionManager } from '@xiom/world-model';

function mockConn(overrides: Partial<{
  queryOne: (...args: unknown[]) => Promise<unknown>;
  queryMany: (...args: unknown[]) => Promise<unknown[]>;
  query: (...args: unknown[]) => Promise<unknown>;
}> = {}): Neo4jConnectionManager {
  return {
    query:     overrides.query     ?? vi.fn().mockResolvedValue({ records: [] }),
    queryOne:  overrides.queryOne  ?? vi.fn().mockResolvedValue(null),
    queryMany: overrides.queryMany ?? vi.fn().mockResolvedValue([]),
    getSession: vi.fn(),
    connect:    vi.fn(),
    disconnect: vi.fn(),
    withTransaction: vi.fn(),
  } as unknown as Neo4jConnectionManager;
}

const HUMAN = '00000000-0000-0000-0000-000000000001';

describe('PolicyEvolutionEngine', () => {
  describe('createPolicyEvolutionEngine', () => {
    it('returns a PolicyEvolutionEngine instance', () => {
      const engine = createPolicyEvolutionEngine(mockConn());
      expect(engine).toBeInstanceOf(PolicyEvolutionEngine);
    });
  });

  describe('analyzeOutcomes', () => {
    it('computes rates from Action OCCURRED_IN rows and audit denials', async () => {
      const queryMany = vi.fn().mockResolvedValue([
        {
          action: {
            id: 'a1', actionType: 'email.send', executionStatus: 'completed', createdAt: new Date().toISOString(),
          },
        },
        {
          action: {
            id: 'a2', actionType: 'email.send', executionStatus: 'completed', createdAt: new Date().toISOString(),
          },
        },
        {
          action: {
            id: 'a3', actionType: 'file.delete', executionStatus: 'failed',
            errorMessage: 'Blocked by policy: risky', createdAt: new Date().toISOString(),
          },
        },
        {
          action: {
            id: 'a4', actionType: 'calendar.create', executionStatus: 'approved', createdAt: new Date().toISOString(),
          },
        },
      ]);
      const queryOne = vi.fn().mockResolvedValue({ count: 2 });

      const engine = new PolicyEvolutionEngine(mockConn({ queryMany, queryOne }));
      const analysis = await engine.analyzeOutcomes(HUMAN);

      expect(analysis.totalActions).toBe(4);
      expect(analysis.successRate).toBeCloseTo(2 / 3); // 2 completed / (2 completed + 1 failed)
      expect(analysis.approvalOverrideRate).toBeCloseTo(3 / 4); // completed+approved
      expect(analysis.blockedActionRate).toBeGreaterThan(0);
      expect(analysis.topFailedActionTypes[0]?.actionType).toBe('file.delete');
      expect(analysis.frequentlyApprovedActions.some((x) => x.actionType === 'email.send')).toBe(true);
      expect(queryMany).toHaveBeenCalled();
      const cypher = String(queryMany.mock.calls[0]?.[0] ?? '');
      expect(cypher).toContain('OCCURRED_IN');
    });

    it('returns zero rates when no actions exist', async () => {
      const engine = new PolicyEvolutionEngine(mockConn({
        queryMany: vi.fn().mockResolvedValue([]),
        queryOne:  vi.fn().mockResolvedValue({ count: 0 }),
      }));
      const analysis = await engine.analyzeOutcomes(HUMAN, 14);
      expect(analysis.totalActions).toBe(0);
      expect(analysis.successRate).toBe(0);
      expect(analysis.windowDays).toBe(14);
    });
  });

  describe('detectPatterns', () => {
    it('detects frequent_manual_approval and consistent_blocking', async () => {
      const queryMany = vi.fn()
        // approvalStats
        .mockResolvedValueOnce([
          { actionType: 'email.send', approved: 12, rejected: 0 },
        ])
        // getDriftingGoals → empty
        .mockResolvedValueOnce([])
        // policies for contradiction → empty
        .mockResolvedValueOnce([]);

      const queryOne = vi.fn()
        // audit block count
        .mockResolvedValueOnce({ count: 6 })
        // action block count
        .mockResolvedValueOnce({ count: 0 });

      const engine = new PolicyEvolutionEngine(mockConn({ queryMany, queryOne }));
      const patterns = await engine.detectPatterns(HUMAN, 30);

      expect(patterns.some((p) => p.type === 'frequent_manual_approval')).toBe(true);
      expect(patterns.some((p) => p.type === 'consistent_blocking')).toBe(true);
      const approval = patterns.find((p) => p.type === 'frequent_manual_approval')!;
      expect(approval.evidenceCount).toBe(12);
      expect(approval.metadata['signal']).toBe('auto_approve');
    });

    it('detects policy_contradiction when allow and block share a key', async () => {
      const queryMany = vi.fn()
        .mockResolvedValueOnce([]) // approval stats
        .mockResolvedValueOnce([]) // drifting goals
        .mockResolvedValueOnce([
          {
            id: 'p1', name: 'Allow email',
            condition: "action.toolName === 'email.send'", effect: 'allow',
          },
          {
            id: 'p2', name: 'Block email',
            condition: "action.toolName === 'email.send'", effect: 'block',
          },
        ]);

      const queryOne = vi.fn()
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });

      const engine = new PolicyEvolutionEngine(mockConn({ queryMany, queryOne }));
      const patterns = await engine.detectPatterns(HUMAN);
      const contra = patterns.find((p) => p.type === 'policy_contradiction');
      expect(contra).toBeDefined();
      expect(contra!.evidenceCount).toBe(2);
    });
  });

  describe('proposePolicyUpdate', () => {
    it('persists a PolicyProposal and returns pending_review proposal', async () => {
      const query = vi.fn().mockResolvedValue({ records: [] });
      const engine = new PolicyEvolutionEngine(mockConn({ query }));

      const pattern: DetectedPattern = {
        id:            'pat-1',
        type:          'frequent_manual_approval',
        description:   'Lots of approvals',
        evidenceCount: 15,
        confidence:    0.8,
        metadata:      { actionType: 'email.send', signal: 'auto_approve' },
      };

      const proposal = await engine.proposePolicyUpdate(HUMAN, pattern);

      expect(proposal.status).toBe('pending_review');
      expect(proposal.humanId).toBe(HUMAN);
      expect(proposal.patternId).toBe('pat-1');
      expect(proposal.proposedChange.effect).toBe('allow');
      expect(proposal.proposedChange.condition).toContain('email.send');
      expect(query).toHaveBeenCalled();
      const cypher = String(query.mock.calls[0]?.[0] ?? '');
      expect(cypher).toContain('PolicyProposal');
    });
  });

  describe('reviewProposal + applyApprovedProposal', () => {
    it('reviews and applies a new_rule proposal into a Policy node', async () => {
      const proposedChange = {
        type: 'new_rule' as const,
        condition: "action.actionType === 'email.send'",
        effect: 'allow' as const,
        description: 'Auto-allow email.send',
        confidence: 0.8,
        evidenceCount: 15,
      };

      const queryOneFull = vi.fn()
        .mockResolvedValueOnce({
          proposal: {
            id: 'prop-1', humanId: HUMAN, patternId: 'pat-1',
            proposedChange: JSON.stringify(proposedChange),
            status: 'pending_review', proposedAt: new Date().toISOString(),
          },
        })
        .mockResolvedValueOnce({
          proposal: {
            id: 'prop-1', humanId: HUMAN, patternId: 'pat-1',
            proposedChange: JSON.stringify(proposedChange),
            status: 'approved', proposedAt: new Date().toISOString(),
            reviewedAt: new Date().toISOString(),
          },
        })
        .mockResolvedValueOnce({
          policy: {
            id: 'pol-new',
            name: 'Evolved: Auto-allow email.send',
            description: 'Auto-allow email.send',
            condition: proposedChange.condition,
            effect: 'allow',
            policyVersion: 1,
            isActive: true,
            approvedBy: 'system',
            domain: 'SYMBIOSIS',
            confidence: 0.8,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });

      const query = vi.fn().mockResolvedValue({ records: [] });
      const queryMany = vi.fn().mockResolvedValue([]);
      const engine = new PolicyEvolutionEngine(mockConn({
        queryOne: queryOneFull,
        queryMany,
        query,
      }));

      const policy = await engine.applyApprovedProposal('prop-1', HUMAN);
      expect(policy.nodeType).toBe('Policy');
      expect(policy.isActive).toBe(true);
      expect(policy.effect).toBe('allow');
      expect(policy.policyVersion).toBe(1);
    });
  });
});
