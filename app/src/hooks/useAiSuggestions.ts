import { useCallback, useState } from 'react'
import type { NoteCategory } from '@/lib/note-tags'
import type { Note } from '@/types/notes'
import {
  fetchAiSuggestions,
  type AiConfig,
} from '@/services/ai'
import { AiServiceError } from '@/services/ai-errors'
import { useI18n } from '@/contexts/I18nContext'
import { useAuth } from '@/contexts/AuthContext'
import { api, ApiError } from '@/services/api'

interface UseAiSuggestionsOptions {
  config: AiConfig
  notes?: Note[]
  noteId?: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function useAiSuggestions({ config, notes = [], noteId }: UseAiSuggestionsOptions) {
  const { t } = useI18n()
  const { isAuthenticated, isGuest } = useAuth()
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const useBackend =
    isAuthenticated &&
    !isGuest &&
    !!noteId &&
    UUID_RE.test(noteId) &&
    config.enabled

  const requestSuggestions = useCallback(
    async (
      category: NoteCategory,
      content: string,
      excludeNoteId?: string
    ) => {
      setIsLoading(true)
      setError(null)
      try {
        if (useBackend && noteId) {
          const job = await api.ai.requestSuggestions(
            noteId,
            config.provider,
            config.model
          )
          const result = await api.ai.pollForResult(job.job_id)
          if (result.status === 'failed') {
            throw new ApiError(500, result.error || 'AI request failed')
          }
          const lines =
            result.suggestions?.map((s) => s.content).filter(Boolean) ?? []
          setSuggestions(lines)
          return lines
        }

        const result = await fetchAiSuggestions(
          config,
          category,
          content,
          { notes, excludeNoteId }
        )
        setSuggestions(result)
        return result
      } catch (err) {
        const message =
          err instanceof AiServiceError
            ? t(err.code, err.params)
            : err instanceof ApiError
              ? err.message
              : t('ai.error.generic')
        setError(message)
        setSuggestions([])
        return []
      } finally {
        setIsLoading(false)
      }
    },
    [config, notes, noteId, t, useBackend]
  )

  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    setError(null)
  }, [])

  return {
    suggestions,
    isLoading,
    error,
    requestSuggestions,
    clearSuggestions,
    useBackend,
  }
}
