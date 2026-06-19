import type { NoteCategory } from '@/lib/note-tags'
import type { AiConfig } from '@/services/ai'
import { AiSuggestionsPanel } from '@/components/global/AiSuggestionsPanel'
import { AiModelPickerWithDefaults } from '@/components/global/AiModelPicker'
import { useI18n } from '@/contexts/I18nContext'
import type { AiProvider } from '@/types/settings'
import type { SettingsFocusTarget } from '@/lib/settings-navigation'
import { Sparkles, Loader2, Settings, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AiAssistantBarProps {
  category: NoteCategory
  content: string
  noteText?: string
  aiConfig: AiConfig
  isLoading: boolean
  error: string | null
  suggestions: string[]
  onRequest: () => void
  onApplySuggestion?: (suggestion: string) => void
  onOpenSettings: (target?: SettingsFocusTarget) => void
  onUpdateAiSettings: (patch: {
    aiProvider?: AiProvider
    aiModel?: string
  }) => void
  onDismissSuggestions?: () => void
}

const actionButtonClass =
  'flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function AiAssistantBar({
  category,
  content,
  noteText = '',
  aiConfig,
  isLoading,
  error,
  suggestions,
  onRequest,
  onApplySuggestion,
  onOpenSettings,
  onUpdateAiSettings,
  onDismissSuggestions,
}: AiAssistantBarProps) {
  const { t } = useI18n()

  if (category !== 'idea' && category !== 'task') return null

  const trimmed = content.trim()
  const hasApiKey = aiConfig.apiKey.trim().length > 0
  const hasEnoughText = trimmed.length >= 3
  const canRequest = aiConfig.enabled && hasApiKey && hasEnoughText && !isLoading
  const needsEnable = !aiConfig.enabled
  const needsApiKey = aiConfig.enabled && !hasApiKey

  const title = category === 'idea' ? t('ai.ideaTitle') : t('ai.taskTitle')
  const hint = category === 'idea' ? t('ai.ideaHint') : t('ai.taskHint')
  const button = category === 'idea' ? t('ai.ideaButton') : t('ai.taskButton')

  const statusMessage = !aiConfig.enabled
    ? t('ai.enableHint')
    : !hasApiKey
      ? t('ai.apiKeyHint')
      : !hasEnoughText
        ? t('ai.minCharsHint')
        : hint

  const handlePrimaryAction = () => {
    if (needsEnable || needsApiKey) {
      onOpenSettings(needsApiKey ? 'ai-key' : 'ai')
      return
    }
    if (canRequest) onRequest()
  }

  const showSuggestions = isLoading || error || suggestions.length > 0

  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Sparkles
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />

        <p className="min-w-0 flex-1 truncate text-sm text-foreground">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">{statusMessage}</span>
        </p>

        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={
            isLoading ||
            (aiConfig.enabled && hasApiKey && !hasEnoughText)
          }
          className={cn(
            actionButtonClass,
            needsEnable || needsApiKey
              ? 'border border-border bg-card text-foreground hover:bg-accent'
              : canRequest || isLoading
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-not-allowed bg-muted text-muted-foreground'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              <span className="hidden sm:inline">{t('ai.generating')}</span>
            </>
          ) : needsEnable || needsApiKey ? (
            <>
              {needsApiKey ? (
                <KeyRound className="size-4" aria-hidden />
              ) : (
                <Settings className="size-4" aria-hidden />
              )}
              <span className="hidden sm:inline">
                {needsApiKey ? t('ai.apiKey') : t('ai.enable')}
              </span>
              <span className="sm:hidden">{t('ai.configShort')}</span>
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              <span className="hidden md:inline">{button}</span>
              <span className="md:hidden">{t('ai.buttonShort')}</span>
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2">
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {t('ai.model')}
        </span>
        <AiModelPickerWithDefaults
          className="min-w-0 flex-1"
          provider={aiConfig.provider}
          model={aiConfig.model}
          onUpdate={onUpdateAiSettings}
        />
      </div>

      {showSuggestions && (
        <div className="border-t border-border px-3 pb-3 pt-2">
          <AiSuggestionsPanel
            suggestions={suggestions}
            isLoading={isLoading}
            error={error}
            noteText={noteText}
            onDismiss={onDismissSuggestions}
            onSuggestionClick={onApplySuggestion}
            interactive={Boolean(onApplySuggestion)}
          />
        </div>
      )}
    </div>
  )
}
