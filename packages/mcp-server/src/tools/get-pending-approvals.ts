import type { RegisteredTool } from '../types.js';
import { jsonResult, type ToolContext } from './helpers.js';

export function createGetPendingApprovalsTool(ctx: ToolContext): RegisteredTool {
  return {
    name: 'axiom_get_pending_approvals',
    description:
      'List proposed actions awaiting human approval from the last 24 hours.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const rows = await ctx.conn.queryMany<{ action: Record<string, unknown> }>(
        `MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action {isDeleted: false})
         WHERE a.executionStatus = 'proposed'
           AND a.createdAt > $since
         RETURN a { .* } AS action
         ORDER BY a.createdAt DESC`,
        { humanId: ctx.humanId, since }
      );

      // Fallback: some graphs may store humanId on the action itself
      const fallback =
        rows.length > 0
          ? rows
          : await ctx.conn.queryMany<{ action: Record<string, unknown> }>(
              `MATCH (a:Action {executionStatus: 'proposed', isDeleted: false})
               WHERE a.createdAt > $since
                 AND (a.humanId = $humanId OR a.humanId IS NULL)
               RETURN a { .* } AS action
               ORDER BY a.createdAt DESC
               LIMIT 50`,
              { humanId: ctx.humanId, since }
            );

      const actions = fallback.map((r) => r.action);
      return jsonResult({ actions, count: actions.length, since });
    },
  };
}
