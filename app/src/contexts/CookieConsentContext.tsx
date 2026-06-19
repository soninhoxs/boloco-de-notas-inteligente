import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  COOKIE_CONSENT_ACCEPTED_EVENT,
  getCookieConsentStatus,
  notifyCookieConsentAccepted,
  setCookieConsentChoice,
  type CookieConsentStatus,
} from '@/lib/cookie-consent'

interface CookieConsentContextValue {
  status: CookieConsentStatus
  canPersist: boolean
  accept: () => void
  reject: () => void
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null)

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CookieConsentStatus>(getCookieConsentStatus)

  const accept = useCallback(() => {
    setCookieConsentChoice(true)
    setStatus('accepted')
    notifyCookieConsentAccepted()
  }, [])

  const reject = useCallback(() => {
    setCookieConsentChoice(false)
    setStatus('rejected')
  }, [])

  const value = useMemo(
    () => ({
      status,
      canPersist: status === 'accepted',
      accept,
      reject,
    }),
    [status, accept, reject]
  )

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  )
}

export function useCookieConsent(): CookieConsentContextValue {
  const context = useContext(CookieConsentContext)
  if (!context) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider')
  }
  return context
}

export { COOKIE_CONSENT_ACCEPTED_EVENT }
