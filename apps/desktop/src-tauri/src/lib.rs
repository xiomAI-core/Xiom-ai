// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Application Entry (lib.rs)
// AppState definition, Tauri setup, system tray, command registration.
// ──────────────────────────────────────────────────────────────

pub mod commands;
pub mod guardian;
pub mod mcp;
pub mod neo4j;
pub mod sqlite;

use mcp::McpHandle;
use neo4j::Neo4jManager;
use sqlite::SqliteManager;

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri_plugin_updater::UpdaterExt as _;
use tokio::sync::{Mutex as AsyncMutex, RwLock as AsyncRwLock};

// ─── App Config ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub neo4j_uri: String,
    pub neo4j_user: String,
    pub mcp_port: u16,
    pub authority_level: String,
    pub human_id: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            neo4j_uri:       "bolt://localhost:7687".into(),
            neo4j_user:      "neo4j".into(),
            mcp_port:        54321,
            authority_level: "supervised".into(),
            human_id:        None,
        }
    }
}

// ─── App State ────────────────────────────────────────────────

pub struct AppState {
    /// Live Neo4j connection (None until connect_neo4j is called)
    pub neo4j: Arc<AsyncMutex<Option<Neo4jManager>>>,
    /// SQLite manager wrapped in std::sync::Mutex (sync ops)
    pub sqlite: Arc<std::sync::Mutex<SqliteManager>>,
    /// Second Arc for the SQLite manager used by the MCP server
    pub sqlite_arc: Arc<std::sync::Mutex<SqliteManager>>,
    /// Running MCP server handle (None if stopped)
    pub mcp_handle: Arc<AsyncMutex<Option<McpHandle>>>,
    /// Runtime configuration
    pub config: Arc<AsyncRwLock<AppConfig>>,
    /// Which human's world model is currently active
    pub current_human_id: Arc<AsyncRwLock<Option<String>>>,
}

impl AppState {
    pub fn new(sqlite: SqliteManager) -> Self {
        // Wrap SQLite in Arc<Mutex> — both fields share the same underlying lock
        // so only one path actually uses the connection at a time.
        let sqlite_arc = Arc::new(std::sync::Mutex::new(sqlite));
        // Note: two Arc clones pointing at the same Mutex<SqliteManager>.
        let sqlite_clone = sqlite_arc.clone();
        Self {
            neo4j:            Arc::new(AsyncMutex::new(None)),
            sqlite:           sqlite_arc,
            sqlite_arc:       sqlite_clone,
            mcp_handle:       Arc::new(AsyncMutex::new(None)),
            config:           Arc::new(AsyncRwLock::new(AppConfig::default())),
            current_human_id: Arc::new(AsyncRwLock::new(None)),
        }
    }
}

// ─── Application Entry Point ──────────────────────────────────

pub fn run() {
    // Initialise tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        // ─── Plugins ──────────────────────────────────────────
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // ─── Setup ────────────────────────────────────────────
        .setup(|app| {
            // Determine data directory for SQLite
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            if let Err(err) = std::fs::create_dir_all(&app_data_dir) {
                tracing::warn!("Could not create app data dir {:?}: {err}", app_data_dir);
            }

            let db_path = app_data_dir
                .join("xiom.db")
                .to_string_lossy()
                .to_string();
            tracing::info!("SQLite database: {db_path}");

            let sqlite = SqliteManager::new(&db_path)
                .expect("Fatal: could not open SQLite database");

            let state = AppState::new(sqlite);
            app.manage(state);

            // ─── System Tray ──────────────────────────────────
            let _tray = tauri::tray::TrayIconBuilder::new()
                .tooltip("XIOM — Personal AI OS")
                .on_tray_icon_event(|tray, event| {
                    #[allow(clippy::single_match)]
                    match event {
                        tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } => {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // ─── Auto-updater check on startup ────────────────
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                match handle.updater() {
                    Err(e) => tracing::warn!("Updater init failed: {e}"),
                    Ok(updater) => match updater.check().await {
                        Ok(Some(update)) => {
                            tracing::info!(
                                "Update available: {} → {}",
                                update.current_version,
                                update.version
                            );
                            let _ = handle.emit("update-available", &update.version);
                        }
                        Ok(None) => tracing::debug!("No update available"),
                        Err(e)  => tracing::warn!("Updater check failed: {e}"),
                    },
                }
            });

            Ok(())
        })
        // ─── Command registration ──────────────────────────────
        .invoke_handler(tauri::generate_handler![
            commands::connect_neo4j,
            commands::get_neo4j_status,
            commands::get_world_model_projection,
            commands::get_context_capsule,
            commands::create_session,
            commands::get_session_history,
            commands::get_session_list,
            commands::get_active_goals,
            commands::get_receipt_chain,
            commands::start_mcp_server_cmd,
            commands::stop_mcp_server,
            commands::run_guardian_check,
            commands::get_app_health,
        ])
        .run(tauri::generate_context!())
        .expect("Fatal: error while running XIOM desktop application");
}
