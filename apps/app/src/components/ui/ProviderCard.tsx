interface ProviderCardProps {
  id: string
  name: string
  icon: string
  description: string
  isSelected: boolean
  onClick: () => void
}

export default function ProviderCard({
  name,
  icon,
  description,
  isSelected,
  onClick,
}: ProviderCardProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left p-5 border transition-all',
        isSelected
          ? 'border-white/40 bg-white/[0.06]'
          : 'border-white/10 bg-transparent hover:border-white/20 hover:bg-white/[0.03]',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{icon}</span>
        <div>
          <div className="text-sm font-medium text-white mb-1">{name}</div>
          <div className="text-xs text-white/45 leading-relaxed">{description}</div>
        </div>
        {isSelected && (
          <div className="ml-auto shrink-0 w-2 h-2 rounded-full bg-white mt-1" />
        )}
      </div>
    </button>
  )
}
