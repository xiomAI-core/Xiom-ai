import type { RegisteredTool } from '../types.js';
import type { ToolContext } from './helpers.js';
import { createGetContextCapsuleTool } from './get-context-capsule.js';
import { createQueryWorldModelTool } from './query-world-model.js';
import { createWriteFactTool } from './write-fact.js';
import { createCheckPolicyTool } from './check-policy.js';
import { createProposeActionTool } from './propose-action.js';
import { createGetSessionHistoryTool } from './get-session-history.js';
import { createSetGoalTool } from './set-goal.js';
import { createGetPendingApprovalsTool } from './get-pending-approvals.js';
import { createApproveActionTool } from './approve-action.js';
import { createWriteReceiptTool } from './write-receipt.js';

/** Register all 10 XIOM MCP tools for the given server context. */
export function createAllTools(ctx: ToolContext): RegisteredTool[] {
  return [
    createGetContextCapsuleTool(ctx),
    createQueryWorldModelTool(ctx),
    createWriteFactTool(ctx),
    createCheckPolicyTool(ctx),
    createProposeActionTool(ctx),
    createGetSessionHistoryTool(ctx),
    createSetGoalTool(ctx),
    createGetPendingApprovalsTool(ctx),
    createApproveActionTool(ctx),
    createWriteReceiptTool(ctx),
  ];
}

export type { ToolContext };
