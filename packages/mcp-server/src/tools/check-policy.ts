import type { GuardianInput } from '@xiom/guardian';
import { WorldModelDomain } from '@xiom/world-model';
import { softCheckPolicy } from '../soft-check.js';
import type { RegisteredTool } from '../types.js';
import { asRecord, asString, jsonResult, type ToolContext } from './helpers.js';

export function createCheckPolicyTool(ctx: ToolContext): RegisteredTool {
  return {
    name: 'axiom_check_policy',
    description:
      'Soft-check whether a proposed action is allowed under XIOM policies (Guardian layers 4–6 only, no writes).',
    inputSchema: {
      type: 'object',
      properties: {
        actionType: { type: 'string' },
        intent: { type: 'string' },
        toolName: { type: 'string' },
        toolInput: { type: 'object' },
      },
      required: ['actionType', 'intent', 'toolName', 'toolInput'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const actionType = asString(args['actionType']);
      const intent = asString(args['intent']);
      const toolName = asString(args['toolName']);
      const toolInput = asRecord(args['toolInput']);

      const input: GuardianInput = {
        operation: 'EXECUTE_ACTION',
        actorType: 'agent',
        actorId: ctx.actorId,
        humanId: ctx.humanId,
        surfaceId: ctx.surfaceId,
        authorityLevel: ctx.authorityLevel,
        payload: {
          actionType,
          intent,
          toolName,
          toolInput,
          domain: WorldModelDomain.EXECUTION,
        },
      };

      const result = await softCheckPolicy(input, ctx.conn, ctx.surfacePermissions);

      return jsonResult({
        allowed: result.allowed,
        requiresApproval: result.requiresApproval,
        ...(result.reason !== undefined ? { reason: result.reason } : {}),
        matchedPolicies: result.matchedPolicies,
        warnings: result.warnings,
      });
    },
  };
}
