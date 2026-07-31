// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Settings
// Neo4j, MCP, provider lanes, authority level, export/import.
// ──────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useAppStore } from '../store/app-store.js';
import {
  connectNeo4j,
  getNeo4jStatus,
  startMcpServer,
  stopMcpServer,
} from '../hooks/useTauri.js';
import type { AuthorityLevel } from '../types/index.js';

const AUTHORITY_LEVELS: Array<{ value: AuthorityLevel; label: string; desc: string }> = [
  { value: 'observe',    label: 'OBSERVE',    desc: 'Read-only — AI can only observe, never write' },
  { value: 'suggest',    label: 'SUGGEST',    desc: 'Propose actions only, human must approve all' },
  { value: 'confirm',    label: 'CONFIRM',    desc: 'Execute after one human confirmation per action' },
  { value: 'supervised', label: 'SUPERVISED', desc: 'Execute low-risk actions autonomously, confirm high-risk' },
  { value: 'autonomous', label: 'AUTONOMOUS', desc: 'Full autonomous execution — audit everything' },
];

interface ProviderLane {
  id: string;
  name: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

const DEFAULT_PROVIDERS: ProviderLane[] = [
  { id: 'claude', name: 'Anthropic Claude', apiKey: '', model: 'claude-opus-4-5', baseUrl: 'https://api.anthropic.com' },
  { id: 'openai', name: 'OpenAI',           apiKey: '', model: 'gpt-5',           baseUrl: 'https://api.openai.com' },
  { id: 'google', name: 'Google Gemini',    apiKey: '', model: 'gemini-2.5-pro', baseUrl: 'https://generativelanguage.googleapis.com' },
];

export default function SettingsPage() {
  const neo4jUri       = useAppStore((s) => s.neo4jUri);
  const neo4jUser      = useAppStore((s) => s.neo4jUser);
  const mcpPort        = useAppStore((s) => s.mcpPort);
  const mcpRunning     = useAppStore((s) => s.mcpRunning);
  const authorityLevel = useAppStore((s) => s.authorityLevel);
  const humanId        = useAppStore((s) => s.humanId);
  const setNeo4jUri       = useAppStore((s) => s.setNeo4jUri);
  const setNeo4jUser      = useAppStore((s) => s.setNeo4jUser);
  const setMcpPort        = useAppStore((s) => s.setMcpPort);
  const setMcpRunning     = useAppStore((s) => s.setMcpRunning);
  const setAuthorityLevel = useAppStore((s) => s.setAuthorityLevel);
  const setHumanId        = useAppStore((s) => s.setHumanId);
  const pushToast         = useAppStore((s) => s.pushToast);

  const [neo4jPassword, setNeo4jPassword] = useState('');
  const [testing, setTesting]             = useState(false);
  const [providers, setProviders]         = useState<ProviderLane[]>(DEFAULT_PROVIDERS);

  const handleTestNeo4j = async () => {
    setTesting(true);
    try {
      await connectNeo4j(neo4jUri, neo4jUser, neo4jPassword);
      const status = await getNeo4jStatus();
      pushToast(`Neo4j connected — ${status.node_count} nodes · v${status.version}`, 'success');
    } catch (e) {
      pushToast(`Connection failed: ${String(e)}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleMcpToggle = async () => {
    try {
      if (mcpRunning) {
        await stopMcpServer();
        setMcpRunning(false);
        pushToast('MCP server stopped', 'info');
      } else {
        const port = await startMcpServer(mcpPort);
        setMcpRunning(true);
        pushToast(`MCP server started on port ${port}`, 'success');
      }
    } catch (e) {
      pushToast(String(e), 'error');
    }
  };

  const updateProvider = (id: string, field: keyof ProviderLane, value: string) => {
    setProviders((ps) => ps.map((p) => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleExportWorldModel = () => {
    pushToast('Export world model — Neo4j must be connected', 'info');
  };

  const handleDangerReset = (action: string) => {
    if (!window.confirm(`Are you sure you want to: ${action}? This cannot be undone.`)) return;
    pushToast(`${action} — not yet implemented in this build`, 'error');
  };

  return (
    <>
      <div className="topbar">
        <span className="topbar__title">Settings</span>
      </div>

      <div className="content">
        {/* ── Neo4j ── */}
        <p className="section-title">Neo4j Connection</p>
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-row">
              <label className="form-label">Bolt URI</label>
              <input className="input" value={neo4jUri} onChange={(e) => setNeo4jUri(e.target.value)} placeholder="bolt://localhost:7687" />
            </div>
            <div className="form-row">
              <label className="form-label">Username</label>
              <input className="input" value={neo4jUser} onChange={(e) => setNeo4jUser(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Password</label>
              <input className="input" type="password" value={neo4jPassword} onChange={(e) => setNeo4jPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="form-row">
              <label className="form-label">Human ID</label>
              <input className="input" value={humanId} onChange={(e) => setHumanId(e.target.value)} placeholder="human:00001" />
            </div>
          </div>
          <button className="btn btn--primary btn--sm" onClick={handleTestNeo4j} disabled={testing}>
            {testing ? 'Connecting…' : 'Test Connection'}
          </button>
        </div>

        {/* ── MCP Server ── */}
        <p className="section-title" style={{ marginTop: 20 }}>MCP Server</p>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div className="form-row" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">Port</label>
              <input
                className="input"
                type="number"
                value={mcpPort}
                onChange={(e) => setMcpPort(Number(e.target.value))}
                style={{ width: 120 }}
              />
            </div>
            {mcpRunning && (
              <div style={{ flex: 1 }}>
                <p className="form-label">Endpoint</p>
                <code style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#2ecc71' }}>
                  http://127.0.0.1:{mcpPort}
                </code>
              </div>
            )}
          </div>
          <button
            className={`btn btn--sm ${mcpRunning ? 'btn--danger' : 'btn--primary'}`}
            onClick={handleMcpToggle}
          >
            {mcpRunning ? 'Stop MCP Server' : 'Start MCP Server'}
          </button>
        </div>

        {/* ── Authority Level ── */}
        <p className="section-title" style={{ marginTop: 20 }}>Authority Level</p>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AUTHORITY_LEVELS.map((level) => (
              <div
                key={level.value}
                onClick={() => setAuthorityLevel(level.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 10px', cursor: 'pointer',
                  border: `1px solid ${authorityLevel === level.value ? 'rgba(255,255,255,0.3)' : 'transparent'}`,
                  background: authorityLevel === level.value ? 'rgba(255,255,255,0.04)' : 'transparent',
                }}
              >
                <div style={{
                  width: 12, height: 12, border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: '50%', background: authorityLevel === level.value ? '#fff' : 'transparent',
                  flexShrink: 0,
                }} />
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)', marginRight: 8 }}>
                    {level.label}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{level.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Provider Lanes ── */}
        <p className="section-title" style={{ marginTop: 20 }}>Provider Lanes</p>
        {providers.map((provider) => (
          <div className="card" key={provider.id} style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{provider.name}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div className="form-row">
                <label className="form-label">API Key</label>
                <input
                  className="input" type="password"
                  value={provider.apiKey}
                  onChange={(e) => updateProvider(provider.id, 'apiKey', e.target.value)}
                  placeholder="sk-…"
                />
              </div>
              <div className="form-row">
                <label className="form-label">Model</label>
                <input
                  className="input"
                  value={provider.model}
                  onChange={(e) => updateProvider(provider.id, 'model', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Base URL</label>
                <input
                  className="input"
                  value={provider.baseUrl}
                  onChange={(e) => updateProvider(provider.id, 'baseUrl', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}

        {/* ── Export / Import ── */}
        <p className="section-title" style={{ marginTop: 20 }}>World Model Export / Import</p>
        <div className="card">
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--sm" onClick={handleExportWorldModel}>
              Export Full World Model JSON
            </button>
            <label className="btn btn--sm" style={{ cursor: 'pointer' }}>
              Import World Model JSON
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={() => pushToast('Import not yet implemented', 'info')} />
            </label>
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <p className="section-title" style={{ marginTop: 20, color: '#e74c3c' }}>Danger Zone</p>
        <div className="card" style={{ borderColor: 'rgba(231,76,60,0.2)' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn--danger btn--sm" onClick={() => handleDangerReset('Clear session history')}>
              Clear Session History
            </button>
            <button className="btn btn--danger btn--sm" onClick={() => handleDangerReset('Reset all policies')}>
              Reset Policies
            </button>
            <button className="btn btn--danger btn--sm" onClick={() => handleDangerReset('Full system reset')}>
              Full Reset
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
