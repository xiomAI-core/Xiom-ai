'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import CodeBlock from '@/components/ui/CodeBlock'
import {
  DESKTOP_DOWNLOAD_URL,
  DOCS_URL,
  MARKETING_URL,
  installScriptUrl,
  pairUrl,
} from '@/lib/urls'
import {
  buildDefaultChecklist,
  isDemoIntakeId,
  loadIntakeSession,
  normalizeApiStatus,
  providerInstallSlug,
  updateIntakeSession,
  type ChecklistItem,
  type IntakeSession,
  type IntakeStatus,
} from '@/lib/intake-session'
import { apiPath } from '@/lib/urls'

interface IntakeData {
  intakeId: string
  status: IntakeStatus
  name?: string
  agentName?: string
  assistantId?: string
  role?: string
  workspaceName?: string
  demo?: boolean
  provisioningCapsule?: {
    launchChecklist?: ChecklistItem[]
    bootstrapCommand?: string
    assistantId?: string
  }
  launchChecklist?: ChecklistItem[]
}

interface Props {
  intakeId: string
  initialData: IntakeData | null
}

function statusColor(status: IntakeStatus): string {
  if (status === 'Activated') return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5'
  if (status === 'Provisioned') return 'text-emerald-300 border-emerald-300/25 bg-emerald-300/5'
  if (status === 'Provisioning') return 'text-amber-300 border-amber-300/25 bg-amber-300/5'
  return 'text-white/55 border-white/15 bg-white/[0.02]'
}

function sessionToData(session: IntakeSession): IntakeData {
  const capsule: NonNullable<IntakeData['provisioningCapsule']> = {
    launchChecklist: session.launchChecklist,
    bootstrapCommand: `curl -fsSL ${installScriptUrl(providerInstallSlug(session.assistantId))} | bash`,
  }
  if (session.assistantId) capsule.assistantId = session.assistantId

  const data: IntakeData = {
    intakeId: session.intakeId,
    status: session.status,
    demo: session.demo,
    launchChecklist: session.launchChecklist,
    provisioningCapsule: capsule,
  }
  if (session.name) data.name = session.name
  if (session.agentName) data.agentName = session.agentName
  if (session.assistantId) data.assistantId = session.assistantId
  if (session.role) data.role = session.role
  if (session.workspaceName) data.workspaceName = session.workspaceName
  return data
}

export default function IntakeStatusClient({ intakeId, initialData }: Props) {
  const [data, setData] = useState<IntakeData | null>(initialData)
  const [ready, setReady] = useState(Boolean(initialData))
  const [lastPoll, setLastPoll] = useState<Date>(new Date())
  const [copied, setCopied] = useState(false)
  const [progress, setProgress] = useState(initialData ? 40 : 8)

  const demoMode = data?.demo || isDemoIntakeId(intakeId)

  // Hydrate from sessionStorage (wizard → status)
  useEffect(() => {
    const session = loadIntakeSession(intakeId)
    if (session && session.intakeId === intakeId) {
      setData(sessionToData(session))
      setReady(true)
      setProgress(session.demo ? 18 : 70)
      return
    }
    if (initialData) {
      setReady(true)
      return
    }
    if (isDemoIntakeId(intakeId)) {
      setData({
        intakeId,
        status: 'Provisioning',
        demo: true,
        agentName: 'Your XIOM Agent',
        launchChecklist: buildDefaultChecklist(1),
      })
      setReady(true)
    } else {
      setReady(true)
    }
  }, [intakeId, initialData])

  // Animate provisioning checklist for demo intakes
  useEffect(() => {
    if (!demoMode) return

    let doneCount =
      loadIntakeSession(intakeId)?.launchChecklist?.filter((i) => i.done).length ?? 1
    const total = buildDefaultChecklist(0).length

    if (doneCount >= total) {
      setProgress(100)
      return
    }

    const id = window.setInterval(() => {
      doneCount += 1
      const checklist = buildDefaultChecklist(doneCount)
      const status: IntakeStatus =
        doneCount >= total ? 'Provisioned' : 'Provisioning'
      const pct = doneCount >= total ? 100 : Math.min(95, 15 + doneCount * 17)

      setProgress(pct)
      setData((prev) =>
        prev
          ? {
              ...prev,
              status,
              launchChecklist: checklist,
              provisioningCapsule: {
                ...prev.provisioningCapsule,
                launchChecklist: checklist,
              },
            }
          : prev
      )
      updateIntakeSession(intakeId, { status, launchChecklist: checklist })
      setLastPoll(new Date())

      if (doneCount >= total) window.clearInterval(id)
    }, 900)

    return () => window.clearInterval(id)
  }, [demoMode, intakeId])

  // Poll live API when not demo
  useEffect(() => {
    if (demoMode) return

    const poll = async () => {
      try {
        const res = await fetch(apiPath(`/api/intake/${intakeId}`))
        if (!res.ok) return
        const json = (await res.json()) as Record<string, unknown>
        setData((prev) => {
          const next: IntakeData = {
            intakeId,
            status: normalizeApiStatus(String(json['status'] ?? '')),
            demo: false,
          }
          const name = (json['name'] as string | undefined) ?? prev?.name
          const agentName =
            (json['agentName'] as string | undefined) ?? prev?.agentName
          const assistantId =
            (json['assistantId'] as string | undefined) ?? prev?.assistantId
          const capsule =
            (json['provisioningCapsule'] as IntakeData['provisioningCapsule']) ??
            prev?.provisioningCapsule
          if (name) next.name = name
          if (agentName) next.agentName = agentName
          if (assistantId) next.assistantId = assistantId
          if (capsule) next.provisioningCapsule = capsule
          return next
        })
        setLastPoll(new Date())
        setProgress(100)
      } catch {
        // keep local session view
      }
    }

    void poll()
    const interval = window.setInterval(poll, 30_000)
    return () => window.clearInterval(interval)
  }, [demoMode, intakeId])

  const checklist = useMemo(() => {
    return (
      data?.launchChecklist ??
      data?.provisioningCapsule?.launchChecklist ??
      buildDefaultChecklist(demoMode ? 1 : 0)
    )
  }, [data, demoMode])

  const bootstrapCommand =
    data?.provisioningCapsule?.bootstrapCommand ??
    `curl -fsSL ${installScriptUrl(providerInstallSlug(data?.assistantId))} | bash`

  const pairCode = intakeId.replace(/^demo_/, '').slice(0, 12).toUpperCase()
  const shareUrl = MARKETING_URL
  const shareText = encodeURIComponent(
    `Just created my XIOM agent "${data?.agentName ?? 'agent'}" — governed, memory-enabled AI. ${shareUrl}`
  )

  const copyPairCode = async () => {
    try {
      await navigator.clipboard.writeText(pairCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore
    }
  }

  if (!ready) {
    return (
      <div className="py-16 text-center font-mono text-xs text-white/35 tracking-widest uppercase">
        Loading intake…
      </div>
    )
  }

  const status = data?.status ?? 'Under Review'

  return (
    <div className="space-y-10">
      {/* Hero status */}
      <div className="border border-white/10 bg-white/[0.02] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 border ${statusColor(status)}`}
          >
            {status}
          </span>
          {demoMode ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/25">
              Live provisioning preview
            </span>
          ) : null}
          <span className="font-mono text-[10px] text-white/20 uppercase tracking-widest ml-auto">
            Updated {lastPoll.toLocaleTimeString()}
          </span>
        </div>

        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-white/30">
          Agent
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          {data?.agentName || 'Your XIOM Agent'}
        </h2>
        <p className="text-sm text-white/45 mt-2">
          {data?.name ? `Owner: ${data.name}` : 'Your agent intake is in flight.'}
          {data?.role ? ` · ${data.role}` : ''}
          {data?.workspaceName ? ` · ${data.workspaceName}` : ''}
        </p>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
              Provisioning
            </span>
            <span className="font-mono text-[10px] text-white/40">{progress}%</span>
          </div>
          <div className="h-1 w-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-white transition-[width] duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4">
          Launch Checklist
        </div>
        <div className="space-y-2">
          {checklist.map((item, i) => (
            <div
              key={`${item.label}-${i}`}
              className={`flex items-center gap-3 border px-4 py-3 transition-colors ${
                item.done
                  ? 'border-emerald-400/20 bg-emerald-400/[0.04]'
                  : 'border-white/10 bg-transparent'
              }`}
            >
              <span
                className={`font-mono text-sm w-4 ${
                  item.done ? 'text-emerald-400' : 'text-white/20'
                }`}
              >
                {item.done ? '✓' : '○'}
              </span>
              <span
                className={`text-sm ${item.done ? 'text-white/80' : 'text-white/35'}`}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Next actions */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4">
          Next actions
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href={DESKTOP_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/15 px-4 py-4 hover:border-white/35 hover:bg-white/[0.03] transition-all"
          >
            <div className="text-xs font-semibold text-white mb-1">Download Desktop</div>
            <div className="text-[11px] text-white/40 leading-relaxed">
              Install XIOM Desktop to host MCP locally.
            </div>
          </a>
          <Link
            href={pairUrl(pairCode)}
            className="border border-white/15 px-4 py-4 hover:border-white/35 hover:bg-white/[0.03] transition-all"
          >
            <div className="text-xs font-semibold text-white mb-1">Pair Desktop</div>
            <div className="text-[11px] text-white/40 leading-relaxed">
              Open pairing with code {pairCode.slice(0, 8)}…
            </div>
          </Link>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/15 px-4 py-4 hover:border-white/35 hover:bg-white/[0.03] transition-all"
          >
            <div className="text-xs font-semibold text-white mb-1">API Docs</div>
            <div className="text-[11px] text-white/40 leading-relaxed">
              Explore intake, MCP, and world-model endpoints.
            </div>
          </a>
        </div>
      </div>

      {/* Pairing code */}
      <div className="border border-white/10 px-5 py-4 flex flex-wrap items-center gap-4 justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">
            Pairing code
          </div>
          <div className="font-mono text-sm text-white tracking-[0.18em]">{pairCode}</div>
        </div>
        <button
          type="button"
          onClick={copyPairCode}
          className="px-4 py-2 border border-white/20 text-[10px] font-mono uppercase tracking-widest text-white/70 hover:text-white hover:border-white/40 transition-colors"
        >
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>

      {/* What happens next */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4">
          What happens next
        </div>
        <div className="space-y-3">
          {[
            {
              step: '01',
              text: 'XIOM provisions your World Model graph and Guardian scaffold.',
            },
            {
              step: '02',
              text: 'Download Desktop and paste your pairing code to connect MCP.',
            },
            {
              step: '03',
              text: 'Run the bootstrap command so your AI provider routes through XIOM.',
            },
            {
              step: '04',
              text: 'Your agent gains durable memory, policy checks, and auditability.',
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4 items-start">
              <span className="font-mono text-[10px] text-white/20 tracking-widest mt-0.5 w-6 shrink-0">
                {item.step}
              </span>
              <p className="text-sm text-white/50 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bootstrap */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4">
          Bootstrap Command
        </div>
        <CodeBlock code={bootstrapCommand} label="Run in terminal" />
      </div>

      {/* Share */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4">
          Share
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={`https://twitter.com/intent/tweet?text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-white/15 text-xs text-white/55 font-mono uppercase tracking-widest hover:border-white/30 hover:text-white transition-all"
          >
            Share on X →
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-white/15 text-xs text-white/55 font-mono uppercase tracking-widest hover:border-white/30 hover:text-white transition-all"
          >
            Share on Telegram →
          </a>
          <Link
            href="/create-my-agent"
            className="px-4 py-2 border border-white/15 text-xs text-white/55 font-mono uppercase tracking-widest hover:border-white/30 hover:text-white transition-all"
          >
            Create another →
          </Link>
        </div>
      </div>
    </div>
  )
}
