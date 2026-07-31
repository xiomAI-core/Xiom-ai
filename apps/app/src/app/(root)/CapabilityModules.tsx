'use client'
import { useState } from 'react'

interface Module {
  n: string
  name: string
  status: 'Live' | 'In build'
  what: string
  how: string
  today: string
  next: string
}

const MODULES: Module[] = [
  {
    n: '01',
    name: 'World Model',
    status: 'Live',
    what: 'Living Neo4j graph of your context, goals, facts, policies, and relationships',
    how: 'Operators update the graph via Guardian-approved writes. AI reads on every session.',
    today: 'Goal tracking, fact storage, policy enforcement',
    next: 'Temporal versioning, semantic similarity search',
  },
  {
    n: '02',
    name: 'Senses',
    status: 'In build',
    what: 'Real-time perception layer: calendar, email, Slack, GitHub, Telegram, health data',
    how: 'Adapters normalize data → Guardian checks → Facts written to World Model',
    today: 'Manual source addition via API',
    next: 'OAuth connectors for Gmail, GCal, Notion',
  },
  {
    n: '03',
    name: 'Powers',
    status: 'In build',
    what: 'Execution capabilities: send messages, run code, call APIs, manage files',
    how: 'Guardian evaluates each proposed action before execution. Receipt generated after.',
    today: 'Guardian API for external executors',
    next: 'Native email, calendar, Telegram actions',
  },
  {
    n: '04',
    name: 'Loops',
    status: 'Live',
    what: 'Governance cycle: Observe → Decide → Act → Verify → Evolve',
    how: 'Every AI session follows the 5-phase loop. Receipts anchor each phase.',
    today: 'Full 5-phase loop with audit trail',
    next: 'Multi-agent loop coordination',
  },
  {
    n: '05',
    name: 'Voice',
    status: 'In build',
    what: 'Natural language interface to your World Model',
    how: 'Speech → Intent → Guardian check → World Model read/write → Response',
    today: 'Text interface via MCP',
    next: 'Voice activation, WhatsApp channel',
  },
  {
    n: '06',
    name: 'On-chain',
    status: 'In build',
    what: 'USDG payments, receipt anchoring on Robinhood Chain, $AXAI token access',
    how: 'X402 payment protocol, on-chain receipt hashes, bidwall liquidity',
    today: 'USDG payment for agent access',
    next: 'On-chain receipt anchoring, DAO governance',
  },
  {
    n: '07',
    name: 'Coordination',
    status: 'In build',
    what: 'Multi-agent orchestration and shared World Models',
    how: 'Agents operate in defined lanes. Shared context graph. Guardian governs all writes.',
    today: 'Single-agent Guardian',
    next: 'Multi-agent lane coordination',
  },
]

export default function CapabilityModules() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06]">
      {MODULES.map((mod) => {
        const isExpanded = expanded === mod.n
        return (
          <button
            key={mod.n}
            onClick={() => setExpanded(isExpanded ? null : mod.n)}
            className={[
              'text-left p-6 bg-black border-0 transition-all duration-200',
              isExpanded ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]',
            ].join(' ')}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="font-mono text-[10px] text-white/25 tracking-widest block mb-1">
                  {mod.n}
                </span>
                <span className="text-sm font-semibold text-white">{mod.name}</span>
              </div>
              <span
                className={[
                  'font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 border',
                  mod.status === 'Live'
                    ? 'text-green-400 border-green-400/30'
                    : 'text-white/35 border-white/10',
                ].join(' ')}
              >
                {mod.status}
              </span>
            </div>

            {/* What */}
            <p className="text-xs text-white/45 leading-relaxed mb-3">{mod.what}</p>

            {/* Expanded details */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3 text-left">
                <div>
                  <span className="font-mono text-[9px] text-white/25 uppercase tracking-widest block mb-1">
                    How
                  </span>
                  <p className="text-xs text-white/55 leading-relaxed">{mod.how}</p>
                </div>
                <div>
                  <span className="font-mono text-[9px] text-white/25 uppercase tracking-widest block mb-1">
                    Today
                  </span>
                  <p className="text-xs text-white/55 leading-relaxed">{mod.today}</p>
                </div>
                <div>
                  <span className="font-mono text-[9px] text-white/25 uppercase tracking-widest block mb-1">
                    Next
                  </span>
                  <p className="text-xs text-white/55 leading-relaxed">{mod.next}</p>
                </div>
              </div>
            )}

            {/* Expand hint */}
            <div className="mt-3 font-mono text-[10px] text-white/20 uppercase tracking-widest">
              {isExpanded ? '[ collapse ]' : '[ expand ]'}
            </div>
          </button>
        )
      })}
    </div>
  )
}
