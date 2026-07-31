// ──────────────────────────────────────────────────────────────
// @xiom/guardian — Public API
// 9-layer constitutional enforcement pipeline.
// ──────────────────────────────────────────────────────────────
import type { PolicyCheck, PolicyOutcome, ConstitutionalRule } from '@xiom/types';

// ─── Full 9-layer Guardian pipeline ──────────────────────────
export {
  runGuardian,
  evaluatePolicyCondition,
  AuthorityLevel,
} from './guardian.js';

export type {
  GuardianInput,
  GuardianOperation,
  GuardianResult,
  SurfacePermissions,
  AuditEntryDraft,
} from './guardian.js';

// ─── Policy Evolution Engine (Phase 5 Evolve) ─────────────────
export {
  PolicyEvolutionEngine,
  createPolicyEvolutionEngine,
} from './policy-evolution.js';

export type {
  OutcomeAnalysis,
  DetectedPattern,
  PolicyUpdateProposal,
} from './policy-evolution.js';

// ─── Re-export shared types ───────────────────────────────────
export type { PolicyCheck, PolicyOutcome, ConstitutionalRule };

// ─── Legacy simple rule evaluator (kept for backward compat) ──
// Prefer runGuardian() for all production enforcement.
export function evaluateRules(
  check: PolicyCheck,
  rules: ConstitutionalRule[]
): { allowed: boolean; violatedRules: string[]; reason: string } {
  const enabled = rules.filter((r) => r.enabled).sort((a, b) => b.priority - a.priority);
  const violated: string[] = [];

  for (const rule of enabled) {
    try {
      // Simple name-based match stub — use runGuardian for real enforcement.
      if (!rule.condition.includes(check.action)) {
        violated.push(rule.id);
      }
    } catch {
      if (process.env['NODE_ENV'] === 'production') violated.push(rule.id);
    }
  }

  const allowed = violated.length === 0;
  return {
    allowed,
    violatedRules: violated,
    reason: allowed
      ? 'All constitutional rules satisfied'
      : `Violated rules: ${violated.join(', ')}`,
  };
}

export class GuardianPipeline {
  private rules: ConstitutionalRule[] = [];

  addRule(rule: ConstitutionalRule): this {
    this.rules.push(rule);
    return this;
  }

  setRules(rules: ConstitutionalRule[]): this {
    this.rules = rules;
    return this;
  }

  async enforce(check: PolicyCheck): Promise<PolicyOutcome> {
    const { allowed, violatedRules, reason } = evaluateRules(check, this.rules);
    return {
      allowed,
      reason,
      violatedRules,
      receiptId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }
}

export function createPipeline(): GuardianPipeline {
  return new GuardianPipeline();
}
