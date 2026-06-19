import { useCallback, useEffect, useState } from 'react'
import { canPersistUserData, COOKIE_CONSENT_ACCEPTED_EVENT } from '@/lib/cookie-consent'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/api'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const THEME_SWITCH_CLASS = 'theme-switching'

function applyTheme(theme: Theme) {
  const root = document.documentElement

  root.classList.add(THEME_SWITCH_CLASS)
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  if (canPersistUserData()) {
    localStorage.setItem(STORAGE_KEY, theme)
  }

  void root.offsetHeight
  root.classList.remove(THEME_SWITCH_CLASS)
}

function getStoredTheme(): Theme | null {
  if (!canPersistUserData()) return null
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return null
}

function getInitialTheme(): Theme {
  return (
    getStoredTheme() ??
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  )
}

export function useTheme() {
  const { isAuthenticated, isGuest, user } = useAuth()
  const cloudSync = isAuthenticated && !isGuest
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  const syncThemeToCloud = useCallback(
    (next: Theme) => {
      if (!cloudSync) return
      void api.users.updateSettings({ theme: next }).catch(() => {
        /* best-effort */
      })
    },
    [cloudSync]
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const serverTheme = user?.settings?.theme
    if (cloudSync && (serverTheme === 'light' || serverTheme === 'dark')) {
      setTheme(serverTheme)
    }
  }, [cloudSync, user?.id, user?.settings?.theme])

  useEffect(() => {
    const reload = () => {
      const next = getInitialTheme()
      setTheme(next)
    }
    window.addEventListener(COOKIE_CONSENT_ACCEPTED_EVENT, reload)
    return () => window.removeEventListener(COOKIE_CONSENT_ACCEPTED_EVENT, reload)
  }, [])

  const toggleTheme = () => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      syncThemeToCloud(next)
      return next
    })
  }

  const setThemeMode = (next: Theme) => {
    syncThemeToCloud(next)
    setTheme(next)
  }

  return { theme, setTheme: setThemeMode, toggleTheme }
}
