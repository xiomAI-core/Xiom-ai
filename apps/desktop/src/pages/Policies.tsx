// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Policies
// View, create, and manage constitutional policies.
// ──────────────────────────────────────────────────────────────
import { useState } from 'react';
import type { PolicyRecord } from '../types/index.js';
import { useAppStore } from '../store/app-store.js';

const EFFECT_COLORS: Record<string, string> = {
  block:           '#e74c3c',
  require_approval:'#f1c40f',
  warn:            '#e67e22',
  allow:           '#2ecc71',
};

const MOCK_POLICIES: PolicyRecord[] = [
  {
    id: 'p1', name: 'No Bulk Email',
    description: 'Block email sends to more than 5 recipients',
    condition: "action.toolName === 'email.send' && action.toolInput.to.length > 5",
    effect: 'block', version: 2, approvedBy: 'human',
    createdAt: '2026-07-01T10:00:00Z', isActive: true,
  },
  {
    id: 'p2', name: 'Payment Approval',
    description: 'All USDG transfers require human approval',
    condition: "action.actionType.includes('payment')",
    effect: 'require_approval', version: 1, approvedBy: 'human',
    createdAt: '2026-07-15T14:00:00Z', isActive: true,
  },
  {
    id: 'p3', name: 'Autonomous Warning',
    description: 'Warn when operating at AUTONOMOUS tier',
    condition: "authorityLevel === 'autonomous'",
    effect: 'warn', version: 1, approvedBy: 'system',
    createdAt: '2026-07-20T09:00:00Z', isActive: true,
  },
];

interface PolicyEditorProps {
  // explicit union (not optional ?) to satisfy exactOptionalPropertyTypes
  policy: PolicyRecord | undefined;
  onSave: (p: Partial<PolicyRecord>) => void;
  onCancel: () => void;
}

function PolicyEditor({ policy, onSave, onCancel }: PolicyEditorProps) {
  const [name,      setName]      = useState(policy?.name ?? '');
  const [desc,      setDesc]      = useState(policy?.description ?? '');
  const [condition, setCondition] = useState(policy?.condition ?? '');
  const [effect,    setEffect]    = useState<PolicyRecord['effect']>(policy?.effect ?? 'warn');

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <p className="section-title" style={{ marginBottom: 16 }}>
        {policy ? `Edit Policy v${policy.version}` : 'New Policy'}
      </p>

      <div className="form-row">
        <label className="form-label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Policy name" />
      </div>

      <div className="form-row">
        <label className="form-label">Description</label>
        <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this policy does" />
      </div>

      <div className="form-row">
        <label className="form-label">Condition (safe JS expression)</label>
        <textarea
          className="input"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          rows={3}
          placeholder={`action.toolName === 'email.send' && action.toolInput.to.length > 5`}
          style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
        />
      </div>

      <div className="form-row">
        <label className="form-label">Effect</label>
        <select className="select" value={effect} onChange={(e) => setEffect(e.target.value as PolicyRecord['effect'])}>
          <option value="block">block — deny the operation</option>
          <option value="require_approval">require_approval — ask human first</option>
          <option value="warn">warn — log but allow</option>
          <option value="allow">allow — explicit permit</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          className="btn btn--primary btn--sm"
          onClick={() => onSave({ name, description: desc, condition, effect })}
        >
          Save Policy
        </button>
        <button className="btn btn--sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function Policies() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [policies, setPolicies] = useState<PolicyRecord[]>(MOCK_POLICIES);
  const [editing,  setEditing]  = useState<PolicyRecord | null | 'new'>(null);

  const handleSave = (data: Partial<PolicyRecord>) => {
    if (editing === 'new') {
      const newPolicy: PolicyRecord = {
        id:          `p${Date.now()}`,
        name:        data.name ?? 'Unnamed',
        description: data.description ?? '',
        condition:   data.condition ?? '',
        effect:      data.effect ?? 'warn',
        version:     1,
        approvedBy:  'human',
        createdAt:   new Date().toISOString(),
        isActive:    true,
      };
      setPolicies((p) => [...p, newPolicy]);
      pushToast(`Policy "${newPolicy.name}" created`, 'success');
    } else if (editing) {
      setPolicies((ps) =>
        ps.map((p) =>
          p.id === editing.id
            ? { ...p, ...data, version: p.version + 1 }
            : p
        )
      );
      pushToast(`Policy "${editing.name}" updated to v${editing.version + 1}`, 'success');
    }
    setEditing(null);
  };

  const toggleActive = (id: string) => {
    setPolicies((ps) => ps.map((p) => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  return (
    <>
      <div className="topbar">
        <span className="topbar__title">Policies</span>
        <div className="topbar__actions">
          <button className="btn btn--primary btn--sm" onClick={() => setEditing('new')}>
            + New Policy
          </button>
        </div>
      </div>

      <div className="content">
        {editing !== null && (
          <PolicyEditor
            policy={editing === 'new' ? undefined : editing}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        )}

        <p className="section-title">{policies.length} constitutional policies</p>

        {policies.map((policy) => (
          <div className="card" key={policy.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, marginRight: 10 }}>{policy.name}</span>
                <span className="badge" style={{ color: EFFECT_COLORS[policy.effect], borderColor: EFFECT_COLORS[policy.effect] }}>
                  {policy.effect}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>v{policy.version}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn--sm" onClick={() => setEditing(policy)}>Edit</button>
                <button
                  className="btn btn--sm"
                  style={{ color: policy.isActive ? '#2ecc71' : 'rgba(255,255,255,0.3)' }}
                  onClick={() => toggleActive(policy.id)}
                >
                  {policy.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{policy.description}</p>

            <div className="code">{policy.condition}</div>

            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
              Approved by {policy.approvedBy} · {new Date(policy.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
