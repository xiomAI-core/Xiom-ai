// ──────────────────────────────────────────────────────────────
// XIOM World Model — Action Query Helpers
// ──────────────────────────────────────────────────────────────
import type { Neo4jConnectionManager } from '../connection.js';
import type { ActionNode } from '../types/nodes.js';
import { WorldModelDomain } from '../types/domains.js';

type ProposeActionData = Omit<
  ActionNode,
  | 'id'
  | 'nodeType'
  | 'createdAt'
  | 'updatedAt'
  | 'version'
  | 'isDeleted'
  | 'executionStatus'
>;

/**
 * Record a proposed (pre-approval) action in the graph.
 */
export async function proposeAction(
  conn: Neo4jConnectionManager,
  data: ProposeActionData
): Promise<ActionNode> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const params: Record<string, unknown> = {
    id,
    actionType:      data.actionType,
    intent:          data.intent,
    domain:          data.domain,
    confidence:      data.confidence,
    executionStatus: 'proposed',
    now,
  };

  if (data.policyId      !== undefined) params['policyId']      = data.policyId;
  if (data.policyVersion !== undefined) params['policyVersion'] = data.policyVersion;
  if (data.toolName      !== undefined) params['toolName']      = data.toolName;
  if (data.toolInput     !== undefined) params['toolInput']     = JSON.stringify(data.toolInput);
  if (data.source        !== undefined) params['source']        = data.source;

  const result = await conn.queryOne<{ action: Record<string, unknown> }>(
    `CREATE (a:Action {
       id:              $id,
       nodeType:        'Action',
       actionType:      $actionType,
       intent:          $intent,
       domain:          $domain,
       confidence:      $confidence,
       executionStatus: 'proposed',
       version:         1,
       isDeleted:       false,
       createdAt:       $now,
       updatedAt:       $now
     })
     RETURN a { .* } AS action`,
    params
  );

  if (!result) throw new Error('proposeAction: CREATE returned no result');
  return mapAction(result.action);
}

/**
 * Transition an action from 'proposed' → 'approved'.
 */
export async function approveAction(
  conn: Neo4jConnectionManager,
  actionId: string
): Promise<void> {
  await conn.query(
    `MATCH (a:Action {id: $actionId})
     SET a.executionStatus = 'approved',
         a.updatedAt       = $now,
         a.version         = a.version + 1`,
    { actionId, now: new Date().toISOString() }
  );
}

/**
 * Transition an action to 'completed' and record its result.
 */
export async function completeAction(
  conn: Neo4jConnectionManager,
  actionId: string,
  result: string
): Promise<void> {
  await conn.query(
    `MATCH (a:Action {id: $actionId})
     SET a.executionStatus = 'completed',
         a.result          = $result,
         a.updatedAt       = $now,
         a.version         = a.version + 1`,
    { actionId, result, now: new Date().toISOString() }
  );
}

/**
 * Transition an action to 'failed' and record the error reason.
 */
export async function failAction(
  conn: Neo4jConnectionManager,
  actionId: string,
  errorMessage: string
): Promise<void> {
  await conn.query(
    `MATCH (a:Action {id: $actionId})
     SET a.executionStatus = 'failed',
         a.errorMessage    = $errorMessage,
         a.updatedAt       = $now,
         a.version         = a.version + 1`,
    { actionId, errorMessage, now: new Date().toISOString() }
  );
}

/**
 * Return all proposed or approved actions for a human,
 * ordered by creation time (most recent first).
 */
export async function getPendingActionsForHuman(
  conn: Neo4jConnectionManager,
  humanId: string
): Promise<ActionNode[]> {
  const rows = await conn.queryMany<{ action: Record<string, unknown> }>(
    `MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action {isDeleted: false})
     WHERE a.executionStatus IN ['proposed', 'approved', 'executing']
     RETURN a { .* } AS action
     ORDER BY a.createdAt DESC`,
    { humanId }
  );
  return rows.map((r) => mapAction(r.action));
}

// ─── Mapper ───────────────────────────────────────────────────

function mapAction(raw: Record<string, unknown>): ActionNode {
  const base = {
    id:              String(raw['id'] ?? ''),
    nodeType:        'Action' as const,
    actionType:      String(raw['actionType'] ?? ''),
    intent:          String(raw['intent'] ?? ''),
    executionStatus: (raw['executionStatus'] ?? 'proposed') as ActionNode['executionStatus'],
    domain:          (raw['domain'] as WorldModelDomain) ?? WorldModelDomain.EXECUTION,
    confidence:      Number(raw['confidence'] ?? 1),
    version:         Number(raw['version'] ?? 1),
    isDeleted:       Boolean(raw['isDeleted'] ?? false),
    createdAt:       raw['createdAt'] ? new Date(String(raw['createdAt'])) : new Date(),
    updatedAt:       raw['updatedAt'] ? new Date(String(raw['updatedAt'])) : new Date(),
  };

  return {
    ...base,
    ...(raw['source']        !== undefined ? { source:        String(raw['source']) }        : {}),
    ...(raw['policyId']      !== undefined ? { policyId:      String(raw['policyId']) }      : {}),
    ...(raw['policyVersion'] !== undefined ? { policyVersion: Number(raw['policyVersion']) } : {}),
    ...(raw['result']        !== undefined ? { result:        String(raw['result']) }        : {}),
    ...(raw['errorMessage']  !== undefined ? { errorMessage:  String(raw['errorMessage']) }  : {}),
    ...(raw['receiptId']     !== undefined ? { receiptId:     String(raw['receiptId']) }     : {}),
    ...(raw['toolName']      !== undefined ? { toolName:      String(raw['toolName']) }      : {}),
    ...(raw['toolInput']     !== undefined ? {
      toolInput: typeof raw['toolInput'] === 'string'
        ? JSON.parse(raw['toolInput']) as Record<string, unknown>
        : raw['toolInput'] as Record<string, unknown>
    } : {}),
    ...(raw['toolOutput'] !== undefined ? {
      toolOutput: typeof raw['toolOutput'] === 'string'
        ? JSON.parse(raw['toolOutput']) as Record<string, unknown>
        : raw['toolOutput'] as Record<string, unknown>
    } : {}),
  };
}
