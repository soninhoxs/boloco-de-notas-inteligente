import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Mail } from 'lucide-react'
import { AuthBrandMark } from '@/components/auth/AuthBrandMark'
import { useAuth } from '@/contexts/AuthContext'
import { useCookieConsent } from '@/contexts/CookieConsentContext'
import { useI18n } from '@/contexts/I18nContext'
import { useSettings } from '@/hooks/useSettings'
import { ThemeToggle } from '@/components/global/ThemeToggle'
import { useTheme } from '@/hooks/useTheme'
import {
  isLgpdConsentValid,
  LgpdConsent,
} from '@/components/auth/LgpdConsent'
import { recordLocalConsent } from '@/lib/lgpd'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { DottedSurface } from '@/components/ui/dotted-surface'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function GitHubIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

const authInputClass = 'h-10 text-sm sm:text-base'
const authLabelClass = 'mb-1 block text-sm font-medium sm:text-base'
const authHintClass = 'mt-1 text-xs leading-relaxed text-muted-foreground/90 sm:text-sm'
const authButtonClass = 'h-10 w-full gap-2 text-sm sm:h-11 sm:text-base'

function getHealthCheckUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'
  if (apiUrl.startsWith('/')) return '/health'
  const origin = apiUrl.replace(/\/api\/v1\/?$/, '')
  return `${origin}/health`
}

async function isBackendReachable(): Promise<boolean> {
  try {
    const response = await fetch(getHealthCheckUrl(), {
      signal: AbortSignal.timeout(4000),
    })
    return response.ok
  } catch {
    return false
  }
}

function normalizeUsername(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, '')
}

export function LoginPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { theme, toggleTheme } = useTheme()
  const { canPersist: cookiesAccepted, status: cookieStatus } = useCookieConsent()
  const { updateSettings } = useSettings()
  const {
    login,
    completeMfaLogin,
    register,
    continueAsGuest,
    getOAuthUrl,
    isLoading,
    error,
    clearError,
  } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [backendOffline, setBackendOffline] = useState(false)
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null)
  const [resendingVerify, setResendingVerify] = useState(false)

  const busy = submitting || isLoading
  const showResendVerification =
    mode === 'login' && error === 'auth.error.emailNotVerified' && email.trim().length > 0

  const oauthErrorCode = searchParams.get('error')
  const oauthErrorMessage =
    oauthErrorCode === 'oauth'
      ? t('auth.error.oauthFailed')
      : oauthErrorCode === 'oauth_not_configured'
        ? t('auth.error.oauthNotConfigured')
        : oauthErrorCode === 'oauth_consent'
          ? t('auth.error.oauthConsent')
          : oauthErrorCode === 'oauth_email_in_use'
            ? t('auth.error.oauthEmailInUse')
          : null
  const consentOk = isLgpdConsentValid(privacyAccepted, termsAccepted)
  const isRegister = mode === 'register'
  const oauthDisabled =
    !cookiesAccepted || busy || (isRegister && !consentOk)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isRegister && !consentOk) return

    setSubmitting(true)
    clearError()
    setVerifyNotice(null)
    try {
      if (mfaToken) {
        await completeMfaLogin(mfaToken, mfaCode.trim())
        navigate('/', { replace: true })
        return
      }
      if (isRegister) {
        recordLocalConsent()
        const cleanUsername = normalizeUsername(username)
        const name = displayName.trim() || cleanUsername
        const response = await register({
          email: email.trim(),
          password,
          username: cleanUsername,
          displayName: name,
          consentPrivacy: privacyAccepted,
          consentTerms: termsAccepted,
        })
        updateSettings({
          username: cleanUsername,
          displayName: name,
        })
        if (response.email_verification_required) {
          setVerifyNotice(
            response.verify_url
              ? t('auth.verify.devLink', { url: response.verify_url })
              : t('auth.verify.checkEmail')
          )
          setMode('login')
          return
        }
      } else {
        const response = await login(email.trim(), password)
        if (response.mfa_required && response.mfa_token) {
          setMfaToken(response.mfa_token)
          return
        }
      }
      navigate('/', { replace: true })
    } catch {
      /* error in context */
    } finally {
      setSubmitting(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'github') => {
    if (!cookiesAccepted) return
    if (isRegister && !consentOk) return

    clearError()
    setBackendOffline(false)

    const online = await isBackendReachable()
    if (!online) {
      setBackendOffline(true)
      return
    }

    recordLocalConsent()
    window.location.href = getOAuthUrl(provider, true)
  }

  const handleGuest = () => {
    continueAsGuest()
    navigate('/', { replace: true })
  }

  const handleResendVerification = async () => {
    const target = email.trim()
    if (!target) return
    setResendingVerify(true)
    setVerifyNotice(null)
    try {
      const response = await api.auth.resendVerification(target)
      setVerifyNotice(
        response.verify_url
          ? t('auth.verify.resendDevLink', { url: response.verify_url })
          : t('auth.verify.resendSent')
      )
      clearError()
    } catch {
      setVerifyNotice(t('auth.verify.resendSent'))
    } finally {
      setResendingVerify(false)
    }
  }

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
      <DottedSurface theme={theme} className="size-full" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] bg-gradient-to-b from-background/85 via-background/60 to-background/85"
      />

      <header className="relative z-30 flex shrink-0 justify-end px-4 pt-4">
        <ThemeToggle
          theme={theme}
          onToggle={toggleTheme}
          variant="inline"
        />
      </header>

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full w-full flex-col">
        <div
          className={cn(
            'flex w-full flex-1 justify-center px-3 sm:px-4',
            isRegister || cookieStatus === 'pending'
              ? 'items-start py-4 sm:py-6'
              : 'items-center py-4 sm:py-6'
          )}
        >
          <div
            className={cn(
              'w-full shrink-0',
              isRegister ? 'max-w-[480px]' : 'max-w-[420px]',
              cookieStatus === 'pending' ? 'mt-1 mb-6' : 'my-auto'
            )}
          >
            <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
              <header className="border-b border-border px-4 pb-3 pt-4 text-center sm:px-6 sm:pb-4 sm:pt-5">
                <AuthBrandMark
                  className="mx-auto mb-2.5 size-11 sm:mb-3 sm:size-14"
                  iconClassName="size-5 sm:size-7"
                />
                <h1 className="text-xl font-bold tracking-tight text-card-foreground sm:text-2xl">
                  {t('auth.title')}
                </h1>
                <p className="mx-auto mt-1.5 max-w-md text-balance text-sm leading-relaxed text-card-foreground/85 sm:mt-2 sm:text-base">
                  {isRegister ? t('auth.registerSubtitle') : t('auth.subtitle')}
                </p>
              </header>

              <div className="p-4 pb-3 sm:p-6 sm:pb-5">
            <div className="mb-3 flex rounded-lg bg-muted p-1 sm:mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  clearError()
                }}
                className={cn(
                  'flex-1 rounded-md py-2.5 text-sm font-medium transition-colors sm:text-base',
                  mode === 'login'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('auth.loginTab')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register')
                  clearError()
                }}
                className={cn(
                  'flex-1 rounded-md py-2.5 text-sm font-medium transition-colors sm:text-base',
                  mode === 'register'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('auth.registerTab')}
              </button>
            </div>

            {(error || oauthErrorMessage || backendOffline) && (
              <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive sm:text-base">
                {backendOffline
                  ? t('auth.error.backendOffline')
                  : (oauthErrorMessage ??
                    (error?.startsWith('auth.')
                      ? t(error as 'auth.error.loginFailed')
                      : error))}
              </div>
            )}

            {verifyNotice && (
              <div className="mb-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm text-foreground sm:text-base">
                {verifyNotice}
              </div>
            )}

            {showResendVerification && (
              <div className="mb-3">
                <Button
                  type="button"
                  variant="outline"
                  className={authButtonClass}
                  disabled={resendingVerify || busy}
                  onClick={() => void handleResendVerification()}
                >
                  {resendingVerify ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  {t('auth.verify.resend')}
                </Button>
              </div>
            )}

            {!isRegister ? (
              <>
                <div className="space-y-2.5 sm:space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className={authButtonClass}
                    disabled={oauthDisabled}
                    title={
                      !cookiesAccepted
                        ? t('auth.error.oauthCookies')
                        : undefined
                    }
                    onClick={() => handleOAuth('google')}
                  >
                    <GoogleIcon />
                    {t('auth.continueGoogle')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={authButtonClass}
                    disabled={oauthDisabled}
                    title={
                      !cookiesAccepted
                        ? t('auth.error.oauthCookies')
                        : undefined
                    }
                    onClick={() => handleOAuth('github')}
                  >
                    <GitHubIcon />
                    {t('auth.continueGitHub')}
                  </Button>
                </div>

                <div className="my-3 flex items-center gap-3 sm:my-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    {t('auth.orEmail')}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="space-y-3.5 sm:space-y-4"
                >
                  <div>
                    <label className={authLabelClass}>
                      {t('auth.email')}
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder={t('auth.emailPlaceholder')}
                      className={authInputClass}
                    />
                  </div>
                  <div>
                    <label className={authLabelClass}>
                      {t('auth.password')}
                    </label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className={authInputClass}
                    />
                  </div>

                  {mfaToken && (
                    <div>
                      <label className={authLabelClass}>{t('auth.mfaCode')}</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        required
                        autoComplete="one-time-code"
                        placeholder={t('auth.mfaCodePlaceholder')}
                        className={authInputClass}
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    className={authButtonClass}
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : mfaToken ? (
                      t('auth.mfaConfirm')
                    ) : (
                      t('auth.loginButton')
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-4 sm:space-y-5"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                  <div>
                    <label className={authLabelClass}>
                      {t('auth.username')}
                    </label>
                    <Input
                      value={username}
                      onChange={(e) =>
                        setUsername(normalizeUsername(e.target.value))
                      }
                      required
                      minLength={3}
                      maxLength={20}
                      autoComplete="username"
                      placeholder={t('auth.usernamePlaceholder')}
                      className={authInputClass}
                    />
                    <p className={authHintClass}>
                      {t('auth.usernameHint')}
                    </p>
                  </div>
                  <div>
                    <label className={authLabelClass}>
                      {t('auth.displayName')}
                    </label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      minLength={2}
                      autoComplete="name"
                      placeholder={t('auth.displayNamePlaceholder')}
                      className={authInputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={authLabelClass}>
                    {t('auth.email')}
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder={t('auth.emailPlaceholder')}
                    className={authInputClass}
                  />
                </div>

                <div>
                  <label className={authLabelClass}>
                    {t('auth.password')}
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder={t('auth.passwordHint')}
                    className={authInputClass}
                  />
                  <p className={authHintClass}>
                    {t('auth.passwordHint')}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className={authButtonClass}
                    disabled={oauthDisabled}
                    title={
                      !cookiesAccepted
                        ? t('auth.error.oauthCookies')
                        : undefined
                    }
                    onClick={() => handleOAuth('google')}
                  >
                    <GoogleIcon />
                    {t('auth.signUpGoogle')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={authButtonClass}
                    disabled={oauthDisabled}
                    title={
                      !cookiesAccepted
                        ? t('auth.error.oauthCookies')
                        : undefined
                    }
                    onClick={() => handleOAuth('github')}
                  >
                    <GitHubIcon />
                    {t('auth.signUpGitHub')}
                  </Button>
                </div>

                <LgpdConsent
                  variant="footer"
                  privacyAccepted={privacyAccepted}
                  termsAccepted={termsAccepted}
                  onPrivacyChange={setPrivacyAccepted}
                  onTermsChange={setTermsAccepted}
                />

                <Button
                  type="submit"
                  className={authButtonClass}
                  disabled={!consentOk || busy}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  {t('auth.registerButton')}
                </Button>
              </form>
            )}

            <button
              type="button"
              onClick={handleGuest}
              disabled={busy || !cookiesAccepted}
              title={!cookiesAccepted ? t('cookieConsent.guestDisabled') : undefined}
              className="mt-3 w-full text-center text-sm leading-relaxed text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50 sm:mt-4 sm:text-base"
            >
              {t('auth.continueGuest')}
            </button>
            {!cookiesAccepted && (
              <p className="mt-1.5 text-center text-xs leading-relaxed text-muted-foreground/90 sm:text-sm">
                {t('cookieConsent.guestHint')}
              </p>
            )}
              </div>

              <p className="border-t border-border px-4 py-2.5 text-center text-xs text-foreground/80 sm:px-6 sm:py-3 sm:text-sm">
                <Link to="/privacidade" className="text-primary hover:underline">
                  {t('auth.lgpd.privacyLink')}
                </Link>
              </p>
            </div>
          </div>
        </div>
        {cookieStatus === 'pending' && (
          <div
            className="shrink-0"
            style={{ height: 'var(--cookie-banner-height, 12rem)' }}
            aria-hidden
          />
        )}
        </div>
      </main>
    </div>
  )
}
