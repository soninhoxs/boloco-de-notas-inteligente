import { useState } from 'react'
import type { Settings } from '@/types/settings'
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
} from 'lucide-react'

interface SettingsPageProps {
  settings: Settings
  onUpdateSettings: (patch: Partial<Settings>) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  noteCount: number
  onClearNotes: () => void
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
    <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
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
      className="h-8 w-48 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:bg-input/30"
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
}: SettingsPageProps) {
  const [saved, setSaved] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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

  const initials = (settings.displayName || settings.username)
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl space-y-10 px-6 py-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie seu perfil e preferências do app.
          </p>
        </header>

        {/* Profile */}
        <section className="space-y-3">
          <SectionHeader
            icon={User}
            title="Perfil"
            description="Suas informações pessoais"
          />
          <SettingsCard>
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                {initials}
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {settings.displayName || settings.username}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{settings.username}
                </p>
              </div>
            </div>

            <SettingsRow label="Nome de usuário">
              <FieldInput
                value={settings.username}
                onChange={(v) => onUpdateSettings({ username: v })}
                placeholder="seu_usuario"
                maxLength={32}
              />
            </SettingsRow>

            <SettingsRow
              label="Nome de exibição"
              description="Como seu nome aparece no app"
            >
              <FieldInput
                value={settings.displayName}
                onChange={(v) => onUpdateSettings({ displayName: v })}
                placeholder="Seu nome"
                maxLength={48}
              />
            </SettingsRow>

            <SettingsRow label="Bio" description="Uma linha sobre você">
              <FieldInput
                value={settings.bio}
                onChange={(v) => onUpdateSettings({ bio: v })}
                placeholder="Breve descrição..."
                maxLength={80}
              />
            </SettingsRow>
          </SettingsCard>
        </section>

        {/* Appearance */}
        <section className="space-y-3">
          <SectionHeader
            icon={theme === 'dark' ? Moon : Sun}
            title="Aparência"
            description="Personalize como o app parece"
          />
          <SettingsCard>
            <SettingsRow
              label="Tema"
              description={theme === 'dark' ? 'Modo escuro ativo' : 'Modo claro ativo'}
            >
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                {theme === 'dark' ? (
                  <>
                    <Moon className="size-3.5" /> Escuro
                  </>
                ) : (
                  <>
                    <Sun className="size-3.5" /> Claro
                  </>
                )}
              </button>
            </SettingsRow>
          </SettingsCard>
        </section>

        {/* Notifications */}
        <section className="space-y-3">
          <SectionHeader
            icon={Bell}
            title="Notificações"
            description="Controle o que você recebe"
          />
          <SettingsCard>
            <SettingsRow
              label="Notificações"
              description="Ativar alertas e lembretes"
            >
              <Toggle
                checked={settings.notificationsEnabled}
                onChange={(v) => onUpdateSettings({ notificationsEnabled: v })}
              />
            </SettingsRow>
            <SettingsRow
              label="Salvar automaticamente"
              description="Salva rascunhos ao sair"
            >
              <Toggle
                checked={settings.autoSave}
                onChange={(v) => onUpdateSettings({ autoSave: v })}
              />
            </SettingsRow>
          </SettingsCard>
        </section>

        {/* Language */}
        <section className="space-y-3">
          <SectionHeader
            icon={Globe}
            title="Idioma"
            description="Idioma de exibição do app"
          />
          <SettingsCard>
            <SettingsRow label="Idioma">
              <select
                value={settings.language}
                onChange={(e) =>
                  onUpdateSettings({
                    language: e.target.value as Settings['language'],
                  })
                }
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:bg-input/30"
              >
                <option value="pt-BR">Português (BR)</option>
                <option value="en-US">English (US)</option>
              </select>
            </SettingsRow>
          </SettingsCard>
        </section>

        {/* Data */}
        <section className="space-y-3">
          <SectionHeader
            icon={FileText}
            title="Dados"
            description="Gerencie seus dados locais"
          />
          <SettingsCard>
            <SettingsRow
              label="Anotações salvas"
              description={`${noteCount} ${noteCount === 1 ? 'anotação' : 'anotações'} no dispositivo`}
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
                {confirmClear ? 'Confirmar limpeza' : 'Limpar tudo'}
              </button>
            </SettingsRow>
          </SettingsCard>
        </section>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {saved ? (
              <>
                <Check className="size-4" /> Salvo!
              </>
            ) : (
              <>
                <Save className="size-4" /> Salvar alterações
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
