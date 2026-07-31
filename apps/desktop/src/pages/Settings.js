import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Settings
// Neo4j, MCP, provider lanes, authority level, export/import.
// ──────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useAppStore } from '../store/app-store.js';
import { connectNeo4j, getNeo4jStatus, startMcpServer, stopMcpServer, } from '../hooks/useTauri.js';
const AUTHORITY_LEVELS = [
    { value: 'observe', label: 'OBSERVE', desc: 'Read-only — AI can only observe, never write' },
    { value: 'suggest', label: 'SUGGEST', desc: 'Propose actions only, human must approve all' },
    { value: 'confirm', label: 'CONFIRM', desc: 'Execute after one human confirmation per action' },
    { value: 'supervised', label: 'SUPERVISED', desc: 'Execute low-risk actions autonomously, confirm high-risk' },
    { value: 'autonomous', label: 'AUTONOMOUS', desc: 'Full autonomous execution — audit everything' },
];
const DEFAULT_PROVIDERS = [
    { id: 'claude', name: 'Anthropic Claude', apiKey: '', model: 'claude-opus-4-5', baseUrl: 'https://api.anthropic.com' },
    { id: 'openai', name: 'OpenAI', apiKey: '', model: 'gpt-5', baseUrl: 'https://api.openai.com' },
    { id: 'google', name: 'Google Gemini', apiKey: '', model: 'gemini-2.5-pro', baseUrl: 'https://generativelanguage.googleapis.com' },
];
export default function SettingsPage() {
    const neo4jUri = useAppStore((s) => s.neo4jUri);
    const neo4jUser = useAppStore((s) => s.neo4jUser);
    const mcpPort = useAppStore((s) => s.mcpPort);
    const mcpRunning = useAppStore((s) => s.mcpRunning);
    const authorityLevel = useAppStore((s) => s.authorityLevel);
    const humanId = useAppStore((s) => s.humanId);
    const setNeo4jUri = useAppStore((s) => s.setNeo4jUri);
    const setNeo4jUser = useAppStore((s) => s.setNeo4jUser);
    const setMcpPort = useAppStore((s) => s.setMcpPort);
    const setMcpRunning = useAppStore((s) => s.setMcpRunning);
    const setAuthorityLevel = useAppStore((s) => s.setAuthorityLevel);
    const setHumanId = useAppStore((s) => s.setHumanId);
    const pushToast = useAppStore((s) => s.pushToast);
    const [neo4jPassword, setNeo4jPassword] = useState('');
    const [testing, setTesting] = useState(false);
    const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
    const handleTestNeo4j = async () => {
        setTesting(true);
        try {
            await connectNeo4j(neo4jUri, neo4jUser, neo4jPassword);
            const status = await getNeo4jStatus();
            pushToast(`Neo4j connected — ${status.node_count} nodes · v${status.version}`, 'success');
        }
        catch (e) {
            pushToast(`Connection failed: ${String(e)}`, 'error');
        }
        finally {
            setTesting(false);
        }
    };
    const handleMcpToggle = async () => {
        try {
            if (mcpRunning) {
                await stopMcpServer();
                setMcpRunning(false);
                pushToast('MCP server stopped', 'info');
            }
            else {
                const port = await startMcpServer(mcpPort);
                setMcpRunning(true);
                pushToast(`MCP server started on port ${port}`, 'success');
            }
        }
        catch (e) {
            pushToast(String(e), 'error');
        }
    };
    const updateProvider = (id, field, value) => {
        setProviders((ps) => ps.map((p) => p.id === id ? { ...p, [field]: value } : p));
    };
    const handleExportWorldModel = () => {
        pushToast('Export world model — Neo4j must be connected', 'info');
    };
    const handleDangerReset = (action) => {
        if (!window.confirm(`Are you sure you want to: ${action}? This cannot be undone.`))
            return;
        pushToast(`${action} — not yet implemented in this build`, 'error');
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "topbar", children: _jsx("span", { className: "topbar__title", children: "Settings" }) }), _jsxs("div", { className: "content", children: [_jsx("p", { className: "section-title", children: "Neo4j Connection" }), _jsxs("div", { className: "card", children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }, children: [_jsxs("div", { className: "form-row", children: [_jsx("label", { className: "form-label", children: "Bolt URI" }), _jsx("input", { className: "input", value: neo4jUri, onChange: (e) => setNeo4jUri(e.target.value), placeholder: "bolt://localhost:7687" })] }), _jsxs("div", { className: "form-row", children: [_jsx("label", { className: "form-label", children: "Username" }), _jsx("input", { className: "input", value: neo4jUser, onChange: (e) => setNeo4jUser(e.target.value) })] }), _jsxs("div", { className: "form-row", children: [_jsx("label", { className: "form-label", children: "Password" }), _jsx("input", { className: "input", type: "password", value: neo4jPassword, onChange: (e) => setNeo4jPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsxs("div", { className: "form-row", children: [_jsx("label", { className: "form-label", children: "Human ID" }), _jsx("input", { className: "input", value: humanId, onChange: (e) => setHumanId(e.target.value), placeholder: "human:00001" })] })] }), _jsx("button", { className: "btn btn--primary btn--sm", onClick: handleTestNeo4j, disabled: testing, children: testing ? 'Connecting…' : 'Test Connection' })] }), _jsx("p", { className: "section-title", style: { marginTop: 20 }, children: "MCP Server" }), _jsxs("div", { className: "card", children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }, children: [_jsxs("div", { className: "form-row", style: { marginBottom: 0, flex: 1 }, children: [_jsx("label", { className: "form-label", children: "Port" }), _jsx("input", { className: "input", type: "number", value: mcpPort, onChange: (e) => setMcpPort(Number(e.target.value)), style: { width: 120 } })] }), mcpRunning && (_jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { className: "form-label", children: "Endpoint" }), _jsxs("code", { style: { fontSize: 11, fontFamily: 'var(--mono)', color: '#2ecc71' }, children: ["http://127.0.0.1:", mcpPort] })] }))] }), _jsx("button", { className: `btn btn--sm ${mcpRunning ? 'btn--danger' : 'btn--primary'}`, onClick: handleMcpToggle, children: mcpRunning ? 'Stop MCP Server' : 'Start MCP Server' })] }), _jsx("p", { className: "section-title", style: { marginTop: 20 }, children: "Authority Level" }), _jsx("div", { className: "card", children: _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: AUTHORITY_LEVELS.map((level) => (_jsxs("div", { onClick: () => setAuthorityLevel(level.value), style: {
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '8px 10px', cursor: 'pointer',
                                    border: `1px solid ${authorityLevel === level.value ? 'rgba(255,255,255,0.3)' : 'transparent'}`,
                                    background: authorityLevel === level.value ? 'rgba(255,255,255,0.04)' : 'transparent',
                                }, children: [_jsx("div", { style: {
                                            width: 12, height: 12, border: '1px solid rgba(255,255,255,0.4)',
                                            borderRadius: '50%', background: authorityLevel === level.value ? '#fff' : 'transparent',
                                            flexShrink: 0,
                                        } }), _jsxs("div", { children: [_jsx("span", { style: { fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)', marginRight: 8 }, children: level.label }), _jsx("span", { style: { fontSize: 11, color: 'rgba(255,255,255,0.4)' }, children: level.desc })] })] }, level.value))) }) }), _jsx("p", { className: "section-title", style: { marginTop: 20 }, children: "Provider Lanes" }), providers.map((provider) => (_jsxs("div", { className: "card", style: { marginBottom: 8 }, children: [_jsx("p", { style: { fontSize: 12, fontWeight: 600, marginBottom: 10 }, children: provider.name }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }, children: [_jsxs("div", { className: "form-row", children: [_jsx("label", { className: "form-label", children: "API Key" }), _jsx("input", { className: "input", type: "password", value: provider.apiKey, onChange: (e) => updateProvider(provider.id, 'apiKey', e.target.value), placeholder: "sk-\u2026" })] }), _jsxs("div", { className: "form-row", children: [_jsx("label", { className: "form-label", children: "Model" }), _jsx("input", { className: "input", value: provider.model, onChange: (e) => updateProvider(provider.id, 'model', e.target.value) })] }), _jsxs("div", { className: "form-row", children: [_jsx("label", { className: "form-label", children: "Base URL" }), _jsx("input", { className: "input", value: provider.baseUrl, onChange: (e) => updateProvider(provider.id, 'baseUrl', e.target.value) })] })] })] }, provider.id))), _jsx("p", { className: "section-title", style: { marginTop: 20 }, children: "World Model Export / Import" }), _jsx("div", { className: "card", children: _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsx("button", { className: "btn btn--sm", onClick: handleExportWorldModel, children: "Export Full World Model JSON" }), _jsxs("label", { className: "btn btn--sm", style: { cursor: 'pointer' }, children: ["Import World Model JSON", _jsx("input", { type: "file", accept: ".json", style: { display: 'none' }, onChange: () => pushToast('Import not yet implemented', 'info') })] })] }) }), _jsx("p", { className: "section-title", style: { marginTop: 20, color: '#e74c3c' }, children: "Danger Zone" }), _jsx("div", { className: "card", style: { borderColor: 'rgba(231,76,60,0.2)' }, children: _jsxs("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap' }, children: [_jsx("button", { className: "btn btn--danger btn--sm", onClick: () => handleDangerReset('Clear session history'), children: "Clear Session History" }), _jsx("button", { className: "btn btn--danger btn--sm", onClick: () => handleDangerReset('Reset all policies'), children: "Reset Policies" }), _jsx("button", { className: "btn btn--danger btn--sm", onClick: () => handleDangerReset('Full system reset'), children: "Full Reset" })] }) })] })] }));
}
//# sourceMappingURL=Settings.js.map