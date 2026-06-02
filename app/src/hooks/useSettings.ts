import { useEffect, useState } from 'react'
import type { Settings } from '@/types/settings'

const STORAGE_KEY = 'app_settings'

const DEFAULT_SETTINGS: Settings = {
  username: 'jhss2',
  displayName: 'jhss2',
  bio: '',
  notificationsEnabled: true,
  autoSave: true,
  language: 'pt-BR',
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  return { settings, updateSettings }
}
