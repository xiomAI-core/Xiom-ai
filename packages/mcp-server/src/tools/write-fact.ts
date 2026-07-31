import { runGuardian, type GuardianInput } from '@xiom/guardian';
import { writeFact, createReceipt, WorldModelDomain } from '@xiom/world-model';
import type { RegisteredTool } from '../types.js';
import {
  asNumber,
  asString,
  guardianSummary,
  jsonResult,
  type ToolContext,
} from './helpers.js';

const SOURCE_TYPES = new Set([
  'email',
  'calendar',
  'session',
  'manual',
  'sensor',
  'onchain',
]);

export function createWriteFactTool(ctx: ToolContext): RegisteredTool {
  return {
    name: 'axiom_write_fact',
    description:
      'Write a new fact to the XIOM world model after full Guardian pipeline approval. Returns without writing if human approval is required.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        sourceType: {
          type: 'string',
          enum: ['email', 'calendar', 'session', 'manual', 'sensor', 'onchain'],
        },
        sourceRef: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['content', 'sourceType'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const content = asString(args['content']);
      const sourceTypeRaw = asString(args['sourceType'], 'manual');
      const sourceType = (SOURCE_TYPES.has(sourceTypeRaw) ? sourceTypeRaw : 'manual') as
        | 'email'
        | 'calendar'
        | 'session'
        | 'manual'
        | 'sensor'
        | 'onchain';
      const sourceRef =
        args['sourceRef'] !== undefined ? asString(args['sourceRef']) : undefined;
      const confidence = asNumber(args['confidence'], 1);

      const input: GuardianInput = {
        operation: 'CREATE_NODE',
        actorType: 'agent',
        actorId: ctx.actorId,
        humanId: ctx.humanId,
        surfaceId: ctx.surfaceId,
        authorityLevel: ctx.authorityLevel,
        payload: {
          nodeType: 'Fact',
          domain: WorldModelDomain.TRACK,
          content,
          sourceType,
          ...(sourceRef !== undefined ? { sourceRef } : {}),
          confidence,
        },
      };

      const guardianResult = await runGuardian(input, ctx.conn, ctx.surfacePermissions);

      if (!guardianResult.allowed) {
        return jsonResult(
          {
            factId: null,
            guardianResult: guardianSummary(guardianResult),
            receiptHash: null,
            requiresApproval: false,
          },
          guardianResult.reason ?? 'Guardian denied fact write',
          true
        );
      }

      if (guardianResult.requiresHumanApproval) {
        return jsonResult({
          factId: null,
          guardianResult: guardianSummary(guardianResult),
          receiptHash: null,
          requiresApproval: true,
        });
      }

      const fact = await writeFact(ctx.conn, ctx.humanId, {
        content,
        sourceType,
        isStale: false,
        domain: WorldModelDomain.TRACK,
        confidence,
        ...(sourceRef !== undefined ? { sourceRef } : {}),
      });

      const receipt = await createReceipt(ctx.conn, ctx.humanId, {
        intent: `Write fact: ${content.slice(0, 120)}`,
        context: `sourceType=${sourceType}`,
        policy: 'guardian:CREATE_NODE:Fact',
        action: 'axiom_write_fact',
        result: `created:${fact.id}`,
        isApproved: true,
        rollbackAvailable: false,
        domain: WorldModelDomain.TRACK,
        confidence: 1,
      });

      return jsonResult({
        factId: fact.id,
        guardianResult: guardianSummary(guardianResult),
        receiptHash: receipt.hash,
        requiresApproval: false,
      });
    },
  };
}
