import Link from 'next/link'
import WorldModelSphere from '@/components/world-model/WorldModelSphere'
import GovernanceLoop from './GovernanceLoop'
import BootstrapSelector from './BootstrapSelector'
import CapabilityModules from './CapabilityModules'

// Comparison table data
const COMPARISON_ROWS = [
  { feature: 'Memory', claudeNative: '✗', codexNative: '✗', geminiNative: '✗', withXiom: '✓' },
  { feature: 'Governance', claudeNative: '~', codexNative: '✗', geminiNative: '✗', withXiom: '✓' },
  { feature: 'Audit Trail', claudeNative: '✗', codexNative: '✗', geminiNative: '✗', withXiom: '✓' },
  { feature: 'Model Freedom', claudeNative: '✗', codexNative: '✗', geminiNative: '✗', withXiom: '✓' },
  { feature: 'Digital World Model', claudeNative: '✗', codexNative: '✗', geminiNative: '✗', withXiom: '✓' },
  { feature: 'Session Continuity', claudeNative: '~', codexNative: '~', geminiNative: '~', withXiom: '✓' },
]

function cellColor(val: string) {
  if (val === '✓') return 'text-green-400'
  if (val === '~') return 'text-yellow-400'
  return 'text-white/30'
}

export default function HomePage() {
  return (
    <main className="bg-black text-white">

      {/* ===== SECTION 1: HERO ===== */}
      <section className="pt-32 pb-24 flex flex-col items-center text-center px-6 min-h-screen justify-center">
        <div className="inline-block font-mono text-[10px] uppercase tracking-[0.15em] text-white/35 border border-white/10 px-4 py-1.5 mb-12">
          Personal AI Operating System
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-none mb-6 max-w-4xl">
          Your AI finally builds your world.
        </h1>

        <p className="text-base md:text-lg text-white/45 max-w-2xl leading-relaxed mb-16">
          XIOM wraps any terminal AI with constitutional governance, persistent memory,
          and a living Digital World Model — so every session builds on the last.
        </p>

        {/* WorldModelSphere */}
        <div className="relative mb-4">
          <WorldModelSphere width={600} height={400} />
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/25 mb-16">
          DIGITAL WORLD MODEL — Loading...
        </div>

        {/* Governance loop */}
        <GovernanceLoop />
      </section>

      {/* ===== SECTION 2: BOOTSTRAP ===== */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30 mb-4">
            Bootstrap
          </div>
          <h2 className="text-3xl font-semibold text-white mb-4">
            One command. Any AI.
          </h2>
          <p className="text-sm text-white/45 mb-10 leading-relaxed">
            XIOM installs as a thin layer on top of your existing terminal AI.
            Pick your provider and run the bootstrap.
          </p>
          <BootstrapSelector />
        </div>
      </section>

      {/* ===== SECTION 3: CTA ===== */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Ready to govern your AI?
          </h2>
          <p className="text-sm text-white/45 mb-10 leading-relaxed max-w-xl mx-auto">
            Create a new agent from scratch, or upgrade your existing setup to full
            XIOM governance and memory.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/create-my-agent"
              className="px-8 py-3 bg-white text-black text-sm font-semibold tracking-wider uppercase hover:bg-white/90 transition-colors"
            >
              Create My Agent →
            </Link>
            <Link
              href="/upgrade-my-agent"
              className="px-8 py-3 bg-transparent text-white text-sm font-semibold tracking-wider uppercase border border-white/25 hover:border-white/50 hover:bg-white/5 transition-all"
            >
              Upgrade My Agent
            </Link>
          </div>
        </div>
      </section>

      {/* ===== SECTION 4: CAPABILITIES ===== */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30 mb-4">
            System Modules
          </div>
          <h2 className="text-3xl font-semibold text-white mb-3">
            Seven pillars. One operating system.
          </h2>
          <p className="text-sm text-white/45 mb-12 max-w-2xl leading-relaxed">
            XIOM&apos;s architecture is modular. Each pillar ships independently and
            composes into a unified AI operating system for your life.
          </p>
          <CapabilityModules />
          <p className="text-xs text-white/25 font-mono mt-4">
            Click any module to expand details.
          </p>
        </div>
      </section>

      {/* ===== SECTION 5: COMPARISON TABLE ===== */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30 mb-4">
            Comparison
          </div>
          <h2 className="text-3xl font-semibold text-white mb-3">
            What you get with XIOM.
          </h2>
          <p className="text-sm text-white/45 mb-10 leading-relaxed">
            XIOM wraps any terminal AI. You keep your provider.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 pr-6 font-mono text-[10px] uppercase tracking-widest text-white/30 w-48">
                    Feature
                  </th>
                  <th className="py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-white/30 text-center">
                    Claude Code
                  </th>
                  <th className="py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-white/30 text-center">
                    Codex CLI
                  </th>
                  <th className="py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-white/30 text-center">
                    Gemini CLI
                  </th>
                  <th className="py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-white border border-white/20 text-center bg-white/[0.03]">
                    + XIOM
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={[
                      'border-b border-white/[0.05]',
                      i % 2 === 0 ? '' : 'bg-white/[0.01]',
                    ].join(' ')}
                  >
                    <td className="py-3 pr-6 font-mono text-xs text-white/55">
                      {row.feature}
                    </td>
                    <td className={`py-3 px-4 text-center font-mono text-sm ${cellColor(row.claudeNative)}`}>
                      {row.claudeNative}
                    </td>
                    <td className={`py-3 px-4 text-center font-mono text-sm ${cellColor(row.codexNative)}`}>
                      {row.codexNative}
                    </td>
                    <td className={`py-3 px-4 text-center font-mono text-sm ${cellColor(row.geminiNative)}`}>
                      {row.geminiNative}
                    </td>
                    <td className={`py-3 px-4 text-center font-mono text-sm border-x border-white/[0.08] bg-white/[0.03] ${cellColor(row.withXiom)}`}>
                      {row.withXiom}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center gap-6 font-mono text-[10px] text-white/25 uppercase tracking-widest">
            <span><span className="text-green-400">✓</span> Full</span>
            <span><span className="text-yellow-400">~</span> Partial</span>
            <span><span className="text-white/30">✗</span> None</span>
          </div>

          <p className="mt-4 text-xs text-white/30 font-mono">
            * XIOM wraps any terminal AI. You keep your provider.
          </p>
        </div>
      </section>

      {/* Footer spacer */}
      <footer className="border-t border-white/[0.06] py-12 px-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/20">
          XIOM © 2025 — Personal AI Operating System
        </div>
      </footer>
    </main>
  )
}
