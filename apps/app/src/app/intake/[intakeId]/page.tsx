import type { Metadata } from 'next'
import IntakeStatusClient from './IntakeStatusClient'
import { apiPath } from '@/lib/urls'

interface IntakeData {
  intakeId: string
  status: 'Under Review' | 'Provisioned' | 'Activated'
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
  try {
    const res = await fetch(apiPath(`/api/intake/${intakeId}`), {
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    return (await res.json()) as IntakeData
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
          XIOM / Intake / {intakeId.slice(0, 8)}…
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">Agent Intake Status</h1>
        <p className="text-sm text-white/40 mb-10">
          Your agent is being provisioned. This page polls for updates automatically every 30 seconds.
        </p>
        <IntakeStatusClient intakeId={intakeId} initialData={data} />
      </div>
    </main>
  )
}
