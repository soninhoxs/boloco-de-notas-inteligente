import { useState, useEffect } from 'react'
import type { Settings, AiProvider } from '@/types/settings'
import { AI_PROVIDERS, getModelLabel } from '@/services/ai-providers'
import { SettingsSelect } from '@/components/ui/settings-select'
import { useI18n } from '@/contexts/I18nContext'
import {
  SETTINGS_AI_API_KEY_ID,
  SETTINGS_AI_SECTION_ID,
  type SettingsFocusTarget,
} from '@/lib/settings-navigation'
import {
  User,
  Bell,
  Globe,
  Save,
  Trash2,
  Moon,
  Sun,
  FileText,
  Check,
  Sparkles,
  Eye,
  EyeOff,
  LogOut,
  Shield,
} from 'lucide-react'
import { LGPD_CONSENT_VERSION } from '@/lib/lgpd'
import { api } from '@/services/api'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { useSettings } from '@/hooks/useSettings'

interface SettingsPageProps {
  settings: Settings
  onUpdateSettings: (patch: Partial<Settings>) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  noteCount: number
  onClearNotes: () => void
  focusSection?: SettingsFocusTarget | null
  onFocusHandled?: () => void
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border">
      {children}
    </div>
  )
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked ? 'bg-primary' : 'bg-input'
      }`}
    >
      <span
        className={`pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function FieldInput({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="h-8 w-48 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  )
}

export function SettingsPage({
  settings,
  onUpdateSettings,
  theme,
  onToggleTheme,
  noteCount,
  onClearNotes,
  focusSection,
  onFocusHandled,
}: SettingsPageProps) {
  const { t } = useI18n()
  const { syncToCloud } = useSettings()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, refreshUser } = useAuth()
  const [saved, setSaved] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [mfaSetupUrl, setMfaSetupUrl] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaDisableCode, setMfaDisableCode] = useState('')
  const [mfaDisablePassword, setMfaDisablePassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [securityMsg, setSecurityMsg] = useState<string | null>(null)

  const providerModels = AI_PROVIDERS[settings.aiProvider].models

  useEffect(() => {
    if (!focusSection) return

    const timer = window.setTimeout(() => {
      const section = document.getElementById(SETTINGS_AI_SECTION_ID)
      section?.scrollIntoView({ behavior: 'smooth', block: 'center' })

      if (focusSection === 'ai-key') {
        setShowApiKey(true)
        window.setTimeout(() => {
          document.getElementById(SETTINGS_AI_API_KEY_ID)?.focus()
        }, 350)
      }

      onFocusHandled?.()
    }, 50)

    return () => window.clearTimeout(timer)
  }, [focusSection, onFocusHandled])

  const handleSave = () => {
    void syncToCloud()
      .then(() => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      })
      .catch(() => {
        setSecurityMsg(t('settings.saveFailed'))
      })
  }

  const handleClearNotes = () => {
    if (confirmClear) {
      onClearNotes()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
    }
  }

  const handleExportData = async () => {
    if (!isAuthenticated) return
    try {
      const blob = await api.users.exportData()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `megabrain-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setSecurityMsg(t('settings.exportSuccess'))
    } catch {
      setSecurityMsg(t('settings.exportFailed'))
    }
  }

  const handleAiToggle = async (enabled: boolean) => {
    if (enabled && isAuthenticated && user && !user.ai_consent_granted) {
      try {
        await api.auth.recordAIConsent(LGPD_CONSENT_VERSION)
      await refreshUser()
      } catch {
        setSecurityMsg(t('settings.aiConsentFailed'))
        return
      }
    }
    onUpdateSettings({ aiEnabled: enabled })
    if (isAuthenticated) {
      try {
        await api.users.updateSettings({ ai_enabled: enabled })
      } catch {
        /* local settings still updated */
      }
    }
  }

  const handleMfaSetup = async () => {
    try {
      const setup = await api.auth.mfaSetup()
      setMfaSetupUrl(setup.otpauth_url)
      setSecurityMsg(t('settings.mfaScanHint'))
    } catch {
      setSecurityMsg(t('settings.mfaSetupFailed'))
    }
  }

  const handleMfaEnable = async () => {
    try {
      await api.auth.mfaEnable(mfaCode.trim())
      setSecurityMsg(t('settings.mfaEnabled'))
      setMfaCode('')
      setMfaSetupUrl(null)
      await refreshUser()
    } catch {
      setSecurityMsg(t('settings.mfaEnableFailed'))
    }
  }

  const handleMfaDisable = async () => {
    try {
      await api.auth.mfaDisable(mfaDisableCode.trim(), mfaDisablePassword || undefined)
      setSecurityMsg(t('settings.mfaDisabled'))
      setMfaDisableCode('')
      setMfaDisablePassword('')
      await refreshUser()
    } catch {
      setSecurityMsg(t('settings.mfaDisableFailed'))
    }
  }

  const handleEmailChange = async () => {
    if (!newEmail.trim()) return
    try {
      const res = await api.users.requestEmailChange(newEmail.trim())
      setSecurityMsg(
        res.verify_url
          ? t('settings.emailChangeDev', { url: res.verify_url })
          : t('settings.emailChangeSent')
      )
      setNewEmail('')
    } catch {
      setSecurityMsg(t('settings.emailChangeFailed'))
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 5000)
      return
    }
    try {
      await api.users.deleteAccount()
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setSecurityMsg(t('settings.deleteAccountFailed'))
      setConfirmDelete(false)
    }
  }

  const profileName =
    settings.displayName || settings.username || t('settings.profileEmptyName')
  const profileHandle = settings.username
    ? `@${settings.username}`
    : t('settings.profileNoUsername')
  const initials = profileName.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl space-y-10 px-6 py-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-muted-foreground">{t('settings.subtitle')}</p>
        </header>

        <section className="space-y-3">
          <SectionHeader
            icon={Shield}
            title={t('settings.account')}
            description={t('settings.accountDesc')}
          />
          <SettingsCard>
            {isAuthenticated && user ? (
              <>
                <SettingsRow
                  label={t('settings.accountEmail')}
                  description={user.email}
                >
                  <span className="text-xs text-muted-foreground">
                    {user.display_name}
                  </span>
                </SettingsRow>
                <SettingsRow label={t('settings.logout')} description="">
                  <button
                    type="button"
                    onClick={async () => {
                      await logout()
                      navigate('/login')
                    }}
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <LogOut className="size-3.5" />
                    {t('settings.logout')}
                  </button>
                </SettingsRow>
              </>
            ) : (
              <SettingsRow
                label={t('settings.account')}
                description={t('settings.accountGuest')}
              >
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="rounded-lg border border-border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {t('settings.login')}
                </button>
              </SettingsRow>
            )}
          </SettingsCard>
        </section>

        {isAuthenticated && user && (
          <section className="space-y-3">
            <SectionHeader
              icon={Shield}
              title={t('settings.security')}
              description={t('settings.securityDesc')}
            />
            <SettingsCard>
              {securityMsg && (
                <p className="px-4 py-3 text-xs text-muted-foreground border-b border-border">
                  {securityMsg}
                </p>
              )}
              <SettingsRow
                label={t('settings.exportData')}
                description={t('settings.exportDataDesc')}
              >
                <button
                  type="button"
                  onClick={() => void handleExportData()}
                  className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  {t('settings.exportData')}
                </button>
              </SettingsRow>
              <SettingsRow
                label={t('settings.mfa')}
                description={
                  user.mfa_enabled ? t('settings.mfaOn') : t('settings.mfaDesc')
                }
              >
                {!user.mfa_enabled ? (
                  <button
                    type="button"
                    onClick={() => void handleMfaSetup()}
                    className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium"
                  >
                    {t('settings.mfaSetup')}
                  </button>
                ) : (
                  <div className="space-y-2 text-right">
                    <span className="block text-xs text-green-600">{t('settings.mfaOn')}</span>
                    <button
                      type="button"
                      onClick={() => setMfaSetupUrl('disable')}
                      className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium"
                    >
                      {t('settings.mfaDisable')}
                    </button>
                  </div>
                )}
              </SettingsRow>
              {mfaSetupUrl === 'disable' && user.mfa_enabled && (
                <div className="space-y-2 px-4 py-3 border-t border-border">
                  <input
                    type="text"
                    value={mfaDisableCode}
                    onChange={(e) => setMfaDisableCode(e.target.value)}
                    placeholder={t('settings.mfaCodePlaceholder')}
                    className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
                  />
                  <input
                    type="password"
                    value={mfaDisablePassword}
                    onChange={(e) => setMfaDisablePassword(e.target.value)}
                    placeholder={t('settings.mfaDisablePassword')}
                    className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleMfaDisable()}
                    className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive"
                  >
                    {t('settings.mfaDisableConfirm')}
                  </button>
                </div>
              )}
              {mfaSetupUrl && mfaSetupUrl !== 'disable' && (
                <div className="space-y-2 px-4 py-3 border-t border-border">
                  <p className="text-xs break-all text-muted-foreground">{mfaSetupUrl}</p>
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder={t('settings.mfaCodePlaceholder')}
                    className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleMfaEnable()}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    {t('settings.mfaActivate')}
                  </button>
                </div>
              )}
              <SettingsRow
                label={t('settings.changeEmail')}
                description={user.pending_email || t('settings.changeEmailDesc')}
              >
                <div className="flex flex-col items-end gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={t('settings.newEmailPlaceholder')}
                    className="h-8 w-48 rounded-lg border border-input bg-card px-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleEmailChange()}
                    className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium"
                  >
                    {t('settings.changeEmail')}
                  </button>
                </div>
              </SettingsRow>
              <SettingsRow
                label={t('settings.deleteAccount')}
                description={t('settings.deleteAccountDesc')}
              >
                <button
                  type="button"
                  onClick={() => void handleDeleteAccount()}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    confirmDelete
                      ? 'border-destructive/40 bg-destructive/10 text-destructive'
                      : 'border-border bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {confirmDelete ? t('settings.deleteAccountConfirm') : t('settings.deleteAccount')}
                </button>
              </SettingsRow>
            </SettingsCard>
          </section>
        )}

        <section className="space-y-3">
          <SectionHeader
            icon={User}
            title={t('settings.profile')}
            description={t('settings.profileDesc')}
          />
          <SettingsCard>
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                {initials}
              </div>
              <div>
                <p className="font-semibold text-foreground">{profileName}</p>
                <p
                  className={cn(
                    'text-sm',
                    settings.username
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/60'
                  )}
                >
                  {profileHandle}
                </p>
              </div>
            </div>

            <SettingsRow label={t('settings.username')}>
              <FieldInput
                value={settings.username}
                onChange={(v) => onUpdateSettings({ username: v })}
                placeholder={t('settings.usernamePlaceholder')}
                maxLength={32}
              />
            </SettingsRow>

            <SettingsRow
              label={t('settings.displayName')}
              description={t('settings.displayNameDesc')}
            >
              <FieldInput
                value={settings.displayName}
                onChange={(v) => onUpdateSettings({ displayName: v })}
                placeholder={t('settings.displayNamePlaceholder')}
                maxLength={48}
              />
            </SettingsRow>

            <SettingsRow
              label={t('settings.bio')}
              description={t('settings.bioDesc')}
            >
              <FieldInput
                value={settings.bio}
                onChange={(v) => onUpdateSettings({ bio: v })}
                placeholder={t('settings.bioPlaceholder')}
                maxLength={80}
              />
            </SettingsRow>
          </SettingsCard>
        </section>

        <section className="space-y-3">
          <SectionHeader
            icon={theme === 'dark' ? Moon : Sun}
            title={t('settings.appearance')}
            description={t('settings.appearanceDesc')}
          />
          <SettingsCard>
            <SettingsRow
              label={t('settings.theme')}
              description={
                theme === 'dark'
                  ? t('settings.themeDark')
                  : t('settings.themeLight')
              }
            >
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                {theme === 'dark' ? (
                  <>
                    <Moon className="size-3.5" /> {t('settings.themeDarkLabel')}
                  </>
                ) : (
                  <>
                    <Sun className="size-3.5" /> {t('settings.themeLightLabel')}
                  </>
                )}
              </button>
            </SettingsRow>
          </SettingsCard>
        </section>

        <section className="space-y-3">
          <SectionHeader
            icon={Bell}
            title={t('settings.notifications')}
            description={t('settings.notificationsDesc')}
          />
          <SettingsCard>
            <SettingsRow
              label={t('settings.notificationsLabel')}
              description={t('settings.notificationsHint')}
            >
              <Toggle
                checked={settings.notificationsEnabled}
                onChange={(v) => onUpdateSettings({ notificationsEnabled: v })}
              />
            </SettingsRow>
            <SettingsRow
              label={t('settings.autoSave')}
              description={t('settings.autoSaveHint')}
            >
              <Toggle
                checked={settings.autoSave}
                onChange={(v) => onUpdateSettings({ autoSave: v })}
              />
            </SettingsRow>
          </SettingsCard>
        </section>

        <section className="space-y-3">
          <SectionHeader
            icon={Globe}
            title={t('settings.language')}
            description={t('settings.languageDesc')}
          />
          <SettingsCard>
            <SettingsRow label={t('settings.language')}>
              <SettingsSelect
                value={settings.language}
                onChange={(language) =>
                  onUpdateSettings({
                    language: language as Settings['language'],
                  })
                }
                options={[
                  { value: 'pt-BR', label: t('settings.languagePt') },
                  { value: 'en-US', label: t('settings.languageEn') },
                ]}
              />
            </SettingsRow>
          </SettingsCard>
        </section>

        <section
          id={SETTINGS_AI_SECTION_ID}
          className="scroll-mt-24 space-y-3"
        >
          <SectionHeader
            icon={Sparkles}
            title={t('settings.ai')}
            description={t('settings.aiDesc')}
          />
          <SettingsCard>
            <SettingsRow
              label={t('settings.aiEnable')}
              description={t('settings.aiEnableHint')}
            >
              <Toggle
                checked={settings.aiEnabled}
                onChange={(v) => void handleAiToggle(v)}
              />
            </SettingsRow>

            <SettingsRow
              label={t('settings.aiProvider')}
              description={t('settings.aiProviderHint')}
            >
              <SettingsSelect
                value={settings.aiProvider}
                onChange={(provider) => {
                  const next = provider as AiProvider
                  onUpdateSettings({
                    aiProvider: next,
                    aiModel: AI_PROVIDERS[next].defaultModel,
                  })
                }}
                options={(
                  Object.entries(AI_PROVIDERS) as [
                    AiProvider,
                    typeof AI_PROVIDERS.groq,
                  ][]
                ).map(([key, provider]) => ({
                  value: key,
                  label: provider.label,
                }))}
              />
            </SettingsRow>

            <SettingsRow label={t('settings.aiModel')}>
              <SettingsSelect
                value={settings.aiModel}
                onChange={(model) => onUpdateSettings({ aiModel: model })}
                options={providerModels.map((model) => ({
                  value: model,
                  label: getModelLabel(model),
                }))}
              />
            </SettingsRow>

            <div className="px-4 py-3 space-y-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('settings.aiApiKey')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('settings.aiApiKeyHint')}{' '}
                  <a
                    href={AI_PROVIDERS[settings.aiProvider].keyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {AI_PROVIDERS[settings.aiProvider].keyHost}
                  </a>
                  . {t('settings.aiApiKeySaved')}
                </p>
              </div>
              <div className="relative max-w-sm">
                <input
                  id={SETTINGS_AI_API_KEY_ID}
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.aiApiKeys[settings.aiProvider]}
                  onChange={(e) =>
                    onUpdateSettings({
                      aiApiKeys: {
                        ...settings.aiApiKeys,
                        [settings.aiProvider]: e.target.value,
                      },
                    })
                  }
                  placeholder={t('settings.aiApiKeyPlaceholder')}
                  className="h-9 w-full max-w-sm rounded-lg border border-input bg-card pr-9 pl-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  aria-label={
                    showApiKey ? t('settings.hideKey') : t('settings.showKey')
                  }
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('settings.aiDisclaimer')}
              </p>
            </div>
          </SettingsCard>
        </section>

        <section className="space-y-3">
          <SectionHeader
            icon={FileText}
            title={t('settings.data')}
            description={t('settings.dataDesc')}
          />
          <SettingsCard>
            <SettingsRow
              label={t('settings.savedNotes')}
              description={
                noteCount === 1
                  ? t('settings.savedNotesOne')
                  : t('settings.savedNotesMany', { count: noteCount })
              }
            >
              <button
                type="button"
                onClick={handleClearNotes}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  confirmClear
                    ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20'
                    : 'border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Trash2 className="size-3.5" />
                {confirmClear ? t('settings.confirmClear') : t('settings.clearAll')}
              </button>
            </SettingsRow>
          </SettingsCard>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {saved ? (
              <>
                <Check className="size-4" /> {t('settings.saved')}
              </>
            ) : (
              <>
                <Save className="size-4" /> {t('settings.save')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
