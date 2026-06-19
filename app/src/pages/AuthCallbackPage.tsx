import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/contexts/I18nContext'

export function AuthCallbackPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { completeOAuthCallback, isAuthenticated, error, isLoading } = useAuth()

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      navigate('/login?error=oauth', { replace: true })
      return
    }
    completeOAuthCallback(searchParams)
  }, [searchParams, completeOAuthCallback, navigate])

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (!isLoading && error === 'auth.error.oauthFailed') {
      navigate('/login?error=oauth', { replace: true })
    }
  }, [error, isLoading, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{t('auth.callbackLoading')}</p>
    </div>
  )
}
