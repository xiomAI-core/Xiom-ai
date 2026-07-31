import type { Metadata } from 'next'
import WizardClient from './WizardClient'

export const metadata: Metadata = {
  title: 'Create My Agent',
  description: 'Set up your governed, memory-enabled XIOM agent in minutes.',
}

export default function CreateMyAgentPage() {
  return (
    <main className="min-h-screen bg-black pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30 mb-6">
          XIOM / Create Agent
        </div>
        <WizardClient />
      </div>
    </main>
  )
}
