import { ThoughtComposer } from '@/components/global/ThoughtComposer'
import { useI18n } from '@/contexts/I18nContext'
import type { NewNoteInput, Note } from '@/types/notes'
import type { AiConfig } from '@/services/ai'
import type { AiProvider } from '@/types/settings'
import type { SettingsFocusTarget } from '@/lib/settings-navigation'

interface HomePageProps {
  onAddNote: (note: NewNoteInput) => void
  aiConfig: AiConfig
  onOpenSettings: (target?: SettingsFocusTarget) => void
  onUpdateAiSettings: (patch: {
    aiProvider?: AiProvider
    aiModel?: string
  }) => void
  notes: Note[]
}

export function HomePage({
  onAddNote,
  aiConfig,
  onOpenSettings,
  onUpdateAiSettings,
  notes,
}: HomePageProps) {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-24">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            {t('home.title')}
          </h1>
          <p className="text-muted-foreground">{t('home.subtitle')}</p>
        </header>

        <ThoughtComposer
          onSubmit={onAddNote}
          aiConfig={aiConfig}
          onOpenSettings={onOpenSettings}
          onUpdateAiSettings={onUpdateAiSettings}
          notes={notes}
        />
      </div>
    </div>
  )
}
