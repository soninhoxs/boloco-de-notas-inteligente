import { useEffect, useState } from 'react'
import type { Note, NewNoteInput } from '@/types/notes'

const STORAGE_KEY = 'thoughts'

function loadNotes(): Note[] {
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
  const [notes, setNotes] = useState<Note[]>(loadNotes)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  const addNote = (input: NewNoteInput) => {
    const trimmed = input.text.trim()
    const hasAttachments = (input.attachments?.length ?? 0) > 0
    const hasLocation = !!input.location
    if (!trimmed && !hasAttachments && !hasLocation) return

    const note: Note = {
      id: createId(),
      text: trimmed,
      createdAt: Date.now(),
      attachments: hasAttachments ? input.attachments : undefined,
      location: input.location,
    }
    setNotes((prev) => [note, ...prev])
  }

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id))
  }

  return { notes, addNote, deleteNote }
}
