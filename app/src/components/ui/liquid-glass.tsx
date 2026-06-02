import * as React from 'react'
import { cn } from '@/lib/utils'

export const LiquidGlassButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'>
>(({ className, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'relative isolate inline-flex items-center justify-center overflow-hidden rounded-lg',
        'border border-white/40 bg-white/10 text-foreground backdrop-blur-md dark:border-white/10 dark:bg-white/5',
        'shadow-[inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.7),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.25),0_4px_14px_rgba(0,0,0,0.12)]',
        'transition-transform duration-300 hover:scale-105 active:scale-95',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  )
})
LiquidGlassButton.displayName = 'LiquidGlassButton'
