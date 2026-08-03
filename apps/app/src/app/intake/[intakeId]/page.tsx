import type { Metadata } from 'next'
import IntakeStatusClient from './IntakeStatusClient'
import { apiPath } from '@/lib/urls'
import { normalizeApiStatus, type IntakeStatus } from '@/lib/intake-session'

interface IntakeData {
  intakeId: string
  status: IntakeStatus
  name?: string
  agentName?: string
  assistantId?: string
  provisioningCapsule?: {
    launchChecklist?: Array<{ label: string; done: boolean }>
    bootstrapCommand?: string
    assistantId?: string
  }
}

interface PageProps {
  params: Promise<{ intakeId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { intakeId } = await params
  return {
    title: `Agent Intake · ${intakeId.slice(0, 8)}`,
    description: 'Your XIOM agent is being provisioned.',
  }
}

async function fetchIntakeData(intakeId: string): Promise<IntakeData | null> {
  if (intakeId.startsWith('demo_')) return null
  try {
    const res = await fetch(apiPath(`/api/intake/${intakeId}`), {
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    const json = (await res.json()) as Record<string, unknown>
    const data: IntakeData = {
      intakeId,
      status: normalizeApiStatus(String(json['status'] ?? '')),
    }
    if (typeof json['name'] === 'string') data.name = json['name']
    if (typeof json['agentName'] === 'string') data.agentName = json['agentName']
    if (typeof json['assistantId'] === 'string') data.assistantId = json['assistantId']
    if (json['provisioningCapsule'] != null) {
      data.provisioningCapsule = json[
        'provisioningCapsule'
      ] as NonNullable<IntakeData['provisioningCapsule']>
    }
    return data
  } catch {
    return null
  }
}

export default async function IntakePage({ params }: PageProps) {
  const { intakeId } = await params
  const data = await fetchIntakeData(intakeId)

  return (
    <main className="min-h-screen bg-black pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30 mb-6">
          XIOM / Intake / {intakeId.slice(0, 10)}…
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2 tracking-tight">
          Your agent is coming online
        </h1>
        <p className="text-sm text-white/40 mb-10 leading-relaxed max-w-xl">
          Intake received. Watch provisioning complete, then download Desktop and pair to
          unlock memory and governance on your AI provider.
        </p>
        <IntakeStatusClient intakeId={intakeId} initialData={data} />
      </div>
    </main>
  )
}
