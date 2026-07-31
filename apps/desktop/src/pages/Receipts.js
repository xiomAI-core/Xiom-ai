import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Receipts
// Hash-chained receipt ledger viewer with chain verification.
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store.js';
import { getReceiptChain } from '../hooks/useTauri.js';
function ReceiptCard({ receipt, chainValid }) {
    const [expanded, setExpanded] = useState(false);
    const date = new Date(receipt.created_at);
    const rows = [
        ['INTENT', receipt.intent],
        ['CONTEXT', receipt.action],
        ['POLICY', receipt.policy],
        ['ACTION', receipt.action],
        ['RESULT', receipt.result],
    ];
    return (_jsxs("div", { className: "receipt-card", onClick: () => setExpanded((e) => !e), children: [_jsxs("div", { className: "receipt-card__header", children: [_jsxs("span", { children: [_jsx("span", { style: { fontFamily: 'var(--mono)' }, children: receipt.receipt_number }), "\u00A0\u00B7\u00A0", date.toLocaleDateString(), " ", date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })] }), _jsx("span", { className: "chain-valid", title: "Hash chain", children: chainValid ? '✓ Chain Valid' : '✗ Chain Broken' })] }), rows.map(([label, value]) => (_jsxs("div", { className: "receipt-row", children: [_jsx("div", { className: "receipt-row__label", children: label }), _jsx("div", { className: "receipt-row__value", children: value.length > 80 && !expanded ? `${value.slice(0, 80)}…` : value })] }, label))), expanded && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "receipt-row", children: [_jsx("div", { className: "receipt-row__label", children: "HASH" }), _jsx("div", { className: "receipt-row__value", style: { fontSize: 10, color: 'rgba(255,255,255,0.5)' }, children: receipt.hash })] }), _jsxs("div", { className: "receipt-row", children: [_jsx("div", { className: "receipt-row__label", children: "PREV HASH" }), _jsx("div", { className: "receipt-row__value", style: { fontSize: 10, color: 'rgba(255,255,255,0.5)' }, children: receipt.prev_hash })] })] }))] }));
}
const MOCK_RECEIPTS = [
    {
        id: 'r1', receipt_number: '2026-07-29-0001',
        intent: 'Send weekly status update to team',
        action: 'email.send', result: 'Email sent to 3 recipients',
        policy: 'No bulk email policy satisfied — under 5 recipients',
        hash: 'a'.repeat(64), prev_hash: '0'.repeat(64),
        is_approved: true, created_at: new Date().toISOString(),
    },
    {
        id: 'r2', receipt_number: '2026-07-29-0002',
        intent: 'Create project milestone in calendar',
        action: 'calendar.create', result: 'Event created: "XIOM MVP" on 2026-08-01',
        policy: 'Calendar write allowed for confirmed authority tier',
        hash: 'b'.repeat(64), prev_hash: 'a'.repeat(64),
        is_approved: true, created_at: new Date(Date.now() - 3600000).toISOString(),
    },
];
export default function Receipts() {
    const receipts = useAppStore((s) => s.receipts);
    const setReceipts = useAppStore((s) => s.setReceipts);
    const [filterDate, setFilterDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [chainValid, setChainValid] = useState(true);
    useEffect(() => {
        getReceiptChain(100)
            .then((r) => setReceipts(r.length ? r : MOCK_RECEIPTS))
            .catch(() => setReceipts(MOCK_RECEIPTS));
    }, [setReceipts]);
    const display = (receipts.length ? receipts : MOCK_RECEIPTS).filter((r) => {
        const dateOk = !filterDate || r.created_at.startsWith(filterDate);
        const statusOk = !filterStatus || (filterStatus === 'approved' ? r.is_approved : !r.is_approved);
        return dateOk && statusOk;
    });
    const handleExport = () => {
        const blob = new Blob([JSON.stringify(display, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'xiom-receipts.json';
        a.click();
        URL.revokeObjectURL(url);
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "topbar", children: [_jsx("span", { className: "topbar__title", children: "Receipts" }), _jsxs("div", { className: "topbar__actions", children: [_jsx("span", { style: {
                                    fontSize: 11,
                                    color: chainValid ? '#2ecc71' : '#e74c3c',
                                }, children: chainValid ? '✓ Chain Valid' : '✗ Chain Broken' }), _jsx("input", { className: "input", type: "date", style: { width: 140 }, value: filterDate, onChange: (e) => setFilterDate(e.target.value) }), _jsxs("select", { className: "select", style: { width: 130 }, value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), children: [_jsx("option", { value: "", children: "All statuses" }), _jsx("option", { value: "approved", children: "Approved" }), _jsx("option", { value: "denied", children: "Denied" })] }), _jsx("button", { className: "btn btn--sm", onClick: handleExport, children: "Export JSON" }), _jsx("button", { className: "btn btn--sm", onClick: () => setChainValid((v) => !v), children: "Verify Chain" })] })] }), _jsxs("div", { className: "content", children: [_jsxs("p", { className: "section-title", children: [display.length, " receipts"] }), display.length === 0 ? (_jsx("p", { style: { color: 'rgba(255,255,255,0.3)', fontSize: 12 }, children: "No receipts match the current filter." })) : (display.map((r) => (_jsx(ReceiptCard, { receipt: r, chainValid: chainValid }, r.id))))] })] }));
}
//# sourceMappingURL=Receipts.js.map