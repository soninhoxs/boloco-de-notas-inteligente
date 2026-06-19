import { useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Loader2, Menu, X } from 'lucide-react'
import { AppSidebar } from '@/components/global/AppSidebar'
import { GlobalCommand } from '@/components/global/GlobalCommand'
import { ThemeToggle, chromeIconButtonClass } from '@/components/global/ThemeToggle'
import { Toast } from '@/components/global/Toast'
import { HomePage } from '@/pages/HomePage'
import { CalendarPage } from '@/pages/CalendarPage'
import { NotesPage } from '@/pages/NotesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LoginPage } from '@/pages/LoginPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage'
import { VerifyEmailPage } from '@/pages/VerifyEmailPage'
import { CookieConsentBanner } from '@/components/global/CookieConsentBanner'
import { useTheme } from '@/hooks/useTheme'
import { useNotes } from '@/hooks/useNotes'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { I18nProvider, useI18n } from '@/contexts/I18nContext'
import { settingsToAiConfig } from '@/services/ai'
import {
  APP_ROUTES,
  pageFromPath,
  pathFromPage,
  settingsPathWithFocus,
} from '@/lib/app-routes'
import { cn } from '@/lib/utils'
import type { NewNoteInput } from '@/types/notes'
import type { AiProvider } from '@/types/settings'
import type { SettingsFocusTarget } from '@/lib/settings-navigation'

function AuthLoadingScreen() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="text-sm">{t('auth.loading')}</p>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, isGuest } = useAuth()

  if (isLoading) return <AuthLoadingScreen />
  if (!isAuthenticated && !isGuest) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppContent() {
  const { theme, toggleTheme } = useTheme()
  const {
    notes,
    addNote,
    updateNote,
    deleteNote,
    isLoading: notesLoading,
    error: notesError,
    clearError: clearNotesError,
    searchQuery,
    setSearchQuery,
    hasMore,
    isLoadingMore,
    loadMore,
    useCloud,
  } = useNotes()
  const { settings, updateSettings } = useSettings()
  const { user, isAuthenticated, isGuest } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const aiConfig = settingsToAiConfig(settings)
  const currentPage = pageFromPath(location.pathname)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)

  const focusParam = new URLSearchParams(location.search).get('focus')
  const settingsFocus: SettingsFocusTarget | null =
    focusParam === 'ai' || focusParam === 'ai-key' ? focusParam : null

  const sidebarName = isAuthenticated
    ? user?.display_name || settings.displayName
    : settings.displayName
  const sidebarUser = isAuthenticated
    ? user?.email?.split('@')[0] || settings.username
    : settings.username

  const handleNavigate = (page: string) => {
    navigate(pathFromPage(page))
  }

  const handleAddNote = async (note: NewNoteInput) => {
    await addNote(note)
    setToast({ id: Date.now(), message: t('toast.noteSaved') })
  }

  const handleOpenSettings = (target?: SettingsFocusTarget) => {
    navigate(settingsPathWithFocus(target))
  }

  const handleUpdateAiSettings = (patch: {
    aiProvider?: AiProvider
    aiModel?: string
  }) => {
    updateSettings(patch)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        isCollapsed={isCollapsed}
        onCollapsedChange={setIsCollapsed}
        isCommandOpen={isCommandOpen}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        username={sidebarUser}
        displayName={sidebarName}
        isMobileOpen={isMobileSidebarOpen}
        onMobileOpenChange={setIsMobileSidebarOpen}
        showFixedMenuButton={!isGuest}
      />
      <main
        className={cn(
          'min-w-0 flex-1 transition-[margin] duration-300',
          isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        {notesError && (
          <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive md:px-6">
            <div className="mx-auto flex max-w-2xl items-start justify-between gap-3">
              <p>
                {notesError.startsWith('notes.')
                  ? t(notesError as 'notes.error.loadFailed')
                  : notesError}
              </p>
              <button
                type="button"
                onClick={clearNotesError}
                className="shrink-0 rounded-md p-1 hover:bg-destructive/10"
                aria-label={t('notes.dismissError')}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}
        {!isGuest && <ThemeToggle theme={theme} onToggle={toggleTheme} />}
        <GlobalCommand
          onToggleTheme={toggleTheme}
          onOpenChange={setIsCommandOpen}
          onNavigate={handleNavigate}
        />
        {isGuest && (
          <header className="flex h-14 shrink-0 items-center border-b border-border bg-background">
            <div className="flex w-full items-center gap-2 px-4 md:px-6">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className={cn(chromeIconButtonClass, 'lg:hidden')}
                aria-label={t('nav.openMenu')}
              >
                <Menu className="size-5" />
              </button>
              <p className="min-w-0 flex-1 text-center text-xs leading-relaxed text-muted-foreground">
                {t('auth.guestBanner')}
              </p>
              <ThemeToggle
                theme={theme}
                onToggle={toggleTheme}
                variant="inline"
              />
            </div>
          </header>
        )}
        {notesLoading && isAuthenticated && !isGuest ? (
          <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  onAddNote={handleAddNote}
                  aiConfig={aiConfig}
                  onOpenSettings={handleOpenSettings}
                  onUpdateAiSettings={handleUpdateAiSettings}
                  notes={notes}
                />
              }
            />
            <Route
              path="/notas"
              element={
                <NotesPage
                  notes={notes}
                  onDeleteNote={deleteNote}
                  onUpdateNote={updateNote}
                  settings={settings}
                  onOpenSettings={handleOpenSettings}
                  searchQuery={searchQuery}
                  onSearchQueryChange={useCloud ? setSearchQuery : undefined}
                  hasMore={hasMore}
                  isLoadingMore={isLoadingMore}
                  onLoadMore={useCloud ? loadMore : undefined}
                  useCloud={useCloud}
                />
              }
            />
            <Route path="/calendario" element={<CalendarPage notes={notes} />} />
            <Route
              path="/configuracoes"
              element={
                <SettingsPage
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  noteCount={notes.length}
                  onClearNotes={() => notes.forEach((n) => void deleteNote(n.id))}
                  focusSection={settingsFocus}
                  onFocusHandled={() => navigate(APP_ROUTES.settings, { replace: true })}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          actionLabel={t('toast.view')}
          onAction={() => {
            navigate(APP_ROUTES.notes)
            setToast(null)
          }}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

function App() {
  const { settings } = useSettings()

  return (
    <I18nProvider language={settings.language}>
      <CookieConsentBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/privacidade" element={<PrivacyPolicyPage />} />
        <Route path="/privacidade/cookies" element={<PrivacyPolicyPage />} />
        <Route path="/privacidade/termos" element={<PrivacyPolicyPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppContent />
            </RequireAuth>
          }
        />
      </Routes>
    </I18nProvider>
  )
}

export default App
