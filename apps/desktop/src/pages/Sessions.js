import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Sessions
// Provider session list, message history, recovery controls.
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store.js';
import { createSession, getSessionHistory, getSessionList, } from '../hooks/useTauri.js';
const PROVIDERS = [
    { id: 'claude-code', label: 'Claude Code', icon: '◆' },
    { id: 'codex', label: 'Codex', icon: '○' },
    { id: 'gemini', label: 'Gemini', icon: '◇' },
    { id: 'grok', label: 'Grok', icon: '▷' },
    { id: 'custom', label: 'Custom', icon: '⚙' },
];
const CLI_COMMANDS = {
    'claude-code': 'claude --mcp-server http://127.0.0.1:54321',
    'codex': 'codex --mcp http://127.0.0.1:54321',
    'gemini': 'gemini --mcp-endpoint http://127.0.0.1:54321',
    'grok': 'grok connect --mcp http://127.0.0.1:54321',
    'custom': 'MCP_SERVER=http://127.0.0.1:54321 your-provider',
};
function SessionRow({ session, selected, onSelect, }) {
    const provider = PROVIDERS.find((p) => p.id === session.provider);
    const date = new Date(session.started_at);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString();
    return (_jsxs("tr", { onClick: onSelect, style: { background: selected ? 'rgba(255,255,255,0.04)' : undefined }, children: [_jsxs("td", { children: [_jsx("span", { style: { marginRight: 6, opacity: 0.6 }, children: provider?.icon ?? '○' }), provider?.label ?? session.provider] }), _jsxs("td", { style: { color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--mono)' }, children: [dateStr, " ", timeStr] }), _jsx("td", { style: { textAlign: 'center', fontFamily: 'var(--mono)' }, children: session.message_count }), _jsx("td", { children: _jsx("span", { className: `badge ${session.status === 'active' ? 'badge--green' : 'badge--gray'}`, children: session.status }) }), _jsx("td", { children: session.is_recoverable && (_jsx("span", { className: "badge badge--blue", children: "Recoverable" })) })] }));
}
function MessageBubble({ msg }) {
    const isUser = msg.role === 'user';
    return (_jsx("div", { style: {
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginBottom: 10,
        }, children: _jsxs("div", { style: {
                maxWidth: '75%',
                background: isUser ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '8px 12px',
                fontSize: 12,
                lineHeight: 1.5,
            }, children: [_jsxs("div", { style: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }, children: [msg.role, " \u00B7 ", new Date(msg.timestamp).toLocaleTimeString()] }), _jsx("div", { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' }, children: msg.content })] }) }));
}
export default function Sessions() {
    const sessions = useAppStore((s) => s.sessions);
    const selectedId = useAppStore((s) => s.selectedSessionId);
    const setSessions = useAppStore((s) => s.setSessions);
    const setSelectedId = useAppStore((s) => s.setSelectedSessionId);
    const pushToast = useAppStore((s) => s.pushToast);
    const [messages, setMessages] = useState([]);
    const [provider, setProvider] = useState('claude-code');
    const [starting, setStarting] = useState(false);
    useEffect(() => {
        getSessionList()
            .then(setSessions)
            .catch(() => { });
    }, [setSessions]);
    useEffect(() => {
        if (!selectedId) {
            setMessages([]);
            return;
        }
        getSessionHistory(selectedId, 100)
            .then(setMessages)
            .catch(() => setMessages([]));
    }, [selectedId]);
    const handleCreate = async () => {
        setStarting(true);
        try {
            const id = await createSession(provider);
            pushToast(`Session started: ${id.slice(0, 8)}…`, 'success');
            const updated = await getSessionList();
            setSessions(updated);
            setSelectedId(id);
        }
        catch (e) {
            pushToast(`Failed to start session: ${String(e)}`, 'error');
        }
        finally {
            setStarting(false);
        }
    };
    const cliCmd = CLI_COMMANDS[provider] ?? '';
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "topbar", children: [_jsx("span", { className: "topbar__title", children: "Sessions" }), _jsxs("div", { className: "topbar__actions", children: [_jsx("select", { className: "select", style: { width: 140 }, value: provider, onChange: (e) => setProvider(e.target.value), children: PROVIDERS.map((p) => (_jsxs("option", { value: p.id, children: [p.icon, " ", p.label] }, p.id))) }), _jsx("button", { className: "btn btn--primary btn--sm", onClick: handleCreate, disabled: starting, children: starting ? 'Starting…' : '+ New Session' })] })] }), _jsxs("div", { style: { display: 'flex', flex: 1, overflow: 'hidden' }, children: [_jsxs("div", { style: {
                            width: 380, borderRight: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        }, children: [_jsxs("div", { style: {
                                    padding: '10px 16px',
                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                    background: 'rgba(255,255,255,0.02)',
                                }, children: [_jsx("p", { style: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }, children: "CLI Bootstrap" }), _jsx("code", { style: { fontSize: 11, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.7)' }, children: cliCmd })] }), _jsx("div", { style: { flex: 1, overflowY: 'auto' }, children: _jsxs("table", { className: "data-table", style: { fontSize: 12 }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Provider" }), _jsx("th", { children: "Started" }), _jsx("th", { children: "Msgs" }), _jsx("th", { children: "Status" }), _jsx("th", {})] }) }), _jsx("tbody", { children: sessions.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, style: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 20 }, children: "No sessions yet" }) })) : (sessions.map((s) => (_jsx(SessionRow, { session: s, selected: s.id === selectedId, onSelect: () => setSelectedId(s.id) }, s.id)))) })] }) })] }), _jsx("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }, children: selectedId ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                        padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }, children: [_jsx("span", { style: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)' }, children: selectedId }), _jsxs("span", { style: { fontSize: 11, color: 'rgba(255,255,255,0.3)' }, children: [messages.length, " messages"] })] }), _jsx("div", { style: { flex: 1, overflowY: 'auto', padding: '16px 20px' }, children: messages.length === 0 ? (_jsx("p", { style: { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginTop: 40 }, children: "No messages yet" })) : (messages.map((m) => _jsx(MessageBubble, { msg: m }, m.id))) })] })) : (_jsx("div", { style: {
                                flex: 1, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13,
                            }, children: "Select a session to view messages" })) })] })] }));
}
//# sourceMappingURL=Sessions.js.map