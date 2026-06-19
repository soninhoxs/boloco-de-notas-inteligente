import { useMemo, useState } from 'react'
import type { Note } from '@/types/notes'
import { useI18n } from '@/contexts/I18nContext'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const levelClasses = [
  'bg-muted',
  'bg-emerald-200 dark:bg-emerald-900',
  'bg-emerald-300 dark:bg-emerald-700',
  'bg-emerald-400 dark:bg-emerald-600',
  'bg-emerald-500 dark:bg-emerald-400',
]

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function levelForCount(count: number) {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count === 3) return 3
  return 4
}

interface DayCell {
  day: number
  key: string
  count: number
  isToday: boolean
}

interface MonthlyCalendarProps {
  notes: Note[]
}

export function MonthlyCalendar({ notes }: MonthlyCalendarProps) {
  const { t, formatMonthYear, weekdayLabels } = useI18n()
  const [view, setView] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const note of notes) {
      const key = dateKey(new Date(note.createdAt))
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [notes])

  const { cells, monthTotal } = useMemo(() => {
    const first = new Date(view.year, view.month, 1)
    const startWeekday = first.getDay()
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const cells: (DayCell | null)[] = []
    for (let i = 0; i < startWeekday; i++) cells.push(null)

    let monthTotal = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(view.year, view.month, d)
      const key = dateKey(date)
      const count = counts.get(key) ?? 0
      monthTotal += count
      cells.push({
        day: d,
        key,
        count,
        isToday: date.getTime() === today.getTime(),
      })
    }

    while (cells.length % 7 !== 0) cells.push(null)

    return { cells, monthTotal }
  }, [view, counts])

  const goPrev = () =>
    setView((v) =>
      v.month === 0
        ? { year: v.year - 1, month: 11 }
        : { year: v.year, month: v.month - 1 }
    )
  const goNext = () =>
    setView((v) =>
      v.month === 11
        ? { year: v.year + 1, month: 0 }
        : { year: v.year, month: v.month + 1 }
    )
  const goToday = () => {
    const now = new Date()
    setView({ year: now.getFullYear(), month: now.getMonth() })
  }

  const title = formatMonthYear(new Date(view.year, view.month, 1))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium capitalize">{title}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t('calendar.today')}
          </button>
          <button
            type="button"
            onClick={goPrev}
            aria-label={t('calendar.prevMonth')}
            className="inline-flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label={t('calendar.nextMonth')}
            className="inline-flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="pb-1 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}

        {cells.map((cell, i) =>
          cell === null ? (
            <div key={`empty-${i}`} />
          ) : (
            <div
              key={cell.key}
              title={`${cell.count} ${cell.count === 1 ? t('calendar.noteOne') : t('calendar.noteMany')}`}
              className={cn(
                'flex aspect-square flex-col items-center justify-center rounded-md border text-xs',
                levelClasses[levelForCount(cell.count)],
                cell.isToday
                  ? 'border-ring ring-1 ring-ring'
                  : 'border-transparent'
              )}
            >
              <span
                className={cn(
                  'font-medium',
                  cell.count > 0 ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {cell.day}
              </span>
            </div>
          )
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {monthTotal === 1
            ? t('calendar.monthTotalOne')
            : t('calendar.monthTotalMany', { count: monthTotal })}
        </span>
        <div className="flex items-center gap-1">
          <span>{t('calendar.less')}</span>
          {levelClasses.map((cls, i) => (
            <div key={i} className={cn('size-3 rounded-sm', cls)} />
          ))}
          <span>{t('calendar.more')}</span>
        </div>
      </div>
    </div>
  )
}
