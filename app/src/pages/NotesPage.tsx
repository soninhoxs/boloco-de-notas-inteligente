import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Note } from '@/types/notes'
import { MasonryGrid } from '@/components/ui/masonry-grid-with-scroll-animation'
import { notesToMasonryItems } from '@/lib/note-masonry'
import { AiSuggestionsPanel } from '@/components/global/AiSuggestionsPanel'
import { useAiSuggestions } from '@/hooks/useAiSuggestions'
import { useI18n } from '@/contexts/I18nContext'
import {
  detectNoteCategory,
  stripNoteTagPrefix,
  isAiSuggestible,
} from '@/lib/note-tags'
import { toggleSuggestionInNoteText } from '@/lib/ai-suggestion-format'
import { resolveNoteAiConfig } from '@/services/ai'
import type { Settings as AppSettings } from '@/types/settings'
import type { SettingsFocusTarget } from '@/lib/settings-navigation'
import { AiModelPickerWithDefaults } from '@/components/global/AiModelPicker'
import { MAP_STYLES } from '@/lib/map-styles'
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
} from '@/components/ui/mapcn-map-controls'
import {
  Trash2,
  NotebookPen,
  FileText,
  MapPin,
  Sparkles,
  Loader2,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function NoteCard({
  note,
  notes,
  onDelete,
  settings,
  onOpenSettings,
  onUpdateNote,
}: {
  note: Note
  notes: Note[]
  onDelete: (id: string) => void
  settings: AppSettings
  onOpenSettings: (target?: SettingsFocusTarget) => void
  onUpdateNote: (
    id: string,
    patch: Partial<Pick<Note, 'aiProvider' | 'aiModel' | 'text'>>
  ) => void
}) {
  const { t, formatDate } = useI18n()
  const aiConfig = resolveNoteAiConfig(settings, note)
  const category = detectNoteCategory(note.text)
  const isAiNote = isAiSuggestible(note.text)
  const hasApiKey = aiConfig.apiKey.trim().length > 0
  const {
    suggestions,
    isLoading: isAiLoading,
    error: aiError,
    requestSuggestions,
    clearSuggestions,
  } = useAiSuggestions({ config: aiConfig, notes, noteId: note.id })
  const [showAi, setShowAi] = useState(false)

  const handleAskAi = async () => {
    if (!category || !isAiNote) return

    if (!aiConfig.enabled) {
      onOpenSettings('ai')
      return
    }
    if (!hasApiKey) {
      onOpenSettings('ai-key')
      return
    }

    setShowAi(true)
    await requestSuggestions(
      category,
      stripNoteTagPrefix(note.text),
      note.id
    )
  }

  const handleApplySuggestion = (suggestion: string) => {
    onUpdateNote(note.id, {
      text: toggleSuggestionInNoteText(note.text, suggestion),
    })
  }

  return (
    <li className="group relative rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <button
        type="button"
        onClick={() => onDelete(note.id)}
        aria-label={t('notes.delete')}
        className="absolute top-3 right-3 shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>

      <div className="min-w-0 space-y-3 pr-8">
        {note.text && (
          <p className="whitespace-pre-wrap break-words text-sm">{note.text}</p>
        )}

        {isAiNote && category && (
          <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-relaxed text-foreground/90">
                {category === 'idea'
                  ? t('notes.expandIdea')
                  : t('notes.helpTask')}
              </p>
              <button
                type="button"
                onClick={handleAskAi}
                disabled={isAiLoading}
                className={cn(
                  'flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  !aiConfig.enabled || !hasApiKey
                    ? 'border border-border bg-card text-foreground hover:bg-accent'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {isAiLoading ? (
                  <>
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                    {t('notes.generating')}
                  </>
                ) : !aiConfig.enabled || !hasApiKey ? (
                  <>
                    <Settings className="size-5" aria-hidden />
                    {!aiConfig.enabled
                      ? t('notes.enableAi')
                      : t('notes.setApiKey')}
                  </>
                ) : (
                  <>
                    <Sparkles className="size-5" aria-hidden />
                    {category === 'idea'
                      ? t('notes.ideaTips')
                      : t('notes.taskTips')}
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 border-t border-border/60 pt-3">
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {t('notes.model')}
              </span>
              <AiModelPickerWithDefaults
                className="min-w-0 flex-1"
                provider={aiConfig.provider}
                model={aiConfig.model}
                onUpdate={(patch) => onUpdateNote(note.id, patch)}
              />
            </div>

            {showAi && (isAiLoading || aiError || suggestions.length > 0) && (
              <div className="mt-4 border-t border-border pt-4">
                <AiSuggestionsPanel
                  suggestions={suggestions}
                  isLoading={isAiLoading}
                  error={aiError}
                  noteText={note.text}
                  interactive
                  onSuggestionClick={handleApplySuggestion}
                  onDismiss={() => {
                    setShowAi(false)
                    clearSuggestions()
                  }}
                />
              </div>
            )}
          </div>
        )}

        {note.attachments && note.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {note.attachments.map((attachment) =>
              attachment.kind === 'image' ? (
                <a
                  key={attachment.id}
                  href={attachment.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-border"
                >
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    className="h-24 w-24 object-cover transition-transform hover:scale-105"
                  />
                </a>
              ) : (
                <a
                  key={attachment.id}
                  href={attachment.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={attachment.name}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted/50 p-2 text-center transition-colors hover:bg-muted"
                >
                  <FileText className="size-6 text-muted-foreground" />
                  <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                    {attachment.name}
                  </span>
                </a>
              )
            )}
          </div>
        )}

        {note.location && (
          <div className="space-y-2">
            <div className="h-44 w-full touch-none overflow-hidden rounded-lg border border-border">
              <Map
                styles={MAP_STYLES}
                center={[note.location.longitude, note.location.latitude]}
                zoom={14}
                dragPan
                scrollZoom
                touchZoomRotate
                doubleClickZoom
              >
                <MapControls position="top-right" showZoom />
                <MapMarker
                  longitude={note.location.longitude}
                  latitude={note.location.latitude}
                >
                  <MarkerContent>
                    <MapPin className="size-7 fill-red-500 text-red-600 drop-shadow" />
                  </MarkerContent>
                </MapMarker>
              </Map>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-red-500" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {note.location.city && note.location.state
                    ? `${note.location.city} - ${note.location.state}`
                    : note.location.label ||
                      `${note.location.latitude.toFixed(5)}, ${note.location.longitude.toFixed(5)}`}
                </p>
                {note.location.task && (
                  <p className="text-muted-foreground">{note.location.task}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <time className="block text-xs text-muted-foreground">
          {formatDate(new Date(note.createdAt))}
        </time>
      </div>
    </li>
  )
}

interface NotesPageProps {
  notes: Note[]
  onDeleteNote: (id: string) => void
  onUpdateNote: (
    id: string,
    patch: Partial<Pick<Note, 'aiProvider' | 'aiModel' | 'text'>>
  ) => void
  settings: AppSettings
  onOpenSettings: (target?: SettingsFocusTarget) => void
  searchQuery?: string
  onSearchQueryChange?: (query: string) => void
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  useCloud?: boolean
}

export function NotesPage({
  notes,
  onDeleteNote,
  onUpdateNote,
  settings,
  onOpenSettings,
  searchQuery = '',
  onSearchQueryChange,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  useCloud = false,
}: NotesPageProps) {
  const { t, formatDate } = useI18n()
  const [searchDraft, setSearchDraft] = useState(searchQuery)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)

  const categoryLabels = useMemo(
    () => ({
      idea: t('composer.tag.idea'),
      task: t('composer.tag.task'),
      gratitude: t('composer.tag.gratitude'),
      reminder: t('composer.tag.reminder'),
      other: t('notes.category.other'),
    }),
    [t]
  )

  const handleSelectNote = useCallback((noteId: string) => {
    setExpandedNoteId((current) => {
      const next = current === noteId ? null : noteId
      if (next) {
        window.requestAnimationFrame(() => {
          document
            .getElementById('note-detail-panel')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
      return next
    })
  }, [])

  const masonryItems = useMemo(
    () =>
      notesToMasonryItems(notes, categoryLabels, formatDate, handleSelectNote),
    [notes, categoryLabels, formatDate, handleSelectNote]
  )

  const expandedNote = notes.find((note) => note.id === expandedNoteId)

  useEffect(() => {
    setSearchDraft(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    if (!onSearchQueryChange) return
    const timer = window.setTimeout(() => {
      onSearchQueryChange(searchDraft.trim())
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchDraft, onSearchQueryChange])

  useEffect(() => {
    if (expandedNoteId && !notes.some((note) => note.id === expandedNoteId)) {
      setExpandedNoteId(null)
    }
  }, [notes, expandedNoteId])

  const notesSubtitle =
    notes.length === 0
      ? t('notes.empty')
      : notes.length === 1
        ? t('notes.countOne')
        : t('notes.countMany', { count: notes.length })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-16">
        <header className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{t('notes.title')}</h1>
            <p className="text-muted-foreground">{notesSubtitle}</p>
          </div>
          {useCloud && onSearchQueryChange && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder={t('notes.searchPlaceholder')}
                className="pl-9 pr-9"
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={() => setSearchDraft('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t('notes.clearSearch')}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}
        </header>

        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 py-12 text-center text-muted-foreground">
            <NotebookPen className="size-8 opacity-50" />
            <p className="text-sm">{t('notes.emptyHint')}</p>
          </div>
        ) : (
          <>
            {expandedNote && (
              <ul
                id="note-detail-panel"
                className="scroll-mt-24 space-y-3 rounded-xl border border-border bg-card/50 p-4 shadow-sm"
              >
                <NoteCard
                  note={expandedNote}
                  notes={notes}
                  onDelete={(id) => {
                    onDeleteNote(id)
                    if (expandedNoteId === id) setExpandedNoteId(null)
                  }}
                  settings={settings}
                  onOpenSettings={onOpenSettings}
                  onUpdateNote={onUpdateNote}
                />
              </ul>
            )}

            <MasonryGrid items={masonryItems} selectedId={expandedNoteId} />

            {useCloud && hasMore && onLoadMore && (
              <div className="flex justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoadingMore}
                  onClick={() => void onLoadMore()}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('notes.loadingMore')}
                    </>
                  ) : (
                    t('notes.loadMore')
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
