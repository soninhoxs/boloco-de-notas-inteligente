import { canPersistUserData } from '@/lib/cookie-consent'

/** Versão atual dos termos — deve coincidir com CONSENT_VERSION no backend */
export const LGPD_CONSENT_VERSION = '2026-06-18'

export const LGPD_STORAGE_KEYS = {
  guestMode: 'auth_guest_mode',
  consentVersion: 'lgpd_consent_version',
} as const

export function isGuestMode(): boolean {
  if (!canPersistUserData()) return false
  return localStorage.getItem(LGPD_STORAGE_KEYS.guestMode) === '1'
}

export function setGuestMode(enabled: boolean): void {
  if (!canPersistUserData()) return
  if (enabled) {
    localStorage.setItem(LGPD_STORAGE_KEYS.guestMode, '1')
  } else {
    localStorage.removeItem(LGPD_STORAGE_KEYS.guestMode)
  }
}

export function recordLocalConsent(): void {
  if (!canPersistUserData()) return
  localStorage.setItem(LGPD_STORAGE_KEYS.consentVersion, LGPD_CONSENT_VERSION)
}

export function hasValidLocalConsent(): boolean {
  return (
    localStorage.getItem(LGPD_STORAGE_KEYS.consentVersion) ===
    LGPD_CONSENT_VERSION
  )
}
