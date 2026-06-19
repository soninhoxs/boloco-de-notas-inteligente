/** Versão do aviso de cookies — altere para reexibir o banner após mudanças materiais */
export const COOKIE_CONSENT_VERSION = '2026-06-18'

export const COOKIE_CONSENT_KEYS = {
  choice: 'cookie_consent_choice',
  version: 'cookie_consent_version',
} as const

export type CookieConsentChoice = 'accepted' | 'rejected'

export type CookieConsentStatus = CookieConsentChoice | 'pending'

export const COOKIE_CONSENT_ACCEPTED_EVENT = 'cookie-consent-accepted'

/** Lê apenas o registro mínimo da decisão de cookies (permitido mesmo após rejeição). */
export function getCookieConsentStatus(): CookieConsentStatus {
  try {
    const version = localStorage.getItem(COOKIE_CONSENT_KEYS.version)
    const choice = localStorage.getItem(COOKIE_CONSENT_KEYS.choice)

    if (version !== COOKIE_CONSENT_VERSION) {
      return 'pending'
    }

    if (choice === 'accepted' || choice === 'rejected') {
      return choice
    }
  } catch {
    /* storage indisponível */
  }

  return 'pending'
}

export function setCookieConsentChoice(accepted: boolean): void {
  localStorage.setItem(
    COOKIE_CONSENT_KEYS.choice,
    accepted ? 'accepted' : 'rejected'
  )
  localStorage.setItem(COOKIE_CONSENT_KEYS.version, COOKIE_CONSENT_VERSION)
}

/** Preferências e anotações locais só persistem após aceite. Sessão usa cookies httpOnly (essenciais). */
export function canPersistUserData(): boolean {
  return getCookieConsentStatus() === 'accepted'
}

export function notifyCookieConsentAccepted(): void {
  window.dispatchEvent(new Event(COOKIE_CONSENT_ACCEPTED_EVENT))
}
