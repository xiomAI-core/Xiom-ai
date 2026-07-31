// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Typed invoke wrappers (browser + Tauri)
// ──────────────────────────────────────────────────────────────
import { isBrowserDevMode, mockTauriInvoke } from '../mocks/tauri-bridge.js';
import type {
  AppHealth,
  ContextCapsule,
  GoalData,
  GuardianInput,
  GuardianResult,
  Message,
  Neo4jStatus,
  ReceiptData,
  SessionSummary,
  WorldModelGraphData,
  WorldModelProjection,
} from '../types/index.js';

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isBrowserDevMode()) {
    return mockTauriInvoke<T>(cmd, args);
  }
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

export const connectNeo4j = (uri: string, user: string, password: string): Promise<boolean> =>
  invoke('connect_neo4j', { uri, user, password });

export const getNeo4jStatus = (): Promise<Neo4jStatus> => invoke('get_neo4j_status');

export const getWorldModelProjection = (): Promise<WorldModelProjection> =>
  invoke('get_world_model_projection');

export const getWorldModelGraph = (): Promise<WorldModelGraphData> =>
  invoke('get_world_model_graph');

export const getContextCapsule = (): Promise<ContextCapsule> =>
  invoke('get_context_capsule');

export const getActiveGoals = (): Promise<GoalData[]> => invoke('get_active_goals');

export const createSession = (provider: string): Promise<string> =>
  invoke('create_session', { provider });

export const getSessionHistory = (sessionId: string, limit = 100): Promise<Message[]> =>
  invoke('get_session_history', { session_id: sessionId, limit });

export const getSessionList = (): Promise<SessionSummary[]> => invoke('get_session_list');

export const getReceiptChain = (limit = 50): Promise<ReceiptData[]> =>
  invoke('get_receipt_chain', { limit });

export const startMcpServer = (port?: number): Promise<number> =>
  invoke('start_mcp_server_cmd', { port: port ?? null });

export const stopMcpServer = (): Promise<void> => invoke('stop_mcp_server');

export const runGuardianCheck = (input: GuardianInput): Promise<GuardianResult> =>
  invoke('run_guardian_check', { input });

export const getAppHealth = (): Promise<AppHealth> => invoke('get_app_health');
