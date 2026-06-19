import { useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'

interface ToastProps {
  message: string
  actionLabel?: string
  onAction?: () => void
  onClose: () => void
  duration?: number
}

export function Toast({
  message,
  actionLabel,
  onAction,
  onClose,
  duration = 3500,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div className="fixed bottom-4 right-4 z-[60] animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-card-foreground shadow-lg">
        <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
        <span className="text-sm">{message}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-sm font-medium text-primary hover:underline"
          >
            {actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="ml-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
