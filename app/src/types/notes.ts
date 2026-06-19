export interface NoteAttachment {
  id: string
  name: string
  kind: 'image' | 'pdf'
  /** Base64 data URL so it persists in localStorage */
  dataUrl: string
}

export interface NoteLocation {
  longitude: number
  latitude: number
  /** UF do estado (ex: SP, RJ) */
  state: string
  /** Nome da cidade */
  city: string
  /** Human readable label for the place (e.g. address or name) */
  label?: string
  /** What needs to be done at this location */
  task?: string
}

import type { AiProvider } from '@/types/settings'

export interface Note {
  id: string
  text: string
  createdAt: number
  attachments?: NoteAttachment[]
  location?: NoteLocation
  aiProvider?: AiProvider
  aiModel?: string
}

export interface NewNoteInput {
  text: string
  attachments?: NoteAttachment[]
  location?: NoteLocation
  aiProvider?: AiProvider
  aiModel?: string
}
