import { Moon, Sun } from 'lucide-react'
import type { Theme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  theme: Theme
  onToggle: () => void
  className?: string
}

export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Alternar tema"
      title="Alternar tema"
      className={cn(
        'fixed top-4 right-4 z-30 inline-flex size-10 items-center justify-center overflow-hidden rounded-lg border border-white/40 bg-white/10 text-foreground backdrop-blur-md transition-transform duration-300 hover:scale-105 active:scale-95 dark:border-white/10 dark:bg-white/5',
        'shadow-[inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.7),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.25),0_4px_14px_rgba(0,0,0,0.12)]',
        className
      )}
    >
      <Sun
        className={cn(
          'absolute size-5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          theme === 'light'
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-5 scale-50 opacity-0'
        )}
      />
      <Moon
        className={cn(
          'absolute size-5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          theme === 'dark'
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-5 scale-50 opacity-0'
        )}
      />
    </button>
  )
}
