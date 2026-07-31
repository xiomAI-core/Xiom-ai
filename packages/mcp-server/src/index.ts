/**
 * @xiom/mcp-server
 * MCP server for the XIOM AI provider lane — 10 axiom_* tools,
 * Guardian-gated writes, context capsule formatting.
 */
export { AxiomMcpServer } from './server.js';
export { formatContextCapsule } from './capsule-formatter.js';
export { softCheckPolicy, DEFAULT_MCP_SURFACE, parseAuthorityLevel } from './soft-check.js';
export { InMemorySessionStore, createDefaultSessionStore } from './session-store.js';
export { createAllTools } from './tools/index.js';

export type {
  McpContextCapsule,
  SessionManifestSummary,
  SessionMessage,
  SessionStore,
  SoftPolicyCheckResult,
  ToolHandlerResult,
  RegisteredTool,
  AxiomMcpServerOptions,
  ToolHandler,
} from './types.js';

// Legacy shared tool definitions (kept for API route compatibility)
import type { McpTool, McpRequest, McpResponse } from '@xiom/types';

export type { McpTool, McpRequest, McpResponse };

/** Canonical list of MCP tool IDs exposed by XIOM. */
export const AXIOM_MCP_TOOL_NAMES = [
  'axiom_get_context_capsule',
  'axiom_query_world_model',
  'axiom_write_fact',
  'axiom_check_policy',
  'axiom_propose_action',
  'axiom_get_session_history',
  'axiom_set_goal',
  'axiom_get_pending_approvals',
  'axiom_approve_action',
  'axiom_write_receipt',
] as const;

export type AxiomMcpToolName = (typeof AXIOM_MCP_TOOL_NAMES)[number];

export function mcpSuccess(id: string | number, result: unknown): McpResponse {
  return { jsonrpc: '2.0', id, result };
}

export function mcpError(id: string | number, code: number, message: string): McpResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export const MCP_PROTOCOL_VERSION = '2024-11-05';
export const MCP_SERVER_INFO = { name: 'xiom-mcp', version: '0.1.0' };

/** @deprecated Use AXIOM_MCP_TOOL_NAMES / AxiomMcpServer instead */
export const XIOM_MCP_TOOLS: McpTool[] = AXIOM_MCP_TOOL_NAMES.map((name) => ({
  name,
  description: `XIOM MCP tool: ${name}`,
  inputSchema: { type: 'object' },
}));
