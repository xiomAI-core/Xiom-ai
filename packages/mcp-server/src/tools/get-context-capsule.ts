import {
  getContextCapsule,
} from '@xiom/world-model';
import { formatContextCapsule } from '../capsule-formatter.js';
import type { McpContextCapsule } from '../types.js';
import type { RegisteredTool } from '../types.js';
import { jsonResult, type ToolContext } from './helpers.js';

export function createGetContextCapsuleTool(ctx: ToolContext): RegisteredTool {
  return {
    name: 'axiom_get_context_capsule',
    description:
      'Return the full XIOM context capsule (goals, facts, policies, pending actions, patterns, session continuity) for the current session.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => {
      const base = await getContextCapsule(ctx.conn, ctx.humanId);
      const sessionManifest = await ctx.sessionStore.getSessionManifestSummary(ctx.humanId);

      const capsule: McpContextCapsule = {
        humanId: base.humanId,
        activeGoals: base.activeGoals.filter((g) => g.status === 'active' || g.status === 'paused'),
        recentFacts: base.recentFacts,
        activePolicies: base.activePolicies,
        pendingActions: base.pendingActions.filter(
          (a) => a.executionStatus === 'proposed' || a.executionStatus === 'approved'
        ),
        patterns: base.patterns.filter((p) => p.isConfirmedByUser !== false),
        sessionManifest,
        authorityLevel: ctx.authorityLevel,
        generatedAt: base.generatedAt,
      };

      const markdown = formatContextCapsule(capsule);
      return jsonResult({ ...capsule, formatted: markdown }, markdown);
    },
  };
}
