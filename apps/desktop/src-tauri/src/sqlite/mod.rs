// ──────────────────────────────────────────────────────────────
// XIOM Desktop — SQLite Session Continuity Manager
// Local storage for provider sessions, messages, and manifests.
// ──────────────────────────────────────────────────────────────
use anyhow::{anyhow, Result};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ─── Types ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub seq: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub provider: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub message_count: i64,
    pub is_recoverable: bool,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecovery {
    pub session_id: String,
    pub context_snapshot: String,
    pub checkpoint_at: String,
    pub messages: Vec<Message>,
}

// ─── Manager ──────────────────────────────────────────────────

pub struct SqliteManager {
    conn: Connection,
}

// SAFETY: rusqlite::Connection is Send (upstream unsafe impl).
unsafe impl Send for SqliteManager {}

impl SqliteManager {
    /// Open or create the SQLite database at the given path.
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)
            .map_err(|e| anyhow!("SQLite open failed at {db_path}: {e}"))?;

        let mgr = Self { conn };
        mgr.init_schema()?;
        Ok(mgr)
    }

    /// Create all required tables (idempotent — IF NOT EXISTS).
    pub fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS sessions (
                id              TEXT PRIMARY KEY,
                provider        TEXT NOT NULL,
                started_at      TEXT NOT NULL,
                ended_at        TEXT,
                message_count   INTEGER NOT NULL DEFAULT 0,
                manifest_json   TEXT,
                is_recoverable  INTEGER NOT NULL DEFAULT 1,
                status          TEXT NOT NULL DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS messages (
                id          TEXT PRIMARY KEY,
                session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                role        TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
                content     TEXT NOT NULL,
                timestamp   TEXT NOT NULL,
                provider_id TEXT,
                seq         INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, seq);

            CREATE TABLE IF NOT EXISTS session_manifest (
                session_id        TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
                context_snapshot  TEXT NOT NULL,
                checkpoint_at     TEXT NOT NULL,
                ci_guarantees     TEXT
            );
            ",
        )
        .map_err(|e| anyhow!("SQLite schema init failed: {e}"))?;
        Ok(())
    }

    /// Start a new provider session. Returns the new session ID.
    pub fn create_session(&self, provider: &str) -> Result<String> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        self.conn
            .execute(
                "INSERT INTO sessions (id, provider, started_at, status) VALUES (?1, ?2, ?3, 'active')",
                params![id, provider, now],
            )
            .map_err(|e| anyhow!("create_session failed: {e}"))?;
        Ok(id)
    }

    /// Append a message to a session and increment message_count.
    pub fn append_message(&self, session_id: &str, role: &str, content: &str) -> Result<()> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        // Get current seq number
        let seq: i64 = self
            .conn
            .query_row(
                "SELECT COALESCE(MAX(seq), -1) + 1 FROM messages WHERE session_id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        self.conn
            .execute(
                "INSERT INTO messages (id, session_id, role, content, timestamp, seq)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, session_id, role, content, now, seq],
            )
            .map_err(|e| anyhow!("append_message failed: {e}"))?;

        self.conn
            .execute(
                "UPDATE sessions SET message_count = message_count + 1 WHERE id = ?1",
                params![session_id],
            )
            .map_err(|e| anyhow!("update message_count failed: {e}"))?;

        Ok(())
    }

    /// Fetch the last N messages for a session, ordered by seq.
    pub fn get_session_history(&self, session_id: &str, limit: i64) -> Result<Vec<Message>> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, session_id, role, content, timestamp, seq
                 FROM messages
                 WHERE session_id = ?1
                 ORDER BY seq DESC
                 LIMIT ?2",
            )
            .map_err(|e| anyhow!("prepare history failed: {e}"))?;

        let rows = stmt
            .query_map(params![session_id, limit], |row| {
                Ok(Message {
                    id:         row.get(0)?,
                    session_id: row.get(1)?,
                    role:       row.get(2)?,
                    content:    row.get(3)?,
                    timestamp:  row.get(4)?,
                    seq:        row.get(5)?,
                })
            })
            .map_err(|e| anyhow!("query history failed: {e}"))?;

        let mut messages = Vec::new();
        for row in rows {
            messages.push(row.map_err(|e| anyhow!("row error: {e}"))?);
        }
        // Return in chronological order
        messages.reverse();
        Ok(messages)
    }

    /// Save a context snapshot checkpoint for session recovery.
    pub fn checkpoint_session(&self, session_id: &str, context_snapshot: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn
            .execute(
                "INSERT INTO session_manifest (session_id, context_snapshot, checkpoint_at)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(session_id) DO UPDATE
                   SET context_snapshot = excluded.context_snapshot,
                       checkpoint_at    = excluded.checkpoint_at",
                params![session_id, context_snapshot, now],
            )
            .map_err(|e| anyhow!("checkpoint_session failed: {e}"))?;
        Ok(())
    }

    /// Retrieve session recovery data (context + recent messages).
    pub fn recover_session(&self, session_id: &str) -> Result<Option<SessionRecovery>> {
        let manifest = self.conn.query_row(
            "SELECT context_snapshot, checkpoint_at FROM session_manifest WHERE session_id = ?1",
            params![session_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                ))
            },
        );

        match manifest {
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(anyhow!("recover_session query failed: {e}")),
            Ok((context_snapshot, checkpoint_at)) => {
                let messages = self.get_session_history(session_id, 50)?;
                Ok(Some(SessionRecovery {
                    session_id: session_id.to_string(),
                    context_snapshot,
                    checkpoint_at,
                    messages,
                }))
            }
        }
    }

    /// Mark a session as closed.
    pub fn close_session(&self, session_id: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn
            .execute(
                "UPDATE sessions SET ended_at = ?1, status = 'closed', is_recoverable = 0 WHERE id = ?2",
                params![now, session_id],
            )
            .map_err(|e| anyhow!("close_session failed: {e}"))?;
        Ok(())
    }

    /// List the N most recent sessions (all statuses).
    pub fn list_recent_sessions(&self, limit: i64) -> Result<Vec<SessionSummary>> {
        self.query_sessions(
            "SELECT id, provider, started_at, ended_at, message_count, is_recoverable, status
             FROM sessions ORDER BY started_at DESC LIMIT ?1",
            params![limit],
        )
    }

    /// Return sessions that can be resumed.
    pub fn get_recoverable_sessions(&self) -> Result<Vec<SessionSummary>> {
        self.query_sessions(
            "SELECT id, provider, started_at, ended_at, message_count, is_recoverable, status
             FROM sessions WHERE is_recoverable = 1 ORDER BY started_at DESC",
            params![],
        )
    }

    /// Count today's total sessions.
    pub fn count_sessions_today(&self) -> Result<i64> {
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        self.conn
            .query_row(
                "SELECT count(*) FROM sessions WHERE started_at LIKE ?1",
                params![format!("{today}%")],
                |row| row.get(0),
            )
            .map_err(|e| anyhow!("count_sessions_today failed: {e}"))
    }

    // ─── Private helpers ──────────────────────────────────────

    fn query_sessions(&self, sql: &str, p: impl rusqlite::Params) -> Result<Vec<SessionSummary>> {
        let mut stmt = self
            .conn
            .prepare(sql)
            .map_err(|e| anyhow!("prepare sessions failed: {e}"))?;

        let rows = stmt
            .query_map(p, |row| {
                Ok(SessionSummary {
                    id:            row.get(0)?,
                    provider:      row.get(1)?,
                    started_at:    row.get(2)?,
                    ended_at:      row.get(3)?,
                    message_count: row.get(4)?,
                    is_recoverable:row.get::<_, i64>(5)? != 0,
                    status:        row.get(6)?,
                })
            })
            .map_err(|e| anyhow!("query sessions failed: {e}"))?;

        let mut sessions = Vec::new();
        for row in rows {
            sessions.push(row.map_err(|e| anyhow!("row error: {e}"))?);
        }
        Ok(sessions)
    }
}
