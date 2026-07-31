// ──────────────────────────────────────────────────────────────
// Context capsule → markdown for MCP client system prompts
// ──────────────────────────────────────────────────────────────
import type { McpContextCapsule } from './types.js';

function asDateString(value: unknown): string {
  if (value == null) return 'none';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function policyVersion(p: { policyVersion?: number; version?: number }): number {
  return p.policyVersion ?? p.version ?? 1;
}

/**
 * Format a context capsule for injection into an AI session system prompt.
 * Field names adapt to world-model types with safe fallbacks.
 */
export function formatContextCapsule(capsule: McpContextCapsule): string {
  const continuity = capsule.sessionManifest?.continuityScore ?? 0;
  const authority = String(capsule.authorityLevel ?? 'supervised').toUpperCase();

  const goals = capsule.activeGoals ?? [];
  const policies = capsule.activePolicies ?? [];
  const facts = (capsule.recentFacts ?? []).slice(0, 10);
  const pending = capsule.pendingActions ?? [];
  const patterns = capsule.patterns ?? [];

  const goalLines =
    goals.length === 0
      ? '- (none)'
      : goals
          .map((g) => {
            const progress = Math.round((Number(g.progress) || 0) * 100);
            const deadline =
              'deadline' in g && g.deadline != null ? asDateString(g.deadline) : 'none';
            return `- [${g.priority}] ${g.name} — ${progress}% — Due: ${deadline}`;
          })
          .join('\n');

  const policyLines =
    policies.length === 0
      ? '- (none)'
      : policies
          .map(
            (p) =>
              `- v${policyVersion(p)}: ${p.condition ?? '(no condition)'} → ${p.effect ?? '(no effect)'}`
          )
          .join('\n');

  const factLines =
    facts.length === 0
      ? '- (none)'
      : facts
          .map(
            (f) =>
              `- [${f.sourceType}] ${f.content} (confidence: ${f.confidence})`
          )
          .join('\n');

  const pendingLines =
    pending.length === 0
      ? 'None'
      : pending.map((a) => `- [${a.actionType}] ${a.intent}`).join('\n');

  const patternLines =
    patterns.length === 0
      ? '- (none)'
      : patterns.map((p) => `- ${p.description}`).join('\n');

  return `
## XIOM World Model Context
Generated: ${capsule.generatedAt ?? new Date().toISOString()}
Continuity Score: ${continuity}

### Active Goals (${goals.length})
${goalLines}

### Active Policies (${policies.length})
${policyLines}

### Recent Context (last 10 facts)
${factLines}

### Pending Approvals
${pendingLines}

### Known Patterns
${patternLines}

### Authority Level: ${authority}
`.trim();
}
