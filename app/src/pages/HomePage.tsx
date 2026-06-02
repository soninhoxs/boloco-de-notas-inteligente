import { ThoughtComposer } from '@/components/global/ThoughtComposer'
import type { NewNoteInput } from '@/types/notes'

interface HomePageProps {
  onAddNote: (note: NewNoteInput) => void
}

export function HomePage({ onAddNote }: HomePageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-24">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Diário de pensamentos
          </h1>
          <p className="text-muted-foreground">
            Registre uma ideia — ela será salva em{' '}
            <span className="font-medium text-foreground">Anotações</span>.
          </p>
        </header>

        <ThoughtComposer onSubmit={onAddNote} />
      </div>
    </div>
  )
}
