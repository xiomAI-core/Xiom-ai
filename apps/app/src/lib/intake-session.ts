/**
 * Client-side intake session — keeps wizard answers for the status page
 * when the live API is unavailable (investor / demo mode).
 */

export type IntakeStatus = 'Under Review' | 'Provisioning' | 'Provisioned' | 'Activated'

export interface ChecklistItem {
  label: string
  done: boolean
}

export interface IntakeSession {
  intakeId: string
  demo: boolean
  status: IntakeStatus
  name: string
  agentName: string
  role: string
  useCase: string
  workspaceName: string
  telegram: string
  email: string
  twitter: string
  assistantId: string | null
  experiencePath: 'new' | 'existing' | null
  worldSources: string[]
  executionSurfaces: string[]
  createdAt: string
  launchChecklist: ChecklistItem[]
}

const KEY = 'xiom_intake_v1'

export function isDemoIntakeId(intakeId: string): boolean {
  return intakeId.startsWith('demo_')
}

export function providerInstallSlug(assistantId: string | null | undefined): string {
  const id = (assistantId ?? 'claude').toLowerCase()
  if (id.includes('claude')) return 'claude'
  if (id.includes('codex')) return 'codex'
  if (id.includes('gemini')) return 'gemini'
  if (id.includes('grok')) return 'grok'
  return 'claude'
}

export function buildDefaultChecklist(doneCount = 0): ChecklistItem[] {
  const labels = [
    'Intake received',
    'World Model graph allocated',
    'Guardian policy scaffold created',
    'MCP bridge credentials prepared',
    'Bootstrap packet ready',
  ]
  return labels.map((label, i) => ({ label, done: i < doneCount }))
}

export function createDemoIntakeId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `demo_${Date.now().toString(36)}_${rand}`
}

export function saveIntakeSession(session: IntakeSession): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
    sessionStorage.setItem(`${KEY}:${session.intakeId}`, JSON.stringify(session))
  } catch {
    // ignore quota / private mode
  }
}

export function loadIntakeSession(intakeId: string): IntakeSession | null {
  if (typeof window === 'undefined') return null
  try {
    const keyed = sessionStorage.getItem(`${KEY}:${intakeId}`)
    if (keyed) return JSON.parse(keyed) as IntakeSession

    const latest = sessionStorage.getItem(KEY)
    if (!latest) return null
    const parsed = JSON.parse(latest) as IntakeSession
    return parsed.intakeId === intakeId ? parsed : null
  } catch {
    return null
  }
}

export function updateIntakeSession(
  intakeId: string,
  patch: Partial<IntakeSession>
): IntakeSession | null {
  const current = loadIntakeSession(intakeId)
  if (!current || current.intakeId !== intakeId) return null
  const next = { ...current, ...patch }
  saveIntakeSession(next)
  return next
}

export function normalizeApiStatus(status: string | undefined): IntakeStatus {
  const s = (status ?? '').toLowerCase()
  if (s === 'activated') return 'Activated'
  if (s === 'provisioned') return 'Provisioned'
  if (s === 'provisioning') return 'Provisioning'
  if (s === 'under review' || s === 'under_review' || s === 'pending') return 'Under Review'
  return 'Under Review'
}
