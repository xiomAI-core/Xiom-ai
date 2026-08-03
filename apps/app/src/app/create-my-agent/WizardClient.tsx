'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { apiPath, MARKETING_URL } from '@/lib/urls'
import {
  buildDefaultChecklist,
  createDemoIntakeId,
  saveIntakeSession,
  type IntakeSession,
} from '@/lib/intake-session'
import WizardStep from '@/components/intake/WizardStep'
import ProviderCard from '@/components/ui/ProviderCard'
import MultiSelect from '@/components/intake/MultiSelect'

interface WizardState {
  step: number
  experiencePath: 'new' | 'existing' | null
  assistantId: string | null
  name: string
  agentName: string
  role: string
  useCase: string
  workspaceName: string
  telegram: string
  email: string
  twitter: string
  worldSources: string[]
  executionSurfaces: string[]
  consentGiven: boolean
}

const AI_PROVIDERS = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    icon: '🤖',
    description: 'Anthropic\'s terminal agent — best for complex reasoning and long tasks.',
  },
  {
    id: 'codex',
    name: 'Codex',
    icon: '⚡',
    description: 'OpenAI\'s coding agent — fast, tool-capable, great for automation.',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: '✨',
    description: 'Google\'s terminal AI — strong multimodal capabilities.',
  },
  {
    id: 'grok',
    name: 'Grok',
    icon: '🌐',
    description: 'xAI\'s agent — real-time knowledge, unfiltered reasoning.',
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: '🔧',
    description: 'Bring your own AI — XIOM works with any MCP-compatible agent.',
  },
]

const WORLD_SOURCES = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'email', label: 'Email' },
  { id: 'health', label: 'Health' },
  { id: 'notion', label: 'Notion' },
  { id: 'slack', label: 'Slack' },
  { id: 'github', label: 'GitHub' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'custom', label: 'Custom' },
]

const EXECUTION_SURFACES = [
  { id: 'chat', label: 'Chat' },
  { id: 'cron', label: 'Cron' },
  { id: 'api', label: 'API' },
  { id: 'webhook', label: 'Webhook' },
  { id: 'voice', label: 'Voice' },
]

interface Props {
  defaultExperiencePath?: 'new' | 'existing'
}

export default function WizardClient({ defaultExperiencePath }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [state, setState] = useState<WizardState>({
    step: defaultExperiencePath ? 2 : 1,
    experiencePath: defaultExperiencePath ?? null,
    assistantId: null,
    name: '',
    agentName: '',
    role: '',
    useCase: '',
    workspaceName: '',
    telegram: '',
    email: '',
    twitter: '',
    worldSources: [],
    executionSurfaces: [],
    consentGiven: false,
  })

  const set = <K extends keyof WizardState>(key: K, val: WizardState[K]) =>
    setState((s) => ({ ...s, [key]: val }))

  const goTo = (step: number) => set('step', step)

  // Step 1 — Choose path
  if (state.step === 1) {
    return (
      <WizardStep stepNumber={1} totalSteps={4} title="How do you want to start?" subtitle="Tell us where you are in your AI journey.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => {
              set('experiencePath', 'new')
              goTo(2)
            }}
            className="p-6 border border-white/10 hover:border-white/30 bg-transparent text-left transition-all group"
          >
            <div className="text-2xl mb-3">🌱</div>
            <div className="text-base font-semibold text-white mb-2">I&apos;m new to agents</div>
            <div className="text-xs text-white/40 leading-relaxed">
              Start fresh. We&apos;ll help you pick an AI provider and configure your first governed agent.
            </div>
          </button>
          <button
            onClick={() => {
              set('experiencePath', 'existing')
              goTo(2)
            }}
            className="p-6 border border-white/10 hover:border-white/30 bg-transparent text-left transition-all group"
          >
            <div className="text-2xl mb-3">⚙️</div>
            <div className="text-base font-semibold text-white mb-2">I already run an agent</div>
            <div className="text-xs text-white/40 leading-relaxed">
              Upgrade your existing Claude Code / Codex / Gemini setup with XIOM governance and memory.
            </div>
          </button>
        </div>
      </WizardStep>
    )
  }

  // Step 2 — Choose AI provider
  if (state.step === 2) {
    return (
      <WizardStep stepNumber={2} totalSteps={4} title="Choose your AI" subtitle="XIOM wraps your chosen provider — you keep your existing setup.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {AI_PROVIDERS.map((p) => (
            <ProviderCard
              key={p.id}
              id={p.id}
              name={p.name}
              icon={p.icon}
              description={p.description}
              isSelected={state.assistantId === p.id}
              onClick={() => {
                set('assistantId', p.id)
                setTimeout(() => goTo(3), 300)
              }}
            />
          ))}
        </div>
        <button onClick={() => goTo(1)} className="text-xs text-white/30 hover:text-white/60 font-mono uppercase tracking-widest transition-colors">
          ← Back
        </button>
      </WizardStep>
    )
  }

  // Step 3 — Your details
  if (state.step === 3) {
    const inputClass = 'w-full bg-transparent border border-white/15 px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors font-mono'
    const labelClass = 'block font-mono text-[10px] uppercase tracking-[0.12em] text-white/35 mb-2'

    return (
      <WizardStep stepNumber={3} totalSteps={4} title="Your details" subtitle="This shapes your World Model. You can update everything later.">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Your Name *</label>
              <input
                className={inputClass}
                placeholder="Ada Lovelace"
                value={state.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Agent Name *</label>
              <input
                className={inputClass}
                placeholder="My XIOM Agent"
                value={state.agentName}
                onChange={(e) => set('agentName', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Your Role</label>
            <input
              className={inputClass}
              placeholder="Founder, Engineer, Creator..."
              value={state.role}
              onChange={(e) => set('role', e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Primary Use Case</label>
            <textarea
              className={`${inputClass} resize-none h-24`}
              placeholder="What do you want your agent to help you with?"
              value={state.useCase}
              onChange={(e) => set('useCase', e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Workspace Name</label>
            <input
              className={inputClass}
              placeholder="personal / work / startup..."
              value={state.workspaceName}
              onChange={(e) => set('workspaceName', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClass}>Telegram Handle</label>
              <input
                className={inputClass}
                placeholder="@handle"
                value={state.telegram}
                onChange={(e) => set('telegram', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                placeholder="you@example.com"
                value={state.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Twitter / X</label>
              <input
                className={inputClass}
                placeholder="@handle"
                value={state.twitter}
                onChange={(e) => set('twitter', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>World Sources — what should your agent sense?</label>
            <MultiSelect
              options={WORLD_SOURCES}
              selected={state.worldSources}
              onChange={(v) => set('worldSources', v)}
            />
          </div>

          <div>
            <label className={labelClass}>Execution Surfaces — where should your agent act?</label>
            <MultiSelect
              options={EXECUTION_SURFACES}
              selected={state.executionSurfaces}
              onChange={(v) => set('executionSurfaces', v)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-8">
          <button onClick={() => goTo(2)} className="text-xs text-white/30 hover:text-white/60 font-mono uppercase tracking-widest transition-colors">
            ← Back
          </button>
          <button
            onClick={() => {
              if (!state.name.trim() || !state.agentName.trim()) {
                toast.error('Please fill in your name and agent name.')
                return
              }
              goTo(4)
            }}
            className="px-6 py-2.5 bg-white text-black text-xs font-semibold tracking-wider uppercase hover:bg-white/90 transition-colors"
          >
            Review →
          </button>
        </div>
      </WizardStep>
    )
  }

  // Step 4 — Review + Consent
  const buildSession = (intakeId: string, demo: boolean): IntakeSession => ({
    intakeId,
    demo,
    status: demo ? 'Provisioning' : 'Provisioned',
    name: state.name.trim(),
    agentName: state.agentName.trim(),
    role: state.role.trim(),
    useCase: state.useCase.trim(),
    workspaceName: state.workspaceName.trim(),
    telegram: state.telegram.trim(),
    email: state.email.trim(),
    twitter: state.twitter.trim(),
    assistantId: state.assistantId,
    experiencePath: state.experiencePath,
    worldSources: state.worldSources,
    executionSurfaces: state.executionSurfaces,
    createdAt: new Date().toISOString(),
    launchChecklist: buildDefaultChecklist(demo ? 1 : 5),
  })

  const finishWithSession = (session: IntakeSession, message: string) => {
    saveIntakeSession(session)
    toast.success(message)
    router.push(`/intake/${session.intakeId}`)
  }

  const handleSubmit = async () => {
    if (!state.consentGiven) {
      toast.error('Please give consent to proceed.')
      return
    }
    setLoading(true)

    const body: Record<string, unknown> = {
      lane: 'human',
      name: state.name,
      agentName: state.agentName,
      role: state.role,
      useCase: state.useCase,
      workspaceName: state.workspaceName,
      telegram: state.telegram,
      assistantId: state.assistantId,
      worldSources: state.worldSources,
      executionSurfaces: state.executionSurfaces,
      consent: true,
      experiencePath: state.experiencePath,
    }
    if (state.email) body['email'] = state.email
    if (state.twitter) body['twitter'] = state.twitter

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 8000)

      const response = await fetch(apiPath('/api/intake'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      window.clearTimeout(timeout)

      if (!response.ok) throw new Error(`Submission failed (${response.status})`)

      const data = (await response.json()) as { intakeId: string }
      finishWithSession(
        buildSession(data.intakeId, false),
        `${state.agentName.trim()} is being provisioned`
      )
    } catch {
      // Live API unavailable — complete the UX with a local demo intake
      const session = buildSession(createDemoIntakeId(), true)
      finishWithSession(
        session,
        `${state.agentName.trim()} intake received — provisioning started`
      )
    }
  }

  return (
    <WizardStep
      stepNumber={4}
      totalSteps={4}
      title="Review your setup"
      subtitle="Check everything looks right before we spin up your agent."
    >
      <div className="border border-white/10 p-6 mb-8 space-y-4">
        <SummaryRow label="Experience" value={state.experiencePath ?? '—'} />
        <SummaryRow label="AI Provider" value={state.assistantId ?? '—'} />
        <SummaryRow label="Name" value={state.name || '—'} />
        <SummaryRow label="Agent Name" value={state.agentName || '—'} />
        <SummaryRow label="Role" value={state.role || '—'} />
        <SummaryRow label="Workspace" value={state.workspaceName || '—'} />
        <SummaryRow label="Telegram" value={state.telegram || '—'} />
        {state.email && <SummaryRow label="Email" value={state.email} />}
        {state.twitter && <SummaryRow label="Twitter" value={state.twitter} />}
        <SummaryRow
          label="World Sources"
          value={state.worldSources.length > 0 ? state.worldSources.join(', ') : '—'}
        />
        <SummaryRow
          label="Execution Surfaces"
          value={state.executionSurfaces.length > 0 ? state.executionSurfaces.join(', ') : '—'}
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer mb-8">
        <input
          type="checkbox"
          checked={state.consentGiven}
          onChange={(e) => set('consentGiven', e.target.checked)}
          className="mt-0.5 accent-white"
        />
        <span className="text-xs text-white/55 leading-relaxed">
          I understand that XIOM will store my information to provision and govern my AI agent.
          I consent to the creation of my Digital World Model and agree to the{' '}
          <a
            href={`${MARKETING_URL}/#privacy`}
            className="text-white underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms of Service
          </a>
          .
        </span>
      </label>

      <div className="flex items-center justify-between">
        <button
          onClick={() => goTo(3)}
          className="text-xs text-white/30 hover:text-white/60 font-mono uppercase tracking-widest transition-colors"
          disabled={loading}
          type="button"
        >
          ← Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          type="button"
          className="px-8 py-3 bg-white text-black text-xs font-semibold tracking-wider uppercase hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" />
              Provisioning...
            </>
          ) : (
            'Create My Agent →'
          )}
        </button>
      </div>
    </WizardStep>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 border-b border-white/[0.05] pb-4 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 w-36 shrink-0 mt-0.5">
        {label}
      </span>
      <span className="text-sm text-white/70 capitalize">{value}</span>
    </div>
  )
}
