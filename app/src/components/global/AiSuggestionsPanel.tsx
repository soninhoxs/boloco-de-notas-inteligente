import { Sparkles, Loader2, AlertCircle, X, Plus, Copy, Check, Minus } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import type { TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  formatSuggestionForNote,
  isSuggestionInNoteText,
  parseSuggestionLabel,
} from '@/lib/ai-suggestion-format'

interface AiSuggestionsPanelProps {
  suggestions: string[]
  isLoading: boolean
  error: string | null
  noteText?: string
  onDismiss?: () => void
  onSuggestionClick?: (suggestion: string) => void
  interactive?: boolean
  className?: string
}

function resolvePanelTitle(
  suggestions: string[],
  t: (key: TranslationKey | string) => string
): string {
  const first = suggestions[0] ?? ''
  if (/^Opção \d+/i.test(first) || /^Para agora/i.test(first)) {
    return t('ai.tipsTitlePractical')
  }
  if (/^Nível \d+/i.test(first)) {
    return t('ai.tipsTitleDevelopment')
  }
  return t('ai.tipsTitle')
}

function splitSuggestion(suggestion: string): { label: string | null; body: string } {
  return parseSuggestionLabel(suggestion)
}

export function AiSuggestionsPanel({
  suggestions,
  isLoading,
  error,
  noteText = '',
  onDismiss,
  onSuggestionClick,
  interactive = false,
  className,
}: AiSuggestionsPanelProps) {
  const { t } = useI18n()
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  if (!isLoading && !error && suggestions.length === 0) return null

  const handleCopy = async (suggestion: string, index: number) => {
    try {
      await navigator.clipboard.writeText(formatSuggestionForNote(suggestion))
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {isLoading ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-5" aria-hidden />
          )}
          {isLoading
            ? t('ai.generatingTips')
            : resolvePanelTitle(suggestions, t)}
        </div>
        {onDismiss && !isLoading && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('ai.closeTips')}
            className="rounded-md p-2 text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {!error && suggestions.length > 0 && (
        <ul className="space-y-2.5">
          {suggestions.map((suggestion, index) => {
            const { label, body } = splitSuggestion(suggestion)
            const isAdded =
              Boolean(noteText) &&
              isSuggestionInNoteText(noteText, suggestion)

            const content = (
              <>
                {label && (
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                )}
                <span className={label ? 'block' : undefined}>{body || suggestion}</span>
              </>
            )

            return (
              <li key={`${index}-${suggestion.slice(0, 24)}`}>
                {interactive && onSuggestionClick ? (
                  <button
                    type="button"
                    onClick={() => onSuggestionClick(suggestion)}
                    aria-label={
                      isAdded ? t('ai.removeFromNote') : t('ai.addToNote')
                    }
                    aria-pressed={isAdded}
                    className={cn(
                      'group flex min-h-11 w-full items-start gap-3 rounded-lg border px-3 py-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isAdded
                        ? 'border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15'
                        : 'border-border bg-card text-foreground hover:border-ring hover:bg-accent'
                    )}
                  >
                    {isAdded ? (
                      <Minus
                        className="mt-0.5 size-5 shrink-0 text-primary"
                        aria-hidden
                      />
                    ) : (
                      <Plus
                        className="mt-0.5 size-5 shrink-0 text-foreground"
                        aria-hidden
                      />
                    )}
                    <span className="flex-1">{content}</span>
                  </button>
                ) : (
                  <div className="flex min-h-11 items-start gap-3 rounded-lg border border-border bg-card px-3 py-3">
                    <span
                      className="mt-2 size-2 shrink-0 rounded-full bg-foreground"
                      aria-hidden
                    />
                    <span className="flex-1 text-sm leading-relaxed text-foreground">
                      {content}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(suggestion, index)}
                      aria-label={t('ai.copyTip')}
                      className="shrink-0 rounded-md p-2 text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {copiedIndex === index ? (
                        <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="size-5" />
                      )}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
