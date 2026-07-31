import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Root Application Shell
// Sidebar navigation + lazy-loaded page views
// ──────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { useAppStore } from './store/app-store.js';
import { getAppHealth, getNeo4jStatus } from './hooks/useTauri.js';
import { isBrowserDevMode } from './mocks/tauri-bridge.js';
import Dashboard from './pages/Dashboard.js';
import WorldModelViewer from './pages/WorldModelViewer.js';
import Sessions from './pages/Sessions.js';
import Receipts from './pages/Receipts.js';
import Policies from './pages/Policies.js';
import SettingsPage from './pages/Settings.js';
// ─── Nav items ────────────────────────────────────────────────
const VIEWS = [
    { id: 'Dashboard', icon: '◈', label: 'Dashboard' },
    { id: 'World Model', icon: '⬡', label: 'World Model' },
    { id: 'Sessions', icon: '⎄', label: 'Sessions' },
    { id: 'Receipts', icon: '⊞', label: 'Receipts' },
    { id: 'Policies', icon: '⊛', label: 'Policies' },
    { id: 'Settings', icon: '⚙', label: 'Settings' },
];
// ─── Status bar ───────────────────────────────────────────────
function StatusBar() {
    const health = useAppStore((s) => s.health);
    const mcpRunning = useAppStore((s) => s.mcpRunning);
    return (_jsx("div", { className: "sidebar__status", children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsxs("span", { className: "status-label", children: [_jsx("span", { className: `status-dot ${health?.neo4j ? 'ok' : 'off'}` }), "Neo4j ", health?.neo4j ? `${health.node_count} nodes` : 'offline'] }), _jsxs("span", { className: "status-label", children: [_jsx("span", { className: `status-dot ${health?.sqlite ? 'ok' : 'err'}` }), "SQLite"] }), _jsxs("span", { className: "status-label", children: [_jsx("span", { className: `status-dot ${mcpRunning ? 'ok' : 'off'}` }), "MCP ", mcpRunning ? 'running' : 'stopped'] })] }) }));
}
// ─── Toast notifications ──────────────────────────────────────
function ToastStack() {
    const toasts = useAppStore((s) => s.toasts);
    const dismissToast = useAppStore((s) => s.dismissToast);
    return (_jsx("div", { className: "toast-container", children: toasts.map((t) => (_jsx("div", { className: `toast toast--${t.type}`, onClick: () => dismissToast(t.id), style: { cursor: 'pointer' }, children: t.message }, t.id))) }));
}
// ─── App root ─────────────────────────────────────────────────
export default function App() {
    const activeView = useAppStore((s) => s.activeView);
    const setActiveView = useAppStore((s) => s.setActiveView);
    const setHealth = useAppStore((s) => s.setHealth);
    const setNeo4jStatus = useAppStore((s) => s.setNeo4jStatus);
    const setMcpRunning = useAppStore((s) => s.setMcpRunning);
    const intervalRef = useRef(null);
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
            }
            catch {
                // Tauri not available in browser dev mode — silently ignore
            }
        };
        void poll();
        intervalRef.current = setInterval(() => { void poll(); }, 30_000);
        return () => {
            if (intervalRef.current)
                clearInterval(intervalRef.current);
        };
    }, [setHealth, setNeo4jStatus, setMcpRunning]);
    const renderPage = () => {
        switch (activeView) {
            case 'Dashboard': return _jsx(Dashboard, {});
            case 'World Model': return _jsx(WorldModelViewer, {});
            case 'Sessions': return _jsx(Sessions, {});
            case 'Receipts': return _jsx(Receipts, {});
            case 'Policies': return _jsx(Policies, {});
            case 'Settings': return _jsx(SettingsPage, {});
            default: return _jsx(Dashboard, {});
        }
    };
    return (_jsxs("div", { className: "layout", children: [_jsxs("nav", { className: "sidebar", children: [_jsxs("div", { className: "sidebar__logo", children: [_jsx("h1", { children: "XIOM" }), _jsx("p", { children: "Personal AI OS" })] }), _jsx("div", { className: "sidebar__nav", children: VIEWS.map((v) => (_jsxs("div", { className: `nav-item${activeView === v.id ? ' active' : ''}`, onClick: () => setActiveView(v.id), children: [_jsx("span", { style: { fontSize: 14, lineHeight: 1 }, children: v.icon }), v.label] }, v.id))) }), _jsx(StatusBar, {})] }), _jsxs("div", { className: "main", children: [isBrowserDevMode() ? (_jsxs("div", { style: {
                            background: 'rgba(234,179,8,0.12)',
                            borderBottom: '1px solid rgba(234,179,8,0.35)',
                            color: '#fde68a',
                            fontSize: 12,
                            padding: '8px 16px',
                        }, children: ["Browser dev mode \u2014 native Tauri unavailable (cargo blocked on this PC). UI runs with demo data. For full desktop: allow cargo.exe in Windows Security or run", ' ', _jsx("code", { style: { color: '#fff' }, children: "pnpm tauri:dev" }), " after fixing Rust."] })) : null, renderPage()] }), _jsx(ToastStack, {})] }));
}
//# sourceMappingURL=App.js.map