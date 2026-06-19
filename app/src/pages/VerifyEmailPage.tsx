import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { api } from '@/services/api'
import { useI18n } from '@/contexts/I18nContext'
import { AuthBrandMark } from '@/components/auth/AuthBrandMark'

type VerifyStatus = 'loading' | 'ok' | 'error'

function initialVerifyStatus(token: string): VerifyStatus {
  return token ? 'loading' : 'error'
}

export function VerifyEmailPage() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const isChange = pathname.includes('email-change')
  const [status, setStatus] = useState<VerifyStatus>(() => initialVerifyStatus(token))

  useEffect(() => {
    if (!token) return

    let cancelled = false
    const verify = isChange
      ? api.auth.verifyEmailChange(token)
      : api.auth.verifyEmail(token)

    void verify
      .then(() => {
        if (!cancelled) setStatus('ok')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [token, isChange])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <AuthBrandMark className="mb-8" />
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto size-10 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">{t('auth.verify.loading')}</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <CheckCircle2 className="mx-auto size-10 text-green-600" />
            <h1 className="mt-4 text-lg font-semibold">
              {isChange ? t('auth.verify.changeSuccessTitle') : t('auth.verify.successTitle')}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isChange ? t('auth.verify.changeSuccessBody') : t('auth.verify.successBody')}
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {t('auth.loginTab')}
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="mx-auto size-10 text-destructive" />
            <h1 className="mt-4 text-lg font-semibold">{t('auth.verify.errorTitle')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('auth.verify.errorBody')}</p>
            <Link to="/login" className="mt-6 text-sm text-primary underline-offset-2 hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
