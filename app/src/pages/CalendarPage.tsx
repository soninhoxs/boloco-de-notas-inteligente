import { MonthlyCalendar } from '@/components/global/MonthlyCalendar'
import { useI18n } from '@/contexts/I18nContext'
import type { Note } from '@/types/notes'

interface CalendarPageProps {
  notes: Note[]
}

export function CalendarPage({ notes }: CalendarPageProps) {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {t('calendar.title')}
          </h1>
          <p className="text-muted-foreground">{t('calendar.subtitle')}</p>
        </header>

        <section className="rounded-xl border border-border bg-card p-6 text-card-foreground">
          <MonthlyCalendar notes={notes} />
        </section>
      </div>
    </div>
  )
}
