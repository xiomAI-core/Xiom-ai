import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Policies
// View, create, and manage constitutional policies.
// ──────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useAppStore } from '../store/app-store.js';
const EFFECT_COLORS = {
    block: '#e74c3c',
    require_approval: '#f1c40f',
    warn: '#e67e22',
    allow: '#2ecc71',
};
const MOCK_POLICIES = [
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
function PolicyEditor({ policy, onSave, onCancel }) {
    const [name, setName] = useState(policy?.name ?? '');
    const [desc, setDesc] = useState(policy?.description ?? '');
    const [condition, setCondition] = useState(policy?.condition ?? '');
    const [effect, setEffect] = useState(policy?.effect ?? 'warn');
    return (_jsxs("div", { className: "card", style: { marginBottom: 20 }, children: [_jsx("p", { className: "section-title", style: { marginBottom: 16 }, children: policy ? `Edit Policy v${policy.version}` : 'New Policy' }), _jsxs("div", { className: "form-row", children: [_jsx("label", { className: "form-label", children: "Name" }), _jsx("input", { className: "input", value: name, onChange: (e) => setName(e.target.value), placeholder: "Policy name" })] }), _jsxs("div", { className: "form-row", children: [_jsx("label", { className: "form-label", children: "Description" }), _jsx("input", { className: "input", value: desc, onChange: (e) => setDesc(e.target.value), placeholder: "What this policy does" })] }), _jsxs("div", { className: "form-row", children: [_jsx("label", { className: "form-label", children: "Condition (safe JS expression)" }), _jsx("textarea", { className: "input", value: condition, onChange: (e) => setCondition(e.target.value), rows: 3, placeholder: `action.toolName === 'email.send' && action.toolInput.to.length > 5`, style: { fontFamily: 'var(--mono)', fontSize: 12 } })] }), _jsxs("div", { className: "form-row", children: [_jsx("label", { className: "form-label", children: "Effect" }), _jsxs("select", { className: "select", value: effect, onChange: (e) => setEffect(e.target.value), children: [_jsx("option", { value: "block", children: "block \u2014 deny the operation" }), _jsx("option", { value: "require_approval", children: "require_approval \u2014 ask human first" }), _jsx("option", { value: "warn", children: "warn \u2014 log but allow" }), _jsx("option", { value: "allow", children: "allow \u2014 explicit permit" })] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 8 }, children: [_jsx("button", { className: "btn btn--primary btn--sm", onClick: () => onSave({ name, description: desc, condition, effect }), children: "Save Policy" }), _jsx("button", { className: "btn btn--sm", onClick: onCancel, children: "Cancel" })] })] }));
}
export default function Policies() {
    const pushToast = useAppStore((s) => s.pushToast);
    const [policies, setPolicies] = useState(MOCK_POLICIES);
    const [editing, setEditing] = useState(null);
    const handleSave = (data) => {
        if (editing === 'new') {
            const newPolicy = {
                id: `p${Date.now()}`,
                name: data.name ?? 'Unnamed',
                description: data.description ?? '',
                condition: data.condition ?? '',
                effect: data.effect ?? 'warn',
                version: 1,
                approvedBy: 'human',
                createdAt: new Date().toISOString(),
                isActive: true,
            };
            setPolicies((p) => [...p, newPolicy]);
            pushToast(`Policy "${newPolicy.name}" created`, 'success');
        }
        else if (editing) {
            setPolicies((ps) => ps.map((p) => p.id === editing.id
                ? { ...p, ...data, version: p.version + 1 }
                : p));
            pushToast(`Policy "${editing.name}" updated to v${editing.version + 1}`, 'success');
        }
        setEditing(null);
    };
    const toggleActive = (id) => {
        setPolicies((ps) => ps.map((p) => p.id === id ? { ...p, isActive: !p.isActive } : p));
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "topbar", children: [_jsx("span", { className: "topbar__title", children: "Policies" }), _jsx("div", { className: "topbar__actions", children: _jsx("button", { className: "btn btn--primary btn--sm", onClick: () => setEditing('new'), children: "+ New Policy" }) })] }), _jsxs("div", { className: "content", children: [editing !== null && (_jsx(PolicyEditor, { policy: editing === 'new' ? undefined : editing, onSave: handleSave, onCancel: () => setEditing(null) })), _jsxs("p", { className: "section-title", children: [policies.length, " constitutional policies"] }), policies.map((policy) => (_jsxs("div", { className: "card", style: { marginBottom: 12 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }, children: [_jsxs("div", { children: [_jsx("span", { style: { fontSize: 13, fontWeight: 600, marginRight: 10 }, children: policy.name }), _jsx("span", { className: "badge", style: { color: EFFECT_COLORS[policy.effect], borderColor: EFFECT_COLORS[policy.effect] }, children: policy.effect }), _jsxs("span", { style: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }, children: ["v", policy.version] })] }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("button", { className: "btn btn--sm", onClick: () => setEditing(policy), children: "Edit" }), _jsx("button", { className: "btn btn--sm", style: { color: policy.isActive ? '#2ecc71' : 'rgba(255,255,255,0.3)' }, onClick: () => toggleActive(policy.id), children: policy.isActive ? 'Active' : 'Inactive' })] })] }), _jsx("p", { style: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }, children: policy.description }), _jsx("div", { className: "code", children: policy.condition }), _jsxs("p", { style: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 8 }, children: ["Approved by ", policy.approvedBy, " \u00B7 ", new Date(policy.createdAt).toLocaleDateString()] })] }, policy.id)))] })] }));
}
//# sourceMappingURL=Policies.js.map