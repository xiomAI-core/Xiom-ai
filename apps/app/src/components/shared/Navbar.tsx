'use client'
import Link from 'next/link'
import { useState } from 'react'
import WalletButton from '@/components/wallet/WalletButton'
import HolderTierBadge from '@/components/wallet/HolderTierBadge'
import { useHolderTier } from '@/hooks/useHolderTier'
import { useAccount } from 'wagmi'

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isConnected } = useAccount()
  const { tier, isLoading } = useHolderTier()

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] backdrop-blur-sm bg-black/80">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-sm tracking-[0.15em] uppercase text-white hover:opacity-80 transition-opacity"
        >
          XIOM
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/api/worldmodel/live"
            className="text-xs text-white/50 hover:text-white tracking-wider uppercase transition-colors"
          >
            World Model
          </Link>
          <Link
            href="https://docs.xiom-ai.com"
            className="text-xs text-white/50 hover:text-white tracking-wider uppercase transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Docs
          </Link>
          {isConnected ? <HolderTierBadge tier={tier} loading={isLoading} /> : null}
          <WalletButton />
          <Link
            href="/create-my-agent"
            className="px-4 py-2 text-xs font-medium tracking-wider uppercase border border-white/20 hover:border-white/50 hover:bg-white/5 transition-all"
          >
            Launch App
          </Link>
        </nav>

        <button
          className="md:hidden text-white/60 hover:text-white transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          type="button"
        >
          <span className="font-mono text-sm">{mobileOpen ? '[×]' : '[≡]'}</span>
        </button>
      </div>

      {mobileOpen ? (
        <div className="md:hidden border-t border-white/[0.06] bg-black px-6 py-4 flex flex-col gap-4">
          <Link
            href="/api/worldmodel/live"
            className="text-xs text-white/50 uppercase tracking-wider hover:text-white transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            World Model
          </Link>
          <Link
            href="https://docs.xiom-ai.com"
            className="text-xs text-white/50 uppercase tracking-wider hover:text-white transition-colors"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
          >
            Docs
          </Link>
          <WalletButton />
          <Link
            href="/create-my-agent"
            className="text-xs text-white uppercase tracking-wider"
            onClick={() => setMobileOpen(false)}
          >
            Launch App →
          </Link>
        </div>
      ) : null}
    </header>
  )
}
