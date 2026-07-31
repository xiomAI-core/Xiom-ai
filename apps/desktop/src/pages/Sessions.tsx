// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Sessions
// Provider session list, message history, recovery controls.
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store.js';
import {
  createSession,
  getSessionHistory,
  getSessionList,
} from '../hooks/useTauri.js';
import type { Message, SessionSummary } from '../types/index.js';

const PROVIDERS = [
  { id: 'claude-code', label: 'Claude Code',  icon: '◆' },
  { id: 'codex',       label: 'Codex',         icon: '○' },
  { id: 'gemini',      label: 'Gemini',         icon: '◇' },
  { id: 'grok',        label: 'Grok',           icon: '▷' },
  { id: 'custom',      label: 'Custom',         icon: '⚙' },
];

const CLI_COMMANDS: Record<string, string> = {
  'claude-code': 'claude --mcp-server http://127.0.0.1:54321',
  'codex':       'codex --mcp http://127.0.0.1:54321',
  'gemini':      'gemini --mcp-endpoint http://127.0.0.1:54321',
  'grok':        'grok connect --mcp http://127.0.0.1:54321',
  'custom':      'MCP_SERVER=http://127.0.0.1:54321 your-provider',
};

function SessionRow({
  session,
  selected,
  onSelect,
}: {
  session: SessionSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const provider = PROVIDERS.find((p) => p.id === session.provider);
  const date = new Date(session.started_at);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString();

  return (
    <tr onClick={onSelect} style={{ background: selected ? 'rgba(255,255,255,0.04)' : undefined }}>
      <td>
        <span style={{ marginRight: 6, opacity: 0.6 }}>{provider?.icon ?? '○'}</span>
        {provider?.label ?? session.provider}
      </td>
      <td style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--mono)' }}>
        {dateStr} {timeStr}
      </td>
      <td style={{ textAlign: 'center', fontFamily: 'var(--mono)' }}>
        {session.message_count}
      </td>
      <td>
        <span className={`badge ${session.status === 'active' ? 'badge--green' : 'badge--gray'}`}>
          {session.status}
        </span>
      </td>
      <td>
        {session.is_recoverable && (
          <span className="badge badge--blue">Recoverable</span>
        )}
      </td>
    </tr>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: '75%',
        background: isUser ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '8px 12px',
        fontSize: 12,
        lineHeight: 1.5,
      }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
          {msg.role} · {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

export default function Sessions() {
  const sessions          = useAppStore((s) => s.sessions);
  const selectedId        = useAppStore((s) => s.selectedSessionId);
  const setSessions       = useAppStore((s) => s.setSessions);
  const setSelectedId     = useAppStore((s) => s.setSelectedSessionId);
  const pushToast         = useAppStore((s) => s.pushToast);

  const [messages, setMessages]     = useState<Message[]>([]);
  const [provider, setProvider]     = useState('claude-code');
  const [starting, setStarting]     = useState(false);

  useEffect(() => {
    getSessionList()
      .then(setSessions)
      .catch(() => {});
  }, [setSessions]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
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
    } catch (e) {
      pushToast(`Failed to start session: ${String(e)}`, 'error');
    } finally {
      setStarting(false);
    }
  };

  const cliCmd = CLI_COMMANDS[provider] ?? '';

  return (
    <>
      <div className="topbar">
        <span className="topbar__title">Sessions</span>
        <div className="topbar__actions">
          <select
            className="select"
            style={{ width: 140 }}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
            ))}
          </select>
          <button className="btn btn--primary btn--sm" onClick={handleCreate} disabled={starting}>
            {starting ? 'Starting…' : '+ New Session'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── Session list ── */}
        <div style={{
          width: 380, borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* CLI bootstrap command */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              CLI Bootstrap
            </p>
            <code style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.7)' }}>
              {cliCmd}
            </code>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Started</th>
                  <th>Msgs</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 20 }}>
                      No sessions yet
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      selected={s.id === selectedId}
                      onSelect={() => setSelectedId(s.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Message history ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedId ? (
            <>
              <div style={{
                padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)' }}>
                  {selectedId}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  {messages.length} messages
                </span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {messages.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                    No messages yet
                  </p>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} msg={m} />)
                )}
              </div>
            </>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13,
            }}>
              Select a session to view messages
            </div>
          )}
        </div>
      </div>
    </>
  );
}
