// ──────────────────────────────────────────────────────────────
// Shared helpers for MCP tool handlers
// ──────────────────────────────────────────────────────────────
import type { Neo4jConnectionManager } from '@xiom/world-model';
import type { GuardianResult, SurfacePermissions } from '@xiom/guardian';
import type { AuthorityLevel } from '@xiom/world-model';
import type { SessionStore, ToolHandlerResult } from '../types.js';

export interface ToolContext {
  conn: Neo4jConnectionManager;
  sessionStore: SessionStore;
  humanId: string;
  authorityLevel: AuthorityLevel;
  surfaceId: string;
  currentSessionId: string;
  actorId: string;
  surfacePermissions: SurfacePermissions;
}

export function jsonResult(structured: unknown, text?: string, isError = false): ToolHandlerResult {
  return {
    structured,
    text: text ?? JSON.stringify(structured, null, 2),
    ...(isError ? { isError: true } : {}),
  };
}

export function guardianSummary(result: GuardianResult): Record<string, unknown> {
  return {
    allowed: result.allowed,
    requiresHumanApproval: result.requiresHumanApproval,
    deniedLayers: result.deniedLayers,
    ...(result.reason !== undefined ? { reason: result.reason } : {}),
    warnings: result.warnings,
  };
}

export function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

export function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}
