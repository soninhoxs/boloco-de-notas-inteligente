import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Settings } from '@/types/settings'
import {
  canPersistUserData,
  COOKIE_CONSENT_ACCEPTED_EVENT,
} from '@/lib/cookie-consent'
import {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  createDefaultApiKeys,
} from '@/services/ai-providers'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/api'
import type { AiProvider } from '@/types/settings'

const STORAGE_KEY = 'app_settings'

const SUPPORTED_LANGUAGES = ['pt-BR', 'en-US'] as const

const DEFAULT_API_KEYS = createDefaultApiKeys()

const LEGACY_DEV_USERNAME = 'jhss2'

const DEFAULT_SETTINGS: Settings = {
  username: '',
  displayName: '',
  bio: '',
  notificationsEnabled: true,
  autoSave: true,
  language: 'pt-BR',
  aiEnabled: false,
  aiApiKeys: { ...DEFAULT_API_KEYS },
  aiProvider: 'groq',
  aiModel: AI_PROVIDERS.groq.defaultModel,
}

function normalizeApiKeys(
  raw: Partial<Settings> & { aiApiKey?: string }
): Settings['aiApiKeys'] {
  const keys = { ...createDefaultApiKeys(), ...raw.aiApiKeys }

  const legacyKey = typeof raw.aiApiKey === 'string' ? raw.aiApiKey.trim() : ''
  if (legacyKey && !raw.aiApiKeys) {
    const provider = raw.aiProvider ?? DEFAULT_SETTINGS.aiProvider
    if (provider in keys) {
      keys[provider as keyof typeof keys] = legacyKey
    }
  }

  return keys
}

function stripLegacyDevDefaults(
  raw: Partial<Settings>
): Partial<Settings> {
  const next = { ...raw }
  if (next.username === LEGACY_DEV_USERNAME) next.username = ''
  if (next.displayName === LEGACY_DEV_USERNAME) next.displayName = ''
  return next
}

function normalizeSettings(
  raw: Partial<Settings> & { aiApiKey?: string }
): Settings {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...stripLegacyDevDefaults(raw),
    aiApiKeys: normalizeApiKeys(raw),
  }
  if (!SUPPORTED_LANGUAGES.includes(merged.language)) {
    merged.language = DEFAULT_SETTINGS.language
  }
  if (!AI_PROVIDER_IDS.includes(merged.aiProvider)) {
    merged.aiProvider = DEFAULT_SETTINGS.aiProvider
  }
  const providerConfig = AI_PROVIDERS[merged.aiProvider]
  if (!(providerConfig.models as readonly string[]).includes(merged.aiModel)) {
    merged.aiModel = providerConfig.defaultModel
  }
  return merged
}

function loadSettings(): Settings {
  if (!canPersistUserData()) return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return normalizeSettings(JSON.parse(raw) as Partial<Settings>)
  } catch {
    return DEFAULT_SETTINGS
  }
}

function settingsToApiPayload(patch: Partial<Settings>) {
  const payload: Record<string, unknown> = {}
  if (patch.language !== undefined) payload.language = patch.language
  if (patch.aiEnabled !== undefined) payload.ai_enabled = patch.aiEnabled
  if (patch.aiProvider !== undefined) payload.ai_provider = patch.aiProvider
  if (patch.aiModel !== undefined) payload.ai_model = patch.aiModel
  if (
    patch.notificationsEnabled !== undefined ||
    patch.autoSave !== undefined ||
    patch.bio !== undefined
  ) {
    payload.preferences = {
      notifications_enabled: patch.notificationsEnabled,
      auto_save: patch.autoSave,
      bio: patch.bio,
    }
  }
  return payload
}

interface SettingsContextValue {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  syncToCloud: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isGuest, user } = useAuth()
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const syncTimer = useRef<number | null>(null)

  const cloudSync = isAuthenticated && !isGuest

  useEffect(() => {
    if (!cloudSync || !user) return
    const server = user.settings
    const prefs = server.preferences as Record<string, unknown> | undefined
    setSettings((prev) =>
      normalizeSettings({
        ...prev,
        displayName: user.display_name || prev.displayName,
        language:
          server.language === 'en-US' || server.language === 'pt-BR'
            ? server.language
            : prev.language,
        aiEnabled: server.ai_enabled ?? prev.aiEnabled,
        aiProvider: (server.ai_provider as AiProvider) || prev.aiProvider,
        aiModel: server.ai_model || prev.aiModel,
        notificationsEnabled:
          typeof prefs?.notifications_enabled === 'boolean'
            ? prefs.notifications_enabled
            : prev.notificationsEnabled,
        autoSave:
          typeof prefs?.auto_save === 'boolean'
            ? prefs.auto_save
            : prev.autoSave,
        bio: typeof prefs?.bio === 'string' ? prefs.bio : prev.bio,
      })
    )
  }, [cloudSync, user])

  useEffect(() => {
    if (!canPersistUserData()) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const reload = () => setSettings(loadSettings())
    window.addEventListener(COOKIE_CONSENT_ACCEPTED_EVENT, reload)
    return () => window.removeEventListener(COOKIE_CONSENT_ACCEPTED_EVENT, reload)
  }, [])

  const syncToCloud = async () => {
    if (!cloudSync) return
    const payload = settingsToApiPayload(settings)
    if (Object.keys(payload).length === 0) return
    await api.users.updateSettings(payload)
    if (settings.displayName) {
      await api.users.updateProfile({ display_name: settings.displayName })
    }
  }

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = normalizeSettings({ ...prev, ...patch })
      if (cloudSync) {
        if (syncTimer.current) window.clearTimeout(syncTimer.current)
        syncTimer.current = window.setTimeout(() => {
          void api.users.updateSettings(settingsToApiPayload({ ...prev, ...patch }))
          if (patch.displayName) {
            void api.users.updateProfile({ display_name: patch.displayName })
          }
        }, 600)
      }
      return next
    })
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, syncToCloud }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}
