// ──────────────────────────────────────────────────────────────
// Soft policy check — Guardian layers 4, 5, 6 only (no writes)
// Mirrors desktop mcp policy_check + guardian permission/policy/authority.
// ──────────────────────────────────────────────────────────────
import {
  evaluatePolicyCondition,
  AuthorityLevel,
  type GuardianInput,
  type SurfacePermissions,
} from '@xiom/guardian';
import { WorldModelDomain, type Neo4jConnectionManager } from '@xiom/world-model';
import type { SoftPolicyCheckResult } from './types.js';

const PAYMENT_PATTERN = /payment|transfer|withdraw|deposit/i;

function layer4(
  input: GuardianInput,
  perms: SurfacePermissions
): { allowed: boolean; reason?: string } {
  if (!perms.allowedOperations.includes(input.operation)) {
    return {
      allowed: false,
      reason: `Operation ${input.operation} is not permitted on surface "${perms.surfaceId}"`,
    };
  }

  if (input.operation === 'CREATE_NODE' || input.operation === 'UPDATE_NODE') {
    const p = input.payload as { nodeType?: string };
    if (p.nodeType && !perms.allowedNodeTypes.includes(p.nodeType)) {
      return {
        allowed: false,
        reason: `Node type ${p.nodeType} is not permitted on surface "${perms.surfaceId}"`,
      };
    }
  }

  if (input.operation === 'EXECUTE_ACTION') {
    const p = input.payload as { toolName?: string; actionType?: string };
    const isMoneyOp =
      PAYMENT_PATTERN.test(p.toolName ?? '') || PAYMENT_PATTERN.test(p.actionType ?? '');
    if (isMoneyOp && perms.surfaceId !== 'payment') {
      return {
        allowed: false,
        reason: `Payment/transfer operations are blocked on surface "${perms.surfaceId}"`,
      };
    }
  }

  return { allowed: true };
}

function layer6(input: GuardianInput): {
  allowed: boolean;
  requiresApproval?: boolean;
  reason?: string;
} {
  const { authorityLevel, operation } = input;
  const domain = (input.payload as Record<string, unknown>)['domain'] as
    | WorldModelDomain
    | undefined;

  switch (authorityLevel) {
    case AuthorityLevel.OBSERVE:
      if (operation !== 'CREATE_NODE' && operation !== 'CREATE_EDGE') {
        return { allowed: false, reason: 'OBSERVE tier: only CREATE_NODE and CREATE_EDGE allowed' };
      }
      if (operation === 'CREATE_NODE' && domain !== WorldModelDomain.TRACK) {
        return { allowed: false, reason: 'OBSERVE tier: can only write TRACK domain nodes' };
      }
      return { allowed: true };

    case AuthorityLevel.SUGGEST:
      if (domain === WorldModelDomain.EXECUTION) {
        return { allowed: false, reason: 'SUGGEST tier: cannot write to EXECUTION domain' };
      }
      if (operation === 'EXECUTE_ACTION') {
        return { allowed: false, reason: 'SUGGEST tier: EXECUTE_ACTION not permitted' };
      }
      return { allowed: true };

    case AuthorityLevel.CONFIRM:
      if (domain === WorldModelDomain.EXECUTION || operation === 'EXECUTE_ACTION') {
        return { allowed: true, requiresApproval: true };
      }
      return { allowed: true };

    case AuthorityLevel.SUPERVISED:
      if (operation === 'EXECUTE_ACTION') {
        return { allowed: true, requiresApproval: true };
      }
      return { allowed: true };

    case AuthorityLevel.AUTONOMOUS:
      return { allowed: true };

    default:
      return { allowed: true, requiresApproval: true };
  }
}

async function layer5(
  input: GuardianInput,
  conn: Neo4jConnectionManager
): Promise<{
  allowed: boolean;
  requiresApproval?: boolean;
  reason?: string;
  warnings: string[];
  matchedPolicies: string[];
}> {
  const policies = await conn.queryMany<{
    condition: string;
    effect: string;
    name: string;
  }>(
    `MATCH (:Human {id: $humanId})-[:HAS_RULE]->(p:Policy {isActive: true, isDeleted: false})
     RETURN p.condition AS condition, p.effect AS effect, p.name AS name`,
    { humanId: input.humanId }
  );

  const warnings: string[] = [];
  const matchedPolicies: string[] = [];
  let requiresApproval = false;

  const context: Record<string, unknown> = {
    operation: input.operation,
    actorType: input.actorType,
    actorId: input.actorId,
    action: input.payload,
    payload: input.payload,
    surface: input.surfaceId,
  };

  for (const policy of policies) {
    let matches = false;
    try {
      matches = evaluatePolicyCondition(policy.condition, context);
    } catch {
      matches = false;
    }
    if (!matches) continue;

    matchedPolicies.push(policy.name);

    switch (policy.effect) {
      case 'block':
        return {
          allowed: false,
          reason: `Blocked by policy: ${policy.name}`,
          warnings,
          matchedPolicies,
        };
      case 'require_approval':
        requiresApproval = true;
        warnings.push(`Policy "${policy.name}" requires human approval`);
        break;
      case 'warn':
        warnings.push(`Policy "${policy.name}" warns: review this operation`);
        break;
      default:
        break;
    }
  }

  return { allowed: true, requiresApproval, warnings, matchedPolicies };
}

/**
 * Soft-check Guardian layers 4 (permission), 5 (policy), 6 (authority).
 * No entity existence checks, no audit writes.
 */
export async function softCheckPolicy(
  input: GuardianInput,
  conn: Neo4jConnectionManager,
  surfacePermissions: SurfacePermissions
): Promise<SoftPolicyCheckResult> {
  const l4 = layer4(input, surfacePermissions);
  if (!l4.allowed) {
    return {
      allowed: false,
      requiresApproval: false,
      ...(l4.reason !== undefined ? { reason: l4.reason } : {}),
      matchedPolicies: [],
      warnings: [],
    };
  }

  const [l5, l6] = await Promise.all([
    layer5(input, conn),
    Promise.resolve(layer6(input)),
  ]);

  if (!l5.allowed) {
    return {
      allowed: false,
      requiresApproval: false,
      ...(l5.reason !== undefined ? { reason: l5.reason } : {}),
      matchedPolicies: l5.matchedPolicies,
      warnings: l5.warnings,
    };
  }

  if (!l6.allowed) {
    return {
      allowed: false,
      requiresApproval: false,
      ...(l6.reason !== undefined ? { reason: l6.reason } : {}),
      matchedPolicies: l5.matchedPolicies,
      warnings: l5.warnings,
    };
  }

  const requiresApproval = Boolean(l5.requiresApproval || l6.requiresApproval);
  return {
    allowed: true,
    requiresApproval,
    matchedPolicies: l5.matchedPolicies,
    warnings: l5.warnings,
  };
}

/** Default surface permissions for the desktop / MCP chat lane. */
export const DEFAULT_MCP_SURFACE: SurfacePermissions = {
  surfaceId: 'desktop-chat',
  allowedOperations: [
    'CREATE_NODE',
    'UPDATE_NODE',
    'CREATE_EDGE',
    'EXECUTE_ACTION',
    'DELETE_NODE',
  ],
  allowedNodeTypes: [
    'Goal',
    'Fact',
    'Action',
    'Rule',
    'Policy',
    'Receipt',
    'Pattern',
    'Session',
    'Deadline',
    'Connection',
    'Insight',
    'AuditEntry',
  ],
};

export function parseAuthorityLevel(value: string | AuthorityLevel | undefined): AuthorityLevel {
  const v = String(value ?? 'supervised').toLowerCase();
  switch (v) {
    case 'observe':
      return AuthorityLevel.OBSERVE;
    case 'suggest':
      return AuthorityLevel.SUGGEST;
    case 'confirm':
      return AuthorityLevel.CONFIRM;
    case 'autonomous':
      return AuthorityLevel.AUTONOMOUS;
    case 'supervised':
    default:
      return AuthorityLevel.SUPERVISED;
  }
}
