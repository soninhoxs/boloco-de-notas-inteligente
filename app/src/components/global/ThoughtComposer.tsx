import { useEffect, useRef, useCallback, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { LiquidGlassButton } from '@/components/ui/liquid-glass'
import { LocationPicker } from '@/components/global/LocationPicker'
import { AiAssistantBar } from '@/components/global/AiAssistantBar'
import { useAiSuggestions } from '@/hooks/useAiSuggestions'
import { cn } from '@/lib/utils'
import {
  detectNoteCategory,
  stripNoteTagPrefix,
  getNoteTagPrefixes,
} from '@/lib/note-tags'
import { useI18n } from '@/contexts/I18nContext'
import type {
  NewNoteInput,
  Note,
  NoteAttachment,
  NoteLocation,
} from '@/types/notes'
import { toggleSuggestionInNoteText } from '@/lib/ai-suggestion-format'
import type { AiConfig } from '@/services/ai'
import type { AiProvider } from '@/types/settings'
import type { SettingsFocusTarget } from '@/lib/settings-navigation'
import {
  ArrowUpIcon,
  Lightbulb,
  ListTodo,
  Heart,
  Bell,
  Paperclip,
  MapPin,
  FileText,
  X,
} from 'lucide-react'

interface UseAutoResizeTextareaProps {
  minHeight: number
  maxHeight?: number
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current
      if (!textarea) return

      if (reset) {
        textarea.style.height = `${minHeight}px`
        return
      }

      textarea.style.height = `${minHeight}px`

      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      )

      textarea.style.height = `${newHeight}px`
    },
    [minHeight, maxHeight]
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = `${minHeight}px`
    }
  }, [minHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [adjustHeight])

  return { textareaRef, adjustHeight }
}

interface ThoughtComposerProps {
  onSubmit: (note: NewNoteInput) => void
  aiConfig: AiConfig
  onOpenSettings: (target?: SettingsFocusTarget) => void
  onUpdateAiSettings: (patch: {
    aiProvider?: AiProvider
    aiModel?: string
  }) => void
  notes: Note[]
}

const quickTagKeys = [
  { icon: Lightbulb, labelKey: 'composer.tag.idea' as const, category: 'idea' as const },
  { icon: ListTodo, labelKey: 'composer.tag.task' as const, category: 'task' as const },
  { icon: Heart, labelKey: 'composer.tag.gratitude' as const, category: 'gratitude' as const },
  { icon: Bell, labelKey: 'composer.tag.reminder' as const, category: 'reminder' as const },
]

function ComposerToolButton({
  active,
  label,
  onClick,
  icon: Icon,
}: {
  active: boolean
  label: string
  onClick: () => void
  icon: React.ElementType
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed px-0.5 transition-colors hover:border-ring hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-ring bg-muted font-medium text-foreground'
          : 'border-border text-muted-foreground'
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="w-full truncate text-center text-[11px] leading-none sm:text-xs">
        {label}
      </span>
    </button>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ThoughtComposer({
  onSubmit,
  aiConfig,
  onOpenSettings,
  onUpdateAiSettings,
  notes,
}: ThoughtComposerProps) {
  const { t, language } = useI18n()
  const tagPrefixes = getNoteTagPrefixes(language)
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<NoteAttachment[]>([])
  const [location, setLocation] = useState<NoteLocation | null>(null)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevCategoryRef = useRef<string | null>(null)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  })
  const {
    suggestions,
    isLoading: isAiLoading,
    error: aiError,
    requestSuggestions,
    clearSuggestions,
  } = useAiSuggestions({ config: aiConfig, notes })

  const category = detectNoteCategory(value)
  const content = stripNoteTagPrefix(value)
  const showAiBar = category === 'idea' || category === 'task'

  useEffect(() => {
    const key = category ?? 'none'
    if (prevCategoryRef.current !== null && prevCategoryRef.current !== key) {
      clearSuggestions()
    }
    prevCategoryRef.current = key
  }, [category, clearSuggestions])

  const hasContent = value.trim() || attachments.length > 0 || location

  const submit = () => {
    if (!hasContent) return
    onSubmit({
      text: value,
      attachments: attachments.length > 0 ? attachments : undefined,
      location: location ?? undefined,
      aiProvider: aiConfig.provider,
      aiModel: aiConfig.model,
    })
    setValue('')
    setAttachments([])
    setLocation(null)
    clearSuggestions()
    adjustHeight(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const applyTag = (prefix: string) => {
    setValue((prev) => {
      if (prev.startsWith(prefix)) return stripNoteTagPrefix(prev)
      return prefix + stripNoteTagPrefix(prev)
    })
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (ta) {
        ta.focus()
        const end = ta.value.length
        ta.setSelectionRange(end, end)
      }
      adjustHeight()
    })
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const accepted = Array.from(files).filter(
      (file) =>
        file.type.startsWith('image/') || file.type === 'application/pdf'
    )
    const loaded = await Promise.all(
      accepted.map(async (file) => {
        const dataUrl = await readFileAsDataUrl(file)
        const attachment: NoteAttachment = {
          id: createId(),
          name: file.name,
          kind: file.type === 'application/pdf' ? 'pdf' : 'image',
          dataUrl,
        }
        return attachment
      })
    )
    setAttachments((prev) => [...prev, ...loaded])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleAskAi = () => {
    if (!category || isAiLoading) return
    void requestSuggestions(category, content)
  }

  const handleApplySuggestion = (suggestion: string) => {
    if (!category) return
    const prefix = tagPrefixes[category]
    setValue((prev) => {
      const base = prev.startsWith(prefix) ? prev : prefix + prev
      return toggleSuggestionInNoteText(base, suggestion)
    })
    requestAnimationFrame(() => adjustHeight())
  }

  return (
    <div className="w-full">
      <div className="relative rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-y-auto">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('composer.placeholder')}
            className={cn(
              'w-full resize-none border-none bg-transparent px-4 py-3 text-base text-foreground',
              'shadow-none focus-visible:ring-0',
              'placeholder:text-muted-foreground',
              'min-h-[60px]'
            )}
            style={{ overflow: 'hidden' }}
          />
        </div>

        {(attachments.length > 0 || location) && (
          <div className="flex flex-col gap-2 px-3 pb-1">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="group relative overflow-hidden rounded-lg border border-border bg-muted"
                  >
                    {attachment.kind === 'image' ? (
                      <img
                        src={attachment.dataUrl}
                        alt={attachment.name}
                        className="h-16 w-16 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 p-1 text-center">
                        <FileText className="size-5 text-muted-foreground" />
                        <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                          {attachment.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      aria-label={t('composer.removeAttachment')}
                      className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {location && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2 py-1.5 text-xs">
                <MapPin className="size-4 shrink-0 text-red-500" />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {location.city && location.state
                    ? `${location.city} - ${location.state}`
                    : location.label ||
                      `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                  {location.task ? `: ${location.task}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setLocation(null)}
                  aria-label={t('composer.removeLocation')}
                  className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {showAiBar && category && (
          <AiAssistantBar
            category={category}
            content={content}
            noteText={value}
            aiConfig={aiConfig}
            isLoading={isAiLoading}
            error={aiError}
            suggestions={suggestions}
            onRequest={handleAskAi}
            onApplySuggestion={handleApplySuggestion}
            onOpenSettings={onOpenSettings}
            onUpdateAiSettings={onUpdateAiSettings}
            onDismissSuggestions={clearSuggestions}
          />
        )}

        <div className="flex items-center gap-2 border-t border-border p-2">
          <div className="grid min-w-0 flex-1 grid-cols-6 gap-1">
            {quickTagKeys.map((tag) => {
              const prefix = tagPrefixes[tag.category]
              const label = t(tag.labelKey)
              return (
                <ComposerToolButton
                  key={tag.category}
                  active={value.startsWith(prefix)}
                  label={label}
                  icon={tag.icon}
                  onClick={() => applyTag(prefix)}
                />
              )
            })}

            <ComposerToolButton
              active={false}
              label={t('composer.attachment')}
              icon={Paperclip}
              onClick={() => fileInputRef.current?.click()}
            />

            <ComposerToolButton
              active={Boolean(location)}
              label={t('composer.location')}
              icon={MapPin}
              onClick={() => setIsPickerOpen(true)}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          <LiquidGlassButton
            onClick={submit}
            disabled={!hasContent}
            aria-label={t('composer.save')}
            className={cn(
              'size-11 shrink-0 border-transparent transition-opacity',
              hasContent
                ? 'bg-foreground text-background hover:opacity-90'
                : 'opacity-30'
            )}
          >
            <ArrowUpIcon className="size-4" />
          </LiquidGlassButton>
        </div>
      </div>

      <LocationPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        initialLocation={location}
        onConfirm={setLocation}
      />
    </div>
  )
}
