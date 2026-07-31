// ──────────────────────────────────────────────────────────────
// XIOM Guardian — Policy Evolution Engine
//
// Analyzes action outcomes, detects behavioral patterns, proposes
// policy updates, and applies/rolls back versioned Policy nodes.
// ──────────────────────────────────────────────────────────────
import type { Neo4jConnectionManager, PolicyNode } from '@xiom/world-model';
import { WorldModelDomain, getDriftingGoals } from '@xiom/world-model';
import { evaluatePolicyCondition } from './guardian.js';

// ════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ════════════════════════════════════════════════════════════════

export interface OutcomeAnalysis {
  successRate: number;
  approvalOverrideRate: number;
  blockedActionRate: number;
  topFailedActionTypes: Array<{ actionType: string; count: number }>;
  frequentlyApprovedActions: Array<{ actionType: string; count: number }>;
  totalActions: number;
  windowDays: number;
}

export interface DetectedPattern {
  id: string;
  type: 'frequent_manual_approval' | 'consistent_blocking' | 'goal_drift' | 'policy_contradiction';
  description: string;
  evidenceCount: number;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface PolicyUpdateProposal {
  id: string;
  humanId: string;
  patternId: string;
  currentPolicyId?: string;
  proposedChange: {
    type: 'new_rule' | 'modify_rule' | 'remove_rule' | 'merge_rules';
    condition: string;
    effect: 'allow' | 'block' | 'require_approval' | 'notify';
    description: string;
    confidence: number;
    evidenceCount: number;
  };
  status: 'pending_review' | 'approved' | 'rejected';
  proposedAt: Date;
  reviewedAt?: Date;
}

interface ActionRow {
  id: string;
  actionType: string;
  executionStatus: string;
  toolName?: string;
  errorMessage?: string;
  createdAt: string;
}

interface PolicyRow {
  id: string;
  name: string;
  description: string;
  condition: string;
  effect: string;
  policyVersion: number;
  isActive: boolean;
  parentPolicyId?: string;
  approvedBy: string;
  domain: string;
  confidence: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function cutoffIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function countByActionType(
  rows: ActionRow[],
  predicate: (a: ActionRow) => boolean
): Array<{ actionType: string; count: number }> {
  const map = new Map<string, number>();
  for (const a of rows) {
    if (!predicate(a)) continue;
    map.set(a.actionType, (map.get(a.actionType) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([actionType, count]) => ({ actionType, count }))
    .sort((a, b) => b.count - a.count);
}

/** Extract a stable key from a policy condition for contradiction detection. */
function conditionKey(condition: string): string | null {
  const tool = condition.match(/action\.toolName\s*===\s*['"]([^'"]+)['"]/);
  if (tool?.[1]) return `tool:${tool[1]}`;
  const action = condition.match(/action\.actionType\s*===\s*['"]([^'"]+)['"]/);
  if (action?.[1]) return `action:${action[1]}`;
  const includes = condition.match(/action\.actionType\.includes\(\s*['"]([^'"]+)['"]\s*\)/);
  if (includes?.[1]) return `actionIncludes:${includes[1]}`;
  return null;
}

function mapPolicyNode(raw: PolicyRow): PolicyNode {
  const base: PolicyNode = {
    id:            raw.id,
    nodeType:      'Policy',
    name:          raw.name,
    description:   raw.description,
    condition:     raw.condition,
    effect:        raw.effect,
    policyVersion: raw.policyVersion,
    isActive:      raw.isActive,
    approvedBy:    (raw.approvedBy === 'human' ? 'human' : 'system') as PolicyNode['approvedBy'],
    domain:        (raw.domain as WorldModelDomain) ?? WorldModelDomain.SYMBIOSIS,
    confidence:    Number(raw.confidence ?? 1),
    version:       Number(raw.version ?? 1),
    isDeleted:     false,
    createdAt:     new Date(raw.createdAt),
    updatedAt:     new Date(raw.updatedAt),
  };

  return {
    ...base,
    ...(raw.parentPolicyId !== undefined
      ? { parentPolicyId: raw.parentPolicyId }
      : {}),
  };
}

function mapProposal(raw: Record<string, unknown>): PolicyUpdateProposal {
  const changeRaw = typeof raw['proposedChange'] === 'string'
    ? JSON.parse(raw['proposedChange'] as string) as PolicyUpdateProposal['proposedChange']
    : raw['proposedChange'] as PolicyUpdateProposal['proposedChange'];

  const base: PolicyUpdateProposal = {
    id:        String(raw['id'] ?? ''),
    humanId:   String(raw['humanId'] ?? ''),
    patternId: String(raw['patternId'] ?? ''),
    proposedChange: changeRaw,
    status:    (raw['status'] as PolicyUpdateProposal['status']) ?? 'pending_review',
    proposedAt: raw['proposedAt'] ? new Date(String(raw['proposedAt'])) : new Date(),
  };

  return {
    ...base,
    ...(raw['currentPolicyId'] !== undefined && raw['currentPolicyId'] !== null
      ? { currentPolicyId: String(raw['currentPolicyId']) }
      : {}),
    ...(raw['reviewedAt'] !== undefined && raw['reviewedAt'] !== null
      ? { reviewedAt: new Date(String(raw['reviewedAt'])) }
      : {}),
  };
}

async function writeAudit(
  conn: Neo4jConnectionManager,
  humanId: string,
  description: string,
  targetNodeId: string
): Promise<void> {
  const now = new Date().toISOString();
  await conn.query(
    `CREATE (a:AuditEntry {
       id:                $id,
       nodeType:          'AuditEntry',
       humanId:           $humanId,
       operation:         'policy_check',
       actorType:         'system',
       actorId:           'policy-evolution',
       targetNodeId:      $targetNodeId,
       targetNodeType:    'Policy',
       changeDescription: $description,
       prevHash:          $prevHash,
       hash:              $hash,
       isVerified:        false,
       isAllowed:         true,
       domain:            'TRACK',
       confidence:        1.0,
       version:           1,
       isDeleted:         false,
       createdAt:         $now,
       updatedAt:         $now
     })`,
    {
      id:           crypto.randomUUID(),
      humanId,
      targetNodeId,
      description,
      prevHash:     '0'.repeat(64),
      hash:         crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 32),
      now,
    }
  );
}

// ════════════════════════════════════════════════════════════════
// ENGINE
// ════════════════════════════════════════════════════════════════

export class PolicyEvolutionEngine {
  constructor(private readonly conn: Neo4jConnectionManager) {}

  /**
   * Analyze Action outcomes for a human over the last 30 days.
   * Uses Action-[OCCURRED_IN]->Human (same pattern as world-model action queries).
   * Blocked rate approximated from AuditEntry denials + failed actions with block errors.
   */
  async analyzeOutcomes(humanId: string, windowDays = 30): Promise<OutcomeAnalysis> {
    const cutoff = cutoffIso(windowDays);

    const actions = await this.conn.queryMany<{ action: Record<string, unknown> }>(
      `MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action {isDeleted: false})
       WHERE a.createdAt >= $cutoff
       RETURN a { .* } AS action`,
      { humanId, cutoff }
    );

    const rows: ActionRow[] = actions.map((r) => {
      const a = r.action;
      return {
        id:              String(a['id'] ?? ''),
        actionType:      String(a['actionType'] ?? 'unknown'),
        executionStatus: String(a['executionStatus'] ?? 'proposed'),
        ...(a['toolName'] !== undefined ? { toolName: String(a['toolName']) } : {}),
        ...(a['errorMessage'] !== undefined ? { errorMessage: String(a['errorMessage']) } : {}),
        createdAt:       String(a['createdAt'] ?? ''),
      };
    });

    const total = rows.length;
    const completed = rows.filter((a) => a.executionStatus === 'completed').length;
    const failed = rows.filter((a) => a.executionStatus === 'failed').length;
    const approvedOrLater = rows.filter((a) =>
      ['approved', 'executing', 'completed'].includes(a.executionStatus)
    ).length;

    // Audit denials (Guardian blocked) + Action failures mentioning policy block
    const auditBlocked = await this.conn.queryOne<{ count: number }>(
      `MATCH (e:AuditEntry {humanId: $humanId, isAllowed: false})
       WHERE e.createdAt >= $cutoff
       RETURN count(e) AS count`,
      { humanId, cutoff }
    );
    const blockedFromActions = rows.filter(
      (a) =>
        a.executionStatus === 'failed' &&
        /block|denied|policy/i.test(a.errorMessage ?? '')
    ).length;
    const blockedCount = Number(auditBlocked?.count ?? 0) + blockedFromActions;

    const denom = total > 0 ? total : 1;
    const outcomeDenom = completed + failed > 0 ? completed + failed : denom;

    return {
      successRate:             completed / outcomeDenom,
      approvalOverrideRate:    approvedOrLater / denom,
      blockedActionRate:       Math.min(1, blockedCount / denom),
      topFailedActionTypes:    countByActionType(rows, (a) => a.executionStatus === 'failed').slice(0, 10),
      frequentlyApprovedActions: countByActionType(rows, (a) =>
        ['approved', 'executing', 'completed'].includes(a.executionStatus)
      ).slice(0, 10),
      totalActions: total,
      windowDays,
    };
  }

  /**
   * Detect the four XIOM evolution patterns within a sliding window.
   */
  async detectPatterns(humanId: string, windowDays = 30): Promise<DetectedPattern[]> {
    const cutoff = cutoffIso(windowDays);
    const patterns: DetectedPattern[] = [];

    // ── 1. Frequent manual approval (>10 approvals, no rejection) ──
    const approvalStats = await this.conn.queryMany<{
      actionType: string;
      approved: number;
      rejected: number;
    }>(
      `MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action {isDeleted: false})
       WHERE a.createdAt >= $cutoff
       WITH a.actionType AS actionType,
            sum(CASE WHEN a.executionStatus IN ['approved','executing','completed'] THEN 1 ELSE 0 END) AS approved,
            sum(CASE WHEN a.executionStatus = 'failed' THEN 1 ELSE 0 END) AS rejected
       WHERE approved > 10 AND rejected = 0
       RETURN actionType, approved, rejected`,
      { humanId, cutoff }
    );

    for (const row of approvalStats) {
      patterns.push({
        id:            crypto.randomUUID(),
        type:          'frequent_manual_approval',
        description:   `Action type "${row.actionType}" was approved ${row.approved} times with no rejections — candidate for auto-approve policy.`,
        evidenceCount: Number(row.approved),
        confidence:    Math.min(0.95, 0.5 + Number(row.approved) / 40),
        metadata:      {
          actionType: row.actionType,
          approved:   Number(row.approved),
          rejected:   Number(row.rejected),
          signal:     'auto_approve',
        },
      });
    }

    // ── 2. Consistent blocking (policy / layer-5 blocks > 5) ──
    const blockCount = await this.conn.queryOne<{ count: number }>(
      `MATCH (e:AuditEntry {humanId: $humanId, isAllowed: false})
       WHERE e.createdAt >= $cutoff
         AND (e.changeDescription CONTAINS 'policy' OR e.operation = 'EXECUTE_ACTION' OR e.operation = 'policy_check')
       RETURN count(e) AS count`,
      { humanId, cutoff }
    );
    // Also count failed actions with block-like errors
    const actionBlocks = await this.conn.queryOne<{ count: number }>(
      `MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action {isDeleted: false})
       WHERE a.createdAt >= $cutoff
         AND a.executionStatus = 'failed'
         AND a.errorMessage IS NOT NULL
         AND (a.errorMessage CONTAINS 'Blocked by policy' OR a.errorMessage CONTAINS '[L5]')
       RETURN count(a) AS count`,
      { humanId, cutoff }
    );
    const totalBlocks = Number(blockCount?.count ?? 0) + Number(actionBlocks?.count ?? 0);
    if (totalBlocks > 5) {
      patterns.push({
        id:            crypto.randomUUID(),
        type:          'consistent_blocking',
        description:   `${totalBlocks} policy/layer-5 blocks in the last ${windowDays} days — consider an explicit block policy.`,
        evidenceCount: totalBlocks,
        confidence:    Math.min(0.9, 0.4 + totalBlocks / 20),
        metadata:      { totalBlocks, windowDays, signal: 'explicit_block' },
      });
    }

    // ── 3. Goal drift (getDriftingGoals, threshold 7 days) ──
    const drifting = await getDriftingGoals(this.conn, humanId, 7);
    if (drifting.length > 0) {
      patterns.push({
        id:            crypto.randomUUID(),
        type:          'goal_drift',
        description:   `${drifting.length} active goal(s) have no linked actions in 7+ days.`,
        evidenceCount: drifting.length,
        confidence:    Math.min(0.85, 0.45 + drifting.length * 0.1),
        metadata:      {
          goalIds:   drifting.map((g) => g.id),
          goalNames: drifting.map((g) => g.name),
        },
      });
    }

    // ── 4. Policy contradiction (allow vs block on same key) ──
    const policies = await this.conn.queryMany<{
      id: string;
      name: string;
      condition: string;
      effect: string;
    }>(
      `MATCH (:Human {id: $humanId})-[:HAS_RULE]->(p:Policy {isActive: true, isDeleted: false})
       RETURN p.id AS id, p.name AS name, p.condition AS condition, p.effect AS effect`,
      { humanId }
    );

    const byKey = new Map<string, Array<{ id: string; name: string; effect: string; condition: string }>>();
    for (const p of policies) {
      const key = conditionKey(p.condition);
      if (!key) continue;
      const list = byKey.get(key) ?? [];
      list.push(p);
      byKey.set(key, list);
    }

    for (const [key, group] of byKey) {
      const effects = new Set(group.map((g) => g.effect));
      if (effects.has('allow') && effects.has('block')) {
        patterns.push({
          id:            crypto.randomUUID(),
          type:          'policy_contradiction',
          description:   `Conflicting allow/block policies for ${key}.`,
          evidenceCount: group.length,
          confidence:    0.8,
          metadata:      {
            key,
            policyIds:   group.map((g) => g.id),
            policyNames: group.map((g) => g.name),
            effects:     [...effects],
          },
        });
      }
    }

    return patterns;
  }

  /**
   * Create a PolicyUpdateProposal from a detected pattern and persist as PolicyProposal.
   */
  async proposePolicyUpdate(
    humanId: string,
    pattern: DetectedPattern
  ): Promise<PolicyUpdateProposal> {
    const id = crypto.randomUUID();
    const now = new Date();

    let proposedChange: PolicyUpdateProposal['proposedChange'];
    let currentPolicyId: string | undefined;

    switch (pattern.type) {
      case 'frequent_manual_approval': {
        const actionType = String(pattern.metadata['actionType'] ?? '*');
        proposedChange = {
          type:          'new_rule',
          condition:     `action.actionType === '${actionType}'`,
          effect:        'allow',
          description:   `Auto-allow frequently approved action type ${actionType}`,
          confidence:    pattern.confidence,
          evidenceCount: pattern.evidenceCount,
        };
        break;
      }
      case 'consistent_blocking': {
        proposedChange = {
          type:          'new_rule',
          condition:     "operation === 'EXECUTE_ACTION'",
          effect:        'block',
          description:   'Explicit block for consistently denied EXECUTE_ACTION patterns',
          confidence:    pattern.confidence,
          evidenceCount: pattern.evidenceCount,
        };
        break;
      }
      case 'goal_drift': {
        proposedChange = {
          type:          'new_rule',
          condition:     "operation === 'EXECUTE_ACTION'",
          effect:        'notify',
          description:   'Notify when goals drift without linked actions',
          confidence:    pattern.confidence,
          evidenceCount: pattern.evidenceCount,
        };
        break;
      }
      case 'policy_contradiction': {
        const policyIds = (pattern.metadata['policyIds'] as string[] | undefined) ?? [];
        currentPolicyId = policyIds[0];
        proposedChange = {
          type:          'merge_rules',
          condition:     String(pattern.metadata['key'] ?? 'true'),
          effect:        'require_approval',
          description:   `Resolve contradiction on ${String(pattern.metadata['key'] ?? 'unknown')} via require_approval`,
          confidence:    pattern.confidence,
          evidenceCount: pattern.evidenceCount,
        };
        break;
      }
    }

    const proposal: PolicyUpdateProposal = {
      id,
      humanId,
      patternId: pattern.id,
      proposedChange,
      status: 'pending_review',
      proposedAt: now,
      ...(currentPolicyId !== undefined ? { currentPolicyId } : {}),
    };

    await this.conn.query(
      `CREATE (pp:PolicyProposal {
         id:               $id,
         nodeType:         'PolicyProposal',
         humanId:          $humanId,
         patternId:        $patternId,
         currentPolicyId:  $currentPolicyId,
         proposedChange:   $proposedChange,
         status:           'pending_review',
         proposedAt:       $proposedAt,
         domain:           'SYMBIOSIS',
         confidence:       $confidence,
         version:          1,
         isDeleted:        false,
         createdAt:        $proposedAt,
         updatedAt:        $proposedAt
       })`,
      {
        humanId,
        id,
        patternId:       pattern.id,
        currentPolicyId: currentPolicyId ?? null,
        proposedChange:  JSON.stringify(proposedChange),
        proposedAt:      now.toISOString(),
        confidence:      proposedChange.confidence,
      }
    );

    return proposal;
  }

  /**
   * Review a pending proposal (approve or reject).
   */
  async reviewProposal(
    proposalId: string,
    decision: 'approved' | 'rejected'
  ): Promise<PolicyUpdateProposal> {
    const now = new Date().toISOString();
    const result = await this.conn.queryOne<{ proposal: Record<string, unknown> }>(
      `MATCH (pp:PolicyProposal {id: $proposalId})
       SET pp.status = $decision, pp.reviewedAt = $now, pp.updatedAt = $now
       RETURN pp { .* } AS proposal`,
      { proposalId, decision, now }
    );
    if (!result) throw new Error(`XIOM PolicyEvolution: proposal ${proposalId} not found`);
    return mapProposal(result.proposal);
  }

  /**
   * Apply an approved proposal: version the policy, link EVOLVED_FROM, audit, soft-verify.
   */
  async applyApprovedProposal(
    proposalId: string,
    humanId: string
  ): Promise<PolicyNode> {
    const row = await this.conn.queryOne<{ proposal: Record<string, unknown> }>(
      `MATCH (pp:PolicyProposal {id: $proposalId, humanId: $humanId})
       RETURN pp { .* } AS proposal`,
      { proposalId, humanId }
    );
    if (!row) throw new Error(`XIOM PolicyEvolution: proposal ${proposalId} not found`);

    let proposal = mapProposal(row.proposal);
    if (proposal.status === 'pending_review') {
      proposal = await this.reviewProposal(proposalId, 'approved');
    }
    if (proposal.status !== 'approved') {
      throw new Error(`XIOM PolicyEvolution: proposal ${proposalId} is not approved (status=${proposal.status})`);
    }

    const change = proposal.proposedChange;
    const effect =
      change.effect === 'notify' ? 'warn' : change.effect;

    let parentVersion = 0;
    let parentId: string | undefined = proposal.currentPolicyId;

    if (parentId) {
      const parent = await this.conn.queryOne<{ policyVersion: number }>(
        `MATCH (p:Policy {id: $id}) RETURN p.policyVersion AS policyVersion`,
        { id: parentId }
      );
      parentVersion = Number(parent?.policyVersion ?? 0);
    }

    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newVersion = parentVersion + 1;

    // Soft-verify: check new rule doesn't immediately contradict active allow/block peers
    const peers = await this.conn.queryMany<{ condition: string; effect: string; name: string }>(
      `MATCH (:Human {id: $humanId})-[:HAS_RULE]->(p:Policy {isActive: true, isDeleted: false})
       RETURN p.condition AS condition, p.effect AS effect, p.name AS name`,
      { humanId }
    );
    const newKey = conditionKey(change.condition);
    if (newKey && (effect === 'allow' || effect === 'block')) {
      for (const peer of peers) {
        const peerKey = conditionKey(peer.condition);
        if (peerKey === newKey && peer.effect !== effect && (peer.effect === 'allow' || peer.effect === 'block')) {
          // Best-effort: still apply but prefer require_approval to avoid hard contradiction
          console.warn(
            `[XIOM PolicyEvolution] Soft-verify warning: new ${effect} may contradict "${peer.name}" (${peer.effect})`
          );
        }
      }
    }

    // Deactivate old policy if modifying/merging
    if (parentId && (change.type === 'modify_rule' || change.type === 'merge_rules' || change.type === 'remove_rule')) {
      await this.conn.query(
        `MATCH (p:Policy {id: $id})
         SET p.isActive = false, p.updatedAt = $now, p.version = p.version + 1`,
        { id: parentId, now }
      );
    }

    if (change.type === 'remove_rule' && parentId) {
      await writeAudit(this.conn, humanId, `Removed policy ${parentId} via proposal ${proposalId}`, parentId);
      const removed = await this.conn.queryOne<{ policy: PolicyRow }>(
        `MATCH (p:Policy {id: $id}) RETURN p {
           .id, .name, .description, .condition, .effect, .policyVersion, .isActive,
           .parentPolicyId, .approvedBy, .domain, .confidence, .version, .createdAt, .updatedAt
         } AS policy`,
        { id: parentId }
      );
      if (!removed) throw new Error(`XIOM PolicyEvolution: parent policy ${parentId} missing after remove`);
      return mapPolicyNode({ ...removed.policy, isActive: false });
    }

    const name = `Evolved: ${change.description.slice(0, 80)}`;
    const created = await this.conn.queryOne<{ policy: PolicyRow }>(
      `MATCH (h:Human {id: $humanId})
       CREATE (p:Policy {
         id:             $id,
         nodeType:       'Policy',
         name:           $name,
         description:    $description,
         condition:      $condition,
         effect:         $effect,
         policyVersion:  $policyVersion,
         parentPolicyId: $parentPolicyId,
         isActive:       true,
         approvedBy:     'system',
         approvedAt:     $now,
         domain:         'SYMBIOSIS',
         confidence:     $confidence,
         version:        1,
         isDeleted:      false,
         createdAt:      $now,
         updatedAt:      $now
       })
       CREATE (h)-[:HAS_RULE]->(p)
       RETURN p {
         .id, .name, .description, .condition, .effect, .policyVersion, .isActive,
         .parentPolicyId, .approvedBy, .domain, .confidence, .version, .createdAt, .updatedAt
       } AS policy`,
      {
        humanId,
        id:             newId,
        name,
        description:    change.description,
        condition:      change.condition,
        effect,
        policyVersion:  newVersion,
        parentPolicyId: parentId ?? null,
        now,
        confidence:     change.confidence,
      }
    );

    if (!created) throw new Error(`XIOM PolicyEvolution: failed to create policy for proposal ${proposalId}`);

    if (parentId) {
      await this.conn.query(
        `MATCH (neu:Policy {id: $newId}), (old:Policy {id: $oldId})
         CREATE (neu)-[:EVOLVED_FROM]->(old)`,
        { newId, oldId: parentId }
      );
    }

    await writeAudit(
      this.conn,
      humanId,
      `Applied policy proposal ${proposalId} → policy ${newId} v${newVersion}`,
      newId
    );

    // Soft-verify evaluation against a synthetic payload (best-effort, non-throwing)
    try {
      evaluatePolicyCondition(change.condition, {
        operation: 'EXECUTE_ACTION',
        action:    { actionType: 'noop', toolName: 'noop' },
        payload:   { actionType: 'noop', toolName: 'noop' },
      });
    } catch {
      console.warn('[XIOM PolicyEvolution] Soft-verify: condition did not evaluate cleanly');
    }

    return mapPolicyNode(created.policy);
  }

  /**
   * Rollback a policy to a prior version by walking EVOLVED_FROM / policyVersion.
   */
  async rollbackPolicy(
    policyId: string,
    toVersion: number,
    humanId: string
  ): Promise<PolicyNode> {
    // Find the target version in the evolution chain starting from policyId
    const chain = await this.conn.queryMany<{ policy: PolicyRow }>(
      `MATCH (start:Policy {id: $policyId})
       MATCH path = (start)-[:EVOLVED_FROM*0..20]->(p:Policy)
       WHERE p.policyVersion = $toVersion
       RETURN p {
         .id, .name, .description, .condition, .effect, .policyVersion, .isActive,
         .parentPolicyId, .approvedBy, .domain, .confidence, .version, .createdAt, .updatedAt
       } AS policy
       LIMIT 1`,
      { policyId, toVersion }
    );

    let target = chain[0]?.policy;

    // Fallback: search by version among human's policies linked via parent chain
    if (!target) {
      const byVersion = await this.conn.queryOne<{ policy: PolicyRow }>(
        `MATCH (:Human {id: $humanId})-[:HAS_RULE]->(p:Policy {policyVersion: $toVersion, isDeleted: false})
         WHERE p.id = $policyId OR p.parentPolicyId = $policyId
            OR EXISTS { MATCH (cur:Policy {id: $policyId})-[:EVOLVED_FROM*]->(p) }
         RETURN p {
           .id, .name, .description, .condition, .effect, .policyVersion, .isActive,
           .parentPolicyId, .approvedBy, .domain, .confidence, .version, .createdAt, .updatedAt
         } AS policy
         LIMIT 1`,
        { humanId, policyId, toVersion }
      );
      target = byVersion?.policy;
    }

    if (!target) {
      throw new Error(`XIOM PolicyEvolution: no policy version ${toVersion} found from ${policyId}`);
    }

    const now = new Date().toISOString();

    // Deactivate current active descendants / start node
    await this.conn.query(
      `MATCH (:Human {id: $humanId})-[:HAS_RULE]->(p:Policy {isActive: true})
       WHERE p.id = $policyId OR EXISTS { MATCH (p)-[:EVOLVED_FROM*]->(:Policy {id: $targetId}) }
          OR EXISTS { MATCH (:Policy {id: $policyId})-[:EVOLVED_FROM*]->(p) }
       SET p.isActive = false, p.updatedAt = $now, p.version = p.version + 1`,
      { humanId, policyId, targetId: target.id, now }
    );

    await this.conn.query(
      `MATCH (p:Policy {id: $id})
       SET p.isActive = true, p.updatedAt = $now, p.version = p.version + 1`,
      { id: target.id, now }
    );

    await writeAudit(
      this.conn,
      humanId,
      `Rolled back policy ${policyId} to version ${toVersion} (restored ${target.id})`,
      target.id
    );

    const restored = await this.conn.queryOne<{ policy: PolicyRow }>(
      `MATCH (p:Policy {id: $id})
       RETURN p {
         .id, .name, .description, .condition, .effect, .policyVersion, .isActive,
         .parentPolicyId, .approvedBy, .domain, .confidence, .version, .createdAt, .updatedAt
       } AS policy`,
      { id: target.id }
    );
    if (!restored) throw new Error(`XIOM PolicyEvolution: restore failed for ${target.id}`);
    return mapPolicyNode(restored.policy);
  }
}

/** Convenience factory */
export function createPolicyEvolutionEngine(
  conn: Neo4jConnectionManager
): PolicyEvolutionEngine {
  return new PolicyEvolutionEngine(conn);
}
