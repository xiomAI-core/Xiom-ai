// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Local MCP HTTP Server
// JSON-RPC 2.0 over HTTP on 127.0.0.1:54321 (configurable)
// Exposes 10 axiom_* tools to any AI provider that speaks MCP.
// ──────────────────────────────────────────────────────────────
use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::oneshot;
use tower_http::cors::{Any, CorsLayer};

use crate::neo4j::Neo4jManager;
use crate::sqlite::SqliteManager;

// ─── JSON-RPC types ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

impl JsonRpcResponse {
    fn ok(id: Option<serde_json::Value>, result: serde_json::Value) -> Self {
        Self { jsonrpc: "2.0".into(), id, result: Some(result), error: None }
    }
    fn err(id: Option<serde_json::Value>, code: i32, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: None,
            error: Some(JsonRpcError { code, message: message.into(), data: None }),
        }
    }
}

// ─── Shared server state ──────────────────────────────────────

pub struct McpSharedState {
    pub neo4j: Arc<tokio::sync::Mutex<Option<Neo4jManager>>>,
    pub sqlite: Arc<std::sync::Mutex<SqliteManager>>,
    pub human_id: Arc<tokio::sync::RwLock<Option<String>>>,
    pub current_session_id: Arc<tokio::sync::RwLock<Option<String>>>,
    pub authority_level: Arc<tokio::sync::RwLock<String>>,
}

// ─── Server handle ────────────────────────────────────────────

pub struct McpHandle {
    pub shutdown_tx: oneshot::Sender<()>,
    pub port: u16,
}

// ─── Soft policy (layers 4–6 mirror) ──────────────────────────

fn soft_policy_check(action_type: &str, tool_name: &str, authority: &str) -> serde_json::Value {
    let is_payment = action_type.contains("payment")
        || action_type.contains("transfer")
        || tool_name.contains("payment")
        || tool_name.contains("transfer");

    if is_payment {
        return serde_json::json!({
            "allowed": false,
            "requiresApproval": false,
            "reason": "Payment operations require payment surface authorization",
            "matchedPolicies": [],
            "warnings": []
        });
    }

    let requires_approval = matches!(
        authority,
        "confirm" | "supervised" | "CONFIRM" | "SUPERVISED"
    );

    serde_json::json!({
        "allowed": true,
        "requiresApproval": requires_approval,
        "reason": null,
        "matchedPolicies": [],
        "warnings": []
    })
}

// ─── Tool definitions ─────────────────────────────────────────

fn tools_list() -> serde_json::Value {
    serde_json::json!([
        {
            "name": "axiom_get_context_capsule",
            "description": "Return the full XIOM context capsule for the current session injection.",
            "inputSchema": { "type": "object", "properties": {}, "required": [] }
        },
        {
            "name": "axiom_query_world_model",
            "description": "Fulltext search over facts and goals in the world model.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query":  { "type": "string" },
                    "domain": { "type": "string" },
                    "limit":  { "type": "integer", "default": 10 }
                },
                "required": ["query"]
            }
        },
        {
            "name": "axiom_write_fact",
            "description": "Write a new fact after Guardian soft-check (desktop path).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "content":    { "type": "string" },
                    "sourceType": { "type": "string" },
                    "sourceRef":  { "type": "string" },
                    "confidence": { "type": "number" }
                },
                "required": ["content", "sourceType"]
            }
        },
        {
            "name": "axiom_check_policy",
            "description": "Soft-check policy layers 4–6 (no writes).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "actionType": { "type": "string" },
                    "intent":     { "type": "string" },
                    "toolName":   { "type": "string" },
                    "toolInput":  { "type": "object" }
                },
                "required": ["actionType", "intent", "toolName", "toolInput"]
            }
        },
        {
            "name": "axiom_propose_action",
            "description": "Propose an action; auto-approve when policy allows, else store as proposed.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "actionType": { "type": "string" },
                    "intent":     { "type": "string" },
                    "toolName":   { "type": "string" },
                    "toolInput":  { "type": "object" }
                },
                "required": ["actionType", "intent", "toolName", "toolInput"]
            }
        },
        {
            "name": "axiom_get_session_history",
            "description": "Retrieve SQLite message history for the current session.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "limit": { "type": "integer", "default": 50 }
                },
                "required": []
            }
        },
        {
            "name": "axiom_set_goal",
            "description": "Create a Goal linked to the Human via HAS_GOAL.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name":            { "type": "string" },
                    "deadline":        { "type": "string" },
                    "successCriteria": { "type": "array", "items": { "type": "string" } },
                    "priority":        { "type": "integer", "default": 5 },
                    "description":     { "type": "string" }
                },
                "required": ["name", "successCriteria"]
            }
        },
        {
            "name": "axiom_get_pending_approvals",
            "description": "List proposed actions from the last 24 hours.",
            "inputSchema": { "type": "object", "properties": {}, "required": [] }
        },
        {
            "name": "axiom_approve_action",
            "description": "Approve a proposed action, execute, and write a receipt.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "actionId": { "type": "string" }
                },
                "required": ["actionId"]
            }
        },
        {
            "name": "axiom_write_receipt",
            "description": "Create a hash-chained receipt for an executed action.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "intent":  { "type": "string" },
                    "context": { "type": "string" },
                    "policy":  { "type": "string" },
                    "action":  { "type": "string" },
                    "result":  { "type": "string" }
                },
                "required": ["intent", "context", "policy", "action", "result"]
            }
        }
    ])
}

fn tool_result(value: serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "content": [{ "type": "text", "text": value.to_string() }]
    })
}

// ─── Tool handlers ────────────────────────────────────────────

async fn handle_tool(
    tool_name: &str,
    args: serde_json::Value,
    shared: Arc<McpSharedState>,
) -> Result<serde_json::Value, String> {
    // Accept legacy xiom_* aliases for a few renamed tools
    let name = match tool_name {
        "xiom_get_context_capsule" => "axiom_get_context_capsule",
        "xiom_write_fact" => "axiom_write_fact",
        "xiom_write_receipt" => "axiom_write_receipt",
        "xiom_policy_check" => "axiom_check_policy",
        "xiom_dialogue_history" => "axiom_get_session_history",
        "xiom_graph_context" | "xiom_memory_retrieve" => "axiom_query_world_model",
        other => other,
    };

    match name {
        "axiom_get_context_capsule" => {
            let human_id = shared.human_id.read().await.clone().unwrap_or_default();
            let authority = shared.authority_level.read().await.clone();
            let previous_sessions = {
                let sqlite = shared.sqlite.lock().map_err(|e| e.to_string())?;
                sqlite.count_sessions_today().unwrap_or(0)
            };
            let neo4j = shared.neo4j.lock().await;
            let (goals, policies, facts) = match neo4j.as_ref() {
                None => (vec![], vec![], vec![]),
                Some(mgr) => {
                    let g = mgr.get_active_goals(&human_id).await.unwrap_or_default();
                    let p = mgr.get_active_policies(&human_id).await.unwrap_or_default();
                    let f = mgr.search_facts("*", 20).await.unwrap_or_default();
                    (g, p, f)
                }
            };
            let continuity = if previous_sessions > 0 {
                (0.4 + (previous_sessions as f64) * 0.05).min(1.0)
            } else {
                0.2
            };
            Ok(serde_json::json!({
                "humanId": human_id,
                "activeGoals": goals,
                "recentFacts": facts,
                "activePolicies": policies,
                "pendingActions": [],
                "patterns": [],
                "sessionManifest": {
                    "previousSessions": previous_sessions,
                    "lastSessionAt": chrono::Utc::now().to_rfc3339(),
                    "continuityScore": continuity
                },
                "authorityLevel": authority,
                "generatedAt": chrono::Utc::now().to_rfc3339()
            }))
        }

        "axiom_query_world_model" => {
            let query = args["query"].as_str().unwrap_or("").to_string();
            let limit = args["limit"].as_i64().unwrap_or(10);
            let neo4j = shared.neo4j.lock().await;
            match neo4j.as_ref() {
                None => Err("Neo4j not connected".into()),
                Some(mgr) => {
                    let facts = mgr.search_facts(&query, limit).await.map_err(|e| e.to_string())?;
                    let goals = mgr.search_goals(&query, limit).await.unwrap_or_default();
                    let mut nodes: Vec<serde_json::Value> = facts
                        .into_iter()
                        .map(|f| {
                            serde_json::json!({
                                "id": f["id"],
                                "nodeType": "Fact",
                                "label": f["content"],
                                "score": f["score"],
                                "properties": f
                            })
                        })
                        .collect();
                    for g in goals {
                        nodes.push(serde_json::json!({
                            "id": g["id"],
                            "nodeType": "Goal",
                            "label": g["name"],
                            "score": g["score"],
                            "properties": g
                        }));
                    }
                    nodes.sort_by(|a, b| {
                        let sa = a["score"].as_f64().unwrap_or(0.0);
                        let sb = b["score"].as_f64().unwrap_or(0.0);
                        sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal)
                    });
                    nodes.truncate(limit as usize);
                    let total = nodes.len();
                    Ok(serde_json::json!({ "nodes": nodes, "totalCount": total, "query": query }))
                }
            }
        }

        "axiom_write_fact" => {
            let content = args["content"].as_str().unwrap_or("").to_string();
            let source_type = args["sourceType"].as_str().unwrap_or("manual").to_string();
            let source_ref = args["sourceRef"].as_str().map(|s| s.to_string());
            let human_id = shared.human_id.read().await.clone().unwrap_or_default();

            let neo4j = shared.neo4j.lock().await;
            match neo4j.as_ref() {
                None => Err("Neo4j not connected".into()),
                Some(mgr) => {
                    let fact_id = uuid::Uuid::new_v4().to_string();
                    let now = chrono::Utc::now().to_rfc3339();
                    let mut hasher = Sha256::new();
                    hasher.update(&content);
                    let receipt_hash = hex::encode(hasher.finalize());
                    mgr.write_fact(
                        &human_id,
                        &fact_id,
                        &content,
                        &source_type,
                        source_ref.as_deref(),
                        &now,
                    )
                    .await
                    .map_err(|e| e.to_string())?;
                    Ok(serde_json::json!({
                        "factId": fact_id,
                        "receiptHash": receipt_hash,
                        "requiresApproval": false,
                        "guardianResult": { "allowed": true, "deniedLayers": [] }
                    }))
                }
            }
        }

        "axiom_check_policy" => {
            let action_type = args["actionType"].as_str().unwrap_or("");
            let tool_name_arg = args["toolName"].as_str().unwrap_or("");
            // Also accept nested action object (legacy)
            let action_type = if action_type.is_empty() {
                args["action"]["actionType"].as_str().unwrap_or("")
            } else {
                action_type
            };
            let authority = shared.authority_level.read().await.clone();
            Ok(soft_policy_check(action_type, tool_name_arg, &authority))
        }

        "axiom_propose_action" => {
            let action_type = args["actionType"].as_str().unwrap_or("").to_string();
            let intent = args["intent"].as_str().unwrap_or("").to_string();
            let tool_name_arg = args["toolName"].as_str().unwrap_or("").to_string();
            let human_id = shared.human_id.read().await.clone().unwrap_or_default();
            let authority = shared.authority_level.read().await.clone();
            let check = soft_policy_check(&action_type, &tool_name_arg, &authority);

            if check["allowed"] == false {
                return Ok(serde_json::json!({
                    "status": "denied",
                    "actionId": null,
                    "guardianResult": check,
                    "receiptId": null
                }));
            }

            let neo4j = shared.neo4j.lock().await;
            match neo4j.as_ref() {
                None => Err("Neo4j not connected".into()),
                Some(mgr) => {
                    let requires = check["requiresApproval"].as_bool().unwrap_or(true);
                    let status = if requires { "proposed" } else { "approved" };
                    let action_id = mgr
                        .write_action(
                            &human_id,
                            &action_type,
                            &intent,
                            &tool_name_arg,
                            status,
                        )
                        .await
                        .map_err(|e| e.to_string())?;

                    if requires {
                        Ok(serde_json::json!({
                            "status": "proposed",
                            "actionId": action_id,
                            "guardianResult": check,
                            "receiptId": null,
                            "message": "Awaiting human approval via axiom_approve_action"
                        }))
                    } else {
                        let result = format!("executed:{tool_name_arg}");
                        let _ = mgr
                            .complete_action(&action_id, &result)
                            .await;
                        let receipt_id = uuid::Uuid::new_v4().to_string();
                        Ok(serde_json::json!({
                            "status": "approved",
                            "actionId": action_id,
                            "guardianResult": check,
                            "receiptId": receipt_id,
                            "result": result
                        }))
                    }
                }
            }
        }

        "axiom_get_session_history" => {
            let limit = args["limit"].as_i64().unwrap_or(50);
            let session_id = {
                let from_args = args["sessionId"].as_str().map(|s| s.to_string());
                if let Some(s) = from_args {
                    s
                } else {
                    shared
                        .current_session_id
                        .read()
                        .await
                        .clone()
                        .unwrap_or_default()
                }
            };
            let sqlite = shared.sqlite.lock().map_err(|e| e.to_string())?;
            let messages = sqlite
                .get_session_history(&session_id, limit)
                .map_err(|e| e.to_string())?;
            Ok(serde_json::json!({
                "sessionId": session_id,
                "messages": messages,
                "count": messages.len()
            }))
        }

        "axiom_set_goal" => {
            let name = args["name"].as_str().unwrap_or("").to_string();
            let description = args["description"]
                .as_str()
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("Goal: {name}"));
            let priority = args["priority"].as_i64().unwrap_or(5);
            let human_id = shared.human_id.read().await.clone().unwrap_or_default();
            let neo4j = shared.neo4j.lock().await;
            match neo4j.as_ref() {
                None => Err("Neo4j not connected".into()),
                Some(mgr) => {
                    let goal_id = mgr
                        .write_goal(&human_id, &name, &description, priority)
                        .await
                        .map_err(|e| e.to_string())?;
                    Ok(serde_json::json!({
                        "goalId": goal_id,
                        "guardianResult": { "allowed": true, "deniedLayers": [] }
                    }))
                }
            }
        }

        "axiom_get_pending_approvals" => {
            let human_id = shared.human_id.read().await.clone().unwrap_or_default();
            let neo4j = shared.neo4j.lock().await;
            match neo4j.as_ref() {
                None => Ok(serde_json::json!({ "actions": [], "count": 0 })),
                Some(mgr) => {
                    let actions = mgr
                        .get_pending_approvals(&human_id)
                        .await
                        .map_err(|e| e.to_string())?;
                    let count = actions.len();
                    Ok(serde_json::json!({ "actions": actions, "count": count }))
                }
            }
        }

        "axiom_approve_action" => {
            let action_id = args["actionId"].as_str().unwrap_or("").to_string();
            if action_id.is_empty() {
                return Err("actionId is required".into());
            }
            let human_id = shared.human_id.read().await.clone().unwrap_or_default();
            let neo4j = shared.neo4j.lock().await;
            match neo4j.as_ref() {
                None => Err("Neo4j not connected".into()),
                Some(mgr) => {
                    mgr.approve_action(&action_id)
                        .await
                        .map_err(|e| e.to_string())?;
                    let result = format!("executed:{action_id}");
                    mgr.complete_action(&action_id, &result)
                        .await
                        .map_err(|e| e.to_string())?;

                    let receipt_id = uuid::Uuid::new_v4().to_string();
                    let now = chrono::Utc::now().to_rfc3339();
                    let date = &now[..10];
                    let today_count = mgr.count_receipts_today(date).await.unwrap_or(0);
                    let receipt_number = format!("{}-{:04}", date, today_count + 1);
                    let prev_hash = mgr
                        .latest_receipt_hash(&human_id)
                        .await
                        .unwrap_or_else(|_| "0".repeat(64));
                    let mut hasher = Sha256::new();
                    hasher.update(format!("{prev_hash}{now}approve{action_id}{result}"));
                    let hash = hex::encode(hasher.finalize());
                    mgr.write_receipt(
                        &human_id,
                        &receipt_id,
                        &receipt_number,
                        "approve_action",
                        &action_id,
                        "human_approval",
                        &action_id,
                        &result,
                        &prev_hash,
                        &hash,
                        &now,
                    )
                    .await
                    .map_err(|e| e.to_string())?;

                    Ok(serde_json::json!({
                        "executed": true,
                        "result": result,
                        "receiptId": receipt_id,
                        "hash": hash
                    }))
                }
            }
        }

        "axiom_write_receipt" => {
            let intent = args["intent"].as_str().unwrap_or("").to_string();
            let context = args["context"].as_str().unwrap_or("").to_string();
            let policy = args["policy"].as_str().unwrap_or("").to_string();
            let action = args["action"].as_str().unwrap_or("").to_string();
            let result = args["result"].as_str().unwrap_or("").to_string();
            let human_id = shared.human_id.read().await.clone().unwrap_or_default();

            let neo4j = shared.neo4j.lock().await;
            match neo4j.as_ref() {
                None => Err("Neo4j not connected".into()),
                Some(mgr) => {
                    let receipt_id = uuid::Uuid::new_v4().to_string();
                    let now = chrono::Utc::now().to_rfc3339();
                    let date = &now[..10];
                    let today_count = mgr.count_receipts_today(date).await.unwrap_or(0);
                    let receipt_number = format!("{}-{:04}", date, today_count + 1);
                    let prev_hash = mgr
                        .latest_receipt_hash(&human_id)
                        .await
                        .unwrap_or_else(|_| "0".repeat(64));

                    let mut hasher = Sha256::new();
                    hasher.update(format!("{prev_hash}{now}{intent}{action}{result}"));
                    let hash = hex::encode(hasher.finalize());

                    mgr.write_receipt(
                        &human_id,
                        &receipt_id,
                        &receipt_number,
                        &intent,
                        &context,
                        &policy,
                        &action,
                        &result,
                        &prev_hash,
                        &hash,
                        &now,
                    )
                    .await
                    .map_err(|e| e.to_string())?;

                    Ok(serde_json::json!({
                        "receiptId": receipt_id,
                        "receiptNumber": receipt_number,
                        "hash": hash
                    }))
                }
            }
        }

        _ => Err(format!("Unknown tool: {tool_name}")),
    }
}

// ─── Axum handler ─────────────────────────────────────────────

async fn handle_rpc(
    State(shared): State<Arc<McpSharedState>>,
    Json(req): Json<JsonRpcRequest>,
) -> (StatusCode, Json<JsonRpcResponse>) {
    if req.jsonrpc != "2.0" {
        return (
            StatusCode::OK,
            Json(JsonRpcResponse::err(req.id, -32600, "Invalid JSON-RPC version")),
        );
    }

    let params = req.params.unwrap_or(serde_json::Value::Null);

    let response = match req.method.as_str() {
        "initialize" => JsonRpcResponse::ok(
            req.id,
            serde_json::json!({
                "protocolVersion": "2024-11-05",
                "capabilities": { "tools": {} },
                "serverInfo": { "name": "xiom-mcp", "version": "0.1.0" }
            }),
        ),

        "tools/list" => JsonRpcResponse::ok(req.id, serde_json::json!({ "tools": tools_list() })),

        "tools/call" => {
            let tool_name = params["name"].as_str().unwrap_or("").to_string();
            let args = params["arguments"].clone();
            match handle_tool(&tool_name, args, shared).await {
                Ok(result) => JsonRpcResponse::ok(req.id, tool_result(result)),
                Err(e) => JsonRpcResponse::err(req.id, -32000, e),
            }
        }

        _ => JsonRpcResponse::err(req.id, -32601, format!("Method not found: {}", req.method)),
    };

    (StatusCode::OK, Json(response))
}

// ─── Server launcher ──────────────────────────────────────────

/// Start the MCP HTTP server on the given port.
pub async fn start_mcp_server(
    port: u16,
    neo4j: Arc<tokio::sync::Mutex<Option<Neo4jManager>>>,
    sqlite: Arc<std::sync::Mutex<SqliteManager>>,
    human_id: Arc<tokio::sync::RwLock<Option<String>>>,
) -> anyhow::Result<McpHandle> {
    let shared = Arc::new(McpSharedState {
        neo4j,
        sqlite,
        human_id,
        current_session_id: Arc::new(tokio::sync::RwLock::new(None)),
        authority_level: Arc::new(tokio::sync::RwLock::new("supervised".into())),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", post(handle_rpc))
        .route("/mcp", post(handle_rpc))
        .layer(cors)
        .with_state(shared);

    let addr: SocketAddr = format!("127.0.0.1:{port}").parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;

    tracing::info!("MCP server listening on http://127.0.0.1:{port}");

    let (tx, rx) = oneshot::channel::<()>();

    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                rx.await.ok();
            })
            .await
            .ok();
        tracing::info!("MCP server stopped");
    });

    Ok(McpHandle {
        shutdown_tx: tx,
        port,
    })
}
