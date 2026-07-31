import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Dashboard
// Live stats, governance loop, quick actions, activity feed.
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store.js';
import { getActiveGoals, getWorldModelProjection, getAppHealth } from '../hooks/useTauri.js';
const GOV_PHASES = ['Observe', 'Decide', 'Act', 'Verify', 'Evolve'];
const MOCK_ACTIVITY = [
    { icon: '✓', text: 'Guardian check passed for email.send', time: '2m ago' },
    { icon: '⊞', text: 'Receipt #2026-07-29-0001 issued', time: '4m ago' },
    { icon: '⬡', text: 'World model updated — 3 new facts', time: '12m ago' },
    { icon: '⊛', text: 'Policy "No bulk email" enforced', time: '31m ago' },
    { icon: '◈', text: 'Session claude-code-001 started', time: '1h ago' },
];
function GoalRow({ goal }) {
    const pct = Math.round(goal.progress * 100);
    return (_jsxs("div", { style: { marginBottom: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 }, children: [_jsx("span", { style: { fontSize: 12 }, children: goal.name }), _jsxs("span", { style: { fontSize: 11, color: 'rgba(255,255,255,0.4)' }, children: [pct, "%"] })] }), _jsx("div", { className: "progress", children: _jsx("div", { className: "progress__fill", style: { width: `${pct}%` } }) })] }));
}
export default function Dashboard() {
    const projection = useAppStore((s) => s.projection);
    const health = useAppStore((s) => s.health);
    const goals = useAppStore((s) => s.goals);
    const setProjection = useAppStore((s) => s.setProjection);
    const setGoals = useAppStore((s) => s.setGoals);
    const setHealth = useAppStore((s) => s.setHealth);
    const pushToast = useAppStore((s) => s.pushToast);
    const setActiveView = useAppStore((s) => s.setActiveView);
    const [activePhase, setActivePhase] = useState(1); // Decide
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const [proj, goalData, healthData] = await Promise.all([
                    getWorldModelProjection(),
                    getActiveGoals(),
                    getAppHealth(),
                ]);
                setProjection(proj);
                setGoals(goalData);
                setHealth(healthData);
            }
            catch {
                // dev mode / no Tauri — ignore
            }
            finally {
                setLoading(false);
            }
        };
        void fetch();
    }, [setProjection, setGoals, setHealth]);
    const nodeCount = projection?.node_count ?? 0;
    const goalCount = projection?.active_goal_count ?? goals.length;
    const sessionCount = health?.session_count ?? 0;
    const pendingCount = 0; // would come from pending actions query
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "topbar", children: [_jsx("span", { className: "topbar__title", children: "Dashboard" }), _jsxs("div", { className: "topbar__actions", children: [_jsx("button", { className: "btn btn--sm", onClick: () => setActiveView('Sessions'), children: "+ New Session" }), _jsx("button", { className: "btn btn--sm", onClick: () => pushToast('Guardian check triggered', 'info'), children: "Run Guardian Check" })] })] }), _jsxs("div", { className: "content", children: [loading && (_jsx("p", { style: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 16 }, children: "Fetching live data\u2026" })), _jsxs("div", { className: "stat-grid", children: [_jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "stat-card__value", style: { color: '#4a90d9' }, children: nodeCount }), _jsx("div", { className: "stat-card__label", children: "Graph Nodes" })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "stat-card__value", style: { color: '#2ecc71' }, children: goalCount }), _jsx("div", { className: "stat-card__label", children: "Active Goals" })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "stat-card__value", children: sessionCount }), _jsx("div", { className: "stat-card__label", children: "Sessions Today" })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "stat-card__value", style: { color: '#f1c40f' }, children: pendingCount }), _jsx("div", { className: "stat-card__label", children: "Pending Actions" })] })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }, children: [_jsxs("div", { children: [_jsx("p", { className: "section-title", children: "Governance Loop" }), _jsx("div", { className: "gov-loop", style: { marginBottom: 20 }, children: GOV_PHASES.map((phase, i) => (_jsx("div", { className: `gov-phase${i === activePhase ? ' active' : ''}`, onClick: () => setActivePhase(i), style: { cursor: 'pointer' }, children: phase }, phase))) }), _jsx("p", { className: "section-title", children: "Active Goals" }), goals.length === 0 ? (_jsx("p", { style: { color: 'rgba(255,255,255,0.3)', fontSize: 12 }, children: "No active goals \u2014 connect to Neo4j to load world model." })) : (goals.slice(0, 5).map((g) => _jsx(GoalRow, { goal: g }, g.id)))] }), _jsxs("div", { children: [_jsx("p", { className: "section-title", children: "Provider Lanes" }), _jsx("div", { className: "card", style: { marginBottom: 12 }, children: [
                                            { name: 'Claude Code', icon: '◆', connected: false },
                                            { name: 'OpenAI Codex', icon: '○', connected: false },
                                            { name: 'Gemini', icon: '◇', connected: false },
                                        ].map((p) => (_jsxs("div", { style: {
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            }, children: [_jsxs("span", { style: { fontSize: 12 }, children: [_jsx("span", { style: { marginRight: 8, opacity: 0.5 }, children: p.icon }), p.name] }), _jsx("span", { className: `badge ${p.connected ? 'badge--green' : 'badge--gray'}`, children: p.connected ? 'Connected' : 'Idle' })] }, p.name))) }), _jsx("p", { className: "section-title", children: "Recent Activity" }), MOCK_ACTIVITY.map((item, i) => (_jsxs("div", { className: "activity-item", children: [_jsx("span", { className: "activity-icon", style: { color: 'rgba(255,255,255,0.35)' }, children: item.icon }), _jsxs("div", { className: "activity-body", children: [_jsx("div", { className: "activity-text", children: item.text }), _jsx("div", { className: "activity-time", children: item.time })] })] }, i))), _jsx("hr", { className: "section-divider" }), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: [_jsx("button", { className: "btn btn--sm", onClick: () => setActiveView('Receipts'), children: "View Receipts" }), _jsx("button", { className: "btn btn--sm", onClick: () => setActiveView('Policies'), children: "Manage Policies" }), _jsx("button", { className: "btn btn--sm", onClick: () => setActiveView('World Model'), children: "Open World Model" })] })] })] })] })] }));
}
//# sourceMappingURL=Dashboard.js.map