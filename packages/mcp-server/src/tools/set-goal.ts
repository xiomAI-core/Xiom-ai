import { runGuardian, type GuardianInput } from '@xiom/guardian';
import { createGoal, WorldModelDomain } from '@xiom/world-model';
import type { RegisteredTool } from '../types.js';
import {
  asNumber,
  asString,
  asStringArray,
  guardianSummary,
  jsonResult,
  type ToolContext,
} from './helpers.js';

export function createSetGoalTool(ctx: ToolContext): RegisteredTool {
  return {
    name: 'axiom_set_goal',
    description:
      'Create a new Goal in the world model (Guardian CREATE_NODE) and link it to the Human via HAS_GOAL.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        deadline: { type: 'string', description: 'ISO-8601 deadline' },
        successCriteria: {
          type: 'array',
          items: { type: 'string' },
        },
        priority: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
        description: { type: 'string' },
      },
      required: ['name', 'successCriteria'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const name = asString(args['name']);
      const successCriteria = asStringArray(args['successCriteria']);
      const priority = asNumber(args['priority'], 5);
      const description =
        args['description'] !== undefined
          ? asString(args['description'])
          : `Goal: ${name}`;
      const deadlineRaw =
        args['deadline'] !== undefined ? asString(args['deadline']) : undefined;
      const deadline =
        deadlineRaw && deadlineRaw.length > 0 ? new Date(deadlineRaw) : undefined;

      const input: GuardianInput = {
        operation: 'CREATE_NODE',
        actorType: 'agent',
        actorId: ctx.actorId,
        humanId: ctx.humanId,
        surfaceId: ctx.surfaceId,
        authorityLevel: ctx.authorityLevel,
        payload: {
          nodeType: 'Goal',
          domain: WorldModelDomain.VISION,
          name,
          description,
          successCriteria,
          priority,
          ...(deadline !== undefined ? { deadline: deadline.toISOString() } : {}),
        },
      };

      const guardianResult = await runGuardian(input, ctx.conn, ctx.surfacePermissions);

      if (!guardianResult.allowed) {
        return jsonResult(
          {
            goalId: null,
            guardianResult: guardianSummary(guardianResult),
          },
          guardianResult.reason ?? 'Guardian denied goal creation',
          true
        );
      }

      if (guardianResult.requiresHumanApproval) {
        return jsonResult({
          goalId: null,
          guardianResult: guardianSummary(guardianResult),
          requiresApproval: true,
        });
      }

      const goal = await createGoal(ctx.conn, ctx.humanId, {
        name,
        description,
        progress: 0,
        status: 'active',
        priority,
        successCriteria,
        blockers: [],
        domain: WorldModelDomain.VISION,
        confidence: 1,
        ...(deadline !== undefined ? { deadline } : {}),
      });

      return jsonResult({
        goalId: goal.id,
        guardianResult: guardianSummary(guardianResult),
      });
    },
  };
}
