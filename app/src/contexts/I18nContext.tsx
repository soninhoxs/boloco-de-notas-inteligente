import { createContext, useContext, useEffect, useMemo } from 'react'
import { createI18n, type AppLanguage, type I18n } from '@/lib/i18n'

const I18nContext = createContext<I18n | null>(null)

interface I18nProviderProps {
  language: AppLanguage
  children: React.ReactNode
}

export function I18nProvider({ language, children }: I18nProviderProps) {
  const i18n = useMemo(() => createI18n(language), [language])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return (
    <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
  )
}

export function useI18n(): I18n {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
