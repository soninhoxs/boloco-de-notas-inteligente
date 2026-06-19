import {
  translations,
  type AppLanguage,
  type TranslationKey,
} from '@/lib/i18n/translations'

export type { AppLanguage, TranslationKey }

type TranslationParams = Record<string, string | number>

export interface I18n {
  language: AppLanguage
  t: (key: TranslationKey | string, params?: TranslationParams) => string
  formatDate: (
    date: Date,
    options?: Intl.DateTimeFormatOptions
  ) => string
  formatMonthYear: (date: Date) => string
  weekdayLabels: string[]
}

function interpolate(
  template: string,
  params?: TranslationParams
): string {
  if (!params) return template
  return Object.entries(params).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value)),
    template
  )
}

export function createI18n(language: AppLanguage): I18n {
  const dict = translations[language] ?? translations['pt-BR']
  const resolvedLanguage = translations[language] ? language : 'pt-BR'

  return {
    language: resolvedLanguage,
    t(key, params) {
      const template = (dict as Record<string, string | undefined>)[key]
      if (template === undefined) return String(key)
      return interpolate(template, params)
    },
    formatDate(date, options) {
      return new Intl.DateTimeFormat(language, {
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
      }).format(date)
    },
    formatMonthYear(date) {
      return new Intl.DateTimeFormat(language, {
        month: 'long',
        year: 'numeric',
      }).format(date)
    },
    weekdayLabels: dict['calendar.weekdays'].split(','),
  }
}
