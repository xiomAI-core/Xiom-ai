interface MultiSelectProps {
  options: Array<{ id: string; label: string }>
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function MultiSelect({ options, selected, onChange }: MultiSelectProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected.includes(opt.id)
        return (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={[
              'px-3 py-1.5 text-xs font-medium tracking-wider uppercase border transition-all',
              isSelected
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-white border-white/20 hover:border-white/40',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
