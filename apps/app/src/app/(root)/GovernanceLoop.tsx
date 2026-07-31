'use client'
import { useState, useEffect } from 'react'

const PHASES = ['Observe', 'Decide', 'Act', 'Verify', 'Evolve'] as const

export default function GovernanceLoop() {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % PHASES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      {PHASES.map((phase, i) => (
        <div key={phase} className="flex items-center gap-2">
          <span
            className={[
              'px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] border transition-all duration-500',
              i === activeIndex
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-white/35 border-white/10',
            ].join(' ')}
          >
            {phase}
          </span>
          {i < PHASES.length - 1 && (
            <span className="text-white/20 font-mono text-xs">→</span>
          )}
        </div>
      ))}
    </div>
  )
}
