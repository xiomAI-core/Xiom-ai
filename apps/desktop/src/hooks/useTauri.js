// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Typed invoke wrappers (browser + Tauri)
// ──────────────────────────────────────────────────────────────
import { isBrowserDevMode, mockTauriInvoke } from '../mocks/tauri-bridge.js';
async function invoke(cmd, args) {
    if (isBrowserDevMode()) {
        return mockTauriInvoke(cmd, args);
    }
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke(cmd, args);
}
export const connectNeo4j = (uri, user, password) => invoke('connect_neo4j', { uri, user, password });
export const getNeo4jStatus = () => invoke('get_neo4j_status');
export const getWorldModelProjection = () => invoke('get_world_model_projection');
export const getWorldModelGraph = () => invoke('get_world_model_graph');
export const getContextCapsule = () => invoke('get_context_capsule');
export const getActiveGoals = () => invoke('get_active_goals');
export const createSession = (provider) => invoke('create_session', { provider });
export const getSessionHistory = (sessionId, limit = 100) => invoke('get_session_history', { session_id: sessionId, limit });
export const getSessionList = () => invoke('get_session_list');
export const getReceiptChain = (limit = 50) => invoke('get_receipt_chain', { limit });
export const startMcpServer = (port) => invoke('start_mcp_server_cmd', { port: port ?? null });
export const stopMcpServer = () => invoke('stop_mcp_server');
export const runGuardianCheck = (input) => invoke('run_guardian_check', { input });
export const getAppHealth = () => invoke('get_app_health');
//# sourceMappingURL=useTauri.js.map