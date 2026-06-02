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
  /** Human readable label for the place (e.g. address or name) */
  label?: string
  /** What needs to be done at this location */
  task?: string
}

export interface Note {
  id: string
  text: string
  createdAt: number
  attachments?: NoteAttachment[]
  location?: NoteLocation
}

export interface NewNoteInput {
  text: string
  attachments?: NoteAttachment[]
  location?: NoteLocation
}
