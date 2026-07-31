// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Tauri Commands
// All IPC commands exposed to the React frontend via invoke().
// ──────────────────────────────────────────────────────────────
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::mcp::start_mcp_server;
use crate::neo4j::{GoalData, Neo4jManager, Neo4jStatus, ReceiptData};
use crate::sqlite::{Message, SessionSummary};
use crate::AppState;

// ─── Shared DTOs ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct WorldModelProjection {
    pub node_count: i64,
    pub edge_count: i64,
    pub active_goal_count: usize,
    pub active_policy_count: usize,
    pub generated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppHealth {
    pub neo4j: bool,
    pub sqlite: bool,
    pub mcp: bool,
    pub node_count: i64,
    pub session_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GuardianInputDto {
    pub operation: String,
    pub actor_type: String,
    pub actor_id: String,
    pub payload: serde_json::Value,
    pub authority_level: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GuardianResultDto {
    pub allowed: bool,
    pub requires_human_approval: bool,
    pub denied_layers: Vec<u8>,
    pub reason: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContextCapsule {
    pub human_id: String,
    pub active_goals: Vec<GoalData>,
    pub recent_facts: Vec<serde_json::Value>,
    pub active_policies: Vec<serde_json::Value>,
    pub pending_actions: Vec<serde_json::Value>,
    pub patterns: Vec<serde_json::Value>,
    pub generated_at: String,
}

// ─── Commands ─────────────────────────────────────────────────

/// Establish (or re-establish) connection to a Neo4j instance.
#[tauri::command]
pub async fn connect_neo4j(
    uri: String,
    user: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    match Neo4jManager::connect(&uri, &user, &password).await {
        Ok(mgr) => {
            let mut lock = state.neo4j.lock().await;
            *lock = Some(mgr);
            // Persist config
            {
                let mut cfg = state.config.write().await;
                cfg.neo4j_uri  = uri;
                cfg.neo4j_user = user;
            }
            tracing::info!("Neo4j connection stored in AppState");
            Ok(true)
        }
        Err(e) => Err(format!("Connection failed: {e}")),
    }
}

/// Return the Neo4j connection status and server info.
#[tauri::command]
pub async fn get_neo4j_status(state: State<'_, AppState>) -> Result<Neo4jStatus, String> {
    let lock = state.neo4j.lock().await;
    match lock.as_ref() {
        None => Ok(Neo4jStatus { connected: false, node_count: 0, version: "not connected".into() }),
        Some(mgr) => {
            let connected  = mgr.health_check().await.unwrap_or(false);
            let node_count = mgr.count_nodes().await.unwrap_or(0);
            let version    = mgr.get_version().await;
            Ok(Neo4jStatus { connected, node_count, version })
        }
    }
}

/// Return graph data for the World Model Viewer.
#[tauri::command]
pub async fn get_world_model_projection(
    state: State<'_, AppState>,
) -> Result<WorldModelProjection, String> {
    let human_id = state
        .current_human_id
        .read()
        .await
        .clone()
        .unwrap_or_default();

    let lock = state.neo4j.lock().await;
    match lock.as_ref() {
        None => Ok(WorldModelProjection {
            node_count: 0,
            edge_count: 0,
            active_goal_count: 0,
            active_policy_count: 0,
            generated_at: chrono::Utc::now().to_rfc3339(),
        }),
        Some(mgr) => {
            let node_count  = mgr.count_nodes().await.unwrap_or(0);
            let edge_count  = mgr.count_edges().await.unwrap_or(0);
            let goals       = mgr.get_active_goals(&human_id).await.unwrap_or_default();
            let policies    = mgr.get_active_policies(&human_id).await.unwrap_or_default();
            Ok(WorldModelProjection {
                node_count,
                edge_count,
                active_goal_count:  goals.len(),
                active_policy_count:policies.len(),
                generated_at: chrono::Utc::now().to_rfc3339(),
            })
        }
    }
}

/// Return the full context capsule for AI session injection.
#[tauri::command]
pub async fn get_context_capsule(state: State<'_, AppState>) -> Result<ContextCapsule, String> {
    let human_id = state
        .current_human_id
        .read()
        .await
        .clone()
        .unwrap_or_default();

    let lock = state.neo4j.lock().await;
    match lock.as_ref() {
        None => Ok(ContextCapsule {
            human_id,
            active_goals: vec![],
            recent_facts: vec![],
            active_policies: vec![],
            pending_actions: vec![],
            patterns: vec![],
            generated_at: chrono::Utc::now().to_rfc3339(),
        }),
        Some(mgr) => {
            let goals    = mgr.get_active_goals(&human_id).await.unwrap_or_default();
            let policies = mgr.get_active_policies(&human_id).await.unwrap_or_default();
            Ok(ContextCapsule {
                human_id,
                active_goals: goals,
                recent_facts: vec![],
                active_policies: policies,
                pending_actions: vec![],
                patterns: vec![],
                generated_at: chrono::Utc::now().to_rfc3339(),
            })
        }
    }
}

/// Start a new AI provider session. Returns the session ID.
#[tauri::command]
pub async fn create_session(
    provider: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let sqlite = state.sqlite.lock().map_err(|e| e.to_string())?;
    sqlite.create_session(&provider).map_err(|e| e.to_string())
}

/// Return message history for a given session.
#[tauri::command]
pub async fn get_session_history(
    session_id: String,
    limit: i64,
    state: State<'_, AppState>,
) -> Result<Vec<Message>, String> {
    let sqlite = state.sqlite.lock().map_err(|e| e.to_string())?;
    sqlite
        .get_session_history(&session_id, limit)
        .map_err(|e| e.to_string())
}

/// Return all sessions (recent first).
#[tauri::command]
pub async fn get_session_list(state: State<'_, AppState>) -> Result<Vec<SessionSummary>, String> {
    let sqlite = state.sqlite.lock().map_err(|e| e.to_string())?;
    sqlite.list_recent_sessions(100).map_err(|e| e.to_string())
}

/// Return active goals for the current human.
#[tauri::command]
pub async fn get_active_goals(state: State<'_, AppState>) -> Result<Vec<GoalData>, String> {
    let human_id = state
        .current_human_id
        .read()
        .await
        .clone()
        .unwrap_or_default();
    let lock = state.neo4j.lock().await;
    match lock.as_ref() {
        None => Ok(vec![]),
        Some(mgr) => mgr.get_active_goals(&human_id).await.map_err(|e| e.to_string()),
    }
}

/// Return N most recent receipts from Neo4j.
#[tauri::command]
pub async fn get_receipt_chain(
    limit: i64,
    state: State<'_, AppState>,
) -> Result<Vec<ReceiptData>, String> {
    let lock = state.neo4j.lock().await;
    match lock.as_ref() {
        None => Ok(vec![]),
        Some(mgr) => mgr.get_receipts(limit).await.map_err(|e| e.to_string()),
    }
}

/// Start the local MCP server.
#[tauri::command]
pub async fn start_mcp_server_cmd(
    port: Option<u16>,
    state: State<'_, AppState>,
) -> Result<u16, String> {
    let requested_port = {
        let cfg = state.config.read().await;
        port.unwrap_or(cfg.mcp_port)
    };

    // Stop existing server if running
    {
        let mut handle = state.mcp_handle.lock().await;
        if let Some(h) = handle.take() {
            let _ = h.shutdown_tx.send(());
        }
    }

    let handle = start_mcp_server(
        requested_port,
        state.neo4j.clone(),
        state.sqlite_arc.clone(),
        state.current_human_id.clone(),
    )
    .await
    .map_err(|e| e.to_string())?;

    let actual_port = handle.port;
    let mut mcp_lock = state.mcp_handle.lock().await;
    *mcp_lock = Some(handle);
    Ok(actual_port)
}

/// Stop the local MCP server.
#[tauri::command]
pub async fn stop_mcp_server(state: State<'_, AppState>) -> Result<(), String> {
    let mut handle = state.mcp_handle.lock().await;
    if let Some(h) = handle.take() {
        let _ = h.shutdown_tx.send(());
        Ok(())
    } else {
        Err("MCP server is not running".into())
    }
}

/// Run a simplified Guardian check against the current state.
#[tauri::command]
pub async fn run_guardian_check(
    input: GuardianInputDto,
    _state: State<'_, AppState>,
) -> Result<GuardianResultDto, String> {
    // Simplified check — a full Rust guardian would mirror the TypeScript 9-layer pipeline
    let is_payment = input
        .payload
        .get("actionType")
        .and_then(|v| v.as_str())
        .map(|s| s.contains("payment") || s.contains("transfer"))
        .unwrap_or(false);

    if is_payment && input.authority_level != "autonomous" {
        return Ok(GuardianResultDto {
            allowed: false,
            requires_human_approval: false,
            denied_layers: vec![4],
            reason: Some("Payment operations require payment surface authorization".into()),
            warnings: vec![],
        });
    }

    Ok(GuardianResultDto {
        allowed: true,
        requires_human_approval: matches!(
            input.authority_level.as_str(),
            "confirm" | "supervised"
        ),
        denied_layers: vec![],
        reason: None,
        warnings: vec![],
    })
}

/// Return overall application health metrics.
#[tauri::command]
pub async fn get_app_health(state: State<'_, AppState>) -> Result<AppHealth, String> {
    let (neo4j_ok, node_count) = {
        let lock = state.neo4j.lock().await;
        match lock.as_ref() {
            None => (false, 0i64),
            Some(mgr) => {
                let ok    = mgr.health_check().await.unwrap_or(false);
                let count = if ok { mgr.count_nodes().await.unwrap_or(0) } else { 0 };
                (ok, count)
            }
        }
    };

    let session_count = {
        let sqlite = state.sqlite.lock().map_err(|e| e.to_string())?;
        sqlite.count_sessions_today().unwrap_or(0)
    };

    let mcp_running = state.mcp_handle.lock().await.is_some();

    Ok(AppHealth {
        neo4j: neo4j_ok,
        sqlite: true,
        mcp: mcp_running,
        node_count,
        session_count,
    })
}
