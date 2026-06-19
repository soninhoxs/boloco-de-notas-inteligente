import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { Cookie } from 'lucide-react'
import { useCookieConsent } from '@/contexts/CookieConsentContext'
import { useI18n } from '@/contexts/I18nContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const policyLinkClass =
  'font-medium text-primary underline-offset-2 hover:underline'

export function CookieConsentBanner() {
  const { status, accept, reject } = useCookieConsent()
  const { t } = useI18n()
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement
    const el = bannerRef.current

    const updateHeight = () => {
      if (status !== 'pending' || !el) {
        root.style.removeProperty('--cookie-banner-height')
        return
      }
      root.style.setProperty('--cookie-banner-height', `${el.offsetHeight}px`)
    }

    updateHeight()

    const observer = el ? new ResizeObserver(updateHeight) : null
    if (el) observer?.observe(el)

    window.addEventListener('resize', updateHeight)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateHeight)
      root.style.removeProperty('--cookie-banner-height')
    }
  }, [status])

  if (status !== 'pending') return null

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className={cn(
        'fixed inset-x-0 bottom-0 z-[100]',
        'border-t border-border bg-background',
        'shadow-[0_-12px_48px_rgba(0,0,0,0.22)]',
        'p-5 sm:p-6 print:hidden'
      )}
    >
      {/* Detalhe visual no topo — sem transparência no corpo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex min-w-0 flex-1 gap-3.5 sm:gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:size-12">
            <Cookie className="size-5 sm:size-6" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1.5 sm:space-y-2">
            <p
              id="cookie-consent-title"
              className="text-base font-semibold leading-snug text-foreground sm:text-lg"
            >
              {t('cookieConsent.title')}
            </p>
            <p
              id="cookie-consent-description"
              className="text-sm leading-relaxed text-muted-foreground sm:text-base"
            >
              {t('cookieConsent.description')}{' '}
              {t('cookieConsent.policiesIntro')}{' '}
              <Link to="/privacidade" className={policyLinkClass}>
                {t('privacy.pageTitle')}
              </Link>
              {', '}
              <Link to="/privacidade/cookies" className={policyLinkClass}>
                {t('cookies.pageTitle')}
              </Link>
              {' '}
              {t('cookieConsent.policiesAnd')}{' '}
              <Link to="/privacidade/termos" className={policyLinkClass}>
                {t('terms.pageTitle')}
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full px-5 text-sm font-medium sm:w-auto sm:text-base"
            onClick={reject}
          >
            {t('cookieConsent.reject')}
          </Button>
          <Button
            type="button"
            className="h-10 w-full px-5 text-sm font-medium sm:h-11 sm:w-auto sm:text-base"
            onClick={accept}
          >
            {t('cookieConsent.accept')}
          </Button>
        </div>
      </div>
    </div>
  )
}
