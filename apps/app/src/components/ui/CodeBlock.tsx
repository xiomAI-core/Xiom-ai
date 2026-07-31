'use client'
import { useState } from 'react'

interface CodeBlockProps {
  code: string
  language?: string
  label?: string
}

export default function CodeBlock({ code, language = 'bash', label }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: do nothing
    }
  }

  return (
    <div className="border border-white/10 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.04] border-b border-white/10">
        <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
          {label ?? language}
        </span>
        <button
          onClick={handleCopy}
          className="font-mono text-[10px] text-white/40 hover:text-white uppercase tracking-widest transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {/* Code area */}
      <div className="bg-[#0a0a0a] px-4 py-3 overflow-x-auto">
        <pre className="font-mono text-xs text-white/80 whitespace-pre-wrap break-all leading-relaxed">
          {code}
        </pre>
      </div>
    </div>
  )
}
