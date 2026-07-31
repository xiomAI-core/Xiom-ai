// ──────────────────────────────────────────────────────────────
// XIOM API — Loop Scheduler Daemon (Phase 5 Evolve)
//
// Polls due loops every 60s, gates via Guardian, dispatches tools,
// writes LoopRunCard nodes to Neo4j, and advances nextRunAt.
// ──────────────────────────────────────────────────────────────
import { and, eq, lte } from 'drizzle-orm';
import cronParser from 'cron-parser';
import { loops } from '@xiom/db';
import {
  createConnectionManager,
  getDriftingGoals,
  getStaleFactsForHuman,
  verifyReceiptChain,
  writeFact,
  proposeAction,
  completeAction,
  WorldModelDomain,
  AuthorityLevel,
  type Neo4jConnectionManager,
} from '@xiom/world-model';
import {
  runGuardian,
  PolicyEvolutionEngine,
  type SurfacePermissions,
} from '@xiom/guardian';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export const LOOP_SCHEDULER_INTERVAL_MS = 60_000;

const CRON_SURFACE: SurfacePermissions = {
  surfaceId: 'cron',
  allowedOperations: ['EXECUTE_ACTION', 'CREATE_NODE', 'CREATE_EDGE'],
  allowedNodeTypes: [
    'Action', 'Fact', 'Goal', 'Policy', 'Receipt', 'Pattern',
    'AuditEntry', 'Insight', 'Session',
  ],
};

let _conn: Neo4jConnectionManager | null = null;

function getConn(): Neo4jConnectionManager {
  if (!_conn) {
    _conn = createConnectionManager({
      uri:      process.env['NEO4J_URI'] ?? 'bolt://localhost:7687',
      user:     process.env['NEO4J_USER'] ?? 'neo4j',
      password: process.env['NEO4J_PASSWORD'] ?? 'password',
    });
  }
  return _conn;
}

function parseAuthority(level: string): AuthorityLevel {
  const values = Object.values(AuthorityLevel) as string[];
  if (values.includes(level)) return level as AuthorityLevel;
  return AuthorityLevel.SUPERVISED;
}

/**
 * Compute the next run time for a cron expression.
 * Uses cron-parser when available; falls back to a minimal set of known schedules.
 */
export function computeNextRunAt(schedule: string, from: Date = new Date()): Date {
  try {
    const interval = cronParser.parseExpression(schedule, { currentDate: from });
    return interval.next().toDate();
  } catch {
    return computeNextRunAtFallback(schedule, from);
  }
}

/** Minimal next-run for the five default XIOM schedules (+ hourly/daily generics). */
function computeNextRunAtFallback(schedule: string, from: Date): Date {
  const next = new Date(from.getTime());

  // every N days at HH: `0 H */N * *`
  const everyN = schedule.match(/^0\s+(\d+)\s+\*\/(\d+)\s+\*\s+\*$/);
  if (everyN) {
    const hour = Number(everyN[1]);
    const n = Number(everyN[2]);
    next.setUTCDate(next.getUTCDate() + n);
    next.setUTCHours(hour, 0, 0, 0);
    if (next <= from) next.setUTCDate(next.getUTCDate() + n);
    return next;
  }

  // weekdays at 8: `0 8 * * 1-5`
  if (schedule === '0 8 * * 1-5') {
    next.setUTCHours(8, 0, 0, 0);
    if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
    while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  // daily midnight: `0 0 * * *`
  if (schedule === '0 0 * * *') {
    next.setUTCHours(0, 0, 0, 0);
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  // weekly Sunday: `0 11 * * 0`
  if (schedule === '0 11 * * 0') {
    next.setUTCHours(11, 0, 0, 0);
    do {
      next.setUTCDate(next.getUTCDate() + 1);
    } while (next.getUTCDay() !== 0 || next <= from);
    return next;
  }

  // default: +1 hour
  return new Date(from.getTime() + 60 * 60_000);
}

export interface LoopRow {
  id: string;
  humanId: string;
  name: string;
  schedule: string;
  actionToolName: string;
  actionToolInput: Record<string, unknown> | null;
  authorityLevel: string;
  nextRunAt: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
}

export async function writeLoopRunCard(
  conn: Neo4jConnectionManager,
  opts: {
    humanId: string;
    loopId: string;
    loopName: string;
    success: boolean;
    summary: string;
    toolName: string;
    output?: Record<string, unknown>;
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await conn.query(
    `MATCH (h:Human {id: $humanId})
     CREATE (c:LoopRunCard {
       id:         $id,
       nodeType:   'LoopRunCard',
       loopId:     $loopId,
       loopName:   $loopName,
       success:    $success,
       summary:    $summary,
       toolName:   $toolName,
       output:     $output,
       domain:     'TRACK',
       confidence: 1.0,
       version:    1,
       isDeleted:  false,
       createdAt:  $now,
       updatedAt:  $now
     })
     CREATE (c)-[:OCCURRED_IN]->(h)`,
    {
      humanId:  opts.humanId,
      id,
      loopId:   opts.loopId,
      loopName: opts.loopName,
      success:  opts.success,
      summary:  opts.summary,
      toolName: opts.toolName,
      output:   JSON.stringify(opts.output ?? {}),
      now,
    }
  );
  return id;
}

export async function executeToolCall(
  conn: Neo4jConnectionManager,
  humanId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<{ ok: boolean; summary: string; output: Record<string, unknown> }> {
  switch (toolName) {
    case 'morning_digest': {
      const hours = Number(toolInput['lookbackHours'] ?? 24);
      const since = new Date(Date.now() - hours * 3_600_000).toISOString();
      const actions = await conn.queryMany<{ count: number }>(
        `MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action)
         WHERE a.createdAt >= $since
         RETURN count(a) AS count`,
        { humanId, since }
      );
      const goals = await conn.queryMany<{ count: number }>(
        `MATCH (:Human {id: $humanId})-[:HAS_GOAL]->(g:Goal {status: 'active', isDeleted: false})
         RETURN count(g) AS count`,
        { humanId }
      );
      const actionCount = Number(actions[0]?.count ?? 0);
      const goalCount = Number(goals[0]?.count ?? 0);
      const summary = `Morning digest: ${actionCount} actions in last ${hours}h, ${goalCount} active goals.`;
      logger.info({ humanId, actionCount, goalCount }, 'XIOM morning_digest');
      await writeFact(conn, humanId, {
        content:    summary,
        sourceType: 'session',
        isStale:    false,
        domain:     WorldModelDomain.TRACK,
        confidence: 1,
        source:     'loop:morning_digest',
      });
      return { ok: true, summary, output: { actionCount, goalCount, hours } };
    }

    case 'get_drifting_goals': {
      const days = Number(toolInput['daysThreshold'] ?? 7);
      const drifting = await getDriftingGoals(conn, humanId, days);
      const summary = `Goal drift: ${drifting.length} goal(s) idle >${days}d.`;
      logger.info({ humanId, count: drifting.length }, 'XIOM get_drifting_goals');
      await writeFact(conn, humanId, {
        content:    summary,
        sourceType: 'session',
        isStale:    false,
        domain:     WorldModelDomain.VISION,
        confidence: 1,
        source:     'loop:get_drifting_goals',
      });
      return {
        ok: true,
        summary,
        output: { count: drifting.length, goalIds: drifting.map((g) => g.id) },
      };
    }

    case 'policy_evolution': {
      const windowDays = Number(toolInput['windowDays'] ?? 30);
      const engine = new PolicyEvolutionEngine(conn);
      const analysis = await engine.analyzeOutcomes(humanId, windowDays);
      const patterns = await engine.detectPatterns(humanId, windowDays);
      const proposals = [];
      for (const pattern of patterns) {
        proposals.push(await engine.proposePolicyUpdate(humanId, pattern));
      }
      const summary = `Policy evolution: ${patterns.length} pattern(s), ${proposals.length} proposal(s).`;
      logger.info({ humanId, patterns: patterns.length, proposals: proposals.length }, 'XIOM policy_evolution');
      return {
        ok: true,
        summary,
        output: {
          analysis,
          patternTypes: patterns.map((p) => p.type),
          proposalIds:  proposals.map((p) => p.id),
        },
      };
    }

    case 'fact_freshness': {
      const stale = await getStaleFactsForHuman(conn, humanId);
      // Also mark expired facts via Cypher (daemon-side assist)
      await conn.query(
        `MATCH (:Human {id: $humanId})-[:USED_FACT]->(f:Fact)
         WHERE f.isStale = false AND f.expiresAt IS NOT NULL AND f.expiresAt < $now
         SET f.isStale = true, f.updatedAt = $now`,
        { humanId, now: new Date().toISOString() }
      );
      const summary = `Fact freshness: ${stale.length} stale/expired fact(s).`;
      logger.info({ humanId, stale: stale.length }, 'XIOM fact_freshness');
      return { ok: true, summary, output: { staleCount: stale.length, factIds: stale.map((f) => f.id) } };
    }

    case 'verify_receipt_chain': {
      const result = await verifyReceiptChain(conn, humanId);
      const summary = result.valid
        ? 'Receipt chain valid.'
        : `Receipt chain broken at ${result.brokenAt ?? 'unknown'}.`;
      logger.info({ humanId, valid: result.valid }, 'XIOM verify_receipt_chain');
      await writeFact(conn, humanId, {
        content:    summary,
        sourceType: 'session',
        isStale:    false,
        domain:     WorldModelDomain.TRACK,
        confidence: 1,
        source:     'loop:verify_receipt_chain',
      });
      return {
        ok: result.valid,
        summary,
        output: {
          valid: result.valid,
          ...(result.brokenAt !== undefined ? { brokenAt: result.brokenAt } : {}),
        },
      };
    }

    default: {
      const summary = `Unknown loop tool: ${toolName}`;
      logger.warn({ humanId, toolName }, 'XIOM loopScheduler: unknown tool');
      return { ok: false, summary, output: { error: 'unknown_tool' } };
    }
  }
}

export class LoopSchedulerDaemon {
  readonly intervalMs = LOOP_SCHEDULER_INTERVAL_MS;

  async tick(): Promise<void> {
    const now = new Date();
    let due: LoopRow[] = [];

    try {
      const rows = await db
        .select()
        .from(loops)
        .where(and(eq(loops.isActive, true), lte(loops.nextRunAt, now)))
        .limit(50);

      due = rows.map((r) => ({
        id:              r.id,
        humanId:         r.humanId,
        name:            r.name,
        schedule:        r.schedule,
        actionToolName:  r.actionToolName,
        actionToolInput: (r.actionToolInput as Record<string, unknown> | null) ?? {},
        authorityLevel:  r.authorityLevel,
        nextRunAt:       r.nextRunAt,
        runCount:        r.runCount,
        successCount:    r.successCount,
        failureCount:    r.failureCount,
      }));
    } catch (err) {
      logger.warn({ err }, 'XIOM loopScheduler: failed to query due loops');
      return;
    }

    if (due.length === 0) return;
    logger.info({ count: due.length }, 'XIOM loopScheduler: processing due loops');

    const conn = getConn();
    for (const loop of due) {
      await this.executeLoop(conn, loop);
    }
  }

  async executeLoop(conn: Neo4jConnectionManager, loop: LoopRow): Promise<void> {
    const toolInput = loop.actionToolInput ?? {};
    const authorityLevel = parseAuthority(loop.authorityLevel);
    let success = false;
    let summary = '';
    let output: Record<string, unknown> = {};

    try {
      const gate = await runGuardian(
        {
          operation:      'EXECUTE_ACTION',
          actorType:      'system',
          actorId:        'loop-scheduler',
          humanId:        loop.humanId,
          surfaceId:      'cron',
          authorityLevel,
          payload: {
            actionType: `loop.${loop.actionToolName}`,
            intent:     `Scheduled loop: ${loop.name}`,
            toolName:   loop.actionToolName,
            toolInput,
            domain:     WorldModelDomain.EXECUTION,
          },
        },
        conn,
        CRON_SURFACE
      );

      if (!gate.allowed) {
        summary = `Guardian denied: ${gate.reason ?? 'blocked'}`;
        logger.warn({ loopId: loop.id, reason: gate.reason }, 'XIOM loopScheduler: guardian denied');
      } else if (gate.requiresHumanApproval) {
        summary = 'Guardian requires human approval — loop deferred';
        logger.info({ loopId: loop.id }, 'XIOM loopScheduler: awaiting approval');
        // Still advance nextRunAt so we don't hot-loop; leave success=false
      } else {
        // Record Action then execute tool
        const action = await proposeAction(conn, {
          actionType: `loop.${loop.actionToolName}`,
          intent:     `Scheduled loop: ${loop.name}`,
          domain:     WorldModelDomain.EXECUTION,
          confidence: 1,
          toolName:   loop.actionToolName,
          toolInput,
          source:     `loop:${loop.id}`,
        });
        // Link action to human via OCCURRED_IN
        await conn.query(
          `MATCH (h:Human {id: $humanId}), (a:Action {id: $actionId})
           CREATE (a)-[:OCCURRED_IN]->(h)`,
          { humanId: loop.humanId, actionId: action.id }
        );

        const result = await executeToolCall(conn, loop.humanId, loop.actionToolName, toolInput);
        success = result.ok;
        summary = result.summary;
        output = result.output;

        await completeAction(conn, action.id, summary);
      }
    } catch (err) {
      summary = err instanceof Error ? err.message : 'Loop execution failed';
      logger.error({ err, loopId: loop.id }, 'XIOM loopScheduler: executeLoop error');
    }

    try {
      await writeLoopRunCard(conn, {
        humanId:  loop.humanId,
        loopId:   loop.id,
        loopName: loop.name,
        success,
        summary,
        toolName: loop.actionToolName,
        output,
      });
    } catch (err) {
      logger.warn({ err, loopId: loop.id }, 'XIOM loopScheduler: LoopRunCard write failed');
    }

    const nextRunAt = computeNextRunAt(loop.schedule, new Date());
    try {
      await db
        .update(loops)
        .set({
          lastRunAt:     new Date(),
          nextRunAt,
          runCount:      loop.runCount + 1,
          successCount:  loop.successCount + (success ? 1 : 0),
          failureCount:  loop.failureCount + (success ? 0 : 1),
        })
        .where(eq(loops.id, loop.id));
    } catch (err) {
      logger.warn({ err, loopId: loop.id }, 'XIOM loopScheduler: failed to update loop stats');
    }
  }
}

const daemonInstance = new LoopSchedulerDaemon();

/** Runner entrypoint — registered in daemons/runner.ts */
export async function loopSchedulerDaemon(): Promise<void> {
  await daemonInstance.tick();
}
