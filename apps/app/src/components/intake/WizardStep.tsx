interface WizardStepProps {
  stepNumber: number
  totalSteps: number
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function WizardStep({
  stepNumber,
  totalSteps,
  title,
  subtitle,
  children,
}: WizardStepProps) {
  const progress = (stepNumber / totalSteps) * 100

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="w-full h-px bg-white/10 mb-8">
        <div
          className="h-px bg-white transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicator */}
      <div className="font-mono text-[10px] text-white/35 uppercase tracking-[0.15em] mb-4">
        Step {stepNumber} of {totalSteps}
      </div>

      {/* Title */}
      <h2 className="text-2xl font-semibold text-white mb-2">{title}</h2>
      {subtitle && (
        <p className="text-sm text-white/45 mb-8 leading-relaxed">{subtitle}</p>
      )}

      {/* Content */}
      <div>{children}</div>
    </div>
  )
}
