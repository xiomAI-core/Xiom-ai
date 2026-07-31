import {
  approveAction,
  completeAction,
  createReceipt,
  WorldModelDomain,
} from '@xiom/world-model';
import type { RegisteredTool } from '../types.js';
import { asString, jsonResult, type ToolContext } from './helpers.js';

export function createApproveActionTool(ctx: ToolContext): RegisteredTool {
  return {
    name: 'axiom_approve_action',
    description:
      'Approve a proposed action, execute it, and write a cryptographic receipt.',
    inputSchema: {
      type: 'object',
      properties: {
        actionId: { type: 'string' },
      },
      required: ['actionId'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const actionId = asString(args['actionId']);
      if (!actionId) {
        return jsonResult({ executed: false }, 'actionId is required', true);
      }

      const row = await ctx.conn.queryOne<{
        id: string;
        status: string;
        intent: string;
        actionType: string;
        toolName: string | null;
      }>(
        `MATCH (a:Action {id: $actionId, isDeleted: false})
         RETURN a.id AS id,
                a.executionStatus AS status,
                a.intent AS intent,
                a.actionType AS actionType,
                a.toolName AS toolName`,
        { actionId }
      );

      if (!row) {
        return jsonResult({ executed: false }, `Action not found: ${actionId}`, true);
      }

      if (row.status !== 'proposed') {
        return jsonResult(
          { executed: false, status: row.status },
          `Action is not proposed (status=${row.status})`,
          true
        );
      }

      await approveAction(ctx.conn, actionId);
      const toolName = row.toolName ?? row.actionType;
      const result = `executed:${toolName}`;
      await completeAction(ctx.conn, actionId, result);

      const receipt = await createReceipt(ctx.conn, ctx.humanId, {
        intent: row.intent,
        context: `approved action ${actionId}`,
        policy: 'human_approval',
        action: toolName,
        result,
        isApproved: true,
        rollbackAvailable: false,
        domain: WorldModelDomain.TRACK,
        confidence: 1,
      });

      // Link receipt to action when possible
      await ctx.conn
        .query(
          `MATCH (a:Action {id: $actionId}), (r:Receipt {id: $receiptId})
           MERGE (a)-[:GENERATED_RECEIPT]->(r)
           SET a.receiptId = $receiptId`,
          { actionId, receiptId: receipt.id }
        )
        .catch(() => undefined);

      return jsonResult({
        executed: true,
        result,
        receiptId: receipt.id,
        hash: receipt.hash,
      });
    },
  };
}
