import { useState } from 'react'
import type { Note } from '@/types/notes'
import { Pagination } from '@/components/ui/pagination'
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
} from '@/components/ui/mapcn-map-controls'
import { Trash2, NotebookPen, FileText, MapPin } from 'lucide-react'

const PER_PAGE = 6

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

function NoteCard({
  note,
  onDelete,
}: {
  note: Note
  onDelete: (id: string) => void
}) {
  return (
    <li className="group relative rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <button
        type="button"
        onClick={() => onDelete(note.id)}
        aria-label="Excluir anotação"
        className="absolute top-3 right-3 shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>

      <div className="min-w-0 space-y-3 pr-8">
        {note.text && (
          <p className="whitespace-pre-wrap break-words text-sm">{note.text}</p>
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
            <div className="h-44 w-full overflow-hidden rounded-lg border border-border">
              <Map
                center={[note.location.longitude, note.location.latitude]}
                zoom={14}
                interactive={false}
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
                {note.location.label && (
                  <p className="font-medium text-foreground">
                    {note.location.label}
                  </p>
                )}
                {note.location.task && (
                  <p className="text-muted-foreground">{note.location.task}</p>
                )}
                <p className="text-muted-foreground">
                  {note.location.latitude.toFixed(5)},{' '}
                  {note.location.longitude.toFixed(5)}
                </p>
              </div>
            </div>
          </div>
        )}

        <time className="block text-xs text-muted-foreground">
          {dateFormatter.format(new Date(note.createdAt))}
        </time>
      </div>
    </li>
  )
}

interface NotesPageProps {
  notes: Note[]
  onDeleteNote: (id: string) => void
}

export function NotesPage({ notes, onDeleteNote }: NotesPageProps) {
  const [page, setPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(notes.length / PER_PAGE))
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * PER_PAGE
  const visibleNotes = notes.slice(start, start + PER_PAGE)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Anotações</h1>
          <p className="text-muted-foreground">
            {notes.length > 0
              ? `${notes.length} ${notes.length === 1 ? 'anotação registrada' : 'anotações registradas'}`
              : 'Nenhuma anotação ainda'}
          </p>
        </header>

        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 py-12 text-center text-muted-foreground">
            <NotebookPen className="size-8 opacity-50" />
            <p className="text-sm">
              Escreva um pensamento na página inicial e ele aparecerá aqui.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {visibleNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onDelete={onDeleteNote}
                />
              ))}
            </ul>

            <Pagination
              page={safePage}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
