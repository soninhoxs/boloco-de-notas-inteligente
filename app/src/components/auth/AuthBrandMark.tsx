import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type AuthBrandMarkProps = {
  className?: string
  iconClassName?: string
}

export function AuthBrandMark({ className, iconClassName }: AuthBrandMarkProps) {
  return (
    <div
      className={cn(
        'flex size-14 shrink-0 items-center justify-center rounded-2xl',
        'bg-primary text-primary-foreground shadow-sm',
        className,
      )}
      aria-hidden
    >
      <Sparkles className={cn('size-7', iconClassName)} />
    </div>
  )
}
