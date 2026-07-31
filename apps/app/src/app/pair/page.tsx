import type { Metadata } from 'next'
import { Suspense } from 'react'
import PairClient from './PairClient'

export const metadata: Metadata = {
  title: 'Pair Desktop',
  description: 'Pair XIOM Desktop with your AI provider using a one-time pairing code.',
}

export default function PairPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
          <p className="font-mono text-sm text-white/40">Loading pairing…</p>
        </main>
      }
    >
      <PairClient />
    </Suspense>
  )
}
