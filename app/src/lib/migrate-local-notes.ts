import type { Note } from '@/types/notes'
import { canPersistUserData } from '@/lib/cookie-consent'
import { api } from '@/services/api'
import { localInputToApiCreate } from '@/lib/note-api-mapper'
import { uploadNoteAttachments } from '@/lib/note-attachments'

const STORAGE_KEY = 'thoughts'
const MIGRATED_KEY = 'thoughts_migrated_to_cloud'

export function getLocalNotesForMigration(): Note[] {
  if (!canPersistUserData()) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Note[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function hasPendingLocalMigration(): boolean {
  if (!canPersistUserData()) return false
  if (localStorage.getItem(MIGRATED_KEY) === '1') return false
  return getLocalNotesForMigration().length > 0
}

export async function migrateLocalNotesToCloud(): Promise<number> {
  const localNotes = getLocalNotesForMigration()
  if (localNotes.length === 0) {
    localStorage.setItem(MIGRATED_KEY, '1')
    return 0
  }

  let imported = 0
  for (const note of localNotes) {
    const attachments = note.attachments?.length
      ? await uploadNoteAttachments(note.attachments)
      : undefined
    await api.notes.create(
      localInputToApiCreate(
        {
          text: note.text,
          attachments,
          location: note.location,
          aiProvider: note.aiProvider,
          aiModel: note.aiModel,
        },
        attachments
      )
    )
    imported += 1
  }

  localStorage.removeItem(STORAGE_KEY)
  localStorage.setItem(MIGRATED_KEY, '1')
  return imported
}
