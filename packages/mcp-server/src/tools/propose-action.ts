import { runGuardian, type GuardianInput } from '@xiom/guardian';
import {
  proposeAction,
  approveAction,
  completeAction,
  createReceipt,
  WorldModelDomain,
} from '@xiom/world-model';
import type { RegisteredTool } from '../types.js';
import {
  asRecord,
  asString,
  guardianSummary,
  jsonResult,
  type ToolContext,
} from './helpers.js';

async function linkActionToHuman(
  ctx: ToolContext,
  actionId: string
): Promise<void> {
  await ctx.conn.query(
    `MATCH (h:Human {id: $humanId}), (a:Action {id: $actionId})
     MERGE (a)-[:OCCURRED_IN]->(h)`,
    { humanId: ctx.humanId, actionId }
  );
}

export function createProposeActionTool(ctx: ToolContext): RegisteredTool {
  return {
    name: 'axiom_propose_action',
    description:
      'Propose an action through the full Guardian pipeline. Auto-executes when allowed without approval; otherwise stores as proposed.',
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

      const guardianResult = await runGuardian(input, ctx.conn, ctx.surfacePermissions);

      if (!guardianResult.allowed) {
        return jsonResult(
          {
            status: 'denied',
            actionId: null,
            guardianResult: guardianSummary(guardianResult),
            receiptId: null,
          },
          guardianResult.reason ?? 'Action denied by Guardian',
          true
        );
      }

      const action = await proposeAction(ctx.conn, {
        actionType,
        intent,
        domain: WorldModelDomain.EXECUTION,
        confidence: 1,
        toolName,
        toolInput,
      });
      await linkActionToHuman(ctx, action.id);

      if (guardianResult.requiresHumanApproval) {
        return jsonResult({
          status: 'proposed',
          actionId: action.id,
          guardianResult: guardianSummary(guardianResult),
          receiptId: null,
          message: 'Awaiting human approval via axiom_approve_action',
        });
      }

      // Allowed without approval — mark approved, "execute", write receipt
      await approveAction(ctx.conn, action.id);
      const execResult = `executed:${toolName}`;
      await completeAction(ctx.conn, action.id, execResult);

      const receipt = await createReceipt(ctx.conn, ctx.humanId, {
        intent,
        context: JSON.stringify({ actionType, toolName, toolInput }),
        policy: 'guardian:EXECUTE_ACTION',
        action: toolName,
        result: execResult,
        isApproved: true,
        rollbackAvailable: false,
        domain: WorldModelDomain.TRACK,
        confidence: 1,
      });

      return jsonResult({
        status: 'approved',
        actionId: action.id,
        guardianResult: guardianSummary(guardianResult),
        receiptId: receipt.id,
        result: execResult,
      });
    },
  };
}
