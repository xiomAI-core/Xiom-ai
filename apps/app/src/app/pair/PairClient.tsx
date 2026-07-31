'use client'

import Link from 'next/link'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

const RELEASES_URL = 'https://github.com/xiomAI-core/Xiom-ai/releases'
const MARKETING_DOWNLOAD = 'https://xiom-ai.com/#download-desktop'

function marketingDownloadUrl(): string {
  if (typeof window === 'undefined') return MARKETING_DOWNLOAD
  const isLocal =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return isLocal ? 'http://localhost:3000/#download-desktop' : MARKETING_DOWNLOAD
}

export default function PairClient() {
  const searchParams = useSearchParams()
  const code = (searchParams.get('code') || '').trim()

  const displayCode = useMemo(() => code || '— — — — — — — —', [code])

  const copyCode = useCallback(async () => {
    if (!code) {
      toast.error('No pairing code in URL')
      return
    }
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Pairing code copied')
    } catch {
      toast.error('Could not copy code')
    }
  }, [code])

  return (
    <main className="min-h-screen bg-black text-white px-6 py-24">
      <div className="max-w-2xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/35 border border-white/10 px-4 py-1.5 inline-block mb-8">
          Desktop pairing
        </div>

        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
          Connect XIOM Desktop
        </h1>
        <p className="text-sm text-white/45 leading-relaxed mb-10">
          Your install script generated a one-time pairing code. Open XIOM Desktop and enter
          this code to link your local MCP server with your AI provider.
        </p>

        <div className="border border-white/10 bg-white/[0.02] p-6 mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30 mb-3">
            Pairing code
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <code className="font-mono text-2xl md:text-3xl tracking-widest text-white">
              {displayCode}
            </code>
            <button
              type="button"
              onClick={copyCode}
              disabled={!code}
              className="font-mono text-xs uppercase tracking-wider border border-white/20 px-4 py-2 text-white/70 hover:text-white hover:border-white/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Copy
            </button>
          </div>
          {!code && (
            <p className="mt-4 text-xs text-white/35">
              No <code className="text-white/50">?code=</code> parameter found. Re-run your
              provider install script to generate a fresh code.
            </p>
          )}
        </div>

        <ol className="space-y-6 text-sm text-white/55 leading-relaxed list-decimal list-inside mb-12">
          <li>
            <span className="text-white/80">Install or open XIOM Desktop</span> — download from{' '}
            <a
              href={marketingDownloadUrl()}
              className="text-white underline underline-offset-4 hover:text-white/80"
            >
              Download Desktop
            </a>{' '}
            or{' '}
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline underline-offset-4 hover:text-white/80"
            >
              GitHub Releases
            </a>
            .
          </li>
          <li>
            <span className="text-white/80">Paste the pairing code</span> in Desktop settings
            (or it may auto-detect from this URL in a future release).
          </li>
          <li>
            <span className="text-white/80">Reconnect your AI provider</span> — Claude, Codex, or
            Gemini will route through XIOM MCP on <code className="text-white/60">127.0.0.1:54321</code>.
          </li>
        </ol>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-wider border border-white/20 px-5 py-2.5 text-white/70 hover:text-white hover:border-white/40 transition-colors"
          >
            Back to app
          </Link>
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs uppercase tracking-wider border border-white bg-white text-black px-5 py-2.5 hover:bg-white/90 transition-colors"
          >
            GitHub Releases
          </a>
        </div>
      </div>
    </main>
  )
}
