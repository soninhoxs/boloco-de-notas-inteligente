import { useEffect, useRef, useCallback, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { LiquidGlassButton } from '@/components/ui/liquid-glass'
import { LocationPicker } from '@/components/global/LocationPicker'
import { cn } from '@/lib/utils'
import type {
  NewNoteInput,
  NoteAttachment,
  NoteLocation,
} from '@/types/notes'
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
}

const quickTags = [
  { icon: Lightbulb, label: 'Ideia', prefix: '💡 Ideia: ' },
  { icon: ListTodo, label: 'Tarefa', prefix: '✅ Tarefa: ' },
  { icon: Heart, label: 'Gratidão', prefix: '🙏 Gratidão: ' },
  { icon: Bell, label: 'Lembrete', prefix: '🔔 Lembrete: ' },
]

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

export function ThoughtComposer({ onSubmit }: ThoughtComposerProps) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<NoteAttachment[]>([])
  const [location, setLocation] = useState<NoteLocation | null>(null)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  })

  const hasContent = value.trim() || attachments.length > 0 || location

  const submit = () => {
    if (!hasContent) return
    onSubmit({
      text: value,
      attachments: attachments.length > 0 ? attachments : undefined,
      location: location ?? undefined,
    })
    setValue('')
    setAttachments([])
    setLocation(null)
    adjustHeight(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const applyTag = (prefix: string) => {
    setValue((prev) => (prev.startsWith(prefix) ? prev : prefix + prev))
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
            placeholder="No que você está pensando hoje?"
            className={cn(
              'w-full resize-none border-none bg-transparent px-4 py-3 text-sm text-foreground',
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
                      aria-label="Remover anexo"
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
                  {location.label ||
                    `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                  {location.task ? ` — ${location.task}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setLocation(null)}
                  aria-label="Remover local"
                  className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between p-3">
          <div className="flex flex-wrap items-center gap-2">
            {quickTags.map((tag) => (
              <button
                key={tag.label}
                type="button"
                onClick={() => applyTag(tag.prefix)}
                className="group flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-ring hover:bg-muted hover:text-foreground"
              >
                <tag.icon className="size-3.5" />
                {tag.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-ring hover:bg-muted hover:text-foreground"
            >
              <Paperclip className="size-3.5" />
              Imagem/PDF
            </button>

            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className={cn(
                'group flex items-center gap-1 rounded-lg border border-dashed px-2 py-1 text-xs transition-colors hover:border-ring hover:bg-muted hover:text-foreground',
                location
                  ? 'border-ring bg-muted text-foreground'
                  : 'border-border text-muted-foreground'
              )}
            >
              <MapPin className="size-3.5" />
              Local
            </button>

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
            aria-label="Salvar pensamento"
            className={cn(
              'p-2 border-transparent transition-opacity',
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
