import type { Metadata } from 'next'
import WizardClient from '../create-my-agent/WizardClient'

export const metadata: Metadata = {
  title: 'Upgrade My Agent',
  description: 'Upgrade your existing AI agent with XIOM governance, memory, and a Digital World Model.',
}

export default function UpgradeMyAgentPage() {
  return (
    <main className="min-h-screen bg-black pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30 mb-6">
          XIOM / Upgrade Agent
        </div>
        <div className="mb-8 border border-white/10 px-6 py-4 bg-white/[0.02]">
          <p className="text-sm text-white/55 leading-relaxed">
            Already running Claude Code, Codex, or Gemini? XIOM adds governance, persistent memory,
            and a Digital World Model without replacing your existing workflow.
          </p>
        </div>
        {/* Pre-select 'existing' experience path — user skips step 1 */}
        <WizardClient defaultExperiencePath="existing" />
      </div>
    </main>
  )
}
