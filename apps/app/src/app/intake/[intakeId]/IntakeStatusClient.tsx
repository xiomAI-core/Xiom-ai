'use client'
import { useState, useEffect } from 'react'
import CodeBlock from '@/components/ui/CodeBlock'
import { apiPath, installScriptUrl } from '@/lib/urls'

type IntakeStatus = 'Under Review' | 'Provisioned' | 'Activated'

interface ChecklistItem {
  label: string
  done: boolean
}

interface ProvisioningCapsule {
  launchChecklist?: ChecklistItem[]
  bootstrapCommand?: string
  assistantId?: string
}

interface IntakeData {
  intakeId: string
  status: IntakeStatus
  name?: string
  agentName?: string
  assistantId?: string
  provisioningCapsule?: ProvisioningCapsule
}

interface Props {
  intakeId: string
  initialData: IntakeData | null
}

function statusColor(status: IntakeStatus): string {
  if (status === 'Activated') return 'text-green-400 border-green-400/30'
  if (status === 'Provisioned') return 'text-yellow-400 border-yellow-400/30'
  return 'text-white/45 border-white/15'
}

export default function IntakeStatusClient({ intakeId, initialData }: Props) {
  const [data, setData] = useState<IntakeData | null>(initialData)
  const [lastPoll, setLastPoll] = useState<Date>(new Date())

  const poll = async () => {
    try {
      const res = await fetch(apiPath(`/api/intake/${intakeId}`))
      if (res.ok) {
        const json = (await res.json()) as IntakeData
        setData(json)
        setLastPoll(new Date())
      }
    } catch {
      // silently continue polling
    }
  }

  useEffect(() => {
    const interval = setInterval(poll, 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeId])

  const checklist = data?.provisioningCapsule?.launchChecklist ?? []
  const bootstrapCommand =
    data?.provisioningCapsule?.bootstrapCommand ??
    `curl -fsSL ${installScriptUrl(data?.assistantId ?? 'claude')} | bash`

  const shareText = encodeURIComponent(
    `Just created my XIOM agent — governed, memory-enabled AI on top of ${data?.assistantId ?? 'my AI'}. 🧠 https://xiom-ai.com`
  )

  return (
    <div className="space-y-10">
      {/* Status badge */}
      <div className="flex items-center gap-4">
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 border ${statusColor(data?.status ?? 'Under Review')}`}
        >
          {data?.status ?? 'Under Review'}
        </span>
        <span className="font-mono text-[10px] text-white/20 uppercase tracking-widest">
          Last updated: {lastPoll.toLocaleTimeString()}
        </span>
      </div>

      {/* Agent info */}
      {data?.agentName && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">Agent</div>
          <div className="text-xl font-semibold text-white">{data.agentName}</div>
          {data.name && <div className="text-sm text-white/40 mt-1">Owner: {data.name}</div>}
        </div>
      )}

      {/* Launch checklist */}
      {checklist.length > 0 && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4">Launch Checklist</div>
          <div className="space-y-2">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`font-mono text-sm ${item.done ? 'text-green-400' : 'text-white/20'}`}>
                  {item.done ? '✓' : '○'}
                </span>
                <span className={`text-sm ${item.done ? 'text-white/70' : 'text-white/35'}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What happens next */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4">What happens next</div>
        <div className="space-y-3">
          {[
            { step: '01', text: 'XIOM reviews your intake and provisions your World Model graph.' },
            { step: '02', text: 'Your Guardian is configured with your policies and context.' },
            { step: '03', text: 'You receive a DM on Telegram with your bootstrap command.' },
            { step: '04', text: 'Run the bootstrap. Your AI gets memory and governance instantly.' },
          ].map((item) => (
            <div key={item.step} className="flex gap-4 items-start">
              <span className="font-mono text-[10px] text-white/20 tracking-widest mt-0.5 w-6 shrink-0">{item.step}</span>
              <p className="text-sm text-white/50 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bootstrap command */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4">Bootstrap Command</div>
        <CodeBlock code={bootstrapCommand} label="Run in terminal" />
      </div>

      {/* DM notice */}
      <div className="border border-white/10 px-6 py-4 bg-white/[0.02]">
        <p className="text-sm text-white/55 leading-relaxed">
          📬 We&apos;ll DM you on Telegram when your agent is ready. Make sure your handle is reachable.
        </p>
      </div>

      {/* Share */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4">Share</div>
        <div className="flex gap-3">
          <a
            href={`https://twitter.com/intent/tweet?text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-white/15 text-xs text-white/55 font-mono uppercase tracking-widest hover:border-white/30 hover:text-white transition-all"
          >
            Share on X →
          </a>
          <a
            href={`https://t.me/share/url?url=https://xiom-ai.com&text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-white/15 text-xs text-white/55 font-mono uppercase tracking-widest hover:border-white/30 hover:text-white transition-all"
          >
            Share on Telegram →
          </a>
        </div>
      </div>
    </div>
  )
}
