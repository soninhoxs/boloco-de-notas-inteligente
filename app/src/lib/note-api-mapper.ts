import type { Note as ApiNote } from '@/services/api'
import type { Note, NewNoteInput, NoteAttachment, NoteLocation } from '@/types/notes'
import { detectNoteCategory } from '@/lib/note-tags'
import type { AiProvider } from '@/types/settings'

function categoryFromText(text: string): string {
  return detectNoteCategory(text) ?? 'idea'
}

function apiLocationToLocal(
  location?: ApiNote['location'] | null
): NoteLocation | undefined {
  if (!location) return undefined
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    state: location.state,
    city: location.city,
    label: location.label,
    task: location.task,
  }
}

function localLocationToApi(
  location?: NoteLocation
): ApiNote['location'] | undefined {
  if (!location) return undefined
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    state: location.state,
    city: location.city,
    label: location.label,
    task: location.task,
  }
}

function apiAttachmentsToLocal(
  metadata?: ApiNote['metadata']
): NoteAttachment[] | undefined {
  const items = metadata?.attachments
  if (!items?.length) return undefined
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.kind as 'image' | 'pdf',
    dataUrl: item.url || '',
  }))
}

export function apiNoteToLocal(note: ApiNote): Note {
  return {
    id: note.id,
    text: note.content,
    createdAt: new Date(note.created_at).getTime(),
    attachments: apiAttachmentsToLocal(note.metadata),
    location: apiLocationToLocal(note.location),
    aiProvider: note.metadata?.ai_provider as AiProvider | undefined,
    aiModel: note.metadata?.ai_model,
  }
}

export function localInputToApiCreate(
  input: NewNoteInput,
  uploadedAttachments?: NoteAttachment[]
) {
  const text = input.text.trim()
  const attachments = uploadedAttachments ?? input.attachments

  return {
    content: text,
    category: categoryFromText(text),
    location: localLocationToApi(input.location),
    metadata: {
      ...(attachments?.length
        ? {
            attachments: attachments.map((a) => ({
              id: a.id,
              name: a.name,
              kind: a.kind,
              file_key: a.dataUrl.startsWith('http') ? '' : a.dataUrl,
              url: a.dataUrl.startsWith('http') ? a.dataUrl : undefined,
            })),
          }
        : {}),
      ...(input.aiProvider ? { ai_provider: input.aiProvider } : {}),
      ...(input.aiModel ? { ai_model: input.aiModel } : {}),
    },
  }
}

export function localPatchToApiUpdate(patch: Partial<Note>) {
  const data: {
    content?: string
    category?: string
    location?: ApiNote['location']
    metadata?: ApiNote['metadata']
  } = {}

  if (patch.text !== undefined) {
    data.content = patch.text
    data.category = categoryFromText(patch.text)
  }
  if (patch.location !== undefined) {
    data.location = localLocationToApi(patch.location)
  }
  if (
    patch.attachments !== undefined ||
    patch.aiProvider !== undefined ||
    patch.aiModel !== undefined
  ) {
    data.metadata = {
      ...(patch.attachments?.length
        ? {
            attachments: patch.attachments.map((a) => ({
              id: a.id,
              name: a.name,
              kind: a.kind,
              file_key: a.dataUrl.startsWith('http') ? '' : a.dataUrl,
              url: a.dataUrl.startsWith('http') ? a.dataUrl : undefined,
            })),
          }
        : {}),
      ...(patch.aiProvider ? { ai_provider: patch.aiProvider } : {}),
      ...(patch.aiModel ? { ai_model: patch.aiModel } : {}),
    }
  }

  return data
}
