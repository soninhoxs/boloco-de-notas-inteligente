import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SettingsSelectOption {
  value: string
  label: string
}

interface SettingsSelectProps {
  value: string
  onChange: (value: string) => void
  options: SettingsSelectOption[]
  className?: string
  size?: 'default' | 'compact'
  ariaLabel?: string
}

export function SettingsSelect({
  value,
  onChange,
  options,
  className,
  size = 'default',
  ariaLabel,
}: SettingsSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', size === 'compact' ? 'min-w-[5.5rem]' : 'min-w-[11rem]', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center justify-between gap-1.5 rounded-lg border border-input',
          'bg-card text-foreground transition-colors',
          'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'border-ring ring-2 ring-ring/30',
          size === 'compact' ? 'h-10 px-2 text-xs' : 'h-9 px-2.5 text-sm'
        )}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute top-[calc(100%+0.375rem)] right-0 z-50 min-w-full overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    isSelected
                      ? 'bg-primary/10 font-medium text-foreground'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
