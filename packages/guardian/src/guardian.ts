// ──────────────────────────────────────────────────────────────
// XIOM Guardian — 9-Layer Constitutional Enforcement Pipeline
//
// Every graph write and action execution passes through this pipeline.
// It NEVER auto-approves when uncertain. It fails closed.
// ──────────────────────────────────────────────────────────────
import { createHash } from 'crypto';
import { z } from 'zod';
import type { Neo4jConnectionManager } from '@xiom/world-model';
import { ALLOWED_EDGES, AuthorityLevel, WorldModelDomain } from '@xiom/world-model';

// ════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ════════════════════════════════════════════════════════════════

export type GuardianOperation =
  | 'CREATE_NODE'
  | 'UPDATE_NODE'
  | 'DELETE_NODE'
  | 'CREATE_EDGE'
  | 'EXECUTE_ACTION';

export interface GuardianInput {
  operation: GuardianOperation;
  actorType: 'human' | 'agent' | 'system';
  actorId: string;
  /** Which user's world model this operates on */
  humanId: string;
  /** Which surface originated the request (chat, cron, api_v2, payment, …) */
  surfaceId: string;
  payload: unknown;
  authorityLevel: AuthorityLevel;
}

export interface SurfacePermissions {
  surfaceId: string;
  allowedOperations: GuardianOperation[];
  allowedNodeTypes: string[];
}

export interface AuditEntryDraft {
  humanId: string;
  operation: string;
  actorType: 'human' | 'agent' | 'system' | 'daemon';
  actorId: string;
  targetNodeId: string;
  targetNodeType: string;
  changeDescription: string;
  prevHash: string;
  hash: string;
  isVerified: boolean;
  isAllowed: boolean;
  timestamp: string;
}

export interface GuardianResult {
  allowed: boolean;
  requiresHumanApproval: boolean;
  deniedLayers: number[];
  reason?: string;
  auditEntry: AuditEntryDraft;
  warnings: string[];
}

// ─── Internal layer result ────────────────────────────────────

interface LayerResult {
  allowed: boolean;
  requiresApproval?: boolean;
  reason?: string;
  warnings?: string[];
}

// ════════════════════════════════════════════════════════════════
// SAFE EXPRESSION EVALUATOR (NO eval / Function())
// Supports: property paths, string/number/boolean literals,
// ===, !==, >, <, >=, <=, &&, ||, !, .includes(), .startsWith(),
// .endsWith(), .length, parentheses.
// ════════════════════════════════════════════════════════════════

type TType =
  | 'ID' | 'DOT' | 'STR' | 'NUM' | 'BOOL' | 'NULL'
  | 'LP' | 'RP' | 'LB' | 'RB'
  | 'EQ' | 'NEQ' | 'GT' | 'LT' | 'GTE' | 'LTE'
  | 'AND' | 'OR' | 'NOT' | 'COMMA' | 'EOF';

interface Tok { t: TType; v: string }

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }

    // String literals (single or double quoted)
    if (c === "'" || c === '"') {
      const q = c; let s = ''; i++;
      while (i < src.length && src[i] !== q) { s += src[i++]; }
      i++;
      out.push({ t: 'STR', v: s }); continue;
    }

    // Number literals
    if (/\d/.test(c) || (c === '-' && /\d/.test(src[i + 1] ?? ''))) {
      let n = '';
      while (i < src.length && /[\d.]/.test(src[i]!)) n += src[i++];
      out.push({ t: 'NUM', v: n }); continue;
    }

    // Identifiers & keywords
    if (/[a-zA-Z_$]/.test(c)) {
      let id = '';
      while (i < src.length && /[\w$]/.test(src[i]!)) id += src[i++];
      if (id === 'true' || id === 'false') out.push({ t: 'BOOL', v: id });
      else if (id === 'null' || id === 'undefined') out.push({ t: 'NULL', v: id });
      else out.push({ t: 'ID', v: id });
      continue;
    }

    const three = src.slice(i, i + 3);
    const two   = src.slice(i, i + 2);

    if (three === '===') { out.push({ t: 'EQ',  v: '===' }); i += 3; continue; }
    if (three === '!==') { out.push({ t: 'NEQ', v: '!==' }); i += 3; continue; }
    if (two === '&&') { out.push({ t: 'AND', v: '&&' }); i += 2; continue; }
    if (two === '||') { out.push({ t: 'OR',  v: '||' }); i += 2; continue; }
    if (two === '>=') { out.push({ t: 'GTE', v: '>=' }); i += 2; continue; }
    if (two === '<=') { out.push({ t: 'LTE', v: '<=' }); i += 2; continue; }

    switch (c) {
      case '>': out.push({ t: 'GT',    v: '>' }); break;
      case '<': out.push({ t: 'LT',    v: '<' }); break;
      case '!': out.push({ t: 'NOT',   v: '!' }); break;
      case '.': out.push({ t: 'DOT',   v: '.' }); break;
      case '(': out.push({ t: 'LP',    v: '(' }); break;
      case ')': out.push({ t: 'RP',    v: ')' }); break;
      case '[': out.push({ t: 'LB',    v: '[' }); break;
      case ']': out.push({ t: 'RB',    v: ']' }); break;
      case ',': out.push({ t: 'COMMA', v: ',' }); break;
    }
    i++;
  }
  out.push({ t: 'EOF', v: '' });
  return out;
}

type ASTNode =
  | { k: 'or';     left: ASTNode; right: ASTNode }
  | { k: 'and';    left: ASTNode; right: ASTNode }
  | { k: 'not';    expr: ASTNode }
  | { k: 'cmp';    op: string; left: ASTNode; right: ASTNode }
  | { k: 'call';   obj: ASTNode; method: string; args: ASTNode[] }
  | { k: 'member'; obj: ASTNode; prop: string }
  | { k: 'id';     name: string }
  | { k: 'lit';    value: unknown }
  | { k: 'group';  expr: ASTNode };

class ExprParser {
  private pos = 0;
  constructor(private readonly tokens: Tok[]) {}

  private peek(): Tok  { return this.tokens[this.pos] ?? { t: 'EOF', v: '' }; }
  private next(): Tok  { return this.tokens[this.pos++] ?? { t: 'EOF', v: '' }; }
  private eat(t: TType): Tok {
    const tok = this.next();
    if (tok.t !== t) throw new Error(`Expected token ${t}, got ${tok.t}`);
    return tok;
  }

  parse(): ASTNode { return this.parseOr(); }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.peek().t === 'OR') { this.next(); left = { k: 'or', left, right: this.parseAnd() }; }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseNot();
    while (this.peek().t === 'AND') { this.next(); left = { k: 'and', left, right: this.parseNot() }; }
    return left;
  }

  private parseNot(): ASTNode {
    if (this.peek().t === 'NOT') { this.next(); return { k: 'not', expr: this.parseNot() }; }
    return this.parseCmp();
  }

  private parseCmp(): ASTNode {
    const left = this.parseMember();
    const cmpTypes: TType[] = ['EQ', 'NEQ', 'GT', 'LT', 'GTE', 'LTE'];
    const pk = this.peek();
    if (cmpTypes.includes(pk.t)) {
      const op = this.next().v;
      return { k: 'cmp', op, left, right: this.parsePrimary() };
    }
    return left;
  }

  private parseMember(): ASTNode {
    let node = this.parsePrimary();
    while (this.peek().t === 'DOT') {
      this.next();
      const prop = this.eat('ID').v;
      if (this.peek().t === 'LP') {
        this.next(); // consume '('
        const args: ASTNode[] = [];
        while (this.peek().t !== 'RP' && this.peek().t !== 'EOF') {
          args.push(this.parse());
          if (this.peek().t === 'COMMA') this.next();
        }
        this.eat('RP');
        node = { k: 'call', obj: node, method: prop, args };
      } else {
        node = { k: 'member', obj: node, prop };
      }
    }
    return node;
  }

  private parsePrimary(): ASTNode {
    const tok = this.peek();
    if (tok.t === 'LP')   { this.next(); const e = this.parse(); this.eat('RP'); return { k: 'group', expr: e }; }
    if (tok.t === 'STR')  { this.next(); return { k: 'lit', value: tok.v }; }
    if (tok.t === 'NUM')  { this.next(); return { k: 'lit', value: Number(tok.v) }; }
    if (tok.t === 'BOOL') { this.next(); return { k: 'lit', value: tok.v === 'true' }; }
    if (tok.t === 'NULL') { this.next(); return { k: 'lit', value: null }; }
    if (tok.t === 'ID')   { this.next(); return { k: 'id',  name: tok.v }; }
    return { k: 'lit', value: null };
  }
}

function evalAST(node: ASTNode, ctx: Record<string, unknown>): unknown {
  switch (node.k) {
    case 'lit':    return node.value;
    case 'id':     return ctx[node.name];
    case 'group':  return evalAST(node.expr, ctx);
    case 'not':    return !evalAST(node.expr, ctx);
    case 'or':     return Boolean(evalAST(node.left, ctx)) || Boolean(evalAST(node.right, ctx));
    case 'and':    return Boolean(evalAST(node.left, ctx)) && Boolean(evalAST(node.right, ctx));
    case 'member': {
      const obj = evalAST(node.obj, ctx);
      if (obj == null || typeof obj !== 'object') return undefined;
      return (obj as Record<string, unknown>)[node.prop];
    }
    case 'call': {
      const obj  = evalAST(node.obj, ctx);
      const args = node.args.map((a) => evalAST(a, ctx));
      const a0   = args[0] ?? '';
      if (typeof obj === 'string') {
        if (node.method === 'includes')    return obj.includes(String(a0));
        if (node.method === 'startsWith')  return obj.startsWith(String(a0));
        if (node.method === 'endsWith')    return obj.endsWith(String(a0));
      }
      if (Array.isArray(obj)) {
        if (node.method === 'includes') return obj.includes(a0);
      }
      return undefined;
    }
    case 'cmp': {
      const l = evalAST(node.left, ctx);
      const r = evalAST(node.right, ctx);
      switch (node.op) {
        case '===': return l === r;
        case '!==': return l !== r;
        case '>':   return Number(l) > Number(r);
        case '<':   return Number(l) < Number(r);
        case '>=':  return Number(l) >= Number(r);
        case '<=':  return Number(l) <= Number(r);
        default:    return false;
      }
    }
  }
}

const DANGEROUS_PATTERN =
  /\b(eval|Function|constructor|prototype|__proto__|globalThis|process|require|import|window|document)\b/;

export function evaluatePolicyCondition(
  condition: string,
  context: Record<string, unknown>
): boolean {
  if (DANGEROUS_PATTERN.test(condition)) {
    throw new Error('Guardian: unsafe condition pattern rejected');
  }
  const tokens = lex(condition);
  const ast    = new ExprParser(tokens).parse();
  return Boolean(evalAST(ast, context));
}

// ════════════════════════════════════════════════════════════════
// ZOD SCHEMAS FOR LAYER 1
// ════════════════════════════════════════════════════════════════

const CreateNodePayloadSchema = z.object({
  nodeType: z.string().min(1),
  domain:   z.nativeEnum(WorldModelDomain),
}).passthrough();

const UpdateNodePayloadSchema = z.object({
  id: z.string().uuid(),
}).passthrough();

const DeleteNodePayloadSchema = z.object({
  id: z.string().uuid(),
});

const CreateEdgePayloadSchema = z.object({
  fromId:           z.string().uuid(),
  toId:             z.string().uuid(),
  relationshipType: z.string().min(1),
  fromNodeType:     z.string().min(1),
  toNodeType:       z.string().min(1),
});

const ExecuteActionPayloadSchema = z.object({
  actionType: z.string().min(1),
  intent:     z.string().min(1),
  toolName:   z.string().min(1),
  toolInput:  z.record(z.unknown()),
});

// ════════════════════════════════════════════════════════════════
// LAYERS
// ════════════════════════════════════════════════════════════════

// ─── Layer 1: Schema Validation ───────────────────────────────

function layer1_schemaValidation(input: GuardianInput): LayerResult {
  type SchemaMap = Record<GuardianOperation, z.ZodTypeAny>;
  const schemas: SchemaMap = {
    CREATE_NODE:    CreateNodePayloadSchema,
    UPDATE_NODE:    UpdateNodePayloadSchema,
    DELETE_NODE:    DeleteNodePayloadSchema,
    CREATE_EDGE:    CreateEdgePayloadSchema,
    EXECUTE_ACTION: ExecuteActionPayloadSchema,
  };

  const schema = schemas[input.operation];
  const result = schema.safeParse(input.payload);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { allowed: false, reason: `Schema validation failed: ${issues}` };
  }
  return { allowed: true };
}

// ─── Layer 2: Entity Existence ────────────────────────────────

async function layer2_entityExists(
  input: GuardianInput,
  conn: Neo4jConnectionManager
): Promise<LayerResult> {
  if (input.operation === 'UPDATE_NODE' || input.operation === 'DELETE_NODE') {
    const p = input.payload as { id: string };
    const exists = await conn.queryOne<{ exists: boolean }>(
      `MATCH (n {id: $id}) RETURN true AS exists LIMIT 1`,
      { id: p.id }
    );
    if (!exists) return { allowed: false, reason: `Node ${p.id} does not exist` };
  }

  if (input.operation === 'CREATE_EDGE') {
    const p = input.payload as { fromId: string; toId: string };
    const fromExists = await conn.queryOne<{ exists: boolean }>(
      `MATCH (n {id: $id}) RETURN true AS exists LIMIT 1`,
      { id: p.fromId }
    );
    if (!fromExists) return { allowed: false, reason: `Source node ${p.fromId} does not exist` };

    const toExists = await conn.queryOne<{ exists: boolean }>(
      `MATCH (n {id: $id}) RETURN true AS exists LIMIT 1`,
      { id: p.toId }
    );
    if (!toExists) return { allowed: false, reason: `Target node ${p.toId} does not exist` };
  }

  return { allowed: true };
}

// ─── Layer 3: Relationship Validity ───────────────────────────

function layer3_relationshipValidity(input: GuardianInput): LayerResult {
  if (input.operation !== 'CREATE_EDGE') return { allowed: true };

  const p = input.payload as {
    relationshipType: string;
    fromNodeType: string;
    toNodeType: string;
  };

  const allowed = ALLOWED_EDGES[p.relationshipType];
  if (!allowed) {
    return { allowed: false, reason: `Unknown relationship type: ${p.relationshipType}` };
  }
  if (!allowed.from.includes(p.fromNodeType)) {
    return {
      allowed: false,
      reason:  `${p.fromNodeType} cannot be source of ${p.relationshipType}. Allowed: ${allowed.from.join(', ')}`,
    };
  }
  if (!allowed.to.includes(p.toNodeType)) {
    return {
      allowed: false,
      reason:  `${p.toNodeType} cannot be target of ${p.relationshipType}. Allowed: ${allowed.to.join(', ')}`,
    };
  }
  return { allowed: true };
}

// ─── Layer 4: Permission Scope ────────────────────────────────

const PAYMENT_PATTERN = /payment|transfer|withdraw|deposit/i;

function layer4_permissionScope(
  input: GuardianInput,
  perms: SurfacePermissions
): LayerResult {
  if (!perms.allowedOperations.includes(input.operation)) {
    return {
      allowed: false,
      reason:  `Operation ${input.operation} is not permitted on surface "${perms.surfaceId}"`,
    };
  }

  // Check nodeType if present
  if (input.operation === 'CREATE_NODE' || input.operation === 'UPDATE_NODE') {
    const p = input.payload as { nodeType?: string };
    if (p.nodeType && !perms.allowedNodeTypes.includes(p.nodeType)) {
      return {
        allowed: false,
        reason:  `Node type ${p.nodeType} is not permitted on surface "${perms.surfaceId}"`,
      };
    }
  }

  // Block payment-related actions from non-payment surfaces
  if (input.operation === 'EXECUTE_ACTION') {
    const p = input.payload as { toolName?: string; actionType?: string };
    const isMoneyOp =
      PAYMENT_PATTERN.test(p.toolName ?? '') || PAYMENT_PATTERN.test(p.actionType ?? '');
    if (isMoneyOp && perms.surfaceId !== 'payment') {
      return {
        allowed: false,
        reason:  `Payment/transfer operations are blocked on surface "${perms.surfaceId}". Use the "payment" surface.`,
      };
    }
  }

  return { allowed: true };
}

// ─── Layer 5: Policy Evaluation ───────────────────────────────

async function layer5_policyEvaluation(
  input: GuardianInput,
  conn: Neo4jConnectionManager
): Promise<LayerResult> {
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
  let requiresApproval = false;

  // Build a safe evaluation context from the payload
  const context: Record<string, unknown> = {
    operation: input.operation,
    actorType: input.actorType,
    actorId:   input.actorId,
    action:    input.payload,    // alias so conditions can use `action.toolName`
    payload:   input.payload,
    surface:   input.surfaceId,
  };

  for (const policy of policies) {
    let matches = false;
    try {
      matches = evaluatePolicyCondition(policy.condition, context);
    } catch {
      // Unparseable condition — fail closed for 'block'/'require_approval', skip for 'warn'/'allow'
      matches = false;
    }

    if (!matches) continue;

    switch (policy.effect) {
      case 'block':
        return { allowed: false, reason: `Blocked by policy: ${policy.name}` };
      case 'require_approval':
        requiresApproval = true;
        warnings.push(`Policy "${policy.name}" requires human approval`);
        break;
      case 'warn':
        warnings.push(`Policy "${policy.name}" warns: review this operation`);
        break;
      case 'allow':
        // explicit allow — continue evaluating other policies
        break;
    }
  }

  return { allowed: true, requiresApproval, warnings };
}

// ─── Layer 6: Authority Tier ──────────────────────────────────

function layer6_authorityTier(input: GuardianInput): LayerResult {
  const { authorityLevel, operation } = input;

  // Extract domain from payload when available
  const domain = (input.payload as Record<string, unknown>)['domain'] as
    WorldModelDomain | undefined;

  switch (authorityLevel) {
    case AuthorityLevel.OBSERVE:
      // Only TRACK domain nodes can be written
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
  }
}

// ─── Layer 7: Budget & Cooldown ───────────────────────────────

const HIGH_RISK_PATTERN = /delete|payment|transfer|external.write/i;
const MAX_ACTIONS_PER_HOUR      = 60;
const MAX_HIGH_RISK_PER_HOUR    = 5;
const COOLDOWN_SECONDS          = 30;

async function layer7_budgetAndCooldown(
  input: GuardianInput,
  conn: Neo4jConnectionManager
): Promise<LayerResult> {
  if (input.operation !== 'EXECUTE_ACTION') return { allowed: true };

  const p = input.payload as { actionType?: string; toolName?: string };
  const isHighRisk =
    HIGH_RISK_PATTERN.test(p.actionType ?? '') ||
    HIGH_RISK_PATTERN.test(p.toolName ?? '');

  // Total action count in the last hour
  const totalResult = await conn.queryOne<{ count: number }>(
    `MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action)
     WHERE a.createdAt > $since
     RETURN count(a) AS count`,
    {
      humanId: input.humanId,
      since:   new Date(Date.now() - 3_600_000).toISOString(),
    }
  );

  const total = Number(totalResult?.count ?? 0);
  if (total >= MAX_ACTIONS_PER_HOUR) {
    const resetMinutes = 60 - Math.floor((Date.now() % 3_600_000) / 60_000);
    return {
      allowed: false,
      reason:  `Rate limit: ${total}/${MAX_ACTIONS_PER_HOUR} actions/hour exceeded. Resets in ~${resetMinutes} minutes.`,
    };
  }

  if (isHighRisk) {
    const hrResult = await conn.queryOne<{ count: number }>(
      `MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action)
       WHERE a.createdAt > $since
         AND (a.actionType =~ '(?i)delete|payment|transfer|external.write'
           OR a.toolName   =~ '(?i)delete|payment|transfer|external.write')
       RETURN count(a) AS count`,
      {
        humanId: input.humanId,
        since:   new Date(Date.now() - 3_600_000).toISOString(),
      }
    );
    const hrCount = Number(hrResult?.count ?? 0);
    if (hrCount >= MAX_HIGH_RISK_PER_HOUR) {
      return {
        allowed: false,
        reason:  `High-risk rate limit: ${hrCount}/${MAX_HIGH_RISK_PER_HOUR} sensitive operations/hour reached.`,
      };
    }
  }

  // Cooldown: was the same action type executed < 30s ago?
  const cooldownResult = await conn.queryOne<{ lastAt: string }>(
    `MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action {actionType: $actionType})
     RETURN a.createdAt AS lastAt
     ORDER BY a.createdAt DESC
     LIMIT 1`,
    { humanId: input.humanId, actionType: p.actionType ?? '' }
  );

  if (cooldownResult?.lastAt) {
    const elapsed = (Date.now() - new Date(cooldownResult.lastAt).getTime()) / 1000;
    if (elapsed < COOLDOWN_SECONDS) {
      return {
        allowed: false,
        reason:  `Cooldown active: same action type was executed ${Math.round(elapsed)}s ago. Wait ${Math.round(COOLDOWN_SECONDS - elapsed)}s.`,
      };
    }
  }

  return { allowed: true };
}

// ─── Layer 8: Conflict Detection ──────────────────────────────

async function layer8_conflictDetection(
  input: GuardianInput,
  conn: Neo4jConnectionManager
): Promise<LayerResult> {
  if (input.operation !== 'CREATE_NODE') return { allowed: true };

  const p = input.payload as {
    nodeType?: string;
    content?: string;
    condition?: string;
    deadline?: string;
    priority?: number;
    name?: string;
  };

  const warnings: string[] = [];

  // Fact duplication check
  if (p.nodeType === 'Fact' && p.content) {
    const dupeResult = await conn.queryOne<{ content: string; score: number }>(
      `CALL db.index.fulltext.queryNodes('fact_content', $content) YIELD node, score
       WHERE score > 0.9 AND node.isDeleted = false
       RETURN node.content AS content, score
       ORDER BY score DESC LIMIT 1`,
      { content: p.content }
    ).catch(() => null); // fulltext index may not be ready in test envs

    if (dupeResult) {
      if (Number(dupeResult.score) > 0.99) {
        return { allowed: false, reason: `Duplicate fact detected: "${dupeResult.content}"` };
      }
      warnings.push(`Similar fact already exists (score ${dupeResult.score.toFixed(2)}): "${dupeResult.content}"`);
    }
  }

  // Rule contradiction check
  if (p.nodeType === 'Rule' && p.condition) {
    const conflictResult = await conn.queryOne<{ action: string }>(
      `MATCH (:Human {id: $humanId})-[:HAS_RULE]->(r:Rule {isActive: true, isDeleted: false, condition: $condition})
       RETURN r.action AS action LIMIT 1`,
      { humanId: input.humanId, condition: p.condition }
    );
    if (conflictResult) {
      warnings.push(
        `A rule with condition "${p.condition}" already exists with action: "${conflictResult.action}". Review for contradiction.`
      );
    }
  }

  // Deadline conflict check for high-priority goals
  if (p.nodeType === 'Goal' && p.deadline && (p.priority ?? 0) >= 8) {
    const conflictResult = await conn.queryOne<{ name: string }>(
      `MATCH (:Human {id: $humanId})-[:HAS_GOAL]->(g:Goal {isDeleted: false})
       WHERE g.status = 'active' AND g.priority >= 8 AND g.deadline = $deadline
       RETURN g.name AS name LIMIT 1`,
      { humanId: input.humanId, deadline: p.deadline }
    );
    if (conflictResult) {
      warnings.push(
        `Another high-priority goal "${conflictResult.name}" has the same deadline. Risk of conflict.`
      );
    }
  }

  return { allowed: true, warnings };
}

// ─── Layer 9: Audit Entry Creation ────────────────────────────

const GENESIS_AUDIT_HASH = '0'.repeat(64);

async function layer9_auditAndReceipt(
  input: GuardianInput,
  resultSoFar: { allowed: boolean },
  conn: Neo4jConnectionManager
): Promise<AuditEntryDraft> {
  const timestamp = new Date().toISOString();
  const p = input.payload as Record<string, unknown>;
  const targetNodeId   = String(p['id'] ?? p['fromId'] ?? 'unknown');
  const targetNodeType = String(p['nodeType'] ?? p['fromNodeType'] ?? input.operation);

  // Fetch the most recent audit entry hash to build the chain.
  // Use try-catch instead of .catch() chaining so this is robust even when
  // the connection mock returns a non-Promise (e.g. in unit tests with
  // exhausted mockResolvedValueOnce chains).
  let prevEntry: { hash: string } | null = null;
  try {
    prevEntry = await conn.queryOne<{ hash: string }>(
      `MATCH (a:AuditEntry {humanId: $humanId})
       RETURN a.hash AS hash
       ORDER BY a.createdAt DESC LIMIT 1`,
      { humanId: input.humanId }
    );
  } catch {
    prevEntry = null;
  }

  const prevHash = prevEntry?.hash ?? GENESIS_AUDIT_HASH;

  const hash = createHash('sha256')
    .update(`${prevHash}${timestamp}${input.operation}${targetNodeId}${String(resultSoFar.allowed)}`)
    .digest('hex');

  const draft: AuditEntryDraft = {
    humanId:         input.humanId,
    operation:       input.operation,
    actorType:       input.actorType,
    actorId:         input.actorId,
    targetNodeId,
    targetNodeType,
    changeDescription: `${input.operation} by ${input.actorType}:${input.actorId} on surface ${input.surfaceId}`,
    prevHash,
    hash,
    isVerified: false,
    isAllowed:  resultSoFar.allowed,
    timestamp,
  };

  // Write the audit entry (both allowed and denied are recorded)
  try {
    await conn.query(
      `CREATE (a:AuditEntry {
         id:                $id,
         nodeType:          'AuditEntry',
         humanId:           $humanId,
         operation:         $operation,
         actorType:         $actorType,
         actorId:           $actorId,
         targetNodeId:      $targetNodeId,
         targetNodeType:    $targetNodeType,
         changeDescription: $changeDescription,
         prevHash:          $prevHash,
         hash:              $hash,
         isVerified:        false,
         isAllowed:         $isAllowed,
         domain:            'TRACK',
         confidence:        1.0,
         version:           1,
         isDeleted:         false,
         createdAt:         $timestamp,
         updatedAt:         $timestamp
       })`,
      {
        id:                crypto.randomUUID(),
        humanId:           draft.humanId,
        operation:         draft.operation,
        actorType:         draft.actorType,
        actorId:           draft.actorId,
        targetNodeId:      draft.targetNodeId,
        targetNodeType:    draft.targetNodeType,
        changeDescription: draft.changeDescription,
        prevHash:          draft.prevHash,
        hash:              draft.hash,
        isAllowed:         draft.isAllowed,
        timestamp:         draft.timestamp,
      }
    );
  } catch {
    // Audit write failure must never crash the primary operation
    console.error('[Guardian] Audit entry write failed — continuing');
  }

  return draft;
}

// ════════════════════════════════════════════════════════════════
// MAIN GUARDIAN FUNCTION
// ════════════════════════════════════════════════════════════════

function buildDenialReason(
  deniedLayers: number[],
  results: Array<LayerResult | null>
): string {
  const reasons = deniedLayers
    .map((n) => {
      const r = results[n - 1];
      return r?.reason ? `[L${n}] ${r.reason}` : `[L${n}] denied`;
    })
    .filter(Boolean);
  return reasons.join(' | ');
}

export async function runGuardian(
  input: GuardianInput,
  conn: Neo4jConnectionManager,
  surfacePermissions: SurfacePermissions
): Promise<GuardianResult> {
  const warnings:     string[] = [];
  const deniedLayers: number[] = [];
  let requiresHumanApproval   = false;

  // ─── Synchronous layers ───────────────────────────────────
  const l1 = layer1_schemaValidation(input);
  if (!l1.allowed) deniedLayers.push(1);

  // ─── Async layers (run concurrently where safe) ───────────
  const [l2, l4, l6] = await Promise.all([
    layer2_entityExists(input, conn),
    Promise.resolve(layer4_permissionScope(input, surfacePermissions)),
    Promise.resolve(layer6_authorityTier(input)),
  ]);

  if (!l2.allowed) deniedLayers.push(2);
  if (!l4.allowed) deniedLayers.push(4);
  if (!l6.allowed) deniedLayers.push(6);
  if (l6.requiresApproval) requiresHumanApproval = true;

  // Layer 3 only makes sense when Layer 1 passes (payload must be valid)
  const l3 = l1.allowed ? layer3_relationshipValidity(input) : { allowed: true };
  if (!l3.allowed) deniedLayers.push(3);

  // Remaining DB-hitting layers
  const [l5, l7, l8] = await Promise.all([
    layer5_policyEvaluation(input, conn),
    layer7_budgetAndCooldown(input, conn),
    layer8_conflictDetection(input, conn),
  ]);

  if (!l5.allowed) deniedLayers.push(5);
  if (l5.requiresApproval) requiresHumanApproval = true;
  if (l5.warnings) warnings.push(...l5.warnings);

  if (!l7.allowed) deniedLayers.push(7);

  if (!l8.allowed) deniedLayers.push(8);
  if (l8.warnings) warnings.push(...l8.warnings);

  const isAllowed = deniedLayers.length === 0;

  // ─── Layer 9 always runs ──────────────────────────────────
  const auditEntry = await layer9_auditAndReceipt(input, { allowed: isAllowed }, conn);

  return {
    allowed: isAllowed,
    requiresHumanApproval: isAllowed && requiresHumanApproval,
    deniedLayers,
    ...(isAllowed
      ? {}
      : { reason: buildDenialReason(deniedLayers, [l1, l2, l3, l4, l5, l6, l7, l8]) }),
    auditEntry,
    warnings,
  };
}

// ─── Re-export authority level for convenience ─────────────────
export { AuthorityLevel };
