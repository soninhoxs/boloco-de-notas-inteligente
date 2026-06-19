import type { MasonryCardData } from '@/components/ui/masonry-grid-with-scroll-animation'
import type { Note } from '@/types/notes'
import { detectNoteCategory, stripNoteTagPrefix } from '@/lib/note-tags'

function notePreview(text: string, max = 120): string {
  const clean = stripNoteTagPrefix(text).replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trimEnd()}…`
}

export function notesToMasonryItems(
  notes: Note[],
  labels: Record<string, string>,
  formatDate: (date: Date) => string,
  onSelectNote: (noteId: string) => void
): MasonryCardData[] {
  return notes.map((note) => {
    const category = detectNoteCategory(note.text) ?? 'other'
    const imageAttachment = note.attachments?.find((a) => a.kind === 'image')

    return {
      id: note.id,
      src: imageAttachment?.dataUrl,
      category,
      content: notePreview(note.text),
      linkText: labels[category] ?? labels.other,
      meta: formatDate(new Date(note.createdAt)),
      onClick: () => onSelectNote(note.id),
    }
  })
}
