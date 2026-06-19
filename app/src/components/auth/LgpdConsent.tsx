import { Link } from 'react-router-dom'
import { useI18n } from '@/contexts/I18nContext'
import { LGPD_CONSENT_VERSION } from '@/lib/lgpd'
import { cn } from '@/lib/utils'

interface LgpdConsentProps {
  privacyAccepted: boolean
  termsAccepted: boolean
  onPrivacyChange: (value: boolean) => void
  onTermsChange: (value: boolean) => void
  className?: string
  variant?: 'card' | 'footer'
  compact?: boolean
}

export function LgpdConsent({
  privacyAccepted,
  termsAccepted,
  onPrivacyChange,
  onTermsChange,
  className,
  variant = 'card',
}: LgpdConsentProps) {
  const { t } = useI18n()
  const isFooter = variant === 'footer'

  return (
    <div
      className={cn(
        isFooter
          ? 'space-y-2.5 border-t border-border pt-3 sm:space-y-3 sm:pt-4'
          : 'space-y-3 rounded-lg border border-border bg-muted/40 p-4',
        className
      )}
    >
      {!isFooter && (
        <>
          <p className="text-sm font-medium text-foreground sm:text-base">
            {t('auth.lgpd.title')}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground/90 sm:text-sm">
            {t('auth.lgpd.summary')}
          </p>
        </>
      )}

      {isFooter && (
        <p className="text-sm font-medium text-muted-foreground sm:text-base">
          {t('auth.lgpd.title')}
        </p>
      )}

      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed sm:text-base">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(e) => onPrivacyChange(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
        />
        <span className="text-muted-foreground">
          {t('auth.lgpd.privacyPrefix')}{' '}
          <Link
            to="/privacidade"
            className="font-medium text-foreground underline-offset-2 hover:underline"
            target="_blank"
          >
            {t('auth.lgpd.privacyLink')}
          </Link>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed sm:text-base">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => onTermsChange(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
        />
        <span className="text-muted-foreground">
          {t('auth.lgpd.termsPrefix')}{' '}
          <Link
            to="/privacidade/termos"
            className="font-medium text-foreground underline-offset-2 hover:underline"
            target="_blank"
          >
            {t('auth.lgpd.termsLink')}
          </Link>{' '}
          {t('auth.lgpd.termsSuffix')}
        </span>
      </label>

      <p className="text-xs text-muted-foreground/80 sm:text-sm">
        {t('auth.lgpd.version', { version: LGPD_CONSENT_VERSION })}
      </p>
    </div>
  )
}

export function isLgpdConsentValid(
  privacyAccepted: boolean,
  termsAccepted: boolean
): boolean {
  return privacyAccepted && termsAccepted
}
