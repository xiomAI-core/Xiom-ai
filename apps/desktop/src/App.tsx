// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Root Application Shell
// Sidebar navigation + lazy-loaded page views
// ──────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { useAppStore } from './store/app-store.js';
import { getAppHealth, getNeo4jStatus } from './hooks/useTauri.js';
import { isBrowserDevMode } from './mocks/tauri-bridge.js';
import Dashboard       from './pages/Dashboard.js';
import WorldModelViewer from './pages/WorldModelViewer.js';
import Sessions        from './pages/Sessions.js';
import Receipts        from './pages/Receipts.js';
import Policies        from './pages/Policies.js';
import SettingsPage    from './pages/Settings.js';

// ─── Nav items ────────────────────────────────────────────────

const VIEWS = [
  { id: 'Dashboard',    icon: '◈', label: 'Dashboard' },
  { id: 'World Model',  icon: '⬡', label: 'World Model' },
  { id: 'Sessions',     icon: '⎄', label: 'Sessions' },
  { id: 'Receipts',     icon: '⊞', label: 'Receipts' },
  { id: 'Policies',     icon: '⊛', label: 'Policies' },
  { id: 'Settings',     icon: '⚙', label: 'Settings' },
] as const;

// ─── Status bar ───────────────────────────────────────────────

function StatusBar() {
  const health     = useAppStore((s) => s.health);
  const mcpRunning = useAppStore((s) => s.mcpRunning);

  return (
    <div className="sidebar__status">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="status-label">
          <span className={`status-dot ${health?.neo4j ? 'ok' : 'off'}`} />
          Neo4j {health?.neo4j ? `${health.node_count} nodes` : 'offline'}
        </span>
        <span className="status-label">
          <span className={`status-dot ${health?.sqlite ? 'ok' : 'err'}`} />
          SQLite
        </span>
        <span className="status-label">
          <span className={`status-dot ${mcpRunning ? 'ok' : 'off'}`} />
          MCP {mcpRunning ? 'running' : 'stopped'}
        </span>
      </div>
    </div>
  );
}

// ─── Toast notifications ──────────────────────────────────────

function ToastStack() {
  const toasts      = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type}`}
          onClick={() => dismissToast(t.id)}
          style={{ cursor: 'pointer' }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────

export default function App() {
  const activeView   = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const setHealth     = useAppStore((s) => s.setHealth);
  const setNeo4jStatus = useAppStore((s) => s.setNeo4jStatus);
  const setMcpRunning  = useAppStore((s) => s.setMcpRunning);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll health every 30 s
  useEffect(() => {
    const poll = async () => {
      try {
        const [health, status] = await Promise.all([
          getAppHealth(),
          getNeo4jStatus(),
        ]);
        setHealth(health);
        setNeo4jStatus(status);
        setMcpRunning(health.mcp);
      } catch {
        // Tauri not available in browser dev mode — silently ignore
      }
    };

    void poll();
    intervalRef.current = setInterval(() => { void poll(); }, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setHealth, setNeo4jStatus, setMcpRunning]);

  const renderPage = () => {
    switch (activeView) {
      case 'Dashboard':    return <Dashboard />;
      case 'World Model':  return <WorldModelViewer />;
      case 'Sessions':     return <Sessions />;
      case 'Receipts':     return <Receipts />;
      case 'Policies':     return <Policies />;
      case 'Settings':     return <SettingsPage />;
      default:             return <Dashboard />;
    }
  };

  return (
    <div className="layout">
      {/* ── Sidebar ── */}
      <nav className="sidebar">
        <div className="sidebar__logo">
          <h1>XIOM</h1>
          <p>Personal AI OS</p>
        </div>

        <div className="sidebar__nav">
          {VIEWS.map((v) => (
            <div
              key={v.id}
              className={`nav-item${activeView === v.id ? ' active' : ''}`}
              onClick={() => setActiveView(v.id)}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>{v.icon}</span>
              {v.label}
            </div>
          ))}
        </div>

        <StatusBar />
      </nav>

      {/* ── Main ── */}
      <div className="main">
        {isBrowserDevMode() ? (
          <div
            style={{
              background: 'rgba(234,179,8,0.12)',
              borderBottom: '1px solid rgba(234,179,8,0.35)',
              color: '#fde68a',
              fontSize: 12,
              padding: '8px 16px',
            }}
          >
            Browser dev mode — native Tauri unavailable (cargo blocked on this PC). UI runs with demo data.
            For full desktop: allow cargo.exe in Windows Security or run{' '}
            <code style={{ color: '#fff' }}>pnpm tauri:dev</code> after fixing Rust.
          </div>
        ) : null}
        {renderPage()}
      </div>

      {/* ── Notifications ── */}
      <ToastStack />
    </div>
  );
}
