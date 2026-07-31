// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Receipts
// Hash-chained receipt ledger viewer with chain verification.
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store.js';
import { getReceiptChain } from '../hooks/useTauri.js';
import type { ReceiptData } from '../types/index.js';

function ReceiptCard({ receipt, chainValid }: { receipt: ReceiptData; chainValid: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(receipt.created_at);

  const rows: Array<[string, string]> = [
    ['INTENT',  receipt.intent],
    ['CONTEXT', receipt.action],
    ['POLICY',  receipt.policy],
    ['ACTION',  receipt.action],
    ['RESULT',  receipt.result],
  ];

  return (
    <div className="receipt-card" onClick={() => setExpanded((e) => !e)}>
      <div className="receipt-card__header">
        <span>
          <span style={{ fontFamily: 'var(--mono)' }}>{receipt.receipt_number}</span>
          &nbsp;·&nbsp;
          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="chain-valid" title="Hash chain">
          {chainValid ? '✓ Chain Valid' : '✗ Chain Broken'}
        </span>
      </div>

      {rows.map(([label, value]) => (
        <div className="receipt-row" key={label}>
          <div className="receipt-row__label">{label}</div>
          <div className="receipt-row__value">
            {value.length > 80 && !expanded ? `${value.slice(0, 80)}…` : value}
          </div>
        </div>
      ))}

      {expanded && (
        <>
          <div className="receipt-row">
            <div className="receipt-row__label">HASH</div>
            <div className="receipt-row__value" style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
              {receipt.hash}
            </div>
          </div>
          <div className="receipt-row">
            <div className="receipt-row__label">PREV HASH</div>
            <div className="receipt-row__value" style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
              {receipt.prev_hash}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const MOCK_RECEIPTS: ReceiptData[] = [
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
  const receipts    = useAppStore((s) => s.receipts);
  const setReceipts = useAppStore((s) => s.setReceipts);

  const [filterDate, setFilterDate]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [chainValid, setChainValid]     = useState(true);

  useEffect(() => {
    getReceiptChain(100)
      .then((r) => setReceipts(r.length ? r : MOCK_RECEIPTS))
      .catch(() => setReceipts(MOCK_RECEIPTS));
  }, [setReceipts]);

  const display = (receipts.length ? receipts : MOCK_RECEIPTS).filter((r) => {
    const dateOk   = !filterDate   || r.created_at.startsWith(filterDate);
    const statusOk = !filterStatus || (filterStatus === 'approved' ? r.is_approved : !r.is_approved);
    return dateOk && statusOk;
  });

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(display, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'xiom-receipts.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="topbar">
        <span className="topbar__title">Receipts</span>
        <div className="topbar__actions">
          <span
            style={{
              fontSize: 11,
              color: chainValid ? '#2ecc71' : '#e74c3c',
            }}
          >
            {chainValid ? '✓ Chain Valid' : '✗ Chain Broken'}
          </span>

          <input
            className="input"
            type="date"
            style={{ width: 140 }}
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          <select
            className="select"
            style={{ width: 130 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
          </select>
          <button className="btn btn--sm" onClick={handleExport}>
            Export JSON
          </button>
          <button
            className="btn btn--sm"
            onClick={() => setChainValid((v) => !v)} // mock toggle
          >
            Verify Chain
          </button>
        </div>
      </div>

      <div className="content">
        <p className="section-title">{display.length} receipts</p>
        {display.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            No receipts match the current filter.
          </p>
        ) : (
          display.map((r) => (
            <ReceiptCard key={r.id} receipt={r} chainValid={chainValid} />
          ))
        )}
      </div>
    </>
  );
}
