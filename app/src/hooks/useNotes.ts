import { useCallback, useEffect, useRef, useState } from 'react'
import type { Note, NewNoteInput } from '@/types/notes'
import {
  canPersistUserData,
  COOKIE_CONSENT_ACCEPTED_EVENT,
} from '@/lib/cookie-consent'
import { useAuth } from '@/contexts/AuthContext'
import { api, ApiError } from '@/services/api'
import {
  apiNoteToLocal,
  localInputToApiCreate,
  localPatchToApiUpdate,
} from '@/lib/note-api-mapper'
import { uploadNoteAttachments } from '@/lib/note-attachments'
import {
  hasPendingLocalMigration,
  migrateLocalNotesToCloud,
} from '@/lib/migrate-local-notes'

const STORAGE_KEY = 'thoughts'
const PAGE_SIZE = 50

function loadLocalNotes(): Note[] {
  if (!canPersistUserData()) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Note[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useNotes() {
  const { isAuthenticated, isGuest } = useAuth()
  const useCloud = isAuthenticated && !isGuest

  const [notes, setNotes] = useState<Note[]>(() =>
    useCloud ? [] : loadLocalNotes()
  )
  const [isLoading, setIsLoading] = useState(useCloud)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const cursorRef = useRef<string | undefined>(undefined)
  const migratedRef = useRef(false)

  const clearError = useCallback(() => setError(null), [])

  const loadCloudNotes = useCallback(async (reset = true) => {
    if (reset) {
      setIsLoading(true)
      cursorRef.current = undefined
    } else {
      setIsLoadingMore(true)
    }
    setError(null)

    try {
      if (reset && hasPendingLocalMigration() && !migratedRef.current) {
        migratedRef.current = true
        await migrateLocalNotesToCloud()
      }

      if (searchQuery.trim()) {
        const searchPage = await api.notes.search(searchQuery.trim(), PAGE_SIZE)
        setNotes(searchPage.notes.map(apiNoteToLocal))
        setHasMore(false)
      } else {
        const page = await api.notes.list({
          cursor: reset ? undefined : cursorRef.current,
          limit: PAGE_SIZE,
        })
        const incoming = page.notes.map(apiNoteToLocal)
        cursorRef.current = page.next_cursor
        setHasMore(page.has_more)
        setNotes((prev) => (reset ? incoming : [...prev, ...incoming]))
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'notes.error.loadFailed'
      setError(message)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [searchQuery])

  useEffect(() => {
    if (useCloud) {
      void loadCloudNotes(true)
      return
    }
    setNotes(loadLocalNotes())
    setIsLoading(false)
    setError(null)
    setHasMore(false)
  }, [useCloud, loadCloudNotes])

  useEffect(() => {
    if (!useCloud || !canPersistUserData()) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes, useCloud])

  useEffect(() => {
    const reload = () => {
      if (!useCloud) setNotes(loadLocalNotes())
    }
    window.addEventListener(COOKIE_CONSENT_ACCEPTED_EVENT, reload)
    return () => window.removeEventListener(COOKIE_CONSENT_ACCEPTED_EVENT, reload)
  }, [useCloud])

  const addNote = async (input: NewNoteInput) => {
    const trimmed = input.text.trim()
    const hasAttachments = (input.attachments?.length ?? 0) > 0
    const hasLocation = !!input.location
    if (!trimmed && !hasAttachments && !hasLocation) return

    if (useCloud) {
      try {
        const attachments = input.attachments?.length
          ? await uploadNoteAttachments(input.attachments)
          : undefined
        const created = await api.notes.create(
          localInputToApiCreate({ ...input, text: trimmed }, attachments)
        )
        const local = apiNoteToLocal(created)
        setNotes((prev) => [local, ...prev])
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'notes.error.createFailed'
        setError(message)
        throw err
      }
      return
    }

    const note: Note = {
      id: createId(),
      text: trimmed,
      createdAt: Date.now(),
      attachments: hasAttachments ? input.attachments : undefined,
      location: input.location,
      aiProvider: input.aiProvider,
      aiModel: input.aiModel,
    }
    setNotes((prev) => [note, ...prev])
  }

  const updateNote = async (id: string, patch: Partial<Note>) => {
    if (useCloud) {
      try {
        let nextPatch = patch
        if (patch.attachments?.length) {
          const uploaded = await uploadNoteAttachments(patch.attachments)
          nextPatch = { ...patch, attachments: uploaded }
        }
        const updated = await api.notes.update(id, localPatchToApiUpdate(nextPatch))
        const local = apiNoteToLocal(updated)
        setNotes((prev) =>
          prev.map((note) => (note.id === id ? local : note))
        )
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'notes.error.updateFailed'
        setError(message)
        throw err
      }
      return
    }

    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...patch } : note))
    )
  }

  const deleteNote = async (id: string) => {
    if (useCloud) {
      try {
        await api.notes.delete(id)
        setNotes((prev) => prev.filter((note) => note.id !== id))
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'notes.error.deleteFailed'
        setError(message)
        throw err
      }
      return
    }

    setNotes((prev) => prev.filter((note) => note.id !== id))
  }

  const loadMore = useCallback(async () => {
    if (!useCloud || !hasMore || isLoadingMore || searchQuery.trim()) return
    await loadCloudNotes(false)
  }, [useCloud, hasMore, isLoadingMore, searchQuery, loadCloudNotes])

  return {
    notes,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    useCloud,
    searchQuery,
    setSearchQuery,
    clearError,
    addNote,
    updateNote,
    deleteNote,
    reload: useCloud ? () => loadCloudNotes(true) : undefined,
    loadMore,
  }
}
