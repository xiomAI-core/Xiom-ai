import type { RegisteredTool } from '../types.js';
import { asNumber, jsonResult, type ToolContext } from './helpers.js';

export function createGetSessionHistoryTool(ctx: ToolContext): RegisteredTool {
  return {
    name: 'axiom_get_session_history',
    description:
      'Retrieve message history for the current MCP session from the session store (SQLite on desktop).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Max messages', default: 50 },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (args) => {
      const limit = asNumber(args['limit'], 50);
      const messages = await ctx.sessionStore.getSessionHistory(ctx.currentSessionId, limit);
      return jsonResult({
        sessionId: ctx.currentSessionId,
        messages,
        count: messages.length,
      });
    },
  };
}
