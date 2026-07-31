// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Dashboard
// Live stats, governance loop, quick actions, activity feed.
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store.js';
import { getActiveGoals, getWorldModelProjection, getAppHealth } from '../hooks/useTauri.js';
import type { GoalData } from '../types/index.js';

const GOV_PHASES = ['Observe', 'Decide', 'Act', 'Verify', 'Evolve'];

const MOCK_ACTIVITY = [
  { icon: '✓', text: 'Guardian check passed for email.send', time: '2m ago' },
  { icon: '⊞', text: 'Receipt #2026-07-29-0001 issued', time: '4m ago' },
  { icon: '⬡', text: 'World model updated — 3 new facts', time: '12m ago' },
  { icon: '⊛', text: 'Policy "No bulk email" enforced', time: '31m ago' },
  { icon: '◈', text: 'Session claude-code-001 started', time: '1h ago' },
];

function GoalRow({ goal }: { goal: GoalData }) {
  const pct = Math.round(goal.progress * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12 }}>{goal.name}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{pct}%</span>
      </div>
      <div className="progress">
        <div className="progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const projection     = useAppStore((s) => s.projection);
  const health         = useAppStore((s) => s.health);
  const goals          = useAppStore((s) => s.goals);
  const setProjection  = useAppStore((s) => s.setProjection);
  const setGoals       = useAppStore((s) => s.setGoals);
  const setHealth      = useAppStore((s) => s.setHealth);
  const pushToast      = useAppStore((s) => s.pushToast);
  const setActiveView  = useAppStore((s) => s.setActiveView);

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
      } catch {
        // dev mode / no Tauri — ignore
      } finally {
        setLoading(false);
      }
    };
    void fetch();
  }, [setProjection, setGoals, setHealth]);

  const nodeCount    = projection?.node_count    ?? 0;
  const goalCount    = projection?.active_goal_count    ?? goals.length;
  const sessionCount = health?.session_count ?? 0;
  const pendingCount = 0; // would come from pending actions query

  return (
    <>
      <div className="topbar">
        <span className="topbar__title">Dashboard</span>
        <div className="topbar__actions">
          <button className="btn btn--sm" onClick={() => setActiveView('Sessions')}>
            + New Session
          </button>
          <button
            className="btn btn--sm"
            onClick={() => pushToast('Guardian check triggered', 'info')}
          >
            Run Guardian Check
          </button>
        </div>
      </div>

      <div className="content">
        {loading && (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 16 }}>
            Fetching live data…
          </p>
        )}

        {/* ── Stats ── */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card__value" style={{ color: '#4a90d9' }}>{nodeCount}</div>
            <div className="stat-card__label">Graph Nodes</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value" style={{ color: '#2ecc71' }}>{goalCount}</div>
            <div className="stat-card__label">Active Goals</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{sessionCount}</div>
            <div className="stat-card__label">Sessions Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value" style={{ color: '#f1c40f' }}>{pendingCount}</div>
            <div className="stat-card__label">Pending Actions</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* ── Left column ── */}
          <div>
            {/* Governance Loop */}
            <p className="section-title">Governance Loop</p>
            <div className="gov-loop" style={{ marginBottom: 20 }}>
              {GOV_PHASES.map((phase, i) => (
                <div
                  key={phase}
                  className={`gov-phase${i === activePhase ? ' active' : ''}`}
                  onClick={() => setActivePhase(i)}
                  style={{ cursor: 'pointer' }}
                >
                  {phase}
                </div>
              ))}
            </div>

            {/* Active Goals */}
            <p className="section-title">Active Goals</p>
            {goals.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                No active goals — connect to Neo4j to load world model.
              </p>
            ) : (
              goals.slice(0, 5).map((g) => <GoalRow key={g.id} goal={g} />)
            )}
          </div>

          {/* ── Right column ── */}
          <div>
            {/* Provider Status */}
            <p className="section-title">Provider Lanes</p>
            <div className="card" style={{ marginBottom: 12 }}>
              {[
                { name: 'Claude Code', icon: '◆', connected: false },
                { name: 'OpenAI Codex', icon: '○', connected: false },
                { name: 'Gemini', icon: '◇', connected: false },
              ].map((p) => (
                <div
                  key={p.name}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{ fontSize: 12 }}>
                    <span style={{ marginRight: 8, opacity: 0.5 }}>{p.icon}</span>
                    {p.name}
                  </span>
                  <span
                    className={`badge ${p.connected ? 'badge--green' : 'badge--gray'}`}
                  >
                    {p.connected ? 'Connected' : 'Idle'}
                  </span>
                </div>
              ))}
            </div>

            {/* Activity Feed */}
            <p className="section-title">Recent Activity</p>
            {MOCK_ACTIVITY.map((item, i) => (
              <div key={i} className="activity-item">
                <span className="activity-icon" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {item.icon}
                </span>
                <div className="activity-body">
                  <div className="activity-text">{item.text}</div>
                  <div className="activity-time">{item.time}</div>
                </div>
              </div>
            ))}

            {/* Quick Actions */}
            <hr className="section-divider" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn--sm" onClick={() => setActiveView('Receipts')}>
                View Receipts
              </button>
              <button className="btn btn--sm" onClick={() => setActiveView('Policies')}>
                Manage Policies
              </button>
              <button className="btn btn--sm" onClick={() => setActiveView('World Model')}>
                Open World Model
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
